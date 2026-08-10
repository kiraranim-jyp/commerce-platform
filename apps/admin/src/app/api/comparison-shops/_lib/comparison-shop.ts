import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Sprint B-0 — 가격 비교 대상 해외 편집샵 관리. 이 파일은 크롤링/파싱을 전혀
 * 하지 않는다 — "어떤 사이트를 비교 대상으로 쓸지" 메타데이터 CRUD만 담당한다.
 * SYSTEM(추천 seed)/USER(직접 추가) 구분은 삭제 가능 여부에만 쓰인다 —
 * SYSTEM 사이트는 활성/비활성만, USER 사이트는 삭제까지 가능하다.
 */
export interface ComparisonShop {
  id: string;
  name: string;
  domain: string;
  url: string;
  country: string | null;
  currency: string | null;
  source: "SYSTEM" | "USER";
  isActive: boolean;
  createdAt: string;
}

interface ComparisonShopRow {
  id: string;
  name: string;
  domain: string;
  url: string;
  country: string | null;
  currency: string | null;
  source: "SYSTEM" | "USER";
  is_active: boolean;
  created_at: string;
}

function toShop(row: ComparisonShopRow): ComparisonShop {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    url: row.url,
    country: row.country,
    currency: row.currency,
    source: row.source,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export async function listComparisonShops(): Promise<ComparisonShop[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("comparison_shops")
    .select("*")
    .order("source", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    console.warn("[comparison-shop] 목록 조회 실패:", error.message);
    return [];
  }
  return (data as ComparisonShopRow[]).map(toShop);
}

/** http(s) URL만 허용하고 도메인을 뽑아낸다 — 프로토콜 없이 입력해도(예:
 * "example.com") 자동으로 https://를 붙여 한 번 더 시도한다. */
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

export async function createComparisonShop(
  urlInput: string,
  nameInput?: string,
): Promise<{ ok: true; shop: ComparisonShop } | { ok: false; error: string }> {
  const parsed = parseShopUrl(urlInput);
  if (!parsed) {
    return { ok: false, error: "올바른 URL이 아닙니다(http/https만 허용됩니다)." };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };

  const { data: existing } = await supabase
    .from("comparison_shops")
    .select("id")
    .eq("domain", parsed.domain)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: "이미 등록된 도메인입니다." };
  }

  const { data, error } = await supabase
    .from("comparison_shops")
    .insert({
      name: nameInput?.trim() || parsed.domain,
      domain: parsed.domain,
      url: parsed.url,
      source: "USER",
      is_active: true,
    })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, shop: toShop(data as ComparisonShopRow) };
}

export async function setComparisonShopActive(
  id: string,
  isActive: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };
  const { error } = await supabase
    .from("comparison_shops")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** SYSTEM(추천) 사이트는 삭제하지 않는다 — 활성/비활성만 지원(CPO 지시). */
export async function deleteComparisonShop(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };

  const { data: existing, error: fetchError } = await supabase
    .from("comparison_shops")
    .select("source")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) return { ok: false, error: fetchError.message };
  if (!existing) return { ok: false, error: "사이트를 찾을 수 없습니다." };
  if ((existing as { source: string }).source === "SYSTEM") {
    return { ok: false, error: "추천 사이트는 삭제할 수 없습니다 — 비활성화해주세요." };
  }

  const { error } = await supabase.from("comparison_shops").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
