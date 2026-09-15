import { describe, expect, it } from "vitest";
import { CATEGORY_PROFILES, type CategoryProfileId } from "@commerce/category";
import { CATEGORY_COST_POLICIES, PRICE_TAX_BASIS_LABEL, resolveCategoryCostPolicy } from "@commerce/pricing";
import { buildMarketContext, buildPriceChain } from "@/app/pipeline/commerce/price-hierarchy";
import { readSourceAt, stripComments } from "@/app/pipeline/commerce/__tests__/source-text";

/**
 * GOLF-01 축B(CEO 지시, 2026-09-15) — 두 패키지를 잇는 자리의 검사.
 *
 * packages/pricing은 packages/category를 import하지 않는다(의존 방향을 새로
 * 만들지 않는다). 그래서 "카테고리 id"라는 같은 어휘를 두 패키지가 각자 들고
 * 있고, 그 둘이 어긋나면 아무도 모른다 — 골프 상품이 조용히 DEFAULT 정책으로
 * 계산되는 식이다.
 *
 * apps/admin은 두 패키지를 모두 쓰는 **유일한** 곳이다. 그래서 그 어긋남을
 * 잡는 자리도 여기 하나뿐이다.
 */
describe("GOLF-01 축B: CATEGORY_PROFILES의 모든 카테고리에 비용 정책이 있다", () => {
  it("카테고리를 하나 더 만들면 비용 정책을 «결정»하지 않고는 통과할 수 없다", () => {
    const profileIds = Object.keys(CATEGORY_PROFILES) as CategoryProfileId[];
    expect(profileIds.length).toBeGreaterThan(0);
    for (const id of profileIds) {
      expect(CATEGORY_COST_POLICIES, `${id}에 비용 정책이 없다`).toHaveProperty(id);
      // 폴백으로 조용히 DEFAULT를 받는 것이 아니라 자기 이름의 정책이 있어야 한다.
      expect(resolveCategoryCostPolicy(id).id).toBe(id);
    }
  });

  /**
   * 🔴 GOLF-01-TAX(CEO 최종 결정, 2026-09-15) — 이 검사가 **더 강해졌다.**
   *
   * 예전에는 "관부가세를 원가로 보는 카테고리는 골프 하나뿐"을 셌다. CEO가
   * 그 방향을 거둔 지금은 셀 것이 없다 — 정책에 그런 스위치 자체가 없다.
   * 개수를 세는 대신 **필드가 존재하지 않는다**를 고정한다. 필드가 없으면
   * 목록에 새 카테고리가 들어올 수도 없다.
   */
  it("어떤 카테고리도 관부가세를 판매자 원가로 보지 않는다 — 켤 수 있는 칸 자체가 없다", () => {
    for (const id of Object.keys(CATEGORY_PROFILES) as CategoryProfileId[]) {
      expect(CATEGORY_COST_POLICIES[id], id).not.toHaveProperty("importTaxesInLandedCost");
      // 관부가세가 원가에 없으니 모든 착지원가는 세전이다.
      expect(CATEGORY_COST_POLICIES[id].landedCostTaxBasis, id).toBe("TAX_EXCLUDED");
    }
  });

  it("갈리는 것은 품목/HS 하나다 — 그 축이 «관세를 말할 수 있는가»를 정한다", () => {
    const classified = (Object.keys(CATEGORY_PROFILES) as CategoryProfileId[]).filter(
      (id) => CATEGORY_COST_POLICIES[id].hsCode != null,
    );
    expect(classified).toEqual(["GOLF"]);
    // 🔴 품목 분류를 확정하지 못한 카테고리에 관세율을 붙이면 그 순간 임의의
    //    세율이 구매자 부담으로 표시된다.
    expect(CATEGORY_COST_POLICIES.KIDS_FASHION.hsCode).toBeNull();
    expect(CATEGORY_COST_POLICIES.KIDS_FASHION.customsDutyRate).toBeNull();
    // 반면 수입부가세율은 품목이 아니라 법이 정하므로 모든 카테고리가 들고 있다.
    for (const id of Object.keys(CATEGORY_PROFILES) as CategoryProfileId[]) {
      expect(CATEGORY_COST_POLICIES[id].importVatRate?.percent, id).toBe(10);
    }
  });

  it("카테고리 id 어휘가 두 패키지에서 같다 — 비용 정책 쪽에만 있는 이름은 DEFAULT뿐이다", () => {
    const profileIds = new Set<string>(Object.keys(CATEGORY_PROFILES));
    const extra = Object.keys(CATEGORY_COST_POLICIES).filter((id) => !profileIds.has(id));
    expect(extra).toEqual(["DEFAULT"]);
  });
});

