import type { JSX } from "react";
import { formatKrw } from "@commerce/pricing";
import {
  buildJudgementSummary,
  JUDGEMENT_SUMMARY_HINT,
  JUDGEMENT_SUMMARY_PRICE_LABEL,
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

  /** 🔴 숫자가 아니거나 유한하지 않으면 **금액을 만들지 않는다**(지어내기 0). */
  const price =
    typeof props.recommendedPriceKrw === "number" && Number.isFinite(props.recommendedPriceKrw)
      ? props.recommendedPriceKrw
      : null;

  return (
    <section
      data-testid="judgement-summary"
      className="mb-3 rounded-md border border-border bg-surface/60 p-2.5"
    >
      <p className="text-[11px] font-semibold text-text-primary">{JUDGEMENT_SUMMARY_TITLE}</p>
      <p className="mt-0.5 text-[11px] text-text-tertiary">{JUDGEMENT_SUMMARY_HINT}</p>

      {/**
        * ════════════════════════════════════════════════════════════════════
        * 🔵🔵🔵 SELLER-DECISION-UI-1 ⒝ — **헤드라인: 팔지 말지 · 얼마에**(CEO 확인)
        * ════════════════════════════════════════════════════════════════════
        *
        * 🔴🔴 **요약에서 금액을 말하는 «유일한» 자리다.** 아래 rows 에는 금액이 0 이다.
        * 🔴 값은 `recommendedPriceKrw` **그대로** — `MarketPriceComparison` 의
        *    「추천 판매가」와 「적용」 버튼이 쓰는 **같은 변수** 다 ⟹ 두 숫자가 갈라질
        *    구조가 **없다**(WU-141-R3 C-2 의 안전 목적을 그대로 지킨다).
        * 🔴 **없으면 만들지 않는다** — 후보/집계 가격으로 대체하지 않고 자리를 비운다.
        * 🔴 `formatKrw` 를 직접 구현하지 않는다(`@commerce/pricing` owner 재사용 · 사본 0).
        */}
      <div
        data-testid="judgement-summary-headline"
        className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3"
      >
        <span data-testid="judgement-summary-verdict" className="text-sm font-bold text-text-primary">
          {props.verdictLabel ?? "확인 중"}
        </span>
        {price != null && (
          <span className="text-right">
            <span
              data-testid="judgement-summary-recommended-price"
              className="text-lg font-semibold tabular-nums text-text-primary"
            >
              {formatKrw(price)}
            </span>
            <span className="ml-1 text-[11px] text-text-tertiary">{JUDGEMENT_SUMMARY_PRICE_LABEL}</span>
          </span>
        )}
      </div>
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
