import { enrichCandidatePrices } from "./comparison-search";
import { withConfidence, type MatchLevel } from "./comparison-search/match";
import { searchShopifySuggest } from "./comparison-search/shopify-suggest";

/**
 * Sprint N-3.6(개정 Part C/D) — Brand Origin Price Resolver.
 *
 * CPO 지시: 상품이 실제로 팔리고 있는 판매처(예: junioredition.com)의 가격이 아니라
 * 브랜드 본국 공식 사이트(예: Konges Sløjd라면 kongessloejd.com)의 원본가격을
 * "기준가"로 삼는다. 실측(2026-08-11) — Konges Sløjd Lemon Teether를 kongessloejd.com
 * 공식 Shopify 스토어에서 직접 조회하면 22.95 EUR(meta.json 기준 통화, DK 소재 회사지만
 * 통화는 DKK가 아니라 EUR)로 확인됐다 — CPO가 제시한 149.95 DKK(다른 출처의 수치로
 * 추정)와 달랐다. 이건 "관측하지 않고 인용된 값보다 실제 fetch를 신뢰한다"는 원칙을
 * 그대로 보여주는 사례다.
 *
 * 이미 검증된 comparison-search 모듈(Sprint B-1, junioredition.com/childrensalon.com
 * 전용으로 만들어졌던 것)의 부품을 그대로 재사용한다 — searchShopifySuggest(검색으로
 * 후보 발견, 가격은 신뢰하지 않음)/withConfidence(규칙 기반 매칭, AI 미사용)/
 * enrichCandidatePrices(고신뢰 후보만 실제 상품 상세 JSON으로 가격 재확인). 새 fetch
 * 로직이나 매칭 로직을 새로 만들지 않는다. 유일한 차이는 대상 도메인이 하드코딩된
 * comparison-search 사이트 목록이 아니라 BrandProfile.officialWebsite(판매자가
 * 직접 입력, 브랜드 본국 공식 사이트로 확인한 값)이라는 것뿐이다.
 *
 * Shopify가 아닌 공식 사이트는 지원하지 않는다(search/suggest.json이 없으면 후보를
 * 못 찾음) — 이 경우도 추측하지 않고 MISSING으로 남긴다.
 */
export interface BrandOriginPriceResult {
  status: "READY" | "MISSING" | "BLOCKED";
  price: { amount: number; currency: string; sourceUrl: string } | null;
  reason: string;
  matchLevel?: MatchLevel;
}

export async function resolveBrandOriginPrice(
  officialWebsite: string | null,
  title: string,
  brand: string | null,
): Promise<BrandOriginPriceResult> {
  if (!officialWebsite) {
    return {
      status: "MISSING",
      price: null,
      reason: "브랜드 프로필에 공식 사이트가 입력되어 있지 않습니다 — Settings에서 입력하면 확인을 시도합니다.",
    };
  }

  let domain: string;
  try {
    domain = new URL(officialWebsite).hostname.replace(/^www\./, "");
  } catch {
    return { status: "BLOCKED", price: null, reason: "브랜드 공식 사이트 URL 형식이 올바르지 않습니다." };
  }

  let candidates;
  try {
    candidates = await searchShopifySuggest(domain, null, title);
  } catch {
    // Shopify가 아니거나(suggest.json 없음) 네트워크 오류 — 추측하지 않고 MISSING.
    return {
      status: "MISSING",
      price: null,
      reason: `브랜드 공식 사이트(${domain})에서 검색을 시도했지만 확인하지 못했습니다(Shopify 사이트가 아니거나 접근 실패).`,
    };
  }
  if (candidates.length === 0) {
    return { status: "MISSING", price: null, reason: `브랜드 공식 사이트(${domain})에서 이 상품을 찾지 못했습니다.` };
  }

  const scored = withConfidence({ title, brand: brand ?? undefined }, candidates);
  const enriched = await enrichCandidatePrices(scored, domain, undefined);
  const confirmed = enriched.find((c) => c.priceSource === "detail" && c.price);

  if (!confirmed || !confirmed.price) {
    const top = scored[0];
    return {
      status: "MISSING",
      price: null,
      reason: top
        ? `브랜드 공식 사이트에서 확실히 일치하는 상품의 실제 가격을 확인하지 못했습니다(최고 신뢰도 ${Math.round(top.confidence * 100)}%, ${top.matchLevel ?? "low"}).`
        : `브랜드 공식 사이트(${domain})에서 이 상품을 찾지 못했습니다.`,
    };
  }

  return {
    status: "READY",
    price: { amount: confirmed.price.amount, currency: confirmed.price.currency, sourceUrl: confirmed.url },
    reason: `브랜드 공식 사이트(${domain})에서 실제 가격을 확인했습니다(신뢰도 ${Math.round(confirmed.confidence * 100)}%, ${confirmed.matchLevel}).`,
    matchLevel: confirmed.matchLevel,
  };
}
