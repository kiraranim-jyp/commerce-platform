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
  /** SellerProfileSummaryCard(배송 정책·반품/교환 요약 카드) 노출 여부 — 지금은
   * Coupang만 SellerProfile과 연동되어 있다. */
  hasSellerProfileSummary: boolean;
  /** 실제 등록 API에 보낼 payload 그대로 보여주는 Inspector 노출 여부. */
  hasPayloadInspector: boolean;
  /** Sprint N-2.7 — Naver v2 payload 미리보기(Section/ValidationSummary/Raw
   * Payload)를 보여줄지. 지금은 smartstore(=네이버)만 대상이다. */
  hasNaverPreview: boolean;
  /** Sprint N-2.7 — 실제 등록 버튼을 누를 수 있는지. false면 RegistrationReadinessCard가
   * 항상 비활성 상태로 "Preview 전용" 문구를 보여준다. smartstore는 아직 실제 등록
   * executor가 NOT_IMPLEMENTED라(안전하긴 하지만) 이번 Sprint는 "Preview + Validation"이
   * 목적이라 버튼 자체를 막는다(CPO 지시). */
  registrationEnabled: boolean;
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
      hasSellerProfileSummary: true,
      hasPayloadInspector: true,
      hasNaverPreview: false,
      registrationEnabled: true,
    },
  },
  smartstore: {
    id: "smartstore",
    label: "스마트스토어",
    capabilities: {
      // Sprint P1(CPO 지시, 2026-08-19: "SmartStore도 Coupang 수준으로") —
      // detailBlocks 데이터 모델/조립 로직(assembleNaverDetailContent, Naver
      // build-payload.ts)은 이미 Coupang과 같은 블록을 공유하도록 만들어져
      // 있었다(N-3.13 Part J) — UI 노출만 꺼져 있었다. register API/executor도
      // 이번 스프린트에서 같이 배선했다(CommerceWorkspace.tsx/
      // smartstore.executor.ts/api/smartstore/register/route.ts).
      // Sprint P1(CPO 지시, 2026-08-19: "배송정책·반품/교환 카드 추가") —
      // Coupang의 SellerProfileSummaryCard는 그대로 못 쓴다(Coupang 출고지
      // API로만 이름을 조회하는 값이 섞여 있다). PlatformPreview.tsx는 이
      // 플래그가 true면 platform에 따라 다른 컴포넌트(NaverSellerProfileSummaryCard)
      // 를 렌더한다.
      hasSellerProfileSummary: true,
      hasPayloadInspector: false,
      hasNaverPreview: true,
      // N-3.26(CPO 지시, 2026-08-13) — 서버 register route(N-3.25)가 완성되고
      // 첫 실등록 검증 단계로 넘어가면서 최소 범위로 켠다. Coupang/11번가는
      // 영향받지 않는다(플랫폼별 독립 항목). 이 값이 true여도 실제 등록
      // 버튼은 RegistrationReadinessCard의 Readiness=PASS 판정을 여전히
      // 통과해야 눌리고, register route도 validateNaverPayload가 ok가
      // 아니면 실제 API 호출 전에 막는다 — "버튼이 보인다"가 "등록이
      // 항상 성공한다"를 뜻하지 않는다.
      registrationEnabled: true,
    },
  },
  elevenst: {
    id: "elevenst",
    label: "11번가",
    capabilities: {
      hasSellerProfileSummary: false,
      hasPayloadInspector: false,
      hasNaverPreview: false,
      registrationEnabled: false,
    },
  },
};
