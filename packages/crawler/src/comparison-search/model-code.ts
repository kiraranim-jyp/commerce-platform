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

  // P-10-F(CEO 승인, 2026-09-11) — 예약돼 있던 "LCS≥4 임계값 재검토"를 여기서
  // 끝낸다. 실측(Bobo Choses): B226AC042(다른 색)와 B226AC043(정답)은 앞 8자
  // "B226AC04"를 공유해 partial → STRONG_IDENTIFIER로 승격됐다. 두 상품은
  // 상품명까지 완전히 같아서("Mystery BC half zipped sweatshirt", 색상이 제목에
  // 없다) 텍스트로는 원리상 구분되지 않는다 — 코드가 유일한 판별 근거인데
  // 그 코드가 오히려 오매칭을 승격시키고 있었다.
  //
  // 가르는 기준은 "얼마나 겹치는가"가 아니라 **어디가 겹치는가**다.
  //
  //   B226AC042 / B226AC043   앞에서 같다가 갈라진다 → 같은 코드 체계, 다른 상품
  //   B126AC050 / B126AC999   같음(문서화돼 있던 known limitation)
  //   B126AI018 / B126AI01831152  한쪽이 다른 쪽을 통째로 품는다 → 사이즈 접미사
  //   01195VERNICENERO / PP24KASHE1195NER  접두사를 전혀 공유하지 않고 숫자
  //                           코어 "1195"만 공유한다 → 표기법이 다른 같은 상품
  //
  // 앞자리를 공유한다는 건 같은 브랜드의 같은 코드 체계라는 뜻이고, 그렇다면
  // 뒤가 다른 것은 곧 "다른 상품"이다. 반대로 접두사가 아예 다르면 서로 다른
  // 표기법이라 공통 숫자 코어가 유일한 단서이므로 기존 LCS 규칙을 그대로 쓴다.
  // 한쪽이 다른 쪽을 통째로 품으면 접미사(사이즈/색상 코드)가 붙은 같은 상품이다.
  if (a.startsWith(b) || b.startsWith(a)) return "partial";

  // 같은 코드 체계를 쓰면서 뒤가 갈라지면 다른 상품이다. 기준 길이는 새 상수를
  // 만들지 않고 LCS와 같은 값을 쓴다 — "우연으로 보기 어려운 길이"라는 판단
  // 근거가 동일하기 때문이다(3자 이하 접두사는 우연히 겹칠 수 있다).
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  if (prefix >= PARTIAL_MATCH_MIN_LENGTH) return "conflict";

  const shared = longestCommonSubstringLength(a, b);
  return shared >= PARTIAL_MATCH_MIN_LENGTH ? "partial" : "conflict";
}
