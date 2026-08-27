/**
 * N-4.18-Q3 PART H-3-2(대표님 지시, 2026-08-27) — modelCode 증거 비교.
 *
 * 해외측 modelCode는 CanonicalProduct.sku(=Shopify 자체 variant SKU, 예:
 * "KA1-2")를 재사용하지 않는다. sku 필드는 이미 productData.sku가 있으면 그걸
 * 우선 쓰고 description-facts.extractProductCode는 폴백일 뿐이라
 * (canonical-product.ts:148 `productData.sku || extractProductCode(...)`),
 * 브랜드 고유 품번(article/product code)과 완전히 다른 값 체계다. 이 둘을
 * 그대로 비교하면 "다른 번호체계"를 "충돌"로 오판하는 위험이 있다(대표님 지시
 * #1 — MPN 비교는 브랜드 증거와의 호환성까지 봐야지, 무조건 강한 신호로 쓰면
 * 안 된다). 그래서 modelCode 전용 추출은 항상 extractProductCode(description)
 * 경로만 쓴다 — sku 필드와 완전히 분리된 파이프라인.
 */
import { extractProductCode } from "../description-facts";
import type { ModelEvidenceResult } from "./evidence";

export function extractForeignModelCode(description: string | undefined): string | null {
  return extractProductCode(description) ?? null;
}

function normalize(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** 문자열 a, b 사이의 최장 연속 공통 부분문자열 길이. 두 코드 길이가 항상
 * 30자 이하(PRODUCT_CODE_PATTERN 캡처 상한)라 O(n*m) 이중루프로 충분하다. */
function longestCommonSubstringLength(a: string, b: string): number {
  let best = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      let k = 0;
      while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
      if (k > best) best = k;
    }
  }
  return best;
}

/** 실측 골든케이스(PèPè)에서 확인된 값: 해외 "01195-VERNICE-NERO"(설명문
 * Article code) vs 국내 "PP24KASHE1195NER"(FORETFORET mpn) — 문자열 전체는
 * 다르지만 "1195"(4자리 숫자)와 "NER"(3자)를 공유한다. 완전 일치가 아닌데도
 * 우연이라 보기엔 너무 긴 공통 부분("1195" 같은 4자리 숫자)이 있으면 partial로
 * 본다 — 3자 이하는 우연한 겹침일 가능성이 커서 매칭 근거로 쓰지 않는다. */
const PARTIAL_MATCH_MIN_LENGTH = 4;

/** exact=정규화 후 완전 일치, partial=의미있는 부분 일치(4자 이상 공통
 * 부분문자열), unavailable=한쪽(또는 양쪽) modelCode가 없어 비교 자체를 못 함,
 * conflict=양쪽 다 있는데 의미있는 공통부분이 없음(대표님 정의 그대로). */
export function compareModelCode(foreignCode: string | null, domesticCode: string | null): ModelEvidenceResult {
  if (!foreignCode || !domesticCode) return "unavailable";
  const a = normalize(foreignCode);
  const b = normalize(domesticCode);
  if (!a || !b) return "unavailable";
  if (a === b) return "exact";
  const shared = longestCommonSubstringLength(a, b);
  return shared >= PARTIAL_MATCH_MIN_LENGTH ? "partial" : "conflict";
}
