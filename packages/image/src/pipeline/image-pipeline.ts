import fs from "node:fs";
import path from "node:path";
import type { ClassifiedImage, ExtractedImage, ProductMetadata } from "@commerce/shared";
import { classifyAndSort } from "../services/classify.service";
import { storagePaths } from "../utils/storage-paths.util";
import { deduplicateImages } from "../services/dedup.service";
import { ImageDownloader } from "../services/downloader.service";
import { pipelineLogger } from "../services/logger.service";
import { buildProductMetadata, saveProductMetadata } from "../services/metadata.service";
import { processProductImage } from "../services/product-processor.service";
import { standardizeImage } from "../services/standardizer.service";
import type { ThumbnailSelector } from "../services/thumbnail.service";
import type {
  BackgroundRemoverProvider,
  ImageClassifierProvider,
  ImageEnhancerProvider,
  ImageOptimizerProvider,
} from "../types/provider.types";

export interface ImagePipelineDeps {
  classifier: ImageClassifierProvider;
  backgroundRemover: BackgroundRemoverProvider;
  enhancer: ImageEnhancerProvider;
  optimizer: ImageOptimizerProvider;
  thumbnailSelector: ThumbnailSelector;
}

export interface ImagePipelineResult {
  metadataFile: string;
  metadata: ProductMetadata;
}

/**
 * 이미지 URL 목록을 받아 다운로드 -> 중복제거 -> 분류 -> 타입별 가공(배경제거/화질개선/표준화/압축)
 * -> 대표이미지 선정 -> metadata.json 저장까지 전체 파이프라인을 실행한다.
 *
 * 상품 URL로부터 이미지 URL을 추출하는 것은 이 함수의 책임이 아니다 (packages/crawler 담당).
 */
export async function runImagePipeline(
  sourceUrl: string,
  title: string,
  images: ExtractedImage[],
  deps: ImagePipelineDeps,
): Promise<ImagePipelineResult> {
  pipelineLogger.info("download", `이미지 ${images.length}개 다운로드 시작`, { sourceUrl });
  const downloaded = await new ImageDownloader().downloadAll(images);
  pipelineLogger.info("download", "다운로드 완료", { count: downloaded.length });

  const { kept, removed } = await deduplicateImages(downloaded);
  pipelineLogger.info("download", `중복 제거: ${removed.length}개 제거, ${kept.length}개 유지`, {
    removed,
  });

  const classifications = await classifyAndSort(kept, deps.classifier);
  pipelineLogger.info("classify", "분류 완료", classifications);

  const filesOfType = (type: string): string[] =>
    classifications
      .filter((c) => c.type === type)
      .map((c) => path.join(storagePaths.classified(type), c.file));

  const productImages = await processProductStage(filesOfType("PRODUCT"), deps);
  // MODEL은 색감 변경/자동 샤프닝이 금지되어 있어 enhance() 단계를 거치지 않는다.
  const modelImages = await processStandardStage(filesOfType("MODEL"), "MODEL", deps, {
    preEnhance: false,
  });
  const detailImages = await processStandardStage(filesOfType("DETAIL"), "DETAIL", deps, {
    preEnhance: false,
  });
  const sizeChartImages = await processStandardStage(
    filesOfType("SIZE_CHART"),
    "SIZE_CHART",
    deps,
    {
      preEnhance: false,
    },
  );

  const thumbnailCandidates = productImages.map((image) => ({
    fileName: image.fileName,
    file: image.file,
  }));
  const { thumbnail } = thumbnailCandidates.length
    ? await deps.thumbnailSelector.select(thumbnailCandidates)
    : { thumbnail: "" };

  const metadata = buildProductMetadata({
    title,
    sourceUrl,
    thumbnail,
    productImages: productImages.map((image) => image.fileName),
    detailImages: detailImages.map((image) => image.fileName),
    modelImages: modelImages.map((image) => image.fileName),
    sizeChart: sizeChartImages.map((image) => image.fileName),
    classifications,
  });

  const metadataFile = saveProductMetadata(metadata);
  pipelineLogger.info("pipeline", "metadata.json 저장 완료", { metadataFile });

  return { metadataFile, metadata };
}

interface StageOutputFile {
  fileName: string;
  file: string;
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
): Promise<StageOutputFile[]> {
  if (files.length === 0) return [];

  const outputs: StageOutputFile[] = [];
  for (const file of files) {
    const baseName = path.parse(file).name;

    console.log(`[pipeline] PRODUCT ${baseName}: 배경제거 시작`);
    const removed = await processProductImage(file, deps.backgroundRemover);
    console.log(`[pipeline] PRODUCT ${baseName}: 배경제거 완료, enhance 시작`);

    fs.mkdirSync(storagePaths.tmp, { recursive: true });
    const enhancedPath = path.join(storagePaths.tmp, `${baseName}-enhanced.png`);
    await deps.enhancer.enhance(removed.file, enhancedPath);
    console.log(`[pipeline] PRODUCT ${baseName}: enhance 완료, standardize 시작`);

    const standardized = await standardizeImage(
      enhancedPath,
      storagePaths.processed("product"),
      "PRODUCT",
      deps.enhancer,
      undefined,
      baseName,
    );
    fs.rmSync(enhancedPath);
    console.log(
      `[pipeline] PRODUCT ${baseName}: standardize 완료(${standardized.length}개), optimize 시작`,
    );

    for (const std of standardized) {
      const optimized = await deps.optimizer.optimize(std.file);
      for (const opt of optimized) pushUnique(outputs, { fileName: opt.fileName, file: opt.file });
    }
    console.log(`[pipeline] PRODUCT ${baseName}: optimize 완료`);

    if (global.gc) {
      global.gc();
    }
  }

  pipelineLogger.info("removebg", "PRODUCT 처리 완료", { count: files.length });
  return outputs;
}

/** PRODUCT는 png/jpg 두 소스 모두에서 webp를 생성하므로 파일명이 겹칠 수 있어 중복을 제거한다. */
function pushUnique(outputs: StageOutputFile[], next: StageOutputFile): void {
  if (!outputs.some((existing) => existing.fileName === next.fileName)) {
    outputs.push(next);
  }
}

async function processStandardStage(
  files: string[],
  type: "MODEL" | "DETAIL" | "SIZE_CHART",
  deps: ImagePipelineDeps,
  options: { preEnhance: boolean },
): Promise<StageOutputFile[]> {
  if (files.length === 0) return [];

  const outputs: StageOutputFile[] = [];
  for (const file of files) {
    const baseName = path.parse(file).name;
    let sourcePath = file;

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

    if (sourcePath !== file) fs.rmSync(sourcePath);

    for (const std of standardized) {
      const optimized = await deps.optimizer.optimize(std.file);
      for (const opt of optimized) outputs.push({ fileName: opt.fileName, file: opt.file });
    }
  }
  return outputs;
}

export type { ClassifiedImage };
