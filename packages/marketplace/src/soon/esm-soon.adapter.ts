import type { CanonicalProduct } from "@commerce/shared";
import { resolveSoonConnectionStatus, type SoonConnectionStatus } from "./connection-status";
import { buildSoonPayload, validateSoonPayload, type SoonMarketplacePayload } from "./payload";
import type {
  AttributeResolution,
  CategoryResolution,
  DeliveryResolution,
  NextGenMarketplaceAdapter,
  OptionResolution,
  PayloadBuildResult,
  RegistrationResult,
  ValidationResult,
} from "./types";

/** ESM Plus 공식 API 스펙 문서를 아직 확보하지 못했다 — elevenst와 같은 이유. */
const ESM_API_SPEC_CONFIRMED = false;

/**
 * PART O-2(대표님 지시: "2순위 — G마켓/옥션(ESM), 둘을 하나의 ESM 계열
 * 어댑터 전략으로 검토") — ESM(이스크로마켓, G마켓+옥션 통합 API)을 하나의
 * 어댑터로 묶는다(실제로 ESM Plus라는 이름의 통합 판매자 API가 두 마켓을
 * 함께 다룬다고 알려져 있으나, 이번 세션엔 credential/공식 문서가 없어
 * 실제 필드는 검증하지 못했다 — elevenst-soon.adapter.ts와 같은 이유로
 * 전부 NOT_AVAILABLE로 정직하게 남긴다).
 */
export const ESM_SOON_ADAPTER_ID = "esm";

const notAvailable = (reason: string) => ({ status: "NOT_AVAILABLE" as const, reason });

export const esmSoonAdapter: NextGenMarketplaceAdapter<SoonMarketplacePayload> = {
  id: ESM_SOON_ADAPTER_ID,
  label: "G마켓/옥션(ESM)",
  status: "SOON",

  resolveConnectionStatus(hasCredentials: boolean): SoonConnectionStatus {
    return resolveSoonConnectionStatus(hasCredentials, ESM_API_SPEC_CONFIRMED);
  },

  resolveCategory(): CategoryResolution {
    return { ...notAvailable("ESM 카테고리 API 연동 전(SOON) — 공식 스펙 확보 필요"), categoryId: null, categoryName: null };
  },

  resolveOptions(): OptionResolution {
    return { ...notAvailable("ESM 옵션 API 연동 전(SOON)"), options: [] };
  },

  resolveAttributes(): AttributeResolution {
    return { ...notAvailable("ESM 상품속성 API 연동 전(SOON)"), attributes: [] };
  },

  resolveDelivery(): DeliveryResolution {
    return notAvailable("ESM 배송 프로필 연동 전(SOON)");
  },

  buildPayload(product: CanonicalProduct): PayloadBuildResult<SoonMarketplacePayload> {
    return buildSoonPayload(product);
  },

  validate(payload: SoonMarketplacePayload): ValidationResult {
    return validateSoonPayload(payload);
  },

  async register(): Promise<RegistrationResult> {
    return {
      status: "NOT_IMPLEMENTED",
      message: "G마켓/옥션(ESM)은 SOON 상태입니다 — 이번 스프린트에서는 실제 등록 API를 호출하지 않습니다.",
    };
  },
};
