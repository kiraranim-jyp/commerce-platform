import { NextResponse } from "next/server";
import { deleteComparisonShop, setComparisonShopActive, updateComparisonShopCountry } from "../_lib/comparison-shop";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const { id } = await params;
  const result = await deleteComparisonShop(id);
  return NextResponse.json(result);
}
