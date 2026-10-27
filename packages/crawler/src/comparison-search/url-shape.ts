import { extractShopifyHandle, extractShopifyLocalePrefix } from "../shopify-product-json";
/** 🟢 WU-017-E2E — 추적/검색 파라미터만 걷어 내는 **기존** 정규화기(새 규칙 0). */
import { canonicalizeProductUrl } from "./self-reference";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-02b ⑥(CPO 지시, 2026-10-11) — **coupling 의 «방향» 을 바로잡는다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 이 두 함수(`classifyUrlShape` · `toCrawlerUrl`)는 `discovery-benchmark/
 * url-resolver.ts` 에 있었다. 🔴 그런데 Production 인
 * `comparison-search/product-url-facts.ts` 가 그것을 **직접 import** 하고 있었다.
 *
 * 그래서 `discovery-benchmark/types.ts` 머리 주석의
 *
 *     「Production 런타임이 여기 있는 것을 하나도 import 하지 않는다」
 *
 * 는 **거짓이었다.** 그리고 그 주석이 근거로 댄
 * `__tests__/no-production-coupling.test.ts` 는 **존재하지 않는 파일**이다.
 * 실제 가드(`discovery-benchmark.test.ts`)는 `index.ts` 의 **export 만** 보므로
 * 이 import 를 막을 수 없었다 — 가드가 자기보다 나중에 생긴 경로를 몰랐다.
 *
 * 🔴 **benchmark 를 Production 에 연결해서 해결하지 않는다.** 반대로 한다:
 *    URL 모양 판별은 애초에 Production 로직이므로 Production 이 **소유** 하고,
 *    benchmark 가 그것을 쓴다. 방향이 benchmark → Production 하나로 고정된다.
 *
 * 🔴 **로직은 한 줄도 바뀌지 않았다.** 정규식·분기 순서·반환값 전부 그대로다
 *    (아래 주석도 원문 그대로 옮겼다). `url-resolver.ts` 가 이 둘을 re-export
 *    하므로 기존 import 경로도 그대로 동작한다.
 */

/**
 * URL 한 건의 **최종 분류**. 🔴 정확히 하나다.
 *
 * 실측 분포(2026-10-07, 표본 10 · 일반 웹검색):
 *     PRODUCT_PAGE 1 · LISTING_PAGE 7 · NOT_FOUND 1 · UNUSABLE 1(302→홈)
 */
export type UrlShape = "PRODUCT_PAGE" | "LISTING_PAGE" | "UNKNOWN_PAGE" | "NOT_FOUND" | "UNUSABLE";

/**
 * 🔴 **상품 판별이 목록 판별보다 먼저다.** Shopify 는 목록 «아래» 에 상품을 둔다 —
 *    실측 URL: `/en-kr/collections/misha-and-puff-sale/products/voyage-dress-...`
 *    (저장소 scripts/register-voyage-dress-live.ts 에 그대로 있다). 순서를 뒤집으면
 *    진짜 상품 URL 이 LISTING_PAGE 로 버려진다.
 */
/**
 * 🔵🔵 **DISCOVERY-SEARCH-PROVIDER-02 — `p` 를 «하나» 더했다**(2026-10-27).
 *    실측: `answear.ro/p/bobo-choses-…-**b226ac010**-1843935` 가 진짜 상품 상세인데
 *    `UNKNOWN_PAGE` 로 떨어졌다(🔴 그 URL 에 **우리 품번이 그대로** 있었다).
 * 🔴 **범용 shortcut 이 아니다** — 뒤의 `\/[^/]+` 가 **슬러그를 요구** 하므로
 *    `/p` · `/p/` 는 상품이 되지 않고, `NON_PRODUCT_FILE` 이 **먼저** 돌아
 *    `/p/index.html` 도 걸러진다. 기존 `dp`(Amazon) · `itm`(eBay)과 **같은 종류** 다.
 */
