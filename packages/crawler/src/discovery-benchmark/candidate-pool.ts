import type { DiscoveredUrl, ResolvedCandidate } from "./types";

/**
 * MI-DISCOVERY-LONGSPRINT-P1 §5 — Candidate Pool / Dedup.
 *
 * 🔴 **판매처를 합치지 않는다.** 지시서 §9(P0 판): 「동일 상품으로 보이는 URL 이
 *    여러 개라도 seller/source 는 각각 보존」. 그래서 중복 제거 키에 origin 이
 *    항상 들어간다 — Little Luna 와 Donokids 가 같은 상품을 팔아도 두 관측이다.
 *
 * 🔴 그리고 **쿼리스트링을 통째로 버리지 않는다.** 이 저장소는 `?variant=` 를
 *    버렸다가 「UK 11 을 골라 준 URL 이 가장 싼 UK 4 가격으로 바뀐」 사고를 냈다
 *    (P0-A.29-E). 지우는 것은 «추적 파라미터» 뿐이다.
 */

/** 🔴 화이트리스트가 아니라 블랙리스트다 — 모르는 파라미터는 «남긴다»(의미가 있을
 *  수 있다). 이미지 중복제거 때 utm 으로 가드가 우회된 전례와 같은 축이다. */
const TRACKING_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
  "gclid", "fbclid", "msclkid", "ref", "ref_src", "_ga", "_gl", "yclid", "igshid",
];

/** 중복 판단용 «표현» 만 정규화한다. 🔴 반환값을 크롤러에 넘기지 않는다 —
 *  크롤러용 URL 은 url-resolver 의 toCrawlerUrl 이 따로 만든다. */
export function normalizeForDedupe(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    for (const p of TRACKING_PARAMS) parsed.searchParams.delete(p);
    // 끝의 `/` 하나만 떼어 낸다(루트는 그대로 둔다).
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    parsed.searchParams.sort();
    return parsed.toString();
  } catch {
    return url;
  }
}

export interface PooledUrl {
  url: string;
  provenance: DiscoveredUrl[];
}

/**
 * 여러 provider·여러 쿼리가 돌려준 URL 을 하나의 풀로 모은다.
 * 🔴 provenance 를 «버리지 않는다» — 「어느 Lane·어느 쿼리가 이걸 찾았는가」가
 *    Query 별 Recall 과 Lane 비교의 유일한 근거다.
 */
export function poolDiscovered(discovered: DiscoveredUrl[]): PooledUrl[] {
  const byKey = new Map<string, PooledUrl>();
  for (const d of discovered) {
    const key = normalizeForDedupe(d.url);
    const existing = byKey.get(key);
    if (existing) {
      existing.provenance.push(d);
      continue;
    }
    byKey.set(key, { url: d.url, provenance: [d] });
  }
  return [...byKey.values()];
}

/**
 * 해석이 끝난 뒤 2차 병합 — 서로 다른 검색 URL 이 **같은 상품**으로 해석될 수 있다
 * (실측: `/products/x` 와 `/en-kr/collections/y/products/x` 는 같은 상품이다).
 *
 * 🔴 `dedupeKey` 가 null 인 것(크롤 불가)은 병합하지 않고 각각 남긴다 — 실패 원인이
 *    서로 다를 수 있고, 합치면 §13 분류에서 건수를 잃는다.
 */
export function mergeResolved(resolved: ResolvedCandidate[]): ResolvedCandidate[] {
  const byKey = new Map<string, ResolvedCandidate>();
  const unkeyed: ResolvedCandidate[] = [];
  for (const r of resolved) {
    if (r.dedupeKey === null) {
      unkeyed.push(r);
      continue;
    }
    const existing = byKey.get(r.dedupeKey);
    if (!existing) {
      byKey.set(r.dedupeKey, { ...r, provenance: [...r.provenance] });
      continue;
    }
    existing.provenance.push(...r.provenance);
  }
  return [...byKey.values(), ...unkeyed];
}

/** 🔴 「몇 개를 보류했는가」를 숫자로 남긴다 — 조용히 버리면 §13 이 비어 버린다. */
export interface PoolSummary {
  total: number;
  productPage: number;
  listingPageHeld: number;
  notFound: number;
  unknownPage: number;
  unusable: number;
  crawlable: number;
}

export function summarizePool(resolved: ResolvedCandidate[]): PoolSummary {
  const s: PoolSummary = {
    total: resolved.length,
    productPage: 0,
    listingPageHeld: 0,
    notFound: 0,
    unknownPage: 0,
    unusable: 0,
    crawlable: 0,
  };
  for (const r of resolved) {
    if (r.classification === "PRODUCT_PAGE") s.productPage += 1;
    else if (r.classification === "LISTING_PAGE") s.listingPageHeld += 1;
    else if (r.classification === "NOT_FOUND") s.notFound += 1;
    else if (r.classification === "UNKNOWN_PAGE") s.unknownPage += 1;
    else s.unusable += 1;
    if (r.classification === "PRODUCT_PAGE" && r.crawlerUrl !== null) s.crawlable += 1;
  }
  return s;
}
