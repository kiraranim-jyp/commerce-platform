import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  computeSellability,
  deriveRepresentativeSellerVerdict,
  toSellerFacingVerdict,
  type SellabilityResult,
} from "@commerce/pricing";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-7 / P0-2(CPO 결정, 2026-09-26) — **표시 가격과 판정 가격을 가른다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 확정:
 *     EXACT 있음   → Sellability 가격판정 «가능»
 *     EXACT 없음   → COMPARISON 가격은 «참고자료로만» 표시.
 *                    가격 기반 GREEN/RED 를 확정하지 «않는다».
 *     resolved     → 화면 표시용 fallback 으로 «유지».
 *
 * ── 🔴 이 파일이 지켜야 하는 한 문장 ────────────────────────────────────
 * **동일상품이 확정되지 않은 상품은 가격 때문에 GREEN 도 RED 도 되지 않는다.**
 * 그 상품에 대해 시스템이 참인 말은 「동일상품을 확인하지 못했다」뿐이다.
 *
 * ── 🔴 하지 않은 것 ─────────────────────────────────────────────────────
 * 평균가→최저가 치환 없음 · CASE 재설계 없음 · 수수료/물류비 공식 무변경 ·
 * threshold 무변경 · COMPARISON 을 동일상품으로 승격 없음 ·
 * `resolved` UI fallback 제거 없음 · representativeVerdict 재설계 없음.
 */

const SRC = readFileSync(fileURLToPath(new URL("../market-intelligence.ts", import.meta.url)), "utf8");

/** 주석을 걷어낸 소스 — 이 저장소의 주석은 「예전에는 이랬다」를 길게 적는다. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .filter((line) => !line.trim().startsWith("//"))
  .join("\n");

/** CPO 가 지정한 여덟 상황. 🔴 값은 컴포넌트가 실제로 받는 모양 그대로다. */
const COST = 100_000;

function sellabilityFor(exact: { sellerCount: number; averagePriceKrw: number | null }, costPriceKrw = COST) {
  /* 🔴 market-intelligence.ts 가 «지금» 넘기는 것과 같은 두 값이다(§소스 검사 참고). */
  return computeSellability({
    costPriceKrw,
    domestic: { matched: exact.sellerCount > 0, averagePriceKrw: exact.averagePriceKrw },
  });
}

function finalVerdict(
  sellability: SellabilityResult,
  domesticBasis: "EXACT" | "COMPARISON" | "NONE",
  marketCase: "A" | "B" | "C" | "D" | null,
  extras: { domesticSellerCount?: number; domesticLowestPriceKrw?: number | null; landedCostKrw?: number | null } = {},
) {
  const verdict = deriveRepresentativeSellerVerdict({
    /* 프로덕션 대부분이 이 상태다 — 판매가가 없어 Priority 1 이 비어 있다. */
    unifiedDecision: null,
    sellability,
    /* 🔴 표시 축은 resolved 를 그대로 받는다(MI-7 이 바꾸지 않은 부분). */
    domesticMatched: (extras.domesticSellerCount ?? 0) > 0,
    domesticSellerCount: extras.domesticSellerCount ?? 0,
    domesticBasis,
    marketCase,
    recommendation: null,
    domesticLowestPriceKrw: extras.domesticLowestPriceKrw ?? null,
    landedCostKrw: extras.landedCostKrw ?? null,
  });
  return { verdict, facing: toSellerFacingVerdict(verdict) };
}

