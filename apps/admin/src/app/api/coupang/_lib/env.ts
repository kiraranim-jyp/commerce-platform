import type { CoupangSellerConfig } from "@commerce/listing";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

/**
 * 쿠팡 API 키/시크릿/판매자 계정 설정은 Supabase(coupang_seller_settings 테이블,
 * 1행짜리 싱글턴)에서 우선 읽고, 없으면 환경변수로 폴백한다 — 이 파일은 "use client"
 * 컴포넌트에서 import되면 안 된다(app/api/ 라우트 핸들러 전용). 프론트엔드/
 * localStorage/상품 데이터/Git 어디에도 값을 저장하지 않는다.
 *
 * Supabase 폴백을 유지하는 이유: 로컬 개발 환경이거나 아직 설정 페이지에서 값을
 * 저장하지 않았을 때도 기존 env var 방식이 그대로 동작해야 한다(하위 호환).
 */
export interface CoupangCredentials {
  accessKey: string;
  secretKey: string;
  vendorId: string;
}

const SETTINGS_ROW_ID = "default";

interface CoupangSettingsRow {
  access_key: string | null;
  secret_key: string | null;
  vendor_id: string | null;
  vendor_user_id: string | null;
  delivery_company_code: string | null;
  return_center_code: string | null;
  return_charge_name: string | null;
  company_contact_number: string | null;
  return_zip_code: string | null;
  return_address: string | null;
  return_address_detail: string | null;
  outbound_shipping_place_code: number | null;
}

async function loadSettingsRow(): Promise<CoupangSettingsRow | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("coupang_seller_settings")
    .select("*")
    .eq("id", SETTINGS_ROW_ID)
    .maybeSingle();
  if (error) {
    // 테이블이 아직 없거나(마이그레이션 미실행) 일시적 오류 — 조용히 env var로
    // 폴백한다. 여기서 던지면 기존에 env var로 잘 동작하던 배포가 깨진다.
    console.warn("[coupang-settings] Supabase 조회 실패, 환경변수로 폴백:", error.message);
    return null;
  }
  return data as CoupangSettingsRow | null;
}

export async function getCoupangCredentials(): Promise<CoupangCredentials | null> {
  const row = await loadSettingsRow();
  const accessKey = row?.access_key || process.env.COUPANG_ACCESS_KEY;
  const secretKey = row?.secret_key || process.env.COUPANG_SECRET_KEY;
  const vendorId = row?.vendor_id || process.env.COUPANG_VENDOR_ID;
  if (!accessKey || !secretKey || !vendorId) return null;
  return { accessKey, secretKey, vendorId };
}

/**
 * 인증 키(access/secret)와 달리 이 값들은 "비밀"이 아니라 쿠팡 Wing에 이미
 * 등록되어 있는 판매자 계정 설정(반품지/발송지/배송사 코드 등)이다.
 */
export async function getCoupangSellerConfig(vendorId: string): Promise<CoupangSellerConfig> {
  const row = await loadSettingsRow();
  return {
    vendorId,
    vendorUserId: row?.vendor_user_id || process.env.COUPANG_VENDOR_USER_ID || "",
    deliveryCompanyCode: row?.delivery_company_code || process.env.COUPANG_DELIVERY_COMPANY_CODE || "",
    returnCenterCode: row?.return_center_code || process.env.COUPANG_RETURN_CENTER_CODE || "",
    returnChargeName: row?.return_charge_name || process.env.COUPANG_RETURN_CHARGE_NAME || "",
    companyContactNumber: row?.company_contact_number || process.env.COUPANG_COMPANY_CONTACT_NUMBER || "",
    returnZipCode: row?.return_zip_code || process.env.COUPANG_RETURN_ZIP_CODE || "",
    returnAddress: row?.return_address || process.env.COUPANG_RETURN_ADDRESS || "",
    returnAddressDetail: row?.return_address_detail || process.env.COUPANG_RETURN_ADDRESS_DETAIL || "",
    outboundShippingPlaceCode:
      row?.outbound_shipping_place_code ??
      (process.env.COUPANG_OUTBOUND_SHIPPING_PLACE_CODE
        ? Number(process.env.COUPANG_OUTBOUND_SHIPPING_PLACE_CODE)
        : null),
  };
}

export interface CoupangSettingsInput {
  accessKey?: string;
  secretKey?: string;
  vendorId?: string;
  vendorUserId?: string;
  deliveryCompanyCode?: string;
  returnCenterCode?: string;
  returnChargeName?: string;
  companyContactNumber?: string;
  returnZipCode?: string;
  returnAddress?: string;
  returnAddressDetail?: string;
  outboundShippingPlaceCode?: number | null;
}

/** 빈 문자열/undefined인 필드는 "변경 안 함"으로 취급하고 기존 저장값을 그대로
 * 유지한다 — 그래야 시크릿 키를 다시 입력하지 않고 배송 설정만 바꾸는 식의
 * 부분 수정이 가능하다(요구사항 5: "이미 저장된 설정은 수정 가능"). */
