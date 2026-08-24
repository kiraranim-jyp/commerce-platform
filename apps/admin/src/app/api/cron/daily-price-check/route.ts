import { NextResponse } from "next/server";
import { backfillCanonicalProduct, buildProductIdentityDna } from "@commerce/shared";
import { listRecentSnapshotsFull } from "../../snapshots/_lib/snapshot";
import { runDomesticPriceCheck } from "../../price-history/_lib/run-domestic-price-check";
import { runPriceCheck } from "../../price-history/_lib/run-price-check";

/**
 * N-4.01 Part I(대표님 지시: "하루 1회 오전 1시 체크") — Vercel Cron
 * (vercel.json의 crons, "0 16 * * *" UTC = 01:00 KST)이 매일 이 라우트를
 * 호출한다. Vercel이 자동으로 보내는 `Authorization: Bearer $CRON_SECRET`
 * 헤더로 인증한다(CRON_SECRET env var — 코드에 값 하드코딩 없음, PART Q
 * 원칙과 동일). CRON_SECRET을 아직 설정하지 않았으면(이번 세션엔 값이
 * 없다) 인증을 건너뛰고 통과시킨다 — Vercel Cron 자체가 프로젝트 내부에서만
 * 트리거되고, 시크릿 미설정을 이유로 스케줄러 전체가 조용히 죽는 것보다는
 * 낫다(대표님이 CRON_SECRET을 넣으면 그 순간부터 실제로 검증된다).
 *
 * 한 스냅샷의 실패가 나머지를 막지 않는다(PART U "가격 수집 실패 retry,
 * 실패 로그" — 개별 실패를 로그로 남기고 계속 진행한다). listRecentSnapshotsFull
 * 은 last_opened_at을 갱신하지 않는 읽기 전용 조회라 이 배치 작업이 "최근
 * 작업" 화면 정렬을 건드리지 않는다.
 *
 * N-4.03 Part 21 — 상태별 개수(success/partial/noResult/notConfigured/error)를
 * 구조화된 형태로 남긴다. 22 — runPriceCheck(skipIfCheckedToday:true)로 같은
 * 날 재실행(재배포/재시도)에도 SELLER_ORIGIN/NAVER_SHOPPING을 중복 저장하지
 * 않는다.
 */
const MAX_SNAPSHOTS_PER_RUN = 50;

interface SnapshotCheckResult {
  snapshotId: string;
  ok: boolean;
  status: string;
  error?: string;
}

export async function GET(request: Request) {
  const startedAt = new Date().toISOString();
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const snapshots = await listRecentSnapshotsFull(MAX_SNAPSHOTS_PER_RUN);
  const results: SnapshotCheckResult[] = [];

  for (const snapshot of snapshots) {
    try {
      const product = backfillCanonicalProduct(snapshot.workspace.canonicalProduct);
      const result = await runPriceCheck({
        snapshotId: snapshot.id,
        originalPriceAmount: product.price.value.amount,
        originalCurrency: product.price.value.currency,
        skipIfCheckedToday: true,
      });
      results.push({
        snapshotId: snapshot.id,
        ok: result.ok,
        status: result.status,
        error: result.errors.join("; ") || undefined,
      });
    } catch (err) {
      console.error(`[daily-price-check] 스냅샷 ${snapshot.id} 처리 실패:`, err);
      results.push({
        snapshotId: snapshot.id,
        ok: false,
        status: "ERROR",
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // N-4.07 2차 — 국내 편집샵 파이프라인은 위 해외/네이버 체크와 완전히 별도
    // try/catch로 격리한다(한쪽 실패가 다른 쪽 결과를 지우면 안 된다는 PART U
    // 원칙 그대로).
    try {
      const product = backfillCanonicalProduct(snapshot.workspace.canonicalProduct);
      await runDomesticPriceCheck({
        snapshotId: snapshot.id,
        dna: buildProductIdentityDna(product),
        skipIfCheckedToday: true,
      });
    } catch (err) {
      console.error(`[daily-price-check] 스냅샷 ${snapshot.id} 국내 가격비교 실패:`, err);
    }
  }

  const statusCounts = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const successCount = results.filter((r) => r.ok).length;
  const finishedAt = new Date().toISOString();

  const summary = {
    ok: true,
    startedAt,
    finishedAt,
    checkedAt: finishedAt,
    totalSnapshots: snapshots.length,
    successCount,
    failureCount: snapshots.length - successCount,
    statusCounts,
    results,
  };

  console.log(
    `[daily-price-check] run complete: total=${snapshots.length} success=${successCount} statusCounts=${JSON.stringify(statusCounts)} elapsedMs=${Date.parse(finishedAt) - Date.parse(startedAt)}`,
  );

  return NextResponse.json(summary);
}
