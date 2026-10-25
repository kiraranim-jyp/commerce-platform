/** @vitest-environment jsdom */
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { summarizeCandidateOverseasPrices } from "../../../api/price-history/_lib/candidate-market";
import { MarketPriceComparison } from "../MarketPriceComparison";
import {
  DOMESTIC_REFERENCE_TITLE,
  DOMESTIC_SAME_NOT_CONFIRMED,
  formatReferenceAmount,
  referenceAmountSummary,
} from "../overseas-reference";
import {
  PRICE_BASIS_REFERENCE_LINE,
  PRICE_BASIS_SAME_LINE,
  buildMarketJudgement,
  marketDecisionLines,
  priceBasisLines,
} from "../mi-same-candidates";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";
import type { OverseasPriceSummary } from "../overseas-reference";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2W — **그 가격이 «어떤 자격» 의 가격인가를 한 번에 이해시킨다**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CEO 캡처 실측 — 같은 국내 가격을 **서로 다른 기준** 으로 말했다:
 * ```
 * 🇰🇷  「국내 참고가격 **KRW 88,000** · 확인 1곳」            ← 가격이 «있다»
 * 💡  「**동일상품으로 판정된 판매처의 가격을 기준으로 씁니다**」 ← SAME 기준만 말한다
 * 💡  「**현재 확인된 국내 동일상품 가격은 없습니다**」          ← 가격이 «없다» 로 읽힌다
 * ⟹ 🔴 셀러: 「**88,000원이 있다는 건지 없다는 건지?**」
 * ```
 * 🔴 **원인은 배타적 분기** 였다 — `priceBasisLines` 가 `sameHasPrice ? SAME : REFERENCE`
 *    였고, **해외에 SAME 가격이 있으면** SAME 쪽이 이겨 **국내 참고가격의 «성질» 이 사라졌다**.
 * 🟢 **축이 둘이면 설명도 둘** 로 바꿨다. 그리고 결론이 **금액까지** 말한다(CPO §4-C).
 *
 * 🔴 **SAME / 집계 / 수집 / 해외 로직은 한 줄도 바뀌지 않았다**(§3) — copy + 정보 구조뿐이다.
 */

const KR_REF: OverseasPriceSummary = summarizeCandidateOverseasPrices([
  { market: "KR", currency: "KRW", amount: 88000, priceTier: "COMPARISON", sellerKey: "donokids.com" },
]);
const OS_REF: OverseasPriceSummary = summarizeCandidateOverseasPrices([
  { market: "OVERSEAS", currency: "GBP", amount: 37, priceTier: "EXACT" },
]);

const krRow: GeminiTransientRow = {
  domain: "donokids.com",
  discoveredUrl: "https://www.donokids.com/shop/shopdetail.html?branduid=3362785",
  title: "[보보쇼즈] Hug Hairy Monster T-shirt #226AC009",
  priceAmount: 88000,
  priceCurrency: "KRW",
  priceStatus: "VERIFIED_CURRENT",
  market: "KR",
  soldOut: null,
  matchTruth: "TEXT_CONFIRMED",
  crossSellerVerdict: "PRESUMED_SAME",
};
/** 🟢 CEO 화면 그대로 — **해외에는 SAME 가격이 있다**(그래서 전에 SAME_LINE 이 이겼다). */
const osSame: GeminiTransientRow = {
  ...krRow,
  domain: "junioredition.com",
  discoveredUrl: "https://junioredition.com/products/hug-hairy-monster",
  market: "OVERSEAS",
  priceAmount: 37,
  priceCurrency: "GBP",
  soldOut: false,
  matchTruth: "EXACT_IDENTIFIER",
  crossSellerVerdict: "SAME",
};
/** 🟢 Case B — 국내에 **SAME 가격** 이 있는 경우(기존 정책 유지 확인용). */
const krSame: GeminiTransientRow = { ...krRow, matchTruth: "EXACT_IDENTIFIER", crossSellerVerdict: "SAME", soldOut: false };

