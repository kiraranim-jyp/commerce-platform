import { describe, expect, it } from "vitest";
import { attachProductMatchTruth, deriveProductMatchTruth } from "@commerce/crawler";
import type { ComparisonCandidate, ComparisonQuery, ComparisonSearchResult } from "@commerce/crawler";

/**
 * P-11 STEP 4(대표님/CPO 지시, 2026-08-30) — T1~T11. T1/T2/T3/T6/T8/T9는 실제
 * Junior Edition PèPè 카탈로그(STEP 2 실측, 2026-08-30 조회)에서 그대로 가져온
 * 값이다 — SKU/title 어느 것도 지어내지 않았다. T4/T5/T10/T11은 카탈로그에
 * 실제로 없는 페어라(STEP 2 보고에서 이미 확인) 합성 데이터로 명시한다.
 */

function candidate(overrides: Partial<ComparisonCandidate> & { title: string; url: string }): ComparisonCandidate {
  return {
    price: null,
    imageUrl: null,
    confidence: 0,
    ...overrides,
  };
}

const BRUNO_LOBELIA_URL = "https://junioredition.com/products/bruno-cut-out-sandals-in-lobelia-sapphire-by-pepe";
const BRUNO_LOBELIA_TITLE = "Bruno Cut Out Sandals in Lobelia Blue by PèPè - Last Ones In Stock - 20 EUR / 34 EUR";
const BRUNO_LOBELIA_DESCRIPTION =
  "Bruno cut out sandals by PèPè shoes. Buckled T bar shoes in vegetally tanned cobalt blue leather with cut out details. Article code: 01026-SOUFFLE-LOBELIA We recommend allowing an extra +0.5in / +1.3cm for growth.";

describe("T1 — Bruno 자기 자신(URL 완전 일치) → EXACT_PRODUCT", () => {
  it("실제 카탈로그: sourceUrl과 후보 url이 같으면 confidence/구조화코드와 무관하게 EXACT_PRODUCT", () => {
    const query: ComparisonQuery = {
      title: BRUNO_LOBELIA_TITLE,
      brand: "Pèpè Shoes",
      sourceUrl: BRUNO_LOBELIA_URL,
      description: BRUNO_LOBELIA_DESCRIPTION,
    };
    const c = candidate({ title: BRUNO_LOBELIA_TITLE, url: BRUNO_LOBELIA_URL, sku: "01026-SOUFFLE-LOBELIA", confidence: 1 });
    expect(deriveProductMatchTruth(query, c, 1)).toBe("EXACT_PRODUCT");
  });
});

describe("T2 — Bruno Lobelia ↔ Bruno Vachetta(같은 모델, 다른 컬러) → SAME_MODEL_VARIANT", () => {
  it("query.sku가 비어있어도 description의 Article code로 구조화 코드를 뽑는다(STEP1 실측 버그 수정 대상)", () => {
    const query: ComparisonQuery = {
      title: BRUNO_LOBELIA_TITLE,
      brand: "Pèpè Shoes",
      sourceUrl: BRUNO_LOBELIA_URL,
      sku: undefined,
      description: BRUNO_LOBELIA_DESCRIPTION,
    };
    const vachetta = candidate({
      title: "Bruno Cut Out Sandals in Vachetta Lux Cuoio by PèPè",
      url: "https://junioredition.com/products/bruno-cut-out-sandals-in-vachetta-lux-cuoio-by-pepe",
      sku: "01026-VALXSC",
      confidence: 0.76,
    });
    expect(deriveProductMatchTruth(query, vachetta, 0.76)).toBe("SAME_MODEL_VARIANT");
  });
});

describe("T3 — Bruno ↔ Ezra(다른 모델, 공통 접미사 SOUFFLE-LOBELIA 공유) → CONFLICT", () => {
  it("실측 원 버그 재현: Ezra는 confidence 0.90(matchLevel=high)이어도 title 모델명이 다르므로 CONFLICT", () => {
    const query: ComparisonQuery = {
      title: BRUNO_LOBELIA_TITLE,
      brand: "Pèpè Shoes",
      sourceUrl: BRUNO_LOBELIA_URL,
      description: BRUNO_LOBELIA_DESCRIPTION,
    };
    const ezra = candidate({
      title: "Ezra Cut Out Sandals in Lobelia Blue by PèPè - Last Ones In Stock - 20-21 EUR",
      url: "https://junioredition.com/products/ezra-cut-out-sandals-in-lobelia-blue-by-pepe",
      sku: "EZRA-SOUFFLE-LOBELIA",
      confidence: 0.9,
    });
    expect(deriveProductMatchTruth(query, ezra, 0.9)).toBe("CONFLICT");
  });
});

