import { getSupabaseAdmin } from "./supabase-admin";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * TTAEJYO-PIVOT-03 — 판매자 «공통» 설정 Resolver
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 이 다섯 값은 상품이 바뀌어도 그대로다. 채널과도 무관하다.
 *
 *     manufacturer · asContactNumber · qualityGuarantee
 *     · kcExemptionText · defaultCountryOfOrigin
 *
 * 그런데 지금까지 `coupang_seller_profiles` 에 살았다. 그 표는 이름 그대로
 * «배송 프로필» 이고 여러 개를 갖는다(name + is_default). 그래서 셀러가 배송
 * 프로필을 하나 더 만들면 판매자 정보가 빈 채로 갈라지고, 그 프로필을 기본으로
 * 바꾸면 **판매자 정보가 사라진다**. 가설이 아니라 지금 DB 에 그 빈 행이 2개 있다.
 *
 * 059_seller_settings.sql 이 그 다섯을 꺼냈고, 이 파일이 그것을 읽는다.
 *
 * ── 🔴 fallback 은 «임시 호환층» 이다 ──────────────────────────────────────
 * 아래 `loadSellerSettings` 는 seller_settings 에 값이 없으면 기존
 * coupang_seller_profiles 를 읽는다. **이것은 새로운 Resolve Ladder 가 아니다.**
 *
 *     migration compatibility layer — PIVOT-03 ⑨ 단계에서 «제거된다».
 *
 * 목적은 단 하나: 오늘 실제 LIVE 등록에 성공한 유일한 경로(쿠팡)를 전환 도중에
 * 한 번도 깨뜨리지 않는 것이다. 안정화 뒤 이 분기는 사라져야 한다 — 남겨 두면
 * 「어느 표가 진짜인가」가 영원히 두 개가 된다.
 *
 * ── 🔴 workspace_id ────────────────────────────────────────────────────────
 * NULL 은 «전역» 이 아니라 «귀속을 확인할 수 없는 레거시» 다. 지금은 그 행 하나만
 * 존재한다. Beta Security 가 workspace 격리를 하면 workspace 별 행이 들어오고
 * 그때 1순위가 바뀐다 — 이 파일은 그 순서를 미리 지키고 있다.
 */

export interface SellerSettings {
  /** 판매자 본인의 제조자(수입자). 🔴 브랜드가 아니다 — 절대 브랜드로 채우지 않는다. */
  manufacturer: string | null;
  /** A/S 연락처. 비면 호출부가 반품지 연락처를 대신 쓴다(기존 동작 그대로). */
  asContactNumber: string | null;
  qualityGuarantee: string | null;
  kcExemptionText: string | null;
  /** 상품에서 원산지를 «못 찾았을 때만» 쓰는 기본값. */
  defaultCountryOfOrigin: string | null;
}

export const EMPTY_SELLER_SETTINGS: SellerSettings = {
  manufacturer: null,
  asContactNumber: null,
  qualityGuarantee: null,
  kcExemptionText: null,
  defaultCountryOfOrigin: null,
};

/** 어디서 온 값인가. 전환이 끝났는지 로그/진단으로 확인하기 위한 것이다. */
export type SellerSettingsSource = "SELLER_SETTINGS" | "LEGACY_PROFILE" | "NONE";

export interface ResolvedSellerSettings extends SellerSettings {
  source: SellerSettingsSource;
}

const COLUMNS =
  "manufacturer, as_contact_number, quality_guarantee, kc_exemption_text, default_country_of_origin";

interface Row {
  manufacturer: string | null;
  as_contact_number: string | null;
  quality_guarantee: string | null;
  kc_exemption_text: string | null;
  default_country_of_origin: string | null;
}

const fromRow = (row: Row): SellerSettings => ({
  manufacturer: row.manufacturer,
  asContactNumber: row.as_contact_number,
  qualityGuarantee: row.quality_guarantee,
  kcExemptionText: row.kc_exemption_text,
  defaultCountryOfOrigin: row.default_country_of_origin,
});

/**
 * 🔴 「값이 하나라도 있는가」의 판정. 전부 null 인 행은 «설정이 없는 것» 과 같다.
 *
 * 이 구분이 중요한 이유: 전부 비어 있는 행을 「설정이 있다」로 읽으면 호환
 * fallback 이 영영 돌지 않아서, 기존 프로필에 값이 남아 있는데도 등록이 빈 값으로
 * 나간다. 전환 도중에 그 일이 일어나면 그게 바로 회귀다.
 */
