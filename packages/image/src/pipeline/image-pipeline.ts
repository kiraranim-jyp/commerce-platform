import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { ClassifiedImage, ExtractedImage, ImageType, ProductMetadata } from "@commerce/shared";
import { classifyAndSort } from "../services/classify.service";
import { storagePaths } from "../utils/storage-paths.util";
import { deduplicateImages } from "../services/dedup.service";
import { ImageDownloader } from "../services/downloader.service";
import { pipelineLogger } from "../services/logger.service";
import { buildProductMetadata, saveProductMetadata } from "../services/metadata.service";
import { processProductImage } from "../services/product-processor.service";
import type { QualityScore } from "../services/quality-score.service";
import { loadImagePolicy } from "../config/marketplace-policy";
import { standardizeImage, standardizeKeepOriginal } from "../services/standardizer.service";
import type { ThumbnailSelector } from "../services/thumbnail.service";
import type {
  BackgroundRemoverProvider,
  ImageClassifierProvider,
  ImageEnhancerProvider,
  ImageOptimizerProvider,
} from "../types/provider.types";
import { ProgressReporter, type OnProgress, type StageKey } from "./progress";

export type { OnProgress, PipelineProgressEvent, PipelineStepStatus, StageKey } from "./progress";

export interface ImagePipelineDeps {
  classifier: ImageClassifierProvider;
  backgroundRemover: BackgroundRemoverProvider;
  enhancer: ImageEnhancerProvider;
  optimizer: ImageOptimizerProvider;
  thumbnailSelector: ThumbnailSelector;
}

export interface ProcessedImageFile {
  fileName: string;
  file: string;
  format: string;
  bytes: number;
}

/**
 * 이미지 1장의 처리 결과. status가 "failed"여도 전체 파이프라인은 계속 진행된다 —
 * 이전에는 한 장이라도 실패하면 요청 전체가 죽었는데(narrow try/catch가 없었음),
 * Workspace UI에서 이미지별 상태(성공/실패)와 재실행을 보여주려면 실패한 장만
 * 건너뛰고 나머지는 계속 처리해야 한다.
 */
export interface ProcessedImageResult {
  baseName: string;
  type: ImageType;
  status: "success" | "failed";
  failureReason?: string;
  original: { width: number; height: number; bytes: number };
  output?: { width: number; height: number };
  files: ProcessedImageFile[];
  /** PRODUCT에서만 계산된다 — 배경제거 세그멘테이션 품질 점수. */
  quality?: QualityScore;
  /** PRODUCT에서 품질이 기준 미달(혹은 배경제거 자체 실패)이라 원본을 그대로 썼는지 여부. */
  usedOriginal?: boolean;
  /** 이미지 1장 처리에 걸린 시간(ms) — Workspace UI 카드에 처리 시간으로 표시된다. */
  processingTimeMs: number;
}

export interface PipelineStats {
  totalDownloaded: number;
  dedupRemoved: number;
  resized: number;
  compressed: number;
  failed: number;
  processingTimeMs: number;
}

export interface ImagePipelineResult {
  metadataFile: string;
  metadata: ProductMetadata;
  images: ProcessedImageResult[];
  stats: PipelineStats;
}

/** 이미지 1장 처리 도중 하위 단계(배경제거/보정/표준화/압축) 로그를 진행률 스트림으로 보낸다. */
interface SingleImageProgressContext {
  reporter: ProgressReporter;
  stageKey: StageKey;
  step: string;
  current: number;
  total: number;
}

async function readOriginalInfo(file: string): Promise<ProcessedImageResult["original"]> {
  const [metadata, stat] = await Promise.all([sharp(file).metadata(), fs.promises.stat(file)]);
  return { width: metadata.width ?? 0, height: metadata.height ?? 0, bytes: stat.size };
}

function toFailureReason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** PRODUCT는 png/jpg 두 소스 모두에서 webp를 생성하므로 파일명이 겹칠 수 있어 중복을 제거한다. */
function pushUniqueFile(files: ProcessedImageFile[], next: ProcessedImageFile): void {
  if (!files.some((existing) => existing.fileName === next.fileName)) {
    files.push(next);
  }
}

/**
 * PRODUCT 이미지 1장을 배경제거 -> 보정 -> 표준화 -> 압축까지 처리한다.
 * Workspace UI의 "재실행" 버튼이 이미지 1장만 다시 돌릴 때도 이 함수를 그대로 쓴다
 * (그때는 progress가 없다 — 재실행은 카드 1개만 갱신하면 되고 전체 진행률 스트림과는 무관하다).
 */
