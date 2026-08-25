import { NextResponse } from "next/server";
import { countActiveAlertsBySeverity } from "../../price-history/_lib/price-alerts";

/** N-4.18-K STEP K-6(대표님 지시, 2026-08-26: "전체 상품을 보는 곳에는
 * 요약만 제공한다") — /today 대시보드용 전체 활성 알림 개수. */
export async function GET() {
  const counts = await countActiveAlertsBySeverity();
  return NextResponse.json({ ok: true, counts });
}
