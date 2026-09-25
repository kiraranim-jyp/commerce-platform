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

/*
 * PRICE-ACCURACY-REGRESSION-1.1(CEO 지시, 2026-09-11) — listAllSnapshotsForBatch 제거.
 *
 * 이 함수는 BETA-SECURITY-2 §11에서 "workspace 경계를 넘어 전체를 읽는 유일한
 * 경로"로 예외 허용된 것이었고, 호출부는 일 1회 가격 재확인 배치 하나뿐이었다.
 * 그 배치를 없애면서(등록 여부와 무관하게 모든 스냅샷을 매일 재스캔하는 것은
 * 실효 대비 비효율이라는 CEO 판단) 이 함수도 함께 지운다.
 *
 * 결과적으로 **이제 workspace 경계를 넘어 스냅샷을 읽는 코드가 없다.** 다시
 * 필요해지면 이 함수를 되살리기 전에 그 예외가 정말 필요한지부터 따진다.
 */

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

/**
 * P0-CHANNEL-03 E-2 — `products` 에 정체성 한 줄을 만든다.
 *
 * 🔴 앱 runtime 은 Supabase 로만 DB 에 닿는다(Prisma 는 schema·migration·스크립트
 * 전용). 이 경계를 넘지 않는다.
 *
 * 실패하면 `null` 을 내고 «조용히 넘어간다» — 호출부가 그 뜻을 알고 있다.
 */
async function createProductIdentity(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  input: SaveSnapshotInput,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("products")
    /* 🔴 BETA-SECURITY-2 §11/§13 — 소유자는 «세션에서» 결정된 workspaceId 다.
       063 에서 이 칸을 빠뜨려 products 만 무주공산이었고, snapshot-ownership
       보안 테스트(CASE G)가 그것을 잡았다. 066 으로 칸을 만들고 여기서 채운다. */
    .insert({
      /* ════════════════════════════════════════════════════════════════════
         🔴 F-12d — `id` 와 `updatedAt` 을 «직접» 채운다.

         products 는 Prisma 모델이고 초기 migration 이 이렇게 만들었다:
             "id" TEXT NOT NULL,                ← DEFAULT «없음»
             "updatedAt" TIMESTAMP(3) NOT NULL  ← DEFAULT «없음»
         Prisma 가 @default(cuid()) · @updatedAt 으로 «앱에서» 채우는 값이라 DB
         쪽 기본값이 없다. 그런데 여기는 Supabase raw insert 다 — 두 칸을 비우면
         NOT NULL 위반으로 «항상» 실패한다.

         🔴 그 실패는 아래에서 console.warn 하고 조용히 넘어간다. 그래서 E-2
         이후 products 행이 «한 건도» 만들어지지 않았고, 모든 snapshot 의
         product_id 가 NULL 로 남았으며, 그 결과 ChannelProduct 도 영영 생기지
         않았다. 13714803530 이 연결 없이 떠 있던 진짜 이유가 이것이다.

         바로 아래 product_snapshots 는 `default gen_random_uuid()` 라 비워도
         됐다 — 그래서 같은 파일 안에서 한쪽만 조용히 죽어 있었다. */
      id: crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
      sourceUrl: input.sourceUrl,
      title: input.title ?? "(제목 미확인)",
      workspace_id: input.workspaceId,
    })
    .select("id")
    .single();
  if (error || !data) {
    /* 마이그레이션 063 미적용 환경 등 — 스냅샷 저장을 막지 않는다. */
    console.warn("[snapshot] products insert 실패 — product_id 없이 계속합니다:", error?.message);
    return null;
  }
  return (data as { id: string }).id;
}

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
  /**
   * ══════════════════════════════════════════════════════════════════════════
   * P0-CHANNEL-03 E-2(CPO 확정, 2026-09-25) — **상품 정체성을 여기서 발급한다.**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * job_key 와 «같은 자리» 다 — 새 Job 이 처음 생기는 순간, 딱 한 번.
   * 편집(update 경로)에서는 다시 만들지 않는다. 그래야
   *
   *     Product A ─┬─ Snapshot 1
   *                ├─ Snapshot 2   (재분석)
   *                └─ Snapshot 3
   *
   * 가 성립하고, 재분석해도 기존 채널 등록과의 연결이 끊어지지 않는다.
   * 지금까지는 이 자리가 없어서 한 상품이 SmartStore 외부번호 6개로 갈라졌다.
   *
   * 🔴 sourceUrl 로 «기존 Product 를 찾지 않는다». URL 은 식별자가 아니다 —
   * 같은 상품이 URL 을 바꿀 수 있고, 같은 URL 에서 상품이 바뀔 수 있다.
   * 그래서 여기서는 «항상 새로 발급» 한다. 같은 상품의 두 수집을 하나로 묶는
   * 것은 사람이 확인해야 하는 별도 작업이다(자동 merge 금지, CPO 확정).
   *
   * 🔴 실패해도 스냅샷 저장을 막지 않는다 — job_key 와 같은 원칙이다.
   * product_id 는 nullable 이고, 없으면 기존 381건과 같은 상태가 될 뿐이다.
   * 정체성이 없다고 셀러의 분석 결과를 버리지 않는다.
   */
  const productId = await createProductIdentity(supabase, input);

  const jobKey = await generateJobKey();
  const { data, error } = await supabase
    .from("product_snapshots")
    .insert({ ...row, job_key: jobKey, product_id: productId })
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
