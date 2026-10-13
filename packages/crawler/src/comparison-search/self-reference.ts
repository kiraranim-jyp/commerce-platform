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

  /**
   * 경로: 대소문자와 끝 슬래시를 정규화한다(fragment 는 URL 파서가 이미 뗀다).
   *
   * 🔴🔴 MI-GEMINI-SELF-REFERENCE-CLOSE-008A(2026-10-13) — **Shopify 경로 접두사**.
   *    실측(WU-4 ON-axis)에서 같은 샵·같은 상품이 자기참조를 통과해 `tier EXACT`
   *    를 받았다:
   *      원상품  junioredition.com/collections/bobo-choses/products/booty-ghosts-…
   *      후보    junioredition.com/products/booty-ghosts-…
   *      원상품  junioredition.com/en-kr/collections/pepe-shoes/products/lulu-t-bar-…
   *      후보    junioredition.com/products/lulu-t-bar-…
   *    누출 4/24(17%). 국내 경로에서는 원상품 host 와 국내 샵 host 가 겹치지 않아
   *    **잠복** 했고, Gemini 가 웹 전체를 보면서 원상품 host 자체를 후보로 물어와
   *    **발화** 했다.
   *
   * 🟢 이 WU 가 닫는 범위는 **목록 세그먼트 하나** 이고 그것으로 종료됐다.
   *    로케일은 아래 이유로 **건드리지 않는다**(CPO 확정 정책).
   */
  /** 🔴 **목록(collection) 세그먼트만** 떼어 낸다 — 로케일은 건드리지 않는다.
   *
   * Shopify 는 같은 상품을 `/products/<p>` 와 `/collections/<c>/products/<p>` 둘로
   * 서빙한다. 뒤의 `<c>` 는 **어느 목록을 거쳐 왔는가** 일 뿐 상품을 가리지 않는다
   * (handle 이 샵 안에서 유일하다). 그래서 둘은 **같은 listing** 이다.
   *
   * 🟢🟢 **로케일 접두사는 떼지 않는다 — CPO 확정 제품 정책(2026-10-13).**
   *    `/en-kr/products/X` ↔ `/products/X` 는 **다른 시장** 이므로 자기참조가 아니다.
   *    `mi-real-05-self-reference.test.ts:153` 의 「경로가 다르면 **(시장 전환 포함)**
   *    제외하지 않는다」가 **제품 정책을 직접 말하는 계약** 이고 그것이 이긴다.
   *    🔴 `toCrawlerUrl`(url-shape.ts:119) 의 「로케일 제거」 주석은 **URL 정규화
   *       구현의 성격** 을 설명할 뿐이다 — 그 주석을 근거로 위 계약을 뒤집지 않는다.
   *    🔴 그러므로 로케일이 섞인 쌍은 **결함이 아니다.** 「누출」로 세지 않는다.
   *
   * 🔴 `products/` 가 뒤따르지 않으면 떼지 않는다 — `/collections/aaa` 같은 목록
   *    URL 이 `/` 로 뭉개지면 서로 다른 목록이 같은 key 가 된다(collision).
   * 🔴 쿼리 로직은 한 글자도 건드리지 않는다 — `?variant=` 구분이 그대로 유지된다
   *    (P0-A.29-E 가 그 구분에 의존한다).
   */
  const rawPath = url.pathname.toLowerCase().replace(/\/+$/, "") || "/";
  const path = rawPath.replace(/\/collections\/[^/]+(?=\/products\/[^/]+)/, "") || "/";

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
