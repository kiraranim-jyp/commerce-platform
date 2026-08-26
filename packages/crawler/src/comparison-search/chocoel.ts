import { fetchWithDomainRateLimit } from "../rate-limit/domain-rate-limiter";
import { decodeHtmlEntities } from "./html-entities";
import type { ComparisonCandidate } from "./types";

const FETCH_TIMEOUT_MS = 10000;
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const DOMAIN = "chocoel.co.kr";

/**
 * N-4.18-O STEP O-2/O-3(대표님 지시, 2026-08-26) — 실측 확인(2026-08-26, curl로
 * 직접 확인, 서로 다른 키워드 3개 "니트"/"바지"/"셔츠" 각 16건씩 총 48건).
 * RULII/LOOXLOO와 같은 Cafe24 계열이지만 세부 마크업이 다르다:
 *  - 목록 상품 블록 wrapper는 `class="item xans-record-"`가 아니라
 *    `class="list_item xans-record-"`.
 *  - 가격 필드는 `li rel="판매가"`가 아니라 `li name="판매가"`(rel이 아니라
 *    name 속성 — RULII/LOOXLOO 코드를 그대로 재사용하면 못 잡는다).
 *  - 할인판매가 값 뒤에 할인율(`<span>60%</span>`)이 같은 span 안에 중첩돼
 *    있어서(`14,900 <span>60%</span>`) "마지막 span 텍스트" 방식(RULII)을
 *    쓰면 "60%"를 가격으로 잘못 뽑는다 — 그래서 이 도메인은 ":</strong>"
 *    바로 뒤 첫 <span>의 숫자만 캡처하는 별도 정규식을 쓴다.
 *  - 목록 마크업에 브랜드/SKU 필드 자체가 없다(상품색상만 있음) — 실측
 *    48건 전부 확인, 억지로 추측해서 채우지 않는다(undefined 유지).
 */
const ITEM_SPLIT_RE = /<li id="anchorBoxId_\d+" class="list_item xans-record-">/;
const NAME_BLOCK_RE = /<p class="name">([\s\S]*?)<\/p>/;
const NAME_HREF_RE = /<a href="([^"]+)"/;
const NAME_SPAN_RE = /<span[^>]*>([^<]*)<\/span>/;
const IMG_RE = /<img src="([^"]+)" id="eListPrdImage/;

function extractPriceField(block: string, label: string): string | null {
  const re = new RegExp(`<li name="${label}"[^>]*>[\\s\\S]*?:</strong>\\s*<span[^>]*>([0-9,]+)`);
  return re.exec(block)?.[1] ?? null;
}

function parsePrice(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9]/g, "");
  const amount = Number(cleaned);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

const DETAIL_SALE_PRICE_RE = /id="span_product_price_sale"[^>]*>\s*([0-9,]+)/;
const DETAIL_REGULAR_PRICE_RE = /id="span_product_price_text"[^>]*>\s*([0-9,]+)/;

export interface ChocoelProductPrice {
  price: { amount: number; currency: "KRW" } | null;
  available: boolean;
  salePriceKrw: number | null;
  originalPriceKrw: number | null;
  /**
   * N-4.18-O STEP O-5(대표님 지시: "RULII에서 확인한 품절 패턴을 CHOCO.EL에
   * 그대로 복사하지 않는다") — 실측 확인(2026-08-26): RULII의 품절 마커
   * (`<div class="infoArea"><span class="icon"><img ... alt="품절"`)를
   * CHOCO.EL 상세페이지에서 찾아봤지만, `class="infoArea"`는 이 도메인에서
   * 완전히 다른(훨씬 큰 sticky 컨테이너) 구조로 쓰이고, `alt="품절"` 문자열은
   * 현재 보고 있는 상품이 아니라 페이지 하단 "추천상품" 캐러셀의 다른 상품에
   * 딸린 마커였다(실제로 확인: product_no=1889 조회 중 alt="품절"이 나온
   * 곳은 캐러셀 안의 product_no=1526 항목). 옵션 <select>에도 품절 문구가
   * 없었다(테스트한 상품이 마침 재고 있음). 이 도메인의 진짜 품절 마커를
   * 확인하지 못했으므로 soldOut은 항상 null(판정 불가)로 둔다 — 실제
   * 품절 상품을 찾아 재확인하기 전까지 추측하지 않는다.
   */
  soldOut: null;
}

/** N-4.18-O STEP O-3 — domestic_product_links로 이미 연결된 특정 상품의 "지금"
 * 가격을 재조회한다(RULII와 동일 원리, 상세페이지 1건 재조회). */
export async function fetchChocoelProductPrice(url: string): Promise<ChocoelProductPrice> {
  const response = await fetchWithDomainRateLimit(url, {
    headers: { Accept: "text/html", "User-Agent": CHROME_UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) return { price: null, available: false, salePriceKrw: null, originalPriceKrw: null, soldOut: null };
  const html = await response.text();
  const sale = parsePrice(DETAIL_SALE_PRICE_RE.exec(html)?.[1] ?? null);
  const regular = parsePrice(DETAIL_REGULAR_PRICE_RE.exec(html)?.[1] ?? null);
  const amount = sale ?? regular;
  return amount
    ? { price: { amount, currency: "KRW" }, available: true, salePriceKrw: sale, originalPriceKrw: regular, soldOut: null }
    : { price: null, available: false, salePriceKrw: null, originalPriceKrw: null, soldOut: null };
}

export async function searchChocoel(query: string): Promise<ComparisonCandidate[]> {
  const url = `https://${DOMAIN}/product/search.html?keyword=${encodeURIComponent(query)}`;
  const response = await fetchWithDomainRateLimit(url, {
    headers: { Accept: "text/html", "User-Agent": CHROME_UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`CHOCO.EL search ${response.status}`);

  const html = await response.text();
  const blocks = html.split(ITEM_SPLIT_RE).slice(1);
  const candidates: ComparisonCandidate[] = [];

  for (const block of blocks) {
    if (candidates.length >= 5) break;
    const nameBlockMatch = NAME_BLOCK_RE.exec(block);
    if (!nameBlockMatch) continue;
    const nameBlock = nameBlockMatch[1];
    const hrefMatch = NAME_HREF_RE.exec(nameBlock);
    const rawTitle = NAME_SPAN_RE.exec(nameBlock)?.[1]?.trim();
    const title = rawTitle ? decodeHtmlEntities(rawTitle) : undefined;
    if (!title || !hrefMatch) continue;
    const href = hrefMatch[1];

    const salePrice = parsePrice(extractPriceField(block, "할인판매가"));
    const regularPrice = parsePrice(extractPriceField(block, "판매가"));
    const amount = salePrice ?? regularPrice;
    const img = IMG_RE.exec(block)?.[1];

    candidates.push({
      title,
      url: href.startsWith("http") ? href : `https://${DOMAIN}${href}`,
      price: amount ? { amount, currency: "KRW" } : null,
      // N-4.18-Q2 P0-4 — 할인판매가/정가가 둘 다 있고 정가가 더 클 때만 노출.
      regularPrice:
        salePrice && regularPrice && regularPrice > salePrice
          ? { amount: regularPrice, currency: "KRW" }
          : null,
      imageUrl: img ? (img.startsWith("//") ? `https:${img}` : img) : null,
      confidence: 0,
      // 실측 확인: 목록 마크업에 브랜드/SKU 필드 자체가 없음(undefined 유지).
      brand: undefined,
      sku: undefined,
    });
  }

  return candidates;
}
