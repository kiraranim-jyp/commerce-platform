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

  const identifying = identifyingParams(url);
  return { host, key: identifying.length > 0 ? `${path}?${identifying.join("&")}` : path };
}

/**
 * 🔵 SELF-REFERENCE-NARROW-FIX-04 — **식별 파라미터 판정의 owner 하나.**
 *
 * 🔴 위 `canonicalListingKey` 가 쓰던 **그 표현식을 그대로 꺼낸 것** 이다 —
 *    새 규칙 0 · 새 분류 0 · 필터/map/sort 순서 동일.
 * 🟢 자기참조 술어가 **같은 함수를 재사용** 하므로 두 곳이 서로 다른 파라미터
 *    규칙을 갖지 않는다(의미 분기 금지).
 * 🔴 값이 빈 파라미터(`sort=`, `scode=`)는 아무것도 가리지 않는다.
 */
export function identifyingParams(url: URL): string[] {
  return [...url.searchParams.entries()]
    .filter(([name, value]) => {
      if (value === "") return false;
      const lower = name.toLowerCase();
      return !NON_IDENTIFYING_PARAMS.has(lower) && !isShopifyContextParam(lower);
    })
    .map(([name, value]) => `${name.toLowerCase()}=${value}`)
    .sort();
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-009 C — **저장용 원본 URL 정규화.** 추적·검색 파라미터만 걷어낸다.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 왜 필요한가 — 실측(WU-008 · `B226AC117`):
 * ```
 * product_snapshots 에 **경로가 완전히 같은** 두 행이 있었다.
 *   bobochoses.co.jp/products/b226ac117-…?utm_source=chatgpt.com
 *   bobochoses.co.jp/products/b226ac117-…
 * 🔴 추적 파라미터 하나 때문에 같은 상품이 **별개 스냅샷** 으로 쌓였다.
 * ```
 *
 * 🔴🔴 **`canonicalListingKey` 를 쓰지 않는다** — 그 함수는 비교용 **key**(host+path)
 *    를 만들고 host/대소문자/목록 세그먼트까지 뭉갠다. 저장용 URL 은 **그대로 열려야**
 *    하므로 여기서는 **파라미터만** 손댄다.
 *
 * 🔴 **합치지 않는 것**(CPO 확정 — 시장은 보존한다):
 * ```
 * host  유지 — bobochoses.co.jp ↔ bobochoses.com 은 **다른 스토어** 다
 * 경로  유지 — /en-kr/products/X ↔ /products/X 는 **다른 시장** 이다
 * 그 외 파라미터 유지 — ?variant= · ?product_no= · ?branduid= 는 식별 정보다
 * 🔴 대소문자·끝 슬래시도 건드리지 않는다. URL 을 «여는» 용도이기 때문이다.
 * ```
 *
 * 🟢 제거 대상은 이 파일이 **이미 갖고 있는 두 집합** 뿐이다 —
 *    `NON_IDENTIFYING_PARAMS`(추적/검색) + `isShopifyContextParam`(밑줄 문맥).
 *    🔴 새 규칙을 만들지 않았다.
 *
 * 판단할 수 없으면(상대 경로·비 HTTP 등) **입력을 그대로** 돌려준다 — 저장을 막지 않는다.
 */
export function canonicalizeProductUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return rawUrl;

  let removed = 0;
  for (const name of [...url.searchParams.keys()]) {
    const lower = name.toLowerCase();
    if (NON_IDENTIFYING_PARAMS.has(lower) || isShopifyContextParam(lower)) {
      url.searchParams.delete(name);
      removed += 1;
    }
  }
  /* 🔴 제거한 것이 없으면 **입력 문자열을 그대로** 돌려준다 — URL 재직렬화가
     인코딩을 미묘하게 바꿔 기존 행과 어긋나는 것을 막는다. */
  if (removed === 0) return rawUrl;
  /* 🔴 fragment 는 남긴다(서버에 전달되지 않는 값이라 중복의 원인이 아니고,
     지우면 셀러가 붙여넣은 URL 과 눈에 보이게 달라진다). */
  return url.toString();
}

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SELF-REFERENCE-NARROW-FIX-04 — **같은 판매처 · 같은 상품 · 같은 식별자**
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 실측이 구멍을 드러냈다(RAW-CANDIDATE-CROSSCHECK-02 · 스냅샷 `9c07b07a`):
 * ```
 * 원상품  www.junioredition.com/en-kr/collections/4-years/products/booty-ghosts-long-sleeve-…?utm_source=…
 * 후보        junioredition.com            /products/booty-ghosts-long-sleeve-…
 * ⟹ 원본이 **자기 자신** 을 SAME·STRONG_IDENTIFIER·tier EXACT·GBP 37 후보로 올렸다
 *    (그 GBP 37 은 `price_observations` 가 `SELLER_ORIGIN` 으로 기록한 **원본 가격** 이다)
 * ```
 *
 * 🔴🔴🔴 **1차 구현이 과다 제외를 만들어 CPO 가 STOP 시켰다. 그 기록을 남긴다.**
 * ```
 * 1차(STOP)  host + handle 만 비교 ⟹ `?variant=1` ↔ `?variant=2` 가 **같은 listing**
 *            으로 묶였다(회귀 11건). 🔴 `canonicalListingKey` 가 **의도적으로 보존하는**
 *            식별 파라미터를 버린 것이다(P0-A.29-E 가 그 구분에 의존한다)
 * 2차(채택)  host + handle + **식별 파라미터** 셋을 모두 본다
 * ```
 *
 * 🔴 **CPO 확정 정책(2026-10-31)** — 「locale 차이는 그 자체로 자기참조를 **해제하는
 *    조건이 아니다**. 단 식별 파라미터는 **보존** 한다.」
 * 🔴 `canonicalListingKey` **한 글자도 바뀌지 않았다** ⟹ 시장 분류(KR/OVERSEAS) ·
 *    Identity · Evidence · `priceTier` · 가격 정책 **영향 0**.
 * 🔴 **host 가 같다는 이유만으로 제외하지 않는다** — handle 이 같아야 한다.
 *    같은 판매처의 **다른 상품** 은 정상 후보다(CPO 명시).
 * 🔴 handle 을 **지어내지 않는다** — `/products/<handle>` 이 없으면 `null` 이고
 *    그러면 이 술어는 **발화하지 않는다**(기존 동작 유지).
 */
