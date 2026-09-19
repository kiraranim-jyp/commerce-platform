import { extractShopifyHandle, fetchShopifyProductJson } from "../shopify-product-json";
import { searchBoboChosesKorea } from "./bobochoses-kr";
import { searchChildrensalon } from "./childrensalon";
import { fetchChocoelProductPrice, searchChocoel } from "./chocoel";
import { fetchDeuxbebeProductPrice, searchDeuxbebe } from "./deuxbebe";
import { fetchForetforetProductPrice, searchForetforet } from "./foretforet";
import { fetchLooxlooProductPrice, searchLooxloo } from "./looxloo";
import { selectCandidatesForDetailConfirmation } from "./price-confirmation";
import { missingRakutenCredentials, searchRakutenIchiba } from "./rakuten-ichiba";
import { fetchRuliiProductPrice, searchRulii } from "./rulii";
import { searchShopifySuggest } from "./shopify-suggest";
import type { CanonicalProductVariant } from "@commerce/shared";
import type { ComparisonCandidate, ComparisonQuery } from "./types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * GOLF-01.5 축 C — 가격소스 수집 표준 (CEO 지시, 2026-09-16)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 원문: **"MI 는 수집 방법을 몰라야 합니다."** MI 입장에서는 그냥
 * 상품·가격·통화·판매처·URL·수집시간·재고/상태 를 받으면 된다. Rakuten 이
 * API 든, 다른 사이트가 HTML 이든 MI 는 동일하게 처리할 수 있어야 한다.
 *
 * ── 이 파일이 «새로 만드는 것»은 없다 ───────────────────────────────────────
 * 이 저장소에는 이미 어댑터가 있었다. index.ts 의 searchOneShop 이 도메인으로
 * 분기해 파서를 고르고, 전부 같은 ComparisonCandidate[] 를 돌려주는 구조가
 * 그것이다. 다만 그 «등록부»가 세 군데에 흩어져 있었다:
 *
 *     SHOPIFY_SUGGEST_DOMAINS (Set)        ─┐
 *     searchOneShop 의 if 분기              ─┼─ 해외: 세 벌이 같은 목록을 적는다
 *     supportsComparisonShopSearch (함수)  ─┘
 *     DOMESTIC_SEARCH_DOMAINS (Set)        ─┐
 *     searchDomesticShopCandidates 의 if   ─┼─ 국내: 또 세 벌
 *     soldOutDetailFetcher 의 if           ─┘
 *
 * 목록을 여러 벌 적으면 언젠가 한쪽만 고쳐지고, 그 순간 화면이 "수집 가능"이라고
 * 말하는데 실제로는 unsupported 가 된다 — Rakuten 이 정확히 그 상태였다
 * (comparison-shops/route.ts 의 GOLF-01.5 축 A 주석 참고).
 *
 * 그래서 이 파일은 **목록을 하나로 모으고 약속을 이름 붙인 것**이지, 옆에 세운
 * 두 번째 수집 경로가 아니다. 수집 경로는 여전히 index.ts 의
 * searchComparisonShops / searchDomesticShops 두 함수뿐이고, 둘 다 이제
 * 이 등록부 하나만 읽는다.
 *
 * ── 어댑터가 약속하는 것 (입력 · 출력 · 실패) ───────────────────────────────
 *   입력  PriceSourceSearchInput — 검색어 한 개와, 카탈로그가 «선언한» 통화.
 *         어댑터는 통화를 지어내지 않는다(응답에 통화 필드가 없는 소스가 있다 —
 *         Rakuten 이 그렇다). 카탈로그가 통화를 모르면 null 이 그대로 온다.
 *   출력  ComparisonCandidate[] — 이 저장소가 이미 쓰던 공통 형태 그대로다.
 *         🔴 이 형태 어디에도 «어떻게 수집했는가»를 적는 칸이 없다. 그것이
 *            MI 가 수집 방법을 모른다는 뜻이고, 이번 표준의 전부다.
 *   실패  던진다(throw). 호출부가 status="error" 로 옮긴다 — 기존 동작 그대로.
 *         🔴 단, «자격증명이 없다»는 실패가 아니다. readiness() 가 호출 전에
 *            NOT_CONFIGURED 로 답하고, 호출부는 요청 자체를 보내지 않는다.
 *            그래야 "키가 없다"와 "찾은 게 없다"가 화면에서 구분된다.
 *
 * ── 왜 이 «최소» 형태인가 ───────────────────────────────────────────────────
 * 오늘 필요한 종류는 둘뿐이다: API 하나(Rakuten) · 기존 WEB 파서 여럿.
 * FEED 는 값만 정의해 두고 구현체를 만들지 않는다 — 공식 피드를 쓰는 소스가
 * 아직 한 곳도 없다. 없는 소스를 위해 추상을 미리 넓히지 않는다(CEO 명시).
 */
