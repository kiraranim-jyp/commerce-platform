import { fetchWithDomainRateLimit } from "../rate-limit/domain-rate-limiter";
import type { ProductOption } from "./evidence";
import { decodeHtmlEntities } from "./html-entities";
import type { ComparisonCandidate } from "./types";

const FETCH_TIMEOUT_MS = 10000;
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const DOMAIN = "www.looxloo.com";

// N-4.07 — 실측 확인(2026-08-23, curl로 직접 확인). Cafe24 플랫폼, 상품 검색 결과는
// <li id="anchorBoxId_{상품번호}" class="xans-record-"><div class="prdList__item">...
// 블록으로 반복된다. 블록 안에 상품명 링크(div.name > a)와 rel 속성으로 라벨링된
// 필드(브랜드/할인판매가/판매가/소비자가/상품색상)가 각각 <span class="m_item">
// 안에 중첩 <span>으로 실제 값을 담고 있다(실측 예: 보보쇼즈BS고BOBO트랙수트팬츠,
// 브랜드=BOBO CHOSES, 판매가=165,000/할인판매가=132,000).
const ITEM_SPLIT_RE = /<li id="anchorBoxId_\d+" class="xans-record-">/;
const NAME_BLOCK_RE = /<div class="name"><a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/;
const IMG_RE = /ec-data-src="([^"]+)"/;
const SPAN_TEXT_RE = /<span[^>]*>([^<]*)<\/span>/g;

/** rel="{라벨}" 다음의 <span class="m_item">...</span> 블록에서 실제 값(중첩된 마지막
 * non-empty <span> 텍스트)을 뽑는다. 이 사이트는 라벨 span과 값 span이 항상 중첩된
 * <span> 구조라 마지막 non-empty 텍스트가 실제 값이다(첫 span은 항상 label/빈 문자열). */
function extractLastSpanText(html: string): string | null {
  let match: RegExpExecArray | null;
  let last: string | null = null;
  SPAN_TEXT_RE.lastIndex = 0;
  while ((match = SPAN_TEXT_RE.exec(html)) !== null) {
    const text = match[1].trim();
    if (text) last = text;
  }
  return last ? decodeHtmlEntities(last) : null;
}

/** rel="{라벨}" 다음, 그 다음 rel="..." 필드가 시작되기 전까지만 슬라이스한다 —
 * 고정 길이(예: 800자)로 자르면 이 필드 값을 못 찾고 다음 rel 필드의 값을 잘못
 * 가져오는 버그가 있었다(실측 확인, 2026-08-23: 브랜드 필드에서 할인판매가 값이
 * 나옴 — 각 <li rel="...">는 길이가 서로 다르기 때문). */
function extractField(block: string, rel: string): string | null {
  const idx = block.indexOf(`rel="${rel}"`);
  if (idx === -1) return null;
  const nextRelIdx = block.indexOf('rel="', idx + rel.length);
  const slice = block.slice(idx, nextRelIdx === -1 ? idx + 800 : nextRelIdx);
  return extractLastSpanText(slice);
}

function parsePrice(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9]/g, "");
  const amount = Number(cleaned);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

/** 상품명 안의 "(75A7D-415-16)" 형식 모델코드를 SKU로 뽑는다(실측 확인된 형식만,
 * 없으면 추측하지 않는다). */
function extractModelCode(title: string): string | undefined {
  const match = /\(([A-Z0-9-]{5,20})\)\s*$/.exec(title);
  return match ? match[1] : undefined;
}

const DETAIL_SALE_PRICE_RE = /id="span_product_price_sale"[^>]*>\s*([0-9,]+)/;
const DETAIL_REGULAR_PRICE_RE = /id="span_product_price_text"[^>]*>\s*([0-9,]+)/;

/** N-4.18-Q3 PART H-3-3(대표님 지시, 2026-08-27) — 실측 확인(2026-08-27, product_no=11518
 * 실제 상세페이지): RULII/DEUXBEBE와 동일하게 JSON-LD Product.offers가 옵션별 배열이고,
 * 각 원소가 name(예: "...(76A7D-410-02) BLUE-100")/price/availability(InStock|
 * OutOfStock)/url(?item_code=P0000RBA00FE 쿼리파라미터)을 담는다. 실측 케이스: 6개
 * 옵션 전부 InStock(품절 사례는 이번 실측에서 못 찾음 — 지어내지 않고 그대로 보고).
 * offers가 없거나 배열이 아니면 null(옵션 정보를 못 가져온 것 — 빈 배열과 구분,
 * evidence.ts ProductOption 계약). */
const JSON_LD_RE = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
const ITEM_CODE_RE = /[?&]item_code=([A-Za-z0-9]+)/;

