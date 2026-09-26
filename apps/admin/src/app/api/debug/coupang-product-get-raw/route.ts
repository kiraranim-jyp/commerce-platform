import { NextResponse } from "next/server";
import { getCoupangCredentials } from "../../coupang/_lib/env";
import { callCoupangApi } from "../../coupang/_lib/client";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 Sprint A-2 STEP 6-3(CPO 확정, 2026-09-26)
 * **쿠팡 등록상품 조회를 «실측» 할 통로.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 쿠팡 어댑터를 만들려면 「GET 이 실제로 무엇을 돌려주는가」를 봐야 한다. 지금
 * 코드가 그 응답에서 읽는 것은 «displayCategoryCode 한 칸» 뿐이고, 그 한 칸조차
 * 「등록 payload 와 같은 이름일 것」이라는 «대칭 가정» 위에 있다
 * (`coupang/_lib/registered-product.ts` 가 스스로 그렇게 적어 두었다).
 *
 * ── 🔴 왜 «또» 만드는가 — `/api/coupang/product-status` 가 이미 있는데 ────────
 * 그 라우트는 같은 GET 을 부르고 raw body 를 그대로 돌려준다. 그런데 «Seller
 * 세션» 뒤에 있다(proxy matcher). CTO 는 그 세션이 없고, 그래서 그 통로로는
 * 실측할 수 없다 — SmartStore 때 `naver-product-get-raw` 를 만든 이유와 같다.
 *
 * 🔴 그 라우트를 «고치거나 대체하지 않는다». 등록 직후 검수 상태를 보는 용도로
 * 살아 있고, 역할이 다르다. 여기서는 조사 전용 통로만 하나 더 둔다.
 *
 * ── 🔴 하는 일과 하지 않는 일 ────────────────────────────────────────────
 *   한다:    GET 한 번. 응답을 «가공하지 않고» 그대로 싣는다.
 *   안 한다: POST · PUT · PATCH · DELETE. 한 줄도 없다.
 *   안 한다: 「이 칸이 저 뜻일 것이다」라는 해석. 판정은 사람이 본 뒤에 한다.
 *
 * 🔴 `DEBUG_COUPANG_PROBE_TOKEN` 이 없으면 «존재하지 않는 것처럼» 404 로 닫는다
 * (naver-product-get-raw 와 같은 fail-closed). 토큰을 코드에 적지 않는다.
 */
function isAuthorized(request: Request): boolean {
  const expected = process.env.DEBUG_COUPANG_PROBE_TOKEN;
  /* 🔴 설정이 없으면 열지 않는다. 「설정이 없으니 일단 통과」는 이 프로젝트가
     이미 한 번 고친 실수다(requireRegistrationAccess 의 fail-closed 주석 참고). */
  if (!expected) return false;
  return request.headers.get("x-debug-token") === expected;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  /* 🔴 쿠팡의 등록 ID 는 `sellerProductId` 다 — 등록 응답의 `data`(숫자)가 그것이고,
     `ChannelProduct.external_product_id` 에 그 값이 들어간다(register route).
     `vendorItemId`·`productId` 와 «다른 것» 이므로 이름을 그대로 쓴다. */
  const sellerProductId = searchParams.get("sellerProductId");
  if (!sellerProductId) {
    return NextResponse.json({ error: "sellerProductId query param required" }, { status: 400 });
  }

  const credentials = await getCoupangCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 200 });
  }

  try {
    const response = await callCoupangApi(credentials, {
      method: "GET",
      path: `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/${encodeURIComponent(sellerProductId)}`,
    });
    /* 🔴 body 를 그대로 싣는다. 여기서 골라 담으면 「우리가 읽는 칸」만 보이고,
       정작 확인해야 하는 「응답에 무엇이 있는가」를 못 본다. */
    return NextResponse.json({ result: { status: response.status, body: response.body } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "쿠팡 서버에 연결할 수 없습니다." },
      { status: 200 },
    );
  }
}
