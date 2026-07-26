import type { ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct } from "@commerce/shared";
import { buildCoupangPayload } from "../coupang/build-payload";
import type { ListingExecutor } from "../executor";
import type { ExecutionMode, ListingResult } from "../types";

/**
 * 쿠팡은 이번 Mission에서 MVP로 구현한다 — "실제 쿠팡 API를 처음부터 전부
 * 구현"하지 않고, 등록 가능한 payload를 정확히 만들고 검증하는 데까지만
 * 집중한다(PM 지시). DRY_RUN은 완전히 동작하고, LIVE는 인증 정보가 없으면
 * (지금 항상 없다) 시도조차 하지 않는다 — SmartStore executor와 동일한 패턴.
 */
export const coupangExecutor: ListingExecutor = {
  platform: "coupang",

  async execute(
    _product: CanonicalProduct,
    listing: ListingModel,
    mode: ExecutionMode,
  ): Promise<ListingResult> {
    const errors = listing.validations.filter((v) => v.status === "ERROR");
    if (errors.length > 0) {
      const first = errors[0];
      return {
        status: "FAILED",
        platform: "coupang",
        mode,
        retryable: true,
        error: {
          step: first.field === "category" ? "CATEGORY" : "VALIDATION",
          message: errors.map((e) => e.message ?? e.label).join(" "),
          retryable: true,
          resolution: "필수 필드를 모두 채운 뒤 다시 시도해주세요.",
        },
      };
    }

    const payload = buildCoupangPayload(_product, listing);

    if (mode === "PREVIEW") {
      return { status: "READY", platform: "coupang", mode, retryable: false, payload };
    }

    if (mode === "DRY_RUN") {
      return {
        status: "SUBMITTED",
        platform: "coupang",
        mode,
        retryable: false,
        payload,
        submittedAt: new Date().toISOString(),
      };
    }

    // LIVE — 실제 쿠팡 Open API 연동은 이번 Mission 범위 밖이다. 인증 정보가
    // 없으면(지금은 항상 없다) 네트워크 요청을 시도조차 하지 않는다.
    const hasCredentials = Boolean(
      process.env.COUPANG_ACCESS_KEY && process.env.COUPANG_SECRET_KEY,
    );
    if (!hasCredentials) {
      return {
        status: "FAILED",
        platform: "coupang",
        mode,
        retryable: false,
        payload,
        error: {
          step: "AUTHENTICATION",
          message: "쿠팡 인증이 필요합니다.",
          retryable: false,
          resolution: "쿠팡 판매자 인증 정보를 확인해주세요.",
        },
      };
    }

    return {
      status: "FAILED",
      platform: "coupang",
      mode,
      retryable: false,
      payload,
      error: {
        step: "NOT_IMPLEMENTED",
        message: "실제 쿠팡 등록 API 연동은 아직 구현되지 않았습니다.",
        retryable: false,
      },
    };
  },
};