export function hasAnySellerSetting(values: SellerSettings): boolean {
  return Object.values(values).some((value) => typeof value === "string" && value.trim().length > 0);
}

async function loadFromSellerSettings(): Promise<SellerSettings | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  /* 1순위는 내 workspace 의 행이다. 지금은 그런 행이 «없고» 레거시 NULL 행 하나만
     있다. workspace 인자를 아직 받지 않는 이유는 이번 범위가 격리 구현이 아니기
     때문이다 — 순서만 먼저 지켜 둔다(Beta Security 가 인자를 채운다). */
  const { data, error } = await supabase
    .from("seller_settings")
    .select(COLUMNS)
    .is("workspace_id", null)
    .eq("scope_key", "default")
    .maybeSingle();
  if (error) {
    // 🔴 조용히 넘기지 않는다. 다만 등록을 막지도 않는다 — 아래 호환층이 받는다.
    console.warn("[seller-settings] 조회 실패:", error.message);
    return null;
  }
  return data ? fromRow(data as unknown as Row) : null;
}

/**
 * 🔴 **migration compatibility layer.** PIVOT-03 ⑨ 에서 제거한다.
 *
 * seller_settings 가 비어 있는 동안에만 기존 배송 프로필의 같은 다섯 칸을 읽는다.
 * 영구 폴백이 아니다.
 */
async function loadFromLegacyProfile(): Promise<SellerSettings | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("coupang_seller_profiles")
    .select(COLUMNS)
    .eq("is_default", true)
    .maybeSingle();
  if (error) {
    console.warn("[seller-settings] 레거시 프로필 조회 실패:", error.message);
    return null;
  }
  return data ? fromRow(data as unknown as Row) : null;
}

/**
 * 판매자 공통 설정을 읽는다.
 *
 *     seller_settings (workspace → 레거시 NULL)
 *        ↓ 값이 하나도 없으면
 *     coupang_seller_profiles (🔴 임시 호환층)
 *        ↓ 그것도 없으면
 *     전부 null
 *
 * 🔴 값을 «만들지» 않는다. 못 찾으면 못 찾았다고 돌려준다 — 호출부가 그 사실을
 * 셀러에게 말할 수 있어야 한다(제조사 미입력은 쿠팡 등록의 1위 블로커였다).
 */
export async function loadSellerSettings(): Promise<ResolvedSellerSettings> {
  const primary = await loadFromSellerSettings();
  if (primary && hasAnySellerSetting(primary)) {
    return { ...primary, source: "SELLER_SETTINGS" };
  }
  const legacy = await loadFromLegacyProfile();
  if (legacy && hasAnySellerSetting(legacy)) {
    return { ...legacy, source: "LEGACY_PROFILE" };
  }
  return { ...EMPTY_SELLER_SETTINGS, source: "NONE" };
}

/** 설정 화면이 보내는 다섯 칸. 배송·가격·상세페이지는 여기에 «속하지 않는다». */
export const SELLER_SETTING_KEYS = [
  "manufacturer",
  "asContactNumber",
  "qualityGuarantee",
  "kcExemptionText",
  "defaultCountryOfOrigin",
] as const satisfies readonly (keyof SellerSettings)[];

/**
 * 설정 화면이 보낸 body 에서 판매자 다섯 칸«만» 골라낸다.
 *
 * 🔴 「값이 있는가」가 아니라 「키가 왔는가」로 고른다. 기존 PATCH 는 partial
 * update 이고(toRowFields 가 `!== undefined` 로 판정한다), 빈 문자열은 «지움» 을
 * 뜻한다 — 값으로 거르면 그 두 가지가 같아져 버린다.
 */
export function pickSellerSettingFields(body: Record<string, unknown>): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const key of SELLER_SETTING_KEYS) {
    if (key in body) picked[key] = body[key];
  }
  return picked;
}

/** camelCase 다섯 칸을 표의 칸 이름으로 옮긴다. 온 키만 담는다. */
const COLUMN_OF: Record<string, string> = {
  manufacturer: "manufacturer",
  asContactNumber: "as_contact_number",
  qualityGuarantee: "quality_guarantee",
  kcExemptionText: "kc_exemption_text",
  defaultCountryOfOrigin: "default_country_of_origin",
};