export async function processSingleProductImage(
  file: string,
  deps: Pick<ImagePipelineDeps, "backgroundRemover" | "enhancer" | "optimizer">,
  progress?: SingleImageProgressContext,
): Promise<ProcessedImageResult> {
  const baseName = path.parse(file).name;
  const itemStartedAt = Date.now();
  let original: ProcessedImageResult["original"] = { width: 0, height: 0, bytes: 0 };
  const emit = (message: string, extra?: { errorMessage?: string }) =>
    progress?.reporter.emit(progress.stageKey, progress.step, "processing", message, {
      current: progress.current,
      total: progress.total,
      fileName: baseName,
      errorMessage: extra?.errorMessage,
    });

  try {
    // 손상되었거나 이미지가 아닌 파일이 들어오면 sharp().metadata()가 여기서 던질 수
    // 있다 — try 블록 밖에 있으면 이 함수 전체의 "실패해도 나머지는 계속 처리한다"는
    // 계약이 깨지고 호출자(배치 파이프라인이든 재실행 라우트든)까지 예외가 새어나간다.
    original = await readOriginalInfo(file);

    // 배경제거는 "필수 단계"가 아니라 "품질이 좋을 때만 쓰는 옵션"이다 — 무료 로컬
    // 모델의 세그멘테이션 자체가 나쁘면 후처리로는 못 살리므로, 여기서 실패하거나
    // (ONNX 워커 크래시 등) 품질 점수가 기준 미달이면 배경제거 결과를 버리고 원본을
    // 그대로 표준화하는 경로로 폴백한다.
    let quality: QualityScore | undefined;
    let removedFile: string | undefined;
    try {
      console.log(`[pipeline] PRODUCT ${baseName}: 배경제거 시작`);
      emit(`${baseName}: 배경제거 시작`);
      const removed = await processProductImage(file, deps.backgroundRemover);
      quality = removed.quality;
      removedFile = removed.file;
      console.log(
        `[pipeline] PRODUCT ${baseName}: 배경제거 완료 (품질 ${quality.overall}점)`,
      );
      emit(`${baseName}: 배경제거 완료 (품질 ${quality.overall}점)`);
    } catch (removeError) {
      console.warn(
        `[pipeline] PRODUCT ${baseName}: 배경제거 실패, 원본 사용으로 폴백`,
        removeError,
      );
      emit(`${baseName}: 배경제거 실패 - 원본 사용`, {
        errorMessage: toFailureReason(removeError),
      });
    }

    const threshold = Number(process.env.IMAGE_QUALITY_THRESHOLD ?? 80);
    const usedOriginal = !removedFile || !quality || quality.overall < threshold;

    let standardized;
    if (!usedOriginal && removedFile) {
      console.log(`[pipeline] PRODUCT ${baseName}: 품질 통과, enhance 시작`);
      fs.mkdirSync(storagePaths.tmp, { recursive: true });
      const enhancedPath = path.join(storagePaths.tmp, `${baseName}-enhanced.png`);
      await deps.enhancer.enhance(removedFile, enhancedPath);
      console.log(`[pipeline] PRODUCT ${baseName}: enhance 완료, standardize 시작`);

      standardized = await standardizeImage(
        enhancedPath,
        storagePaths.processed("product"),
        "PRODUCT",
        deps.enhancer,
        undefined,
        baseName,
      );
      fs.rmSync(enhancedPath);
      emit(`${baseName}: 표준화 완료 (누끼 사용)`);
    } else {
      console.log(
        `[pipeline] PRODUCT ${baseName}: 품질 ${quality?.overall ?? "N/A"}점(기준 ${threshold}점 미만) 또는 배경제거 실패 - 원본 표준화`,
      );
      standardized = [
        await standardizeKeepOriginal(
          file,
          storagePaths.processed("product"),
          baseName,
          loadImagePolicy(),
        ),
      ];
      emit(`${baseName}: 표준화 완료 (원본 사용)`);
    }
    console.log(
      `[pipeline] PRODUCT ${baseName}: standardize 완료(${standardized.length}개), optimize 시작`,
    );

    const files: ProcessedImageFile[] = [];
    for (const std of standardized) {
      const optimized = await deps.optimizer.optimize(std.file);
      for (const opt of optimized) pushUniqueFile(files, opt);
    }
    console.log(`[pipeline] PRODUCT ${baseName}: optimize 완료`);
    emit(`${baseName}: 압축 완료`);

    if (global.gc) {
      global.gc();
    }

    return {
      baseName,
      type: "PRODUCT",
      status: "success",
      original,
      output: { width: standardized[0]?.width ?? 0, height: standardized[0]?.height ?? 0 },
      files,
      quality,
      usedOriginal,
      processingTimeMs: Date.now() - itemStartedAt,
    };
  } catch (error) {
    console.error(`[pipeline] PRODUCT ${baseName}: 처리 실패`, error);
    const failureReason = toFailureReason(error);
    emit(`${baseName}: 처리 실패 - ${failureReason}`, { errorMessage: failureReason });
    return {
      baseName,
      type: "PRODUCT",
      status: "failed",
      failureReason,
      original,
      files: [],
      processingTimeMs: Date.now() - itemStartedAt,
    };
  }
}

