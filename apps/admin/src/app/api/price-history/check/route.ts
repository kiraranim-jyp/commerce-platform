import { NextResponse } from "next/server";
import { backfillCanonicalProduct, buildProductIdentityDna } from "@commerce/shared";
import { computeMarketAlert, type AlertCategory } from "@commerce/pricing";
import { getSnapshot } from "../../snapshots/_lib/snapshot";
import { computeMarketIntelligence } from "../_lib/market-intelligence";
import { openAlertIfNotActive, resolveAlertsNotIn } from "../_lib/price-alerts";
import { runDomesticPriceCheck } from "../_lib/run-domestic-price-check";
import { runPriceCheck } from "../_lib/run-price-check";

/**
 * N-4.01 Part I(대표님 지시) — 수동 "지금 확인" 트리거. daily cron
 * (/api/cron/daily-price-check)과 같은 runPriceCheck()를 그대로 호출한다.
 *
 * N-4.07 2차 — 국내 편집샵 동일상품 매칭+가격 관측(runDomesticPriceCheck)도 같이
 * 실행한다. 국내 파이프라인 실패가 해외 원가/네이버 결과를 지우면 안 되므로
 * try/catch로 격리하고, 실패해도 원래 result에 domesticShop 필드만 에러로
 * 채워서 반환한다(전체 실패로 만들지 않는다 — PART U 원칙과 동일).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { snapshotId?: string } | null;
  const snapshotId = body?.snapshotId;
  if (!snapshotId) {
    return NextResponse.json({ ok: false, error: "snapshotId가 필요합니다." }, { status: 400 });
  }

  const snapshot = await getSnapshot(snapshotId);
  if (!snapshot) {
    return NextResponse.json({ ok: false, error: "스냅샷을 찾을 수 없습니다." }, { status: 404 });
  }

  const product = backfillCanonicalProduct(snapshot.workspace.canonicalProduct);
  const result = await runPriceCheck({
    snapshotId,
    originalPriceAmount: product.price.value.amount,
    originalCurrency: product.price.value.currency,
  });

  let domesticShop;
  try {
    domesticShop = await runDomesticPriceCheck({
      snapshotId,
      dna: buildProductIdentityDna(product),
    });
  } catch (error) {
    domesticShop = {
      linksCreatedOrUpdated: 0,
      pricesRecorded: 0,
      sourceErrors: [error instanceof Error ? error.message : "국내 가격비교 확인 실패"],
    };
  }

  // N-4.18-K STEP K-2/K-4/K-9(대표님 지시, 2026-08-26: "알림을 만들기 위해
  // 다시 전체 검색하지 않는다", "같은 상태가 유지되는 동안은 최초 1회만") —
  // 이 라우트(수동 "지금 확인" 또는 daily cron)가 실제로 가격을 재조회한
  // 시점에만 알림을 갱신한다. 새 검색을 추가로 하지 않고, 방금 계산한
  // computeMarketIntelligence()의 sellerAction/변화값을 그대로 재사용한다.
  // price_alerts 테이블이 아직 없으면(마이그레이션 039 미실행) openAlertIfNotActive/
  // resolveAlertsNotIn이 조용히 no-op이므로 이 블록이 실패해도 위 result는
  // 그대로 반환된다.
  try {
    const intelligence = await computeMarketIntelligence(snapshotId);
    if (intelligence) {
      const alert = computeMarketAlert({
        sellerAction: intelligence.sellerAction,
        domesticChange: intelligence._alertInputs.domesticChange,
        originChange: intelligence._alertInputs.originChange,
      });
      const stillActive: AlertCategory[] = alert ? [alert.category] : [];
      if (alert) {
        await openAlertIfNotActive({
          snapshotId,
          category: alert.category,
          severity: alert.severity,
          title: alert.title,
          detail: alert.detail,
        });
      }
      await resolveAlertsNotIn(snapshotId, stillActive);
    }
  } catch {
    // 알림 갱신 실패가 가격 확인 자체의 성공/실패를 뒤집지 않는다(PART U 원칙).
  }

  return NextResponse.json({ ...result, domesticShop });
}
