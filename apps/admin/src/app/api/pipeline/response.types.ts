import type { CanonicalProduct, ErrorCode, ImageType, ProductMetadata } from "@commerce/shared";
import type { PipelineProgressEvent, QualityScore } from "@commerce/image";

/**
 * 이미지 1장(사진 1장) 단위의 Workspace 카드 데이터.
 * /api/pipeline과 /api/pipeline/retry가 공통으로 이 모양을 주고받는다 — 재실행이
 * 갱신된 카드 1개를 돌려주면 프론트는 items 배열에서 같은 id를 찾아 그대로 교체한다.
 */
export interface WorkspaceItem {
  id: string;
  fileName: string;
  type: ImageType;
  status: "success" | "failed";
  failureReason?: string;
  originalDataUrl: string | null;
  originalWidth: number;
  originalHeight: number;
  originalBytes: number;
  detailDataUrl: string | null;
  outputWidth?: number;
  outputHeight?: number;
  fileSize?: number;
  isRepresentative: boolean;
  /** PRODUCT에서만 값이 있다 — 배경제거 세그멘테이션 품질 점수. */
  quality?: QualityScore;
  /** PRODUCT에서 품질 미달(또는 배경제거 실패)로 원본을 그대로 썼는지 여부. */
  usedOriginal?: boolean;
  /** 최종 산출물(detailDataUrl)이 실제로 디코딩 가능한 JPEG인지 — status가 "success"면 항상 true다. */
  isJPEG?: boolean;
  /** PRODUCT 전용: detailDataUrl과 반대되는 변형(원본↔배경제거 후보) — 둘 다 만들어졌을
   * 때만 있다. 사용자가 대표/추가 이미지에 원본 또는 누끼 후보 중 선택할 수 있게 한다. */
  alternateDataUrl?: string | null;
  alternateWidth?: number;
  alternateHeight?: number;
  alternateBytes?: number;
  /** alternateDataUrl이 "누끼 처리 후보"인지("PROCESSED") 아니면 "원본"인지("ORIGINAL"). */
  alternateKind?: "ORIGINAL" | "PROCESSED";
  /** 이 이미지 1장 처리에 걸린 시간(초). */
  processingTimeSec: number;
}

export interface ProcessingReport {
  total: number;
  success: number;
  failed: number;
  processingTimeSec: number;
  /** 소스 URL에서 실제로 다운로드한 원본 이미지 개수. */
  downloaded: number;
  byType: Record<string, number>;
  /** PRODUCT 중 실제로 누끼(배경제거)가 적용된 개수 — 품질 미달로 원본을 쓴 건 제외. */
  nukkiApplied: number;
  dedupRemoved: number;
  resized: number;
  compressed: number;
  /** Universal Image Extractor가 어떤 전략으로 몇 개 후보 중 몇 개를 걸러내고 최종
   * 몇 장을 채택했는지 — Extractor Test 페이지 없이도 Workspace에서 바로 보여준다. */
  extraction: {
    strategies: string[];
    candidates: number;
    excluded: number;
    final: number;
  };
}

export interface PipelineResponse {
  metadata: ProductMetadata;
  items: WorkspaceItem[];
  report: ProcessingReport;
  storageNote: string;
  /** Commerce Listing Preview Engine의 유일한 입력 — 플랫폼별 Adapter가 이 값 하나를
   * 각자의 ListingModel로 변환한다. 플랫폼별로 데이터를 따로 만들지 않는다. */
  canonicalProduct: CanonicalProduct;
}

/**
 * /api/pipeline은 text/event-stream으로 응답한다. 각 SSE 청크는 "data: <JSON>\n\n"
 * 형태이고, JSON은 아래 셋 중 하나다 — progress가 여러 번 오다가 마지막에 complete
 * 또는 error가 정확히 한 번 온다.
 */
export type PipelineSSEEvent =
  | ({ type: "progress" } & PipelineProgressEvent)
  | ({ type: "complete" } & PipelineResponse)
  | { type: "error"; error: string; code?: ErrorCode };
