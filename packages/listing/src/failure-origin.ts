import type { ListingErrorStep } from "./types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * SELLER-UX-FINAL PHASE 4 — **「보내기 전」과 「채널이 거부」를 뭉개지 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 지시(2026-10-03): *「PRE-CHECK 실패 ≠ EXTERNAL API 실패. 둘을 하나의
 * 「등록 실패」로 뭉개지 않습니다.」*
 *
 * `ListingErrorStep` 일곱 값은 그 둘이 «섞여» 있다. 섞인 채로 화면에 내면
 * 셀러는 「내가 고칠 수 있는 것인지」를 알 수 없다 — 값을 고쳐도 안 풀리는
 * 외부 장애 앞에서 상품 데이터를 계속 손보게 된다(그 반대도 마찬가지다).
 *
 * ── 🔴 이름을 «누가 고치는가» 로 짓지 않았다 ────────────────────────────
 * 「셀러 책임 / 채널 책임」으로 가르면 `NOT_IMPLEMENTED`(우리가 아직 안 만든
 * 채널)가 어디에도 안 맞는다. 그래서 **무엇이 일어났는가** 로 가른다:
 * 보내기 «전» 에 끝났는가, 보낸 «뒤» 에 실패했는가.
 *
 * ── 분류 근거 (코드를 읽고 정했다 — 추측이 아니다) ───────────────────────
 *     VALIDATION       우리 검증기가 막는다                     보내기 전
 *     CATEGORY         isVerifiedCategorySelected() 자체 검사    보내기 전
 *                      (smartstore/register/route.ts:338-341)
 *     NOT_IMPLEMENTED  해당 채널 실행부가 없다 — 호출 0건        보내기 전
 *     AUTHENTICATION   토큰 발급/권한을 채널이 거부              보낸 뒤
 *     NETWORK          채널 서버에 닿지 못했다                   보낸 뒤
 *     IMAGE            uploadNaverProductImages() — 채널 업로드   보낸 뒤
 *                      (smartstore/register/route.ts:529)
 *     COUPANG_API      채널이 등록 요청을 거부                   보낸 뒤
 *
 * 🔴 `IMAGE` 가 「보낸 뒤」인 것이 이 표의 핵심이다. 이름만 보면 우리 쪽
 * 이미지 처리처럼 읽히는데, 실제로는 채널에 이미지를 올리는 외부 호출이다 —
 * 셀러가 이미지를 바꿔도 채널 장애면 안 풀린다.
 */
export type ListingFailureOrigin = "BEFORE_SEND" | "CHANNEL";

const ORIGIN_BY_STEP: Record<ListingErrorStep, ListingFailureOrigin> = {
  VALIDATION: "BEFORE_SEND",
  CATEGORY: "BEFORE_SEND",
  NOT_IMPLEMENTED: "BEFORE_SEND",
  AUTHENTICATION: "CHANNEL",
  NETWORK: "CHANNEL",
  IMAGE: "CHANNEL",
  COUPANG_API: "CHANNEL",
};

export function listingFailureOrigin(step: ListingErrorStep): ListingFailureOrigin {
  return ORIGIN_BY_STEP[step];
}

/** 「보내기 전에 막혔다」 = 채널에 **아무것도 보내지 않았다**. */
export function failedBeforeSending(step: ListingErrorStep): boolean {
  return listingFailureOrigin(step) === "BEFORE_SEND";
}

/**
 * 화면에 그대로 적는 한 줄. 🔴 「셀러 잘못 / 채널 잘못」이라고 말하지 않는다 —
 * 보내기 전 실패에도 우리 쪽 결함(예: 미지원 채널)이 있고, 채널 실패에도
 * 셀러가 고칠 것(예: 만료된 인증키)이 있다. 사실만 적는다.
 */
export function listingFailureOriginLabel(origin: ListingFailureOrigin): string {
  return origin === "BEFORE_SEND"
    ? "등록 요청을 보내기 전에 막혔습니다 — 채널에는 아무것도 전송되지 않았습니다."
    : "등록 요청을 보낸 뒤 실패했습니다 — 채널에 상품이 일부 만들어졌을 수 있습니다.";
}
