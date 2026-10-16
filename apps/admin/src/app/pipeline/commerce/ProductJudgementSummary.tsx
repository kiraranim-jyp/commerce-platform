import type { JSX } from "react";
import {
  buildJudgementSummary,
  JUDGEMENT_SUMMARY_HINT,
  JUDGEMENT_SUMMARY_TITLE,
  type JudgementSummaryInput,
} from "./judgement-summary";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-030 — **상품 판단 요약** 블록 (표시 전용)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 컴포넌트는 **아무것도 계산하지 않는다.** 줄을 만드는 일은 전부
 *    `buildJudgementSummary`(순수 함수)가 하고, 여기서는 그 결과를 그린다.
 *    그래서 「요약이 말하는 것」을 테스트가 **네트워크·DOM 없이** 단언할 수 있다.
 *
 * 🔴 **상세를 대체하지 않는다.** 아래 분석은 한 줄도 사라지지 않는다 — 이 블록은
 *    결론을 «먼저» 보여 주는 자리일 뿐이고, 근거는 그대로 아래에 있다(CPO §3).
 *
 * 🔴 줄이 하나도 없으면 **렌더하지 않는다** — 빈 요약 상자를 세우지 않는다.
 */
export function ProductJudgementSummary(props: JudgementSummaryInput): JSX.Element | null {
  const rows = buildJudgementSummary(props);
  if (rows.length === 0) return null;

  return (
    <section
      data-testid="judgement-summary"
      className="mb-3 rounded-md border border-border bg-surface/60 p-2.5"
    >
      <p className="text-[11px] font-semibold text-text-primary">{JUDGEMENT_SUMMARY_TITLE}</p>
      <p className="mt-0.5 text-[11px] text-text-tertiary">{JUDGEMENT_SUMMARY_HINT}</p>
      <dl className="mt-2 space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3">
            <dt className="shrink-0 text-[11px] text-text-secondary">{row.label}</dt>
            <dd className="text-right text-[11px] font-medium text-text-primary">
              {row.value}
              {/* 🔴 값만으로 오해할 수 있을 때만 서는 한 줄 — 없으면 DOM 에도 없다. */}
              {row.note && (
                <span className="ml-1 font-normal text-text-tertiary">· {row.note}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
