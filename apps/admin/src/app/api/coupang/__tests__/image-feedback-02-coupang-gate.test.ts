import { describe, expect, it } from "vitest";
import { missingSellerConfigFields } from "../register/route";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-STORAGE-FEEDBACK-02 (CEO 확정, 2026-09-30) — 쿠팡 CP006 축
 * **대표 이미지는 차단, 추가 이미지는 차단하지 않는다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 payload 를 «손으로» 짠다. 어댑터를 통과시키면 어댑터가 이미 안전하지 않은
 * URL 을 버려서 이 게이트에 도달하는 나쁜 값을 만들 수 없다 — 그러면 게이트를
 * 재는 게 아니라 어댑터를 두 번 재는 것이 된다. 어댑터 축은 형제 파일
 * (packages/marketplace/.../data-uri-registration-guard.test.ts)이 맡는다.
 */

const DATA_URI = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBD";
const SAFE = "https://example.supabase.co/storage/v1/object/public/product-images/a.jpg";

/** 이미지 외 필드는 «전부 채워» 둔다 — 다른 사유가 섞이면 무엇을 재는지 흐려진다. */
function payloadWithImages(images: { imageOrder: number; imageType: string; vendorPath: string }[]) {
  return {
    displayCategoryCode: 63955,
    deliveryCompanyCode: "CJGLS",
    returnCenterCode: "1000274592",
    returnChargeName: "반품지",
    companyContactNumber: "02-000-0000",
    returnZipCode: "06236",
    returnAddress: "서울시 강남구",
    outboundShippingPlaceCode: 74010,
    vendorUserId: "wing-id",
    items: [{ images }],
  } as never;
}

describe("⑨ 쿠팡 CP006 — 대표만 막는다", () => {
  it("🔴 대표 정상 + 추가 이미지가 없어도(어댑터가 버려서) 막지 않는다", () => {
    const missing = missingSellerConfigFields(
      payloadWithImages([{ imageOrder: 0, imageType: "REPRESENTATION", vendorPath: SAFE }]),
    );
    expect(missing).toEqual([]);
  });

  it("🔴 추가 이미지가 안전하지 않아도 «차단하지 않는다» — CEO 결정 2", () => {
    const missing = missingSellerConfigFields(
      payloadWithImages([
        { imageOrder: 0, imageType: "REPRESENTATION", vendorPath: SAFE },
        { imageOrder: 1, imageType: "DETAIL", vendorPath: DATA_URI },
        { imageOrder: 2, imageType: "DETAIL", vendorPath: DATA_URI },
      ]),
    );
    expect(missing).toEqual([]);
  });

  it("대표가 data: 면 차단한다", () => {
    const missing = missingSellerConfigFields(
      payloadWithImages([{ imageOrder: 0, imageType: "REPRESENTATION", vendorPath: DATA_URI }]),
    );
    expect(missing).toContain("대표 이미지");
  });

  it("🔴 대표가 «빠진» payload 도 차단한다 — 장수만 세던 구멍", () => {
    /* 어댑터가 안전하지 않은 대표를 버리면 대표는 «사라지고» 추가 이미지만 남는다.
       그때 images.length 는 0 이 아니라서, 장수만 세던 기존 한 줄은 통과시켰다. */
    const missing = missingSellerConfigFields(
      payloadWithImages([{ imageOrder: 1, imageType: "DETAIL", vendorPath: SAFE }]),
    );
    expect(missing).toContain("대표 이미지");
  });

  it("이미지가 아예 0장이면 기존과 같이 차단한다 (회귀)", () => {
    expect(missingSellerConfigFields(payloadWithImages([]))).toContain("대표 이미지");
  });
});