const PRODUCT_PATH = /(?:^|\/)(?:products|product|dp|itm|goods|p)\/[^/]+/i;
/** 지시서 §2-A 가 `/...html` 을 상품 후보로 넣었다(실측 근거: wonderforkids 의
 *  `main-story-bubble-sweatshirt-grey-melange-fleece.html`). 🔴 다만 `.html` «자체» 는
 *  상품의 증거가 아니다 — 아래 제외 목록이 없으면 `about.html`·`index.html` 까지
 *  상품이 되고, 크롤러가 회사소개 페이지를 상품으로 읽는다. */
const PRODUCT_SUFFIX = /\.html?$/i;
/** 🔴 `.html` 이지만 상품일 수 없는 파일명. 모르는 이름은 여기 넣지 «않는다» —
 *  넣으면 진짜 상품을 버린다. 확실한 것만 적는다. */
const NON_PRODUCT_FILE =
  /(?:^|\/)(?:index|default|home|main|about|about-?us|contact|contact-?us|terms|privacy|policy|faq|help|login|signin|register|cart|checkout|sitemap|search|category|categories|collection|collections|list|brand|brands)\.html?$/i;
/**
 * 🔴 `/shop/`·`/search/` 는 목록이다. 단 위 상품 패턴이 먼저 걸리면 상품이다.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 **DISCOVERY-SEARCH-PROVIDER-02 — 세그먼트 «경계» 를 넣었다**(2026-10-27)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 전에는 끝이 `\/?`(**선택**)이라 토큰이 **세그먼트 일부만 먹어도 매치** 됐다.
 * 실측 피해:
 * ```
 * /shopping/kids/…-item-37035483.aspx  → `shop` 매치   🔴 상품 상세가 LISTING_PAGE
 * /clothing/mens/shirt                 → **`c` 매치**   🔴🔴 c 로 시작하는 «모든» 세그먼트
 * /cart/view · /contact                → `c` 매치       🔴 같은 이유
 * ```
 * 🔴 즉 `c` 토큰 때문에 **「c 로 시작하는 모든 경로 세그먼트」가 목록** 이었다.
 *    Apify PoC 가 드러냈지만 **Apify 와 무관한 전역 결함** 이다(WU-073 이 「양방향
 *    오류」로 기록해 둔 바로 그 자리 · WU-052 HOLD).
 *
 * 🟢 고친 것은 **끝의 `\/?` → `(?:\/|$)`** 하나다. 토큰 목록은 **한 글자도 바꾸지
 *    않았다** ⟹ 「진짜 목록」의 판정은 그대로이고(M2 전수 계약), 사라지는 것은
 *    **부분문자열 매치뿐** 이다.
 * 🔴 `includes("shop")` 같은 부분문자열 판정으로 **되돌아가지 않는다**.
 */
const LISTING_PATH = /(?:^|\/)(?:collections|collection|category|categories|search|shop|brands?|c)(?:\/|$)/i;

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵 **DISCOVERY-SEARCH-PROVIDER-13 — `-item-{id}.aspx` 상품 상세**(2026-10-27)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * SP-12 실측 — 검색 입구 손실(비상품 60건) 중 가장 큰 덩어리가 이 모양이었고,
 * raw fetch 에서 **페이지가 스스로 `@type: Product` 를 적었다**:
 * ```
 * /fi/shopping/kids/bobo-choses-booty-ghost-print-long-sleeve-t-shirt-item-37035483.aspx
 * /shopping/kids/bobo-choses-curious-turnip-…-item-33844474.aspx        (로케일 없음)
 * ```
 * 🔴 **`.aspx` 전체를 상품으로 보지 않는다**(CPO 명시 금지) · 🔴 `shopping` **포함만으로도**
 *    보지 않는다 · 🔴 `og:type=product` 를 분류 근거로 **역수입하지 않는다**.
 * 🟢 요구하는 것은 **셋 동시** 다 — `shopping` **세그먼트** · 그 아래 슬러그 ·
 *    **`-item-{숫자}.aspx` 로 끝남**. 목록/카테고리는 그 꼬리를 갖지 않는다.
 *
 * 🔴🔴 **이 분류가 후보를 «늘린다» 고 적지 않는다** — SP-13 실측에서 그 도메인은
 *    Chrome UA 로도 **50/50 전부 HTTP 403** 이었다. 고쳐지는 것은 **분류의 정확성** 이고
 *    실제 회수는 그 사이트의 차단 정책에 달려 있다(간헐적 · 측정일 기준).
 */
