import { describe, expect, it } from "vitest";
import { buildRegistrationReport } from "../registration-report";
import type { ListingResult } from "../types";

describe("buildRegistrationReport — SmartStore(Naver) payload", () => {
  it("Sprint P2 버그 회귀 방지: Naver payload도 상품명/이미지/옵션 개수를 실제 값으로 채운다", () => {
    const result: ListingResult = {
      status: "SUBMITTED",
      platform: "smartstore",
      mode: "DRY_RUN",
      retryable: false,
      submittedAt: new Date().toISOString(),
      payload: {
        originProduct: {
          statusType: "SALE",
          leafCategoryId: "50000535",
          name: "Lilibet Fleurie Embroidered Dress | Ecru",
          images: {
            representativeImage: { url: "https://example.com/main.jpg" },
            optionalImages: [{ url: "https://example.com/2.jpg" }, { url: "https://example.com/3.jpg" }],
          },
          detailContent: "<p>detail</p>",
          salePrice: 50000,
          stockQuantity: 10,
          detailAttribute: {
            optionInfo: {
              optionCombinations: [
                { optionName1: "4-5 Years", stockQuantity: 5, price: 0 },
                { optionName1: "6-7 Years", stockQuantity: 5, price: 0 },
              ],
            },
          },
        },
      },
    };

    const report = buildRegistrationReport(result);

    expect(report.outcome).toBe("SUCCESS");
    if (report.outcome === "SUCCESS") {
      expect(report.productName).toBe("Lilibet Fleurie Embroidered Dress | Ecru");
      expect(report.imageCount).toBe(3);
      expect(report.optionCount).toBe(2);
    }
  });

  it("Coupang payload는 기존 동작(sellerProductName/items) 그대로 유지한다", () => {
    const result: ListingResult = {
      status: "SUBMITTED",
      platform: "coupang",
      mode: "DRY_RUN",
      retryable: false,
      submittedAt: new Date().toISOString(),
      payload: {
        sellerProductName: "Test Coupang Product",
        items: [
          {
            images: [{ imageOrder: 0, imageType: "REPRESENTATION", vendorPath: "https://example.com/a.jpg" }],
            searchTags: ["tag1", "tag2"],
          },
        ],
      },
    };

    const report = buildRegistrationReport(result);

    expect(report.outcome).toBe("SUCCESS");
    if (report.outcome === "SUCCESS") {
      expect(report.productName).toBe("Test Coupang Product");
      expect(report.imageCount).toBe(1);
      expect(report.optionCount).toBe(2);
    }
  });
});