export function productHandle(
  rawUrl: string | null | undefined,
): { host: string; handle: string; params: string } | null {
  if (!rawUrl) return null;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.host.toLowerCase().replace(/^www\./, "");
  if (!host) return null;
  /**
   * 🔴 `/products/<handle>` 의 **마지막** `products` 세그먼트 뒤를 읽는다.
   *    로케일(`/en-kr/`)·목록(`/collections/<c>/`)이 앞에 몇 개 붙어 있어도 handle 은
   *    같은 자리에 있다 — 그래서 **경로를 정규화하지 않고도** 비교된다(규칙 0).
   * 🔴 handle 뒤에 세그먼트가 더 있으면 상품 페이지가 아니다 ⟹ `null`.
   */
  const segments = url.pathname.toLowerCase().replace(/\/+$/, "").split("/").filter(Boolean);
  const at = segments.lastIndexOf("products");
  if (at < 0 || at !== segments.length - 2) return null;
  const handle = segments[segments.length - 1];
  if (!handle) return null;
  /** 🔵 **owner 를 재사용한다** — `canonicalListingKey` 와 같은 파라미터 규칙이다. */
  return { host, handle, params: identifyingParams(url).join("&") };
}

/**
 * 🔵 같은 판매처의 **같은 상품 listing** 인가(로케일·목록 경로는 무시 · 식별자는 보존).
 * 🔴 **자기참조 판정에서만** 쓴다 — 시장 분류에 쓰지 않는다.
 */
export function isSameListingReference(
  originUrl: string | null | undefined,
  candidateUrl: string | null | undefined,
): boolean {
  const origin = productHandle(originUrl);
  const candidate = productHandle(candidateUrl);
  if (!origin || !candidate) return false;
  return (
    origin.host === candidate.host &&
    origin.handle === candidate.handle &&
    /** 🔴🔴 이 줄이 1차 STOP 의 원인을 닫는다 — `?variant=` 가 다르면 다른 listing 이다. */
    origin.params === candidate.params
  );
}

/**
 * 후보가 원본과 «같은 listing» 인가.
 *
 * `true` 일 때만 후보에서 뺀다. 판단할 수 없으면 `false`(기존 동작 유지).
 *
 * 🔵 축이 **둘** 이다. 🟢 호출부 **여섯** 이 이 함수 하나를 쓰므로 여기 더하면
 *    candidate list 와 가격 **둘 다** 에서 빠진다(복제 0 · 새 배선 0 · 호출부 변경 0).
 */
export function isSelfReferenceCandidate(
  originUrl: string | null | undefined,
  candidateUrl: string | null | undefined,
): boolean {
  const origin = canonicalListingKey(originUrl);
  const candidate = canonicalListingKey(candidateUrl);
  if (origin && candidate && origin.host === candidate.host && origin.key === candidate.key) return true;
  /** 🔵 CPO ⒝ — 로케일/목록이 달라도 **같은 판매처·같은 상품·같은 식별자** 면 자기참조다. */
  return isSameListingReference(originUrl, candidateUrl);
}