const PRODUCT_ITEM_ID_SUFFIX = /(?:^|\/)shopping\/[^?#]+-item-\d+\.aspx$/i;

export function classifyUrlShape(url: string): UrlShape {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return "UNUSABLE";
  }
  /**
   * 🔴 MI-DISCOVERY-P5.4-B.1(2026-10-07) — **상품 경로 안에 목록 파일이 들어 있다.**
   *
   * 실측: Cafe24 의 목록 URL 이 `/product/list.html?cate_no=110` 이다. `PRODUCT_PATH`
   * 가 `product/` + `list.html` 에 그대로 매칭돼 이 URL 이 PRODUCT_PAGE 로 올라갔고,
   * 그래서 `factsFromProductUrl` 이 목록 페이지에 HTTP 를 썼다(실측으로 걸렸다 —
   * NOT_PRODUCT_URL 이어야 할 것이 NO_FACTS 로 돌아왔다).
   *
   * 🔴 새 어휘를 만들지 않는다. 아래 분기가 이미 들고 있는 `NON_PRODUCT_FILE`
   *    (`list`·`search`·`category`… 포함)을 **먼저** 본다. 두 분기가 같은 목록을
   *    쓰므로 한쪽만 고쳐져 갈릴 일이 없다.
   */
  if (NON_PRODUCT_FILE.test(pathname)) return "UNKNOWN_PAGE";
  if (PRODUCT_PATH.test(pathname)) return "PRODUCT_PAGE";
  /**
   * 🔵 SP-13 — `-item-{숫자}.aspx` 상품 상세.
   *
   * 🔴🔴 **순서는 이 줄의 계약이 «아니다».** 1차 주석에 「`LISTING_PATH` 보다 먼저 본다」고
   *    적었는데 **음성 대조(M6)가 그것을 반증했다** — 이 줄을 `LISTING_PATH` 뒤로 옮겨도
   *    **아무 테스트도 깨지지 않는다**. 이유: SPRINT-02 가 `LISTING_PATH` 끝을
   *    `(?:\/|$)` 로 바꿔서 `shopping` 세그먼트가 `shop` 토큰에 **더는 걸리지 않는다**.
   * 🟢 그래서 위치는 **읽기 좋은 자리** 일 뿐이고, 사실을 주석에 그대로 적는다.
   * 🟢 `NON_PRODUCT_FILE` 은 이미 지나왔다 ⟹ `search.aspx` 류는 여기까지 오지 않는다.
   */
  if (PRODUCT_ITEM_ID_SUFFIX.test(pathname)) return "PRODUCT_PAGE";
  if (PRODUCT_SUFFIX.test(pathname)) {
    // 🔴 확실히 상품이 아닌 파일명은 목록 쪽으로도 올리지 않는다 — «모른다» 가 답이다.
    return NON_PRODUCT_FILE.test(pathname) ? "UNKNOWN_PAGE" : "PRODUCT_PAGE";
  }
  if (LISTING_PATH.test(pathname)) return "LISTING_PAGE";
  // 🔴 루트(`/`)도, 모르는 모양도 PRODUCT 로 올리지 않는다. 「모른다」를 남긴다.
  return "UNKNOWN_PAGE";
}

export interface CrawlerUrlResult {
  crawlerUrl: string | null;
  localeNormalized: boolean;
  dedupeKey: string | null;
}

