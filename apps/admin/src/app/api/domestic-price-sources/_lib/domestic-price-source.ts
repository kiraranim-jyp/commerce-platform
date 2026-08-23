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
  enabled: boolean;
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

function toSource(row: DomesticPriceSourceRow): DomesticPriceSource {
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
    enabled: row.enabled,
    createdAt: row.created_at,
  };
}

export async function listDomesticPriceSources(): Promise<DomesticPriceSource[]> {
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
  return (data as DomesticPriceSourceRow[]).map(toSource);
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
  return { ok: true, source: toSource(data as DomesticPriceSourceRow) };
}

export interface UpdateDomesticPriceSourceInput {
  priority?: DomesticSourcePriority;
  collectionStrategy?: DomesticSourceCollectionStrategy;
  status?: DomesticSourceStatus;
  categoryScope?: string[];
  enabled?: boolean;
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
  if (input.enabled !== undefined) patch.enabled = input.enabled;
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

/** N-4.07 2차 — daily cron/수동 확인이 이 소스로 실제 조회를 "시도"할 때마다
 * 호출한다. success=true면 last_success_at도 같이 갱신 — 실패해도
 * last_checked_at은 항상 갱신해서 "확인은 했지만 실패했다"를 "아예 확인 안
 * 했다"와 구분한다. 실패해도 throw하지 않는다(가격 수집 자체가 이 갱신
 * 실패로 막히면 안 된다는 이 프로젝트의 반복 원칙). */
export async function recordDomesticSourceCheckAttempt(sourceId: string, success: boolean): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { last_checked_at: now };
  if (success) patch.last_success_at = now;
  const { error } = await supabase.from("domestic_price_sources").update(patch).eq("id", sourceId);
  if (error) console.warn("[domestic-price-source] 확인 시각 갱신 실패:", error.message);
}
