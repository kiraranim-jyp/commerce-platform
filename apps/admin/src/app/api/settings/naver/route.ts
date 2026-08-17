import { NextResponse } from "next/server";
import {
  clearNaverAccountSettings,
  getNaverAccountSettingsForDisplay,
  saveNaverAccountSettings,
  type NaverAccountSettingsInput,
} from "../../naver/_lib/account";

/** N-3.42 STEP2-4(CPO 지시, B안) — Coupang의 /api/settings/coupang와 동일한
 * 모양의 계정 CRUD 라우트. 자격증명은 commerce_accounts(platform='naver')
 * 싱글톤에 저장된다(apps/admin/src/app/api/naver/_lib/account.ts). */
export async function GET() {
  const values = await getNaverAccountSettingsForDisplay();
  return NextResponse.json({ values });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as NaverAccountSettingsInput | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }
  const result = await saveNaverAccountSettings(body);
  return NextResponse.json(result, { status: 200 });
}

/** DB에 저장된 값만 지운다 — 배포 환경변수(SMARTSTORE_CLIENT_ID/SECRET)로도
 * 설정돼 있으면 getNaverCredentials()가 계속 그 값으로 폴백하므로 이후에도
 * 연결됨으로 표시될 수 있다(호출부 UI에서 안내). */
export async function DELETE() {
  const result = await clearNaverAccountSettings();
  return NextResponse.json(result, { status: 200 });
}
