import type { ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct } from "@commerce/shared";
import type { DetailPageBlock } from "../coupang/build-payload";
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
    // Sprint B-1(CPO 지시) — 이 executor는 그동안 context 파라미터 자체를
    // 선언하지 않아서 snapshotId/jobKey가 조용히 버려졌다(TS는 인터페이스보다
    // 적은 파라미터로 구현하는 걸 허용한다 — 실제로 CommerceWorkspace는 항상
    // context를 넘겼지만 여기서 받지도 않았다). registration_attempts.snapshot_id가
    // SmartStore LIVE 시도에서는 항상 null이었던 원인이라 이번에 같이 고친다.
    // Sprint P1(CPO 지시, 2026-08-19) — detailBlocks도 같은 이유로 추가한다:
    // executor.ts 인터페이스에는 처음부터 있었지만 이 구현체가 안 받아서
    // CommerceWorkspace가 항상 undefined로 넘기게 만든 원인이었다.
    context?: { snapshotId?: string; jobKey?: string; detailBlocks?: DetailPageBlock[] },
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

    // N-3.25(STEP 4) — LIVE는 Coupang executor와 완전히 같은 원칙: 이 파일은
    // "use client" 컴포넌트 트리에서 실행되는 얇은 클라이언트일 뿐이고, 실제
    // OAuth 토큰 발급/서명/POST /v2/products 호출은 전부 서버 전용 라우트
    // (/api/smartstore/register)에서 일어난다. SMARTSTORE_CLIENT_SECRET은
    // 서버 전용 환경변수라 이 파일이 실행되는 브라우저 번들에는 애초에
    // 존재하지 않는다 — 이 executor 자체에는 인증 로직이 없다(새로 만들지
    // 않는다, CPO 지시).
    //
    // UI에서 이 경로를 실제로 탈 수 있는지는 이 함수가 결정하지 않는다 —
    // capabilities.ts의 registrationEnabled(smartstore: false, N-3.25 STEP 4
    // 지시로 그대로 유지)가 RegistrationReadinessCard에서 등록 버튼 자체를
    // 막는다. "구현됨"과 "실사용 가능"을 의도적으로 분리한다.
    try {
      const response = await fetch("/api/smartstore/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product,
          listing,
          snapshotId: context?.snapshotId,
          jobKey: context?.jobKey,
          detailBlocks: context?.detailBlocks,
        }),
      });
      const result = (await response.json()) as ListingResult;
      return result;
    } catch (error) {
      return {
        status: "FAILED",
        platform: "smartstore",
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
