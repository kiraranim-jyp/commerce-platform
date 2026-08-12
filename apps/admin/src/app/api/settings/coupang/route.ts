import { NextResponse } from "next/server";
import {
  clearCoupangAccountSettings,
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

/** N-3.8 — 커머스 계정 관리 화면의 "연결 해제". DB에 저장된 계정값만 지운다 —
 * 환경변수로도 설정돼 있으면 계속 연결됨으로 표시될 수 있다(호출부 UI에서 이
 * 한계를 안내한다, clearCoupangAccountSettings 주석 참고). */
export async function DELETE() {
  const result = await clearCoupangAccountSettings();
  if (!result.ok) {
    return NextResponse.json(result, { status: 200 });
  }
  const status = await getCoupangSettingsStatus();
  return NextResponse.json({ ...result, ...status });
}
