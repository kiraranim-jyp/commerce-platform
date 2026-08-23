import type { DomesticPriceListing, DomesticPriceSearchResult, DomesticPriceSource } from "./types";

/** 테스트/PART R(SOON 어댑터와 같은 패턴) 전용 — 실제 네트워크 호출 없이
 * 결정론적 결과를 돌려준다. 실제 credential 없이도 다운스트림 집계/판단
 * 로직(summarizeDomesticMarket, computePriceDecision)을 검증할 수 있다. */
export function createMockDomesticPriceSource(fixedListings: DomesticPriceListing[]): DomesticPriceSource {
  return {
    id: "MOCK",
    label: "Mock 국내 가격비교",
    async search(): Promise<DomesticPriceSearchResult> {
      if (fixedListings.length === 0) {
        return { status: "NO_RESULTS", source: "MOCK", listings: [] };
      }
      return { status: "OK", source: "MOCK", listings: fixedListings };
    },
  };
}
