import { describe, expect, it } from "vitest";
import { buildGlobalMarketCard, type MarketObservationInput } from "../global-market";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **글로벌 시장 카드 — 통화 기준 문구**(CPO 승인 2026-11-07 · PHASE 2)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 네트워크 0 · DB 0. 근거 — `docs/PHASE2-SMALLABLE-LOCAL-CURRENCY-VERDICT.md` ·
 *    작업지시서 `docs/WORKORDER-GLOBAL-MARKET-CURRENCY-NOTE.md`(CPO 승인 §A).
 *
 * 🔴🔴 **이 계약의 핵심은 「발화」가 아니라 «비발화» 다.** 무조건 붙이면 현지 통화를
 *    말하는 판매처에서 **거짓** 이 된다(A-2) — 그 거짓을 막는 것이 A-2·A-3·A-5 다.
 */

const obs = (marketCode: string, currency: string, priceAmount: number | null): MarketObservationInput => ({
  marketCode,
  currency,
  priceAmount,
  // 🔴 이 축과 무관한 칸이다 — 문구는 `priceKrw` 를 보지 않는다(환산 축 금지).
  priceKrw: 1,
});

/** 🟢 운영 DB 실측 모양(2026-11-07) — 그대로 베낀다. 손으로 꾸미지 않는다. */
const SMALLABLE_SHAPE = [obs("fr", "EUR", 49), obs("kr", "EUR", 49), obs("us", "EUR", 53), obs("jp", "EUR", 54)];
const LOUISEMISHA_SHAPE = [
  obs("en-au", "AUD", 1),
  obs("en-ca", "CAD", 1),
  obs("en-de", "EUR", 1),
  obs("en-gb", "GBP", 1),
  obs("en-jp", "JPY", 1),
  obs("en-us", "USD", 1),
];
const BOBOCHOSES_SHAPE = [
  obs("en-de", "EUR", 75),
  obs("en-fr", "EUR", 75),
  obs("en-int", "EUR", 84),
  obs("en-us", "USD", 108),
];

const noteOf = (observations: MarketObservationInput[]) => buildGlobalMarketCard({ observations }).currencyNote;

describe("A. 발화 조건 — 관측 데이터에서만 나온다", () => {
  it("A-1 🔴 지역 ≥2 + 통화 1종 ⟹ 문구가 «선다»(Smallable 모양)", () => {
    const note = noteOf(SMALLABLE_SHAPE);
    expect(note).toBe("가격 기준 통화 EUR · 배송국가를 지정해 조회한 가격입니다(현지통화 가격이 아닙니다)");
  });

  it("A-2 🔴🔴 통화가 2종 이상이면 «서지 않는다» — 붙이면 거짓이 되는 자리", () => {
    // 🟢 운영 실측 — 이 판매처들의 en-jp JPY · en-us USD 는 **진짜 현지 통화** 다.
    expect(noteOf(LOUISEMISHA_SHAPE)).toBeNull();
    expect(noteOf(BOBOCHOSES_SHAPE)).toBeNull();
  });

  it("A-3 🔴 지역이 1개 이하면 «서지 않는다» — 한 줄로는 말할 수 없다", () => {
    expect(noteOf([obs("kr", "KRW", 1000)])).toBeNull();
    // 같은 지역이 두 줄이어도 지역 수는 1이다.
    expect(noteOf([obs("kr", "EUR", 1), obs("en-kr", "EUR", 2)])).toBeNull();
    expect(noteOf([])).toBeNull();
  });

  it("A-4 🔴 `en-int` 는 지역으로 세지 않는다 — 국가가 아니다", () => {
    // int 단독 둘: 지역 0 ⟹ 미발화.
    expect(noteOf([obs("en-int", "GBP", 1), obs("int", "GBP", 2)])).toBeNull();
    // int + 국가 하나: 지역 1 ⟹ 미발화.
    expect(noteOf([obs("en-int", "EUR", 1), obs("fr", "EUR", 2)])).toBeNull();
    // int + 국가 둘: 지역 2 ⟹ 발화(int 가 분모를 깎지 않는다).
    expect(noteOf([obs("en-int", "EUR", 1), obs("fr", "EUR", 2), obs("jp", "EUR", 3)])).toContain("EUR");
  });

  it("A-5 🟢 통화 글자가 «관측» 에서 온다 — EUR 리터럴이 아니다", () => {
    expect(noteOf([obs("gb", "GBP", 1), obs("au", "GBP", 2)])).toContain("가격 기준 통화 GBP");
    expect(noteOf([obs("jp", "JPY", 1), obs("kr", "JPY", 2)])).toContain("가격 기준 통화 JPY");
    // 대소문자·공백이 섞여도 한 종류다(정규화는 발화 조건의 일부다).
    expect(noteOf([obs("fr", " eur ", 1), obs("jp", "EUR", 2)])).toContain("가격 기준 통화 EUR");
  });

  it("A-6 🔴 통화를 읽지 못한 관측이 섞이면 «서지 않는다»(CPO: 불완전 시 미표시)", () => {
    expect(noteOf([obs("fr", "EUR", 1), obs("jp", "", 2)])).toBeNull();
    expect(noteOf([obs("fr", "EUR", 1), obs("jp", "   ", 2)])).toBeNull();
  });

  it("A-7 🔴 금액이 없는 줄(`—`)은 통화 근거가 아니다 — 문구는 «선 금액» 의 통화를 말한다", () => {
    // 금액 있는 것이 한 줄뿐이면 지역 1 ⟹ 미발화.
    expect(noteOf([obs("fr", "EUR", 75), obs("jp", "EUR", null)])).toBeNull();
    // 금액 없는 줄의 통화가 달라도 발화를 막지 않는다(그 줄은 금액을 말하지 않는다).
    expect(noteOf([obs("fr", "EUR", 1), obs("jp", "EUR", 2), obs("us", "USD", null)])).toContain("EUR");
  });
});