export type PriceSourceCollectionMethod = "API" | "FEED" | "WEB";

/**
 * 🔴 «자격증명이 없다»를 «결과가 없다»와 구분하기 위한 유일한 자리.
 *
 * 빈 배열을 돌려주면 화면은 "그 사이트에 그 상품이 없다"고 말한다. 키가 없어서
 * 아예 물어보지도 못한 것을 그렇게 말하면 거짓말이다 — 이 저장소가 반복해서
 * 고쳐 온 실패(unsupported vs NO_RESULT, BLOCKED vs 결과없음)와 같은 종류다.
 */
export type PriceSourceReadiness =
  | { state: "READY" }
  /** missing: 비어 있는 환경변수 «이름»만 담는다. 🔴 값은 절대 담지 않는다. */
  | { state: "NOT_CONFIGURED"; missing: string[] };

export interface PriceSourceSearchInput {
  /** 이번에 실제로 보낼 검색어 한 개. 여러 검색어를 차례로 시도하는 정책은
   * 호출부(searchOneDomesticShop)의 몫이지 어댑터의 몫이 아니다. */
  term: string;
  /** comparison_shops.currency / domestic_price_sources.currency 가 선언한 통화.
   * 소스 응답에 통화가 들어 있지 않을 때 이 값을 쓴다 — 국가나 도메인에서
   * 통화를 «추론»하지 않는다. */
  currency: string | null;
}

export interface PriceSourceAdapter {
  domain: string;
  /**
   * 이 도메인이 어느 카탈로그 테이블에 사는가. comparison_shops 와
   * domestic_price_sources 는 029 가 분리를 결정했고 FK 가 물려 있어 합치지
   * 않는다(051 주석) — 등록부는 하나로 모으되 어느 테이블 소속인지는 사실대로
   * 적어 둔다. supportsComparisonShopSearch / supportsDomesticShopSearch 가
   * 서로의 도메인을 잘못 "지원한다"고 답하지 않게 하는 것이 유일한 용도다.
   */
  catalog: "OVERSEAS" | "DOMESTIC";
  /** 🔴 표시·감사용이다. 호출부가 이 값으로 분기하지 않는다(검증:
   * price-source-adapter-contract.test.ts). 분기하는 순간 수집 방법이 다시
   * 위로 새어 나간다. */
  method: PriceSourceCollectionMethod;
  /** 자격증명이 필요 없는 어댑터는 항상 READY 다. */
  readiness(): PriceSourceReadiness;
  search(input: PriceSourceSearchInput): Promise<ComparisonCandidate[]>;
  /**
   * 점수(withConfidence)가 매겨진 «뒤에만» 할 수 있는 추가 확인. 상세 재조회는
   * matchLevel 이 very_high/high 인 후보만 대상이라(비용 상한,
   * selectCandidatesForDetailConfirmation) search() 안에서는 할 수 없다.
   * 없으면 이 단계를 건너뛴다.
   */
  enrichScored?(candidates: ComparisonCandidate[], query?: ComparisonQuery): Promise<ComparisonCandidate[]>;
}

/** 자격증명이 필요 없는 어댑터(=기존 WEB 파서 전부)가 쓰는 readiness. */
const ALWAYS_READY = (): PriceSourceReadiness => ({ state: "READY" });

/**
 * P0-A.29-E ㉮(CEO 지시, 2026-09-20) — **원상품이 고른 옵션과 «같은» 옵션의
 * 가격을 고른다.**
 *
 * 실측(junioredition, 2026-09-20): 한 상품이 사이즈마다 £115/£119/£123 이고
 * 신발 카테고리의 45%가 그렇다. 지금까지 후보 가격은 「구매 가능한 첫 옵션」
 * 이었으므로, 원상품이 UK 11 을 골랐어도 후보는 UK 4 가격과 비교되고 있었다.
 *
 * 🔴 사이즈를 «환산» 하지 않는다. 문자열이 똑같을 때만 같은 옵션으로 본다 —
 *    실측에서 샵마다 표기가 전부 달랐다(`29 EUR (UK 11)` / `29 EU (11 Little
 *    Kid US)` / `22` / `35`). 같은 샵 안에서는 옵션 값 문자열의 89%가 상품끼리
 *    재사용되어 문자열 일치가 안전하다. 샵 간 환산은 별건이다(CEO §11 금지).
 *
 * 🔴 옵션 값이 하나뿐인 상품(SINGLE_PRICE)은 애초에 어긋날 수가 없다. 그런
 *    상품까지 「확인 필요」로 만들면, 실측상 절반이 넘는 멀쩡한 가격이 이유
 *    없이 사라진다.
 */
