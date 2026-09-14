import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

/**
 * LOTTEON COMMERCE SPRINT 2 Phase 1 — 롯데ON credential 저장.
 *
 * 작업지시서: "credential 저장은 **기존 Naver/Coupang 구조를 그대로 따른다**
 * (`commerce_accounts`)". 그래서 새 테이블을 만들지 않고 naver와 똑같이
 * `commerce_accounts`의 platform='lotteon' 행 **하나**만 다룬다(N-3.40
 * "커머스당 연결 계정은 1개만 필요하다" 원칙 — account.ts(naver)와 동일).
 *
 * 컬럼 선택: 롯데ON 인증은 정적 Bearer 키 **하나**뿐이다(조사 §5-1 — OAuth도
 * 서명도 없다). 기존 컬럼 중 `secret_key`에 담는다. `access_key`가 아니라
 * `secret_key`인 이유는 표시 규약 때문이다 — Coupang accessKey는 화면에
 * `••••{last4}`로 다시 보이지만, 롯데ON 인증키는 그 자체가 호출 권한 전부라
 * 마지막 4자리도 되돌려주지 않는다(CEO 지시: "인증키 화면 평문 재노출 ❌").
 * secret_key는 저장소 전체에서 이미 "저장됨 boolean만 노출"하는 자리다.
 *
 * ⚠️ 암호화는 이번 범위가 아니다(별건 등록됨) — Naver/Coupang과 **완전히 같은
 * 방식**(평문 컬럼)으로 저장한다. 여기만 다르게 하면 나중에 일괄 암호화할 때
 * 두 벌을 고쳐야 한다.
 *
 * ⚠️ `commerce_accounts.platform` CHECK 제약에 'lotteon'이 없으면 INSERT가
 * 실패한다 — 마이그레이션 파일
 * packages/database/prisma/migrations_manual/050_commerce_accounts_lotteon.sql
 * 을 CEO가 Supabase에서 실행해야 한다(에이전트는 실행하지 않는다).
 */
interface LotteOnAccountRow {
  id: string;
  /** 롯데ON API 인증키(Bearer). 절대 응답에 실어 내보내지 않는다. */
  secret_key: string | null;
}

export async function loadLotteOnAccountRow(): Promise<LotteOnAccountRow | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("commerce_accounts")
    .select("id, secret_key")
    .eq("platform", "lotteon")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    // naver loadNaverAccountRow와 동일한 원칙 — 여기서 던지면 env var로 잘
    // 동작하던 배포가 깨진다. 조용히 env 폴백으로 넘긴다(키 값은 로그에 절대
    // 남기지 않는다 — error.message에는 키가 들어가지 않는다).
    console.warn("[lotteon-account] Supabase 조회 실패, 환경변수로 폴백:", error.message);
    return null;
  }
  return data as LotteOnAccountRow | null;
}

export interface LotteOnAccountSettingsInput {
  /** 빈 문자열/undefined면 "변경 안 함" — 기존 저장값을 유지한다
   * (Coupang/Naver의 부분수정 패턴 그대로). */
  apiKey?: string;
}

export async function saveLotteOnAccountSettings(
  input: LotteOnAccountSettingsInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return {
      ok: false,
      error: "Supabase가 설정되지 않았습니다(NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 확인 필요).",
    };
  }
  const existing = await loadLotteOnAccountRow();
  const apiKey = input.apiKey && input.apiKey.trim().length > 0 ? input.apiKey.trim() : (existing?.secret_key ?? null);

  if (existing) {
    const { error } = await supabase
      .from("commerce_accounts")
      .update({ secret_key: apiKey, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) return { ok: false, error: describeSaveError(error.message) };
    return { ok: true };
  }

  const { error } = await supabase.from("commerce_accounts").insert({
    platform: "lotteon",
    label: "기본 계정",
    is_default: true,
    secret_key: apiKey,
  });
  if (error) return { ok: false, error: describeSaveError(error.message) };
  return { ok: true };
}

/** CHECK 제약 미적용 환경에서 나는 Postgres 오류를 셀러가 이해할 문구로 바꾼다 —
 * 이 케이스는 "값이 틀렸다"가 아니라 "마이그레이션이 아직 실행되지 않았다"이다. */
function describeSaveError(rawMessage: string): string {
  if (/commerce_accounts_platform_check|violates check constraint/i.test(rawMessage)) {
    return "롯데ON 계정을 저장할 수 없습니다 — commerce_accounts 테이블이 아직 'lotteon'을 허용하지 않습니다. 마이그레이션 050_commerce_accounts_lotteon.sql 실행이 필요합니다.";
  }
  return rawMessage;
}

export async function clearLotteOnAccountSettings(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return {
      ok: false,
      error: "Supabase가 설정되지 않았습니다(NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 확인 필요).",
    };
  }
  const existing = await loadLotteOnAccountRow();
  if (!existing) return { ok: true };
  const { error } = await supabase.from("commerce_accounts").delete().eq("id", existing.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * 설정 화면이 폼을 미리 채울 때 쓴다.
 *
 * 🔴 CEO 지시 — 인증키는 **마지막 4자리조차** 돌려주지 않는다. 저장 여부
 * boolean 하나만 내려간다(Naver clientSecretSaved와 같은 취급). 이 함수의
 * 반환 타입에 문자열 필드를 추가하지 마라.
 */
export async function getLotteOnAccountSettingsForDisplay(): Promise<{ apiKeySaved: boolean }> {
  const row = await loadLotteOnAccountRow();
  return { apiKeySaved: Boolean(row?.secret_key) };
}
