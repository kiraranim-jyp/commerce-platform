import { fetchWithDomainRateLimit } from "../rate-limit/domain-rate-limiter";
import { decodeHtmlEntities } from "./html-entities";
import { productFactsFromListing } from "./seller-facts";
import type { ComparisonCandidate } from "./types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-DISCOVERY-P5.2 Step 3(CPO 지시, 2026-10-07) — littleluna.co.kr
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 왜 이 판매처를 등록하는가(실측 2026-10-07, 추측 아님):
 *
 *   [메인스토리]  AW26MS185 - Bubble Sweatshirt - Grey Melange      ₩117,000
 *   [메인스토리]  AW26MS185 - Bubble Sweatshirt - Graystone         ₩117,000
 *   [메인스토리]  AW26MS185 - Bubble Sweatshirt - Rose Shadow       ₩117,000
 *   [메인스토리]  AW26MS185 - Bubble Sweatshirt - Chocolate Brown   ₩113,000
 *
 * 🔴 **상품명에 브랜드 품번을 그대로 적는다.** 그래서 `confirmBrandCodeInTitle` 이
 *    해외 「Product code AW26MS185」와 토큰 단위로 맞아떨어지고, 같은 품번의
 *    색상 변형 4건이 한 자리에 모인다 — 「동일상품」과 「같은 모델 다른 색상」을
 *    실제 데이터로 가를 수 있는 유일한 국내 판매처다(포레포레는 자체코드
 *    `MA26KASST…` 만 적고, looxloo 는 `75A7D-415-16` 만 적는다).
 *
 * ── 검색어는 한글만 받는다 ──────────────────────────────────────────────────
 * 실측: `메인스토리` → 상세링크 12건 · `Main Story bubble sweatshirt`(영문) → 0건.
 * 🔴 이 사실을 어댑터가 «보정하지 않는다». 영문 질의가 0건이면 index.ts 의
 *    brand-alias 폴백이 한글로 재검색하는 기존 경로가 그대로 작동한다 — 여기서
 *    검색어를 번역하면 그 경로와 둘이 겹쳐 어느 쪽이 결과를 냈는지 알 수 없게 된다.
 *
 * ── 읽는 자리(전부 실측 확인) ───────────────────────────────────────────────
 *  · 블록      `<li class="xans-record-">`
 *  · 상품명    `<p class="name "><a href="…"><span …>[메인스토리]  AW26MS185 - …</span>`
 *  · 가격      `<p class="price  ">113,000원`
 *  · 브랜드    `<div class="ds_list_brand …"><a …>MAIN STORY</a>`
 *  · 품절      `<span class="soldOut">SOLD OUT</span>`  ← 실측 4건 모두 품절이었다
 *  · 이미지    `<img src="//littleluna.co.kr/web/product/medium/…">`
 *
 * 🔴 **자체 상품코드 칸이 목록에 없다.** 그래서 `sellerSku` 는 null 이다 — 지어내지
 *    않는다. 품번은 제목에서 «확인» 되는 것이고 그 일은 어댑터가 아니라
 *    `confirmBrandCodeInTitle` 이 한다(seller-facts.ts 주석의 규칙 그대로:
 *    어댑터는 `brandModelCode` 를 채우지 않는다).
 */
const DOMAIN = "littleluna.co.kr";
const FETCH_TIMEOUT_MS = 10000;
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** 사이트별 실측 한도. 다른 국내 어댑터와 같은 값(상위 5건)을 쓴다 — 이 숫자가
 *  달라지면 판매처마다 다른 깊이로 보게 되어 비교가 불공정해진다. */
const MAX_CANDIDATES = 5;

const ITEM_SPLIT_RE = /<li class="xans-record-">/;
/** 상품명은 `<p class="name …">` 안의 `<a href>` + 가장 안쪽 텍스트다. 썸네일의
 *  `<img alt>` 에도 같은 문구가 있지만 그쪽은 같은 블록에 두 번 나오므로(medium /
 *  tiny) 이름 블록을 기준으로 삼는다. */
const NAME_BLOCK_RE = /<p class="name[^"]*">\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/;
const PRICE_RE = /<p class="price\s*">\s*([0-9,]+)\s*원/;
const BRAND_RE = /<div class="ds_list_brand[^"]*"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/;
const SOLDOUT_RE = /<span class="soldOut">/;
const IMG_RE = /<img src="(\/\/littleluna\.co\.kr\/web\/product\/[^"]+)"/;

/** 태그를 벗기고 엔티티를 풀어 상품명 한 줄을 만든다. 🔴 공백을 하나로 줄이는 것은
 *  표기 정리가 아니라 필수다 — 실측 원문이 `[메인스토리]  AW26MS185`(공백 둘)인데
 *  그대로 두면 토큰 분리는 문제없지만 저장되는 상품명이 화면에서 어긋나 보인다. */
function cleanName(raw: string): string {
  return decodeHtmlEntities(raw.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

function parsePrice(raw: string | undefined): number | null {
  if (!raw) return null;
  const amount = Number(raw.replace(/[^0-9]/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export async function searchLittleluna(query: string): Promise<ComparisonCandidate[]> {
  const url = `https://${DOMAIN}/product/search.html?keyword=${encodeURIComponent(query)}`;
  const response = await fetchWithDomainRateLimit(url, {
    headers: { Accept: "text/html", "User-Agent": CHROME_UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`littleluna search ${response.status}`);

  const html = await response.text();
  const candidates: ComparisonCandidate[] = [];

  for (const block of html.split(ITEM_SPLIT_RE).slice(1)) {
    if (candidates.length >= MAX_CANDIDATES) break;
    const nameMatch = NAME_BLOCK_RE.exec(block);
    if (!nameMatch) continue;
    const title = cleanName(nameMatch[2]);
    if (!title) continue;

    const href = nameMatch[1];
    const amount = parsePrice(PRICE_RE.exec(block)?.[1]);
    const rawBrand = BRAND_RE.exec(block)?.[1]?.trim();
    const brand = rawBrand ? decodeHtmlEntities(rawBrand) : undefined;
    const img = IMG_RE.exec(block)?.[1];

    candidates.push({
      title,
      url: href.startsWith("http") ? href : `https://${DOMAIN}${href}`,
      price: amount ? { amount, currency: "KRW" } : null,
      // 🔴 정가 칸(`<p class="custom">`)은 실측에서 항상 `0원` 이었다 — 할인 전 가격이
      //    아니라 «미사용 칸» 이다. 0 을 정가로 올리면 화면이 100% 할인을 말한다.
      regularPrice: null,
      imageUrl: img ? `https:${img}` : null,
      confidence: 0,
      brand,
      // 🔴 목록에 자체 상품코드 칸이 없다 — 없는 것을 지어내지 않는다.
      sku: undefined,
      soldOut: SOLDOUT_RE.test(block),
      facts: productFactsFromListing({ title, url: href, brand, imageUrl: img ? `https:${img}` : null }),
    });
  }

  return candidates;
}
