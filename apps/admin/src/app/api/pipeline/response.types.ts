import type { ImageType, ProductMetadata } from "@commerce/shared";
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
}

export interface PipelineResponse {
  metadata: ProductMetadata;
  items: WorkspaceItem[];
  report: ProcessingReport;
  storageNote: string;
}

/**
 * /api/pipeline은 text/event-stream으로 응답한다. 각 SSE 청크는 "data: <JSON>\n\n"
 * 형태이고, JSON은 아래 셋 중 하나다 — progress가 여러 번 오다가 마지막에 complete
 * 또는 error가 정확히 한 번 온다.
 */
export type PipelineSSEEvent =
  | ({ type: "progress" } & PipelineProgressEvent)
  | ({ type: "complete" } & PipelineResponse)
  | { type: "error"; error: string };
