import { resolveListingPrice } from "@commerce/pricing";
import type { CanonicalProduct } from "@commerce/shared";
import type { PayloadBuildResult, PayloadIssue } from "./types";

/**
 * PART P(대표님 지시) — 두 SOON 어댑터(11번가/ESM)가 공유하는 최소 공통
 * payload 형태. 실제 11번가/G마켓·옥션 Open API 필드명을 안다고 가정하지
 * 않는다(공식 문서를 확보하지 못했다) — CanonicalProduct에서 이미 확실히
 * 있는 값(상품명/브랜드/가격/이미지)만 채우고, 마켓별 실제 스펙은 credential이
 * 생기고 공식 문서를 확보한 뒤 이 구조를 확장한다.
 */
export interface SoonMarketplacePayload {
  productName: string;
  brand: string | null;
  priceKrw: number;
  currency: "KRW";
  representativeImageUrl: string | null;
}

export function buildSoonPayload(product: CanonicalProduct): PayloadBuildResult<SoonMarketplacePayload> {
  const issues: PayloadIssue[] = [];

  const productName = product.title.value.trim();
  if (!productName) {
    issues.push({ field: "productName", severity: "BLOCKED", reason: "상품명이 비어 있습니다." });
  }

  const priceAmount = product.price.value.amount;
  const priceCurrency = product.price.value.currency;
  if (!priceAmount || priceAmount <= 0) {
    issues.push({ field: "priceKrw", severity: "BLOCKED", reason: "판매가격을 확인할 수 없습니다." });
  }
  // P-4-H1-2-2 — 다른 어댑터와 동일한 resolveListingPrice() 사용(override 없을 때
  // 원본가를 마진 0%로 그냥 환산하지 않는다).
  const priceKrw =
    resolveListingPrice({
      priceOverrideKrw: product.priceOverrideKrw?.value,
      originalAmount: priceAmount,
      originalCurrency: priceCurrency,
      priceBreakdown: product.priceBreakdown,
      priceValidity: product.priceValidity,
    }).priceKrw ?? 0;

  const representativeImageEntry = product.images.find((img) => img.isRepresentative);
  if (!representativeImageEntry) {
    issues.push({ field: "representativeImageUrl", severity: "MISSING", reason: "대표 이미지가 지정되지 않았습니다." });
  }

  if (issues.some((i) => i.severity === "BLOCKED")) {
    return { payload: null, issues };
  }

  return {
    payload: {
      productName,
      brand: product.brand.value.trim() || null,
      priceKrw,
      currency: "KRW",
      representativeImageUrl: representativeImageEntry?.originalUrl ?? null,
    },
    issues,
  };
}

export function validateSoonPayload(payload: SoonMarketplacePayload): { ok: boolean; issues: PayloadIssue[] } {
  const issues: PayloadIssue[] = [];
  if (!payload.productName.trim()) issues.push({ field: "productName", severity: "BLOCKED", reason: "상품명이 비어 있습니다." });
  if (payload.priceKrw <= 0) issues.push({ field: "priceKrw", severity: "BLOCKED", reason: "판매가격이 0 이하입니다." });
  return { ok: issues.every((i) => i.severity !== "BLOCKED"), issues };
}
