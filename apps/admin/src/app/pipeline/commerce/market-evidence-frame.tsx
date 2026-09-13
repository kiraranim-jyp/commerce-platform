"use client";

import { CollapsibleSection } from "@/components/ui/CollapsibleSection";

/**
 * MI-UX-FINAL-4(CEO 지시, 2026-09-13) — 「📊 시장 가격 비교」에 들어가면 **바로
 * 내용이 보인다.**
 *
 * ── 무엇이 문제였나 ──────────────────────────────────────────────────────
 * ③④에서 두 가격비교 패널은 「📊 시장 가격 비교」 접힘 **안쪽**에 있는데, 각
 * 패널이 자기 접힘을 한 겹 더 갖고 있었다. 그래서 셀러가 시장 가격을 보려면
 * 두 번 눌러야 했다: 바깥 「📊 시장 가격 비교」를 열고, 그 안에서 다시 🇰🇷 국내
 * 또는 🌎 해외를 연다. 두 번째 클릭이 여는 것은 새 정보가 아니라 **이미 들어온
 * 자리의 내용**이라, 그 클릭은 아무 질문에도 답하지 않는다.
 *
 * ── 두 가지 자리, 두 가지 모양 ───────────────────────────────────────────
 *   DRILL_DOWN  ② 시장 판단. 위 MI 요약이 결론이고 이 표는 그 요약의 원자료다.
 *               요약과 표가 동시에 펼쳐져 있으면 같은 시장 사실이 한 화면에 두
 *               벌 선다 — 그래서 여기서는 접힌 채로 있다가 MI의 [▸ 가격 보기]가
 *               연다(MI-MARKET-EVIDENCE-1에서 정한 그대로다).
 *   FLAT        ③④의 「📊 시장 가격 비교」 안. 셀러가 이미 "시장 가격을 보겠다"고
 *               말하고 들어온 자리다. 제목 한 줄과 내용이고, 접힘은 없다.
 *
 * 두 모양이 여는 내용은 **같은 노드 하나**다 — 자리에 따라 표를 다시 만들지
 * 않는다(그러면 같은 상품의 가격이 두 코드 경로에서 나온다).
 */
export type MarketEvidenceVariant = "DRILL_DOWN" | "FLAT";

/**
 * 관측이 하나도 없을 때의 한 줄. CEO 지시문의 문장 그대로다.
 *
 * "아직 조회 중"과 "조회했는데 없었다"를 뭉개지 않는다 — 이 문장은 조회가 끝난
 * 뒤에만 선다(호출부가 results !== null일 때만 쓴다). 숫자도 범위도 지어내지
 * 않는다는 이 저장소의 빈 상태 규칙 그대로다.
 */
export const MARKET_EVIDENCE_EMPTY = "비교 가능한 상품이 없습니다.";

export function MarketEvidenceFrame({
  variant,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  variant: MarketEvidenceVariant;
  title: string;
  summary: string;
  /** DRILL_DOWN에서만 쓴다. FLAT에는 열고 닫을 것이 없다. */
  open?: boolean;
  onToggle?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  if (variant === "FLAT") {
    return (
      <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <div>
          <p className="text-sm font-medium text-text-primary">{title}</p>
          <p className="text-xs text-text-secondary">{summary}</p>
        </div>
        {children}
      </section>
    );
  }
  return (
    <CollapsibleSection title={title} summary={summary} open={open} onToggle={onToggle}>
      {children}
    </CollapsibleSection>
  );
}
