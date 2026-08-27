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

export interface ForetforetProductPrice {
  price: { amount: number; currency: "KRW" } | null;
  available: boolean;
  soldOut: boolean | null;
}

/** N-4.18-Q3 PART S(대표님 지시, 2026-08-26) — domestic_product_links로 이미 연결된
 * 상품의 "지금" 가격을 재조회할 때 쓴다(Daily Watch cron이 매일 호출). 실측 확인
 * (2026-08-26, curl shopdetail.html): 상세 페이지 JS에 `var product_price = '258000';`
 * 형태로 최종 판매가(할인 적용 후)가 그대로 담겨 있다 — 검색결과 카드의 price/strike
 * 구조와 달리 상세 페이지는 이 변수 하나만 확인됨. */
const DETAIL_PRICE_RE = /var product_price = '(\d+)'/;

/** N-4.18-Q3 PART E-10(대표님 지시, 2026-08-27) — 이전 세션에서 changeOpt2value의
 * `num` 배열 출처를 찾지 못했던 이유를 실측으로 규명: 이 함수는 옵션이 구형
 * spcode/spcode2 구조(`document.getElementById('option_type')`가 없는 경우)일 때만
 * 실행되는데, 실제 골든케이스(VERNICE NERO T-스트랩 슈즈, branduid=10226592)를
 * 포함해 실측한 20개 이상의 상품 전부가 `id="option_type" value="PS"` 히든
 * 인풋을 갖고 있어(신형 통합옵션 구조) 이 조건이 항상 거짓이 된다 — 즉
 * changeOpt2value는 죽은 코드이고 옵션별 재고는 다른 경로로 내려온다.
 *
 * 실제 재고 신호는 두 가지 형태로 존재한다(둘 다 20개 이상 실측 확인):
 * 1) 단일 옵션(사이즈만 등) 상품 — `<select name="optionlist[]">` 안의 각
 *    `<option ... sto_state="SALE|SOLDOUT">`에 HTML 속성으로 직접 노출된다
 *    (골든케이스 실측: NER,23=SOLDOUT / NER,24~27=SALE / NER,28~30=SOLDOUT).
 * 2) 다차원 옵션(사이즈+색상처럼 select가 2개 이상) 상품 — 개별 `<option>`
 *    태그에는 `sto_id="0"` 플레이스홀더만 있고, 실제 조합별 재고는 별도 JS
 *    변수 `var optionJsonData = {...}`의 각 조합 객체마다 홑따옴표
 *    `sto_state:'SALE'` 형태로 들어있다(20개 상품 실측: 전부 이 형태였고 값은
 *    전부 SALE — 완전품절 실사례는 이번 조사에서 찾지 못했다).
 * 두 형태 모두 "조합 하나하나의 재고 상태"를 그대로 나열한 것이므로, 형태와
 * 무관하게 같은 규칙을 적용할 수 있다: 신호가 하나도 없으면 null(확인불가),
 * 하나라도 SALE이면 전체 soldOut=false(옵션 일부만 품절이어도 구매 가능),
 * 전부 SOLDOUT이면 soldOut=true. 검색 목록 AJAX 응답(product_list.action.html)에는
 * 이 신호가 전혀 없다(실측 확인) — 상세 페이지를 반드시 거쳐야 한다. */
const STO_STATE_RE = /sto_state(?:="([A-Z]+)"|:'([A-Z]+)')/g;

function detectSoldOut(html: string): boolean | null {
  const states = [...html.matchAll(STO_STATE_RE)].map((m) => m[1] ?? m[2]);
  if (states.length === 0) return null;
  return states.every((s) => s === "SOLDOUT");
}

export async function fetchForetforetProductPrice(url: string): Promise<ForetforetProductPrice> {
  const response = await fetchWithDomainRateLimit(url, {
    headers: { Accept: "text/html", "User-Agent": CHROME_UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) return { price: null, available: false, soldOut: null };
  const html = await response.text();
  const amount = parsePrice(DETAIL_PRICE_RE.exec(html)?.[1] ?? "");
  const soldOut = detectSoldOut(html);
  return amount
    ? { price: { amount, currency: "KRW" }, available: true, soldOut }
    : { price: null, available: false, soldOut };
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
