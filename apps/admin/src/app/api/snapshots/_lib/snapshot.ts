import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { generateJobKey } from "./job-key";
import type { ProductSnapshot, ProductSnapshotSummary, SnapshotWorkspaceState } from "./types";

interface SnapshotRow {
  id: string;
  source_url: string;
  title: string | null;
  thumbnail_url: string | null;
  status: "IN_PROGRESS" | "REGISTERED";
  workspace: SnapshotWorkspaceState;
  created_at: string;
  updated_at: string;
  last_opened_at: string;
  /** 마이그레이션 025 실행 전에는 select 결과에 이 컬럼이 아예 없다 —
   * optional로 둬서 구버전 DB에서도 undefined로 안전하게 읽힌다. */
  job_key?: string | null;
  /** BETA-SECURITY-2 — 소유 workspace. 마이그레이션 043 실행 전에는 컬럼이
   * 없으므로 optional로 둔다(job_key와 같은 이유). */
  workspace_id?: string | null;
}

function toSnapshot(row: SnapshotRow): ProductSnapshot {
  return {
    id: row.id,
    sourceUrl: row.source_url,
    title: row.title,
    thumbnailUrl: row.thumbnail_url,
    status: row.status,
    workspace: row.workspace,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastOpenedAt: row.last_opened_at,
    jobKey: row.job_key ?? null,
    // 이 값을 실어두면 스냅샷을 이미 읽은 호출부가 소유자를 다시 조회하거나
    // 인자로 넘겨받지 않고도 저장 시 소유권을 유지할 수 있다.
    workspaceId: row.workspace_id ?? null,
  };
}

function toSummary(row: SnapshotRow): ProductSnapshotSummary {
  return {
    id: row.id,
    sourceUrl: row.source_url,
    title: row.title,
    thumbnailUrl: row.thumbnail_url,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastOpenedAt: row.last_opened_at,
    jobKey: row.job_key ?? null,
  };
}

const SUMMARY_COLUMNS = "id, source_url, title, thumbnail_url, status, created_at, updated_at, last_opened_at, job_key";
// job_key 없이도 최소한 목록은 뜨게 하는 폴백 — 마이그레이션 025 실행 전 컬럼
// 자체가 없으면 명시적 컬럼 select가 통째로 실패한다(다른 optional 컬럼들과
// 달리 이건 select라 insert처럼 "실패한 컬럼만 제외하고 재시도"가 안 되고,
// 컬럼 하나짜리라 폴백 목록을 따로 유지한다).
const SUMMARY_COLUMNS_FALLBACK = "id, source_url, title, thumbnail_url, status, created_at, updated_at, last_opened_at";

/**
 * BETA-SECURITY-2 §11 — workspaceId는 선택 인자가 아니다.
 *
 * 이전 버전은 인자 없이 전체 스냅샷을 반환했고, 그 위의 GET /api/snapshots가
 * 인증도 없었기 때문에 누구나 전 사용자의 상품 목록을 받을 수 있었다.
 * 필수 인자로 만들어서, 호출부가 workspace를 정하지 않고는 이 함수를 부를
 * 수 없게 한다 — 깜빡하면 런타임이 아니라 타입체크에서 잡힌다.
 */
export async function listRecentSnapshots(workspaceId: string, limit = 50): Promise<ProductSnapshotSummary[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const primary = await supabase
    .from("product_snapshots")
    .select(SUMMARY_COLUMNS)
    .eq("workspace_id", workspaceId)
    .order("last_opened_at", { ascending: false })
    .limit(limit);
  let data: unknown[] | null = primary.data;
  let error = primary.error;
  if (error) {
    const fallback = await supabase
      .from("product_snapshots")
      .select(SUMMARY_COLUMNS_FALLBACK)
      .eq("workspace_id", workspaceId)
      .order("last_opened_at", { ascending: false })
      .limit(limit);
    data = fallback.data;
    error = fallback.error;
  }
  if (error) {
    console.warn("[snapshot] 목록 조회 실패:", error.message);
    return [];
  }
  return (data as SnapshotRow[]).map(toSummary);
}

