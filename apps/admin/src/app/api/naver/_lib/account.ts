import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

/**
 * N-3.42 STEP5(CPO 지시: "commerce_accounts 연결", B안 채택) — commerce_accounts는
 * N-3.13 R2에서 "네이버/쿠팡 각각 여러 계정" 목적으로 만들었지만, 만든 당시 주석에
 * "실제 등록 파이프라인이 어떤 계정을 쓸지 연결하는 배선은 다음 단계"라고 명시된
 * 대로 실제 자격증명 조회 경로(getNaverCredentials)에는 한 번도 연결되지 않았다.
 * N-3.40 "커머스당 연결 계정은 1개만 필요하다" 원칙에 따라, 이 파일은
 * commerce_accounts의 platform='naver' 행을 "여러 개 중 하나"가 아니라 "있으면
 * 그 하나"로만 다룬다 — 테이블 스키마/멀티 계정 CRUD API(/api/settings/
 * commerce-accounts)는 그대로 두고, Naver 쪽 사용 방식만 싱글톤화한다.
 */
interface NaverAccountRow {
  id: string;
  client_id: string | null;
  client_secret: string | null;
}

export async function loadNaverAccountRow(): Promise<NaverAccountRow | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("commerce_accounts")
    .select("id, client_id, client_secret")
    .eq("platform", "naver")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    // 테이블이 아직 없거나 일시적 오류 — 조용히 env var로 폴백한다(Coupang의
    // env.ts loadSettingsRow()와 동일한 원칙 — 여기서 던지면 기존에 env var로
    // 잘 동작하던 배포가 깨진다).
    console.warn("[naver-account] Supabase 조회 실패, 환경변수로 폴백:", error.message);
    return null;
  }
  return data as NaverAccountRow | null;
}

export interface NaverAccountSettingsInput {
  clientId?: string;
  clientSecret?: string;
}

/** 빈 문자열/undefined인 필드는 "변경 안 함"으로 취급하고 기존 저장값을 그대로
 * 유지한다 — Coupang saveCoupangAccountSettings와 동일한 부분수정 패턴. */
export async function saveNaverAccountSettings(
  input: NaverAccountSettingsInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return {
      ok: false,
      error: "Supabase가 설정되지 않았습니다(NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 확인 필요).",
    };
  }
  const existing = await loadNaverAccountRow();
  const clientId = input.clientId && input.clientId.trim().length > 0 ? input.clientId.trim() : (existing?.client_id ?? null);
  const clientSecret =
    input.clientSecret && input.clientSecret.trim().length > 0 ? input.clientSecret.trim() : (existing?.client_secret ?? null);

  if (existing) {
    const { error } = await supabase
      .from("commerce_accounts")
      .update({ client_id: clientId, client_secret: clientSecret, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  const { error } = await supabase.from("commerce_accounts").insert({
    platform: "naver",
    label: "기본 계정",
    is_default: true,
    client_id: clientId,
    client_secret: clientSecret,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** "연결 정보 삭제" — DB에 저장된 행만 지운다. 환경변수로도 설정돼 있으면
 * getNaverCredentials()가 계속 그 값으로 폴백하므로 이후에도 연결됨으로 표시될
 * 수 있다(Coupang clearCoupangAccountSettings와 동일한 한계, 호출부 UI에서 안내). */
export async function clearNaverAccountSettings(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return {
      ok: false,
      error: "Supabase가 설정되지 않았습니다(NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 확인 필요).",
    };
  }
  const existing = await loadNaverAccountRow();
  if (!existing) return { ok: true };
  const { error } = await supabase.from("commerce_accounts").delete().eq("id", existing.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** 설정 페이지가 폼을 미리 채울 때 쓴다 — Client Secret은 절대 평문으로 다시
 * 내려주지 않는다(Coupang getCoupangAccountSettingsForDisplay와 동일한 원칙). */
export async function getNaverAccountSettingsForDisplay(): Promise<{
  clientIdMasked: string | null;
  clientSecretSaved: boolean;
}> {
  const row = await loadNaverAccountRow();
  const clientId = row?.client_id || null;
  return {
    clientIdMasked: clientId ? `${"•".repeat(Math.max(clientId.length - 4, 0))}${clientId.slice(-4)}` : null,
    clientSecretSaved: Boolean(row?.client_secret),
  };
}
