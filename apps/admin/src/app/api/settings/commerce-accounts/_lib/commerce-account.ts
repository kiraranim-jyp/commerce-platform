import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";

/**
 * N-3.13 R2 Part 12(CPO 지시, 2026-08-12 확정) — 여러 커머스 계정(네이버/쿠팡
 * 각각 여러 개)을 아코디언으로 추가/수정/삭제/연결테스트할 수 있어야 한다.
 * 기존 coupang_seller_settings(단일 행)/환경변수(Naver)와는 완전히 별개인 새
 * 저장소다(안전조건: 기존 구조를 무리하게 깨지 않는다). Secret Key/Client
 * Secret은 저장은 하되 목록 조회 응답에는 절대 평문으로 내려주지 않는다 —
 * SellerProfile/coupang_seller_settings에서 이미 지켜온 것과 같은 원칙
 * (accessKeyMasked/secretKeySaved 패턴)을 그대로 따른다.
 */
export type CommerceAccountPlatform = "naver" | "coupang";

export interface CommerceAccount {
  id: string;
  platform: CommerceAccountPlatform;
  label: string;
  isDefault: boolean;
  /** 마지막 4자리만 보여준다(전체 노출 금지) — 없으면 null. */
  accessKeyMasked: string | null;
  secretKeySaved: boolean;
  vendorId: string | null;
  vendorUserId: string | null;
  clientIdMasked: string | null;
  clientSecretSaved: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CommerceAccountRow {
  id: string;
  platform: CommerceAccountPlatform;
  label: string;
  is_default: boolean;
  access_key: string | null;
  secret_key: string | null;
  vendor_id: string | null;
  vendor_user_id: string | null;
  client_id: string | null;
  client_secret: string | null;
  created_at: string;
  updated_at: string;
}

function maskTail(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 4) return "••••";
  return `••••${value.slice(-4)}`;
}

function toAccount(row: CommerceAccountRow): CommerceAccount {
  return {
    id: row.id,
    platform: row.platform,
    label: row.label,
    isDefault: row.is_default,
    accessKeyMasked: maskTail(row.access_key),
    secretKeySaved: Boolean(row.secret_key),
    vendorId: row.vendor_id,
    vendorUserId: row.vendor_user_id,
    clientIdMasked: maskTail(row.client_id),
    clientSecretSaved: Boolean(row.client_secret),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listCommerceAccounts(): Promise<CommerceAccount[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("commerce_accounts")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) {
    console.warn("[commerce-account] 목록 조회 실패:", error.message);
    return [];
  }
  return (data as CommerceAccountRow[]).map(toAccount);
}

/** 연결 테스트는 저장된 값을 그대로 써야 하니 마스킹 없이 원본을 돌려준다 —
 * 이 함수는 서버 내부(테스트 라우트)에서만 호출하고 클라이언트로 응답하지
 * 않는다. */
export async function getCommerceAccountRaw(id: string): Promise<CommerceAccountRow | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase.from("commerce_accounts").select("*").eq("id", id).single();
  if (error) return null;
  return data as CommerceAccountRow;
}

export interface CommerceAccountInput {
  platform: CommerceAccountPlatform;
  label: string;
  accessKey?: string;
  secretKey?: string;
  vendorId?: string;
  vendorUserId?: string;
  clientId?: string;
  clientSecret?: string;
}

/** 빈 문자열/undefined는 "값을 바꾸지 않는다"로 취급한다(수정 폼에서 Secret을
 * 다시 입력하지 않으면 기존 값이 유지돼야 한다 — Coupang 싱글톤 설정에서 이미
 * 쓰던 패턴). */
function toRowFields(input: Partial<CommerceAccountInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.platform !== undefined) row.platform = input.platform;
  if (input.label !== undefined) row.label = input.label;
  if (input.accessKey) row.access_key = input.accessKey;
  if (input.secretKey) row.secret_key = input.secretKey;
  if (input.vendorId !== undefined) row.vendor_id = input.vendorId || null;
  if (input.vendorUserId !== undefined) row.vendor_user_id = input.vendorUserId || null;
  if (input.clientId) row.client_id = input.clientId;
  if (input.clientSecret) row.client_secret = input.clientSecret;
  return row;
}

export async function createCommerceAccount(
  input: CommerceAccountInput,
): Promise<{ ok: true; account: CommerceAccount } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };

  const existing = await listCommerceAccounts();
  const isFirstForPlatform = !existing.some((a) => a.platform === input.platform);
  const { data, error } = await supabase
    .from("commerce_accounts")
    .insert({ ...toRowFields(input), is_default: isFirstForPlatform })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, account: toAccount(data as CommerceAccountRow) };
}

export async function updateCommerceAccount(
  id: string,
  input: Partial<CommerceAccountInput>,
): Promise<{ ok: true; account: CommerceAccount } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };

  const { data, error } = await supabase
    .from("commerce_accounts")
    .update({ ...toRowFields(input), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, account: toAccount(data as CommerceAccountRow) };
}

export async function setDefaultCommerceAccount(
  id: string,
  platform: CommerceAccountPlatform,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };

  const { error: clearError } = await supabase
    .from("commerce_accounts")
    .update({ is_default: false })
    .eq("platform", platform);
  if (clearError) return { ok: false, error: clearError.message };

  const { error } = await supabase.from("commerce_accounts").update({ is_default: true }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteCommerceAccount(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };

  const { error } = await supabase.from("commerce_accounts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