function resolveSameOptionPrice(
  variants: CanonicalProductVariant[] | undefined,
  selected: Record<string, string> | undefined,
): {
  price?: { amount: number; currency: string };
  match?: ComparisonCandidate["priceOptionMatch"];
  optionValues?: Record<string, string>;
} {
  const priced = (variants ?? []).filter((v) => v.price != null);
  if (priced.length === 0) return {};
  const distinct = new Set(priced.map((v) => `${v.price?.amount} ${v.price?.currency}`));
  // 값이 하나면 어느 옵션을 고르든 같은 숫자다 — 판단할 것이 없다.
  if (distinct.size === 1) return { match: "SINGLE_PRICE", optionValues: priced[0].optionValues };
  if (!selected || Object.keys(selected).length === 0) return { match: "OPTION_MISMATCH" };

  const hit = priced.find((v) =>
    Object.entries(selected).every(([name, value]) => v.optionValues?.[name] === value),
  );
  if (!hit) return { match: "OPTION_MISMATCH" };
  return { price: hit.price, match: "SAME_OPTION", optionValues: hit.optionValues };
}

/** Sprint B-1.5/B-1.8 — search-suggest.json 의 가격은 신뢰하지 않는다(B-1.4 실측:
 * Vercel 에서 로케일 프리픽스를 줘도 기본 통화 숫자가 그대로 돌아옴). 검색은
 * "후보 발견"까지만 담당하고, 실제 판매가/통화는 이미 검증된 상품 상세 JSON
 * 엔드포인트(fetchShopifyProductJson, B-1.1 에서 /meta.json 기준으로 정확성
 * 확인됨)에서 다시 확정한다.
 *
 * B-1.8 — "동일상품일 가능성"(matchLevel)과 "가격을 확인했는지"(priceSource)는
 * 별개 상태다. matchLevel 이 very_high/high 인 후보만 상세 확인 대상으로 삼고,
 * 그중에서도 최대 MAX_DETAIL_CONFIRMATIONS_PER_SHOP 건까지만 실제로 요청한다.
 *
 * P-4-DATA-6 P0-2(CPO 지시, 2026-08-29) — candidate 상세조회는 항상 로케일 없는
 * 기본 URL(=매장 기준통화)만 쓴다. Shopify Markets 자체 환산 KRW 가 price 필드에
 * 섞이면 우리 앱의 Frankfurter/ECB 환율과 최대 6% 차이가 난다(실측 P-4-DATA-5).
 *
 * P-4-DATA-4(CPO 지시, 2026-08-29: "조용한 실패를 금지한다") — 검증을 시도한
 * 후보는 성공/실패 여부와 무관하게 verificationAttempted=true 를 남긴다. 실패
 * 시에는 price 필드를 건드리지 않는다(priceStatus 가 PRICE_UNAVAILABLE 이면 UI 가
 * 숫자를 절대 보여주지 않으므로 안전).
 *
 * 🔴 이 함수는 GOLF-01.5 축 C 에서 index.ts 로부터 «그대로» 옮겨 왔다. 한 줄도
 *    바꾸지 않았다 — 옮긴 이유는 Shopify 어댑터가 자기 후처리를 자기 안에
 *    숨기게 하기 위해서다. index.ts 는 계속 이 이름을 re-export 한다. */
