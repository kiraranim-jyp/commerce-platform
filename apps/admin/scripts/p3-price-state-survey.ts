/**
 * P-3-0(대표님 지시, 2026-08-28) — 코드 변경 없이, 현재 실제 저장된 모든
 * 스냅샷을 대상으로 /api/price-history/[id](읽기전용, computeMarketIntelligence
 * 그대로)를 호출해서 sellerDecisionStateFromUnifiedDecision() 5개 상태
 * (⚪🟢🟡🟠🔴) 분포를 실측한다. 새 판정 로직을 만들지 않는다 — P-2-3에서 이미
 * 구현한 함수를 그대로 재사용해서 "지금 실제로 몇 개 상품이 어느 상태인지"만
 * 센다.
 *
 * 사용법: npx tsx scripts/p3-price-state-survey.ts [baseUrl]
 *   기본값: https://ttaejyo.vercel.app
 */
import { sellerDecisionStateFromUnifiedDecision, type UnifiedPriceDecision } from "@commerce/pricing";

const BASE_URL = process.argv[2] || "https://ttaejyo.vercel.app";

interface SnapshotSummary {
  id: string;
  title: string | null;
  status: "IN_PROGRESS" | "REGISTERED";
}

interface PriceHistoryResponse {
  ok: boolean;
  unifiedDecision: UnifiedPriceDecision | null;
  sellability?: { reason: string };
  currentPrice?: { sellingPriceKrw: number | null };
}

async function main() {
  const listRes = await fetch(`${BASE_URL}/api/snapshots`);
  if (!listRes.ok) throw new Error(`snapshot list fetch failed: ${listRes.status}`);
  const { snapshots } = (await listRes.json()) as { snapshots: SnapshotSummary[] };
  console.log(`전체 스냅샷 ${snapshots.length}건 조회, ${BASE_URL} 기준\n`);

  const byState: Record<string, { id: string; title: string | null; detail: string }[]> = {
    READY: [],
    ADJUST: [],
    NEEDS_COST_INFO: [],
    NOT_RECOMMENDED: [],
    UNKNOWN: [],
  };

  for (const snap of snapshots) {
    const res = await fetch(`${BASE_URL}/api/price-history/${snap.id}`);
    if (!res.ok) {
      console.log(`  [SKIP] ${snap.id.slice(0, 8)}... (${snap.title ?? "제목없음"}) — HTTP ${res.status}`);
      continue;
    }
    const data = (await res.json()) as PriceHistoryResponse;
    const state = sellerDecisionStateFromUnifiedDecision(data.unifiedDecision);
    const detail = data.unifiedDecision
      ? `verdict=${data.unifiedDecision.verdict} completeness=${data.unifiedDecision.dataCompleteness} margin=${data.unifiedDecision.marginPercent.value}%`
      : `sellingPriceKrw=${data.currentPrice?.sellingPriceKrw ?? "null"} reason=${data.sellability?.reason ?? "-"}`;
    byState[state.code].push({ id: snap.id, title: snap.title, detail });
  }

  console.log("=== 5개 상태 분포 ===\n");
  for (const [code, items] of Object.entries(byState)) {
    console.log(`${code} — ${items.length}건`);
    for (const item of items) {
      console.log(`  - ${item.id.slice(0, 8)}... "${item.title ?? "제목없음"}" | ${item.detail}`);
    }
  }

  console.log("\n=== P-3-0 완료 기준 대조 ===");
  console.log(`⚪ 판단 불가: ${byState.UNKNOWN.length}건 (필요 1개 이상)`);
  console.log(`🟢 판매 가능(READY): ${byState.READY.length}건 (필요 2개 이상)`);
  console.log(`🟡 가격 조정 필요(ADJUST): ${byState.ADJUST.length}건 (필요 2개 이상)`);
  console.log(`🟠 비용 확인 필요(NEEDS_COST_INFO): ${byState.NEEDS_COST_INFO.length}건 (필요 2개 이상)`);
  console.log(`🔴 판매 비추천(NOT_RECOMMENDED): ${byState.NOT_RECOMMENDED.length}건 (필요 2개 이상)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