/**
 * MODEL/DETAIL/SIZE_CHART 이미지 1장을 (필요 시 보정 후) 표준화 -> 압축까지 처리한다.
 * Workspace UI의 "재실행" 버튼이 이미지 1장만 다시 돌릴 때도 이 함수를 그대로 쓴다.
 */
export async function processSingleStandardImage(
  file: string,
  type: "MODEL" | "DETAIL" | "SIZE_CHART",
  deps: Pick<ImagePipelineDeps, "enhancer" | "optimizer">,
  options: { preEnhance: boolean },
  progress?: SingleImageProgressContext,
): Promise<ProcessedImageResult> {
  const baseName = path.parse(file).name;
  const itemStartedAt = Date.now();
  let original: ProcessedImageResult["original"] = { width: 0, height: 0, bytes: 0 };
  const emit = (message: string, extra?: { errorMessage?: string }) =>
    progress?.reporter.emit(progress.stageKey, progress.step, "processing", message, {
      current: progress.current,
      total: progress.total,
      fileName: baseName,
      errorMessage: extra?.errorMessage,
    });
  let sourcePath = file;

  try {
    original = await readOriginalInfo(file);

    if (options.preEnhance) {
      fs.mkdirSync(storagePaths.tmp, { recursive: true });
      const enhancedPath = path.join(storagePaths.tmp, `${baseName}-enhanced.jpg`);
      await deps.enhancer.enhance(file, enhancedPath);
      sourcePath = enhancedPath;
    }

    const standardized = await standardizeImage(
      sourcePath,
      storagePaths.processed(type),
      type,
      deps.enhancer,
      undefined,
      baseName,
    );
    emit(`${baseName}: 표준화 완료`);

    if (sourcePath !== file) fs.rmSync(sourcePath);

    const files: ProcessedImageFile[] = [];
    for (const std of standardized) {
      const optimized = await deps.optimizer.optimize(std.file);
      for (const opt of optimized) files.push(opt);
    }
    emit(`${baseName}: 압축 완료`);

    return {
      baseName,
      type,
      status: "success",
      original,
      output: { width: standardized[0]?.width ?? 0, height: standardized[0]?.height ?? 0 },
      files,
      processingTimeMs: Date.now() - itemStartedAt,
    };
  } catch (error) {
    if (sourcePath !== file && fs.existsSync(sourcePath)) fs.rmSync(sourcePath);
    console.error(`[pipeline] ${type} ${baseName}: 처리 실패`, error);
    const failureReason = toFailureReason(error);
    emit(`${baseName}: 처리 실패 - ${failureReason}`, { errorMessage: failureReason });
    return {
      baseName,
      type,
      status: "failed",
      failureReason,
      original,
      files: [],
      processingTimeMs: Date.now() - itemStartedAt,
    };
  }
}

/**
 * 이미지 URL 목록을 받아 다운로드 -> 중복제거 -> 분류 -> 타입별 가공(배경제거/화질개선/표준화/압축)
 * -> 대표이미지 선정 -> metadata.json 저장까지 전체 파이프라인을 실행한다.
 *
 * 상품 URL로부터 이미지 URL을 추출하는 것은 이 함수의 책임이 아니다 (packages/crawler 담당).
 * onProgress를 넘기면 각 단계 진행 상황을 실시간으로 받는다 (Workspace UI의 SSE 스트림용).
 */
