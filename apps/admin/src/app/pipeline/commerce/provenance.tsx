import type { FieldSource } from "@commerce/shared";

const STATUS_STYLES: Record<FieldSource, string> = {
  ORIGINAL: "bg-background text-text-secondary border border-border",
  USER_EDITED: "bg-selected-soft text-selected border border-selected-border",
  AI_GENERATED: "bg-ai-soft text-ai border border-ai/20",
  DEFAULT: "bg-warning-soft text-warning border border-warning/20",
  REQUIRED: "bg-error-soft text-error border border-error/20",
  // N-3.45(CPO 지시) — 점선 테두리로 "다른 곳(상세페이지)을 가리킨다"는 뉘앙스를
  // USER_EDITED와 시각적으로 구분한다(색은 같은 selected 계열 — 사용자가 명시적으로
  // 선택한 상태라는 점은 USER_EDITED와 같다).
  DETAIL_PAGE_REFERENCE: "bg-selected-soft text-selected border border-dashed border-selected-border",
};

// N-3.16(CPO 지시: "ValueBadge 실제 적용") — 가격 화면의 원본/AI 추천/사용자
// 확정 문구와 같은 언어로 맞춘다. 기존에는 이 배지만 "AI 생성"/"수정됨"을
// 썼는데, 화면마다 같은 개념을 다른 단어로 부르면 사용자가 매번 다시
// 학습해야 한다.
const STATUS_LABELS: Record<FieldSource, string> = {
  ORIGINAL: "원본",
  USER_EDITED: "사용자 확정",
  AI_GENERATED: "AI 추천",
  DEFAULT: "기본값",
  REQUIRED: "입력 필요",
  DETAIL_PAGE_REFERENCE: "상세페이지 참조",
};

export function ProvenanceBadge({ source }: { source: FieldSource }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_STYLES[source]}`}>
      {STATUS_LABELS[source]}
    </span>
  );
}

/**
 * N-3.59(CPO 지시: "TTAEJYO가 어디서 이 값을 가져왔지?를 셀러가 바로 알 수
 * 있어야 한다" — "개발자에게는 정교한 상태 모델, 셀러에게는 단순한 행동
 * 지시") — 예전에는 이 함수가 추출 전략(json-ld/open-graph/dom)을 그대로
 * "JSON-LD"/"OpenGraph"/"DOM"으로 노출했다. 개발자에게는 정확하지만
 * 비개발자 판매자에게는 아무 의미 없는 내부 구현 용어라 전부 "원본 상품
 * 페이지"로 합친다 — 어떤 방식으로 읽었든 결국 원본 페이지에서 가져온
 * 값이라는 사실은 같다. CanonicalProduct가 추출 전략을 필드별로 따로 들고
 * 있지 않아(추출 시점에 confidence로만 환산 저장) 여기서 값을 지어내지
 * 않고, 사용자 입력/기본값/참조 등 이미 구분되는 case만 그대로 남긴다.
 */
export function extractionSourceLabel(field: { source: FieldSource; confidence: number }): string {
  if (field.source === "USER_EDITED") return "사용자 입력";
  if (field.source === "DEFAULT") return "기본값";
  if (field.source === "REQUIRED") return "—";
  if (field.source === "DETAIL_PAGE_REFERENCE") return "상세페이지 참조";
  if (field.confidence > 0) return "원본 상품 페이지";
  return "—";
}
