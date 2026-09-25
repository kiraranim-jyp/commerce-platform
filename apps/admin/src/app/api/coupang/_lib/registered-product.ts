import { callCoupangApi } from "./client";
import type { CoupangCredentials } from "./env";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-8(CPO 확정, 2026-09-25) — **쿠팡에 지금 나가 있는 것.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * SmartStore 의 `fetchRegisteredProduct()` 와 같은 자리다. 다만 «읽는 것이 훨씬
 * 적다» — 그리고 그것이 의도다.
 *
 * ── 🔴 왜 카테고리 하나만 읽는가 ─────────────────────────────────────────
 * 쿠팡의 capability 는 이렇다(channel-lifecycle.ts):
 *
 *     update         UNKNOWN         수정 엔드포인트 근거 «없음»
 *     categoryUpdate NOT_SUPPORTED   공식 가이드가 「수정 불가」로 «명시»
 *
 * 그래서 이미 나가 있는 상품에 대한 판단은 «카테고리 하나로 갈린다»:
 *     카테고리가 바뀌었다  → RECREATE (그 길밖에 없다고 공식이 말한다)
 *     그 외 전부          → BLOCKED  (수정이 되는지 확인된 바 없다)
 *
 * 🔴 상품명·가격·옵션을 더 읽어도 «결과가 달라지지 않는다». 결과를 바꾸지도
 * 않는 비교를, 실측한 적 없는 응답 모양 위에 지어 올리는 것은 추측을 코드로
 * 만드는 일이다. 필요해질 때(= update 가 SUPPORTED 로 올라갈 때) 늘린다.
 *
 * 🔴 SmartStore 처럼 UPDATE 경로를 만들지 «않는다». 근거가 없다. 없는 것을
 * 만들어 두면 다음 사람이 「있으니까 쓸 수 있다」고 읽는다 — LotteON apiNo 90
 * 에서 이번 스프린트에 실제로 겪은 일이다.
 */

export type RegisteredCoupangCategory =
  | { ok: true; displayCategoryCode: string | null }
  | { ok: false; message: string };

/**
 * 지금 등록돼 있는 상품의 «전시 카테고리» 를 읽는다.
 *
 * 🔴 `displayCategoryCode: null` 은 「읽었는데 없었다」가 아니라 「우리가 읽는
 * 자리에 값이 없었다」이다. 두 경우 모두 호출부에서 UNKNOWN 으로 흘러가
 * BLOCKED 이 된다 — 모르는 채로 RECREATE 하면 새 상품이 생기고, 그것이 이미
 * Production 에 쿠팡 중복 3건(16336681622 · 16338809221 · 16340176952)을
 * 만든 길이다.
 */
export async function fetchRegisteredCoupangCategory(
  credentials: CoupangCredentials,
  sellerProductId: string,
): Promise<RegisteredCoupangCategory> {
  try {
    const response = await callCoupangApi(credentials, {
      method: "GET",
      path: `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/${sellerProductId}`,
    });
    if (response.status >= 400) {
      return { ok: false, message: `쿠팡이 상품 조회를 거부했습니다(HTTP ${response.status}).` };
    }

    /* 🔴 응답 모양을 «실측한 적이 없다». 등록 요청 payload 와 같은 이름일
       것이라는 대칭 가정 위에 있다(SmartStore F-2/F-6 과 똑같은 가정이다).
       가정이 틀리면 undefined 로 오고, 그러면 null 을 내 BLOCKED 로 간다 —
       「안 바뀌었다」로 새지 않는다. */
    const parsed = response.body as { data?: { displayCategoryCode?: string | number } } | null;
    const code = parsed?.data?.displayCategoryCode;
    return { ok: true, displayCategoryCode: code == null ? null : String(code) };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "쿠팡 서버에 연결할 수 없습니다.",
    };
  }
}
