import fs from "node:fs";
import path from "node:path";
import { universalExtract } from "@commerce/crawler";
import {
  CompositeClassifierProvider,
  GeminiClassifierProvider,
  ImglyRemoverProvider,
  ResolutionThumbnailSelector,
  RuleBaseClassifierProvider,
  SharpEnhancerProvider,
  SharpOptimizerProvider,
  runImagePipeline,
  storagePaths,
  type PipelineProgressEvent,
  type ProcessedImageFile,
  type ProcessedImageResult,
} from "@commerce/image";
import type { ErrorCode } from "@commerce/shared";
import { NextResponse } from "next/server";
import { uploadPublicImage } from "@/lib/image-storage";
import { buildCanonicalProduct } from "./canonical-product";
import type { PipelineResponse, PipelineSSEEvent, WorkspaceItem } from "./response.types";

export const runtime = "nodejs";
export const maxDuration = 300;

/** 파이프라인이 실제로 처리하는 타입만 Workspace 카드로 보여준다.
 * PACKAGE/LOGO/BANNER/UNKNOWN은 분류만 되고 가공 단계를 거치지 않으므로, 이걸
 * "처리 결과를 찾을 수 없음(Failed)"으로 보여주면 실제 실패와 구분이 안 돼 혼란스럽다
 * — 예전 UI에서도 이 타입들은 그냥 조용히 갤러리에서 빠졌었다, 그 동작을 그대로 유지한다. */
const PROCESSED_TYPES = new Set(["PRODUCT", "MODEL", "LIFESTYLE", "DETAIL", "SIZE_CHART"]);

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** 파이프라인 전체를 감싸는 catch에서 error.message만 보고 최선의 ErrorCode를
 * 추정한다 — 완벽한 분류는 아니지만(문자열 매칭 기반), 문의하기/Registration
 * Report가 "알 수 없는 오류" 대신 대략적인 영역이라도 보여줄 수 있게 한다. */
function classifyPipelineError(message: string): ErrorCode {
  const lower = message.toLowerCase();
  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("rate_limited")) {
    return "IMG001";
  }
  if (lower.includes("다운로드")) return "IMG002";
  if (lower.includes("jpg") || lower.includes("jpeg") || lower.includes("변환")) return "IMG003";
  return "EXT001";
}

function mimeFor(fileName: string): string | null {
  const ext = path.extname(fileName).replace(".", "").toLowerCase();
  const format = ext === "jpeg" ? "jpg" : ext;
  return format in MIME_BY_EXT ? MIME_BY_EXT[format] : null;
}

