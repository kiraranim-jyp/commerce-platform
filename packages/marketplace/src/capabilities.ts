import type { PlatformId } from "@commerce/shared";

/**
 * Sprint A-0(CEO/CPO 지시, 2026-08-09) — PlatformPreview.tsx에 흩어져 있던
 * `listing.platform === "coupang"` 4곳(배송 안내 문구/SellerProfileSummaryCard/
 * DetailPageEditor/CoupangPayloadInspector 노출 여부)을 한 곳으로 모은다. 새
 * 플랫폼을 추가할 때 이 파일 하나에 항목만 추가하면 되고, UI 컴포넌트 쪽에는
 * 문자열 비교가 늘어나지 않는다 — 지금은 순수 리팩터링이라 각 플랫폼의 값은
 * 기존 분기와 정확히 동일하게 맞춘다(coupang만 true, 나머지는 전부 false).
 */
export interface MarketplaceCapabilities {
  /** Detail Page Editor(상세페이지 블록 에디터) 노출 여부 — 지금은 Coupang만
   * DetailPageBlock 모델을 갖고 있다. */
  hasDetailPageEditor: boolean;
  /** SellerProfileSummaryCard(배송 정책·반품/교환 요약 카드) 노출 여부 — 지금은
   * Coupang만 SellerProfile과 연동되어 있다. */
  hasSellerProfileSummary: boolean;
  /** 실제 등록 API에 보낼 payload 그대로 보여주는 Inspector 노출 여부. */
  hasPayloadInspector: boolean;
}

export interface MarketplaceDescriptor {
  id: PlatformId;
  label: string;
  capabilities: MarketplaceCapabilities;
}

export const MARKETPLACE_DESCRIPTORS: Record<PlatformId, MarketplaceDescriptor> = {
  coupang: {
    id: "coupang",
    label: "쿠팡",
    capabilities: {
      hasDetailPageEditor: true,
      hasSellerProfileSummary: true,
      hasPayloadInspector: true,
    },
  },
  smartstore: {
    id: "smartstore",
    label: "스마트스토어",
    capabilities: {
      hasDetailPageEditor: false,
      hasSellerProfileSummary: false,
      hasPayloadInspector: false,
    },
  },
  elevenst: {
    id: "elevenst",
    label: "11번가",
    capabilities: {
      hasDetailPageEditor: false,
      hasSellerProfileSummary: false,
      hasPayloadInspector: false,
    },
  },
};
