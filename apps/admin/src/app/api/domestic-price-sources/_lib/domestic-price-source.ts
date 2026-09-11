import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * N-4.07(대표님 지시: "후보군 리스트는 추가로 관리할수 있게 해줘") —
 * domestic_price_sources(마이그레이션 029/030) CRUD. comparison-shop.ts와
 * 완전히 같은 패턴(SYSTEM=조사 완료 후 seed된 후보, USER=관리자가 직접
 * 추가 — SYSTEM은 비활성화만, USER는 삭제도 가능)을 그대로 따른다 — 이
 * 프로젝트에서 이미 검증된 편집샵 관리 UX를 새로 발명하지 않는다.
 */
export type DomesticSourcePriority = "P0" | "P1" | "P2";
export type DomesticSourceCollectionStrategy = "AUTO_API" | "AUTO_SCRAPE" | "MANUAL" | "NOT_AVAILABLE";
export type DomesticSourceStatus = "ACTIVE" | "PAUSED" | "NOT_AVAILABLE" | "ERROR";

export interface DomesticPriceSource {
  id: string;
  name: string;
  domain: string;
  url: string;
  currency: string;
  categoryScope: string[];
  priority: DomesticSourcePriority;
  collectionStrategy: DomesticSourceCollectionStrategy;
  status: DomesticSourceStatus;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  /** N-4.07 2차(마이그레이션 032) — cron/수동 확인이 이 소스를 마지막으로 "시도"한
   * 시각(성공 여부 무관)과 마지막으로 "성공"한 시각을 분리해서 기록한다. Settings
   * 목록의 "마지막 확인" 컬럼이 이 값을 그대로 보여준다. */
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  source: "SYSTEM" | "USER";
  /** GLOBAL-MARKET ③-2(CPO 확정, 2026-09-11) — 이 워크스페이스에서의 실효 노출.
   * catalogEnabled && workspaceEnabled로 이미 합쳐진 값이다. 호출부(검색/일일
   * 확인/화면)가 두 플래그를 각자 AND하기 시작하면 한 곳에서 반드시 빠뜨린다 —
   * 합치는 자리를 listDomesticPriceSources() 한 곳으로 고정한다. */
  enabled: boolean;
  /** 운영자가 이 편집샵을 서비스에서 내렸는지(전역 kill switch).
   * domestic_price_sources.enabled 원본 값. */
  catalogEnabled: boolean;
  /** 이 판매자가 자기 목록에서 쓰는지. 설정 행이 없으면 true(=ON)다 —
   * 카탈로그에 새로 추가된 편집샵이 기존 판매자에게 안 보이면 안 되기 때문
   * (마이그레이션 047 주석 참고). 설정 화면의 체크박스가 쓰는 값. */
  workspaceEnabled: boolean;
  createdAt: string;
}

interface DomesticPriceSourceRow {
  id: string;
  name: string;
  domain: string;
  url: string;
  currency: string;
  category_scope: string[];
  priority: DomesticSourcePriority;
  collection_strategy: DomesticSourceCollectionStrategy;
  status: DomesticSourceStatus;
  last_error_code: string | null;
  last_error_message: string | null;
  /** 마이그레이션 032 이전 세션(컬럼 미반영)에서도 select("*")가 크래시하지
   * 않도록 optional로 받는다(price-observations.ts의 source_ref_id와 같은 이유). */
  last_checked_at?: string | null;
  last_success_at?: string | null;
  source: "SYSTEM" | "USER";
  enabled: boolean;
  created_at: string;
}

function toSource(row: DomesticPriceSourceRow, workspaceEnabled: boolean): DomesticPriceSource {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    url: row.url,
    currency: row.currency,
    categoryScope: row.category_scope ?? [],
    priority: row.priority,
    collectionStrategy: row.collection_strategy,
    status: row.status,
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
    lastCheckedAt: row.last_checked_at ?? null,
    lastSuccessAt: row.last_success_at ?? null,
    source: row.source,
    enabled: row.enabled && workspaceEnabled,
    catalogEnabled: row.enabled,
    workspaceEnabled,
    createdAt: row.created_at,
  };
}

/** GLOBAL-MARKET ③-2 — 마이그레이션 047(workspace_domestic_shop_settings)이 아직
 * 실행되지 않은 세션에서도 편집샵 목록이 통째로 비지 않게 하는 감지기.
 * price-observations.ts의 isMissingColumnError와 같은 원칙(코드는 우아하게
 * 저하, 마이그레이션 전까지는 새 기능만 비어 있음)이고, 대상이 컬럼이 아니라
 * 테이블이라 PostgREST가 내는 문구(schema cache / relation does not exist)와
 * Postgres 코드(42P01), PostgREST 코드(PGRST205)를 함께 본다. */
function isMissingTableError(error: { message: string; code?: string }): boolean {
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return /schema cache|relation .* does not exist|could not find the table/i.test(error.message);
}