/** N-3.56(STEP1/2) — "오늘의 등록 준비" 대시보드가 여러 스냅샷의 전체
 * workspace(canonicalProduct 포함)를 한 번에 읽어야 해서 추가했다.
 * getSnapshot()과 달리 last_opened_at을 갱신하지 않는다 — 대시보드를 보기만
 * 해도 "최근 작업" 정렬 순서가 바뀌면 안 된다(그 화면은 실제로 연 시점만
 * 반영해야 의미가 있다). */
export async function listRecentSnapshotsFull(workspaceId: string, limit = 30): Promise<ProductSnapshot[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("product_snapshots")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("last_opened_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[snapshot] 전체 목록 조회 실패:", error.message);
    return [];
  }
  return (data as SnapshotRow[]).map(toSnapshot);
}

/**
 * BETA-SECURITY-2 §11 — workspace 경계를 넘어 전체를 읽는 유일한 경로.
 *
 * 일 1회 가격 체크 배치(cron)는 본질적으로 전 사용자 스냅샷을 순회해야
 * 하므로 여기만 예외로 둔다. 사용자 요청 경로에서는 절대 부르지 않는다 —
 * 이름을 길고 분명하게 지은 이유이고, 호출부는 /api/cron 하나뿐이다.
 *
 * 이 함수를 사용자 요청 라우트에서 쓰면 스냅샷 격리가 그대로 무너진다.
 */
export async function listAllSnapshotsForBatch(limit = 30): Promise<ProductSnapshot[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("product_snapshots")
    .select("*")
    .order("last_opened_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[snapshot] 배치 목록 조회 실패:", error.message);
    return [];
  }
  return (data as SnapshotRow[]).map(toSnapshot);
}

/** P-13C-2 STEP3-B — getSnapshot()과 달리 last_opened_at을 갱신하지 않는다.
 * Category Recommendation Cache 백그라운드 작업(사용자가 화면을 연 게 아니라
 * 시스템이 스냅샷 생성 직후 자동으로 호출)이 "최근 작업" 정렬 순서를
 * 건드리면 안 된다 — listRecentSnapshotsFull()과 같은 원칙. */
export async function getSnapshotRaw(id: string, workspaceId: string): Promise<ProductSnapshot | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("product_snapshots")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error || !data) {
    console.warn("[snapshot] 단건 조회(raw) 실패:", error?.message);
    return null;
  }
  return toSnapshot(data as SnapshotRow);
}

/** 이어서 작업 진입 시 호출 — 조회와 동시에 last_opened_at을 갱신해 목록
 * 정렬(최근 열람순)에 바로 반영되게 한다. */
/** BETA-SECURITY-2 §11/§18 — 소유권 검사를 라우트가 아니라 쿼리 자체에 건다.
 * `id` AND `workspace_id`가 함께 일치할 때만 행을 돌려준다. 남의 스냅샷을
 * 요청하면 "권한 없음"이 아니라 그냥 없는 것으로 보인다(null) — 타인의
 * 데이터가 존재한다는 사실 자체를 알려주지 않기 위해서다. */
