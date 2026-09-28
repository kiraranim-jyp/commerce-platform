import { NextResponse } from "next/server";
import {
  coupangUpdateGate,
  detectCoupangUpdateLoss,
  type CoupangRegisteredProduct,
} from "@commerce/listing";
import { getCoupangCredentials } from "../../coupang/_lib/env";
import { callCoupangApi } from "../../coupang/_lib/client";
import { fetchCoupangBaseline } from "../../coupang/_lib/update-product";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COUPANG-DISPLAY-NAME-02 — **1회용 실험 통로. 실측 직후 지운다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 답해야 할 질문은 «하나» 다:
 *
 *     UPDATE 전문에서 `displayProductName` 키를 «아예 빼면» 쿠팡이 재생성하는가?
 *
 * 그래서 이 실험의 독립변수도 하나다 — 그 키의 존재 여부. 상품명은 바꾸되
 * 나머지 baseline 은 통째로 그대로 나른다.
 *
 * ── 🔴 왜 `updateCoupangProduct` 를 쓰지 못하는가 ────────────────────────
 * 그 경로는 `applyCoupangEdits` 가 «두 칸을 같이» 덮으므로 키를 뺄 수 없고,
 * 설령 뺀다 해도 `detectCoupangUpdateLoss` 가 「baseline 에 있던 칸이 빠졌다」로
 * **정확히 막는다**(update-preflight.ts ①). 그 가드는 옳다 — 전체 교체에서 칸이
 * 빠지면 그 값은 지워진다.
 *
 * 🔴 그래서 이 파일은 그 가드를 «한 칸에 대해서만» 비켜 간다. 그리고 비켜 가는
 * 대신 **나머지 위험은 그대로 막는다**:
 *   · 손실 검사를 «돌린다». 위험이 `displayProductName` 하나가 아니면 중단한다.
 *   · 상태 게이트(SAVED)를 그대로 본다.
 *   · 대상은 환경변수가 못 박은 한 건뿐이다.
 *   · 받는 것은 상품명 문자열 하나. payload 를 받지 않는다.
 *
 * 🔴 `applyCoupangEdits` 를 고치지 «않았다»(CPO 확정) — 실측 결과가 나오기 전에
 * 구현 방향을 정하지 않는다. 이 파일은 실험이지 구현이 아니다.
 */

const PATH = "/v2/providers/seller_api/apis/api/v1/marketplace/seller-products";

function isAuthorized(request: Request): boolean {
  const expected = process.env.DEBUG_COUPANG_DISPLAYNAME_TOKEN;
  if (!expected) return false;
  return request.headers.get("x-debug-token") === expected;
}

function allowedTarget(): string | null {
  const id = process.env.DEBUG_COUPANG_DISPLAYNAME_SELLER_PRODUCT_ID;
  return id && id.trim() ? id.trim() : null;
}

/** 대조용 baseline 을 그대로 읽는다. */
export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const target = allowedTarget();
  if (!target) return NextResponse.json({ error: "TARGET_NOT_SET" }, { status: 200 });

  const credentials = await getCoupangCredentials();
  if (!credentials) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 200 });

  const fetched = await fetchCoupangBaseline(credentials, target);
  if (!fetched.ok) return NextResponse.json({ ok: false, message: fetched.message }, { status: 200 });
  const b = fetched.baseline;
  return NextResponse.json({
    ok: true,
    sellerProductId: b.sellerProductId,
    status: b.status,
    statusName: b.statusName,
    brand: b.brand,
    brandId: b.brandId,
    sellerProductName: b.sellerProductName,
    /* 🔴 키가 «있는지» 와 값이 무엇인지를 따로 싣는다 — 이 실험의 관측 대상이다. */
    hasDisplayProductNameKey: "displayProductName" in b,
    displayProductName: b.displayProductName ?? null,
    generalProductName: b.generalProductName ?? null,
  });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const target = allowedTarget();
  if (!target) return NextResponse.json({ error: "TARGET_NOT_SET" }, { status: 200 });

  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name(문자열)이 필요합니다." }, { status: 400 });

  const credentials = await getCoupangCredentials();
  if (!credentials) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 200 });

  /* ── ① GET baseline ───────────────────────────────────────────────────── */
  const fetched = await fetchCoupangBaseline(credentials, target);
  if (!fetched.ok) return NextResponse.json({ ok: false, step: "FETCH", message: fetched.message });
  const baseline = fetched.baseline;

  /* ── ② 상태 게이트 — 실측 범위 밖으로 나가지 않는다 ────────────────────── */
  const gate = coupangUpdateGate(baseline);
  if (!gate.allowed) {
    return NextResponse.json({ ok: false, step: "STATUS", reason: gate.reason, status: gate.status });
  }

  /* ── ③ 독립변수 하나 — 상품명만 바꾸고 `displayProductName` 키를 «뺀다» ─── */
  const outgoing: CoupangRegisteredProduct = { ...baseline, sellerProductName: name };
  const hadKey = "displayProductName" in outgoing;
  delete outgoing.displayProductName;

  /* ── ④ 손실 검사를 «돌린다». 🔴 예상한 한 칸이 아니면 보내지 않는다 ────── */
  const risks = detectCoupangUpdateLoss(baseline, outgoing);
  const unexpected = risks.filter((r) => r.field !== "displayProductName");
  if (unexpected.length > 0) {
    return NextResponse.json({
      ok: false,
      step: "PREFLIGHT",
      message: "예상하지 않은 손실이 있어 보내지 않았습니다.",
      risks: unexpected,
    });
  }

  /* ── ⑤ PUT ─────────────────────────────────────────────────────────────── */
  let response;
  try {
    response = await callCoupangApi(credentials, { method: "PUT", path: PATH, body: outgoing });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      step: "SUBMIT",
      message: error instanceof Error ? error.message : "쿠팡 서버에 연결할 수 없습니다.",
    });
  }

  return NextResponse.json({
    ok: response.status < 400,
    hadDisplayProductNameKeyInBaseline: hadKey,
    sentDisplayProductNameKey: "displayProductName" in outgoing,
    acceptedLossRisks: risks.map((r) => r.field),
    httpStatus: response.status,
    body: response.body,
  });
}
