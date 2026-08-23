import type { ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct, ErrorCode } from "@commerce/shared";
import type { CoupangPayload } from "../coupang/build-payload";
import { buildCoupangPayload } from "../coupang/build-payload";
import type { ListingExecutor } from "../executor";
import type { ExecutionMode, ListingResult } from "../types";

/** listing.validations의 field 이름을 ErrorCode로 매핑한다 — 서버 라우트까지
 * 가지 않고 클라이언트에서 바로 막히는 경우(필수값 미입력)에도 문의하기/
 * Registration Report가 같은 코드 체계를 쓸 수 있게 한다. */
function classifyValidationField(field: string): ErrorCode {
  if (field === "category") return "CP001";
  if (field === "imageFormat") return "CP006";
  if (field === "representativeImage") return "IMG004";
  if (field === "price") return "CP008";
  return "CP005";
}

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
    context?: { snapshotId?: string; jobKey?: string },
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
        traceId: crypto.randomUUID(),
        error: {
          step,
          code: classifyValidationField(first.field),
          message: errors.map((e) => e.message ?? e.label).join(" "),
          retryable: true,
          resolution: "필수 필드를 모두 채운 뒤 다시 시도해주세요.",
        },
      };
    }

    if (mode === "PREVIEW" || mode === "DRY_RUN") {
      // N-3.86 STEP3(대표님 지시) — 예전엔 여기서 sellerConfig 없이(그리고
      // detailBlocks도 없이) buildCoupangPayload를 직접 호출했다 — 실제 register
      // route가 만드는 payload와 다른, 게다가 detailBlocks가 없으면 구
      // 하드코딩 레거시 조립 경로로 빠지는 별도 계산이었다. 이제 register/
      // payload-preview가 쓰는 것과 완전히 같은 서버 조립 결과를 그대로 쓴다
      // (등록 안 됐다고 표시되는 DRY_RUN 결과도 실제 등록 시 나올 payload와
      // 일치해야 한다).
      let payload: CoupangPayload;
      try {
        const response = await fetch("/api/coupang/payload-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product, listing }),
        });
        const data = (await response.json()) as { payload?: CoupangPayload; error?: string; reason?: string };
        if (!data.payload) {
          return {
            status: "FAILED",
            platform: "coupang",
            mode,
            retryable: true,
            traceId: crypto.randomUUID(),
            error: {
              step: "VALIDATION",
              code: "CP005",
              message: data.error ?? (data.reason === "NOT_CONFIGURED" ? "쿠팡 인증 정보가 설정되어 있지 않습니다." : "Payload를 생성하지 못했습니다."),
              retryable: true,
            },
          };
        }
        payload = data.payload;
      } catch (error) {
        return {
          status: "FAILED",
          platform: "coupang",
          mode,
          retryable: true,
          traceId: crypto.randomUUID(),
          error: {
            step: "NETWORK",
            code: "API003",
            message: error instanceof Error ? error.message : "등록 서버에 연결할 수 없습니다.",
            retryable: true,
          },
        };
      }

      if (mode === "PREVIEW") {
        return { status: "READY", platform: "coupang", mode, retryable: false, payload };
      }
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
        body: JSON.stringify({
          product,
          listing,
          snapshotId: context?.snapshotId,
          jobKey: context?.jobKey,
        }),
      });
      const result = (await response.json()) as ListingResult;
      return result;
    } catch (error) {
      return {
        status: "FAILED",
        platform: "coupang",
        mode,
        retryable: true,
        traceId: crypto.randomUUID(),
        error: {
          step: "NETWORK",
          code: "API003",
          message: error instanceof Error ? error.message : "등록 서버에 연결할 수 없습니다.",
          retryable: true,
        },
      };
    }
  },
};
