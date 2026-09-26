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
/**
 * 🔴 NONE 과 ERROR 는 «다른 말» 이다.
 *
 *     NONE    정상적으로 조회했는데 판매자가 아직 아무것도 안 넣었다
 *     ERROR   조회 «자체» 가 실패했다 — 값이 있는지 없는지 알 수 없다
 *
 * 이 둘을 같게 취급하면 DB 장애가 「설정이 비었네」로 둔갑한다. 그러면 등록은
 * 그대로 진행되고, 제조사가 빈 채로 실제 상품이 올라간다. 경고 로그 한 줄만
 * 남고 셀러는 모른다.
 *
 * 🔴 PIVOT-03 R6-REMOVE — 여기 있던 "LEGACY_PROFILE" 이 사라졌다. 임시 호환층이
 * 제거되어 그 출처가 더는 존재하지 않는다. 값은 canonical 한 곳에서만 온다.
 */
export type SellerSettingsSource = "SELLER_SETTINGS" | "NONE" | "ERROR";

export interface ResolvedSellerSettings extends SellerSettings {
  source: SellerSettingsSource;
  /**
   * 🔴 「읽지 못했다」는 뜻이다. 「값이 없다」가 아니다.
   *
   * true 면 다섯 칸은 전부 null 이지만 그건 «모른다» 는 뜻이지 «비었다» 는
   * 뜻이 아니다. 등록 경로는 이 값을 보고 «멈춰야» 한다 — 값이 비었다고
   * 멈추는 것이 아니다(그건 채널별 completeness 정책이고 다른 문제다).
   */
  failed: boolean;
}

/** loadFromSellerSettings 의 내부 결과. 조회 실패와 행 없음을 가른다. */
type LoadOutcome =
  | { status: "FOUND"; values: SellerSettings }
  | { status: "NOT_FOUND" }
  | { status: "ERROR"; reason: string };

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

/**
 * ══ Commerce-6 C-1(2026-09-26) — 「Beta Security 가 인자를 채운다」의 그 인자 ══
 *
 * 059 주석과 이 함수의 옛 주석이 순서를 미리 적어 두었다: **1순위는 내 workspace
 * 의 행**, 레거시 NULL 행은 그 다음. 이제 그 인자를 받는다.
 *
 * 🔴 레거시 폴백을 «없애지 않는다». workspace 행은 아직 하나도 없고(059 는 NULL
 * 로만 backfill 했다), 폴백을 먼저 끊으면 지금 설정이 통째로 사라진다. 읽기
 * «순서» 만 바꾼다 — 그것이 migration compatibility 의 뜻이다.
 *
 * 🔴 `workspaceId` 를 주지 «않으면» 예전과 한 글자도 다르지 않게 동작한다.
 * 호출부 여덟 곳을 한꺼번에 바꾸기 전까지 읽기와 쓰기가 갈라지지 않게 하려는
 * 것이다 — 일부만 바꾸면 「쓰기는 workspace 행, 읽기는 레거시 행」이 되어
 * 지금보다 «나빠진다».
 */
async function loadFromSellerSettings(workspaceId?: string | null): Promise<LoadOutcome> {
  const supabase = getSupabaseAdmin();
  /* 🔴 클라이언트가 없는 것은 «조회 실패» 가 아니다. 환경변수가 없는 상태이고
     (로컬 개발 등) 그때는 레거시 조회도 똑같이 못 한다. 이걸 ERROR 로 올리면
     설정이 안 된 환경에서 등록 화면이 통째로 막힌다 — 지금까지 없던 동작이다. */
  if (!supabase) return { status: "NOT_FOUND" };
  if (workspaceId) {
    const mine = await readSellerSettingsRow(workspaceId);
    /* 🔴 NOT_FOUND 일 때«만» 레거시로 내려간다. ERROR 를 폴백으로 흘리면
       「장애를 설정 없음으로 위장」이 다시 살아난다(R6-FS 가 없앤 그것). */
    if (mine.status !== "NOT_FOUND") return mine;
  }
  return readSellerSettingsRow(null);
}

/** 조건만 다르고 «판정» 은 한 곳이다 — workspace 행과 레거시 행이 같은 규칙을 쓴다. */
async function readSellerSettingsRow(workspaceId: string | null): Promise<LoadOutcome> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { status: "NOT_FOUND" };
  try {
    const base = supabase.from("seller_settings").select(COLUMNS);
    const scoped = workspaceId ? base.eq("workspace_id", workspaceId) : base.is("workspace_id", null);
    const { data, error } = await scoped.eq("scope_key", "default").maybeSingle();
    /* 🔴 여기가 이 작업의 전부다. 예전에는 이 줄도, 아래 「행 없음」도 똑같이
       null 을 돌려줬다 — 그래서 DB 장애와 「아직 설정 안 함」이 구분되지 않았고
       둘 다 레거시 폴백으로 흘렀다. 이제 갈린다.

       maybeSingle() 은 행이 둘 이상이어도 error 를 낸다. 그것도 ERROR 다 —
       「어느 행이 맞는지 모른다」이지 「없다」가 아니다. */
    if (error) return { status: "ERROR", reason: error.message };
    return data ? { status: "FOUND", values: fromRow(data as unknown as Row) } : { status: "NOT_FOUND" };
  } catch (cause) {
    /* 조사에서 확인한 J 상태 — try/catch 가 없어 호출자로 그대로 전파됐다.
       터지는 것 자체는 나쁘지 않았지만(조용히 빈 값이 되는 것보다 낫다) 어디서
       터졌는지가 남지 않았다. 여기서 받아 ERROR 로 이름을 붙인다.
       🔴 받아서 «삼키는» 것이 아니다 — 등록은 여전히 멈춘다. */
    return { status: "ERROR", reason: cause instanceof Error ? cause.message : String(cause) };
  }
}

