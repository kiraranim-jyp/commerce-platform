import type { ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct } from "@commerce/shared";
import type { ListingExecutor } from "../executor";
import { buildSmartStorePayload } from "../smartstore/build-payload";
import { validateSmartStoreListing } from "../smartstore/validate-listing";
import type { ExecutionMode, ListingResult } from "../types";

/**
 * SmartStore는 이번 Mission에서 유일하게 "진짜" 구현되는 플랫폼이다(PM 지시:
 * "처음부터 모든 플랫폼을 동시에 만들면 복잡도가 너무 커진다"). DRY_RUN/PREVIEW는
 * 완전히 동작하고, LIVE는 인증 정보가 없으면(지금 항상 없다) 시도조차 하지
 * 않는다 — 실제 네이버 API 연동이 준비되면 LIVE 분기만 서버 전용 API 라우트로
 * 옮기고 나머지(검증/payload 생성/UI)는 그대로 재사용하면 된다.
 */
export const smartstoreExecutor: ListingExecutor = {
  platform: "smartstore",

  async execute(
    product: CanonicalProduct,
    listing: ListingModel,
    mode: ExecutionMode,
  ): Promise<ListingResult> {
    const readiness = validateSmartStoreListing(product, listing);
    if (readiness.errorCount > 0) {
      const errorFields = readiness.fields.filter((f) => f.status === "ERROR");
      const first = errorFields[0];
      return {
        status: "FAILED",
        platform: "smartstore",
        mode,
        retryable: true,
        error: {
          step: first.field === "category" ? "CATEGORY" : "VALIDATION",
          message: errorFields.map((f) => f.message ?? f.label).join(" "),
          retryable: true,
          resolution: first.resolution ?? "필수 필드를 모두 채운 뒤 다시 시도해주세요.",
        },
      };
    }

    const payload = buildSmartStorePayload(product, listing);

    if (mode === "PREVIEW") {
      return { status: "READY", platform: "smartstore", mode, retryable: false, payload };
    }

    if (mode === "DRY_RUN") {
      return {
        status: "SUBMITTED",
        platform: "smartstore",
        mode,
        retryable: false,
        payload,
        submittedAt: new Date().toISOString(),
      };
    }

    // LIVE — 실제 등록 API 연동은 이번 Mission 범위 밖이다. 인증 정보를 먼저
    // 확인하고, 없으면(지금은 항상 없다) 네트워크 요청을 시도조차 하지 않는다.
    // 브라우저에서 이 코드가 실행되더라도 SMARTSTORE_CLIENT_SECRET은 서버
    // 전용 환경변수라 클라이언트 번들에는 애초에 존재하지 않는다 — 값이 없으면
    // 이 분기가 항상 막아준다는 뜻이다. 실제 연동 시에는 이 블록 전체를
    // 서버 API 라우트로 옮겨야 한다(시크릿은 브라우저에서 절대 다루지 않는다).
    const hasCredentials = Boolean(
      process.env.SMARTSTORE_CLIENT_ID && process.env.SMARTSTORE_CLIENT_SECRET,
    );
    if (!hasCredentials) {
      return {
        status: "FAILED",
        platform: "smartstore",
        mode,
        retryable: false,
        payload,
        error: {
          step: "AUTHENTICATION",
          message: "SmartStore 인증이 필요합니다.",
          retryable: false,
          resolution: "다시 로그인하거나 인증 정보를 확인해주세요.",
        },
      };
    }

    return {
      status: "FAILED",
      platform: "smartstore",
      mode,
      retryable: false,
      payload,
      error: {
        step: "NOT_IMPLEMENTED",
        message: "실제 SmartStore 등록 API 연동은 아직 구현되지 않았습니다.",
        retryable: false,
      },
    };
  },
};
