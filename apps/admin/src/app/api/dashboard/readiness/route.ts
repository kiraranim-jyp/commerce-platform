import { NextResponse } from "next/server";
import { backfillCanonicalProduct } from "@commerce/shared";
import { listRecentSnapshotsFull } from "../../snapshots/_lib/snapshot";
import { computeSnapshotReadiness, type SnapshotReadiness } from "../../snapshots/_lib/compute-readiness";
import { classifyPriorityTier, buildHeadline, tierMeta, type DashboardPriorityTier } from "./_lib/priority";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * N-3.56 STEP2-4(CPO 지시: "여러 상품을 등록할 때 '오늘 뭘 먼저 해야
 * 하지?'가 아직 해결되지 않았다") — 스냅샷 목록을 순회하며 각 상품의
 * 플랫폼별 등록 준비 상태(computeSnapshotReadiness, 기존 validator 재사용)를
 * 계산하고, 우선순위(classifyPriorityTier)로 정렬해 돌려준다. 여기서 새
 * 판정 로직을 만들지 않는다 — 이미 있는 계산을 재조합만 한다(STEP1 원칙).
 *
 * limit(기본 20)만큼만 계산한다 — SmartStore 준비도 계산은 상품마다 Naver
 * API 여러 번(카테고리 상세/주소록/반품택배사/원산지) 호출하므로, "최근
 * 작업" 전체(최대 50개)를 한 번에 돌리면 느리고 레이트리밋 위험도 커진다.
 * 소규모 동시성(3)으로 순차 배치 처리한다(registration-qa-batch.ts와 같은
 * 패턴).
 */
export interface DashboardProductCard {
  id: string;
  sourceUrl: string;
  title: string | null;
  thumbnailUrl: string | null;
  status: "IN_PROGRESS" | "REGISTERED";
  priorityTier: DashboardPriorityTier;
  readiness: SnapshotReadiness;
  /** Sprint B-2(CPO 지시: "/today와도 연결해서 해당 작업을 추적할 수 있게") —
   * listRecentSnapshotsFull()이 select("*")라 이미 응답에 들어있던 값을
   * 카드에도 그대로 옮긴다. 마이그레이션 025 미실행/레거시 스냅샷은 null. */
  jobKey: string | null;
  error?: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 30);

  const snapshots = await listRecentSnapshotsFull(limit);

  const cards: DashboardProductCard[] = [];
  const concurrency = 3;
  for (let i = 0; i < snapshots.length; i += concurrency) {
    const chunk = snapshots.slice(i, i + concurrency);
    const chunkResults = await Promise.all(
      chunk.map(async (snapshot): Promise<DashboardProductCard> => {
        try {
          const product = backfillCanonicalProduct(snapshot.workspace.canonicalProduct);
          const readiness = await computeSnapshotReadiness(
            snapshot.id,
            product,
            snapshot.workspace.categoryMappings,
          );
          const priorityTier = classifyPriorityTier(snapshot.status, readiness);
          return {
            id: snapshot.id,
            sourceUrl: snapshot.sourceUrl,
            title: snapshot.title,
            thumbnailUrl: snapshot.thumbnailUrl,
            status: snapshot.status,
            priorityTier,
            readiness,
            jobKey: snapshot.jobKey,
          };
        } catch (error) {
          // N-3.56 STEP1(안전 원칙) — 상품 하나의 계산 실패가 대시보드
          // 전체를 못 뜨게 만들면 안 된다. 실패한 카드는 4단계(핵심 정보
          // 부족)로 보수적으로 분류하고 이유를 남긴다.
          return {
            id: snapshot.id,
            sourceUrl: snapshot.sourceUrl,
            title: snapshot.title,
            thumbnailUrl: snapshot.thumbnailUrl,
            status: snapshot.status,
            priorityTier: 4,
            readiness: { priceValid: false, priceLevel: "UNKNOWN", platforms: [] },
            jobKey: snapshot.jobKey,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    );
    cards.push(...chunkResults);
  }

  cards.sort((a, b) => a.priorityTier - b.priorityTier);

  const tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<DashboardPriorityTier, number>;
  cards.forEach((c) => {
    tierCounts[c.priorityTier] += 1;
  });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    totalCount: cards.length,
    tierCounts,
    tierMeta: {
      1: tierMeta(1),
      2: tierMeta(2),
      3: tierMeta(3),
      4: tierMeta(4),
      5: tierMeta(5),
    },
    headline: buildHeadline(tierCounts),
    products: cards,
  });
}
