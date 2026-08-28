import { describe, expect, it } from "vitest";
import type { ListingModel, ValidationResult } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { validateSmartStoreListing } from "../validate-listing";

/**
 * N-3.68(CPO 지시, "판매자 공통 설정 통합" 작업지시서 STEP①) — 회귀 테스트.
 * 이전에는 이 함수가 product.returnPolicy(canonical-product.ts 생성 시점에
 * 항상 {value:"",source:"REQUIRED"}로 고정, SellerProfile과 무관)를 직접
 * 읽어 항상 ERROR로 판정했다 — 그 결과 Settings에 실제 반품배송비/반품지가
 * 있어도 smartstoreExecutor.execute()가 /api/smartstore/register를 호출하기
 * 전에 "교환/반품 정보가 없습니다"로 등록을 막았다(실측 확인된 버그). 이제 이
 * 함수는 CanonicalProduct를 아예 받지 않고 listing.validations(어댑터가 이미
 * 계산한 마켓플레이스 공통 필드)만 그대로 전달한다 — 반품/원산지/배송/재고/
 * 인증 판정은 서버의 validateNaverPayload(SellerProfile 기반, N-3.67 KIDS
 * 실등록 성공으로 정확성 증명됨)에게 전적으로 맡긴다.
 */
function field(overrides: Partial<ValidationResult> = {}): ValidationResult {
  return { field: "price", label: "판매가격", status: "PASS", ...overrides };
}

function makeMinimalListing(validations: ValidationResult[]): ListingModel {
  return {
    platform: "smartstore",
    platformLabel: "스마트스토어",
    representativeImage: "https://example.com/img.jpg",
    additionalImages: [],
    title: "테스트 상품",
    brand: "TestBrand",
    priceKrw: 10000,
    priceIsEstimate: false,
    priceSource: "SELLER_OVERRIDE",
    options: [],
    shippingInfo: "해외배송",
    description: "설명",
    category: UNRESOLVED_CATEGORY,
    validations,
    registrableScore: 0,
  };
}

describe("validateSmartStoreListing", () => {
  it("반품/원산지/배송/재고/인증 등 CanonicalProduct 전용 필드를 더 이상 검사하지 않는다 — marketplace validations만 반영한다", () => {
    const listing = makeMinimalListing([field({ status: "PASS" })]);
    const readiness = validateSmartStoreListing(listing);
    expect(readiness.fields.map((f) => f.field)).toEqual(["price"]);
    expect(readiness.errorCount).toBe(0);
  });

  it("Settings(SellerProfile)에 실제 반품/배송 데이터가 있어도 예전처럼 'returnPolicy' 필드로 임의 차단하지 않는다", () => {
    // 예전 버그: product.returnPolicy가 항상 REQUIRED라서 이 필드 하나만으로
    // errorCount > 0이 되어 smartstoreExecutor.execute()가 실제 등록
    // API(/api/smartstore/register)를 호출하기도 전에 막았다. 이제 이 함수는
    // product를 아예 받지 않으므로 그런 필드 자체가 존재할 수 없다.
    const listing = makeMinimalListing([field({ status: "PASS" })]);
    const readiness = validateSmartStoreListing(listing);
    expect(readiness.fields.some((f) => f.field === "returnPolicy")).toBe(false);
    expect(readiness.fields.some((f) => f.field === "countryOfOrigin")).toBe(false);
  });

  it("실제 marketplace validation(가격 등)에서 ERROR가 있으면 여전히 errorCount에 반영된다", () => {
    const listing = makeMinimalListing([
      field({ status: "ERROR", message: "판매가격을 확인할 수 없습니다." }),
    ]);
    const readiness = validateSmartStoreListing(listing);
    expect(readiness.errorCount).toBe(1);
  });

  it("카테고리 미확정이면 resolution에 '카테고리 선택'을 붙인다(기존 동작 유지)", () => {
    const listing = makeMinimalListing([
      { field: "category", label: "카테고리", status: "WARNING", message: "카테고리 추천 대기 중" },
    ]);
    const readiness = validateSmartStoreListing(listing);
    const categoryField = readiness.fields.find((f) => f.field === "category");
    expect(categoryField?.resolution).toBe("카테고리 선택");
  });
});
