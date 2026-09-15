import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { computeUnifiedPriceDecision } from "@commerce/pricing";
import { readSourceAt, stripComments } from "./source-text";

/**
 * MI-COST-POLICY-1 FINAL(대표님 결정, 2026-09-12) —
 * "관세·부가세는 구매자 부담이며 판매자 가격/수익성 계산에 포함하지 않는다."
 *
 * ── 왜 화면 쪽에도 테스트가 필요한가 ────────────────────────────────────
 * 계산에서 뺐다는 것만으로는 끝이 아니다. 이전 시도가 멈춘 지점이 정확히
 * 반대쪽이었다 — 화면에서만 감추고 계산에 남기면 화면이 거짓말을 한다.
 * 이번에는 계산에서 먼저 뺐으니, 이제 막아야 할 회귀는 "입력칸만 슬쩍
 * 되살아나는 것"이다. 셀러가 채워 넣은 숫자가 아무 데도 쓰이지 않는 상태가
 * 그 다음으로 나쁜 상태이기 때문이다.
 *
 * ── 왜 소스 텍스트인가 ──────────────────────────────────────────────────
 * 이 폴더의 다른 배치 테스트와 같은 이유다(price-single-surface.test.ts 참고).
 * "어느 화면에 무엇이 있는가"는 순수 함수로 표현할 수 없고, 깨지는 방식은
 * 늘 "누군가 편해 보여서 칸을 하나 되살린다"이다. 주석은 걷어내고 검사한다 —
 * 이 저장소는 "왜 지웠는지"를 주석으로 남기는 것이 규칙이라, 주석까지 막으면
 * 근거를 지우게 된다.
 */
function read(relativeToThisFile: string): string {
  return readSourceAt(new URL(relativeToThisFile, import.meta.url));
}

const detail = read("../PriceCalculationDetail.tsx");
const editor = read("../PriceEditor.tsx");
const panel = read("../DomesticPriceIntelligencePanel.tsx");
const workspace = read("../../CommerceWorkspace.tsx");
const marketIntelligence = read("../../../api/price-history/_lib/market-intelligence.ts");

describe("MI-COST-POLICY-1 ①: 셀러가 보는 가격 화면 어디에도 관세/부가세가 없다", () => {
  const sellerFacing: [string, string][] = [
    ["가격 계산 상세(PriceCalculationDetail)", detail],
    ["판매가격 확정 카드(PriceEditor)", editor],
    ["Market Intelligence 패널(DomesticPriceIntelligencePanel)", panel],
  ];

  for (const [name, source] of sellerFacing) {
    it(`${name}에 "관세"/"부가세" 문자열이 렌더되지 않는다`, () => {
      const code = stripComments(source);
      for (const banned of ["관세", "부가세"]) {
        expect(code, `${name}에 ${banned}이(가) 남아 있다`).not.toContain(banned);
      }
    });
  }

  it("입력 컴포넌트와 그 통로가 통째로 사라졌다 — prop이 남으면 언젠가 그 prop을 타고 칸이 되살아난다", () => {
    const detailCode = stripComments(detail);
    const workspaceCode = stripComments(workspace);
    for (const gone of ["CustomsCostSection", "onUpdateCustomsCost", "customsDutyKrw", "customsVatKrw"]) {
      expect(detailCode, `${gone}이(가) 상세 계산에 남아 있다`).not.toContain(gone);
      expect(workspaceCode, `${gone}이(가) 워크스페이스에 남아 있다`).not.toContain(gone);
    }
    expect(workspaceCode).not.toContain("updateCustomsCost");
  });

  /**
   * MI-UX-FINAL-4(대표님 결정, 2026-09-13) — 이 기대값이 **뒤집혔다**.
   *
   * 관부가세를 뺀 뒤 이 블록에 남아 있던 한 줄이 국내 배송원가였다. 그 값은
   * 여전히 LANDED_COST_PARTS에 있어 마진을 움직였기 때문에, 그때는 "블록째
   * 지우면 그 사실을 말할 곳이 없어진다"가 옳았다. 이번에 대표님이 그 값도
   * 계산에서 빼기로 결정했고, 같은 순서(엔진 먼저 → 화면)를 따랐으므로
   * 이제는 말할 사실 자체가 없다 — 블록이 통째로 사라지는 것이 맞다.
   */
  it("판매 판단용 입력 블록 자체가 사라졌다 — 계산에 들어가지 않는 값을 셀러에게 묻지 않는다", () => {
    expect(detail).not.toContain('<Row label="국내 배송원가">');
    expect(stripComments(detail)).not.toContain("판매자 부담 비용");
    expect(stripComments(detail)).not.toContain("SellerBorneCostSection");
  });
});

