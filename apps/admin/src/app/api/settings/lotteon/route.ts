import { NextResponse } from "next/server";
import {
  clearLotteOnAccountSettings,
  getLotteOnAccountSettingsForDisplay,
  saveLotteOnAccountSettings,
  type LotteOnAccountSettingsInput,
} from "../../lotteon/_lib/account";

/**
 * LOTTEON COMMERCE SPRINT 2 Phase 1 — /api/settings/naver 와 같은 모양의 계정
 * CRUD 라우트. 자격증명은 commerce_accounts(platform='lotteon') 싱글톤에
 * 저장된다(apps/admin/src/app/api/lotteon/_lib/account.ts).
 *
 * 🔴 GET 응답에 인증키 값(마스킹본 포함)을 절대 싣지 않는다 — apiKeySaved
 * boolean 하나만 내려간다.
 */
export async function GET() {
  const values = await getLotteOnAccountSettingsForDisplay();
  return NextResponse.json({ values });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as LotteOnAccountSettingsInput | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }
  const result = await saveLotteOnAccountSettings(body);
  return NextResponse.json(result, { status: 200 });
}

/** DB에 저장된 값만 지운다 — 배포 환경변수(LOTTEON_API_KEY)로도 설정돼 있으면
 * getLotteOnCredentials()가 계속 그 값으로 폴백한다(Naver/Coupang과 동일한 한계,
 * 화면에서 안내한다). */
export async function DELETE() {
  const result = await clearLotteOnAccountSettings();
  return NextResponse.json(result, { status: 200 });
}
