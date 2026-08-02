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
  /** Sprint A-8(작업1/5) — 상품마다 다시 입력하지 않는 배송 정책 기본값.
   * product.shippingFee(사용자가 실제로 편집한 값)가 있으면 그게 우선이고,
   * 없을 때만(build-payload.ts) 이 기본값을 쓴다. */
  deliveryCharge: number | null;
  returnDeliveryCharge: number | null;
  /** 쿠팡 등록 Payload 실제 스키마에는 "교환배송비" 필드가 없다(확인됨) —
   * 지금은 판매자 정보 화면에 참고용으로만 저장/표시하고 Payload에는 매핑하지
   * 않는다(없는 필드를 지어내지 않는다는 원칙). */
  exchangeDeliveryCharge: number | null;
  outboundLeadTimeDays: number | null;
  deliveryMethod: string;
  /** Sprint A-8(추가 권장사항) — Sprint A-7 실측에서 30건 중 30건을 막은
   * 1위 블로커. 원본 사이트가 아니라 판매자(대표님) 본인의 사업자 정보라
   * SellerProfile에 한 번만 입력하면 된다. */
  manufacturer: string;
  asContactNumber: string;
  qualityGuarantee: string;
  /** Sprint A-11(작업1/2 — CPO 지시: "판매가 = 환율변환가격 × (1+기본마진)")
   * null이면 packages/pricing의 DEFAULT_MARGIN_PERCENT(22%)를 쓴다 — 프로필을
   * 아직 안 만든 판매자도 바로 자동계산이 동작해야 하기 때문이다. */
  defaultMarginPercent: number | null;
  /** true면 자동계산에 배송비를 포함한다(향후 확장용 — 현재 기본 자동계산은
   * 마진만 적용하고 배송비는 "가격 계산 Breakdown"에서 별도로 다룬다). */
  includeShippingInPrice: boolean;
  /** 최종 판매가를 이 단위로 반올림한다 — 쿠팡의 10원 단위 규칙을 항상
   * 만족시키기 위한 기본값 10, Settings에서 100/1000으로 바꿀 수 있다. */
  priceRoundingUnit: number;
  /** Sprint A-11(작업4) — 원본 사이트에 원산지 표기가 없는 상품이 많아(구매대행
   * 특성상) 판매자가 실제로 아는 원산지를 한 번만 입력해두면 상품마다 자동
   * 적용한다. product.countryOfOrigin(실제 원본에서 추출된 값)이 있으면 그게
   * 우선이고, 없을 때만 이 기본값을 쓴다(원본 값을 덮어쓰지 않는다). */
  defaultCountryOfOrigin: string;
  /** Sprint A-11(작업3 — CPO 지시: "상세페이지 공통 이미지") — 브랜드 안내/배송
   * 안내/교환·반품/주의사항/A·S 같이 상품마다 똑같이 붙는 이미지. 실제 업로드된
   * 파일의 공개 URL만 저장한다(파일 자체는 Supabase Storage). enabled가 꺼져
   * 있으면 URL이 있어도 등록 시 삽입하지 않는다. */
  topCommonImageUrl: string | null;
  topCommonImageEnabled: boolean;
  bottomCommonImageUrl: string | null;
  bottomCommonImageEnabled: boolean;
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
  delivery_charge: number | null;
  return_delivery_charge: number | null;
  exchange_delivery_charge: number | null;
  outbound_lead_time_days: number | null;
  delivery_method: string | null;
  manufacturer: string | null;
  as_contact_number: string | null;
  quality_guarantee: string | null;
  default_margin_percent: number | null;
  include_shipping_in_price: boolean | null;
  price_rounding_unit: number | null;
  default_country_of_origin: string | null;
  top_common_image_url: string | null;
  top_common_image_enabled: boolean | null;
  bottom_common_image_url: string | null;
  bottom_common_image_enabled: boolean | null;
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
    deliveryCharge: row.delivery_charge,
    returnDeliveryCharge: row.return_delivery_charge,
    exchangeDeliveryCharge: row.exchange_delivery_charge,
    outboundLeadTimeDays: row.outbound_lead_time_days,
    deliveryMethod: row.delivery_method ?? "",
    manufacturer: row.manufacturer ?? "",
    asContactNumber: row.as_contact_number ?? "",
    qualityGuarantee: row.quality_guarantee ?? "",
    defaultMarginPercent: row.default_margin_percent,
    includeShippingInPrice: row.include_shipping_in_price ?? false,
    priceRoundingUnit: row.price_rounding_unit ?? 10,
    defaultCountryOfOrigin: row.default_country_of_origin ?? "",
    topCommonImageUrl: row.top_common_image_url,
    topCommonImageEnabled: row.top_common_image_enabled ?? false,
    bottomCommonImageUrl: row.bottom_common_image_url,
    bottomCommonImageEnabled: row.bottom_common_image_enabled ?? false,
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
  deliveryCharge?: number | null;
  returnDeliveryCharge?: number | null;
  exchangeDeliveryCharge?: number | null;
  outboundLeadTimeDays?: number | null;
  deliveryMethod?: string;
  manufacturer?: string;
  asContactNumber?: string;
  qualityGuarantee?: string;
  defaultMarginPercent?: number | null;
  includeShippingInPrice?: boolean;
  priceRoundingUnit?: number;
  defaultCountryOfOrigin?: string;
  topCommonImageUrl?: string | null;
  topCommonImageEnabled?: boolean;
  bottomCommonImageUrl?: string | null;
  bottomCommonImageEnabled?: boolean;
}