/**
 * 판매자 공통 설정을 저장한다 — TTAEJYO-PIVOT-03 0-4+2-C.
 *
 * 🔴 PIVOT-03 D 이후 이것이 다섯 칸의 «유일한» writer 다.
 *
 * 프로필 id 를 받지 않는다. 판매자 공통 설정은 배송 프로필에 속하지 않기
 * 때문이다 — 프로필이 하나도 없어도 저장돼야 한다. 쓸 표가 하나뿐이라
 * 트랜잭션도 RPC 도 필요 없다(D 에서 사라진 dual-write 가 그것 때문에 있었다).
 *
 * ── 부분 업데이트 ────────────────────────────────────────────────────────
 * 기존 PATCH 가 쓰던 규칙을 그대로 잇는다.
 *
 *     키 없음  → 건드리지 않는다
 *     ""       → null (지움)
 *     값        → 값
 *
 * UPDATE 가 온 칸만 바꾸므로 부분 갱신이 자연히 성립한다. 행이 아직 없을
 * 때만 INSERT 한다 — 그 경우엔 보존할 옛 값이 없어서 upsert 와 같다.
 *
 * 🔴 행이 없는 상태에서 «동시에» 두 번 저장하면 뒤엣것이 유니크 인덱스
 * (seller_settings_legacy_singleton)에 막힌다. 조용히 덮지 않고 오류로
 * 드러나는 쪽이 맞다 — 지금 실측상 행은 이미 하나 있어서 INSERT 경로 자체가
 * 거의 타지 않는다.
 */
export async function saveSellerSettings(
  fields: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(COLUMN_OF)) {
    // 🔴 「값이 있는가」가 아니라 「키가 왔는가」다. 빈 문자열은 «지움» 이라
    //    거르면 안 된다(pickSellerSettingFields 와 같은 판정).
    if (key in fields) {
      const value = fields[key];
      row[column] = typeof value === "string" && value.length > 0 ? value : null;
    }
  }
  if (Object.keys(row).length === 0) return { ok: true };

  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "저장소에 연결하지 못했습니다." };

  const { data, error } = await supabase
    .from("seller_settings")
    .update({ ...row, updated_at: new Date().toISOString() })
    .is("workspace_id", null)
    .eq("scope_key", "default")
    .select("id");
  if (error) {
    console.warn("[seller-settings] 저장 실패:", error.message);
    return { ok: false, error: "판매자 정보를 저장하지 못했습니다." };
  }
  if (data && data.length > 0) return { ok: true };

  /* 여기까지 왔으면 행이 아직 없다(새 설치). 만든다.
     🔴 workspace_id = NULL 은 «전역» 이 아니라 «귀속을 확인할 수 없는 레거시»
     다 — 059 주석과 같은 뜻이고, Beta Security 가 workspace 행을 넣으면
     그때 reader 1순위가 바뀐다. 여기서 임의의 workspace 를 지어내지 않는다. */
  const { error: insertError } = await supabase
    .from("seller_settings")
    .insert({ workspace_id: null, scope_key: "default", ...row });
  if (insertError) {
    console.warn("[seller-settings] 신규 저장 실패:", insertError.message);
    return { ok: false, error: "판매자 정보를 저장하지 못했습니다." };
  }
  return { ok: true };
}

/* ── PIVOT-03 D — 여기 있던 saveSellerSettingsDual 이 사라졌다 ─────────────
 *
 * ⑤ 에서 만든 임시 다리였다. 그때는 reader 가 이미 seller_settings 를 보는데
 * writer 는 coupang_seller_profiles 에만 써서, 셀러가 저장하면 성공했다고
 * 보이는데 등록에는 안 나가는 상태였다. 두 표에 «함께» 써서 그 틈을 닫았고,
 * supabase-js 에 트랜잭션 API 가 없어 DB 함수(060)를 불렀다.
 *
 * 이제 쓸 곳이 하나다(saveSellerSettings → seller_settings). 묶을 것이 없으니
 * 다리도 필요 없다. 건너간 뒤 치운 것이다.
 *
 * 🔴 DB 함수 save_seller_settings_dual 은 «아직 살아 있다». 코드에서 부르는
 * 곳이 0건이 됐을 뿐이고, DROP 은 별도 migration 이다(E 실측 뒤 F).
 * 되돌릴 수 없는 일을 코드 제거와 같은 배포에 묶지 않는다. */
