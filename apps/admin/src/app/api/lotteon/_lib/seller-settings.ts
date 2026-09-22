import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * LOTTEON-REAL-REGISTRATION-02 — 롯데ON 판매자 «고정값» 저장소
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 왜 생겼나. 롯데ON 등록 검증이 막는 필드 중 여섯 개가 «판매자가 한 번 정하면
 * 계속 쓰는 값» 인데 저장할 곳이 없어서 상품별 폼에만 살았다. 그래서 매 상품마다
 * 다시 골라야 했다(기존 완화책인 autoPick 은 후보가 «정확히 하나» 일 때만
 * 동작한다 — 출고지가 두 곳인 판매자에게는 아무 도움이 안 된다).
 *
 *     owhpNo · rtrpNo · dvCstPolNo · dvRgsprGrpCd · nldySndCloseTm · satSndCloseTm
 *
 * 구조는 coupang_seller_settings 를 그대로 따른다(단일 행 · 평면 컬럼).
 * 마이그레이션 058_lotteon_seller_settings.sql.
 *
 * 🔴 번호는 «사람이 입력하지 않는다». 설정 화면이 /api/lotteon/delivery-settings
 * 로 롯데ON Master 목록을 받아 「서울 ○○센터」를 고르게 하고, 여기에는 그
 * 번호와 표시이름을 함께 저장한다. 표시이름은 화면 전용이다 — 등록 payload 로
 * 나가는 것은 번호뿐이다.
 *
 * 🔴 `default_import_proxy_code` 는 이 파일에서 «읽지도 쓰지도 않는다».
 * 058 에 컬럼과 CHECK 제약이 들어가 있지만 그 코드값(PUR_PRX/PRL_IMP/NONE)은
 * 우리 코드 주석에서 온 것이지 롯데ON API 응답으로 확인한 값이 아니다.
 * CEO 판정으로 API contract 확인 전까지 HOLD 다.
 */

/** 한 줄뿐인 설정 행의 고정 키(coupang_seller_settings 와 같은 규약). */
const SINGLETON_ID = "default";

export interface LotteOnSellerSettings {
  /** owhpNo — 출고지번호. */
  outboundPlaceNo: string | null;
  outboundPlaceLabel: string | null;
  /** rtrpNo — 회수지(반품지)번호. */
  returnPlaceNo: string | null;
  returnPlaceLabel: string | null;
  /** dvCstPolNo — 배송비정책번호. */
  deliveryCostPolicyNo: string | null;
  deliveryCostPolicyLabel: string | null;
  /** dvRgsprGrpCd — 배송가능지역코드. */
  deliveryRegionGroupCode: string | null;
  deliveryRegionGroupLabel: string | null;
  /** nldySndCloseTm — 평일 발송마감시간(HH24MI). */
  weekdayCloseTime: string | null;
  /** satSndCloseTm — 토요일 발송마감시간(HH24MI). */
  saturdayCloseTime: string | null;
}

export const EMPTY_LOTTEON_SELLER_SETTINGS: LotteOnSellerSettings = {
  outboundPlaceNo: null,
  outboundPlaceLabel: null,
  returnPlaceNo: null,
  returnPlaceLabel: null,
  deliveryCostPolicyNo: null,
  deliveryCostPolicyLabel: null,
  deliveryRegionGroupCode: null,
  deliveryRegionGroupLabel: null,
  weekdayCloseTime: null,
  saturdayCloseTime: null,
};

interface Row {
  outbound_place_no: string | null;
  outbound_place_label: string | null;
  return_place_no: string | null;
  return_place_label: string | null;
  delivery_cost_policy_no: string | null;
  delivery_cost_policy_label: string | null;
  delivery_region_group_code: string | null;
  delivery_region_group_label: string | null;
  weekday_close_time: string | null;
  saturday_close_time: string | null;
}

const COLUMNS =
  "outbound_place_no, outbound_place_label, return_place_no, return_place_label, " +
  "delivery_cost_policy_no, delivery_cost_policy_label, delivery_region_group_code, " +
  "delivery_region_group_label, weekday_close_time, saturday_close_time";

