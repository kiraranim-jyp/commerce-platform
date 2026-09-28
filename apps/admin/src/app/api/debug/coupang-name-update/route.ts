import { NextResponse } from "next/server";
import { getCoupangCredentials } from "../../coupang/_lib/env";
import { fetchCoupangBaseline } from "../../coupang/_lib/update-product";
import { executeCoupangUpdate } from "../../coupang/_lib/update-execution";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COUPANG-UPDATE-PROD-VERIFY-01 — **1회용 Production 실측 통로. 곧 지운다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일은 «임시» 다. 실측이 끝나면 라우트·토큰·환경변수를 같이 지우고
 * 재배포한다. 남겨 두면 그때부터 이것은 「쿠팡 상품명을 고치는 공개 API」다.
 *
 * ── 🔴 왜 기존 GET 통로를 고치지 않았는가 (CPO 지시) ───────────────────────
 * `debug/coupang-product-get-raw` 는 «읽기 전용» 이라는 것이 그 파일의 정체성이고,
 * 거기에 PUT 을 얹으면 「읽어 보기」가 실수로 전송이 되는 길이 생긴다. 그래서
 * 고치지 않고 따로 둔다 — 그리고 이쪽은 지워질 것이다.
 *
 * ── 🔴 일반적인 UPDATE API 가 «되지 않게» 하는 넷 ─────────────────────────
 *   ① 토큰이 없으면 «존재하지 않는 것처럼» 404 (fail-closed).
 *   ② 대상이 환경변수로 «못 박힌 한 건» 이다. 다른 번호는 받지 않는다.
 *   ③ 받는 것은 상품명 문자열 하나뿐. payload 를 받지 «않는다».
 *   ④ 실제 실행은 `executeCoupangUpdate` — register 라우트가 쓰는 «그 함수» 다.
 *      우회로를 따로 만들면 실측한 것과 실제로 도는 것이 달라진다.
 *
 * 🔴 그래서 이 통로로는 「가격을 바꾼다」도 「다른 상품을 고친다」도 할 수 없다.
 * 할 수 있는 일이 하나뿐인 것이 이 파일의 안전장치다.
 */

/** 🔴 설정이 없으면 열지 않는다 — 「설정이 없으니 일단 통과」는 이미 고친 실수다. */
function isAuthorized(request: Request): boolean {
  const expected = process.env.DEBUG_COUPANG_UPDATE_TOKEN;
  if (!expected) return false;
  return request.headers.get("x-debug-token") === expected;
}

/** 🔴 고칠 수 있는 상품은 «환경변수가 못 박은 한 건» 뿐이다. */
function allowedTarget(): string | null {
  const id = process.env.DEBUG_COUPANG_UPDATE_SELLER_PRODUCT_ID;
  return id && id.trim() ? id.trim() : null;
}

/** 실측 전후 대조를 위해 baseline 을 «그대로» 읽는다. 가공하지 않는다. */
export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const target = allowedTarget();
  if (!target) return NextResponse.json({ error: "TARGET_NOT_SET" }, { status: 200 });

  const credentials = await getCoupangCredentials();
  if (!credentials) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 200 });

  const fetched = await fetchCoupangBaseline(credentials, target);
  if (!fetched.ok) return NextResponse.json({ ok: false, message: fetched.message }, { status: 200 });
  /* 🔴 전문을 그대로 싣는다 — 「우리가 읽는 칸」만 담으면 보존 여부를 대조할 수 없다. */
  return NextResponse.json({ ok: true, sellerProductId: target, baseline: fetched.baseline });
}

/**
 * 상품명 하나를 고친다.
 *
 * 🔴 `name` 문자열 말고는 아무것도 받지 않는다. payload 를 받게 두면 그 순간
 * 이 통로는 「무엇이든 보낼 수 있는 길」이 된다.
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const target = allowedTarget();
  if (!target) return NextResponse.json({ error: "TARGET_NOT_SET" }, { status: 200 });

  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name(문자열)이 필요합니다." }, { status: 400 });

  const credentials = await getCoupangCredentials();
  if (!credentials) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 200 });

  /* 🔴 register 라우트와 «같은 함수» 다. 전문은 GET baseline 이 만들고, Master 에서
     오는 것은 이 `name` 문자열 하나뿐이다. 여기서 payload 를 조립하지 않는다. */
  const result = await executeCoupangUpdate({
    credentials,
    sellerProductId: target,
    expectedExternalProductId: target,
    /* 🔴 상품명 «하나» 로 못 박는다. 요청이 무엇을 보내든 이 목록은 바뀌지 않는다. */
    editedFields: ["name"],
    title: name,
  });

  return NextResponse.json({ result }, { status: 200 });
}
