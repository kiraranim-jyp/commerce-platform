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

/** 문자열 a, b 사이의 최장 연속 공통 «부분문자열». 두 코드 길이가 항상 30자
 * 이하(PRODUCT_CODE_PATTERN 캡처 상한)라 O(n*m) 이중루프로 충분하다.
 *
 * 🔴 MI-DISCOVERY-P4 변경 C — 전에는 «길이» 만 돌려줬다. 이제 문자열을 돌려준다 —
 *    「얼마나 겹쳤는가」만으로는 부족하고 「무엇이 겹쳤는가」를 봐야 하기 때문이다
 *    (sharesNumericCore 참고). 길이는 `.length` 로 그대로 얻는다. */
function longestCommonSubstring(a: string, b: string): string {
  let best = "";
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      let k = 0;
      while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
      if (k > best.length) best = a.slice(i, i + k);
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

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-DISCOVERY-P4 변경 C(CPO 승인, 2026-10-07) — **공유 부분이 「숫자 코어」일 때만
 * LCS partial 을 인정한다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 바로 위 주석이 LCS 분기의 목적을 이미 적어 두었다 — 「표기법이 다른 같은 상품」에서
 * **공통 숫자 코어가 유일한 단서**인 경우다(`01195-VERNICE-NERO` ↔
 * `PP24KASHE1195NER` 의 `1195`). 🔴 그런데 규칙은 「숫자 코어」가 아니라 「길이 4」만
 * 봤다. 그래서 숫자가 아닌 공유도 통과했다:
 *
 *   실측(2026-10-07, main-story.com):
 *     AW26MS185  ↔  SS26MS252       LCS = "26MS"  →  partial  🔴
 *     「26」은 시즌연도, 「MS」는 브랜드 약자다. 둘 다 상품을 식별하지 않는다.
 *     실제로 식별하는 말미 숫자(185 ↔ 252)는 «다르다» — 전혀 다른 상품이다.
 *
 * 그 partial 이 `run-domestic-price-check.ts` 의 식별자 우회로(`exact || partial`)에
 * 걸려 Polo Sweatshirt 가 가격 참고 후보로 살아남았다(P2.5.2 실측).
 *
 * 🔴 **문턱(4)을 바꾸지 않는다.** 길이는 그대로 두고 「무엇이 겹쳤는가」만 묻는다 —
 *    P-10-F 가 「가르는 기준은 얼마나 겹치는가가 아니라 **어디가** 겹치는가」라고 적은
 *    것과 같은 축이다.
 *
 * 🔴 기존 단언 전수 대조(8쌍 실측, 2026-10-07) — 바뀌는 것은 위 한 쌍뿐이다:
 *     01195…↔PP24KASHE1195NER    LCS `1195`    숫자런 4  → partial 유지
 *     B1408F26-670↔B1453F26-670  LCS `F26670`  숫자런 5  → partial 유지
 *     B1408F26-670↔K1408F26-1A8  LCS `1408F26` 숫자런 4  → partial 유지
 *     B126AI018↔B126AI01831152 · B226AC043↔B226AC04341101   startsWith 분기 → 영향 0
 *     B226AC042↔B226AC043 · B126AC050↔B126AC999             prefix 분기     → 영향 0
 *
 * 🔴 먼저 「말미 숫자군이 다르면 conflict」 안을 재어 봤고, 그것은
 *    B1408F26-670↔K1408F26-1A8 을 깨뜨려서 폐기했다. **측정이 설계를 골랐다.**
 */
const NUMERIC_CORE_MIN_LENGTH = 3;

function sharesNumericCore(shared: string): boolean {
  for (const run of shared.match(/\d+/g) ?? []) {
    if (run.length >= NUMERIC_CORE_MIN_LENGTH) return true;
  }
  return false;
}

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

  // 🔴 변경 C — 길이 문턱은 그대로(4). 더해서 공유 부분이 «숫자 코어» 인지 묻는다.
  //    `26MS` 처럼 시즌연도+브랜드 약자만 겹친 것은 상품을 식별하지 않는다.
  const shared = longestCommonSubstring(a, b);
  if (shared.length < PARTIAL_MATCH_MIN_LENGTH) return "conflict";
  return sharesNumericCore(shared) ? "partial" : "conflict";
}
