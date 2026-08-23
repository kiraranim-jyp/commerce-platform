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

/** 11번가 Open API 공식 카테고리/옵션/속성 스펙 문서를 아직 확보하지 못했다 —
 * credential이 들어와도 이 상수가 true가 되기 전까진 NOT_AVAILABLE을 유지한다. */
const ELEVENST_API_SPEC_CONFIRMED = false;

/**
 * PART O-1(대표님 지시: "1순위 — 11번가") — 실제 11번가 Open API 카테고리/
 * 옵션/속성 스펙 문서를 아직 확보하지 못했다("무단 크롤링/API 스펙 추정
 * 금지" 원칙과 같은 이유로, 모르는 걸 안다고 지어내지 않는다). 그래서
 * resolveCategory/resolveOptions/resolveAttributes/resolveDelivery는 전부
 * NOT_AVAILABLE을 정직하게 돌려준다 — "이 마켓에서 아직 구현 안 됨"과
 * "이 상품에서 못 찾음(UNRESOLVED)"을 구분해야 하기 때문이다. credential
 * (ELEVENST_API_KEY/SECRET)이 실제로 들어오고 공식 문서를 확보하면 이
 * 자리에 진짜 매핑 로직을 채운다.
 */
export const ELEVENST_SOON_ADAPTER_ID = "elevenst";

const notAvailable = (reason: string) => ({ status: "NOT_AVAILABLE" as const, reason });

export const elevenstSoonAdapter: NextGenMarketplaceAdapter<SoonMarketplacePayload> = {
  id: ELEVENST_SOON_ADAPTER_ID,
  label: "11번가",
  status: "SOON",

  resolveConnectionStatus(hasCredentials: boolean): SoonConnectionStatus {
    return resolveSoonConnectionStatus(hasCredentials, ELEVENST_API_SPEC_CONFIRMED);
  },

  resolveCategory(): CategoryResolution {
    return { ...notAvailable("11번가 카테고리 API 연동 전(SOON) — 공식 스펙 확보 필요"), categoryId: null, categoryName: null };
  },

  resolveOptions(): OptionResolution {
    return { ...notAvailable("11번가 옵션 API 연동 전(SOON)"), options: [] };
  },

  resolveAttributes(): AttributeResolution {
    return { ...notAvailable("11번가 상품속성 API 연동 전(SOON)"), attributes: [] };
  },

  resolveDelivery(): DeliveryResolution {
    return notAvailable("11번가 배송 프로필 연동 전(SOON)");
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
      message: "11번가는 SOON 상태입니다 — 이번 스프린트에서는 실제 등록 API를 호출하지 않습니다.",
    };
  },
};