export async function saveCoupangSettings(
  input: CoupangSettingsInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return {
      ok: false,
      error: "Supabase가 설정되지 않았습니다(NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 확인 필요).",
    };
  }

  const existing = await loadSettingsRow();
  const merge = (next: string | undefined, prevKey: keyof CoupangSettingsRow): string | null =>
    next && next.trim().length > 0 ? next.trim() : (existing?.[prevKey] as string | null) ?? null;

  const { error } = await supabase.from("coupang_seller_settings").upsert({
    id: SETTINGS_ROW_ID,
    access_key: merge(input.accessKey, "access_key"),
    secret_key: merge(input.secretKey, "secret_key"),
    vendor_id: merge(input.vendorId, "vendor_id"),
    vendor_user_id: merge(input.vendorUserId, "vendor_user_id"),
    delivery_company_code: merge(input.deliveryCompanyCode, "delivery_company_code"),
    return_center_code: merge(input.returnCenterCode, "return_center_code"),
    return_charge_name: merge(input.returnChargeName, "return_charge_name"),
    company_contact_number: merge(input.companyContactNumber, "company_contact_number"),
    return_zip_code: merge(input.returnZipCode, "return_zip_code"),
    return_address: merge(input.returnAddress, "return_address"),
    return_address_detail: merge(input.returnAddressDetail, "return_address_detail"),
    outbound_shipping_place_code:
      input.outboundShippingPlaceCode ?? existing?.outbound_shipping_place_code ?? null,
    updated_at: new Date().toISOString(),
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

const REQUIRED_SELLER_CONFIG_FIELDS: { key: keyof CoupangSellerConfig; label: string }[] = [
  { key: "deliveryCompanyCode", label: "택배사" },
  { key: "returnCenterCode", label: "반품지" },
  { key: "returnChargeName", label: "반품지명" },
  { key: "companyContactNumber", label: "반품지 연락처" },
  { key: "returnZipCode", label: "반품지 우편번호" },
  { key: "returnAddress", label: "반품지 주소" },
  { key: "vendorUserId", label: "Wing 계정 ID" },
];

/** 등록 화면(게이트)과 설정 페이지가 공통으로 쓰는 "지금 등록 가능한 상태인가"
 * 판정 — register 라우트의 최종 검증(missingSellerConfigFields)과 이름은 다르지만
 * 같은 필드 집합을 확인한다. 여기서는 payload가 아니라 설정값 자체를 직접 보므로
 * 상품을 분석하지 않고도(등록 화면 진입 전에도) 설정 완료 여부를 알 수 있다. */
export async function getCoupangSettingsStatus(): Promise<{
  configured: boolean;
  missing: string[];
  hasCredentials: boolean;
}> {
  const credentials = await getCoupangCredentials();
  const sellerConfig = await getCoupangSellerConfig(credentials?.vendorId ?? "");

  const missing: string[] = [];
  if (!credentials) missing.push("쿠팡 API 키 (Access Key / Secret Key / Vendor ID)");
  for (const field of REQUIRED_SELLER_CONFIG_FIELDS) {
    if (!sellerConfig[field.key]) missing.push(field.label);
  }
  if (sellerConfig.outboundShippingPlaceCode == null) missing.push("출고지");

  return { configured: missing.length === 0, missing, hasCredentials: Boolean(credentials) };
}

/** 설정 페이지가 폼을 미리 채울 때 쓴다 — 시크릿(secretKey)은 절대 평문으로 다시
 * 내려주지 않고, "저장돼 있는지" 여부만 알려준다(마지막 4자리만 참고용으로 노출). */
export async function getCoupangSettingsForDisplay(): Promise<{
  accessKeyMasked: string | null;
  secretKeySaved: boolean;
  vendorId: string | null;
  vendorUserId: string | null;
  deliveryCompanyCode: string | null;
  returnCenterCode: string | null;
  returnChargeName: string | null;
  companyContactNumber: string | null;
  returnZipCode: string | null;
  returnAddress: string | null;
  returnAddressDetail: string | null;
  outboundShippingPlaceCode: number | null;
}> {
  const row = await loadSettingsRow();
  const accessKey = row?.access_key || process.env.COUPANG_ACCESS_KEY || null;
  const secretKey = row?.secret_key || process.env.COUPANG_SECRET_KEY || null;
  return {
    accessKeyMasked: accessKey ? `${"•".repeat(Math.max(accessKey.length - 4, 0))}${accessKey.slice(-4)}` : null,
    secretKeySaved: Boolean(secretKey),
    vendorId: row?.vendor_id || process.env.COUPANG_VENDOR_ID || null,
    vendorUserId: row?.vendor_user_id || process.env.COUPANG_VENDOR_USER_ID || null,
    deliveryCompanyCode: row?.delivery_company_code || process.env.COUPANG_DELIVERY_COMPANY_CODE || null,
    returnCenterCode: row?.return_center_code || process.env.COUPANG_RETURN_CENTER_CODE || null,
    returnChargeName: row?.return_charge_name || process.env.COUPANG_RETURN_CHARGE_NAME || null,
    companyContactNumber:
      row?.company_contact_number || process.env.COUPANG_COMPANY_CONTACT_NUMBER || null,
    returnZipCode: row?.return_zip_code || process.env.COUPANG_RETURN_ZIP_CODE || null,
    returnAddress: row?.return_address || process.env.COUPANG_RETURN_ADDRESS || null,
    returnAddressDetail: row?.return_address_detail || process.env.COUPANG_RETURN_ADDRESS_DETAIL || null,
    outboundShippingPlaceCode:
      row?.outbound_shipping_place_code ??
      (process.env.COUPANG_OUTBOUND_SHIPPING_PLACE_CODE
        ? Number(process.env.COUPANG_OUTBOUND_SHIPPING_PLACE_CODE)
        : null),
  };
}
