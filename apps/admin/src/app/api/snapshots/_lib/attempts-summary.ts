import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { PlatformId } from "@commerce/shared";

/**
 * Sprint B-2(CPO 지시: "최근 작업 목록에서 플랫폼/현재상태/오류여부를 확인") —
 * "최근 작업" 목록은 최대 50건까지 한 번에 보여줘야 해서, 상품마다 무거운
 * computeSnapshotReadiness(Naver API 여러 번 호출)를 다시 도는
 * /api/dashboard/readiness 방식은 쓸 수 없다(그건 "오늘의 등록 준비"용으로
 * 이미 최대 20~30개로 제한돼 있다 — N-3.56 STEP1 조사 결과). 대신 이미 쌓여
 * 있는 registration_attempts만 한 번의 쿼리로 읽어서 스냅샷별로 집계한다 —
 * 새 판정 로직이 아니라 기존 이력의 재조합이다.
 */
export interface SnapshotAttemptsSummary {
  /** SUBMITTED 이력이 한 번이라도 있는 플랫폼 — "실제로 등록된 적 있음". */
  registeredPlatforms: PlatformId[];
  /** 플랫폼별 가장 최근 시도가 FAILED인 경우가 하나라도 있으면 true —
   * "지금 이 상품에 뭔가 문제가 있다"를 뜻한다(과거에 실패했다가 나중에
   * 성공한 경우는 최신 시도만 보므로 오류로 잡지 않는다). */
  hasError: boolean;
  /** 이 스냅샷에 연결된 모든 시도(플랫폼 무관) 중 가장 최근 시간. */
  lastAttemptAt: string | null;
}

export interface AttemptRow {
  snapshot_id: string | null;
  platform: string;
  status: "SUBMITTED" | "FAILED";
  created_at: string;
}

/**
 * Sprint D(CPO 지시: "SmartStore/Coupang 실제 등록 상태 분리") — 스냅샷 하나가
 * 두 플랫폼 모두에 시도 이력을 가질 수 있고, 한쪽만 성공/실패해도 서로 절대
 * 섞이면 안 된다(플랫폼별 registeredPlatforms/hasError가 독립적으로 계산돼야
 * 함). DB 조회를 순수 집계 로직에서 분리해서 검증 가능하게 만든다
 * (apps/admin/scripts/verify-attempts-summary.ts에서 단위 검증).
 */
export function aggregateAttemptRows(rows: AttemptRow[]): Record<string, SnapshotAttemptsSummary> {
  const result: Record<string, SnapshotAttemptsSummary> = {};
  // created_at 내림차순으로 이미 정렬돼 있으므로, (snapshot_id, platform) 쌍을
  // 처음 만나는 순간이 그 플랫폼의 "가장 최근 시도"다.
  const seenPlatformPerSnapshot = new Set<string>();
  for (const row of rows) {
    if (!row.snapshot_id) continue;
    const platformKey = `${row.snapshot_id}:${row.platform}`;
    const isLatestForPlatform = !seenPlatformPerSnapshot.has(platformKey);
    if (isLatestForPlatform) seenPlatformPerSnapshot.add(platformKey);

    const entry = (result[row.snapshot_id] ??= {
      registeredPlatforms: [],
      hasError: false,
      lastAttemptAt: null,
    });
    if (!entry.lastAttemptAt || row.created_at > entry.lastAttemptAt) entry.lastAttemptAt = row.created_at;
    if (row.status === "SUBMITTED" && !entry.registeredPlatforms.includes(row.platform as PlatformId)) {
      entry.registeredPlatforms.push(row.platform as PlatformId);
    }
    if (isLatestForPlatform && row.status === "FAILED") entry.hasError = true;
  }
  return result;
}

export async function getAttemptsSummaryBySnapshot(
  snapshotIds: string[],
): Promise<Record<string, SnapshotAttemptsSummary>> {
  if (snapshotIds.length === 0) return {};
  const supabase = getSupabaseAdmin();
  if (!supabase) return {};

  const { data, error } = await supabase
    .from("registration_attempts")
    .select("snapshot_id, platform, status, created_at")
    .in("snapshot_id", snapshotIds)
    .order("created_at", { ascending: false });
  if (error || !data) {
    if (error) console.warn("[attempts-summary] 조회 실패:", error.message);
    return {};
  }
  return aggregateAttemptRows(data as AttemptRow[]);
}
