import { NextResponse } from "next/server";
import {
  deleteBrandProfile,
  updateBrandProfile,
  type BrandProfileInput,
} from "../../../../coupang/_lib/brand-profile";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Partial<BrandProfileInput> | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 });
  }
  const result = await updateBrandProfile(id, body);
  return NextResponse.json(result);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await deleteBrandProfile(id);
  return NextResponse.json(result);
}