describe("GOLF-01 축B: 서버가 셀러가 고른 카테고리를 그대로 원가 정책에 넘긴다", () => {
  const marketIntelligence = readSourceAt(new URL("../market-intelligence.ts", import.meta.url));

  it("카테고리를 여기서 다시 추정하지 않는다 — workspace에 저장된 선택을 읽는다", () => {
    const code = stripComments(marketIntelligence);
    expect(code).toContain("snapshot.workspace.marketCategoryProfileId");
    expect(code).toContain("resolveCategoryCostPolicy(");
    expect(code).toContain("categoryProfileId: marketCategoryProfileId");
    // 여기서 또 판정하면 시장조사 소스 필터가 쓰는 카테고리와 원가가 쓰는
    // 카테고리가 언젠가 갈라진다.
    expect(code).not.toContain("detectCategoryProfile(");
  });
});

/**
 * PRICING-BASIS-1(CEO 지시, 2026-09-15) — 화면이 «세전인지 세후인지»를 말한다.
 *
 * 실측 결함: 우리 착지원가는 세전, 다나와 최저가는 세후. 나란히 놓고 빼면
 * 부가세만으로도 매번 약 18.8% 우리가 유리해 보인다. 값이 아니라 **라벨**이
 * 빠져 있던 것이 원인이라, 고치는 것도 라벨이다.
 */
describe("PRICING-BASIS-1: 두 숫자가 각자 어느 세금 기준인지 화면이 말한다", () => {
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

  it("국내 비교상품은 «소비자 결제 기준 · 세금 포함»이라고 스스로 밝힌다", () => {
    const context = buildMarketContext({
      domesticBasis: "EXACT",
      domesticAveragePriceKrw: 529000,
      domesticLowestPriceKrw: 498000,
      domesticSellerCount: 3,
      domesticUnresolved: false,
    });
    expect(context.comparable.basis).toContain(PRICE_TAX_BASIS_LABEL.TAX_INCLUDED);
    expect(context.comparable.basis).toContain("세금 포함");
  });

  /**
   * GOLF-01-TAX 이후 오늘의 정책 중 LANDED_TAXED를 내는 것은 없다. 그래도 이
   * 검사를 남기는 이유는, 세후 원가를 만드는 카테고리가 언젠가 생겼을 때
   * 화면이 그 사실을 말하는 문장을 이미 갖고 있어야 하기 때문이다 —
   * comparePriceBasis가 LANDED_TAXED ↔ TAX_INCLUDED만 비교 가능으로 두는 것과
   * 짝을 이룬다.
   */
  it("세후(LANDED_TAXED) 착지원가는 «한국 도착 기준»이라고 밝힌다", () => {
    const row = buildPriceChain({ ...CHAIN, landedCostTaxBasis: "LANDED_TAXED" }).find(
      (r) => r.key === "LANDED_COST",
    )!;
    expect(row.basis).toContain(PRICE_TAX_BASIS_LABEL.LANDED_TAXED);
    // 구성(무엇을 더했는가)도 그대로 남는다 — 기준이 구성을 밀어내지 않는다.
    expect(row.basis).toContain("국제배송비");
  });

  it("🔴 오늘의 모든 착지원가는 «세금 별도»라고 밝힌다 — 국내가와 그냥 빼면 안 되는 값이다", () => {
    const row = buildPriceChain({ ...CHAIN, landedCostTaxBasis: "TAX_EXCLUDED" }).find(
      (r) => r.key === "LANDED_COST",
    )!;
    expect(row.basis).toContain(PRICE_TAX_BASIS_LABEL.TAX_EXCLUDED);
    expect(row.basis).toContain("구매자 부담");
  });

  it("기준을 넘기지 않으면 지금까지와 같다 — 기존 호출부가 문장을 잃지 않는다", () => {
    const row = buildPriceChain(CHAIN).find((r) => r.key === "LANDED_COST")!;
    expect(row.basis).toBe("원화 환산 + 국제배송비");
  });

  it("화면이 서버 값을 옮기기만 한다 — 패널이 세금 기준을 스스로 판단하지 않는다", () => {
    const panel = stripComments(
      readSourceAt(new URL("../../../../pipeline/commerce/DomesticPriceIntelligencePanel.tsx", import.meta.url)),
    );
    expect(panel).toContain("landedCostTaxBasis: unifiedDecision?.landedCostTaxBasis");
  });
});
