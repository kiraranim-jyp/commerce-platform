import { acquireDomainSlot, recordRateLimitResponse } from "../rate-limit/domain-rate-limiter";
import type { ComparisonCandidate } from "./types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * Rakuten Ichiba Item Search API — 가격소스 수집 표준의 첫 번째 API 어댑터
 * GOLF-01.5 축 C (CEO 지시, 2026-09-16)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일에는 «지어낸 응답»도 «지어낸 필드»도 없다.
 *    아래 매핑은 전부 공식 문서에서 확인한 것만이다(2026-09-16 확인):
 *      https://webservice.rakuten.co.jp/documentation/ichiba-item-search
 *      https://webservice.rakuten.co.jp/guide
 *      https://webservice.rakuten.co.jp/guide/credit
 *    문서에서 못 본 필드는 매핑하지 않았다. 픽스처도 만들지 않았다 — 실제
 *    자격증명이 없어 실제 응답을 한 번도 본 적이 없기 때문이다. 지어낸 매핑은
 *    키가 들어온 날 «조용히 틀린 가격»을 만든다.
 *
 * ── 자격증명 (저장소·환경에 없다) ───────────────────────────────────────────
 * 문서: applicationId 는 필수이고, accessKey 도 "Required along with app ID"
 * 이며 "Can be provided in either header or as query parameter" 다. 헤더 이름은
 * 문서에서 확인하지 못했으므로 «문서가 명시한» 쿼리 파라미터 방식만 쓴다.
 * 🔴 값은 코드에 두지 않는다. 환경변수 이름만 여기 적고, 값이 없으면
 *    missingRakutenCredentials() 가 그 «이름»만 돌려준다(값은 절대 로그·응답에
 *    싣지 않는다).
 *
 * ── 하나의 App ID 로 여러 API 를 쓴다 ───────────────────────────────────────
 * Item Search · Genre Search · Attribute Search 는 전부 같은 applicationId 를
 * 쓴다(각 문서가 같은 인증 파라미터를 요구한다). 즉 «사이트마다 · API 마다
 * 키를 따로 받는» 구조가 아니다 — 그래서 환경변수도 API 별이 아니라
 * 서비스(Rakuten) 단위로 둔다.
 *
 * ── 약관 (🔴 CEO 결정이 필요한 지점) ────────────────────────────────────────
 * 이용규약(https://webservice.rakuten.co.jp/guide/rule)은 금지 행위로
 * "To gain income by using the Web Services in ways other than Rakuten
 * Affiliate (excludes the cases where the Company explicitly grants
 * permission)" 를 든다. 우리 용도(상용 SaaS 안에서의 시장 가격 관측)가 이
 * 조항에 걸리는지는 문서만으로 확정할 수 없다. 그래서 이 어댑터는 오늘
 * 자격증명이 없어 **한 건의 요청도 보내지 않는다**. 키를 넣기 전에 이 조항에
 * 대한 판단이 먼저 있어야 한다.
 */

export const RAKUTEN_APPLICATION_ID_ENV = "RAKUTEN_APPLICATION_ID";
export const RAKUTEN_ACCESS_KEY_ENV = "RAKUTEN_ACCESS_KEY";

/**
 * 문서에 적힌 요청 URL 그대로다(version: 2026-07-01):
 *   https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701?[parameter]=[value]…
 */
const ENDPOINT = "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701";

const FETCH_TIMEOUT_MS = 10000;

/** 다른 파서들과 같은 상한(각 파서가 실측으로 정한 상위 5건). 문서상 hits 는
 * 1–30 이고 기본 30 이다 — 필요 이상으로 받지 않는다. */
const HITS = 5;

/** 🔴 비어 있는 환경변수 «이름»만 돌려준다. 값은 어디에도 싣지 않는다. */
export function missingRakutenCredentials(): string[] {
  const missing: string[] = [];
  if (!process.env[RAKUTEN_APPLICATION_ID_ENV]?.trim()) missing.push(RAKUTEN_APPLICATION_ID_ENV);
  if (!process.env[RAKUTEN_ACCESS_KEY_ENV]?.trim()) missing.push(RAKUTEN_ACCESS_KEY_ENV);
  return missing;
}

/**
 * 문서에서 확인한 출력 필드 중 «이 어댑터가 실제로 읽는 것»만 선언한다.
 * 문서에는 이 밖에도 catchcopy · itemCaption · affiliateRate · pointRate 등이
 * 있지만, 우리 공통 형태(ComparisonCandidate)에 대응하는 칸이 없거나
 * 뜻을 확정하지 못해 읽지 않는다.
 */
interface RakutenItem {
  /** 문서: 상품명. */
  itemName?: unknown;
  /** 문서: "URL for each item, starting with https". */
  itemUrl?: unknown;
  /** 문서: 상품 가격(long). 🔴 통화 필드는 문서의 출력 목록에 **없다**. */
  itemPrice?: unknown;
  /** 문서: 0 = 税込(tax included) · 1 = 税抜(tax not included). */
  taxFlag?: unknown;
  /** 문서: 0 = 在庫なし(out of stock) · 1 = 在庫あり(available). */
  availability?: unknown;
  /** 문서: 판매 점포명. Rakuten 市場은 마켓플레이스이므로 실제 판매처는 이 값이다. */
  shopName?: unknown;
  /** 문서: "128 pixels square" 이미지 배열. 🔴 배열 «요소의 모양»은 문서에서
   * 확인하지 못했다 — 그래서 요소가 문자열일 때만 쓴다(아래 firstImageUrl). */
  mediumImageUrls?: unknown;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * 🔴 문서에서 확인한 것: mediumImageUrls 는 "128 pixels square" 이미지들의
 *    **배열**이다. 확인하지 못한 것: 그 요소가 문자열인지 객체인지.
 *    formatVersion=2 를 보내므로 평탄한 문자열일 가능성이 높지만, 추측으로
 *    객체 필드 이름(예: imageUrl)을 지어내지 않는다 — 문자열일 때만 쓰고
 *    아니면 null 이다. 이미지가 null 이어도 매칭은 텍스트 경로로 그대로 돈다.
 */
function firstImageUrl(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  for (const entry of value) {
    const url = asString(entry);
    if (url) return url;
  }
  return null;
}

/**
 * 문서: formatVersion=1(기본)이면 `items[0].item.itemName`, formatVersion=2 면
 * `items[0].itemName` 이다. 우리는 formatVersion=2 를 보내지만, 두 모양 다
 * 문서에 적힌 «정식» 모양이므로 둘 다 받아들인다.
 *
 * 🔴 배열 키의 대소문자(items / Items)는 이 버전 문서에서 하나만 확인했다
 *    (items). 과거 버전은 Items 였다. 둘 다 받아들이는 비용은 0 이고, 한쪽만
 *    받으면 응답이 와도 "결과 0건"으로 보여 «찾지 못했다»는 거짓말이 된다 —
 *    이 저장소가 반복해서 고쳐 온 실패라 그 위험을 지지 않는다. 어느 쪽으로
 *    읽든 가격 값 자체는 달라지지 않는다.
 */
function readItems(payload: unknown): RakutenItem[] {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  const raw = Array.isArray(record.items) ? record.items : Array.isArray(record.Items) ? record.Items : [];
  return raw.map((entry) => {
    if (!entry || typeof entry !== "object") return {};
    const row = entry as Record<string, unknown>;
    const nested = row.item ?? row.Item;
    return (nested && typeof nested === "object" ? nested : row) as RakutenItem;
  });
}

/**
 * ── 매핑표 (문서에서 확인한 필드만) ─────────────────────────────────────────
 *   ComparisonCandidate        ← Rakuten 출력 필드
 *   ──────────────────────────────────────────────────────────────────────────
 *   title                      ← itemName
 *   url                        ← itemUrl
 *   price.amount               ← itemPrice
 *   price.currency             ← 🔴 응답이 아니라 **카탈로그**(comparison_shops
 *                                 .currency)가 선언한 통화. 문서의 출력 목록에
 *                                 통화 필드가 없다 — 없는 것을 지어내지 않고,
 *                                 카탈로그가 통화를 모르면 price 자체를 null 로
 *                                 둔다(숫자만 있고 통화를 모르는 값은 만들지
 *                                 않는다 — shopify-suggest.ts 와 같은 규칙).
 *   soldOut                    ← availability (0→true · 1→false · 그 외→null)
 *   sellerName                 ← shopName (마켓플레이스 안의 실제 판매 점포)
 *   imageUrl                   ← mediumImageUrls[0] (문자열인 경우에만)
 *   priceSource="detail"       ← taxFlag === 0 일 때만 (아래 주석)
 *
 *   ── 일부러 매핑하지 «않은» 것 ─────────────────────────────────────────────
 *   sku            ← itemCode 를 넣지 않는다. itemCode 는 "shop:1234" 형식의
 *                    **Rakuten 점포 상품코드**이지 제조사 품번이 아니다. 우리
 *                    sku 칸은 품번 대조(model-code/product-identity)에 쓰이므로
 *                    여기에 점포코드를 넣으면 «없던 식별자 일치»가 생긴다.
 *   brand          ← 문서 출력 목록에 브랜드 필드가 없다.
 *   regularPrice   ← 문서에 정가/할인전가 필드가 없다. itemPriceMax1/Min1 은
 *                    가격«범위» 필드이지 정가가 아니다 — 뜻을 확정하지 못해
 *                    읽지 않는다.
 *   facts          ← 문서 필드만으로는 색상·소재·핏을 확정할 수 없다. 채우지
 *                    않으면 교차판매처 판정이 기존 텍스트 경로만 쓴다(하위호환).
 */
function toCandidate(item: RakutenItem, currency: string | null): ComparisonCandidate | null {
  const title = asString(item.itemName);
  const url = asString(item.itemUrl);
  if (!title || !url) return null;

  const amount = asFiniteNumber(item.itemPrice);
  const taxFlag = asFiniteNumber(item.taxFlag);
  const availability = asFiniteNumber(item.availability);

  return {
    title,
    url,
    price: amount !== null && currency ? { amount, currency } : null,
    imageUrl: firstImageUrl(item.mediumImageUrls),
    confidence: 0,
    sellerName: asString(item.shopName) ?? undefined,
    soldOut: availability === 0 ? true : availability === 1 ? false : null,
    /**
     * 🔴 «검증된 현재가»라고 말해도 되는 유일한 조건.
     *
     * 문서가 taxFlag 를 정확히 정의한다: 0 = 세금 포함 · 1 = 세금 미포함.
     * taxFlag===0 이면 itemPrice 는 공식 API 가 그 상품에 대해 돌려준
     * «구매자가 내는 금액»이다 — 검색 목록 HTML 에서 긁은 숫자와 성격이 다르다
     * (P-4-DATA-4 가 금지한 것은 «상세 재확인 없이 신뢰한 검색 화면 숫자»이고,
     * 이건 그 소스의 공식 상품 응답 자체다).
     *
     * taxFlag 가 1 이거나 아예 없으면 «그 숫자가 최종 지불액인지»를 우리가
     * 모른다 → priceSource 를 비워 둔다. withConfidence 의 derivePriceStatus 가
     * UNVERIFIED_SEARCH 로 분류하고, 화면은 숫자를 보여주지 않는다. 세금을
     * 우리가 계산해서 더하지 않는다(세율을 문서에서 확인하지 못했다).
     */
    ...(taxFlag === 0 ? { priceSource: "detail" as const } : {}),
  };
}

/**
 * 🔴 요청 파라미터도 문서에 있는 것만 보낸다.
 *   applicationId / accessKey   필수(문서 명시)
 *   keyword                     "UTF-8 URL encoded string"
 *   hits                        1–30
 *   formatVersion=2             문서: items[0].itemName 평탄 구조
 *   availability=0              문서: 0 = 전부 · 1 = 재고 있는 것만(기본).
 *                               🔴 기본값 1 을 그대로 쓰면 품절 상품이 응답에서
 *                                  아예 빠져 «품절»과 «그 상품이 없다»가 구분되지
 *                                  않는다. 재고/상태는 MI 가 받아야 하는 7칸 중
 *                                  하나라 0 으로 명시한다.
 */
export async function searchRakutenIchiba(term: string, currency: string | null): Promise<ComparisonCandidate[]> {
  const applicationId = process.env[RAKUTEN_APPLICATION_ID_ENV]?.trim();
  const accessKey = process.env[RAKUTEN_ACCESS_KEY_ENV]?.trim();
  if (!applicationId || !accessKey) {
    // 호출부(readiness)가 이미 막았어야 하는 경로다. 여기까지 왔다면 배선이
    // 어긋난 것이므로 빈 배열로 «결과 없음»을 흉내 내지 않고 실패로 알린다.
    throw new Error("Rakuten 자격증명이 설정되어 있지 않습니다.");
  }

  const params = new URLSearchParams({
    applicationId,
    accessKey,
    keyword: term,
    hits: String(HITS),
    formatVersion: "2",
    availability: "0",
  });

  /**
   * 🔴 fetchWithDomainRateLimit 를 쓰지 않는다 — 일부러다.
   *
   * 그 헬퍼는 429 를 받으면 «다른 HTTP 스택(node:https)으로 한 번 더» 물어본다.
   * 그 동작은 Cloudflare 가 undici 를 스택 단위로 막는 HTML 사이트를 위해
   * 만들어진 것이고(domain-rate-limiter.ts 의 MI-MATCHING-3.0 STEP 0 주석),
   * **공식 API 를 상대로는 하면 안 되는 일**이다: 소스가 명시적으로 "요청이
   * 많다"고 답한 것을 다른 경로로 다시 두드리는 것은 그 소스의 속도 제한을
   * 우회하는 행위다. 규약 위반 위험을 지면서까지 얻을 값이 없다.
   *
   * 그래서 속도 제어(acquireDomainSlot — 1초 간격 · 동시 1)와 429 기록만
   * 그대로 쓰고, 재시도는 하지 않는다. 429 는 그대로 위로 올려보내
   * 화면이 "요청이 많아 확인하지 못했습니다"라고 말하게 한다.
   */
  const url = `${ENDPOINT}?${params.toString()}`;
  const release = await acquireDomainSlot(url);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    recordRateLimitResponse(url, response.status, response.headers.get("retry-after"));
  } finally {
    release();
  }
  // 문서의 상태코드: 400 파라미터 오류 · 404 데이터 없음 · 429 요청 과다 ·
  // 500 내부 오류 · 503 점검/과부하.
  // 🔴 404 는 "그 검색어로 상품을 못 찾았다"이지 오류가 아니다 — 빈 배열로
  //    돌려줘야 화면이 NO_RESULT 라고 말한다.
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`Rakuten Ichiba Item Search API ${response.status}`);

  const payload: unknown = await response.json();
  return readItems(payload)
    .map((item) => toCandidate(item, currency))
    .filter((c): c is ComparisonCandidate => c !== null);
}
