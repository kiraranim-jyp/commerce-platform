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
 * COUPANG-DISPLAY-NAME-03 — **1회용 실험 통로. 실측 직후 지운다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * DN-02 가 「키를 빼면 쿠팡이 재생성한다」를 확정했고, 그 재생성 값이
 * `brand + " " + generalProductName` 과 일치한다는 «정황» 을 남겼다. 정황인
 * 이유는 그때 `sellerProductName` 과 `generalProductName` 이 «둘 다» 달랐기
 * 때문이 아니라 — 오히려 `generalProductName` 만 옛 값이었기 때문이다.
 *
 * 🔴 그래서 이번 독립변수는 `generalProductName` «하나» 다:
 *
 *     sellerProductName   건드리지 «않는다»
 *     generalProductName  바꾼다            ← 이것 하나
 *     displayProductName  키를 생략한다
 *
 * 노출명이 새 `generalProductName` 을 따라오면 출처가 확정된다(Case A).
 * 그대로면 다른 규칙이다(Case B).
 *
 * ── 🔴 안전장치는 DN-02 와 같다 ─────────────────────────────────────────
 *   · 토큰 없으면 404 (fail-closed)          · 대상은 환경변수가 못 박은 한 건
 *   · 받는 것은 문자열 하나. payload 금지     · 상태 게이트(SAVED) 그대로
 *   · 손실 검사를 «돌린다». 위험이 `displayProductName` 하나가 아니면 중단한다.
 *
 * 🔴 `applyCoupangEdits` 를 고치지 «않았다»(CPO 확정). 이 파일은 실험이지 구현이 아니다.
 */

const PATH = "/v2/providers/seller_api/apis/api/v1/marketplace/seller-products";

function isAuthorized(request: Request): boolean {
  const expected = process.env.DEBUG_COUPANG_GENERALNAME_TOKEN;
  if (!expected) return false;
  return request.headers.get("x-debug-token") === expected;
}

function allowedTarget(): string | null {
  const id = process.env.DEBUG_COUPANG_GENERALNAME_SELLER_PRODUCT_ID;
  return id && id.trim() ? id.trim() : null;
}

/** 세 이름을 «함께» 싣는다 — 이 실험의 관측 대상이 그 관계다. */
function observe(b: CoupangRegisteredProduct) {
  return {
    sellerProductId: b.sellerProductId,
    status: b.status,
    statusName: b.statusName,
    brand: b.brand ?? null,
    sellerProductName: b.sellerProductName ?? null,
    generalProductName: b.generalProductName ?? null,
    displayProductName: b.displayProductName ?? null,
    hasDisplayProductNameKey: "displayProductName" in b,
  };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const target = allowedTarget();
  if (!target) return NextResponse.json({ error: "TARGET_NOT_SET" }, { status: 200 });

  const credentials = await getCoupangCredentials();
  if (!credentials) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 200 });

  const fetched = await fetchCoupangBaseline(credentials, target);
  if (!fetched.ok) return NextResponse.json({ ok: false, message: fetched.message }, { status: 200 });
  return NextResponse.json({ ok: true, ...observe(fetched.baseline) });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const target = allowedTarget();
  if (!target) return NextResponse.json({ error: "TARGET_NOT_SET" }, { status: 200 });

  const body = (await request.json().catch(() => null)) as { generalProductName?: unknown } | null;
  const next = typeof body?.generalProductName === "string" ? body.generalProductName.trim() : "";
  if (!next) {
    return NextResponse.json({ error: "generalProductName(문자열)이 필요합니다." }, { status: 400 });
  }

  const credentials = await getCoupangCredentials();
  if (!credentials) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 200 });

  const fetched = await fetchCoupangBaseline(credentials, target);
  if (!fetched.ok) return NextResponse.json({ ok: false, step: "FETCH", message: fetched.message });
  const baseline = fetched.baseline;

  const gate = coupangUpdateGate(baseline);
  if (!gate.allowed) {
    return NextResponse.json({ ok: false, step: "STATUS", reason: gate.reason, status: gate.status });
  }

  /* 🔴 독립변수 하나 — `generalProductName` 만 바꾼다.
     `sellerProductName` 은 baseline 값 그대로 실려 나간다(손대지 않는다). */
  const outgoing: CoupangRegisteredProduct = { ...baseline, generalProductName: next };
  delete outgoing.displayProductName;

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
    /* 🔴 이번 PUT 이 정말로 상품명을 «안 건드렸는지» 스스로 증명한다. */
    sellerProductNameUnchanged: outgoing.sellerProductName === baseline.sellerProductName,
    sentGeneralProductName: outgoing.generalProductName,
    sentDisplayProductNameKey: "displayProductName" in outgoing,
    acceptedLossRisks: risks.map((r) => r.field),
    httpStatus: response.status,
    body: response.body,
  });
}
