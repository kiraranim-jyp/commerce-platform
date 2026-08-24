import { extractShopifyHandle, fetchShopifyProductJson } from "../shopify-product-json";
import { searchShopifySuggest } from "./shopify-suggest";
import type { ComparisonCandidate } from "./types";

const DOMAIN = "bobochoses.com";
const MAX_DETAIL_LOOKUPS = 3;

/** N-4.18-C STEP3/4(실측 확인, 2026-08-25) — bobochoses.com은 단일 브랜드
 * 스토어라 상품 title에 "Bobo Choses"가 아예 없다(예: 실제 상품 title은
 * "Stamp Bloom all over denim pants"). curl로 직접 확인: suggest.json은
 * "stamp bloom denim pants"(브랜드 없음)로는 정상 매칭하지만, 앞에
 * "Bobo Choses"만 붙여도("Bobo Choses stamp bloom") 토큰 수와 무관하게
 * 전부 0건이 된다(AND 토큰 매칭으로 추정 — 이 사전버그는 STEP3 도입 이전
 * 코드도 동일했다, 즉 이번에 새로 생긴 회귀가 아니라 원래 있던 gap이다).
 * 다른 스토어(LOOXLOO 등)는 브랜드가 실제로 title/필드에 나오므로 이 처리를
 * 하지 않는다 — 이 스토어에서만 브랜드 접두어를 제거한다. */
function stripBrandPrefix(query: string): string {
  const stripped = query.replace(/^\s*bobo\s+choses\s+/i, "").trim();
  return stripped || query;
}

/** N-4.07 — 실측 확인(2026-08-23, curl): bobochoses.com은 /ko-kr/search/suggest.json이
 * 417 "Unsupported buyer locale"을 반환한다(이 스토어는 검색 제안 API에서 로케일
 * 프리픽스를 지원하지 않음) — 검색은 로케일 없는 기본 엔드포인트로만 가능하고, 이
 * 엔드포인트가 주는 가격은 기본 통화(EUR로 추정, KRW 아님)라 국내 비교에 쓸 수 없다.
 * 반면 /ko-kr/products/{handle}.json은 실제로 KRW 절대가를 준다(실측 확인:
 * variants[0].price="114000", price_currency="KRW") — fetchShopifyProductJson이
 * 이미 로케일 프리픽스를 그대로 신뢰하는 계약이라(shopify-product-json.ts 주석 참고)
 * 검색으로 후보를 찾은 뒤 상세만 /ko-kr/ 강제로 다시 조회해서 실제 판매가를 확정한다. */
export async function searchBoboChosesKorea(query: string): Promise<ComparisonCandidate[]> {
  const searchCandidates = await searchShopifySuggest(DOMAIN, null, stripBrandPrefix(query));
  const top = searchCandidates.slice(0, MAX_DETAIL_LOOKUPS);

  const enriched = await Promise.all(
    top.map(async (candidate): Promise<ComparisonCandidate | null> => {
      const handle = extractShopifyHandle(candidate.url);
      if (!handle) return null;
      const detail = await fetchShopifyProductJson(`https://${DOMAIN}/ko-kr/products/${handle}`);
      if (!detail?.productData.price) return null;
      // shopify-product-json.ts 기존 주석 참고 — 이 스토어의 vendor 필드는 시즌코드
      // ("SS26")라 실제 브랜드가 아니다(예: junioredition.com처럼 vendor=브랜드명인
      // 스토어와 다름). candidate.brand를 여기서 채우면 match.ts가 "SS26" !=
      // "Bobo Choses"로 판정해 진짜 매칭까지 브랜드 불일치로 깎는다 — brand를 비워
      // 두면 match.ts가 title 부분일치로 폴백한다(title에 "Bobo Choses"가 실제로
      // 포함돼 있어 정상 동작).
      //
      // N-4.07 3차(실측 발견, 2026-08-23) — title은 절대 detail의 값으로 덮어쓰지
      // 않는다. /ko-kr/products/{handle}.json은 가격을 KRW로 정확히 주지만 title도
      // 함께 한글 번역판("Bobo Choses Color Block 지퍼 스웨트셔츠")으로 바뀌어
      // 돌아온다 — 원본(대개 영어) 쿼리와 토큰 자체가 겹치지 않게 되어 실제로는
      // 동일상품인데 모델명 유사도가 인위적으로 깎이는 버그였다(실측: confidence
      // 0.65→더 낮게 하락 확인). 상세 조회는 가격 확정 목적으로만 쓰고, 매칭에 쓰는
      // title은 검색 단계(searchShopifySuggest, 원본 로케일)의 값을 그대로 유지한다.
      return {
        ...candidate,
        // 검색 단계(searchShopifySuggest)도 같은 vendor 필드를 brand로 채웠으므로
        // 여기서 명시적으로 지운다(스프레드만으로는 검색 단계 값이 남는다).
        brand: undefined,
        price: detail.productData.price,
        priceSource: "detail",
      };
    }),
  );

  return enriched.filter((c): c is ComparisonCandidate => c !== null);
}