export async function enrichCandidatePrices(
  candidates: ComparisonCandidate[],
  shopDomain: string,
  /** P0-A.29-D ㉯ — 주면 「동일 모델 · 옵션 다름」이 상세확인 슬롯에 들어온다.
   *  안 주면 예전 동작 그대로다(국내 경로). 호출 상한은 어느 쪽이든 같다. */
  query?: ComparisonQuery,
): Promise<ComparisonCandidate[]> {
  const withDefaultSource: ComparisonCandidate[] = candidates.map((c) => ({
    ...c,
    priceSource: "search",
    priceStatus: "UNVERIFIED_SEARCH",
    verificationAttempted: false,
  }));
  const eligibleIndexes = selectCandidatesForDetailConfirmation(withDefaultSource, query);
  if (eligibleIndexes.length === 0) return withDefaultSource;

  const origin = `https://www.${shopDomain.replace(/^www\./, "")}`;

  await Promise.all(
    eligibleIndexes.map(async (i) => {
      const candidate = withDefaultSource[i];
      const handle = extractShopifyHandle(candidate.url);
      if (!handle) return;
      try {
        const detail = await fetchShopifyProductJson(`${origin}/products/${handle}`);
        if (detail?.productData.price) {
          const onOption = resolveSameOptionPrice(detail.productData.variants, query?.selectedOptionValues);
          withDefaultSource[i] = {
            ...candidate,
            price: onOption.price ?? detail.productData.price,
            regularPrice: detail.productData.regularPrice ?? null,
            priceSource: "detail",
            priceStatus: "VERIFIED_CURRENT",
            verificationAttempted: true,
            priceOptionMatch: onOption.match,
            priceOptionValues: onOption.optionValues,
          };
        } else {
          withDefaultSource[i] = { ...candidate, priceStatus: "PRICE_UNAVAILABLE", verificationAttempted: true };
        }
      } catch {
        withDefaultSource[i] = { ...candidate, priceStatus: "PRICE_UNAVAILABLE", verificationAttempted: true };
      }
    }),
  );

  return withDefaultSource;
}

/** N-4.18-Q3 PART E-2/E-10(대표님 지시, 2026-08-27) — RULII/FORETFORET 둘 다 검색
 * 목록 HTML/AJAX 응답 자체에는 품절 신호가 없다(실측 확인). 반면 상세페이지에는
 * 각자 실측 검증된 soldOut 신호가 있다. 그래서 매칭 신뢰도가 높은
 * (very_high/high) 후보만, Sprint B-1.8 과 같은 상한으로 상세페이지를 재확인해
 * soldOut 을 채운다. 실패해도 매칭 결과 자체는 지우지 않고 soldOut 만 비워둔다
 * (추측 금지).
 *
 * 🔴 index.ts 에서 그대로 옮겨 왔다(enrichCandidatePrices 와 같은 이유·같은 방식). */
async function enrichSoldOutViaDetail(
  candidates: ComparisonCandidate[],
  fetchDetail: (url: string) => Promise<{ soldOut: boolean | null }>,
): Promise<ComparisonCandidate[]> {
  const eligible = selectCandidatesForDetailConfirmation(candidates);
  if (eligible.length === 0) return candidates;
  const result = [...candidates];
  await Promise.all(
    eligible.map(async (i) => {
      try {
        const detail = await fetchDetail(candidates[i].url);
        result[i] = { ...candidates[i], soldOut: detail.soldOut };
      } catch {
        // soldOut 미채움 유지 — 검색 매칭 결과 자체는 그대로 둔다
      }
    }),
  );
  return result;
}

/** N-3.11/N-3.12 Part A — 실제로 /search/suggest.json 이 표준 Shopify 응답
 * 구조를 준다고 «직접 fetch 로 확인한» 도메인만 여기 있다(2026-08-12 실측,
 * /cart.json 의 currency 필드까지 재확인). searchShopifySuggest 는 도메인에
 * 종속되지 않으므로 사이트마다 파서를 만들지 않는다. */
const SHOPIFY_SUGGEST_DOMAINS = [
  "junioredition.com",
  "nickis.com",
  "isolabellakids.com",
  "petitemaisonkids.com",
  "shoppiccoliandco.com",
  "kidswearcollective.com",
  "kidsatelier.com",
  "designerkidswear.com",
  "kidbizkid.com",
  "villagekids.co.uk",
  "folkberlin.com",
] as const;

function shopifySuggestAdapter(domain: string): PriceSourceAdapter {
  return {
    domain,
    catalog: "OVERSEAS",
    method: "WEB",
    readiness: ALWAYS_READY,
    search: ({ term, currency }) => searchShopifySuggest(domain, currency, term),
    enrichScored: (candidates, query) => enrichCandidatePrices(candidates, domain, query),
  };
}

/**
 * ── 등록부 (이 배열이 "우리가 자동으로 읽을 수 있는 소스"의 유일한 진실) ──────
 *
 * 🔴 여기에 없는 도메인은 자동으로 unsupported 가 된다. 하드코딩된 사이트
 *    «허용 목록»이 아니라 «파서 존재 여부»다 — comparison_shops 28행 ·
 *    domestic_price_sources 18행 중 실제 구현체가 있는 것만 여기 있다.
 */
