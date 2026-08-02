import { NextResponse } from "next/server";
import {
  createBrandProfile,
  listBrandProfiles,
  type BrandProfileInput,
} from "../../../coupang/_lib/brand-profile";

export async function GET() {
  const profiles = await listBrandProfiles();
  return NextResponse.json({ profiles });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as BrandProfileInput | null;
  if (!body?.name) {
    return NextResponse.json({ ok: false, error: "브랜드명이 필요합니다." }, { status: 400 });
  }
  const result = await createBrandProfile(body);
  return NextResponse.json(result);
}