describe("T6 — Bruno(01026) ↔ Andrea(01030) → CONFLICT", () => {
  it("실측: 숫자 코드가 비슷해도(01026 vs 01030) title 모델명이 다르면 CONFLICT", () => {
    const query: ComparisonQuery = {
      title: BRUNO_LOBELIA_TITLE,
      brand: "Pèpè Shoes",
      sourceUrl: BRUNO_LOBELIA_URL,
      description: BRUNO_LOBELIA_DESCRIPTION,
    };
    const andrea = candidate({
      title: "Andrea Cut Out Sandals in Kava Brown by PèPè - Last One In Stock - 29 EUR",
      url: "https://junioredition.com/products/andrea-cut-out-sandals-in-kava-brown-by-pepe",
      sku: "01030-KASC",
      confidence: 0.6,
    });
    expect(deriveProductMatchTruth(query, andrea, 0.6)).toBe("CONFLICT");
  });
});

describe("T8 — Sandy ↔ Two Con Me Crossover(둘 다 SKU가 TWO/로 시작) → CONFLICT, CONFIRMED_PRODUCT 절대 금지", () => {
  it("STEP 2에서 폐기한 '첫 세그먼트=모델' 가설의 실제 반례 — SKU 접두사 공유가 CONFIRMED_PRODUCT로 이어지면 안 된다", () => {
    const query: ComparisonQuery = {
      title: "Sandy Velcro Sandals in Milk by PèPè",
      brand: "Pèpè Shoes",
      sku: "TWO/BK34-VIT",
    };
    const twoConMe = candidate({
      title: "Two Con Me Crossover Velcro Sandals in Cuoio Brown by PèPè",
      url: "https://junioredition.com/products/two-con-me-crossover-velcro-sandals-in-cuoio-brown-by-pepe",
      sku: "TWO/BK38-VAC",
      confidence: 0.8,
    });
    const result = deriveProductMatchTruth(query, twoConMe, 0.8);
    expect(result).toBe("CONFLICT");
    expect(result).not.toBe("CONFIRMED_PRODUCT");
    expect(result).not.toBe("SAME_MODEL_VARIANT");
  });
});

describe("T9 — Two Con Me Crossover ↔ Open Clog: confidence가 매우 높아도(0.97) 모델명이 다르면 CONFLICT", () => {
  it("핵심 원칙 검증: confidence는 동일상품 판정에 개입하지 않는다", () => {
    const query: ComparisonQuery = {
      title: "Two Con Me Crossover Velcro Sandals in Cuoio Brown by PèPè",
      brand: "Pèpè Shoes",
      sku: "TWO/BK38-VAC",
    };
    const openClog = candidate({
      title: "Two Con Me Open Clog Sandals in Cuoio Brown by PèPè",
      url: "https://junioredition.com/products/two-con-me-open-clog-sandals-in-cuoio-brown-by-pepe",
      sku: "TWO/BK40-VAC",
      confidence: 0.97,
    });
    // confidence를 일부러 매우 높게(0.97) 전달해도 결과가 바뀌면 안 된다.
    expect(deriveProductMatchTruth(query, openClog, 0.97)).toBe("CONFLICT");
  });

  it("CPO 2차 검증 조건 4 — 실제 API 경로(attachProductMatchTruth)를 통과해도 동일하게 CONFLICT 유지", () => {
    // deriveProductMatchTruth()를 직접 부르는 게 아니라, /api/comparison/search가
    // 실제로 호출하는 attachProductMatchTruth() 래퍼를 통과시킨다 — candidate.confidence
    // 필드 자체를 0.97로 채워서, 이 값이 결과 truth에 어떤 방식으로도 개입하지 않는지 확인.
    const query: ComparisonQuery = {
      title: "Two Con Me Crossover Velcro Sandals in Cuoio Brown by PèPè",
      brand: "Pèpè Shoes",
      sku: "TWO/BK38-VAC",
    };
    const results: ComparisonSearchResult[] = [
      {
        shopId: "s1",
        shopName: "Junior Edition",
        domain: "junioredition.com",
        status: "ok",
        candidates: [
          candidate({
            title: "Two Con Me Open Clog Sandals in Cuoio Brown by PèPè",
            url: "https://junioredition.com/products/two-con-me-open-clog-sandals-in-cuoio-brown-by-pepe",
            sku: "TWO/BK40-VAC",
            confidence: 0.97,
            matchLevel: "very_high",
          }),
        ],
      },
    ];
    const attached = attachProductMatchTruth(query, results);
    expect(attached[0].candidates[0].productMatchTruth).toBe("CONFLICT");
  });
});

