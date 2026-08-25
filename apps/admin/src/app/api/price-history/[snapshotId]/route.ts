import { NextResponse } from "next/server";
import { computeMarketIntelligence } from "../_lib/market-intelligence";

/**
 * N-4.01 Part L(대표님 지시) — 가격 대시보드가 필요로 하는 데이터를 한 번에
 * 묶어서 돌려준다. 계산은 packages/pricing의 순수 함수만 쓴다 — 이 라우트에서
 * 새 판정 로직을 만들지 않는다.
 *
 * N-4.18-K(대표님 지시, 2026-08-26) — 실제 계산은 이제
 * computeMarketIntelligence()(_lib/market-intelligence.ts)로 옮겼다. price_alerts
 * 갱신(POST /api/price-history/check)도 같은 함수를 써야 화면 값과 알림
 * 판단 기준이 어긋나지 않는다.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ snapshotId: string }> }) {
  const { snapshotId } = await params;

  const data = await computeMarketIntelligence(snapshotId);
  if (!data) {
    return NextResponse.json({ ok: false, error: "스냅샷을 찾을 수 없습니다." }, { status: 404 });
  }

  const { _alertInputs, ...response } = data;
  void _alertInputs;
  return NextResponse.json({ ok: true, ...response });
}