/**
 * GLOBAL-MARKET ③-2(CPO 확정, 2026-09-11) — 이 워크스페이스가 보는 편집샵 목록.
 *
 * workspaceId를 선택 인자로 두지 않는다. 선택 인자로 두면 "여기선 안 넘겨도
 * 되겠지"가 한 번만 생겨도 한 판매자의 설정이 다른 판매자에게 새어 나간다 —
 * 스냅샷 소유권(snapshot.ts)과 동일하게 경계를 인자 자체로 강제한다.
 */
export async function listDomesticPriceSources(workspaceId: string): Promise<DomesticPriceSource[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("domestic_price_sources")
    .select("*")
    .order("priority", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    console.warn("[domestic-price-source] 목록 조회 실패:", error.message);
    return [];
  }

  const settings = await loadWorkspaceShopSettings(workspaceId);
  // 설정 행이 없으면 ON이다(마이그레이션 047 주석) — Map에 없으면 true.
  return (data as DomesticPriceSourceRow[]).map((row) => toSource(row, settings.get(row.id) ?? true));
}

/** 판매자별 ON/OFF를 source_id → enabled 맵으로 읽는다. 테이블이 아직 없으면
 * (마이그레이션 047 미실행) 빈 맵을 돌려준다 — 전부 "설정 없음 = ON"으로
 * 처리되어 실효 노출이 카탈로그 상태와 정확히 같아진다(= 오늘의 동작 그대로).
 * 목록을 비우는 쪽으로 실패하면 "편집샵이 전부 사라졌다"로 보이므로, 여기서는
 * 카탈로그 상태로 열리는 쪽(fail open)이 맞다. */
async function loadWorkspaceShopSettings(workspaceId: string): Promise<Map<string, boolean>> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Map();
  const { data, error } = await supabase
    .from("workspace_domestic_shop_settings")
    .select("source_id, enabled")
    .eq("workspace_id", workspaceId);
  if (error) {
    if (!isMissingTableError(error)) {
      console.warn("[domestic-price-source] 판매자별 설정 조회 실패:", error.message);
    }
    return new Map();
  }
  return new Map((data as { source_id: string; enabled: boolean }[]).map((r) => [r.source_id, r.enabled]));
}

/**
 * GLOBAL-MARKET ③-2 — 설정 화면 체크박스가 쓰는 판매자별 토글.
 *
 * domestic_price_sources.enabled는 절대 건드리지 않는다. 그게 이번 작업이
 * 고치는 버그 그 자체다 — 한 판매자의 선택이 카탈로그를 바꾸면 모두의 목록이
 * 같이 바뀐다. 여기서는 (workspace_id, source_id) PK 위에 upsert만 한다.
 */
export async function setWorkspaceDomesticShopEnabled(
  workspaceId: string,
  sourceId: string,
  enabled: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };
  const { error } = await supabase
    .from("workspace_domestic_shop_settings")
    .upsert(
      { workspace_id: workspaceId, source_id: sourceId, enabled, updated_at: new Date().toISOString() },
      { onConflict: "workspace_id,source_id" },
    );
  if (!error) return { ok: true };
  // 목록 조회와 달리 여기서는 조용히 넘어가지 않는다 — 저장이 안 됐는데
  // 성공으로 보이면 판매자는 껐다고 믿고 화면은 다시 켜진 상태로 돌아온다.
  if (isMissingTableError(error)) {
    return { ok: false, error: "편집샵 개인 설정 테이블이 아직 없습니다(마이그레이션 047 필요)." };
  }
  return { ok: false, error: error.message };
}

function parseShopUrl(raw: string): { url: string; domain: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  for (const candidate of [trimmed, `https://${trimmed}`]) {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      const domain = parsed.hostname.replace(/^www\./, "").toLowerCase();
      if (!domain) continue;
      return { url: parsed.toString(), domain };
    } catch {
      continue;
    }
  }
  return null;
}

export interface CreateDomesticPriceSourceInput {
  url: string;
  name?: string;
  categoryScope?: string[];
  priority?: DomesticSourcePriority;
  /** 대표님 지시(N-4.06 Track 1): "임의로 AUTO_SCRAPE로 확정하지 않는다" —
   * 실제 사이트 구조를 조사하기 전까지는 기본값을 MANUAL로 둔다(추정 금지 원칙,
   * 이 함수는 검증 없이 호출부가 준 값을 그대로 저장만 한다). */
  collectionStrategy?: DomesticSourceCollectionStrategy;
}

