import { NextResponse } from "next/server";
import { acknowledgeAlert, listActiveAlerts } from "../../_lib/price-alerts";

/** N-4.18-K STEP K-5/K-6 — 이 스냅샷의 활성(OPEN/ACKNOWLEDGED) 알림 목록.
 * price_alerts 테이블이 아직 없으면 listActiveAlerts가 빈 배열을 돌려준다
 * (마이그레이션 039 미실행 시에도 화면이 깨지지 않는다). */
export async function GET(_request: Request, { params }: { params: Promise<{ snapshotId: string }> }) {
  const { snapshotId } = await params;
  const alerts = await listActiveAlerts(snapshotId);
  return NextResponse.json({ ok: true, alerts });
}

/** STEP K-5 — "확인함" 버튼. body: { alertId }. */
export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as { alertId?: string } | null;
  if (!body?.alertId) {
    return NextResponse.json({ ok: false, error: "alertId가 필요합니다." }, { status: 400 });
  }
  const result = await acknowledgeAlert(body.alertId);
  return NextResponse.json({ ok: result.ok });
}
