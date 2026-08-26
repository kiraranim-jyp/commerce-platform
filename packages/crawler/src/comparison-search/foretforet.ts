import { fetchWithDomainRateLimit } from "../rate-limit/domain-rate-limiter";
import { decodeHtmlEntities } from "./html-entities";
import type { ComparisonCandidate } from "./types";

const FETCH_TIMEOUT_MS = 10000;
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const DOMAIN = "www.foretforet.com";

/** N-4.20(대표님 지시, 2026-08-26: "포레포레 위에 신발건도 그렇고 동일을 못찾고") —
 * 포레포레(foretforet.com)는 domestic_price_sources에 collectionStrategy="MANUAL"로
 * 등록만 되어 있고 실제 파서가 없어서 항상 unsupported였다(매칭 정확도 문제가
 * 아니라 애초에 검색을 시도한 적이 없었다). 실측 확인(2026-08-26, curl):
 * 이 매장은 MakeShop 플랫폼이고, 검색결과 상품 목록은 홈페이지 HTML에 서버렌더링
 * 되지 않는다(초기 HTML엔 검색 폼만 있고, 상품 그리드는 JS의 get_list()가 별도
 * AJAX 호출로 채운다) — 그 AJAX 엔드포인트(`/shop/product_list.action.html`)를
 * 직접 GET으로 호출하면 인증/세션 없이도 JSON({html: "...상품 카드 HTML..."})을
 * 그대로 반환한다(실측: 검색어 "페페"로 실제 PèPè(브랜드 표기 "PEPE SHOES") 상품
 * 100건, 카드마다 branduid/브랜드/제목(SKU 접미사 포함)/가격/이미지 확인).
 */
const ITEM_SPLIT_RE = /<div class="item item_(\d+)">/;
const BRAND_RE = /<div class="brand"><a[^>]*>([^<]*)<\/a><\/div>/;
/** 실측 확인 — 표시용 제목(`summary`)과 별개로, 검색 결과 없는 `name` div에
 * "AW26[페페슈즈]루시 말라가 슈즈 NUDE-PP26KASTR0006MNU"처럼 실제 상품명 전체와
 * 내부 품번이 함께 들어있다(화면엔 숨겨져 있지만 마크업엔 항상 존재 — 5개 샘플
 * 전부 확인). match.ts의 모델명 비교에는 이 전체 문자열을, SKU는 아래
 * extractTrailingCode()로 마지막 하이픈 뒤 품번만 따로 뽑는다. */
const NAME_RE = /<div class="name"[^>]*>\s*<a[^>]*>([^<]*)<\/a>/;
const IMG_RE = /<img src="([^"]+)"/;
/** 실측 확인 — 할인 없는 카드는 `<span class="price">` 하나만, 할인 카드는
 * `<span class="price strike">정가</span><span class="price">할인가</span>`
 * 순서로 둘 다 나온다(둘 다 이 정규식에 매칭, strike 여부만 다름). */
const PRICE_RE = /<span class="price( strike)?">([\d,]+)<\/span>/g;
/** 실측 확인(5개 샘플: PP26KASTR0006MNU/PP26KABAL0275RRC/PP26KSSAN1325MCH 등) —
 * 상품명 마지막 하이픈 뒤에 항상 대문자+숫자로만 이루어진 내부 품번이 붙는다.
 * 이 패턴이 없으면(다른 상품유형 등) 그냥 undefined — 지어내지 않는다. */
const TRAILING_CODE_RE = /-([A-Z0-9]{6,20})$/;

function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9]/g, "");
  const amount = Number(cleaned);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export async function searchForetforet(query: string): Promise<ComparisonCandidate[]> {
  const url = `https://${DOMAIN}/shop/product_list.action.html?action_mode=get_list&page=1&category=&sort=&search=${encodeURIComponent(query)}&viewtype=&sp_search_type=&add_check=`;
  const response = await fetchWithDomainRateLimit(url, {
    headers: { Accept: "application/json", "User-Agent": CHROME_UA, "X-Requested-With": "XMLHttpRequest" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`foretforet search ${response.status}`);

  const data = (await response.json()) as { html?: string };
  const html = data.html ?? "";
  const parts = html.split(ITEM_SPLIT_RE);
  // split()으로 캡처 그룹(branduid)까지 같이 쪼개면 [머리말, id1, block1, id2, block2, ...] 형태가 된다.
  const candidates: ComparisonCandidate[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    if (candidates.length >= 5) break;
    const branduid = parts[i];
    const block = parts[i + 1] ?? "";

    const nameMatch = NAME_RE.exec(block);
    if (!nameMatch) continue;
    const title = decodeHtmlEntities(nameMatch[1].trim());
    if (!title) continue;

    const rawBrand = BRAND_RE.exec(block)?.[1]?.trim();
    const brand = rawBrand ? decodeHtmlEntities(rawBrand) : undefined;

    const priceMatches = [...block.matchAll(PRICE_RE)].map((m) => ({
      isStrike: Boolean(m[1]),
      amount: parsePrice(m[2]),
    }));
    const salePrice = priceMatches.find((p) => !p.isStrike)?.amount ?? null;
    const regularPrice = priceMatches.find((p) => p.isStrike)?.amount ?? null;

    const img = IMG_RE.exec(block)?.[1];
    const sku = TRAILING_CODE_RE.exec(title)?.[1];

    candidates.push({
      title,
      url: `https://${DOMAIN}/shop/shopdetail.html?branduid=${branduid}`,
      price: salePrice ? { amount: salePrice, currency: "KRW" } : null,
      regularPrice:
        regularPrice && salePrice && regularPrice > salePrice ? { amount: regularPrice, currency: "KRW" } : null,
      imageUrl: img ? (img.startsWith("//") ? `https:${img}` : img) : null,
      confidence: 0,
      brand,
      sku,
    });
  }

  return candidates;
}
