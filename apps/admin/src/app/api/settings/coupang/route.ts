import { NextResponse } from "next/server";
import {
  getCoupangAccountSettingsForDisplay,
  saveCoupangAccountSettings,
  type CoupangAccountSettingsInput,
} from "../../coupang/_lib/env";
import { getCoupangSettingsStatus } from "../../coupang/_lib/settings-status";

/** 계정 인증(Access/Secret Key, Vendor ID, Wing 계정 ID)만 다룬다 — 배송 프로필은
 * /api/settings/coupang/profiles, 상세설명 템플릿은 /api/settings/coupang/templates로
 * 분리했다. */
export async function GET() {
  const [status, values] = await Promise.all([
    getCoupangSettingsStatus(),
    getCoupangAccountSettingsForDisplay(),
  ]);
  return NextResponse.json({ ...status, values });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CoupangAccountSettingsInput | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }
  const result = await saveCoupangAccountSettings(body);
  if (!result.ok) {
    return NextResponse.json(result, { status: 200 });
  }
  const status = await getCoupangSettingsStatus();
  return NextResponse.json({ ...result, ...status });
}