describe("B. 문구가 «말하지 않는» 것", () => {
  const note = noteOf(SMALLABLE_SHAPE)!;

  it("B-1 🔴 배송 가능 여부를 말하지 않는다 — 그 사실은 확인되지 않았다", () => {
    // 🔴 BL-2(배송 가능 국가 가드)가 열려 있다 ⟹ 「배송 가능/배송됩니다/배송국가별」 금지.
    for (const banned of ["배송 가능", "배송가능", "배송됩니다", "배송국가별", "배송지"]) {
      expect(note).not.toContain(banned);
    }
    // 🟢 말하는 것은 **우리가 한 행위** 다.
    expect(note).toContain("배송국가를 지정해 조회한");
  });

  it("B-2 🔴 환율·환산 어휘가 0 이다", () => {
    for (const banned of ["환율", "환산", "≈", "₩", "원화"]) expect(note).not.toContain(banned);
  });

  it("B-3 🔴 특정 판매처를 지목하지 않는다 — 일반 설명이어야 한다(CPO 명시)", () => {
    for (const banned of ["Smallable", "smallable", "스몰러블", "Bobo", "louisemisha"]) {
      expect(note).not.toContain(banned);
    }
  });

  it("B-4 🔴 사이트가 환산한다고 단정하지 않는다 — 한 판매처에서만 측정된 사실이다", () => {
    for (const banned of ["사이트 환율", "자체 환율", "사이트가 환산"]) expect(note).not.toContain(banned);
  });
});

describe("C. 기존 카드가 한 글자도 바뀌지 않는다", () => {
  it("C-1 🟢 줄의 금액 문자열이 불변 — 이 작업은 표시 한 줄을 더한 것뿐이다", () => {
    const card = buildGlobalMarketCard({ observations: SMALLABLE_SHAPE });
    expect(card.rows).toHaveLength(4);
    expect(card.rows.map((r) => r.observedPrice)).toEqual(["€49.00", "€49.00", "€53.00", "€54.00"]);
    // 🔴 krwEquivalent 는 저장된 priceKrw 에서만 온다(여기서 환율을 돌리지 않는다).
    expect(card.rows.every((r) => r.krwEquivalent?.startsWith("≈ "))).toBe(true);
    expect(card.empty).toBeNull();
  });

  it("C-2 🔴 관측이 없으면 문구도 비어 있다 — 빈 카드에 설명만 세우지 않는다", () => {
    const card = buildGlobalMarketCard({ observations: [] });
    expect(card.currencyNote).toBeNull();
    expect(card.rows).toHaveLength(0);
    expect(card.empty).not.toBeNull();
  });

  it("C-3 🔴 카드 입력 칸이 여전히 «관측 하나» 다 — 판매처명·대표금액이 들어올 자리가 없다", () => {
    // 🔴 그 입력을 뚫으면 원가·국내 비교상품이 되살아나는 경로가 된다(global-market.ts 설계).
    const card = buildGlobalMarketCard({ observations: SMALLABLE_SHAPE });
    expect(Object.keys(card).sort()).toEqual(["currencyNote", "empty", "rows", "title"]);
    expect(Object.keys(SMALLABLE_SHAPE[0]!).sort()).toEqual(["currency", "marketCode", "priceAmount", "priceKrw"]);
  });
});