function mount(props: Parameters<typeof MarketPriceComparison>[0]): HTMLDivElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  act(() => {
    root.render(createElement(MarketPriceComparison, props));
  });
  return host;
}
const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`);
const text = (el: HTMLElement, id: string) => q(el, id)?.textContent ?? "";
const firstScreen = (el: HTMLElement): string => {
  const c = el.cloneNode(true) as HTMLElement;
  for (const d of [...c.querySelectorAll("details")]) if (!d.hasAttribute("open")) d.remove();
  return (c.textContent ?? "").replace(/\s+/g, " ").trim();
};

/** 🟢 CEO 화면과 같은 상태 — 국내 참고가격만 · 해외 SAME 가격 있음. */
const caseA = () => mount({ rows: [krRow, osSame], domesticReference: KR_REF, overseasReference: OS_REF });

/* ═══════════ §8 계약 1~5 — 가격의 «자격» ═══════════ */

describe("§8-1·2 가격 있음 + SAME 없음을 «동시에» 말한다", () => {
  it("W-1 🟢🟢 Case A — 금액 · 참고가격 성격 · SAME 없음이 **첫 화면에 모두** 있다", () => {
    const first = firstScreen(caseA());
    expect(first).toContain(DOMESTIC_REFERENCE_TITLE);
    expect(first).toContain("KRW 88,000");
    expect(first).toContain(DOMESTIC_SAME_NOT_CONFIRMED);
  });

  /** 🔴 §6 — 참고가격이 있는데 「가격 없음」류가 **같이 뜨면 안 된다**. */
  it("W-2 🔴🔴 참고가격이 있으면 「가격 없음」류가 **첫 화면에 없다**", () => {
    const first = firstScreen(caseA());
    for (const bad of [
      "현재 확인된 국내 동일상품 가격은 없습니다",
      "동일상품 가격이 없습니다",
      "국내 가격이 없습니다",
      "국내 시장 가격이 없습니다",
    ]) {
      expect(first, `🔴 가격이 있는데 「없음」을 말한다: ${bad}`).not.toContain(bad);
    }
  });

  /** 🔴 §8-3 — 참고가격을 **SAME 가격으로 표현하지 않는다**. */
  it("W-3 🔴 참고가격 블록이 **동일상품 가격** 이라고 말하지 않는다", () => {
    const kr = text(caseA(), "domestic-reference");
    for (const bad of ["동일상품 확인 가격", "동일상품 가격", "형성대", "가격대"]) {
      expect(kr, `🔴 참고가격을 ${bad} 로 적었다`).not.toContain(bad);
    }
    expect(kr).toContain(DOMESTIC_REFERENCE_TITLE);
  });
});

describe("§8-4 가격 판단 기준이 두 축을 혼동하지 않는다", () => {
  /**
   * 🔴🔴🔴 **이것이 CORE-2W 의 핵심 단언이다.**
   *    전까지 `sameHasPrice ? SAME : REFERENCE` 라 **해외 SAME 이 있으면** 국내 참고가격의
   *    성질 설명이 **사라졌다** — 그래서 88,000 의 자격을 화면만 보고 알 수 없었다.
   */
  it("W-4 🔴🔴 두 축이 다 있으면 **설명도 둘** 이다", () => {
    const basis = priceBasisLines(buildMarketJudgement([krRow, osSame]), {
      domestic: KR_REF,
      overseas: OS_REF,
    });
    expect(basis, "🔴 SAME 축 설명이 없다").toContain(PRICE_BASIS_SAME_LINE);
    expect(basis, "🔴 참고가격 축 설명이 사라졌다 — 88,000 의 자격을 알 수 없다").toContain(
      PRICE_BASIS_REFERENCE_LINE,
    );
    /** 🔴 확정된 것이 **먼저** 다(더 강한 근거). */
    expect(basis.indexOf(PRICE_BASIS_SAME_LINE)).toBeLessThan(basis.indexOf(PRICE_BASIS_REFERENCE_LINE));
  });

  /** 🟢 한 축만 있으면 **그 축만** 말한다(없는 설명을 적지 않는다). */
  it("W-5 🟢 한 축만 있으면 그 축의 설명만 선다", () => {
    expect(priceBasisLines(buildMarketJudgement([krRow]), { domestic: KR_REF })).not.toContain(
      PRICE_BASIS_SAME_LINE,
    );
    expect(priceBasisLines(buildMarketJudgement([osSame]), {})).not.toContain(PRICE_BASIS_REFERENCE_LINE);
  });

  /** 🔴 §6 — 참고가격 축에서 「동일상품으로 판정된 가격을 기준으로」를 **단독 사용 금지**. */
  it("W-6 🔴 참고가격만 있을 때 SAME 기준 문장이 **단독으로 서지 않는다**", () => {
    const basis = priceBasisLines(buildMarketJudgement([krRow]), { domestic: KR_REF });
    expect(basis).not.toContain(PRICE_BASIS_SAME_LINE);
    expect(basis).toContain(PRICE_BASIS_REFERENCE_LINE);
  });
});

describe("§8-5 판매 판단이 상단 가격을 부정하지 않는다", () => {
  /** 🔴🔴 CPO §4-C 의 문장 그대로 — **금액을 말하고, 자격을 말한다.** */
  it("W-7 🟢🟢 결론이 **금액 + 자격** 을 한 번에 말한다", () => {
    const d = marketDecisionLines(buildMarketJudgement([krRow, osSame]), {
      domestic: KR_REF,
      overseas: OS_REF,
    });
    const joined = d.lines.join(" ");
    expect(joined, "🔴 결론에서 금액이 사라졌다(§7-A FAIL)").toContain("KRW 88,000");
    expect(joined).toContain("동일상품 가격으로 확정하지 않습니다");
    expect(joined, "🔴 결론이 상단 가격을 부정한다").not.toContain(
      "현재 확인된 국내 동일상품 가격은 없습니다",
    );
  });

  /** 🟢 SAME 이 하나도 없을 때도 같은 구조다(두 분기가 같은 말을 쓴다). */
  it("W-8 🟢 SAME 0 분기도 금액 + 자격을 말한다", () => {
    const d = marketDecisionLines(buildMarketJudgement([krRow]), { domestic: KR_REF });
    expect(d.kind).toBe("NO_SAME_WITH_REFERENCE");
    const joined = d.lines.join(" ");
    expect(joined).toContain("KRW 88,000");
    expect(joined).toContain("동일상품 가격으로 확정하지 않습니다");
  });

  /** 🔴 Case C — 참고가격 자체가 없으면 **기존 흐름 그대로**(새 fallback 0). */
  it("W-9 🟢 Case C — 참고가격이 없으면 기존 문장 유지", () => {
    const d = marketDecisionLines(buildMarketJudgement([osSame]), {});
    expect(d.lines.join(" ")).toContain("현재 확인된 국내 동일상품 가격은 없습니다");
    expect(d.lines.join(" ")).not.toContain("KRW");
  });
});

/* ═══════════ §8-6·7·8 — 섞이지 않는다 · 로직 불변 ═══════════ */

describe("§8-6·7·8 국내/해외 분리 · 로직 불변", () => {
  /**
   * 🔴🔴 **1차 단언이 틀렸고 코드가 맞았다. 적는다.**
   *    처음엔 「결론이 해외 금액을 적지 않는다」로 썼는데, 그 금액은 **WU-146/148 이
   *    CPO 지시로 넣은 것**(「해외 최저 확인가는 GBP 37 입니다」)이고 **계약이 요구** 한다
   *    (`wu-148` 이 `toContain("GBP 37")` 을 단언한다).
   * 🟢 그래서 **진짜 지켜야 할 성질** 로 바꾼다 — §8-6 「국내와 해외 가격 의미가 서로
   *    섞이지 않는다」 ⟹ **한 문장에 두 시장의 금액이 같이 들어가지 않는다.**
   */
  it("W-10 🔴 **한 문장에 두 시장 금액이 섞이지 않는다**(§8-6)", () => {
    const lines = marketDecisionLines(buildMarketJudgement([krRow, osSame]), {
      domestic: KR_REF,
      overseas: OS_REF,
    }).lines;
    for (const line of lines) {
      const hasKr = line.includes("KRW");
      const hasOs = /GBP|USD|EUR|CAD/.test(line);
      expect(hasKr && hasOs, `🔴 한 문장이 두 시장 금액을 같이 적는다: ${line}`).toBe(false);
    }
    /** 🟢 둘 다 **각자의 줄** 로는 있어야 한다(어느 쪽도 사라지지 않는다). */
    expect(lines.some((l) => l.includes("KRW 88,000"))).toBe(true);
    expect(lines.some((l) => l.includes("GBP 37"))).toBe(true);
  });

  /** 🟢 Case B — 국내에 **SAME 가격** 이 있으면 기존 정책 그대로(참고 블록이 꺼진다). */
  it("W-11 🟢 Case B — 국내 SAME 가격이 있으면 참고 블록이 **서지 않는다**", () => {
    const el = mount({ rows: [krSame], domesticReference: KR_REF });
    expect(q(el, "price-guide-domestic")).not.toBeNull();
    expect(q(el, "domestic-reference"), "🔴 SAME 가격과 참고가격을 같이 띄웠다").toBeNull();
  });

  /**
   * 🔴🔴 **금액 문자열 owner 가 하나** 다 — 블록과 결론이 **같은 함수** 를 쓴다.
   *    그래야 한쪽만 범위를 적거나 천단위 구분이 갈리는 일이 없다.
   */
  it("W-12 🔴 블록과 결론이 **같은 금액 문자열** 을 쓴다", () => {
    expect(formatReferenceAmount("KRW", { lowestAmount: 88000, highestAmount: 88000 })).toBe("KRW 88,000");
    expect(formatReferenceAmount("KRW", { lowestAmount: 83600, highestAmount: 88000 })).toBe(
      "KRW 83,600 ~ 88,000",
    );
    /** 🔴 1건·같은 금액은 **범위로 만들지 않는다**(거짓 폭 금지). */
    expect(formatReferenceAmount("KRW", { lowestAmount: 88000 })).toBe("KRW 88,000");
    expect(referenceAmountSummary(KR_REF)).toBe("KRW 88,000");
    expect(referenceAmountSummary(null)).toBeNull();
    /** 🔴 **환산 0 · 기호 0** — ISO 코드 그대로. */
    expect(referenceAmountSummary(KR_REF)).not.toMatch(/[₩€$£¥]/);
  });

  /** 🔴 §3 — SAME 산출이 **그대로** 다(copy 변경이 판정에 닿지 않는다). */
  it("W-13 🔴 SAME 판정·집계 산출 불변", () => {
    const j = buildMarketJudgement([krRow, osSame]);
    expect(j.sellers.length).toBe(1);
    expect(j.sellers[0].market).toBe("OVERSEAS");
    expect(j.verdict).toBe("ON_SALE");
    /** 🔴 국내는 SAME 축에 **들어가지 않는다**(PRESUMED_SAME 이다 · 승격 0). */
    expect(j.sellers.some((s) => s.market === "KR")).toBe(false);
  });

  it("W-14 🔴 환산 흔적 0 · 통화 합산 0", () => {
    const whole = caseA().textContent ?? "";
    expect(whole).not.toMatch(/[₩€$£¥]/);
    expect(whole).not.toContain("약 ");
    for (const bad of ["KRW 37", "GBP 88,000", "88,000 ~ 37"]) {
      expect(whole, `🔴 통화를 섞었다: ${bad}`).not.toContain(bad);
    }
  });
});
