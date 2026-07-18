export type PipelineStepStatus = "waiting" | "processing" | "success" | "failed";

export interface PipelineProgressEvent {
  step: string;
  status: PipelineStepStatus;
  current?: number;
  total?: number;
  percent: number;
  fileName?: string;
  message: string;
  errorMessage?: string;
  timestamp: string;
}

export type OnProgress = (event: PipelineProgressEvent) => void;

/**
 * 파이프라인 전체(0~100%) 중 각 단계가 차지하는 비중. PRODUCT 처리가 가장 무거워서
 * (배경제거+보정+표준화+압축을 전부 포함) 가장 큰 비중을 준다. 이미지 종류가 아예
 * 없는 단계(예: MODEL 이미지가 0장)는 total=0으로 즉시 그 구간을 통과한다.
 *
 * 실제 실행 순서는 PRODUCT/MODEL/DETAIL/SIZE_CHART 각각 "배경제거→보정→표준화→압축"을
 * 이미지 1장 단위로 전부 끝내고 다음 장으로 넘어가는 구조라(서버리스 환경에서 배경제거를
 * 연속 호출하면 죽는 문제 때문에 의도적으로 이렇게 인터리빙했다), "표준화"·"압축"을 별도의
 * 전역 단계로 분리하지 않는다 — 대신 각 단계 안에서 파일명 단위로 하위 로그 메시지를 남겨
 * ("0001.jpg: 배경제거 완료", "0001.jpg: 표준화 완료" 등) 세밀한 진행 상황을 보여준다.
 */
const STAGE_WEIGHTS = {
  analyze: 3,
  extract: 4,
  download: 10,
  dedup: 4,
  classify: 12,
  product: 30,
  model: 12,
  detail: 10,
  sizeChart: 5,
  thumbnail: 5,
  finalize: 5,
} as const;

export type StageKey = keyof typeof STAGE_WEIGHTS;

const STAGE_ORDER = Object.keys(STAGE_WEIGHTS) as StageKey[];

export class ProgressReporter {
  private readonly onProgress?: OnProgress;
  private readonly cumulativeBefore: Record<StageKey, number>;

  constructor(onProgress?: OnProgress) {
    this.onProgress = onProgress;
    let acc = 0;
    this.cumulativeBefore = {} as Record<StageKey, number>;
    for (const key of STAGE_ORDER) {
      this.cumulativeBefore[key] = acc;
      acc += STAGE_WEIGHTS[key];
    }
  }

  private percentFor(stageKey: StageKey, current: number, total: number): number {
    const before = this.cumulativeBefore[stageKey];
    const weight = STAGE_WEIGHTS[stageKey];
    const within = total > 0 ? (current / total) * weight : weight;
    return Math.min(100, Math.round(before + within));
  }

  emit(
    stageKey: StageKey,
    step: string,
    status: PipelineStepStatus,
    message: string,
    options: { current?: number; total?: number; fileName?: string; errorMessage?: string } = {},
  ): void {
    if (!this.onProgress) return;
    const { current, total, fileName, errorMessage } = options;
    const percent =
      status === "waiting"
        ? this.cumulativeBefore[stageKey]
        : this.percentFor(stageKey, current ?? total ?? 1, total ?? 1);

    this.onProgress({
      step,
      status,
      current,
      total,
      percent,
      fileName,
      message,
      errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
}
