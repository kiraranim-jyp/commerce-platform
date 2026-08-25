import { fetchWithDomainRateLimit } from "../rate-limit/domain-rate-limiter";
import type { ComparisonCandidate } from "./types";

const FETCH_TIMEOUT_MS = 10000;
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const DOMAIN = "www.deuxbebe.com";

// N-4.18-C STEP4 — 실측 확인(2026-08-25, curl로 직접 확인). RULII/LOOXLOO와 같은 구형
// Cafe24 스킨 계열이지만 세부 마크업이 또 다르다: 상품 블록 class가
// "item_list xans-record-"(RULII는 "item xans-record-"), 상품명이 <p class="name">이
// 아니라 <strong class="name"><a>제목</a></strong>, 이미지 id가 "eListPrdImageNNNN_"
// (RULII와 동일), 가격은 rel="판매가"/rel="할인판매가"(할인 없으면 할인판매가 필드
// 자체가 없음 — 실측 확인: 3개 샘플 중 1개는 할인 없음), SKU는 rel="자체 상품코드"
// (모델코드 대괄호 추출이 아니라 실제 필드로 제공 — RULII보다 신뢰도 높음). 이
// 도메인만의 고유한 신호로 브랜드도 확인됐다: 검색결과 블록의 첫 xans-search
// 필드(rel="", 브랜드 라벨 자체가 없음)가 실제로는 상품마다 다른 브랜드명이다
// (실측 3개: "Sissel"/"MSGM"/"MSGM") — 이 매장은 멀티브랜드 편집샵이라 각 rel="" 첫
// 필드를 브랜드로 쓴다(추정이 아니라 3개 샘플로 직접 확인).
const ITEM_SPLIT_RE = /<li id="anchorBoxId_\d+" class="item_list xans-record-">/;
const NAME_RE = /<strong class="name"><a href="([^"]+)"[^>]*>([^<]*)<\/a>/;
const IMG_RE = /<img src="([^"]+)" id="eListPrdImage/;
const FIRST_FIELD_RE = /xans-search-listitem xans-record-"><span class="item_content " rel=""><span[^>]*>([^<]*)</;

/** N-4.18-C STEP4 버그 수정(실측 tsx 검증에서 발견, 2026-08-25) — RULII/LOOXLOO에서
 * 그대로 가져온 "마지막 non-empty span" 추출 방식을 처음 썼더니 할인 상품에서
 * "86,100원"이 아니라 중첩된 "<span>70%</span>"의 "70%"가 잡히는 실제 버그가 났다.
 * 이 도메인의 필드 구조는 `rel="필드"><span ...>텍스트 [<span>부가정보</span>]</span>`
 * 형태(실측 확인, RULII처럼 앞에 빈 placeholder span이 없다) — 그래서 "마지막 span"이
 * 아니라 "여는 span 태그 바로 다음, 첫 '<' 전까지의 텍스트"를 잡아야 한다. */
function extractField(block: string, rel: string): string | null {
  const match = new RegExp(`rel="${rel}"><span[^>]*>([^<]*)`).exec(block);
  const text = match?.[1]?.trim();
  return text || null;
}

function parsePrice(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9]/g, "");
  const amount = Number(cleaned);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

const DETAIL_PRICE_RE = /id="span_product_price_text"[^>]*>\s*([0-9]+)/;

export interface DeuxbebeProductPrice {
  price: { amount: number; currency: "KRW" } | null;
  available: boolean;
}

/** N-4.18-C STEP4 — domestic_product_links로 이미 연결된 상품의 "지금" 가격을 재조회할
 * 때 쓴다. 실측 확인(2026-08-25): 상세 페이지는 검색결과와 달리 콤마 없는 raw 숫자를
 * span_product_price_text에 담는다(RULII/LOOXLOO는 콤마 포함 — 이 도메인만 다름). */
export async function fetchDeuxbebeProductPrice(url: string): Promise<DeuxbebeProductPrice> {
  const response = await fetchWithDomainRateLimit(url, {
    headers: { Accept: "text/html", "User-Agent": CHROME_UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) return { price: null, available: false };
  const html = await response.text();
  const amount = parsePrice(DETAIL_PRICE_RE.exec(html)?.[1] ?? null);
  return amount ? { price: { amount, currency: "KRW" }, available: true } : { price: null, available: false };
}

export async function searchDeuxbebe(query: string): Promise<ComparisonCandidate[]> {
  const url = `https://${DOMAIN}/product/search.html?keyword=${encodeURIComponent(query)}`;
  const response = await fetchWithDomainRateLimit(url, {
    headers: { Accept: "text/html", "User-Agent": CHROME_UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`deuxbebe search ${response.status}`);

  const html = await response.text();
  const blocks = html.split(ITEM_SPLIT_RE).slice(1);
  const candidates: ComparisonCandidate[] = [];

  for (const block of blocks) {
    if (candidates.length >= 5) break;
    const nameMatch = NAME_RE.exec(block);
    if (!nameMatch) continue;
    const href = nameMatch[1];
    const title = nameMatch[2].trim();
    if (!title) continue;

    const brand = FIRST_FIELD_RE.exec(block)?.[1]?.trim() || undefined;
    const salePrice = parsePrice(extractField(block, "할인판매가"));
    const regularPrice = parsePrice(extractField(block, "판매가"));
    const amount = salePrice ?? regularPrice;
    const img = IMG_RE.exec(block)?.[1];
    const sku = extractField(block, "자체 상품코드") ?? undefined;

    candidates.push({
      title,
      url: href.startsWith("http") ? href : `https://${DOMAIN}${href}`,
      price: amount ? { amount, currency: "KRW" } : null,
      imageUrl: img ? (img.startsWith("//") ? `https:${img}` : img) : null,
      confidence: 0,
      brand,
      sku,
    });
  }

  return candidates;
}