describe("① 🔴 COMPARISON only — 가격 때문에 GREEN/RED 가 되지 않는다 (load-bearing)", () => {
  /* EXACT 0건. 비교상품은 3곳 있고 그 평균가가 ₩200,000(마진 50%)이다 —
     예전이라면 이 값으로 GREEN 이 됐다. */
  const sellability = sellabilityFor({ sellerCount: 0, averagePriceKrw: null });

  it("sellability 는 YELLOW 다 — GREEN 도 RED 도 아니다", () => {
    expect(sellability.level).toBe("YELLOW");
    expect(sellability.level).not.toBe("GREEN");
    expect(sellability.level).not.toBe("RED");
  });

  it("🔴 마진 숫자를 «만들지» 않는다", () => {
    expect(sellability.estimatedMarginPercent).toBeNull();
    /* 비교상품 평균가가 문장에 새지 않는다 — 판정에 쓰지 않았으므로 근거로도 적지 않는다. */
    expect(sellability.reason).not.toContain("시장 평균가");
  });

  it("🔴 최종 판정이 «판매 추천» 도 «판매 비추천» 도 아니다", () => {
    const { facing } = finalVerdict(sellability, "COMPARISON", "D", { domesticSellerCount: 3 });
    expect(facing.code).toBe("CONDITIONAL");
    expect(facing.code).not.toBe("RECOMMENDED");
    expect(facing.code).not.toBe("NOT_RECOMMENDED");
  });

  it("🔴 비교상품 평균가가 «원가보다 낮아도» 판매 비추천으로 단정하지 않는다", () => {
    /* 예전 경로: resolved(비교상품) 평균가 ₩50,000 vs 원가 ₩100,000 → 마진 −100%
       → RED → HOLD → 🔴 판매 비추천. 검증되지 않은 «다른 상품» 가격으로 내린 단정이다. */
    const cheap = sellabilityFor({ sellerCount: 0, averagePriceKrw: null });
    const { verdict, facing } = finalVerdict(cheap, "COMPARISON", "D", { domesticSellerCount: 3 });
    expect(verdict.code).not.toBe("HOLD");
    expect(facing.code).not.toBe("NOT_RECOMMENDED");
  });
});

describe("② 🔴 EXACT 있음 — 예전과 «한 글자도» 다르지 않다", () => {
  it("EXACT + 평균가 → GREEN (마진 50%)", () => {
    const s = sellabilityFor({ sellerCount: 2, averagePriceKrw: 200_000 });
    expect(s.level).toBe("GREEN");
    expect(s.estimatedMarginPercent).toBe(50);
  });

  it("EXACT + 평균가가 원가에 가까움 → RED (문턱 10% 그대로)", () => {
    const s = sellabilityFor({ sellerCount: 2, averagePriceKrw: 105_000 });
    expect(s.level).toBe("RED");
    expect(s.estimatedMarginPercent).toBe(4.8);
  });

  it("EXACT + 원가 초과 → RED · 최종 HOLD(🔴 판매 비추천)", () => {
    const s = sellabilityFor({ sellerCount: 2, averagePriceKrw: 80_000 });
    expect(s.level).toBe("RED");
    const { verdict, facing } = finalVerdict(s, "EXACT", "A", { domesticSellerCount: 2 });
    expect(verdict.code).toBe("HOLD");
    expect(facing.code).toBe("NOT_RECOMMENDED");
  });

  it("EXACT + 최저가 기준 CASE 가 여전히 최종을 «강등» 한다", () => {
    const s = sellabilityFor({ sellerCount: 2, averagePriceKrw: 200_000 });
    /* CASE C — 최저가로 팔면 손실. guard 가 READY 를 HOLD 로 내린다. */
    const caseC = finalVerdict(s, "EXACT", "C", {
      domesticSellerCount: 2,
      domesticLowestPriceKrw: 120_000,
      landedCostKrw: 130_000,
    });
    expect(caseC.verdict.code).toBe("HOLD");
    expect(caseC.facing.code).toBe("NOT_RECOMMENDED");

    /* CASE B — 손실은 아니지만 목표마진 미달. REVIEW_PRICE 로 내린다. */
    const caseB = finalVerdict(s, "EXACT", "B", { domesticSellerCount: 2, domesticLowestPriceKrw: 150_000 });
    expect(caseB.verdict.code).toBe("REVIEW_PRICE");
    expect(caseB.facing.code).toBe("CONDITIONAL");
  });
});

