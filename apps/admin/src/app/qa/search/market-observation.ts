/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵 SEARCH-PROVIDER-06 QA — **검색 결과 URL 의 시장 «관측»**(순수 · 네트워크 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **판정이 아니다.** 운영 시장 분류 owner 는 `classifyCandidateMarket` 이고 그 함수는
 *    **가격과 통화** 를 요구한다 — 검색 결과에는 URL 과 제목뿐이라 **그 함수를 쓸 수 없다**.
 *    그래서 여기서는 **URL 단계에서 보이는 것만** 적는다.
 *
 * ── 🔴 WU-019R 이 남긴 함정을 그대로 반영한다 ──────────────────────────────
 * ```
 * 「등록부에 있다」 ≠ 「국내 시장이다」 — `bobochoses.com` 은 국내 등록부에 있는데
 * 그 후보의 가격이 **EUR** 였다(실측). 그래서 등록부 소속을 **KR 로 단정하지 않고**
 * `.kr` TLD 와 **갈라서** 적는다. 🔴 둘을 한 숫자로 합치지 않는다.
 * ```
 */

/** 🔴 **원상품 브랜드 공식몰** — 「판매처를 찾았다」로 세면 안 되는 자리다. */
export const ORIGIN_BRAND_HOSTS = ["bobochoses.com", "main-story.com"] as const;

/**
 * 🟢 운영 국내 등록부(`domestic_price_sources.domain`) 실측 스냅샷(2026-10-27 · 34 도메인).
 * 🔴 **새 목록을 지어내지 않았다** — DB 에서 읽은 값 그대로다.
 * 🔴 그리고 이 소속은 **시장 증거로 단정하지 않는다**(위 함정).
 */
export const DOMESTIC_REGISTRY_HOSTS = [
  "11st.co.kr",
  "29cm.co.kr",
  "auction.co.kr",
  "bobochoses.com",
  "chocoel.co.kr",
  "chouchouenfant.kr",
  "cjonstyle.com",
  "coconjennie.com",
  "coupang.com",
  "danawa.com",
  "deuxbebe.com",
  "donokids.com",
  "enuri.com",
  "foretforet.com",
  "gmarket.co.kr",
  "gsshop.com",
  "hmall.com",
  "karymarket.com",
  "kidikidi.elandmall.co.kr",
  "kream.co.kr",
  "littleluna.co.kr",
  "looxloo.com",
  "lotteon.com",
  "musinsa.com",
  "nokimore.com",
  "ocokorea.com",
  "rulii.co.kr",
  "shopping.naver.com",
  "shoppinghow.kakao.com",
  "skysport.co.kr",
  "smartstore.naver.com",
  "ssfshop.com",
  "ssg.com",
  "wconcept.co.kr",
] as const;

/**
 * 🔴 **판매처가 아닌 자리** — 소셜·중고·일반 마켓플레이스·이미지 보드.
 * 🔴 「무관」으로 **단정** 하지 않는다. 이 목록은 **눈에 먼저 띄게 하는 표시** 일 뿐이고,
 *    최종 A/B/C/D 분류는 사람이 한다(CPO §7).
 */
const NOISE_HOST_RE =
  /(^|\.)(pinterest|facebook|twitter|x|instagram|youtube|tiktok|reddit|poshmark|depop|vinted|mercari|ebay|etsy|walmart|amazon|aliexpress|goat|stockx|grailed|tistory|blog|naver\.com|google)\./i;

export type MarketObservation = "KR_TLD" | "REGISTRY" | "ORIGIN_BRAND" | "NOISE" | "OTHER";

/** 🔴 **순서가 의미를 가진다** — 공식몰이 등록부에도 있으므로 공식몰을 먼저 가른다. */
export function observeMarket(host: string): MarketObservation {
  const h = host.replace(/^www\./, "").toLowerCase();
  if ((ORIGIN_BRAND_HOSTS as readonly string[]).includes(h)) return "ORIGIN_BRAND";
  if (h.endsWith(".kr")) return "KR_TLD";
  if ((DOMESTIC_REGISTRY_HOSTS as readonly string[]).includes(h)) return "REGISTRY";
  if (NOISE_HOST_RE.test(`${h}.`)) return "NOISE";
  return "OTHER";
}

export const MARKET_LABEL: Record<MarketObservation, string> = {
  KR_TLD: "🇰🇷 .kr",
  REGISTRY: "🇰🇷? 국내 등록부",
  ORIGIN_BRAND: "🏷 브랜드 공식몰",
  NOISE: "⚠ 판매처 아님",
  OTHER: "🌎 그 외",
};
