/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-REAL-05(CEO 지시, 2026-09-20) — **원본과 «같은 listing» 인 후보를 제외한다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 실측 사례(MI-REAL-04 #5, Production):
 *
 *   원본   www.foretforet.com/shop/shopdetail.html?branduid=10278273&search=신발&…&GfDT=…
 *   후보   www.foretforet.com/shop/shopdetail.html?branduid=10278273
 *
 * 본문 텍스트 SHA-256 이 완전히 같았다(9,324자). 차이는 검색 추적 파라미터뿐이다.
 * 그 결과 「국내 경쟁가격 ₩70,000」이 **자기 자신의 가격**이 됐다.
 *
 * 🔴 **host 가 같다는 이유만으로 제외하면 안 된다.** 같은 브랜드 도메인의
 *    «다른» 상품은 정상 후보다 — 실제로 지켜야 하는 쌍:
 *
 *      bobochoses.com/en-kr/products/b226ac043-…   (원본)
 *      bobochoses.com/products/b226ac042-…         (후보)  ← 유지돼야 한다
 *
 *    그래서 자기참조의 조건은 «host 동일» 이 아니라
 *    **«host 동일 + listing 동일»** 이다. 브랜드·slug·상품명이 같다는 이유로
 *    제외하지 않는다(그건 동일상품 판정이지 자기참조가 아니다).
 *
 * 🔴 **식별자를 만들 수 없으면 제외하지 않는다.** URL 파싱이 실패하거나 원본
 *    URL 이 없으면 `false` — 추측해서 자기참조로 몰지 않는다(기존 동작 유지).
 *
 * 이 파일은 순수 함수만 둔다. 네트워크를 타지 않고, canonical 태그를 새로
 * 읽어오지 않는다(그건 새 수집 경로를 만드는 일이다). 여기서 말하는
 * "canonical" 은 **URL 을 정규형으로 만든 것**이다.
 */

/**
 * listing 을 가리지 못하는 파라미터 — 검색·정렬·카테고리 네비게이션·추적용.
 *
 * 🔴 보수적으로 둔다. 여기 없는 파라미터는 **식별자로 취급**한다(= 값이 다르면
 *    다른 listing 으로 본다 = 제외하지 않는다). 과소 제외는 기존 동작이지만
 *    과다 제외는 정상 후보를 죽인다.
 *
 * `xcode/mcode/scode` 는 메이크샵 계열의 «카테고리» 코드다(상품 식별자는
 * `branduid`). `GfDT` 는 요청마다 새로 발급되는 추적 토큰이다 — 실측에서 같은
 * URL 을 두 번 불러도 매번 달랐다.
 */
const NON_IDENTIFYING_PARAMS = new Set([
  // 메이크샵 계열(foretforet 등) 검색/정렬/카테고리
  "search",
  "sort",
  "xcode",
  "mcode",
  "scode",
  "gfdt",
  // 일반 추적
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "igshid",
  "srsltid",
]);

/**
 * Shopify 는 검색/컬렉션 문맥을 `_pos` `_psq` `_ss` `_v` `_fid` 처럼 밑줄로
 * 시작하는 파라미터에 싣는다 — 전부 listing 을 가리지 못한다.
 */
const isShopifyContextParam = (name: string) => name.startsWith("_");

/** 원본/후보가 같은 listing 인지 판단하기 위한 정규형 키. 만들 수 없으면 null. */
export function canonicalListingKey(rawUrl: string | null | undefined): { host: string; key: string } | null {
  if (!rawUrl) return null;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  // www 유무와 대소문자는 같은 사이트다.
  const host = url.host.toLowerCase().replace(/^www\./, "");
  if (!host) return null;

  // 경로: 대소문자와 끝 슬래시를 정규화한다(fragment 는 URL 파서가 이미 뗀다).
  const path = url.pathname.toLowerCase().replace(/\/+$/, "") || "/";

  // 값이 빈 파라미터(`sort=`, `scode=`)는 아무것도 가리지 않는다.
  const identifying = [...url.searchParams.entries()]
    .filter(([name, value]) => {
      if (value === "") return false;
      const lower = name.toLowerCase();
      return !NON_IDENTIFYING_PARAMS.has(lower) && !isShopifyContextParam(lower);
    })
    .map(([name, value]) => `${name.toLowerCase()}=${value}`)
    .sort();

  return { host, key: identifying.length > 0 ? `${path}?${identifying.join("&")}` : path };
}

/**
 * 후보가 원본과 «같은 listing» 인가.
 *
 * `true` 일 때만 후보에서 뺀다. 판단할 수 없으면 `false`(기존 동작 유지).
 */
export function isSelfReferenceCandidate(
  originUrl: string | null | undefined,
  candidateUrl: string | null | undefined,
): boolean {
  const origin = canonicalListingKey(originUrl);
  const candidate = canonicalListingKey(candidateUrl);
  if (!origin || !candidate) return false;
  return origin.host === candidate.host && origin.key === candidate.key;
}
