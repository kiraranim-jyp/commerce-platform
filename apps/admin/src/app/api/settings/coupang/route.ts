import { NextResponse } from "next/server";
import {
  getCoupangSettingsForDisplay,
  getCoupangSettingsStatus,
  saveCoupangSettings,
  type CoupangSettingsInput,
} from "../../coupang/_lib/env";

export async function GET() {
  const [status, values] = await Promise.all([getCoupangSettingsStatus(), getCoupangSettingsForDisplay()]);
  return NextResponse.json({ ...status, values });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CoupangSettingsInput | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }
  const result = await saveCoupangSettings(body);
  if (!result.ok) {
    return NextResponse.json(result, { status: 200 });
  }
  const status = await getCoupangSettingsStatus();
  return NextResponse.json({ ...result, ...status });
}
