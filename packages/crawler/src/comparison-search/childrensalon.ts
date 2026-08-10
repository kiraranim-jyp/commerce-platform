import { fetchWithDomainRateLimit } from "../rate-limit/domain-rate-limiter";
import type { ComparisonCandidate } from "./types";

const FETCH_TIMEOUT_MS = 10000;
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const DOMAIN = "www.childrensalon.com";

// 서버렌더링 HTML. 실측 확인된 상품 타일 구조(<li data-product-name="..." class="product-item">
// ...<a href="/{slug}.html">...<img src="...">...<div class="designer">{brand}</div>
// <h2 class="product-name">{title}</h2>...<span class="price">£X.XX</span>...</li>) 기반 정규식 파싱.
// 세일 상품은 old-price/special-price 두 개의 <span class="price">가 나오는데, 마지막 값이
// 실제 판매가(할인가)이므로 항상 마지막 매치를 취한다.
const PRODUCT_ITEM_RE = /<li[^>]*data-product-name="([^"]*)"class="product-item">([\s\S]*?)<\/li>/g;
const HREF_RE = /<a href="([^"]+)"/;
const IMG_RE = /<img\s+src="([^"]+)"/;
const DESIGNER_RE = /<div class="designer">([^<]*)<\/div>/;
const PRICE_RE = /<span class="price">([^<]*)<\/span>/g;

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function parsePrice(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const amount = Number(cleaned);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export async function searchChildrensalon(currency: string | null, query: string): Promise<ComparisonCandidate[]> {
  const url = `https://${DOMAIN}/search?q=${encodeURIComponent(query)}`;
  const response = await fetchWithDomainRateLimit(url, {
    headers: { Accept: "text/html", "User-Agent": CHROME_UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Childrensalon search ${response.status}`);

  const html = await response.text();
  const candidates: ComparisonCandidate[] = [];

  let match: RegExpExecArray | null;
  PRODUCT_ITEM_RE.lastIndex = 0;
  while ((match = PRODUCT_ITEM_RE.exec(html)) !== null && candidates.length < 5) {
    const [, rawName, block] = match;
    const href = HREF_RE.exec(block)?.[1];
    const img = IMG_RE.exec(block)?.[1];
    const designer = DESIGNER_RE.exec(block)?.[1];

    let priceMatch: RegExpExecArray | null;
    let lastPrice: string | undefined;
    PRICE_RE.lastIndex = 0;
    while ((priceMatch = PRICE_RE.exec(block)) !== null) {
      lastPrice = priceMatch[1];
    }
    const amount = parsePrice(lastPrice);

    const title = decodeEntities(designer ? `${designer} ${rawName}` : rawName);
    candidates.push({
      title,
      url: href ? `https://${DOMAIN}${href}` : `https://${DOMAIN}`,
      price: amount && currency ? { amount, currency } : null,
      imageUrl: img ?? null,
      confidence: 0,
      brand: designer ? decodeEntities(designer) : undefined,
    });
  }

  return candidates;
}