export async function runImagePipeline(
  sourceUrl: string,
  title: string,
  images: ExtractedImage[],
  deps: ImagePipelineDeps,
  onProgress?: OnProgress,
): Promise<ImagePipelineResult> {
  const startedAt = Date.now();
  const reporter = new ProgressReporter(onProgress);

  reporter.emit(
    "download",
    "이미지 다운로드",
    "processing",
    `이미지 ${images.length}개 다운로드 시작`,
    {
      total: images.length,
    },
  );
  pipelineLogger.info("download", `이미지 ${images.length}개 다운로드 시작`, { sourceUrl });
  const downloaded = await new ImageDownloader().downloadAll(images, (current, total, fileName) => {
    reporter.emit("download", "이미지 다운로드", "processing", `${fileName} 다운로드 완료`, {
      current,
      total,
      fileName,
    });
  });
  pipelineLogger.info("download", "다운로드 완료", { count: downloaded.length });
  reporter.emit(
    "download",
    "이미지 다운로드",
    "success",
    `다운로드 완료 (${downloaded.length}/${images.length})`,
    {
      current: downloaded.length,
      total: images.length,
    },
  );

  reporter.emit("dedup", "중복 제거", "processing", "중복 이미지 검사 중...");
  const { kept, removed } = await deduplicateImages(downloaded);
  pipelineLogger.info("download", `중복 제거: ${removed.length}개 제거, ${kept.length}개 유지`, {
    removed,
  });
  reporter.emit(
    "dedup",
    "중복 제거",
    "success",
    `중복 ${removed.length}개 제거, ${kept.length}개 유지`,
  );

  reporter.emit("classify", "이미지 분류", "processing", `이미지 ${kept.length}개 분류 시작`, {
    total: kept.length,
  });
  const classifications = await classifyAndSort(
    kept,
    deps.classifier,
    (current, total, fileName, type) => {
      reporter.emit("classify", "이미지 분류", "processing", `${fileName} → ${type}`, {
        current,
        total,
        fileName,
      });
    },
  );
  pipelineLogger.info("classify", "분류 완료", classifications);
  reporter.emit("classify", "이미지 분류", "success", `분류 완료 (${classifications.length}장)`, {
    current: classifications.length,
    total: kept.length,
  });

  const filesOfType = (type: string): string[] =>
    classifications
      .filter((c) => c.type === type)
      .map((c) => path.join(storagePaths.classified(type), c.file));

  const productResults = await processProductStage(filesOfType("PRODUCT"), deps, reporter);
  // MODEL은 색감 변경/자동 샤프닝이 금지되어 있어 enhance() 단계를 거치지 않는다.
  const modelResults = await processStandardStage(
    filesOfType("MODEL"),
    "MODEL",
    deps,
    { preEnhance: false },
    reporter,
    "model",
    "MODEL 표준화",
  );
  const detailResults = await processStandardStage(
    filesOfType("DETAIL"),
    "DETAIL",
    deps,
    { preEnhance: false },
    reporter,
    "detail",
    "DETAIL 표준화",
  );
  const sizeChartResults = await processStandardStage(
    filesOfType("SIZE_CHART"),
    "SIZE_CHART",
    deps,
    { preEnhance: false },
    reporter,
    "sizeChart",
    "SIZE_CHART 표준화",
  );

  const allResults = [...productResults, ...modelResults, ...detailResults, ...sizeChartResults];
  const succeeded = allResults.filter((result) => result.status === "success");

  const fileNamesOf = (type: ImageType): string[] =>
    succeeded
      .filter((result) => result.type === type)
      .flatMap((result) => result.files.map((f) => f.fileName));

  const productFileNames = fileNamesOf("PRODUCT");

  reporter.emit("thumbnail", "Thumbnail 생성", "processing", "대표 이미지 선정 중...");
  const thumbnailCandidates = succeeded
    .filter((result) => result.type === "PRODUCT")
    .flatMap((result) => result.files.map((f) => ({ fileName: f.fileName, file: f.file })));
  const { thumbnail } = thumbnailCandidates.length
    ? await deps.thumbnailSelector.select(thumbnailCandidates)
    : { thumbnail: "" };
  reporter.emit(
    "thumbnail",
    "Thumbnail 생성",
    "success",
    thumbnail ? `대표 이미지 선정: ${thumbnail}` : "대표 이미지 후보 없음",
  );

  const metadata = buildProductMetadata({
    title,
    sourceUrl,
    thumbnail,
    productImages: productFileNames,
    detailImages: fileNamesOf("DETAIL"),
    modelImages: fileNamesOf("MODEL"),
    sizeChart: fileNamesOf("SIZE_CHART"),
    classifications,
  });

  const metadataFile = saveProductMetadata(metadata);
  pipelineLogger.info("pipeline", "metadata.json 저장 완료", { metadataFile });

  const stats: PipelineStats = {
    totalDownloaded: downloaded.length,
    dedupRemoved: removed.length,
    resized: succeeded.length,
    compressed: succeeded.length,
    failed: allResults.length - succeeded.length,
    processingTimeMs: Date.now() - startedAt,
  };

  reporter.emit(
    "finalize",
    "완료",
    "success",
    `전체 완료: 성공 ${succeeded.length}장, 실패 ${allResults.length - succeeded.length}장 (${(
      stats.processingTimeMs / 1000
    ).toFixed(1)}s)`,
  );

  return { metadataFile, metadata, images: allResults, stats };
}

