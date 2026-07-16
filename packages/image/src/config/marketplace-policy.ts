import type { ImageType } from "@commerce/shared";

export interface MarketplaceImagePolicy {
  marketplace: string;
  width: number;
  height: number;
  background: "white" | "transparent";
  jpegQuality: number;
  removeBackgroundFor: ImageType[];
  /** 가로/세로 모두 이 값보다 작을 때만 업스케일한다. */
  upscaleThresholdWidth: number;
  upscaleThresholdHeight: number;
  /** PRODUCT 캔버스에서 제품이 차지해야 할 면적 비율(0~1). 88~92% 범위의 목표값. */
  productFillRatio: number;
}

export const NAVER_IMAGE_POLICY: MarketplaceImagePolicy = {
  marketplace: "NAVER",
  width: 1500,
  height: 2000,
  background: "white",
  jpegQuality: 95,
  removeBackgroundFor: ["PRODUCT"],
  upscaleThresholdWidth: 1500,
  upscaleThresholdHeight: 2000,
  productFillRatio: 0.9,
};

/** 쿠팡/Shopify 등 다른 채널 추가 시 이 맵에 정책만 추가하면 동일한 파이프라인을 재사용할 수 있다. */
export const MARKETPLACE_POLICIES: Record<string, MarketplaceImagePolicy> = {
  NAVER: NAVER_IMAGE_POLICY,
  COUPANG: { ...NAVER_IMAGE_POLICY, marketplace: "COUPANG", width: 1000, height: 1000 },
  SHOPIFY: { ...NAVER_IMAGE_POLICY, marketplace: "SHOPIFY", width: 2048, height: 2048 },
};

/** .env로 정책 값을 오버라이드할 수 있게 한다. 기본값은 NAVER 정책. */
export function loadImagePolicy(): MarketplaceImagePolicy {
  const base = MARKETPLACE_POLICIES[process.env.MARKETPLACE ?? "NAVER"] ?? NAVER_IMAGE_POLICY;

  return {
    marketplace: base.marketplace,
    width: Number(process.env.IMAGE_STANDARD_WIDTH ?? base.width),
    height: Number(process.env.IMAGE_STANDARD_HEIGHT ?? base.height),
    background:
      (process.env.IMAGE_STANDARD_BACKGROUND as "white" | "transparent" | undefined) ??
      base.background,
    jpegQuality: Number(process.env.IMAGE_STANDARD_JPEG_QUALITY ?? base.jpegQuality),
    removeBackgroundFor: (
      process.env.IMAGE_REMOVE_BACKGROUND_FOR ?? base.removeBackgroundFor.join(",")
    )
      .split(",")
      .map((value) => value.trim()) as ImageType[],
    upscaleThresholdWidth: Number(
      process.env.IMAGE_UPSCALE_THRESHOLD_WIDTH ?? base.upscaleThresholdWidth,
    ),
    upscaleThresholdHeight: Number(
      process.env.IMAGE_UPSCALE_THRESHOLD_HEIGHT ?? base.upscaleThresholdHeight,
    ),
    productFillRatio: Number(process.env.IMAGE_PRODUCT_FILL_RATIO ?? base.productFillRatio),
  };
}

/**
 * 가로/세로 모두 표준 규격보다 작을 때만 업스케일이 필요하다.
 * 한쪽 변만 기준보다 작은 경우(예: 1800x900)는 "inside" 리사이즈만으로
 * 캔버스에 맞출 수 있으므로 업스케일 대상이 아니다.
 */
export function needsUpscale(
  width: number,
  height: number,
  policy: MarketplaceImagePolicy,
): boolean {
  return width < policy.upscaleThresholdWidth && height < policy.upscaleThresholdHeight;
}