/**
 * 🔴 **검색 URL 을 그대로 가격검증 입력으로 쓰지 않는다**(P1.1 §3).
 *
 * 실측: `junioredition.com/products/...` 를 열면 `/en-kr/products/...` 로
 * 리다이렉트된다. 기존 크롤러는 로케일 프리픽스가 있으면 «그 로케일의 가격» 을
 * 믿는 분기를 탄다 — KR 방문자가 보는 KRW 가 들어오고, 그건 원산지 기준가가
 * 아니다. 그래서 origin + handle 로 **재조립** 해 로케일을 떼어 낸다.
 *
 * 🔴 기존 크롤러의 가격 로직을 고치지 «않는다». 보호는 이 adapter 경계에서 한다.
 */
export function toCrawlerUrl(finalUrl: string, shape: UrlShape): CrawlerUrlResult {
  if (shape !== "PRODUCT_PAGE") return { crawlerUrl: null, localeNormalized: false, dedupeKey: null };
  let origin: string;
  let pathname: string;
  let search: string;
  try {
    const parsed = new URL(finalUrl);
    origin = parsed.origin;
    pathname = parsed.pathname;
    search = parsed.search;
  } catch {
    return { crawlerUrl: null, localeNormalized: false, dedupeKey: null };
  }

  const handle = extractShopifyHandle(finalUrl);
  if (handle) {
    const hadLocale = extractShopifyLocalePrefix(finalUrl) !== "";
    return {
      // 🔴 로케일도, 목록 경로도, 쿼리스트링도 떼어 낸 «정규» 상품 URL.
      crawlerUrl: `${origin}/products/${handle}`,
      localeNormalized: hadLocale,
      // 판매처(origin)를 키에 넣는다 — 같은 상품이라도 판매처는 «합치지 않는다».
      dedupeKey: `${origin}|${handle}`,
    };
  }

  /**
   * 🔴🔴 WU-017-E2E 실측 — **비-Shopify 에서 쿼리를 통째로 떼면 상품 페이지를 못 읽는다.**
   * ```
   * foretforet.com/shop/shopdetail.html?branduid=10226592  → shopdetail.html → 89바이트
   * deuxbebe.com/product/detail.html?product_no=8021&…     → detail.html     → 응답 없음
   * ```
   * 두 URL 은 **직접 열면 200 이고 `og:title` 도 정상** 이다(243,951B / 212,603B 실측).
   * 🔴 국내 Cafe24·메이크샵 계열은 **상품 식별자가 쿼리스트링에 있다** — 이 한 줄 때문에
   *    「국내 샵 상품 URL 을 줘도 사실을 읽지 못한다」가 됐다(GT 가 진짜 동일상품인
   *    쌍 2/2 실패 · WU-017-E2E).
   *
   * 🟢 `canonicalizeProductUrl`(WU-009C)을 통과시킨다 — 추적/검색 문맥 파라미터만 걷히고
   *    `?branduid=`·`?product_no=`·`?variant=` 는 **남는다**. 🔴 **새 규칙 0** — 그 파일이
   *    이미 「그 셋은 식별 정보다」라고 적어 뒀다. 🔴 utm 으로 dedupe 가 쪼개지는 함정도
   *    그 함수가 막는다(메모 shared-normalizer-has-two-axes).
   *
   * 🔴 **Shopify 분기는 한 글자도 바꾸지 않았다** — 그쪽 로케일 제거는 「원산지 기준가」를
   *    지키는 **명시적 계약** 이다(discovery-benchmark.test.ts:123-125 가 이유까지 적어 뒀다).
   */
  const canonical = canonicalizeProductUrl(`${origin}${pathname}${search}`);
  return {
    crawlerUrl: canonical,
    localeNormalized: false,
    dedupeKey: `${origin}|${canonical.slice(origin.length)}`,
  };
}
