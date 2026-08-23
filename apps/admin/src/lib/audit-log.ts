import { getSupabaseAdmin } from "./supabase-admin";

/**
 * N-4.05 Track V(대표님 지시) — 셀러가 무엇을 변경했는지 기록한다
 * (마이그레이션 028_audit_log.sql). price-observations.ts와 같은 패턴 —
 * Supabase admin이 없거나 insert가 실패해도 throw하지 않는다(감사 로그
 * 기록 실패가 실제 기능— 등록/가격변경 등—을 절대 막으면 안 된다, PART U
 * 원칙과 동일).
 */
export type AuditEventType =
  | "PRODUCT_UPDATED"
  | "PRICE_UPDATED"
  | "ATTRIBUTE_UPDATED"
  | "MARKETPLACE_REGISTERED"
  | "MARKETPLACE_FAILED"
  | "SETTING_UPDATED";

export interface AuditLogEntry {
  eventType: AuditEventType;
  actor?: string;
  snapshotId?: string | null;
  marketplace?: string | null;
  field?: string | null;
  beforeValue?: unknown;
  afterValue?: unknown;
  reason?: string | null;
}

export interface AuditLogRecord {
  id: string;
  eventType: AuditEventType;
  actor: string;
  snapshotId: string | null;
  marketplace: string | null;
  field: string | null;
  beforeValue: unknown;
  afterValue: unknown;
  reason: string | null;
  createdAt: string;
}

interface AuditLogRow {
  id: string;
  event_type: AuditEventType;
  actor: string;
  snapshot_id: string | null;
  marketplace: string | null;
  field: string | null;
  before_value: unknown;
  after_value: unknown;
  reason: string | null;
  created_at: string;
}

function toRecord(row: AuditLogRow): AuditLogRecord {
  return {
    id: row.id,
    eventType: row.event_type,
    actor: row.actor,
    snapshotId: row.snapshot_id,
    marketplace: row.marketplace,
    field: row.field,
    beforeValue: row.before_value,
    afterValue: row.after_value,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

/** 기록 실패는 warn만 하고 조용히 넘어간다 — 호출부(등록/가격변경 등)의
 * 실제 동작을 절대 막지 않는다. */
export async function recordAuditLog(entry: AuditLogEntry): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const { error } = await supabase.from("audit_log").insert({
    event_type: entry.eventType,
    actor: entry.actor ?? "admin",
    snapshot_id: entry.snapshotId ?? null,
    marketplace: entry.marketplace ?? null,
    field: entry.field ?? null,
    before_value: entry.beforeValue ?? null,
    after_value: entry.afterValue ?? null,
    reason: entry.reason ?? null,
  });
  if (error) console.warn("[audit-log] 기록 실패:", error.message);
}

export async function getAuditLog(snapshotId: string, limit = 50): Promise<AuditLogRecord[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .eq("snapshot_id", snapshotId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[audit-log] 조회 실패:", error.message);
    return [];
  }
  return (data as AuditLogRow[]).map(toRecord);
}
