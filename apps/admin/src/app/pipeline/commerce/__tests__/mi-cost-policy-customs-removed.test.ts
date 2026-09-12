import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
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

  it("남아 있는 판매 판단용 입력은 국내 배송원가 하나다 — 블록을 통째로 지워 그 사실을 잃지 않았다", () => {
    expect(detail).toContain('<Row label="국내 배송원가">');
    expect(detail).toContain("판매자 부담 비용(판매 판단용)");
  });
});

describe("MI-COST-POLICY-1 ②: 서버가 가격 엔진에 관부가세를 넘기지 않는다", () => {
  it("computeUnifiedPriceDecision 호출부에 customsDutyKrw/customsVatKrw 인자가 없다", () => {
    const code = stripComments(marketIntelligence);
    expect(code).toContain("computeUnifiedPriceDecision({");
    for (const gone of ["customsDutyKrw", "customsVatKrw"]) {
      expect(code, `${gone}을(를) 아직 넘기고 있다`).not.toContain(gone);
    }
  });

  it("판매자가 실제로 부담하는 비용은 그대로 넘긴다 — 비용 항목을 싸잡아 지운 것이 아니다", () => {
    const code = stripComments(marketIntelligence);
    expect(code).toContain("sellerDomesticShippingCostKrw");
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
