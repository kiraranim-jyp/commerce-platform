import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
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
  // BETA-SECURITY-2 §11 — 남의 스냅샷 가격 이력을 읽을 수 없어야 한다.
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { snapshotId } = await params;

  /**
   * 🔵🔵🔵 CANDIDATE-UX-REFINE-04 B-3 — **재진입(`?resume=`) 복원은 이 GET 뿐이다.**
   *
   * 🔴 왜 여기인가 — transient 후보는 POST `/check` 응답에만 살아서, 재진입하면
   *    화면의 후보/가격비교가 **통째로 비어 있었다**(셀러가 「다시 분석」을 눌러야 했다).
   * 🔴 **읽기만 한다** — Search/Crawl/`/check` 를 부르지 않는다(B3-09 · §B-4 금지).
   * 🔴 세 번째 인자(`geminiEvidence`)는 **그대로 비운다** — 저장분이 가격 집계에
   *    들어가지 않는 것이 이 설계의 전부다(B3-04).
   */
  const data = await computeMarketIntelligence(snapshotId, auth.user.workspaceId, null, {
    restoreSavedCandidates: true,
  });
  if (!data) {
    return NextResponse.json({ ok: false, error: "스냅샷을 찾을 수 없습니다." }, { status: 404 });
  }

  const { _alertInputs, ...response } = data;
  void _alertInputs;
  return NextResponse.json({ ok: true, ...response });
}