const PRICE_SOURCE_ADAPTERS: PriceSourceAdapter[] = [
  ...SHOPIFY_SUGGEST_DOMAINS.map(shopifySuggestAdapter),
  {
    // Childrensalon 은 검색 HTML 자체에서 실제 판매가를 직접 파싱한다(상세
    // 페이지를 따로 조회하지 않음). P-4-DATA-4 이후 그 값도 예외 없이
    // UNVERIFIED_SEARCH 로 남는다 — 별도의 상세 조회 경로가 이 사이트에 아직
    // 없으므로 enrichScored 가 없다(withConfidence 의 derivePriceStatus 가
    // priceSource!=="detail" 이면 자동으로 그렇게 분류한다).
    domain: "childrensalon.com",
    catalog: "OVERSEAS",
    method: "WEB",
    readiness: ALWAYS_READY,
    search: ({ term, currency }) => searchChildrensalon(currency, term),
  },
  {
    // GOLF-01.5 축 C — 이 표준의 «첫 번째 실제 수집 어댑터»(CEO 지시).
    // 🔴 자격증명이 저장소·환경에 없다. readiness() 가 그 사실을 정직하게
    //    말하고, 호출부는 요청을 보내지 않는다. 키가 들어오는 순간 배선은
    //    이미 끝나 있으므로 값이 그대로 흐른다.
    domain: "rakuten.co.jp",
    catalog: "OVERSEAS",
    method: "API",
    readiness: () => {
      const missing = missingRakutenCredentials();
      return missing.length === 0 ? { state: "READY" } : { state: "NOT_CONFIGURED", missing };
    },
    search: ({ term, currency }) => searchRakutenIchiba(term, currency),
  },
  {
    domain: "looxloo.com",
    catalog: "DOMESTIC",
    method: "WEB",
    readiness: ALWAYS_READY,
    search: ({ term }) => searchLooxloo(term),
  },
  {
    // bobochoses.com 만 priceSource 를 "detail" 로 강제한다 — 검색 결과 자체가
    // 상세 가격이기 때문이다(다른 도메인은 검색 목록 가격을 그대로 쓰므로 이
    // 필드를 건드리지 않는다). index.ts 에 있던 규칙 그대로 옮겼다.
    domain: "bobochoses.com",
    catalog: "DOMESTIC",
    method: "WEB",
    readiness: ALWAYS_READY,
    search: async ({ term }) => {
      const candidates = await searchBoboChosesKorea(term);
      return candidates.map((c) => ({ ...c, priceSource: "detail" as const }));
    },
  },
  {
    domain: "rulii.co.kr",
    catalog: "DOMESTIC",
    method: "WEB",
    readiness: ALWAYS_READY,
    search: ({ term }) => searchRulii(term),
    enrichScored: (candidates) => enrichSoldOutViaDetail(candidates, fetchRuliiProductPrice),
  },
  {
    domain: "deuxbebe.com",
    catalog: "DOMESTIC",
    method: "WEB",
    readiness: ALWAYS_READY,
    search: ({ term }) => searchDeuxbebe(term),
  },
  {
    domain: "chocoel.co.kr",
    catalog: "DOMESTIC",
    method: "WEB",
    readiness: ALWAYS_READY,
    search: ({ term }) => searchChocoel(term),
  },
  {
    domain: "foretforet.com",
    catalog: "DOMESTIC",
    method: "WEB",
    readiness: ALWAYS_READY,
    search: ({ term }) => searchForetforet(term),
    enrichScored: (candidates) => enrichSoldOutViaDetail(candidates, fetchForetforetProductPrice),
  },
];

/** 실측으로 확인되지 않은 사이트(chocoel/deuxbebe)에 enrichScored 를 달지
 * 않은 것은 «아직 신호를 못 찾았다»는 뜻이지 «판매중»이라는 뜻이 아니다 —
 * soldOut 은 그대로 null 로 남는다(추측 금지, 038 주석의 원칙 그대로). */
const ADAPTER_BY_DOMAIN = new Map(PRICE_SOURCE_ADAPTERS.map((a) => [a.domain, a]));

export function findPriceSourceAdapter(
  domain: string,
  catalog: "OVERSEAS" | "DOMESTIC",
): PriceSourceAdapter | null {
  const adapter = ADAPTER_BY_DOMAIN.get(domain);
  return adapter && adapter.catalog === catalog ? adapter : null;
}

/** 테스트/감사용 — 등록부 전체를 읽기 전용으로 노출한다. */
export function listPriceSourceAdapters(): readonly PriceSourceAdapter[] {
  return PRICE_SOURCE_ADAPTERS;
}