/** insert/update가 같은 컬럼 매핑을 쓰므로 한 곳에서만 관리한다(CP001류 중복
 * 방지) — Partial<SellerProfileInput>을 받아 없는 필드는 컬럼째 생략한다(빈
 * 문자열로 덮어써서 기존 값을 지우는 사고를 막기 위해 update에서는 "필드가
 * 아예 안 왔다"와 "빈 값으로 지운다"를 구분해야 한다). */
function toRowFields(input: Partial<SellerProfileInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.name !== undefined) row.name = input.name;
  if (input.deliveryCompanyCode !== undefined) row.delivery_company_code = input.deliveryCompanyCode || null;
  if (input.returnCenterCode !== undefined) row.return_center_code = input.returnCenterCode || null;
  if (input.returnChargeName !== undefined) row.return_charge_name = input.returnChargeName || null;
  if (input.companyContactNumber !== undefined) row.company_contact_number = input.companyContactNumber || null;
  if (input.returnZipCode !== undefined) row.return_zip_code = input.returnZipCode || null;
  if (input.returnAddress !== undefined) row.return_address = input.returnAddress || null;
  if (input.returnAddressDetail !== undefined) row.return_address_detail = input.returnAddressDetail || null;
  if (input.outboundShippingPlaceCode !== undefined) row.outbound_shipping_place_code = input.outboundShippingPlaceCode;
  if (input.deliveryCharge !== undefined) row.delivery_charge = input.deliveryCharge;
  if (input.returnDeliveryCharge !== undefined) row.return_delivery_charge = input.returnDeliveryCharge;
  if (input.exchangeDeliveryCharge !== undefined) row.exchange_delivery_charge = input.exchangeDeliveryCharge;
  if (input.outboundLeadTimeDays !== undefined) row.outbound_lead_time_days = input.outboundLeadTimeDays;
  if (input.deliveryMethod !== undefined) row.delivery_method = input.deliveryMethod || null;
  if (input.manufacturer !== undefined) row.manufacturer = input.manufacturer || null;
  if (input.asContactNumber !== undefined) row.as_contact_number = input.asContactNumber || null;
  if (input.qualityGuarantee !== undefined) row.quality_guarantee = input.qualityGuarantee || null;
  if (input.defaultMarginPercent !== undefined) row.default_margin_percent = input.defaultMarginPercent;
  if (input.includeShippingInPrice !== undefined) row.include_shipping_in_price = input.includeShippingInPrice;
  if (input.priceRoundingUnit !== undefined) row.price_rounding_unit = input.priceRoundingUnit;
  if (input.defaultCountryOfOrigin !== undefined) row.default_country_of_origin = input.defaultCountryOfOrigin || null;
  if (input.topCommonImageUrl !== undefined) row.top_common_image_url = input.topCommonImageUrl || null;
  if (input.topCommonImageEnabled !== undefined) row.top_common_image_enabled = input.topCommonImageEnabled;
  if (input.bottomCommonImageUrl !== undefined) row.bottom_common_image_url = input.bottomCommonImageUrl || null;
  if (input.bottomCommonImageEnabled !== undefined) row.bottom_common_image_enabled = input.bottomCommonImageEnabled;
  return row;
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
    .insert({ ...toRowFields(input), is_default: existing.length === 0 })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, profile: toProfile(data as SellerProfileRow) };
}

/** Sprint A-8(작업2/4 — "출고지 수정"/"반품주소 수정" 모달) — 지금까지는
 * create/setDefault/delete만 있고 "기존 프로필의 필드를 고친다"가 없었다.
 * 부분 업데이트(Partial)라 name을 안 보내도 다른 필드만 바꿀 수 있다. */
export async function updateSellerProfile(
  id: string,
  input: Partial<SellerProfileInput>,
): Promise<{ ok: true; profile: SellerProfile } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };

  const { data, error } = await supabase
    .from("coupang_seller_profiles")
    .update({ ...toRowFields(input), updated_at: new Date().toISOString() })
    .eq("id", id)
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
