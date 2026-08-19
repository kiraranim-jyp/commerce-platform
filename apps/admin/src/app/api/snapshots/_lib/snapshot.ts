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

export async function listRecentSnapshots(limit = 50): Promise<ProductSnapshotSummary[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const primary = await supabase
    .from("product_snapshots")
    .select(SUMMARY_COLUMNS)
    .order("last_opened_at", { ascending: false })
    .limit(limit);
  let data: unknown[] | null = primary.data;
  let error = primary.error;
  if (error) {
    const fallback = await supabase
      .from("product_snapshots")
      .select(SUMMARY_COLUMNS_FALLBACK)
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
export async function listRecentSnapshotsFull(limit = 30): Promise<ProductSnapshot[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("product_snapshots")
    .select("*")
    .order("last_opened_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[snapshot] 전체 목록 조회 실패:", error.message);
    return [];
  }
  return (data as SnapshotRow[]).map(toSnapshot);
}

/** 이어서 작업 진입 시 호출 — 조회와 동시에 last_opened_at을 갱신해 목록
 * 정렬(최근 열람순)에 바로 반영되게 한다. */
export async function getSnapshot(id: string): Promise<ProductSnapshot | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("product_snapshots")
    .update({ last_opened_at: new Date().toISOString() })
    .eq("id", id)
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
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("product_snapshots")
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq("id", input.id)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
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
): Promise<{ ok: true; snapshot: ProductSnapshot } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };

  const { data: original, error: fetchError } = await supabase
    .from("product_snapshots")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchError || !original) {
    return { ok: false, error: fetchError?.message ?? "원본 스냅샷을 찾을 수 없습니다." };
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
    })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, snapshot: toSnapshot(data as SnapshotRow) };
}

export async function deleteSnapshot(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };
  const { error } = await supabase.from("product_snapshots").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
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
