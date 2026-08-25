import { fetchWithDomainRateLimit } from "../rate-limit/domain-rate-limiter";
import type { ComparisonCandidate } from "./types";

const FETCH_TIMEOUT_MS = 10000;
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const DOMAIN = "www.rulii.co.kr";

// N-4.18-C STEP4 — 실측 확인(2026-08-25, curl로 직접 확인). LOOXLOO와 같은 구형 Cafe24
// 스킨 계열이지만 세부 마크업은 다르다: 상품 블록 class가 "xans-record-"가 아니라
// "item xans-record-"이고, 브랜드/판매가는 li rel="브랜드"/rel="판매가"로 LOOXLOO와
// 같지만, 이미지가 ec-data-src가 아니라 평범한 src(id="eListPrdImageNNNN_")이고,
// 상품명 안의 품번은 괄호가 아니라 대괄호("[AE099]")다. LOOXLOO 코드를 그대로
// 재사용하지 않고 이 도메인 실측값에 맞춰 새로 만든다(추정 금지 원칙).
const ITEM_SPLIT_RE = /<li id="anchorBoxId_\d+" class="item xans-record-">/;
const NAME_BLOCK_RE = /<p class="name">([\s\S]*?)<\/p>/;
const NAME_HREF_RE = /<a href="([^"]+)"/;
const IMG_RE = /<img src="([^"]+)" id="eListPrdImage/;
const SPAN_TEXT_RE = /<span[^>]*>([^<]*)<\/span>/g;

function extractLastSpanText(html: string): string | null {
  let match: RegExpExecArray | null;
  let last: string | null = null;
  SPAN_TEXT_RE.lastIndex = 0;
  while ((match = SPAN_TEXT_RE.exec(html)) !== null) {
    const text = match[1].trim();
    if (text) last = text;
  }
  return last;
}

/** LOOXLOO의 extractField와 동일한 방식(rel="라벨" 다음, 다음 rel 필드 시작
 * 전까지 슬라이스 후 마지막 non-empty span 텍스트) — 이 도메인도 같은
 * li rel="..." 구조를 실제로 쓴다(실측 확인). */
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

/** 상품명 끝의 "[AE099]" 형식 품번을 SKU로 뽑는다(실측 확인된 형식만, 없으면
 * 추측하지 않는다) — LOOXLOO는 괄호였지만 이 도메인은 대괄호를 쓴다. */
function extractModelCode(title: string): string | undefined {
  const match = /\[([A-Z0-9-]{3,20})\]\s*$/.exec(title);
  return match ? match[1] : undefined;
}

const DETAIL_SALE_PRICE_RE = /id="span_product_price_sale"[^>]*>\s*([0-9,]+)/;
const DETAIL_REGULAR_PRICE_RE = /id="span_product_price_text"[^>]*>\s*([0-9,]+)/;

export interface RuliiProductPrice {
  price: { amount: number; currency: "KRW" } | null;
  available: boolean;
}

/** N-4.18-C STEP4 — domestic_product_links로 이미 연결된 특정 상품의 "지금" 가격을
 * 재조회할 때 쓴다(daily 가격 모니터링용, 검색이 아니라 상세 페이지 1건). 실측
 * 확인(2026-08-25): 상세 페이지도 LOOXLOO와 같은 id(span_product_price_sale/
 * span_product_price_text)를 쓴다. */
export async function fetchRuliiProductPrice(url: string): Promise<RuliiProductPrice> {
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

export async function searchRulii(query: string): Promise<ComparisonCandidate[]> {
  const url = `https://${DOMAIN}/product/search.html?keyword=${encodeURIComponent(query)}`;
  const response = await fetchWithDomainRateLimit(url, {
    headers: { Accept: "text/html", "User-Agent": CHROME_UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`RULII search ${response.status}`);

  const html = await response.text();
  const blocks = html.split(ITEM_SPLIT_RE).slice(1);
  const candidates: ComparisonCandidate[] = [];

  for (const block of blocks) {
    if (candidates.length >= 5) break;
    const nameBlockMatch = NAME_BLOCK_RE.exec(block);
    if (!nameBlockMatch) continue;
    const nameBlock = nameBlockMatch[1];
    const hrefMatch = NAME_HREF_RE.exec(nameBlock);
    const title = extractLastSpanText(nameBlock);
    if (!title || !hrefMatch) continue;
    const href = hrefMatch[1];

    const brand = extractField(block, "브랜드") ?? undefined;
    const salePrice = parsePrice(extractField(block, "할인판매가"));
    const regularPrice = parsePrice(extractField(block, "판매가"));
    const amount = salePrice ?? regularPrice;
    const img = IMG_RE.exec(block)?.[1];

    candidates.push({
      title,
      url: href.startsWith("http") ? href : `https://${DOMAIN}${href}`,
      price: amount ? { amount, currency: "KRW" } : null,
      imageUrl: img ? (img.startsWith("//") ? `https:${img}` : img) : null,
      confidence: 0,
      brand,
      sku: extractModelCode(title),
    });
  }

  return candidates;
}
