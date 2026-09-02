import { describe, expect, it } from "vitest";
import {
  compareModelCode,
  deriveMatchTruth,
  extractBobochosesModelCode,
  fetchDomesticModelCode,
  supportsDomesticIdentifierExtraction,
} from "@commerce/crawler";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";

/**
 * P-28(CPO 지시, 2026-09-03) — "국내 동일상품 매칭 엔진의 도메인별 식별자 검증
 * 커버리지 누락"을 고친 것을 실제 코드로 고정한다. 실측 발견(Curious Turnip
 * All Over Swim Cap by Bobo Choses): 해외 원문 "Product code B126AI018"와
 * 국내 bobochoses.com 공식몰(handle: b126ai018-curious-turnip-all-over-
 * swim-cap)의 코드가 실제로 일치하는데도, foretforet.com 하드코딩 때문에
 * COMPARISON(EXCLUDED 다음 등급)에 묶여 CASE A(marketCase)로 올라갈 수
 * 없었다. Sprint 8 CPO 지시 T1~T5를 그대로 옮긴다.
 */
describe("P-28 T2: bobochoses.com — 실제 SKU 완전 일치 → EXACT_IDENTIFIER → EXACT tier", () => {
  it("실측 골든케이스: B126AI018(해외) = b126ai018(국내 handle) → EXACT_IDENTIFIER → priceTierFromLink === EXACT", () => {
    const domesticCode = extractBobochosesModelCode(
      "https://bobochoses.com/products/b126ai018-curious-turnip-all-over-swim-cap?_pos=1",
    );
    expect(domesticCode).toBe("B126AI018");

    const modelCodeEvidence = compareModelCode("B126AI018", domesticCode);
    expect(modelCodeEvidence).toBe("exact");

    const matchTruth = deriveMatchTruth("very_high", modelCodeEvidence);
    expect(matchTruth).toBe("EXACT_IDENTIFIER");
    expect(priceTierFromLink({ matchTruth, verified: true })).toBe("EXACT");
  });

  it("fetchDomesticModelCode(도메인 레지스트리)로 호출해도 동일 결과", async () => {
    const domesticCode = await fetchDomesticModelCode(
      "bobochoses.com",
      "https://bobochoses.com/products/b126ai018-curious-turnip-all-over-swim-cap",
    );
    expect(domesticCode).toBe("B126AI018");
  });

  it("supportsDomesticIdentifierExtraction('bobochoses.com') === true", () => {
    expect(supportsDomesticIdentifierExtraction("bobochoses.com")).toBe(true);
  });
});

describe("P-28 T3: SKU 없음(브랜드/상품명만 유사) → EXACT 승격 금지", () => {
  it("domesticCode를 못 뽑는 URL(handle 패턴 불일치) → unavailable → EXACT_IDENTIFIER 절대 안 됨", () => {
    const domesticCode = extractBobochosesModelCode("https://bobochoses.com/products/some-random-slug-without-code");
    expect(domesticCode).toBeNull();

    const modelCodeEvidence = compareModelCode("B126AI018", domesticCode);
    expect(modelCodeEvidence).toBe("unavailable");

    // 텍스트 유사도가 아무리 높아도(very_high) 식별자 증거가 없으면 TEXT_CONFIRMED까지만 —
    // EXACT_IDENTIFIER/STRONG_IDENTIFIER로 승격되지 않는다(CPO 절대 금지 1/2/4).
    const matchTruth = deriveMatchTruth("very_high", modelCodeEvidence);
    expect(matchTruth).toBe("TEXT_CONFIRMED");
    expect(priceTierFromLink({ matchTruth, verified: false })).toBe("COMPARISON");
  });
});

describe("P-28 T4: 서로 다른 SKU → EXACT 금지(conflict)", () => {
  it("B126AI018(해외) vs 완전히 무관한 코드(국내) → conflict → CONFLICT tier(EXCLUDED)", () => {
    // "B126AC999"처럼 시즌 접두사(B126A)만 겹치는 코드는 LCS≥4 규칙상 partial로
    // 판정된다(P-10 STEP 7 기존 known limitation, model-code-known-limitation.test.ts
    // 참고 — 이 임계값 자체는 P-28 범위가 아니다). 여기서는 정말 무관한 코드로
    // conflict 자체는 여전히 정상 동작함을 확인한다.
    const modelCodeEvidence = compareModelCode("B126AI018", "ZZZZZZZZZ");
    expect(modelCodeEvidence).toBe("conflict");
    const matchTruth = deriveMatchTruth("high", modelCodeEvidence);
    expect(matchTruth).toBe("CONFLICT");
    expect(priceTierFromLink({ matchTruth, verified: false })).toBe("EXCLUDED");
  });
});

describe("P-28 T1/T5: foretforet.com 기존 EXACT 경로 회귀 없음", () => {
  it("supportsDomesticIdentifierExtraction('foretforet.com') === true(기존 유지)", () => {
    expect(supportsDomesticIdentifierExtraction("foretforet.com")).toBe(true);
  });

  it("PèPè 골든케이스(01195-VERNICE-NERO ↔ PP24KASHE1195NER)는 여전히 partial(회귀 없음)", () => {
    expect(compareModelCode("01195-VERNICE-NERO", "PP24KASHE1195NER")).toBe("partial");
  });

  it("지원하지 않는 도메인(looxloo.com 등)은 여전히 항상 null(fetchDomesticModelCode)", async () => {
    const code = await fetchDomesticModelCode("looxloo.com", "https://www.looxloo.com/product/1");
    expect(code).toBeNull();
    expect(supportsDomesticIdentifierExtraction("looxloo.com")).toBe(false);
  });
});

describe("P-28: extractBobochosesModelCode 정규화/실측 케이스", () => {
  it("실측 6건 — 코드가 handle 맨 앞이면 대문자로 정규화해 추출", () => {
    expect(extractBobochosesModelCode("https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt")).toBe(
      "B226AC010",
    );
    expect(
      extractBobochosesModelCode("https://bobochoses.com/products/b126ac155-color-herbalist-all-over-leggings"),
    ).toBe("B126AC155");
    expect(extractBobochosesModelCode("https://bobochoses.com/products/b126ah013-tangerine-all-over-swim-cap")).toBe(
      "B126AH013",
    );
    expect(extractBobochosesModelCode("https://bobochoses.com/products/b126ac083-tangerine-all-over-leggings")).toBe(
      "B126AC083",
    );
  });

  it("잘못된 URL(파싱 불가)은 예외를 던지지 않고 null", () => {
    expect(extractBobochosesModelCode("not a url")).toBeNull();
  });
});
