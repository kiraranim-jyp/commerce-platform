/** N-4.08 P1-3(대표님 지시: "이중 게이트 UX 개선") — 공통 상단/하단 이미지가
 * 실제로 노출되려면 Settings의 top/bottomCommonImageEnabled와 상품
 * COMMON_IMAGE.enabled가 둘 다 true여야 한다(assembleContentsFromBlocks의
 * imagesFor()가 이미 이렇게 판정한다 — 이 파일은 그 판정 로직을 바꾸지 않고
 * 같은 조건을 셀러가 읽을 수 있는 상태로만 분류한다). 별도 파일로 분리한
 * 이유: DetailPageEditor.tsx는 "@/components/ui/*"를 가져오는 "use client"
 * 컴포넌트라 vitest(경로 alias 미설정)에서 직접 import할 수 없다. */
export type CommonImageGateStatus = "VISIBLE" | "PRODUCT_OFF" | "SELLER_OFF" | "BOTH_OFF" | "NOT_CONFIGURED";

export function deriveCommonImageGateStatus(params: {
  sellerImageUrl: string | null;
  sellerEnabled: boolean;
  productEnabled: boolean;
}): CommonImageGateStatus {
  if (!params.sellerImageUrl) return "NOT_CONFIGURED";
  if (params.sellerEnabled && params.productEnabled) return "VISIBLE";
  if (params.sellerEnabled && !params.productEnabled) return "PRODUCT_OFF";
  if (!params.sellerEnabled && params.productEnabled) return "SELLER_OFF";
  return "BOTH_OFF";
}
