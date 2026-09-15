import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { resolveBuyerImportCharge, type BuyerImportChargeEstimate } from "@commerce/pricing";
import { MiPanelView, type PriceHistoryResponse } from "../DomesticPriceIntelligencePanel";
import { buildBuyerBurdenBlock, buildPriceChain, BUYER_IMPORT_CHARGE_SECTION } from "../price-hierarchy";
import { PROFIT, withDomesticComparable, visibleText } from "./product-tab-composition";

/**
 * GOLF-01-TAX(CEO 최종 결정, 2026-09-15) — 화면 쪽 검사.
 *
 * CEO 원문의 배치가 실제로 그려지는가:
 *
 *   상품가 / 배송비 / 기타 판매자 비용
 *   ────────────
 *   판매자 원가
 *
 *   [별도 참고]
 *   관세        예상 ○○원
 *   부가가치세  예상 ○○원
 *   ────────────
 *   구매자 부담 예상액
 *
 * ── 이 파일이 지키는 두 가지 ─────────────────────────────────────────────
 *   ① 참고 블록이 **판매자 원가 사슬 밖**에 선다(같은 표의 줄이 아니다).
 *   ② 그 블록이 **모든 카테고리**에서 같은 모양으로 선다.
 */

/** CEO 실측 예시: ¥107,800 클럽 · 125×20×20 → EMS ₩97,520 → CIF ₩1,089,280. */
function golfCharge(): BuyerImportChargeEstimate {
  return resolveBuyerImportCharge({
    categoryProfileId: "GOLF",
    destinationCountry: "KR",
    goodsValueKrw: 991_760,
    customsValueKrw: 1_089_280,
  });
}

/** 실상품 Bobo Choses €75 — 소액이라 수입 형태를 모르면 «확인 필요»다. */
function kidsCharge(): BuyerImportChargeEstimate {
  return resolveBuyerImportCharge({
    categoryProfileId: "KIDS_FASHION",
    destinationCountry: "KR",
    goodsValueKrw: 111_000,
    customsValueKrw: 123_000,
  });
}

/* ═══════════ ① 사슬 «밖» — 판매자 원가 표에 세금 줄이 없다 ═══════════ */

describe("GOLF-01-TAX 화면 ①: 참고 블록은 판매자 원가 사슬과 다른 배열이다", () => {
  const CHAIN = {
    originPrice: { amount: 107800, currency: "JPY" },
    observedOriginPrice: null,
    originPriceBasis: null,
    costBasisIsKrMarket: false,
    sourcePriceKrw: 991760,
    exchangeRate: 9.2,
    exchangeRateIsEstimate: false,
    internationalShippingKrw: 97520,
    sellerPlannedPriceKrw: null,
    costIncomplete: false,
    marginPercent: null,
    marginBasis: null,
    profitability: null,
  } as const;

  it("🔴 buildPriceChain이 돌려주는 줄에 세금 줄이 하나도 없다 — 합계에 끼어들 자리가 없다", () => {
    const keys = buildPriceChain(CHAIN).map((row) => row.key);
    expect(keys).toContain("LANDED_COST");
    for (const key of keys) {
      expect(["CUSTOMS_DUTY", "IMPORT_VAT", "BUYER_BURDEN_TOTAL"]).not.toContain(key);
    }
  });

  it("buildPriceChain은 구매자 부담을 인자로조차 받지 않는다 — 이어 붙일 자리가 없다", () => {
    const withExtra = buildPriceChain({
      ...CHAIN,
      // @ts-expect-error — 이 자리에 참고정보를 넘길 수 있는 필드가 없다는 것이 검사다.
      buyerImportCharge: golfCharge(),
    });
    expect(withExtra.map((r) => r.key)).toEqual(buildPriceChain(CHAIN).map((r) => r.key));
  });

  it("참고 블록은 자기 합계(구매자 부담 예상액)를 따로 들고 온다", () => {
    const block = buildBuyerBurdenBlock(golfCharge())!;
    expect(block.lines.map((l) => l.key)).toEqual(["CUSTOMS_DUTY", "IMPORT_VAT", "BUYER_BURDEN_TOTAL"]);
    expect(block.lines.map((l) => l.label)).toEqual(["관세", "부가가치세", "구매자 부담 예상액"]);
    expect(block.lines.map((l) => l.value)).toEqual(["예상 ₩87,142", "예상 ₩117,642", "예상 ₩204,784"]);
    expect(block.lines.at(-1)!.isTotal).toBe(true);
    expect(block.title).toContain("별도 참고");
    expect(block.caption).toContain("판매자 원가");
  });

  it("estimate가 없으면 블록도 없다 — «확인 필요»만 늘어놓은 빈 칸을 만들지 않는다", () => {
    expect(buildBuyerBurdenBlock(null)).toBeNull();
    expect(buildBuyerBurdenBlock(undefined)).toBeNull();
  });
});