/* ── PIVOT-03 R6-REMOVE — 여기 있던 loadFromLegacyProfile 이 사라졌다 ────────
 *
 * 059 부터 마지막까지 살아 있던 «임시 호환층» 이다. canonical 표가 아직 비어
 * 있을 수 있는 동안, 배송 프로필의 같은 다섯 칸을 대신 읽어서 전환 중에 실등록
 * 경로가 한 번도 끊기지 않게 했다.
 *
 * 이제 뗀다. 근거는 셋이다.
 *
 *     A~D    읽기와 쓰기가 전부 canonical 로 옮겨졌다
 *     F      dual-write DB 함수를 지웠다 — 레거시 값은 그날 이후 얼어붙었다
 *     R6-FS  조회 «실패» 와 값 «없음» 이 갈렸다
 *
 * 🔴 마지막 것이 핵심이다. 이 폴백이 위험했던 이유는 폴백이라서가 아니라,
 * DB 장애까지 「값이 없네」로 읽고 옛 값을 흘려보냈기 때문이다. 그 경계를
 * 세워 두지 않은 채 폴백만 없앴다면 장애가 「빈 값으로 등록」이라는 또 다른
 * fail-open 으로 남았을 것이다.
 *
 * 레거시 다섯 «컬럼» 은 아직 표에 있다(G 에서 DROP). 읽는 코드가 먼저 0이 되어야
 * 컬럼을 지울 수 있다 — 지금이 그 상태다. */

/**
 * 판매자 공통 설정을 읽는다.
 *
 *     seller_settings 를 읽는다
 *        ├─ 값이 있으면        그 값
 *        ├─ 정상인데 없으면     전부 null (NONE)
 *        └─ 🔴 못 읽으면        전부 null + failed (ERROR)
 *
 * 🔴 아래 두 줄은 «다른 말» 이다. 셋째 줄에서 호출부는 멈춰야 하고, 둘째
 * 줄에서는 멈추면 안 된다 — 값이 비어 있는 것은 셀러가 아직 안 넣은 것이고,
 * 그건 채널별 completeness 가 판단할 일이다.
 *
 * 🔴 값을 «만들지» 않는다. 못 찾으면 못 찾았다고 돌려준다 — 호출부가 그 사실을
 * 셀러에게 말할 수 있어야 한다(제조사 미입력은 쿠팡 등록의 1위 블로커였다).
 */
export async function loadSellerSettings(workspaceId?: string | null): Promise<ResolvedSellerSettings> {
  const primary = await loadFromSellerSettings(workspaceId);

  /* 🔴 ERROR 는 여기서 «끝난다». 레거시를 쳐다보지 않는다.
     canonical 을 못 읽었는데 레거시 값을 쓰면, 그 값이 맞는지 틀린지 알 방법이
     없는 채로 실제 상품에 올라간다. 지금 레거시에는 12:52 에 얼어붙은 옛
     제조사가 남아 있다 — 우연히 같을 뿐이고, 갈라지는 순간 조용히 틀린다. */
  if (primary.status === "ERROR") {
    console.warn("[seller-settings] 조회 실패:", primary.reason);
    return { ...EMPTY_SELLER_SETTINGS, source: "ERROR", failed: true };
  }

  if (primary.status === "FOUND" && hasAnySellerSetting(primary.values)) {
    return { ...primary.values, source: "SELLER_SETTINGS", failed: false };
  }

  /* 「정상적으로 조회했는데 값이 없다」 — 행이 없거나, 행은 있는데 다섯 칸이
     다 비었거나. 예전에는 여기서 레거시 프로필을 대신 읽었다(R6).

     🔴 이제 그냥 「없다」고 말한다. 그리고 그건 fail-open 이 아니다 — 조회는
     «성공했고» 값이 실제로 없는 것이다. 위의 ERROR 와 구분되기 때문에 이렇게
     말할 수 있다. */
  return { ...EMPTY_SELLER_SETTINGS, source: "NONE", failed: false };
}

/** 등록 경로가 셀러에게 보여 줄 한 줄. 세 채널이 같은 글자를 쓴다. */
export const SELLER_SETTINGS_UNAVAILABLE_MESSAGE =
  "판매자 정보를 확인하지 못해 등록을 진행할 수 없습니다.";
export const SELLER_SETTINGS_UNAVAILABLE_RESOLUTION =
  "잠시 후 다시 시도해주세요. 계속되면 고객센터로 알려주세요.";

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
  /**
   * ══ Commerce-6 C-1 ══
   * 🔴 주면 «그 workspace 의 행» 에 쓴다. 주지 않으면 예전 그대로 레거시 NULL
   * 행에 쓴다.
   *
   * 🔴 읽기와 «같은 시점에» 켜야 한다. 쓰기만 workspace 로 옮기면 다른 읽기
   * 경로(등록 payload 조립 일곱 곳)는 레거시 행을 계속 읽어서, 셀러가 저장한
   * 값이 실제 등록에 반영되지 않는다 — 지금보다 나쁜 상태다.
   */
  workspaceId?: string | null,
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

  const update = supabase.from("seller_settings").update({ ...row, updated_at: new Date().toISOString() });
  const { data, error } = await (workspaceId
    ? update.eq("workspace_id", workspaceId)
    : update.is("workspace_id", null)
  )
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
    /* 🔴 C-1 — workspaceId 를 «받았을 때만» 그 값을 쓴다. 없으면 NULL 그대로다.
       여전히 임의의 workspace 를 지어내지 않는다. */
    .insert({ workspace_id: workspaceId ?? null, scope_key: "default", ...row });
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