describe("T10(합성) — confidence 낮음(0.3) + 구조화 코드 완전일치 → CONFIRMED_PRODUCT", () => {
  it("합성 테스트: 실제 카탈로그에 이 페어가 없어(STEP 2 보고) 인위적으로 구성 — 구조화 코드 일치가 낮은 confidence를 이긴다", () => {
    const query: ComparisonQuery = {
      title: "Bruno Cut Out Sandals in Lobelia Blue by PèPè",
      sku: "01026-SOUFFLE-LOBELIA",
    };
    const c = candidate({
      title: "PèPè 브루노 코발트 블루 샌들",
      url: "https://example-domestic-shop.co.kr/product/12345",
      sku: "01026-SOUFFLE-LOBELIA",
      confidence: 0.3,
    });
    expect(deriveProductMatchTruth(query, c, 0.3)).toBe("CONFIRMED_PRODUCT");
  });
});

describe("T11(합성) — title 모델명 동일 + 색상 동일 + 구조화 코드 없음 → VERY_SIMILAR(CONFIRMED_PRODUCT 금지)", () => {
  it("CPO 최종 승인 조건 1 검증: title 일치만으로는 동일상품 확정하지 않는다", () => {
    const query: ComparisonQuery = {
      title: "Bruno Cut Out Sandals in Lobelia Blue by PèPè",
    };
    const c = candidate({
      title: "Bruno Cut Out Sandals in Lobelia Blue by PèPè",
      url: "https://another-shop.com/products/some-other-listing",
      confidence: 0.95,
    });
    const result = deriveProductMatchTruth(query, c, 0.95);
    expect(result).toBe("VERY_SIMILAR");
    expect(result).not.toBe("CONFIRMED_PRODUCT");
  });
});

describe("T4(합성) — SKU 없음 + title 완전 동일(패턴 매칭됨) → VERY_SIMILAR", () => {
  it("합성 테스트: 실제 카탈로그에 이 조합이 없어 인위적으로 구성", () => {
    const query: ComparisonQuery = { title: "Ida Cut Out Sandals in Latte by PèPè" };
    const c = candidate({
      title: "Ida Cut Out Sandals in Latte by PèPè",
      url: "https://junioredition.com/products/ida-cut-out-sandals-in-latte-by-pepe",
      confidence: 1,
    });
    expect(deriveProductMatchTruth(query, c, 1)).toBe("VERY_SIMILAR");
  });
});

describe("T5(합성) — SKU 없음 + title이 'in X by Y' 패턴이 아니라 신뢰 가능한 모델명을 못 뽑음 → confidence 폴백(SIMILAR)", () => {
  it("합성 테스트: 패턴이 없는 사이트(Childrensalon류) 제목 형식을 가정 — 모델명 불일치만으로 성급하게 CONFLICT 처리하지 않는다", () => {
    const query: ComparisonQuery = { title: "PèPè Kids Leather Sandals Blue" };
    const c = candidate({
      title: "PèPè Toddler Leather Sandal in Blue",
      url: "https://childrensalon.com/pepe-toddler-leather-sandal-blue.html",
      confidence: 0.75,
    });
    expect(deriveProductMatchTruth(query, c, 0.75)).toBe("SIMILAR");
  });
});
