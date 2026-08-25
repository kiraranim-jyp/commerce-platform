import { NextResponse } from "next/server";
import { updateDomesticProductLink } from "../../_lib/domestic-product-link";

/** N-4.18-F STEP4(대표님 지시, 2026-08-25: "85~94%는 [동일상품으로 확인] 클릭 시
 * REVIEW_REQUIRED → VERIFIED로 승격. 기존 승인/검증 상태 구조를 재사용하고
 * 새로운 상태를 만들지 않는다") — updateDomesticProductLink()는 이미 존재하는
 * 함수(admin 문의 승인 등에서 쓰던 것과 같은 verified/status 패턴)를 그대로
 * 호출한다. 새 승인 워크플로우/새 컬럼을 만들지 않는다. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { verified?: boolean } | null;
  if (typeof body?.verified !== "boolean") {
    return NextResponse.json({ ok: false, error: "verified(boolean)가 필요합니다." }, { status: 400 });
  }

  const result = await updateDomesticProductLink(id, { verified: body.verified });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
