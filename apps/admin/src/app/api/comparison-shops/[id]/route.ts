import { NextResponse } from "next/server";
import { deleteComparisonShop, setComparisonShopActive } from "../_lib/comparison-shop";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { isActive?: boolean } | null;
  if (body?.isActive === undefined) {
    return NextResponse.json({ ok: false, error: "isActive가 필요합니다." }, { status: 400 });
  }
  const result = await setComparisonShopActive(id, body.isActive);
  return NextResponse.json(result);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await deleteComparisonShop(id);
  return NextResponse.json(result);
}