describe("③ 나머지 네 상황", () => {
  it("EXACT 없음(비교상품도 없음) → YELLOW · 🟣 시장 진입 기회", () => {
    const s = sellabilityFor({ sellerCount: 0, averagePriceKrw: null });
    const { verdict, facing } = finalVerdict(s, "NONE", null);
    expect(s.level).toBe("YELLOW");
    expect(verdict.code).toBe("MARKET_OPPORTUNITY");
    /* 🔴 「독점 상품입니다」로 단정하지 않는다(P-9-B). */
    expect(facing.code).toBe("CONDITIONAL");
  });

  it("원가 없음 → UNKNOWN (시장가격이 있어도 판정하지 않는다)", () => {
    const s = computeSellability({ costPriceKrw: null, domestic: { matched: true, averagePriceKrw: 200_000 } });
    expect(s.level).toBe("UNKNOWN");
    expect(finalVerdict(s, "EXACT", "A", { domesticSellerCount: 2 }).verdict.code).toBe("NEEDS_INFO");
  });

  it("시장가격 없음(EXACT 판매처는 있는데 가격을 못 읽음) → YELLOW", () => {
    /* 🔴 다시장 관측에서 판단 시장을 못 고르면 sellerCount>0 인데 평균가가 null 이다
       (MI-5/P0-2-B 의 그 경로). 가격이 없으면 판정하지 않는다. */
    const s = sellabilityFor({ sellerCount: 2, averagePriceKrw: null });
    expect(s.level).toBe("YELLOW");
  });

  it("🔴 EXACT 가 있으면 CASE D 여도 sellability 는 가격으로 판정한다", () => {
    /* CASE D 는 「EXACT 최저가가 없다」는 뜻이므로 EXACT 판매처가 있는데 CASE D 인
       경우는 최저가를 못 읽은 상태다. 그때도 sellability 는 평균가로 답한다 —
       이 축을 이번에 바꾸지 않았다는 확인이다. */
    const s = sellabilityFor({ sellerCount: 2, averagePriceKrw: 200_000 });
    expect(s.level).toBe("GREEN");
    expect(finalVerdict(s, "EXACT", "D", { domesticSellerCount: 2 }).verdict.code).toBe("READY");
  });
});

describe("④ 🔴 소스 — 판정 입력과 표시 입력이 갈라져 있다", () => {
  it("sellability 는 «exact» 를 받는다", () => {
    const at = CODE.indexOf("computeSellability({");
    expect(at).toBeGreaterThan(-1);
    const block = CODE.slice(at, CODE.indexOf("});", at));
    expect(block).toContain("domesticMarketSplit.exact.sellerCount");
    expect(block).toContain("domesticMarketSplit.exact.averagePriceKrw");
    /* 🔴 resolved(=domesticSummary)를 판정 입력으로 되살리면 여기서 잡힌다. */
    expect(block).not.toContain("domesticSummary");
  });

  it("🔴 표시 축은 여전히 resolved 다 — 비교상품 가격을 화면에서 지우지 않았다", () => {
    expect(CODE).toContain("const domesticSummary = domesticMarketSplit.resolved;");
    expect(CODE).toContain("domesticCompetition: domesticSummary");
    /* 두 버킷과 basis 도 그대로 내려간다(화면이 참고자료로 구분해 보여준다). */
    expect(CODE).toContain("domesticMarketSplit,");
  });

  it("🔴 다른 두 가격 소비자는 여전히 basis 로 EXACT 를 가린다", () => {
    /* computePriceDecision · computePriceRecommendation 은 숫자와 «함께» basis 를
       받아 내부에서 EXACT 만 쓴다. 그 연결이 끊기면 COMPARISON 가격이 판정에
       되돌아온다 — MI-7 이 닫은 구멍과 같은 모양이다. */
    expect(CODE).toContain("domesticBasis: domesticMarketSplit.basis");
  });
});