/* ═══════════ ② 공통 구조 — 아동의류도 골프와 같은 블록을 쓴다 ═══════════ */

describe("GOLF-01-TAX 화면 ②: 카테고리가 블록 모양을 가르지 않는다", () => {
  it("아동의류도 같은 세 줄이고, 값만 «확인 필요»다", () => {
    const kids = buildBuyerBurdenBlock(kidsCharge())!;
    const golf = buildBuyerBurdenBlock(golfCharge())!;
    expect(kids.lines.map((l) => l.key)).toEqual(golf.lines.map((l) => l.key));
    expect(kids.lines.map((l) => l.label)).toEqual(golf.lines.map((l) => l.label));
    expect(kids.lines.map((l) => l.value)).toEqual(["확인 필요", "확인 필요", "확인 필요"]);
    expect(kids.needsReview).toBe(true);
    // 금액이 아닌 칸은 금액 스타일을 받지 않는다(화면이 문자열을 뜯지 않는다).
    expect(kids.lines.every((l) => l.isAmount === false)).toBe(true);
    expect(golf.lines.every((l) => l.isAmount === true)).toBe(true);
  });

  it("무엇을 확인해야 하는지 이름으로 말한다 — «확인 필요»만 남기지 않는다", () => {
    const kids = buildBuyerBurdenBlock(kidsCharge())!;
    expect(kids.unknownAxes).toContain("수입 형태");
    expect(kids.unknownAxes).toContain("품목/HS");
    // 골프는 품목/HS를 답할 수 있으므로 그 축이 목록에서 빠진다.
    expect(buildBuyerBurdenBlock(golfCharge())!.unknownAxes).not.toContain("품목/HS");
  });
});

/* ═══════════ ③ 실제 렌더 — 화면에 두 칸이 나란히 선다 ═══════════ */

describe("GOLF-01-TAX 화면 ③: 패널이 실제로 두 칸을 그린다", () => {
  function render(charge: BuyerImportChargeEstimate | null): string {
    const data: PriceHistoryResponse = { ...withDomesticComparable(), buyerImportCharge: charge };
    return renderToStaticMarkup(
      createElement(MiPanelView, {
        data,
        candidates: [],
        presentation: "FULL",
        priceCalculationDetail: null,
        profitability: PROFIT,
        openPriceDetailRequest: 0,
        onRequestPriceReview: () => {},
        snapshotOriginPrice: { amount: 50, currency: "EUR" },
        onOpenDomesticEvidence: () => {},
        onOpenOverseasEvidence: () => {},
      }),
    );
  }

  it("참고 블록의 세 줄이 화면에 뜬다", () => {
    const text = visibleText(render(golfCharge()));
    expect(text).toContain(BUYER_IMPORT_CHARGE_SECTION.title);
    expect(text).toContain(BUYER_IMPORT_CHARGE_SECTION.totalLabel);
    expect(text).toContain("예상 ₩204,784");
    // 판매자 원가(착지원가)는 그대로다 — 세금이 더해지지 않았다.
    expect(text).toContain("₩89,828");
    expect(text).not.toContain("₩294,612");
  });

  it("🔴 «확인 필요»일 때 금액이 아니라 그 글자가 뜬다 — 임의 계산을 화면에 흘리지 않는다", () => {
    const text = visibleText(render(kidsCharge()));
    expect(text).toContain(BUYER_IMPORT_CHARGE_SECTION.totalLabel);
    expect(text).toContain("확인 필요");
    expect(text).toContain("수입 형태");
    // 소액면세 한도 근처 금액을 화면이 스스로 곱해서 적지 않는다.
    expect(text).not.toContain("예상 ₩");
  });

  it("서버가 참고정보를 안 보내면(구버전 응답) 블록이 DOM에 아예 없다", () => {
    const text = visibleText(render(null));
    expect(text).not.toContain(BUYER_IMPORT_CHARGE_SECTION.title);
    expect(text).not.toContain(BUYER_IMPORT_CHARGE_SECTION.totalLabel);
    // 그래도 판매자 원가는 그대로 그려진다 — 두 칸이 서로의 조건이 아니다.
    expect(text).toContain("₩89,828");
  });
});
