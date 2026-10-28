/** @vitest-environment jsdom */
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { summarizeCandidateOverseasPrices } from "../../../api/price-history/_lib/candidate-market";
import { MarketPriceComparison } from "../MarketPriceComparison";
import { DOMESTIC_REFERENCE_TITLE, DOMESTIC_REFERENCE_BASIS } from "../overseas-reference";
import { MARKET_EVIDENCE_FOLD_LABEL, MARKET_RESULT_HEADING, PRICE_BASIS_HEADING } from "../mi-same-candidates";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";
import type { OverseasPriceSummary } from "../overseas-reference";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2V — **셀러가 «위에서 아래로 읽기만» 해도 국내 가격을 이해한다**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CEO Production 캡처가 드러낸 것(판단 로직은 정상 · **정보 계층** 이 문제였다):
 * ```
 * ⒜ 🇰🇷 블록은 「국내 참고가격 **KRW 88,000** · 확인 1곳」을 말하는데
 *    바로 아래 「💡 판매 판단」이 **「현재 확인된 국내 동일상품 가격은 없습니다」** 를 말했다
 *    ⟹ 🔴 셀러는 **「국내 가격이 없다」** 로 읽는다(기술적으로는 참이지만 거짓으로 읽힌다)
 * ⒝ 🌎 블록의 「최저 확인가 **GBP 37 · USD 58**」이 아래 `market-price-range` 에서
 *    「GBP 37 (3곳 …)」로 **또** 나왔다 ⟹ 🔴 같은 가격이 두 번 강조된다
 * ⒞ 결론이 **판매처 표·건수 줄에 묻혀** 있었다 ⟹ 🔴 아래까지 내려가야 핵심이 보인다
 * ⒟ 🌎 에 「**유사상품 1**」(내부 등급 분포)이 핵심 가격 영역에 남아 있었다
 * ```
 * 🟢 **고친 것은 정보 계층 하나** 다 — MI·SAME·threshold·검색·수집·해외 가격 로직 **0**.
 */

