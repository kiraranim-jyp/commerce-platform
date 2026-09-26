import type { ListingModel } from "@commerce/marketplace";
import type { SmartStoreProductInput } from "../naver/build-payload";
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
    /* NEXT-04d Phase B-3 — 이 얇은 클라이언트도 같은 경계를 쓴다.
       🔴 ListingExecutor 공통 계약의 시그니처는 바꾸지 않는다(다른 채널이
       같이 흔들린다) — 이 구현체가 «더 좁게» 받을 뿐이다. */
    product: SmartStoreProductInput,
    listing: ListingModel,
    mode: ExecutionMode,
    // Sprint B-1(CPO 지시) — 이 executor는 그동안 context 파라미터 자체를
    // 선언하지 않아서 snapshotId/jobKey가 조용히 버려졌다(TS는 인터페이스보다
    // 적은 파라미터로 구현하는 걸 허용한다 — 실제로 CommerceWorkspace는 항상
    // context를 넘겼지만 여기서 받지도 않았다). registration_attempts.snapshot_id가
    // SmartStore LIVE 시도에서는 항상 null이었던 원인이라 이번에 같이 고친다.
    /* P0-CHANNEL-03 F-10 — confirmRecreate 가 늘었다. 🔴 인라인으로 다시
       적지 않고 ListingExecutor 의 계약을 그대로 쓴다 — 두 벌이 되면
       한쪽만 늘리고 다른 쪽을 빠뜨린다(방금 실제로 그랬다). */
    context?: Parameters<ListingExecutor["execute"]>[3],
  ): Promise<ListingResult> {
    const readiness = validateSmartStoreListing(listing);
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
    // capabilities.ts의 registrationEnabled(smartstore: true, N-3.26 STEP 5부터
    // 활성화)와 CommerceWorkspace.tsx의 resolveExecutionMode가 LIVE/DRY_RUN을
    // 결정한다. "구현됨"과 "실사용 가능"을 의도적으로 분리한다.
    try {
      const response = await fetch("/api/smartstore/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product,
          listing,
          snapshotId: context?.snapshotId,
          jobKey: context?.jobKey,
          /* P0-CHANNEL-03 F-10 — 셀러가 「새 상품으로 다시 등록」에 동의한
             경우에만 실린다. 🔴 보내지 않으면 서버가 되묻고 API 는 0회다. */
          confirmRecreate: context?.confirmRecreate,
          /* P0-CHANNEL-03 F-12 — 「이대로 수정」을 누른 경우에만 실린다. */
          confirmUpdate: context?.confirmUpdate,
          /* P0-CHANNEL-03 F-14 — 🔴 화면이 «보고 고친» 등록 ID. 대상을 정하는
             값이 아니라 「내가 본 것과 같은가」를 묻는 대조값이다 — 서버는
             여전히 ChannelProduct 로 대상을 찾고, 다르면 보내지 않는다. */
          expectedExternalProductId: context?.expectedExternalProductId,
          /* P0-CHANNEL-03 F-14-7 — 🔴 이름만 보낸다. 서버가 「어느 칸을 지금
             등록된 값으로 되돌릴지」 고르는 데만 쓴다. */
          editedFields: context?.editedFields,
        }),
      });
      const result = (await response.json()) as ListingResult;
      return result;
    } catch (error) {
      /* ══════════════════════════════════════════════════════════════════════
         Commerce-3C(CPO 결정, 2026-09-26) — 🔴 **여기서 `payload` 를 뺐다.**

         이 줄에 실려 있던 것은 위 `buildSmartStorePayload()`(DRY_RUN 전용, 그 파일이
         스스로 「실제 스키마가 아니다」라고 적어 둔 값)였다. LIVE 에서 실제로 나가는
         payload 는 서버(`/api/smartstore/register` → `naver/build-payload`)가 만들고,
         그 값은 응답으로만 돌아온다 — fetch 가 던진 이 자리에서는 서버가 무엇을
         만들었는지 «우리가 모른다».

         🔴 그런데 smartstore 의 프로덕션 mode 는 항상 LIVE 다(CommerceWorkspace
            resolveExecutionMode). 즉 이 catch 가 셀러에게 가짜 payload 를 보여 준
            «유일한» 경로였고, 네트워크 오류 화면에서 「보낼 적이 없는 payload」를
            등록 내역처럼 읽게 했다.

         모르는 것은 «비워 둔다». `payload` 는 ListingResult 에서 optional 이므로
         키가 없으면 화면은 payload 블록을 그리지 않는다(지어내지 않는다).

         🔴 성공 경로·LIVE 경로·PREVIEW/DRY_RUN 동작은 한 글자도 바뀌지 않았다.
            builder 통합도 하지 않았다(CPO: 대규모 통합 금지).
      ══════════════════════════════════════════════════════════════════════ */
      return {
        status: "FAILED",
        platform: "smartstore",
        mode,
        retryable: true,
        error: {
          step: "NETWORK",
          message: error instanceof Error ? error.message : "등록 서버에 연결할 수 없습니다.",
          retryable: true,
        },
      };
    }
  },
};
