import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { deleteComparisonShop, setComparisonShopActive, updateComparisonShopCountry } from "../_lib/comparison-shop";

/**
 * SOURCE-POLICY-01 후속(CEO 승인, 2026-09-16) — PATCH/DELETE에 인증이 없었다.
 * 로그인하지 않은 누구나 해외 조사 소스를 켜고 끄고 지울 수 있었다.
 * 형제 라우트(`../route.ts`)의 머리 주석에 경위를 적어 뒀다.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | { isActive?: boolean; country?: string | null; currency?: string | null }
    | null;
  if (body?.isActive !== undefined) {
    const result = await setComparisonShopActive(id, body.isActive);
    return NextResponse.json(result);
  }
  if (body && ("country" in body || "currency" in body)) {
    const result = await updateComparisonShopCountry(id, body.country ?? null, body.currency ?? null);
    return NextResponse.json(result);
  }
  return NextResponse.json({ ok: false, error: "isActive 또는 country/currency가 필요합니다." }, { status: 400 });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const result = await deleteComparisonShop(id);
  return NextResponse.json(result);
}