export async function getSnapshot(id: string, workspaceId: string): Promise<ProductSnapshot | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("product_snapshots")
    .update({ last_opened_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select()
    .single();
  if (error || !data) {
    console.warn("[snapshot] 단건 조회 실패:", error?.message);
    return null;
  }
  return toSnapshot(data as SnapshotRow);
}

export interface SaveSnapshotInput {
  id?: string;
  sourceUrl: string;
  title: string | null;
  thumbnailUrl: string | null;
  workspace: SnapshotWorkspaceState;
  /** BETA-SECURITY-2 §11/§13 — 세션에서 결정된 workspace. 요청 body에서
   * 받은 값을 여기 넣으면 안 된다(라우트가 requireUser() 결과만 전달한다).
   * 필드 이름이 workspace(분석 상태 blob)와 헷갈리기 쉬워 주의가 필요하다 —
   * `workspace`는 데이터, `workspaceId`는 소유자다. */
  workspaceId: string;
}

/** id가 있으면 update, 없으면 insert — pipeline/page.tsx가 분석 완료 시점에
 * id 없이 첫 저장을 하고, 이후 편집마다 받은 id로 계속 upsert한다(matches
 * "워크스페이스는 항상 최신 상태 하나만 유지" — 버전 이력 없음, 계획서 참고). */
export async function saveSnapshot(
  input: SaveSnapshotInput,
): Promise<{ ok: true; snapshot: ProductSnapshot } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };

  const row = {
    source_url: input.sourceUrl,
    title: input.title,
    thumbnail_url: input.thumbnailUrl,
    workspace: input.workspace,
    workspace_id: input.workspaceId,
  };

  if (input.id) {
    // 남의 스냅샷 id를 보내도 workspace가 다르면 0행이 갱신된다(덮어쓰기 불가).
    const { data, error } = await supabase
      .from("product_snapshots")
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq("id", input.id)
      .eq("workspace_id", input.workspaceId)
      .select()
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "스냅샷을 찾을 수 없습니다." };
    return { ok: true, snapshot: toSnapshot(data as SnapshotRow) };
  }

  // Sprint B-1(CPO 지시) — 새 스냅샷(=새 Job)이 처음 생기는 순간이 바로 여기다.
  // job_key는 이 최초 insert 시점에 한 번만 채번한다(update 경로에서는 절대
  // 다시 만들지 않는다 — 같은 작업을 계속 편집하는 동안 번호가 바뀌면 추적이
  // 끊긴다). 마이그레이션 025 미실행 환경(컬럼 없음)에서는 job_key 없이 insert
  // 재시도한다 — 다른 optional 컬럼들과 같은 원칙, job_key가 없다고 스냅샷
  // 저장 자체를 막지 않는다.
  const jobKey = await generateJobKey();
  const { data, error } = await supabase
    .from("product_snapshots")
    .insert({ ...row, job_key: jobKey })
    .select()
    .single();
  if (error) {
    const { data: retryData, error: retryError } = await supabase
      .from("product_snapshots")
      .insert(row)
      .select()
      .single();
    if (retryError) return { ok: false, error: retryError.message };
    return { ok: true, snapshot: toSnapshot(retryData as SnapshotRow) };
  }
  return { ok: true, snapshot: toSnapshot(data as SnapshotRow) };
}

/** workspace jsonb를 그대로 복제해 새 행을 만든다 — status는 항상 IN_PROGRESS로
 * 리셋한다(원본이 이미 REGISTERED였어도 복제본은 새로 등록해야 하는 별개
 * 작업이다). */
export async function duplicateSnapshot(
  id: string,
  workspaceId: string,
): Promise<{ ok: true; snapshot: ProductSnapshot } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };

  // 복제도 소유한 스냅샷만 가능하다 — 남의 id로 복제하면 그 데이터를 자기
  // workspace로 옮겨오는 셈이 된다.
  const { data: original, error: fetchError } = await supabase
    .from("product_snapshots")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (fetchError || !original) {
    return { ok: false, error: "원본 스냅샷을 찾을 수 없습니다." };
  }
  const source = original as SnapshotRow;

  const { data, error } = await supabase
    .from("product_snapshots")
    .insert({
      source_url: source.source_url,
      title: source.title,
      thumbnail_url: source.thumbnail_url,
      status: "IN_PROGRESS",
      workspace: source.workspace,
      workspace_id: workspaceId,
    })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, snapshot: toSnapshot(data as SnapshotRow) };
}

/** BETA-SECURITY-2 §11 — 이번 작업에서 가장 중요한 함수다.
 *
 * 이전 버전은 인증도 소유권 검사도 없어서, id만 알면 누구나 남의 운영
 * 데이터를 삭제할 수 있었다(기밀성이 아니라 무결성 사고). workspace가
 * 일치하지 않으면 0행이 삭제되고, 호출부는 성공/실패를 구분할 수 있어야
 * 하므로 삭제된 행 수를 확인한다. */
export async function deleteSnapshot(
  id: string,
  workspaceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };
  const { data, error } = await supabase
    .from("product_snapshots")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  // 남의 스냅샷이었으면 여기서 0행이다 — §18에 따라 "권한 없음"이 아니라
  // "없음"으로 응답하도록 호출부에 알린다.
  if (!data || data.length === 0) return { ok: false, error: "스냅샷을 찾을 수 없습니다." };
  return { ok: true };
}

/** LIVE 등록 성공 시 register/route.ts가 호출한다 — 실패해도 등록 자체 응답을
 * 막을 이유가 없어 예외만 삼킨다(logRegistrationAttempt와 같은 원칙). */
export async function markSnapshotRegistered(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const { error } = await supabase
    .from("product_snapshots")
    .update({ status: "REGISTERED", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.warn("[snapshot] 등록완료 상태 갱신 실패:", error.message);
  }
}