function fromRow(row: Row): LotteOnSellerSettings {
  return {
    outboundPlaceNo: row.outbound_place_no,
    outboundPlaceLabel: row.outbound_place_label,
    returnPlaceNo: row.return_place_no,
    returnPlaceLabel: row.return_place_label,
    deliveryCostPolicyNo: row.delivery_cost_policy_no,
    deliveryCostPolicyLabel: row.delivery_cost_policy_label,
    deliveryRegionGroupCode: row.delivery_region_group_code,
    deliveryRegionGroupLabel: row.delivery_region_group_label,
    weekdayCloseTime: row.weekday_close_time,
    saturdayCloseTime: row.saturday_close_time,
  };
}

/** 빈 문자열은 «지움»(null)으로 읽는다 — 화면에서 선택을 비우면 설정이 없어진다. */
const clean = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * HH24MI 네 자리. 형식이 아니면 «저장하지 않는다»(null) — 롯데ON 이 거부할 값을
 * 설정에 눌러 담아 두면 등록 직전에야 실패한다. 058 의 CHECK 와 같은 규칙이다.
 */
const cleanCloseTime = (value: unknown): string | null => {
  const raw = clean(value);
  if (raw == null) return null;
  const digits = raw.replace(/[^\d]/g, "");
  return /^\d{4}$/.test(digits) ? digits : null;
};

/**
 * 판매자 고정값의 **사다리**. 상품 폼이 먼저고, 설정은 폼이 비었을 때만 들어온다.
 *
 * 🔴 이 순서가 이 기능의 전부다. 뒤집으면 「이 상품에서만 다른 출고지를 골랐다」는
 * 셀러의 결정이 설정에 덮인다 — 그러면 엉뚱한 곳에서 물건이 나간다. 제조사
 * 사다리(상품 명시값 → 프로필 → 기본값)와 같은 원칙이다.
 *
 * build-context 에서 쓰지만 여기 두는 이유는 «순수 함수라서 그 자체로 검사할 수
 * 있게» 하려는 것이다(build-context 는 Supabase 를 부른다).
 */
export function resolveLotteOnSellerFixedValue(
  formValue: string | null | undefined,
  settingValue: string | null,
): { value: string | null; source: "PRODUCT" | "SELLER_SETTING" | "NONE" } {
  const fromForm = typeof formValue === "string" ? formValue.trim() : "";
  if (fromForm.length > 0) return { value: fromForm, source: "PRODUCT" };
  if (settingValue && settingValue.trim().length > 0) {
    return { value: settingValue.trim(), source: "SELLER_SETTING" };
  }
  return { value: null, source: "NONE" };
}

export async function loadLotteOnSellerSettings(): Promise<LotteOnSellerSettings> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return EMPTY_LOTTEON_SELLER_SETTINGS;
  const { data, error } = await supabase
    .from("lotteon_seller_settings")
    .select(COLUMNS)
    .eq("id", SINGLETON_ID)
    .maybeSingle();
  // 🔴 조회 실패를 «설정 없음» 과 같은 얼굴로 돌려주지만, 조용히 넘기지는 않는다.
  //    호출부(등록 미리보기)를 막지 않되 원인은 서버 로그에 남는다.
  if (error) {
    console.warn("[lotteon-seller-settings] 조회 실패:", error.message);
    return EMPTY_LOTTEON_SELLER_SETTINGS;
  }
  return data ? fromRow(data as unknown as Row) : EMPTY_LOTTEON_SELLER_SETTINGS;
}

export async function saveLotteOnSellerSettings(
  input: Partial<Record<keyof LotteOnSellerSettings, unknown>>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "저장소에 연결하지 못했습니다." };
  const { error } = await supabase.from("lotteon_seller_settings").upsert(
    {
      id: SINGLETON_ID,
      outbound_place_no: clean(input.outboundPlaceNo),
      outbound_place_label: clean(input.outboundPlaceLabel),
      return_place_no: clean(input.returnPlaceNo),
      return_place_label: clean(input.returnPlaceLabel),
      delivery_cost_policy_no: clean(input.deliveryCostPolicyNo),
      delivery_cost_policy_label: clean(input.deliveryCostPolicyLabel),
      delivery_region_group_code: clean(input.deliveryRegionGroupCode),
      delivery_region_group_label: clean(input.deliveryRegionGroupLabel),
      weekday_close_time: cleanCloseTime(input.weekdayCloseTime),
      saturday_close_time: cleanCloseTime(input.saturdayCloseTime),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
