import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

/**
 * 브랜드 프로필(BrandProfile) — Sprint A-12(작업4 — CPO 지시: "Apolina 원산지
 * 영국, 제조자 Apolina Ltd.를 한 번만 입력하면 Apolina 상품은 자동 적용") —
 * SellerProfile과 같은 이유(판매자 운영 데이터를 상품과 분리)로 만들지만,
 * 매칭 단위가 "판매자 전체"가 아니라 "브랜드 하나"다. name이 매칭 키이자
 * unique 제약이다(브랜드당 프로필 하나).
 */
export interface BrandProfile {
  id: string;
  name: string;
  countryOfOrigin: string;
  manufacturer: string;
  brandIntro: string;
  representativeImageUrl: string | null;
  commonDescription: string;
}

interface BrandProfileRow {
  id: string;
  name: string;
  country_of_origin: string | null;
  manufacturer: string | null;
  brand_intro: string | null;
  representative_image_url: string | null;
  common_description: string | null;
}

function toProfile(row: BrandProfileRow): BrandProfile {
  return {
    id: row.id,
    name: row.name,
    countryOfOrigin: row.country_of_origin ?? "",
    manufacturer: row.manufacturer ?? "",
    brandIntro: row.brand_intro ?? "",
    representativeImageUrl: row.representative_image_url,
    commonDescription: row.common_description ?? "",
  };
}

export async function listBrandProfiles(): Promise<BrandProfile[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("coupang_brand_profiles")
    .select("*")
    .order("name", { ascending: true });
  if (error) {
    console.warn("[brand-profile] 목록 조회 실패:", error.message);
    return [];
  }
  return (data as BrandProfileRow[]).map(toProfile);
}

/** product.brand.value(원본 사이트에서 추출/정제된 브랜드명)와 대소문자
 * 무시 정확 일치로 매칭한다 — 부분 일치는 다른 브랜드를 잘못 매칭할 위험이
 * 있어(예: "Play"가 "Play Up"에 매칭) 쓰지 않는다. */
export async function findBrandProfileByName(brandName: string): Promise<BrandProfile | null> {
  const trimmed = brandName.trim();
  if (!trimmed) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("coupang_brand_profiles")
    .select("*")
    .ilike("name", trimmed)
    .maybeSingle();
  if (error || !data) return null;
  return toProfile(data as BrandProfileRow);
}

export interface BrandProfileInput {
  name: string;
  countryOfOrigin?: string;
  manufacturer?: string;
  brandIntro?: string;
  representativeImageUrl?: string | null;
  commonDescription?: string;
}

/** insert/update가 같은 컬럼 매핑을 쓴다(CP001류 중복 방지 — seller-profile.ts의
 * toRowFields와 같은 패턴). */
function toRowFields(input: Partial<BrandProfileInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.name !== undefined) row.name = input.name;
  if (input.countryOfOrigin !== undefined) row.country_of_origin = input.countryOfOrigin || null;
  if (input.manufacturer !== undefined) row.manufacturer = input.manufacturer || null;
  if (input.brandIntro !== undefined) row.brand_intro = input.brandIntro || null;
  if (input.representativeImageUrl !== undefined) row.representative_image_url = input.representativeImageUrl || null;
  if (input.commonDescription !== undefined) row.common_description = input.commonDescription || null;
  return row;
}

export async function createBrandProfile(
  input: BrandProfileInput,
): Promise<{ ok: true; profile: BrandProfile } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };
  const { data, error } = await supabase.from("coupang_brand_profiles").insert(toRowFields(input)).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, profile: toProfile(data as BrandProfileRow) };
}

export async function updateBrandProfile(
  id: string,
  input: Partial<BrandProfileInput>,
): Promise<{ ok: true; profile: BrandProfile } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };
  const { data, error } = await supabase
    .from("coupang_brand_profiles")
    .update({ ...toRowFields(input), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, profile: toProfile(data as BrandProfileRow) };
}

export async function deleteBrandProfile(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };
  const { error } = await supabase.from("coupang_brand_profiles").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
