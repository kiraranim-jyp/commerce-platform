import type { ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct } from "@commerce/shared";
import { buildCoupangPayload } from "../coupang/build-payload";
import type { ListingExecutor } from "../executor";
import type { ExecutionMode, ListingResult } from "../types";

/**
 * LIVE는 이 executor 안에서 직접 HMAC 서명/API 호출을 하지 않는다 — 이 파일은
 * "use client" 컴포넌트 트리(CommerceWorkspace)에서 실행되므로 브라우저
 * 번들이고, COUPANG_SECRET_KEY 같은 서버 전용 환경변수는 여기서 애초에
 * undefined다. 실제 서명/호출은 같은 오리진의 /api/coupang/register 라우트
 * (서버에서만 실행)로 위임하고, 이 함수는 그 응답을 그대로 ListingResult로
 * 전달하는 얇은 클라이언트일 뿐이다.
 */
export const coupangExecutor: ListingExecutor = {
  platform: "coupang",

  async execute(
    product: CanonicalProduct,
    listing: ListingModel,
    mode: ExecutionMode,
  ): Promise<ListingResult> {
    const errors = listing.validations.filter((v) => v.status === "ERROR");
    if (errors.length > 0) {
      const first = errors[0];
      const step = first.field === "category" ? "CATEGORY" : first.field === "imageFormat" ? "IMAGE" : "VALIDATION";
      return {
        status: "FAILED",
        platform: "coupang",
        mode,
        retryable: true,
        error: {
          step,
          message: errors.map((e) => e.message ?? e.label).join(" "),
          retryable: true,
          resolution: "필수 필드를 모두 채운 뒤 다시 시도해주세요.",
        },
      };
    }

    const payload = buildCoupangPayload(product, listing);

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

    // LIVE — 서버 라우트에 위임한다. 네트워크 자체가 실패하면(서버가 안 떠있는
    // 로컬 상황 등) 이 catch가 NETWORK 에러로 감싸서 반환한다.
    try {
      const response = await fetch("/api/coupang/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, listing }),
      });
      const result = (await response.json()) as ListingResult;
      return result;
    } catch (error) {
      return {
        status: "FAILED",
        platform: "coupang",
        mode,
        retryable: true,
        payload,
        error: {
          step: "NETWORK",
          message: error instanceof Error ? error.message : "등록 서버에 연결할 수 없습니다.",
          retryable: true,
        },
      };
    }
  },
};
