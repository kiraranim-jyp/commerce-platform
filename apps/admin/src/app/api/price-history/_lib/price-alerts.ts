import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { AlertCategory, AlertSeverity } from "@commerce/pricing";

/**
 * N-4.18-K STEP K-5(대표님 지시, 2026-08-26) — price_alerts(마이그레이션
 * 039, 수동 실행 대기 중) CRUD. 이 세션에서는 아직 테이블이 없을 수 있다 —
 * 다른 신규 테이블(image_assets/coupang_brand_profiles 등)과 같은 패턴으로,
 * 없으면 조용히 빈 배열/no-op을 반환한다(가격 알림 실패가 등록/가격조회
 * 등 다른 기능을 절대 막으면 안 된다).
 */
export interface PriceAlertRow {
  id: string;
  snapshotId: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  detail: string;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  openedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}

function toRow(row: {
  id: string;
  snapshot_id: string;
  category: string;
  severity: string;
  title: string;
  detail: string;
  status: string;
  opened_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
}): PriceAlertRow {
  return {
    id: row.id,
    snapshotId: row.snapshot_id,
    category: row.category as AlertCategory,
    severity: row.severity as AlertSeverity,
    title: row.title,
    detail: row.detail,
    status: row.status as PriceAlertRow["status"],
    openedAt: row.opened_at,
    acknowledgedAt: row.acknowledged_at,
    resolvedAt: row.resolved_at,
  };
}

export async function listActiveAlerts(snapshotId: string): Promise<PriceAlertRow[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("price_alerts")
    .select("*")
    .eq("snapshot_id", snapshotId)
    .in("status", ["OPEN", "ACKNOWLEDGED"])
    .order("opened_at", { ascending: false });
  if (error || !data) return [];
  return data.map(toRow);
}

/** 대시보드 요약(K-6: "🔴 즉시 확인 3 / 🟡 검토 필요 7 / 🔵 참고 12")용 —
 * snapshot 전체가 아니라 전체 활성 알림의 severity별 개수만 센다. */
export async function countActiveAlertsBySeverity(): Promise<Record<AlertSeverity, number>> {
  const empty: Record<AlertSeverity, number> = { ACTION_REQUIRED: 0, REVIEW: 0, INFO: 0 };
  const supabase = getSupabaseAdmin();
  if (!supabase) return empty;
  const { data, error } = await supabase.from("price_alerts").select("severity").in("status", ["OPEN", "ACKNOWLEDGED"]);
  if (error || !data) return empty;
  for (const row of data as { severity: AlertSeverity }[]) {
    if (row.severity in empty) empty[row.severity] += 1;
  }
  return empty;
}

/**
 * N-4.18-K STEP K-4(대표님 지시: "같은 상태가 유지되는 동안에는 최초 1회만") —
 * 이미 이 snapshot+category로 OPEN/ACKNOWLEDGED 알림이 있으면 새로 만들지
 * 않는다(마이그레이션 039의 partial unique index가 DB 레벨에서도 강제).
 * upsert가 아니라 "있으면 아무것도 안 함"이 핵심 — 기존 알림의 title/detail을
 * 최신값으로 덮어쓰지 않는다(계속 갱신하면 "새로 발생한 것처럼" 보일 수
 * 있어서다 — 대표님이 명시한 "최초 1회만" 원칙).
 */
export async function openAlertIfNotActive(input: {
  snapshotId: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  detail: string;
}): Promise<{ created: boolean }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { created: false };
  const existing = await supabase
    .from("price_alerts")
    .select("id")
    .eq("snapshot_id", input.snapshotId)
    .eq("category", input.category)
    .in("status", ["OPEN", "ACKNOWLEDGED"])
    .maybeSingle();
  if (existing.data) return { created: false };
  const { error } = await supabase.from("price_alerts").insert({
    snapshot_id: input.snapshotId,
    category: input.category,
    severity: input.severity,
    title: input.title,
    detail: input.detail,
    status: "OPEN",
  });
  return { created: !error };
}

/** 조건이 해소된 카테고리는 RESOLVED로 닫는다(예: 가격이 정상화됨) — K-4의
 * "상태가 해소됐다가 다시 발생하면 새로운 Alert" 뒷부분을 구현한다. */
export async function resolveAlertsNotIn(snapshotId: string, stillActiveCategories: AlertCategory[]): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  let query = supabase
    .from("price_alerts")
    .update({ status: "RESOLVED", resolved_at: new Date().toISOString() })
    .eq("snapshot_id", snapshotId)
    .in("status", ["OPEN", "ACKNOWLEDGED"]);
  if (stillActiveCategories.length > 0) {
    query = query.not("category", "in", `(${stillActiveCategories.join(",")})`);
  }
  await query;
}

/** STEP K-5 — 셀러가 "확인함"을 눌렀을 때. */
export async function acknowledgeAlert(id: string): Promise<{ ok: boolean }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false };
  const { error } = await supabase
    .from("price_alerts")
    .update({ status: "ACKNOWLEDGED", acknowledged_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "OPEN");
  return { ok: !error };
}
