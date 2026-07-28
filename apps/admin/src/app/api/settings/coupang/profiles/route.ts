import { NextResponse } from "next/server";
import {
  createSellerProfile,
  listSellerProfiles,
  type SellerProfileInput,
} from "../../../coupang/_lib/seller-profile";

export async function GET() {
  const profiles = await listSellerProfiles();
  return NextResponse.json({ profiles });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as SellerProfileInput | null;
  if (!body?.name) {
    return NextResponse.json({ ok: false, error: "프로필 이름이 필요합니다." }, { status: 400 });
  }
  const result = await createSellerProfile(body);
  return NextResponse.json(result);
}
