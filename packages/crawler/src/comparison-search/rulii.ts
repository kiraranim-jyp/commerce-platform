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

/** N-4.18-E(대표님 지시, 2026-08-25: "83%가 나온 이유가 RULII parser가 [AE099]를
 * SKU로 추출 못했기 때문") — "[AE099]" 형식 품번을 SKU로 뽑는다(실측 확인된 형식만,
 * 없으면 추측하지 않는다). LOOXLOO는 괄호였지만 이 도메인은 대괄호를 쓴다.
 * 실측 재확인(2026-08-25, 서로 다른 키워드 2회, 총 8개 제목): RULII는 품번이 제목
 * 끝이 아니라 "{한글명} [AE099] {영문명}" 형태로 중간에 온다(끝-앵커였던 이전 버전은
 * 이 형식을 못 잡아 SKU가 항상 undefined였다) — LOOXLOO(총 10개 제목, 전부 끝
 * 위치)와는 마크업 관례가 다르다는 것도 이번에 재확인, 그쪽은 그대로 둔다. */
function extractModelCode(title: string): string | undefined {
  const match = /\[([A-Z0-9-]{3,20})\]/.exec(title);
  return match ? match[1] : undefined;
}

const DETAIL_SALE_PRICE_RE = /id="span_product_price_sale"[^>]*>\s*([0-9,]+)/;
const DETAIL_REGULAR_PRICE_RE = /id="span_product_price_text"[^>]*>\s*([0-9,]+)/;

/** N-4.18-G STEP G-2(대표님 지시, 2026-08-25: "반드시 실제 품절 상품을 대상으로
 * 테스트합니다") — 실측 확인된 상품 전체 품절 마커(상세페이지):
 * `<div class="infoArea"><span class="icon"><img ... alt="품절" /></span>`.
 * 실측 검증(2026-08-25, Node.js로 정규식 직접 테스트): 실제 품절 상품
 * (product_no=3618)에서 true, 실제 판매중 상품(product_no=4794, AE099
 * 청바지)에서 false. 단순 html.includes('품절')은 안전하지 않다 — 사이즈
 * <select> 옵션 안에 "8Y (+9,000원) [품절]"처럼 옵션별(전체 아님) 품절
 * 문구가 섞여 있어 false positive가 난다(실측으로 발견). 이 정규식은 그
 * select 옵션 문맥과 구조적으로 다른 infoArea 블록만 매칭해 그 문제를
 * 피한다. */
const DETAIL_SOLDOUT_RE = /<div class="infoArea">\s*<span class="icon"><img[^>]*alt="품절"/;

export interface RuliiProductPrice {
  price: { amount: number; currency: "KRW" } | null;
  available: boolean;
  /** N-4.18-G STEP G-3 — 이미 있던 DETAIL_SALE_PRICE_RE/DETAIL_REGULAR_PRICE_RE
   * 추출값을 합치지 않고 그대로 분리해서 노출한다(추측 없음, 기존 값 재구조화만). */
  salePriceKrw: number | null;
  originalPriceKrw: number | null;
  /** null=판정 불가, true=실제 품절 확인, false=실제 판매 가능 확인. */
  soldOut: boolean | null;
}

/** N-4.18-C STEP4 — domestic_product_links로 이미 연결된 특정 상품의 "지금" 가격을
 * 재조회할 때 쓴다(daily 가격 모니터링용, 검색이 아니라 상세 페이지 1건). 실측
 * 확인(2026-08-25): 상세 페이지도 LOOXLOO와 같은 id(span_product_price_sale/
 * span_product_price_text)를 쓴다.
 *
 * N-4.18-G STEP G-2/G-3 — 실측 확인(2026-08-25): 품절 상품(product_no=3618)
 * 상세페이지에서도 DETAIL_SALE_PRICE_RE/DETAIL_REGULAR_PRICE_RE가 여전히 값을
 * 낸다(할인가 77,200 / 정가 193,000) — 품절이어도 가격 자체는 기록할 수 있다,
 * 그래서 available/price는 soldOut과 별개로 계속 채운다(soldOut===true인
 * 관측치를 가격 계산에서 빼는 건 packages/pricing summarizeFrom의 역할). */
export async function fetchRuliiProductPrice(url: string): Promise<RuliiProductPrice> {
  const response = await fetchWithDomainRateLimit(url, {
    headers: { Accept: "text/html", "User-Agent": CHROME_UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) return { price: null, available: false, salePriceKrw: null, originalPriceKrw: null, soldOut: null };
  const html = await response.text();
  const sale = parsePrice(DETAIL_SALE_PRICE_RE.exec(html)?.[1] ?? null);
  const regular = parsePrice(DETAIL_REGULAR_PRICE_RE.exec(html)?.[1] ?? null);
  const amount = sale ?? regular;
  const soldOut = DETAIL_SOLDOUT_RE.test(html);
  return amount
    ? { price: { amount, currency: "KRW" }, available: true, salePriceKrw: sale, originalPriceKrw: regular, soldOut }
    : { price: null, available: false, salePriceKrw: null, originalPriceKrw: null, soldOut };
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