const KR_REF: OverseasPriceSummary = summarizeCandidateOverseasPrices([
  { market: "KR", currency: "KRW", amount: 88000, priceTier: "COMPARISON", sellerKey: "donokids.com" },
]);
const OS_REF: OverseasPriceSummary = summarizeCandidateOverseasPrices([
  { market: "OVERSEAS", currency: "GBP", amount: 37, priceTier: "EXACT" },
  { market: "OVERSEAS", currency: "USD", amount: 58, priceTier: "COMPARISON" },
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
/** 🟢 CEO 화면 그대로 — 해외에는 SAME 이 **있다**(그래서 「판매 판단」이 PRICED 다). */
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
/** 🔴 셀러가 **실제로 보는** 첫 화면 — 닫힌 `<details>` 를 떼어 낸다. */
const firstScreen = (el: HTMLElement): string => {
  const c = el.cloneNode(true) as HTMLElement;
  for (const d of [...c.querySelectorAll("details")]) if (!d.hasAttribute("open")) d.remove();
  return (c.textContent ?? "").replace(/\s+/g, " ").trim();
};

/** 🟢 CEO 화면과 같은 상태 — 국내는 참고가격만 · 해외는 SAME 가격 있음. */
const ceoScreen = () => mount({ rows: [krRow, osSame], domesticReference: KR_REF, overseasReference: OS_REF });

/* ═══════════ A. 위/아래가 «같은 말» 을 한다 ═══════════ */

describe("A. 국내 가격 표현 단일화", () => {
  /**
   * 🔴🔴🔴 **이것이 CORE-2V 의 핵심 단언이다.**
   *    참고가격이 있는데 결론이 「국내 동일상품 가격은 없습니다」로 끝나면,
   *    셀러는 위의 `KRW 88,000` 을 **무시한다**.
   */
  it("A-1 🔴🔴 결론이 **「국내 가격이 없다」로 읽히지 않는다**", () => {
    const first = firstScreen(ceoScreen());
    expect(first, "🔴 위에 KRW 88,000 이 있는데 아래가 「국내 가격 없음」을 말한다").not.toContain(
      "현재 확인된 국내 동일상품 가격은 없습니다",
    );
    /**
     * 🟢 대신 **두 사실을 같이** 말한다 — 참고가격은 있고, 확정은 아직 없다.
     * 🔴 CORE-2W §4-C 가 **금액까지** 말하게 했고, 🔴🔴 **CORE-2AO-R1 이 그 금액을
     *    도로 뺐다** — CEO Production 캡처에서 `KRW 88,000` 이 🇰🇷 블록과 이 결론
     *    **두 군데** 떴기 때문이다(CPO 2026-10-26: 「상단 가격 블록이 이미 보여주므로
     *    중복하지 않음」). 🟢 **이 테스트가 지키는 성질은 그대로** 다 — 결론이
     *    「국내 가격이 없다」로 읽히지 않는 것.
     */
    /**
     * 🔴🔴 **CORE-2AO-R2 — 결론이 상세로 내려갔다**(CPO 2026-10-26 · 「첫 화면 = 판단」).
     *    🟢 **지키는 성질은 그대로** 다 — 결론이 「국내 가격이 없다」로 읽히지 않는 것 ·
     *    그 문장이 **사라지지 않은 것**. 🔴 그래서 보존은 **전체 DOM** 으로 문다.
     */
    const whole = (ceoScreen().textContent ?? "").replace(/\s+/g, " ");
    expect(whole).toContain("국내 참고가격이 확인됐습니다");
    expect(whole).toContain("동일상품 가격으로 확정하지 않습니다");
    /**
     * 🔴🔴 그리고 **금액은 첫 화면에 «한 번만»** 있다 — 그것이 CEO 가 FAIL 로 지목한
     *    바로 그 축이다. 🟢 🇰🇷 블록이 유일한 owner 다.
     */
    expect(first.split("KRW 88,000").length - 1, "🔴 같은 금액이 첫 화면에 두 번 이상 떴다").toBe(
      1,
    );
  });

  /** 🔴 §1 — 국내 가격의 대표 표현은 **하나** 다. */
  it("A-2 🔴 국내 가격 이름이 **하나** 다 — 「형성대」·「국내 가격」이 섞이지 않는다", () => {
    const first = firstScreen(ceoScreen());
    expect(first).toContain(DOMESTIC_REFERENCE_TITLE);
    for (const bad of ["국내 가격 형성대", "국내 시장 가격대"]) {
      expect(first, `🔴 다른 이름이 섞였다: ${bad}`).not.toContain(bad);
    }
  });

  /** 🔴 §4 — **가격 → 동일상품 확정 여부** 순서를 지킨다. */
  it("A-3 🔴 가격이 「동일상품 확정 여부」보다 **먼저** 온다(이제 층이 다르다)", () => {
    /**
     * 🔴🔴 CORE-2AO-R2 — 가격은 **1차**, 확정 여부는 **＋ 상세정보 보기** 안이다 ⟹
     *    한 블록의 innerHTML 로는 못 잰다. 🟢 **문서 전체 순서** 로 잰다(더 세다 —
     *    셀러는 확정 여부를 보려면 **접힘을 열어야** 한다).
     */
    const html = ceoScreen().innerHTML;
    const at = (id: string) => html.indexOf(`data-testid="${id}"`);
    for (const id of ["domestic-lowest", "reference-status", "market-empty-domestic"]) {
      expect(at(id), `🔴 ${id} 가 사라졌다`).toBeGreaterThan(-1);
    }
    expect(at("domestic-lowest")).toBeLessThan(at("reference-status"));
    expect(at("reference-status")).toBeLessThan(at("market-empty-domestic"));
  });

  /**
   * 🔴🔴🔴 **1차 단언이 틀렸고, 그 과정에서 «실제 긴장» 을 찾았다. 둘 다 적는다.**
   *
   * 🔴 처음엔 첫 화면 **전체** 에서 금액이 1회이기를 요구했다 → `GBP 37` 이 **2회** 로 FAIL.
   *    ⒜ 🌎 블록의 **강조 금액**(「최저 확인가 GBP 37」) ⒝ 「💡 판매 판단」 **산문 안의 인용**.
   * 🔴🔴 그런데 ⒝ 를 지우면 **WU-146 계약이 깨진다** — 그 WU 가 CPO 지시로
   *    「셀러가 원하는 답은 **「그래서 얼마냐」**」라며 **결론에 금액을 넣게** 했고,
   *    CORE-2V §7 의 목표 문장도 「**KRW 88,000 · 확인 1곳을 기준으로** …」로 **금액을 포함** 한다.
   * ⟹ 🟢 §2 의 「한 번만 **강조**」는 **강조 자리** 를 뜻한다(산문 인용이 아니다).
   *    그래서 **시장 블록 안** 에서만 센다 — 거기가 금액 owner 의 자리다.
   */
  it("A-4 🔴 **강조된 금액** 은 시장 블록에서 한 번만 뜬다", () => {
    const blocks = text(ceoScreen(), "market-blocks");
    expect((blocks.match(/KRW 88,000/g) ?? []).length).toBe(1);
    expect((blocks.match(/GBP 37/g) ?? []).length).toBe(1);
  });
});

/* ═══════════ B. 상단 = 결론 · 하단 = 검토 ═══════════ */

describe("B. §8 결론과 근거를 가른다", () => {
  /**
   * 🔴🔴 CEO 캡처에서 **판매처 표와 건수 줄이 1차에 펼쳐져** 있었다 ⟹ 결론이 묻혔다.
   *    🟢 접었다 — **삭제가 아니다**(계약 넷이 계속 그 값을 읽는다).
   */
  it("B-1 🔴🔴 근거 수치 넷이 **첫 화면에 없고** 접힘 안에 **있다**", () => {
    const host = ceoScreen();
    /**
     * 🔴🔴 **1차 단언이 틀렸고 그것을 적는다.** 처음엔 `"판매중 확인"` 같은 **글자** 를
     *    금지했는데, 그 말은 🌎 블록의 `priceGuideCountNote`(= SAME 축의 **정직한 분모** ·
     *    「동일상품 확인 1곳 · 판매중 확인 1곳 · 가격 확인 1곳」)가 **이미 쓰고 있다**
     *    ⟹ **owner 를 잘못 지목** 했다(이 저장소가 반복한 단언 좌표 오류).
     * 🟢 그래서 **testid 로** 본다 — 「그 네 요소가 접힘 밖에 있는가」가 이 단언의 질문이다.
     */
    const clone = host.cloneNode(true) as HTMLElement;
    for (const d of [...clone.querySelectorAll("details")]) if (!d.hasAttribute("open")) d.remove();
    for (const id of ["market-sale-counts", "market-split", "market-price-range", "market-seller-table"]) {
      expect(clone.querySelector(`[data-testid="${id}"]`), `🔴 ${id} 가 1차에 남았다`).toBeNull();
    }
    const fold = q(host, "market-evidence-fold") as HTMLElement;
    expect(fold, "🔴 근거 접힘이 없다").not.toBeNull();
    for (const id of ["market-sale-counts", "market-split", "market-price-range", "market-seller-table"]) {
      expect(fold.querySelector(`[data-testid="${id}"]`), `🔴 ${id} 가 사라졌다(삭제 금지)`).not.toBeNull();
    }
  });

  /** 🔴 **`open` 금지** — 붙이면 1차로 되돌아온다(2026-09-19 사고의 기전). */
  it("B-2 🔴 두 접힘 모두 **기본 접힘** 이다", () => {
    const host = ceoScreen();
    for (const id of ["market-evidence-fold", "mi-detail-fold"]) {
      expect((q(host, id) as HTMLElement).hasAttribute("open"), `🔴 ${id} 가 펼쳐져 있다`).toBe(false);
    }
    /** 🔴 접힘 이름이 **서로 다르다** — 「내부 분석」과 「판매처 근거」는 다른 것이다. */
    expect(text(host, "market-evidence-fold")).toContain(MARKET_EVIDENCE_FOLD_LABEL);
  });

  /** 🔴 §3 — 셀러가 **①~④ 까지만** 읽어도 판단이 끝난다. */
  it("B-3 🔴 첫 화면 순서 — 🇰🇷 → 🌎 → 가격 판단 기준 → 판매 판단", () => {
    const html = ceoScreen().innerHTML;
    const at = (id: string) => html.indexOf(`data-testid="${id}"`);
    expect(at("market-block-domestic")).toBeLessThan(at("market-block-overseas"));
    expect(at("market-block-overseas")).toBeLessThan(at("price-basis"));
    expect(at("price-basis")).toBeLessThan(at("market-judgement"));
    expect(at("market-judgement")).toBeLessThan(at("mi-detail-fold"));
    /**
     * 🟢 제목이 첫 화면에 있다(아래로 읽기만 하면 된다).
     * 🔴🔴 **CORE-2AO-R1 — `PRICE_BASIS_HEADING` 이 이 목록에서 빠졌다.** 그 영역은
     *    CEO 피드백 ③으로 **접혔고**(근거 설명이라 결론보다 앞에 펼쳐 두지 않는다),
     *    `firstScreen` 은 닫힌 `details` 를 **통째로 지워서** `summary` 까지 날린다.
     *    🟢 **순서 계약은 그대로** 다(위 `at("price-basis")` 네 줄 — innerHTML 기준이라
     *    접힘과 무관하다) · 🟢 제목이 접힘 머리에 살아 있다는 것은 아래에서 직접 문다.
     */
    const first = firstScreen(ceoScreen());
    const basisFold = q(ceoScreen(), "price-basis") as HTMLElement;
    expect(basisFold.tagName.toLowerCase(), "🔴 근거 설명이 다시 펼쳐졌다").toBe("details");
    expect(basisFold.querySelector("summary")?.textContent ?? "").toContain(PRICE_BASIS_HEADING);
    /**
     * 🔴🔴 **CORE-2AO-R2 — `MARKET_RESULT_HEADING`(💡 판매 판단)도 상세로 내려갔다.**
     *    1차에 남는 제목은 **국내 가격 · 해외 소싱가 · 판매가격 가이드** 셋이다.
     *    🟢 결론이 **사라지지 않았다** 는 것은 전체 DOM 으로 문다.
     */
    expect(first).toContain(DOMESTIC_REFERENCE_TITLE);
    expect((ceoScreen().textContent ?? "").replace(/\s+/g, " ")).toContain(MARKET_RESULT_HEADING);
    expect(first, "🔴 결론 제목이 1차로 되돌아왔다").not.toContain(MARKET_RESULT_HEADING);
  });
});

/* ═══════════ C. 내부 MI 어휘 격리 ═══════════ */

describe("C. §5 내부 MI 표현은 핵심 결과에 없다", () => {
  it("C-1 🔴 내부 토큰·등급 분포가 **첫 화면에 없다**", () => {
    const first = firstScreen(ceoScreen());
    for (const bad of [
      "PRESUMED_SAME",
      "TEXT_CONFIRMED",
      "COMPARISON",
      "EXACT_IDENTIFIER",
      "matchTruth",
      "crossSeller",
      "유사상품 1",
      "동일상품 1",
      "대상 라인 차이",
      "브랜드 미확인",
      "보류·충돌",
    ]) {
      expect(first, `🔴 내부 MI 어휘가 1차에 있다: ${bad}`).not.toContain(bad);
    }
  });

  /** 🟢 **지우지 않았다** — 사유 분포는 `▸ MI 상세 분석` 안에 그대로 있다. */
  it("C-2 🟢 보류 사유는 MI 상세 안에 **살아 있다**", () => {
    const fold = q(ceoScreen(), "mi-detail-fold") as HTMLElement;
    expect(fold.querySelector('[data-testid="mi-same-pending"]')).not.toBeNull();
    expect(fold.querySelector('[data-testid="market-verdict"]')).not.toBeNull();
  });
});

/* ═══════════ D. §9 FAIL 목록을 그대로 단언 ═══════════ */

describe("D. 🔴 CPO §9 FAIL 조건", () => {
  it("D-1 🔴 셀러에게 재분석·후보 판단·원가 입력을 요구하지 않는다", () => {
    const first = firstScreen(ceoScreen());
    for (const bad of ["다시 분석", "사진으로 확인", "눈으로 확인", "직접 판단해", "URL 추가"]) {
      expect(first, `🔴 셀러에게 일을 떠넘긴다: ${bad}`).not.toContain(bad);
    }
    /** 🟢 원가는 **요구가 아니라 상태 설명** 이다 — 「찾지 못한 것이 아니다」가 같이 선다. */
    if (first.includes("매입 원가를 입력하면")) {
      expect(first).toContain("시장가격을 찾지 못한 것이 아닙니다");
    }
  });

  it("D-2 🔴 「동일상품 0곳」이 가격보다 **먼저 보이지 않는다**", () => {
    /**
     * 🔴🔴 CORE-2AO-R2 — 이제 **1차에 아예 없다**(상세로 내려갔다) ⟹ 「먼저 보일」
     *    길이 구조적으로 없다. 🟢 그 사실을 **그대로** 단언한다(순서보다 강한 조건).
     *
     * ── 🔵🔵🔵 CORE-UX-SELLER-02 — **숫자는 1차로 돌아왔고, 문장은 상세에 남았다**
     * ```
     * 🔴 CPO 확정(2026-10-26) — 셀러가 1차에서 「KRW 88,000」만 보고 **그 가격을 동일상품으로
     *    확인한 곳이 0** 임을 못 보는 것이 CEO 가 지목한 모순이었다 ⟹ **숫자 한 줄** 을 올린다.
     * 🟢 이 단언의 **원래 목적(「0곳」이 가격보다 먼저 보이지 않는다)은 그대로** 다 —
     *    「없다」로 먼저 읽히는 것을 막는 것이고, 그래서 **순서로** 다시 문다(아래 index 비교).
     * 🔴 그리고 **문장은 여전히 1차 금지** 다(`DOMESTIC_REFERENCE_BASIS`) — 게이트를
     *    풀었는지 그 줄이 잡는다. ⟹ 약화가 아니라 **층 분리** 다.
     * ```
     */
    const first = firstScreen(ceoScreen());
    expect(first).toContain("KRW 88,000");
    expect(first, "🔴 「확정 없음」이 1차로 되돌아왔다").not.toContain(DOMESTIC_REFERENCE_BASIS);
    /** 🟢 숫자는 **1차에 있다** · 🔴 단 **가격보다 뒤** 여야 한다(원래 목적 그대로). */
    expect(first, "🔴 동일상품 확인 수가 1차에서 사라졌다").toContain("동일상품 확인 0곳");
    expect(
      first.indexOf("KRW 88,000"),
      "🔴 「동일상품 확인 0곳」이 가격보다 먼저 온다 — 셀러가 「없다」로 읽는다",
    ).toBeLessThan(first.indexOf("동일상품 확인 0곳"));
    /** 🟢 단 **사라지지는 않았다** — 상세에 그대로 있다. */
    const whole = (ceoScreen().textContent ?? "").replace(/\s+/g, " ");
    expect(whole).toContain(DOMESTIC_REFERENCE_BASIS);
    expect(whole).toContain("동일상품 확인 0곳");
  });

  it("D-3 🔴 환산 흔적 0 · 통화 합산 0", () => {
    const whole = ceoScreen().textContent ?? "";
    expect(whole).not.toMatch(/[₩€$£¥]/);
    expect(whole).not.toContain("약 ");
    for (const bad of ["GBP 37 ~ 58", "KRW 37", "GBP 88,000"]) {
      expect(whole, `🔴 통화를 섞었다: ${bad}`).not.toContain(bad);
    }
  });
});

/* ═══════════ E. 반대 분기 보존 ═══════════ */

describe("E. 🟢 참고가격이 없을 때의 기존 문장은 그대로", () => {
  /** 🔴 **조건부** 다 — 국내 참고가격이 없으면 기존 결론이 그대로 나와야 한다. */
  it("E-1 🟢 국내 참고가격이 없으면 기존 문장 유지(회귀 방지)", () => {
    /** 🔴 CORE-2AO-R2 — 결론은 **상세** 에 산다. 회귀 방지 축(문장 보존)은 그대로다. */
    const whole = (mount({ rows: [osSame] }).textContent ?? "").replace(/\s+/g, " ");
    expect(whole).toContain("현재 확인된 국내 동일상품 가격은 없습니다");
    expect(whole).not.toContain("국내는 참고가격으로 확인됐고");
  });

  /** 🟢 SAME 이 하나도 없으면 근거 접힘 자체가 서지 않는다(빈 틀 금지). */
  it("E-2 🔴 SAME 이 0 이면 근거 접힘이 **서지 않는다**", () => {
    const host = mount({ rows: [krRow], domesticReference: KR_REF });
    expect(q(host, "market-evidence-fold")).toBeNull();
    expect(text(host, "domestic-reference")).toContain("KRW 88,000");
  });
});