function readAsDataUrl(filePath: string, fileName: string): string | null {
  const mime = mimeFor(fileName);
  if (!mime || !fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

/** 마켓플레이스 등록 payload가 쓸 공개 URL — 실패해도 null만 반환하고 파이프라인
 * 전체를 막지 않는다(브라우저 미리보기는 data URL로 계속 동작해야 한다). */
async function uploadAsPublicUrl(filePath: string, fileName: string): Promise<string | null> {
  const mime = mimeFor(fileName);
  if (!mime || !fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  return uploadPublicImage(buffer, fileName, mime);
}

/** 최종 산출물은 항상 JPG로 통일한다 — WEBP 등 보조 산출물이 있어도 대표로 쓰지 않는다. */
function pickPreferredFile(files: ProcessedImageFile[]): ProcessedImageFile | undefined {
  return files.find((f) => f.format === "jpg") ?? files[0];
}

/** PRODUCT는 원본/누끼 후보 두 변형을 모두 만든다 — detailDataUrl이 기본으로 선택되지
 * 않은 반대쪽 변형을 "대안"으로 노출해서, 사용자가 대표/추가 이미지에 원본 또는
 * 누끼 후보 중 고를 수 있게 한다. */
async function resolveAlternate(processed: ProcessedImageResult): Promise<{
  dataUrl: string | null;
  publicUrl: string | null;
  width?: number;
  height?: number;
  bytes?: number;
  kind: "ORIGINAL" | "PROCESSED";
} | null> {
  const alt = processed.usedOriginal ? processed.processedVariant : processed.originalVariant;
  if (!alt) return null;
  const preferred = pickPreferredFile(alt.files);
  if (!preferred) return null;
  return {
    dataUrl: readAsDataUrl(preferred.file, preferred.fileName),
    publicUrl: await uploadAsPublicUrl(preferred.file, preferred.fileName),
    width: alt.width,
    height: alt.height,
    bytes: preferred.bytes,
    kind: processed.usedOriginal ? "PROCESSED" : "ORIGINAL",
  };
}

export async function POST(request: Request) {
  const { url } = (await request.json()) as { url?: string };
  if (!url) {
    return NextResponse.json({ error: "url이 필요합니다." }, { status: 400 });
  }

  // IMAGE_STORAGE_ROOT / IMAGE_LOGS_ROOT는 배포 환경변수로 /tmp 하위에 고정되어 있다
  // (Vercel 서버리스 함수는 /tmp 외 파일시스템이 읽기 전용이라, 모듈 로드 시점에
  // 경로가 확정되는 storagePaths/PipelineLogger는 요청 중에 바꿀 수 없다).
  // 이전 요청의 잔여물이 남아있지 않도록 시작 시점에 정리한다.
  fs.rmSync(storagePaths.root, { recursive: true, force: true });
  fs.rmSync(process.env.IMAGE_LOGS_ROOT ?? "logs", { recursive: true, force: true });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: PipelineSSEEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      const sendProgress = (event: PipelineProgressEvent) => send({ type: "progress", ...event });

      try {
        sendProgress({
          step: "URL 분석",
          status: "processing",
          message: "상품 URL 분석 중...",
          percent: 0,
          timestamp: new Date().toISOString(),
        });
        const extraction = await universalExtract(url, { debug: true });
        const images = extraction.images;
        if (images.length === 0) {
          send({ type: "error", error: "이미지를 찾지 못했습니다.", code: "IMG001" });
          return;
        }
        const usedStrategies = Object.entries(extraction.strategyCounts ?? {})
          .filter(([, count]) => count > 0)
          .map(([source]) => source);
        const candidateCount = extraction.trace?.length ?? images.length;
        const excludedCount = extraction.trace?.filter((t) => !t.included).length ?? 0;
        sendProgress({
          step: "이미지 추출",
          status: "success",
          message: `이미지 ${images.length}개 추출 (전략: ${usedStrategies.join("+") || "dom-scan"}, 후보 ${candidateCount}개 중 ${excludedCount}개 제외)`,
          percent: 7,
          current: images.length,
          total: images.length,
          timestamp: new Date().toISOString(),
        });

        const result = await runImagePipeline(
          url,
          url,
          images,
          {
            classifier: new CompositeClassifierProvider(
              new GeminiClassifierProvider(),
              new RuleBaseClassifierProvider(),
            ),
            backgroundRemover: new ImglyRemoverProvider(),
            enhancer: new SharpEnhancerProvider(),
            optimizer: new SharpOptimizerProvider(),
            thumbnailSelector: new ResolutionThumbnailSelector(),
          },
          sendProgress,
        );

        const resultByBaseName = new Map<string, ProcessedImageResult>(
          result.images.map((image) => [image.baseName, image]),
        );

        const items: WorkspaceItem[] = await Promise.all(
          result.metadata.classifications
          .filter((classified) => PROCESSED_TYPES.has(classified.type))
          .map(async (classified) => {
            const baseName = path.parse(classified.file).name;
            const processed = resultByBaseName.get(baseName);
            const originalPath = path.join(storagePaths.downloadsOriginal, classified.file);
            const originalDataUrl = readAsDataUrl(originalPath, classified.file);

            if (!processed) {
              return {
                id: baseName,
                fileName: classified.file,
                type: classified.type,
                status: "failed",
                failureReason: "처리 결과를 찾을 수 없습니다.",
                originalDataUrl,
                originalWidth: 0,
                originalHeight: 0,
                originalBytes: 0,
                detailDataUrl: null,
                isRepresentative: false,
                processingTimeSec: 0,
              };
            }

            const preferred =
              processed.status === "success" ? pickPreferredFile(processed.files) : undefined;
            const detailDataUrl = preferred
              ? readAsDataUrl(preferred.file, preferred.fileName)
              : null;
            const detailPublicUrl = preferred
              ? await uploadAsPublicUrl(preferred.file, preferred.fileName)
              : null;
            const alternate = processed.status === "success" ? await resolveAlternate(processed) : null;

            return {
              id: baseName,
              fileName: classified.file,
              type: classified.type,
              status: processed.status,
              failureReason: processed.failureReason,
              originalDataUrl,
              originalWidth: processed.original.width,
              originalHeight: processed.original.height,
              originalBytes: processed.original.bytes,
              detailDataUrl,
              detailPublicUrl,
              outputWidth: processed.output?.width,
              outputHeight: processed.output?.height,
              fileSize: preferred?.bytes,
              isRepresentative: processed.files.some(
                (f) => f.fileName === result.metadata.thumbnail,
              ),
              quality: processed.quality,
              usedOriginal: processed.usedOriginal,
              isJPEG: processed.isJPEG,
              alternateDataUrl: alternate?.dataUrl,
              alternatePublicUrl: alternate?.publicUrl,
              alternateWidth: alternate?.width,
              alternateHeight: alternate?.height,
              alternateBytes: alternate?.bytes,
              alternateKind: alternate?.kind,
              processingTimeSec: Math.round(processed.processingTimeMs / 100) / 10,
            };
          }),
        );

        const byType: Record<string, number> = {};
        for (const item of items) {
          byType[item.type] = (byType[item.type] ?? 0) + 1;
        }

        const nukkiApplied = items.filter(
          (item) => item.type === "PRODUCT" && item.status === "success" && item.usedOriginal === false,
        ).length;

        const canonicalProduct = buildCanonicalProduct(
          url,
          extraction.productData,
          extraction.productDataSources,
          items,
        );

        const response: PipelineResponse = {
          metadata: result.metadata,
          items,
          canonicalProduct,
          report: {
            total: items.length,
            success: items.filter((item) => item.status === "success").length,
            failed: items.filter((item) => item.status === "failed").length,
            processingTimeSec: Math.round((result.stats.processingTimeMs / 1000) * 10) / 10,
            downloaded: result.stats.totalDownloaded,
            byType,
            nukkiApplied,
            dedupRemoved: result.stats.dedupRemoved,
            resized: result.stats.resized,
            compressed: result.stats.compressed,
            extraction: {
              strategies: usedStrategies,
              candidates: candidateCount,
              excluded: excludedCount,
              final: images.length,
            },
          },
          storageNote:
            "미리보기용 원본/처리본은 서버리스 함수의 임시 저장소(/tmp)에만 있어 다음 요청 시 " +
            "자동 삭제됩니다. 마켓플레이스 등록에 실제로 쓰이는 이미지는 Supabase Storage에 " +
            "별도로 영구 업로드됩니다(canonicalProduct.images[].originalUrl/processedUrl).",
        };

        send({ type: "complete", ...response });
      } catch (error) {
        console.error("[pipeline] 실행 실패", error);
        const message = error instanceof Error ? error.message : "알 수 없는 오류";
        send({ type: "error", error: message, code: classifyPipelineError(message) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