/**
 * 이미지 1장씩 배경제거 -> 보정 -> 표준화 -> 압축을 전부 끝내고 다음 이미지로 넘어간다.
 * (배경제거를 여러 장 연속 호출하면 ONNX 런타임의 메모리가 누적되어 서버리스
 * 환경에서 두 번째 호출부터 프로세스가 죽는 문제가 있었다. 각 이미지의 중간
 * 산출물이 완전히 끝나고 GC될 기회를 준 뒤 다음 이미지로 넘어가도록 인터리빙한다.)
 */
async function processProductStage(
  files: string[],
  deps: ImagePipelineDeps,
  reporter: ProgressReporter,
): Promise<ProcessedImageResult[]> {
  const stageKey: StageKey = "product";
  const step = "PRODUCT 누끼 처리";
  if (files.length === 0) return [];

  reporter.emit(stageKey, step, "processing", `PRODUCT 이미지 ${files.length}개 처리 시작`, {
    total: files.length,
  });

  const results: ProcessedImageResult[] = [];
  for (let i = 0; i < files.length; i++) {
    const result = await processSingleProductImage(files[i], deps, {
      reporter,
      stageKey,
      step,
      current: i,
      total: files.length,
    });
    results.push(result);
    reporter.emit(
      stageKey,
      step,
      result.status === "failed" ? "failed" : "processing",
      `${result.baseName}: ${result.status === "success" ? "처리 완료" : "처리 실패"}`,
      {
        current: i + 1,
        total: files.length,
        fileName: result.baseName,
        errorMessage: result.failureReason,
      },
    );
  }

  const successCount = results.filter((r) => r.status === "success").length;
  reporter.emit(stageKey, step, "success", `PRODUCT 처리 완료 (${successCount}/${files.length})`, {
    current: files.length,
    total: files.length,
  });

  pipelineLogger.info("removebg", "PRODUCT 처리 완료", { count: files.length });
  return results;
}

async function processStandardStage(
  files: string[],
  type: "MODEL" | "DETAIL" | "SIZE_CHART",
  deps: ImagePipelineDeps,
  options: { preEnhance: boolean },
  reporter: ProgressReporter,
  stageKey: StageKey,
  step: string,
): Promise<ProcessedImageResult[]> {
  if (files.length === 0) return [];

  reporter.emit(stageKey, step, "processing", `${type} 이미지 ${files.length}개 처리 시작`, {
    total: files.length,
  });

  const results: ProcessedImageResult[] = [];
  for (let i = 0; i < files.length; i++) {
    const result = await processSingleStandardImage(files[i], type, deps, options, {
      reporter,
      stageKey,
      step,
      current: i,
      total: files.length,
    });
    results.push(result);
    reporter.emit(
      stageKey,
      step,
      result.status === "failed" ? "failed" : "processing",
      `${result.baseName}: ${result.status === "success" ? "처리 완료" : "처리 실패"}`,
      {
        current: i + 1,
        total: files.length,
        fileName: result.baseName,
        errorMessage: result.failureReason,
      },
    );
  }

  const successCount = results.filter((r) => r.status === "success").length;
  reporter.emit(stageKey, step, "success", `${type} 처리 완료 (${successCount}/${files.length})`, {
    current: files.length,
    total: files.length,
  });

  return results;
}

export type { ClassifiedImage };
