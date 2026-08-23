import { describe, expect, it } from "vitest";
import { deriveCommonImageGateStatus } from "../common-image-gate";

/**
 * N-4.08 P1-3(대표님 지시: "이중 게이트 UX 개선") — Settings의
 * top/bottomCommonImageEnabled와 상품 COMMON_IMAGE.enabled 조합 4+1가지를
 * 셀러가 이해할 수 있는 상태로 정확히 분류하는지 고정한다. 실제 payload
 * 조립 판정(assembleContentsFromBlocks의 imagesFor())과 같은 조건이어야
 * "체크했는데 왜 안 나오지?" 문제가 재발하지 않는다.
 */
describe("deriveCommonImageGateStatus", () => {
  it("이미지 URL이 없으면 다른 값과 무관하게 NOT_CONFIGURED", () => {
    expect(
      deriveCommonImageGateStatus({ sellerImageUrl: null, sellerEnabled: true, productEnabled: true }),
    ).toBe("NOT_CONFIGURED");
    expect(
      deriveCommonImageGateStatus({ sellerImageUrl: "", sellerEnabled: true, productEnabled: true }),
    ).toBe("NOT_CONFIGURED");
  });

  it("기본 설정 ON + 상품 ON → VISIBLE(실제 노출)", () => {
    expect(
      deriveCommonImageGateStatus({ sellerImageUrl: "https://x/a.jpg", sellerEnabled: true, productEnabled: true }),
    ).toBe("VISIBLE");
  });

  it("기본 설정 ON + 상품 OFF → PRODUCT_OFF(이 상품에서만 꺼짐)", () => {
    expect(
      deriveCommonImageGateStatus({ sellerImageUrl: "https://x/a.jpg", sellerEnabled: true, productEnabled: false }),
    ).toBe("PRODUCT_OFF");
  });

  it("기본 설정 OFF + 상품 ON → SELLER_OFF(설정에서 막힘)", () => {
    expect(
      deriveCommonImageGateStatus({ sellerImageUrl: "https://x/a.jpg", sellerEnabled: false, productEnabled: true }),
    ).toBe("SELLER_OFF");
  });

  it("기본 설정 OFF + 상품 OFF → BOTH_OFF(의도된 비노출, 경고 아님)", () => {
    expect(
      deriveCommonImageGateStatus({ sellerImageUrl: "https://x/a.jpg", sellerEnabled: false, productEnabled: false }),
    ).toBe("BOTH_OFF");
  });
});