describe("MI-COST-POLICY-1 ②: 서버가 아동의류 원가에 관부가세를 넣지 않는다", () => {
  /**
   * ── GOLF-01 축B(CEO 지시, 2026-09-15) — 이 검사의 «방법»이 바뀌었다 ─────────
   *
   * 원래 이 자리는 소스 텍스트에서 "customsDutyKrw"라는 **글자**가 사라졌는지
   * 봤다. 그때는 그게 정확한 검사였다 — 넘길 이유가 어떤 카테고리에도 없었으니
   * 글자가 있다는 것 자체가 회귀였다.
   *
   * 이번에 CEO가 카테고리별 비용 정책을 지시했다: 아동의류는 기존 정책 유지,
   * 골프는 관세·부가세를 판매자 원가로 본다. 그래서 market-intelligence.ts는
   * 이제 그 두 인자를 **정책이 요구할 때만 값이 채워지는 통로**로 넘긴다.
   * 글자는 있고, 아동의류에서 값은 없다.
   *
   * 여기서 글자 검사를 그대로 두면 두 가지 중 하나가 일어난다: 골프 정책을
   * 포기하거나, 테스트를 지우거나. 둘 다 틀렸다. 그래서 **같은 것을 더 강하게**
   * 지키도록 방법을 바꾼다 — 글자가 아니라 **결과**를 본다. 글자 검사는 통로가
   * 생기면 막지 못하는 대신 값이 흐르는지는 보지 못했다. 아래 검사는 엔진을
   * 실제로 돌려서 "아동의류에서는 관부가세가 착지원가를 한 원도 움직이지
   * 못한다"를 직접 확인한다. 이게 원래 지키려던 사실 그 자체다.
   *
   * 글자 검사도 버리지 않는다 — **셀러가 보는 화면**(위 ①)에서는 그대로다.
   * 아동의류 화면에 "관세"가 뜨면 여전히 실패한다.
   */
  it("아동의류(및 카테고리 미지정) 정책에서는 관부가세를 넘겨도 착지원가·마진·판정이 한 글자도 달라지지 않는다", () => {
    const base = {
      sourceProductPriceKrw: { value: 111000, status: "estimated" as const },
      exchangeRate: { value: 1480, status: "estimated" as const },
      internationalShippingKrw: { value: 12000, status: "estimated" as const, source: "seller_default" },
      customerChargedShippingKrw: { value: null, status: "unknown" as const },
      platformFeeRate: { value: 10, status: "estimated" as const, source: "default" },
      currentSellingPriceKrw: { value: 175710, status: "actual" as const },
      domesticCompetitivePrice: { lowest: 198000, average: 214000 },
    };
    const customs = {
      customsDutyKrw: { value: 9840, status: "actual" as const },
      customsVatKrw: { value: 13284, status: "actual" as const },
    };
    const noCategory = computeUnifiedPriceDecision(base);
    for (const input of [
      { ...base, ...customs },
      { ...base, ...customs, categoryProfileId: "KIDS_FASHION" },
      { ...base, ...customs, categoryProfileId: null },
    ]) {
      const result = computeUnifiedPriceDecision(input);
      expect(result.landedCostKrw).toEqual(noCategory.landedCostKrw);
      expect(result.estimatedProfitKrw).toEqual(noCategory.estimatedProfitKrw);
      expect(result.marginPercent).toEqual(noCategory.marginPercent);
      expect(result.verdict).toBe(noCategory.verdict);
      expect(result.dataCompleteness).toBe(noCategory.dataCompleteness);
      expect(result.missingComponents).toEqual([]);
      expect(result.costPolicy.importTaxesInLandedCost).toBe(false);
    }
  });

  it("서버가 아동의류에 넘기는 관부가세 값은 «저장된 상품 값»이 아니라 «정책이 낸 값»이다 — 정책이 아니라면 항상 null이다", () => {
    const code = stripComments(marketIntelligence);
    expect(code).toContain("computeUnifiedPriceDecision({");
    // 통로는 정책 결과(importTax)에서만 온다. product.customsDutyKrw 같은
    // **저장된 상품 값**을 다시 읽기 시작하면 과거 스냅샷이 소급해서 마진을
    // 깎는다 — MI-COST-POLICY-1이 막은 바로 그 경로다.
    expect(code).toContain("importTaxComponent(");
    expect(code).not.toContain("product.customsDutyKrw");
    expect(code).not.toContain("product.customsVatKrw");
    // 그리고 그 importTax 자체가 정책 게이트 뒤에 있다.
    expect(code).toContain("costPolicy.importTaxesInLandedCost");
  });

  it("판매자가 실제로 부담하는 비용은 그대로 넘긴다 — 비용 항목을 싸잡아 지운 것이 아니다", () => {
    const code = stripComments(marketIntelligence);
    // MI-UX-FINAL-4 — sellerDomesticShippingCostKrw는 이 목록에서 빠졌다
    // (착지원가에서 빠진 값을 계속 넘기면 "이 값이 마진에 영향을 준다"는
    // 오해가 코드에 그대로 남는다). 상품마다 실제로 확인되는 두 항목은 그대로다.
    expect(code).not.toContain("sellerDomesticShippingCostKrw");
    expect(code).toContain("internationalShippingKrw");
    expect(code).toContain("platformFeeRate");
  });
});

