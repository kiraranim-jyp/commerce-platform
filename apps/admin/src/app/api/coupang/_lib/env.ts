import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

/**
 * 이 파일은 이제 쿠팡 "계정" 레벨 설정(Access/Secret Key, Vendor ID, Wing 로그인
 * ID)만 담당한다 — 출고지/반품지/택배사 같은 "배송 프로필"은 seller-profile.ts로,
 * 상세설명 고정 문구는 description-template.ts로 옮겼다. 계정은 하나뿐이지만
 * 배송 프로필/템플릿은 여러 개를 만들 수 있다는 게 이 분리의 이유다.
 *
 * Supabase(coupang_seller_settings 테이블, 1행짜리 싱글턴)에서 우선 읽고, 없으면
 * 환경변수로 폴백한다 — 이 파일은 "use client" 컴포넌트에서 import되면 안 된다
 * (app/api/ 라우트 핸들러 전용).
 */
export interface CoupangCredentials {
  accessKey: string;
  secretKey: string;
  vendorId: string;
}

const SETTINGS_ROW_ID = "default";

export interface CoupangSettingsRow {
  access_key: string | null;
  secret_key: string | null;
  vendor_id: string | null;
  vendor_user_id: string | null;
  // 아래 필드들은 예전 싱글턴 시절 컬럼이다 — seller-profile.ts가 "프로필이 하나도
  // 없을 때 딱 한 번" 여기서 읽어서 첫 프로필로 자동 승격한다(마이그레이션 용도로만
  // 남겨둔다).
  delivery_company_code: string | null;
  return_center_code: string | null;
  return_charge_name: string | null;
  company_contact_number: string | null;
  return_zip_code: string | null;
  return_address: string | null;
  return_address_detail: string | null;
  outbound_shipping_place_code: number | null;
}

export async function loadSettingsRow(): Promise<CoupangSettingsRow | null> {
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

/** Wing 로그인 ID — 배송 프로필이 여러 개여도 Wing 계정은 하나뿐이라 계정 레벨에
 * 그대로 둔다. Open API로는 조회할 수 없는 값이라(Access/Secret Key와 별개, Wing
 * 계정 정보 페이지에서만 확인 가능) 사용자가 직접 입력해야 한다. */
export async function getVendorUserId(): Promise<string> {
  const row = await loadSettingsRow();
  return row?.vendor_user_id || process.env.COUPANG_VENDOR_USER_ID || "";
}

export interface CoupangAccountSettingsInput {
  accessKey?: string;
  secretKey?: string;
  vendorId?: string;
  vendorUserId?: string;
}

/** 빈 문자열/undefined인 필드는 "변경 안 함"으로 취급하고 기존 저장값을 그대로
 * 유지한다 — 그래야 시크릿 키를 다시 입력하지 않고 Wing 계정 ID만 바꾸는 식의
 * 부분 수정이 가능하다. */
export async function saveCoupangAccountSettings(
  input: CoupangAccountSettingsInput,
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
    updated_at: new Date().toISOString(),
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** 설정 페이지가 폼을 미리 채울 때 쓴다 — 시크릿(secretKey)은 절대 평문으로 다시
 * 내려주지 않고, "저장돼 있는지" 여부만 알려준다(마지막 4자리만 참고용으로 노출). */
export async function getCoupangAccountSettingsForDisplay(): Promise<{
  accessKeyMasked: string | null;
  secretKeySaved: boolean;
  vendorId: string | null;
  vendorUserId: string | null;
}> {
  const row = await loadSettingsRow();
  const accessKey = row?.access_key || process.env.COUPANG_ACCESS_KEY || null;
  const secretKey = row?.secret_key || process.env.COUPANG_SECRET_KEY || null;
  return {
    accessKeyMasked: accessKey ? `${"•".repeat(Math.max(accessKey.length - 4, 0))}${accessKey.slice(-4)}` : null,
    secretKeySaved: Boolean(secretKey),
    vendorId: row?.vendor_id || process.env.COUPANG_VENDOR_ID || null,
    vendorUserId: row?.vendor_user_id || process.env.COUPANG_VENDOR_USER_ID || null,
  };
}
