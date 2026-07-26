import type { FieldSource } from "@commerce/shared";

const STATUS_STYLES: Record<FieldSource, string> = {
  ORIGINAL: "bg-background text-text-secondary border border-border",
  EDITED: "bg-selected-soft text-selected border border-selected-border",
  GENERATED: "bg-ai-soft text-ai border border-ai/20",
};

const STATUS_LABELS: Record<FieldSource, string> = {
  ORIGINAL: "원본",
  EDITED: "수정됨",
  GENERATED: "AI 생성",
};

export function ProvenanceBadge({ source }: { source: FieldSource }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_STYLES[source]}`}>
      {STATUS_LABELS[source]}
    </span>
  );
}

/**
 * CanonicalProduct는 어떤 전략(json-ld/open-graph/dom)이 값을 찾았는지 별도로
 * 들고 있지 않고, 그 정보를 confidence로만 환산해 저장한다(추출 시점에
 * CONFIDENCE_BY_SOURCE 매핑으로 확정). 그래서 Source 컬럼은 confidence를
 * 역으로 등급화해서 보여준다 — 근사치이지만 필드마다 새 타입을 추가하지 않고도
 * PM이 요청한 "Source" 컬럼을 표시할 수 있다.
 */
export function extractionSourceLabel(field: { source: FieldSource; confidence: number }): string {
  if (field.source === "EDITED") return "사용자 입력";
  if (field.confidence >= 0.9) return "JSON-LD";
  if (field.confidence >= 0.7) return "OpenGraph";
  if (field.confidence >= 0.4) return "DOM";
  return "—";
}
