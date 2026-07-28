import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { loadSettingsRow } from "./env";

/**
 * 배송 프로필(SellerProfile) — 출고지/반품지/택배사처럼 "상품 데이터"가 아니라
 * "판매자 운영 데이터"에 속하는 값을 상품과 분리해서 관리한다. 여러 개를 만들어
 * 두고(기본/유럽/일본 등) 등록할 때 기본 프로필을 자동으로 쓰거나 나중에 상품별로
 * 고를 수 있는 구조다. 지금 당장은 "기본 프로필 하나"만 실제로 쓰이지만, 스키마와
 * API는 처음부터 다중 프로필을 전제로 만든다.
 */
export interface SellerProfile {
  id: string;
  name: string;
  isDefault: boolean;
  deliveryCompanyCode: string;
  returnCenterCode: string;
  returnChargeName: string;
  companyContactNumber: string;
  returnZipCode: string;
  returnAddress: string;
  returnAddressDetail: string;
  outboundShippingPlaceCode: number | null;
}

interface SellerProfileRow {
  id: string;
  name: string;
  is_default: boolean;
  delivery_company_code: string | null;
  return_center_code: string | null;
  return_charge_name: string | null;
  company_contact_number: string | null;
  return_zip_code: string | null;
  return_address: string | null;
  return_address_detail: string | null;
  outbound_shipping_place_code: number | null;
}

function toProfile(row: SellerProfileRow): SellerProfile {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.is_default,
    deliveryCompanyCode: row.delivery_company_code ?? "",
    returnCenterCode: row.return_center_code ?? "",
    returnChargeName: row.return_charge_name ?? "",
    companyContactNumber: row.company_contact_number ?? "",
    returnZipCode: row.return_zip_code ?? "",
    returnAddress: row.return_address ?? "",
    returnAddressDetail: row.return_address_detail ?? "",
    outboundShippingPlaceCode: row.outbound_shipping_place_code,
  };
}

export async function listSellerProfiles(): Promise<SellerProfile[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("coupang_seller_profiles")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) {
    console.warn("[seller-profile] 목록 조회 실패:", error.message);
    return [];
  }
  return (data as SellerProfileRow[]).map(toProfile);
}

export interface SellerProfileInput {
  name: string;
  deliveryCompanyCode?: string;
  returnCenterCode?: string;
  returnChargeName?: string;
  companyContactNumber?: string;
  returnZipCode?: string;
  returnAddress?: string;
  returnAddressDetail?: string;
  outboundShippingPlaceCode?: number | null;
}

/** 첫 프로필은 자동으로 기본으로 지정한다 — "최초 1회 생성하면 끝"이라는
 * 흐름에서 사용자가 따로 "기본으로 설정"을 누를 필요가 없게 한다. */
export async function createSellerProfile(
  input: SellerProfileInput,
): Promise<{ ok: true; profile: SellerProfile } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };

  const existing = await listSellerProfiles();
  const { data, error } = await supabase
    .from("coupang_seller_profiles")
    .insert({
      name: input.name,
      is_default: existing.length === 0,
      delivery_company_code: input.deliveryCompanyCode ?? null,
      return_center_code: input.returnCenterCode ?? null,
      return_charge_name: input.returnChargeName ?? null,
      company_contact_number: input.companyContactNumber ?? null,
      return_zip_code: input.returnZipCode ?? null,
      return_address: input.returnAddress ?? null,
      return_address_detail: input.returnAddressDetail ?? null,
      outbound_shipping_place_code: input.outboundShippingPlaceCode ?? null,
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, profile: toProfile(data as SellerProfileRow) };
}

export async function setDefaultSellerProfile(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };

  // 하나만 기본일 수 있으므로 나머지를 먼저 전부 내린다.
  const { error: clearError } = await supabase
    .from("coupang_seller_profiles")
    .update({ is_default: false })
    .neq("id", id);
  if (clearError) return { ok: false, error: clearError.message };

  const { error } = await supabase
    .from("coupang_seller_profiles")
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteSellerProfile(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };
  const { error } = await supabase.from("coupang_seller_profiles").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** 프로필이 하나도 없는데 예전 싱글턴(coupang_seller_settings)에 배송 데이터가
 * 남아있으면 "기본" 프로필로 한 번만 자동 승격한다 — 사용자가 값을 다시 입력할
 * 필요가 없게 한다(이전 스프린트에서 이미 이 값들을 실제 계정으로 채워뒀다). */
async function migrateFromLegacySingleton(): Promise<SellerProfile | null> {
  const legacy = await loadSettingsRow();
  if (!legacy) return null;
  const hasShippingData = Boolean(
    legacy.delivery_company_code || legacy.return_center_code || legacy.outbound_shipping_place_code,
  );
  if (!hasShippingData) return null;

  const created = await createSellerProfile({
    name: "기본",
    deliveryCompanyCode: legacy.delivery_company_code ?? undefined,
    returnCenterCode: legacy.return_center_code ?? undefined,
    returnChargeName: legacy.return_charge_name ?? undefined,
    companyContactNumber: legacy.company_contact_number ?? undefined,
    returnZipCode: legacy.return_zip_code ?? undefined,
    returnAddress: legacy.return_address ?? undefined,
    returnAddressDetail: legacy.return_address_detail ?? undefined,
    outboundShippingPlaceCode: legacy.outbound_shipping_place_code,
  });
  if (!created.ok) {
    console.warn("[seller-profile] 레거시 마이그레이션 실패:", created.error);
    return null;
  }
  return created.profile;
}

export async function getDefaultSellerProfile(): Promise<SellerProfile | null> {
  const profiles = await listSellerProfiles();
  if (profiles.length === 0) {
    return migrateFromLegacySingleton();
  }
  return profiles.find((p) => p.isDefault) ?? profiles[0];
}