export async function createDomesticPriceSource(
  input: CreateDomesticPriceSourceInput,
): Promise<{ ok: true; source: DomesticPriceSource } | { ok: false; error: string }> {
  const parsed = parseShopUrl(input.url);
  if (!parsed) {
    return { ok: false, error: "올바른 URL이 아닙니다(http/https만 허용됩니다)." };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };

  const { data: existing } = await supabase
    .from("domestic_price_sources")
    .select("id")
    .eq("domain", parsed.domain)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: "이미 등록된 도메인입니다." };
  }

  const { data, error } = await supabase
    .from("domestic_price_sources")
    .insert({
      name: input.name?.trim() || parsed.domain,
      domain: parsed.domain,
      url: parsed.url,
      currency: "KRW",
      category_scope: input.categoryScope ?? [],
      priority: input.priority ?? "P2",
      collection_strategy: input.collectionStrategy ?? "MANUAL",
      status: "ACTIVE",
      source: "USER",
      enabled: true,
    })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  // GLOBAL-MARKET ③-2 — 방금 만든 카탈로그 행에는 판매자 설정이 아직 없다.
  // "설정 행 없음 = ON"이므로 workspaceEnabled=true로 돌려준다(추가하자마자
  // 꺼진 것처럼 보이면 안 된다).
  return { ok: true, source: toSource(data as DomesticPriceSourceRow, true) };
}

/** GLOBAL-MARKET ③-2 — enabled가 여기서 빠졌다. 판매자별 ON/OFF는
 * setWorkspaceDomesticShopEnabled()만 쓴다 — 이 입력 타입에 enabled가 남아
 * 있으면 언젠가 누군가 그 경로로 카탈로그를 꺼서 모든 판매자의 목록에서
 * 편집샵이 사라진다(이번에 고치는 버그 그 자체). 타입에서 지워 구조적으로
 * 막는다. 나머지 필드(priority/collectionStrategy/status/categoryScope)는
 * 원래부터 공용 카탈로그 메타데이터라 그대로 둔다. */
export interface UpdateDomesticPriceSourceInput {
  priority?: DomesticSourcePriority;
  collectionStrategy?: DomesticSourceCollectionStrategy;
  status?: DomesticSourceStatus;
  categoryScope?: string[];
}

export async function updateDomesticPriceSource(
  id: string,
  input: UpdateDomesticPriceSourceInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.collectionStrategy !== undefined) patch.collection_strategy = input.collectionStrategy;
  if (input.status !== undefined) patch.status = input.status;
  if (input.categoryScope !== undefined) patch.category_scope = input.categoryScope;
  const { error } = await supabase.from("domestic_price_sources").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** SYSTEM(조사 완료 후 seed된) 후보는 삭제하지 않는다 — 비활성화만 지원
 * (comparison_shops와 동일 원칙, deleteComparisonShop 참고). */
export async function deleteDomesticPriceSource(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };

  const { data: existing, error: fetchError } = await supabase
    .from("domestic_price_sources")
    .select("source")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) return { ok: false, error: fetchError.message };
  if (!existing) return { ok: false, error: "Source를 찾을 수 없습니다." };
  if ((existing as { source: string }).source === "SYSTEM") {
    return { ok: false, error: "조사 완료 후보는 삭제할 수 없습니다 — 비활성화해주세요." };
  }

  const { error } = await supabase.from("domestic_price_sources").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** N-4.18-M STEP M-8(대표님 지시, 2026-08-26: "실제로 구분 가능한 상태만 추가.
 * 현재 구분할 수 없다면 새로운 status를 추측해서 만들지 않는다") — last_error_code/
 * last_error_message 컬럼은 마이그레이션 032부터 있었지만 이 함수가 한 번도
 * 값을 쓴 적이 없어(success: boolean만 받음) 항상 null이었다(Settings 화면의
 * "최근 오류" 표시가 계속 비어있던 이유). 지금 코드가 실제로 구분할 수 있는
 * 상태만 기록한다:
 *  - "OK": 검색이 성공하고 후보를 찾음
 *  - "NO_RESULT": 검색 요청 자체는 성공했지만 후보가 0건(에러 아님 — 검색은 됐다)
 *  - { code, message }: 검색 중 실제 예외 발생(현재 코드는 fetch 실패와 parser
 *    실패를 같은 try/catch로 묶어서 서로 구분 못 한다 — CEO가 예시로 든
 *    FETCH_FAILED/PARSER_EMPTY/SOURCE_BLOCKED/INVALID_URL로 세분화하려면 파서마다
 *    별도 에러 타입을 던지게 고쳐야 하는데, 이건 "모니터링 스프린트"의 범위를
 *    넘는 구조 변경이라 하지 않는다 — 대신 실제 예외 메시지를 그대로 저장해서
 *    최소한 "왜"는 사람이 읽을 수 있게 한다). */
export type DomesticSourceCheckOutcome = "OK" | "NO_RESULT" | { code: string; message: string };

export async function recordDomesticSourceCheckAttempt(
  sourceId: string,
  outcome: DomesticSourceCheckOutcome,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { last_checked_at: now };
  if (outcome === "OK") {
    patch.last_success_at = now;
    patch.last_error_code = null;
    patch.last_error_message = null;
  } else if (outcome === "NO_RESULT") {
    patch.last_error_code = "NO_RESULT";
    patch.last_error_message = null;
  } else {
    patch.last_error_code = outcome.code;
    patch.last_error_message = outcome.message;
  }
  const { error } = await supabase.from("domestic_price_sources").update(patch).eq("id", sourceId);
  if (error) console.warn("[domestic-price-source] 확인 시각 갱신 실패:", error.message);
}