describe("MI-COST-POLICY-1 ③: 저장된 과거 값은 건드리지 않는다", () => {
  it("CanonicalProduct의 customsDutyKrw/customsVatKrw 타입 필드는 남아 있다(읽지 않을 뿐이다)", () => {
    // 타입에서 지우면 이미 저장된 product_snapshots.workspace jsonb를 지우거나
    // 마이그레이션해야 한다 — 그건 과거 데이터를 고쳐 쓰는 일이라 하지 않는다.
    const productTypes = readSourceAt(
      new URL("../../../../../../../packages/shared/src/product-types.ts", import.meta.url),
    );
    expect(productTypes).toContain("customsDutyKrw?: ProvenanceField<number>;");
    expect(productTypes).toContain("customsVatKrw?: ProvenanceField<number>;");
  });

  it("MI 계산 경로는 registration_attempts.price_breakdown을 쓰지 않는다 — 과거 판정을 소급해서 고치지 않는다", () => {
    // 이미 등록 시도에 남은 price_breakdown은 그때의 정책으로 계산된 사실
    // 기록이다. 여기서 다시 써 넣으면 과거 스냅샷의 판정이 소급해서 바뀐다.
    // 이번 지시는 "앞으로의 계산"만 바꾸는 일이다.
    const code = stripComments(marketIntelligence);
    expect(code).not.toContain("registration_attempts");
    expect(code).not.toContain("price_breakdown");
  });
});

/** 경로 확인용 — 위 테스트가 엉뚱한 파일을 읽고 "없다"고 통과하는 위장 성공을
 * 막는다(파일을 못 읽으면 readFileSync가 던지지만, 경로가 바뀌어 빈 문자열이
 * 되는 실수는 조용하다). */
describe("MI-COST-POLICY-1 ④: 검사 대상 파일을 실제로 읽었다", () => {
  it("읽은 소스가 비어 있지 않다", () => {
    for (const source of [detail, editor, panel, workspace, marketIntelligence]) {
      expect(source.length).toBeGreaterThan(1000);
    }
    expect(fileURLToPath(new URL("../PriceCalculationDetail.tsx", import.meta.url))).toContain(
      "PriceCalculationDetail.tsx",
    );
  });
});
