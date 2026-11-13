/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-SELLER-RESULT-UX-REFINE-1 C — **「가격 계산 기준」이 요약으로 «옮겨» 갔다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 전: ③ 수익성 카드 **맨 아래 접힘**(「ⓘ 가격 계산 기준」) — 수식과 긴 설명.
 * 🟢 후: **상품 판단 요약의 한 행** — 실제 적용된 기준만, 수식 0 · 금액 0.
 * 🔴 **계산은 지우지 않았다** — `computePriceBreakdown` 경로는 그대로다(화면만 바뀐다).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildJudgementSummary, priceBasisLines } from "../judgement-summary";
import { stripComments } from "./source-text";

const SRC = (f: string) =>
  stripComments(readFileSync(join(__dirname, "..", f), "utf8").split("\r\n").join("\n"));

const base = {
  verdictLabel: "판매 가능",
  domestic: null,
  overseas: null,
  decisionReason: "국내 참고가격이 확인됐습니다.",
} as Parameters<typeof buildJudgementSummary>[0];

const rowOf = (input: Parameters<typeof buildJudgementSummary>[0], label: string) =>
  buildJudgementSummary(input).find((r) => r.label === label) ?? null;

describe("MSRUX-1C — 가격 계산 기준 이동", () => {
  it("C-1 🟢🟢 요약에 **「가격 계산 기준」 행** 이 선다 — 적용된 것만", () => {
    const row = rowOf(
      { ...base, priceBasisApplied: { cost: true, margin: true, fee: true, domesticMarketReference: true } },
      "가격 계산 기준",
    );
    expect(row, "🔴 요약에 그 행이 없다 — 이동이 끊겼다").toBeTruthy();
    expect(row!.value).toBe("원가와 환율 반영 · 목표 마진 반영 · 판매 수수료 반영 · 국내 시장가격 참고");
  });

  it("C-2 🔴🔴 **적용하지 않은 기준을 적용한 것처럼 적지 않는다**", () => {
    /** 🔴 원가만 적용 — 나머지는 **문장에 없어야** 한다. */
    expect(priceBasisLines({ cost: true })).toEqual(["원가와 환율 반영"]);
    /** 🔴 국내 참고가 없으면 그 말이 사라진다. */
    expect(priceBasisLines({ cost: true, domesticMarketReference: false })).not.toContain(
      "국내 시장가격 참고",
    );
    /** 🔴 아무것도 없으면 **행 자체가 서지 않는다**(빈 줄을 만들지 않는다). */
    expect(rowOf({ ...base, priceBasisApplied: null }, "가격 계산 기준")).toBeNull();
    expect(rowOf({ ...base, priceBasisApplied: {} }, "가격 계산 기준")).toBeNull();
  });

  it("C-3 🔴 **수식도 금액도 넣지 않는다**", () => {
    const row = rowOf(
      { ...base, priceBasisApplied: { cost: true, margin: true, fee: true, domesticMarketReference: true } },
      "가격 계산 기준",
    )!;
    const text = `${row.value} ${row.note ?? ""}`;
    for (const bad of ["÷", "×", "=", "%", "₩", "원)"]) {
      expect(text, `🔴 수식/금액 흔적이 들어왔다: ${bad}`).not.toContain(bad);
    }
    expect(text).not.toMatch(/\d{3,}/);
  });

  it("C-4 🔴🔴 **옛 접힘이 화면에서 사라졌다** — 토글·펼침이 둘 다 없다", () => {
    const panel = SRC("DomesticPriceIntelligencePanel.tsx");
    expect(panel, "🔴 ⓘ 가격 계산 기준 토글이 남아 있다").not.toContain("ⓘ 가격 계산 기준");
    expect(panel, "🔴 펼침 렌더가 남아 있다").not.toContain("{showPriceDetail && (");
  });

  it("C-5 🟢🟢 **계산은 살아 있다** — 지운 것은 화면뿐이다", () => {
    const panel = SRC("DomesticPriceIntelligencePanel.tsx");
    /** 🔴 상세 계산을 만드는 prop 과 문구 owner 는 **그대로** 다(삭제 0). */
    expect(panel, "🔴 상세 계산 prop 까지 지웠다").toContain("priceCalculationDetail");
    expect(panel, "🔴 기준 문구 owner 를 지웠다").toContain("PRICE_BASIS_TOOLTIP");
    /** 🟢 공급 배선이 살아 있다 — 요약이 사실을 받는다. */
    expect(panel, "🔴 요약으로 가는 공급이 끊겼다").toContain("priceBasisApplied");
  });
});
