import { NextResponse } from "next/server";
import { verifyOriginForBrand } from "@commerce/crawler";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.6 P2(CPO 결정, 2026-10-09) — **브랜드 공식몰에서 제조국을 «확인» 한다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 실측(세르지오 타치니): 「원산지는 대상 브랜드의 공식 홈페이지에서 찾아서
 * 입력해야 한다」.
 *
 * ── 🔴 왜 수집 단계가 아니라 «셀러가 누르는» 자리인가 ─────────────────────
 * CPO 정책: 「HTTP 비용은 후보 브랜드에 한정하고 무차별 크롤링하지 않는다」.
 * 수집 파이프라인에 넣으면 상품을 분석할 때마다 공식몰을 받는다 — 그것이
 * 무차별 수집이다. 그래서 «셀러가 그 상품의 원산지를 확인하려 할 때 한 번» 만
 * 돈다. HTTP 는 최대 2회다(robots.txt + 페이지 한 장).
 *
 * ── 🔴 이 라우트가 하지 않는 것 ──────────────────────────────────────────
 *   · 값을 «저장하지 않는다». 판정과 근거만 돌려주고, 상품에 넣는 것은 셀러가
 *     화면에서 확정한다(ORIGINAL 로 승격되는 자리는 한 곳이어야 한다).
 *   · 추측하지 않는다. 공식몰을 모르거나 표기를 못 찾으면 그대로 미확인이다.
 *   · robots 를 우회하지 않는다. 막혔으면 막혔다고 답한다.
 *   · 브랜드명을 검색엔진에 던져 도메인을 «찾지» 않는다 — 관측해 둔 공식몰
 *     목록에만 묻는다(official-site-origin.ts 의 OFFICIAL_SITE_BY_BRAND).
 */
export async function POST(request: Request) {
  let body: { brand?: unknown; pagePath?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: "요청 본문을 읽지 못했습니다." }, { status: 400 });
  }
  const brand = typeof body.brand === "string" ? body.brand.trim() : "";
  if (!brand) {
    return NextResponse.json({ ok: false, message: "브랜드명이 없습니다." }, { status: 400 });
  }
  /* 🔴 경로는 «우리가 지어내지 않는다». 셀러/화면이 아는 경로가 있으면 그것을
     쓰고, 없으면 루트 한 장만 본다. 여러 경로를 돌면 그것이 크롤링이다. */
  const pagePath = typeof body.pagePath === "string" && body.pagePath.startsWith("/") ? body.pagePath : undefined;

  const evidence = await verifyOriginForBrand(brand, pagePath);
  return NextResponse.json({ ok: true, evidence });
}
