import { getSupabaseAdmin } from "./supabase-admin";

/**
 * N-4.05 Track V(대표님 지시) — 셀러가 무엇을 변경했는지 기록한다
 * (마이그레이션 028_audit_log.sql). price-observations.ts와 같은 패턴 —
 * Supabase admin이 없거나 insert가 실패해도 throw하지 않는다(감사 로그
 * 기록 실패가 실제 기능— 등록/가격변경 등—을 절대 막으면 안 된다, PART U
 * 원칙과 동일).
 */
export type AuditEventType =
  /**
   * LOTTEON-REAL-REGISTRATION-02(2026-09-22) — **한시 진단용.**
   *
   * 롯데ON 205 표준카테고리 응답에 고시 품목코드가 들어 있는지 확인하는 읽기
   * 전용 계측의 착지점이다. Vercel 런타임 로그는 볼륨 상한이 있어서(실측: 창이
   * 엔트리 2개까지 줄었다) 셀러가 버튼을 누른 시점과 읽는 시점이 몇 분만
   * 어긋나도 증거가 사라진다. 한 번 확인하면 끝나는 진단이라 타이밍 싸움을
   * 하지 않고 이미 있는 표에 적어 둔다.
   *
   * 🔴 값이 아니라 «구조»(키 이름 · 길이)만 적는다. 확인이 끝나면 이 값과
   *    category-recommend 의 계측 블록을 함께 제거한다.
   */
  | "LOTTEON_REG_01_PROBE"
  | "PRODUCT_UPDATED"
  | "PRICE_UPDATED"
  | "ATTRIBUTE_UPDATED"
  | "MARKETPLACE_REGISTERED"
  | "MARKETPLACE_FAILED"
  | "SETTING_UPDATED"
  // BETA-SECURITY-2 FINAL §5 — Admin 계정관리/사용자 전환 이벤트.
  // event_type은 DB에서 enum이 아니라 text라 값 추가에 마이그레이션이 필요 없다.
  | "IMPERSONATION_STARTED"
  | "IMPERSONATION_ENDED"
  | "USER_STATUS_CHANGED"
  | "USER_PASSWORD_RESET"
  // CS-OBSERVABILITY-1(CPO 지시, 2026-09-10) — 로그인 이벤트. 지금까지 인증
  // 이벤트가 한 건도 남지 않아서 "사장님이 언제 어떻게 로그인했는가"를 Admin에서
  // 확인할 방법이 없었다. event_type이 DB에서 text라 값 추가에 마이그레이션이
  // 필요 없다(위 IMPERSONATION_* 때와 같은 이유).
  //
  // 절대 기록하지 않는 것: 비밀번호, access/refresh/id token, Authorization
  // 헤더, 쿠키 값, OAuth code. 남기는 것은 "누가/언제/어떤 방식으로"뿐이다.
  | "AUTH_GOOGLE_START"
  | "AUTH_GOOGLE_CALLBACK"
  | "AUTH_LOGIN_SUCCESS"
  | "AUTH_LOGIN_FAILURE"
  | "AUTH_LOGOUT";

export interface AuditLogEntry {
  eventType: AuditEventType;
  /** 실제 행위자. Admin이 전환 중이면 "admin"이지 대상 사용자가 아니다. */
  actor?: string;
  /** BETA-SECURITY-2 FINAL §5 — 그 행위가 적용된 사용자(전환 대상 등).
   * 본인이 자기 작업을 한 경우에는 비워둔다(actor가 곧 대상이라 중복이다). */
  targetUserId?: string | null;
  targetLabel?: string | null;
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
  targetUserId: string | null;
  targetLabel: string | null;
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
  target_user_id?: string | null;
  target_label?: string | null;
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
    targetUserId: row.target_user_id ?? null,
    targetLabel: row.target_label ?? null,
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
    target_user_id: entry.targetUserId ?? null,
    target_label: entry.targetLabel ?? null,
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

/**
 * BETA-SECURITY-2 FINAL §5 — Admin 화면용 감사 로그 조회.
 *
 * 기존 getAuditLog()는 snapshot 단위 조회라 "계정에 무슨 일이 있었나"를
 * 볼 수 없다(사용자 전환·상태 변경·비밀번호 재설정은 snapshot과 무관하다).
 * 그래서 전체를 시간순으로 보는 경로를 따로 둔다.
 */
export async function listAdminAuditLog(limit = 100): Promise<AuditLogRecord[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[audit-log] 관리자 조회 실패:", error.message);
    return [];
  }
  return (data as AuditLogRow[]).map(toRecord);
}