interface JsonLdOffer {
  name?: unknown;
  price?: unknown;
  availability?: unknown;
  url?: unknown;
}

function toProductOption(offer: JsonLdOffer): ProductOption {
  const name = typeof offer.name === "string" ? offer.name : "";
  const price = typeof offer.price === "number" ? offer.price : null;
  const availability =
    typeof offer.availability === "string"
      ? offer.availability.includes("InStock")
        ? true
        : offer.availability.includes("OutOfStock")
          ? false
          : null
      : null;
  const itemCode = typeof offer.url === "string" ? (ITEM_CODE_RE.exec(offer.url)?.[1] ?? undefined) : undefined;
  return { name, price, availability, itemCode };
}

export function extractLooxlooOptions(html: string): ProductOption[] | null {
  for (const match of html.matchAll(JSON_LD_RE)) {
    try {
      const data = JSON.parse(match[1]) as { "@type"?: string; offers?: unknown };
      if (data["@type"] === "Product" && Array.isArray(data.offers)) {
        return (data.offers as JsonLdOffer[]).map(toProductOption);
      }
    } catch {
      // 유효 JSON이 아닌 블록은 건너뜀
    }
  }
  return null;
}

export interface LooxlooProductPrice {
  price: { amount: number; currency: "KRW" } | null;
  available: boolean;
}

/** N-4.07 2차 — domestic_product_links로 이미 연결된 특정 상품의 "지금" 가격을
 * 재조회할 때 쓴다(검색 결과 목록이 아니라 상세 페이지 1건). 실측 확인(2026-08-23):
 * 상세 페이지는 검색결과 목록과 다른 마크업을 쓴다 — id="span_product_price_sale"
 * (할인가, 있으면), id="span_product_price_text"(정가)가 각각 고유 id라 검색결과
 * 파싱보다 훨씬 안정적이다. 두 id 모두 못 찾으면(페이지 구조가 바뀌었거나 상품이
 * 내려간 경우) available:false로 보고한다 — 추정 가격을 만들지 않는다. */
export async function fetchLooxlooProductPrice(url: string): Promise<LooxlooProductPrice> {
  const response = await fetchWithDomainRateLimit(url, {
    headers: { Accept: "text/html", "User-Agent": CHROME_UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) return { price: null, available: false };
  const html = await response.text();
  const sale = parsePrice(DETAIL_SALE_PRICE_RE.exec(html)?.[1] ?? null);
  const regular = parsePrice(DETAIL_REGULAR_PRICE_RE.exec(html)?.[1] ?? null);
  const amount = sale ?? regular;
  return amount ? { price: { amount, currency: "KRW" }, available: true } : { price: null, available: false };
}

export async function searchLooxloo(query: string): Promise<ComparisonCandidate[]> {
  const url = `https://${DOMAIN}/product/search.html?keyword=${encodeURIComponent(query)}`;
  const response = await fetchWithDomainRateLimit(url, {
    headers: { Accept: "text/html", "User-Agent": CHROME_UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`LOOXLOO search ${response.status}`);

  const html = await response.text();
  const blocks = html.split(ITEM_SPLIT_RE).slice(1);
  const candidates: ComparisonCandidate[] = [];

  for (const block of blocks) {
    if (candidates.length >= 5) break;
    const nameMatch = NAME_BLOCK_RE.exec(block);
    if (!nameMatch) continue;
    const [, href, nameInner] = nameMatch;
    const title = extractLastSpanText(nameInner);
    if (!title) continue;

    const brand = extractField(block, "브랜드") ?? undefined;
    // 할인판매가가 있으면 실제 결제가, 없으면 판매가를 쓴다(둘 다 없으면 가격 없음으로
    // 남긴다 — 추정하지 않는다).
    const salePrice = parsePrice(extractField(block, "할인판매가"));
    const regularPrice = parsePrice(extractField(block, "판매가"));
    const amount = salePrice ?? regularPrice;
    const img = IMG_RE.exec(block)?.[1];

    candidates.push({
      title,
      url: href ? `https://${DOMAIN}${href}` : `https://${DOMAIN}`,
      price: amount ? { amount, currency: "KRW" } : null,
      // N-4.18-Q2 P0-4 — 할인판매가/정가가 둘 다 있고 정가가 더 클 때만 노출.
      regularPrice:
        salePrice && regularPrice && regularPrice > salePrice
          ? { amount: regularPrice, currency: "KRW" }
          : null,
      imageUrl: img ? (img.startsWith("//") ? `https:${img}` : img) : null,
      confidence: 0,
      brand,
      sku: extractModelCode(title),
    });
  }

  return candidates;
}
