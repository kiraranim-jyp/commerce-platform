import { NextResponse } from "next/server";
import { deleteSellerProfile, setDefaultSellerProfile } from "../../../../coupang/_lib/seller-profile";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { isDefault?: boolean } | null;
  if (!body?.isDefault) {
    return NextResponse.json({ ok: false, error: "isDefault:true만 지원합니다." }, { status: 400 });
  }
  const result = await setDefaultSellerProfile(id);
  return NextResponse.json(result);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await deleteSellerProfile(id);
  return NextResponse.json(result);
}
