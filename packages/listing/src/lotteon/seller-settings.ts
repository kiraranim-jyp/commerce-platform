/**
 * REWORK — 커머스 탭 구조 통일(CEO 지시, 2026-09-14): **셀러 설정 ↔ 롯데ON**.
 *
 * ── 이 파일이 존재하는 이유 ────────────────────────────────────────────────
 * 롯데ON 탭은 `출고지번호 · 반품지번호 · 배송비정책번호 · 배송가능지역코드 ·
 * 택배사코드 · 반품택배사코드`를 셀러에게 **손으로 치게** 하고 있었다. 그중
 * 어떤 것이 이미 셀러 설정(SellerProfile)에 있는 값이고, 어떤 것이 아닌지를
 * 화면과 payload가 **서로 다르게 판단하지 않도록** 판정을 여기 한 곳에 둔다.
 * (스마트스토어/쿠팡이 `settings-status.ts` 하나로 같은 일을 하는 것과 같은
 * 자리다 — 새 구조를 만드는 게 아니라 같은 자리를 롯데ON에도 만든다.)
 *
 * ── 판정의 근거는 저장소가 이미 화면에 적어 둔 문장이다 ────────────────────
 * `apps/admin/src/app/settings/page.tsx`의 배송 프로필 폼이 직접 말한다:
 *
 *   "배송비/출고 소요일은 두 플랫폼에 동일하게 적용됩니다 — 택배사만
 *    플랫폼별로 따로 관리"                                   (배송 프로필 hint)
 *   "택배사 (Coupang) … 아래 SmartStore 택배사와는 별도 관리"
 *   "택배사 (SmartStore) … 플랫폼별로 요구하는 코드 체계가 달라 위 쿠팡
 *    택배사와 별도로 저장됩니다"
 *
 * 즉 이 저장소는 **택배사·출고지·반품지는 채널마다 코드체계가 다르다**는 것을
 * 이미 설계 전제로 갖고 있다(그래서 `delivery_company_code`와
 * `naver_delivery_company_code`가 따로 있다). 롯데ON도 예외가 아니다 —
 * 쿠팡 Wing 코드(`CJGLS` / Wing 출고지 코드)를 롯데ON 87 payload에 그대로
 * 넣으면 롯데ON이 모르는 값이 된다. 그래서 **자동 반영하지 않는다.**
 *
 * 반대로 **출고 소요일**은 위 문장이 명시하듯 플랫폼 중립적인 "일수"다.
 * 코드체계가 없다 → 롯데ON `sndBgtNday`(발송예정일수)로 그대로 쓸 수 있다.
 * 지금까지 그 자리는 셀러 설정을 무시하고 상수 3이었다.
 *
 * 🔴 이 파일은 **값을 지어내지 않는다.** 셀러 설정에 없는 값은 없다고 말하고,
 *    코드체계가 다른 값은 다르다고 말한다. 억지로 옮겨 적지 않는다.
 */

/**
 * 롯데ON이 셀러 설정에서 **읽는** 값 전부(읽기 전용 부분집합).
 *
 * `SellerProfile`(apps/admin) 전체를 끌어오지 않는 이유: 이 패키지가 커머스
 * 어드민의 DB 모양을 알 필요가 없고, 알게 되면 컬럼이 하나 늘 때마다 payload
 * 패키지가 함께 흔들린다. 여기 있는 키가 곧 "롯데ON이 셀러 설정에서 보는 것"의
 * 전부다.
 */
export interface LotteOnSellerSettingsInput {
  /** 출고 소요일 — 설정 화면에서 "두 플랫폼에 동일하게 적용"이라고 말하는 값. */
  outboundLeadTimeDays: number | null;
  /** 택배사 (Coupang) — 쿠팡 코드체계(CJGLS 등). */
  deliveryCompanyCode: string | null;
  /** 택배사 (SmartStore) — 네이버용 자유 문자열. */
  naverDeliveryCompanyCode: string | null;
  /** 출고지 — 쿠팡 Wing이 발급한 코드. */
  outboundShippingPlaceCode: number | null;
  /** 반품지 — 쿠팡 Wing이 발급한 코드. */
  returnCenterCode: string | null;
  /** 상세페이지 상단/하단 공통 이미지 — 이미 롯데ON 상품기술서에 들어가고 있다. */
  topCommonImageEnabled: boolean;
  bottomCommonImageEnabled: boolean;
}

/**
 * 발송예정일수(sndBgtNday) 상한. 문서 원문 기준 **일반상품(dvPdTypCd=GNRL)은
 * 3일**이다. 이 저장소가 등록하는 형태가 정확히 일반상품이다
 * (build-payload.ts: `dvPdTypCd: "GNRL"`).
 */
export const LOTTEON_SHIP_BUDGET_DAYS_MAX = 3;

/** 셀러 설정이 없을 때 쓰던 기존 값. 바꾸지 않는다(회귀 방지). */
export const LOTTEON_SHIP_BUDGET_DAYS_FALLBACK = 3;

export type LotteOnShipBudgetSource =
  /** 셀러 설정의 "출고 소요일"을 그대로 썼다. */
  | "SELLER_SETTINGS"
  /** 셀러 설정 값이 롯데ON 상한을 넘어 상한으로 잘랐다. */
  | "SELLER_SETTINGS_CAPPED"
  /** 셀러 설정에 값이 없어 기존 기본값으로 갔다. */
  | "FALLBACK";

export interface LotteOnShipBudgetResolution {
  days: number;
  source: LotteOnShipBudgetSource;
  /** 화면이 그대로 읽어 주는 한 줄. 화면이 따로 문장을 만들지 않게 한다. */
  note: string;
}

/**
 * 셀러 설정의 "출고 소요일" → 롯데ON 발송예정일수(sndBgtNday).
 *
 * 자르는(capped) 경우를 **조용히 처리하지 않는다.** 셀러가 설정에 7일을 넣어
 * 뒀는데 롯데ON에 3일로 등록되면, 그 사실을 모르는 셀러는 지킬 수 없는 발송
 * 약속을 하게 된다. 그래서 source를 돌려주고 화면이 그것을 적는다.
 */
export function resolveLotteOnShipBudgetDays(
  settings: LotteOnSellerSettingsInput | null | undefined,
): LotteOnShipBudgetResolution {
  const raw = settings?.outboundLeadTimeDays;
  if (raw == null || !Number.isFinite(raw) || raw <= 0) {
    return {
      days: LOTTEON_SHIP_BUDGET_DAYS_FALLBACK,
      source: "FALLBACK",
      note: `셀러 설정에 출고 소요일이 없어 기본값 ${LOTTEON_SHIP_BUDGET_DAYS_FALLBACK}일로 등록됩니다 — 설정에서 한 번 채워두면 이후 모든 상품에 자동 적용됩니다.`,
    };
  }
  const days = Math.floor(raw);
  if (days > LOTTEON_SHIP_BUDGET_DAYS_MAX) {
    return {
      days: LOTTEON_SHIP_BUDGET_DAYS_MAX,
      source: "SELLER_SETTINGS_CAPPED",
      note: `셀러 설정의 출고 소요일은 ${days}일이지만 롯데ON 일반상품 상한이 ${LOTTEON_SHIP_BUDGET_DAYS_MAX}일이라 ${LOTTEON_SHIP_BUDGET_DAYS_MAX}일로 등록됩니다.`,
    };
  }
  return {
    days,
    source: "SELLER_SETTINGS",
    note: `셀러 설정의 출고 소요일 ${days}일이 그대로 등록됩니다.`,
  };
}

/**
 * 셀러 설정 한 줄이 롯데ON에서 어떤 처지인가.
 *
 *  AUTO_APPLIED          셀러 설정 값이 롯데ON 등록에 **그대로** 들어간다.
 *  SETTINGS_REQUIRED     같은 값을 롯데ON도 쓰는데 셀러 설정이 비어 있다 →
 *                        설정에서 채우면 된다(이 탭에서 새로 받지 않는다).
 *  CHANNEL_CODE_DIFFERS  셀러 설정에 **개념은 있으나** 코드체계가 채널마다 달라
 *                        그 값을 롯데ON에 쓸 수 없다.
 *  NO_SETTING_CONCEPT    셀러 설정에 그 개념 자체가 없다 → 롯데ON 고유값으로 둔다.
 */
export type LotteOnSellerSettingUsage =
  | "AUTO_APPLIED"
  | "SETTINGS_REQUIRED"
  | "CHANNEL_CODE_DIFFERS"
  | "NO_SETTING_CONCEPT";

export interface LotteOnSellerSettingRow {
  /** 셀러 설정 화면의 라벨을 그대로 쓴다 — 셀러가 두 화면에서 같은 이름을 본다. */
  label: string;
  /** 셀러 설정에 저장돼 있는 값(없으면 null). 코드/번호는 원문 그대로. */
  settingValue: string | null;
  /** 이 값이 롯데ON 등록에서 어떤 처지인가. */
  usage: LotteOnSellerSettingUsage;
  /** 롯데ON 쪽 대응 필드(있을 때만). 지어낸 이름이 아니라 87 payload 필드명. */
  lotteOnField?: string;
  /** 왜 그런가 — 화면이 그대로 읽는다. */
  note: string;
}

/**
 * 셀러 설정에는 **개념 자체가 없는** 롯데ON 값들.
 *
 * 이것을 "없다"고 적어 두는 것이 이번 작업의 산출물 절반이다. 셀러 설정을
 * 억지로 신설하지 않는다(CEO 명시) — 대신 왜 롯데ON 고유값으로 남는지를
 * 화면과 보고서가 같은 문장으로 말한다.
 */
export const LOTTEON_ONLY_DELIVERY_VALUES: { label: string; lotteOnField: string; note: string }[] = [
  {
    label: "배송비정책번호",
    lotteOnField: "dvCstPolNo",
    note: "셀러 설정은 배송비를 **금액**(배송비/반품배송비)으로 갖고 있고, 롯데ON은 판매자센터에 등록된 **정책 번호**를 요구합니다 — 같은 개념이 아니라 금액에서 번호를 만들 수 없습니다.",
  },
  {
    label: "배송가능지역코드",
    lotteOnField: "dvRgsprGrpCd",
    note: "배송 가능 지역(전국/제주·도서산간)을 구분해 저장하는 자리가 셀러 설정에 없습니다 — 쿠팡·스마트스토어도 이 값을 쓰지 않습니다.",
  },
  {
    label: "반품택배사코드",
    lotteOnField: "rtngHdcCd",
    note: "반품 택배사를 따로 저장하는 자리가 셀러 설정에 없습니다(쿠팡·스마트스토어는 반품 택배사를 구분하지 않습니다).",
  },
  {
    label: "평일 발송마감시간",
    lotteOnField: "nldySndCloseTm",
    note: "발송 마감 시각을 저장하는 자리가 셀러 설정에 없습니다 — 셀러 설정이 갖고 있는 것은 소요 '일수'뿐입니다.",
  },
];

/**
 * 셀러 설정 전수를 롯데ON 관점으로 분류한다. **화면과 payload가 같은 표를 본다.**
 *
 * `settings`가 null이면(= 셀러 설정을 아직 만들지 않았거나 불러오지 못함)
 * 값 칸을 전부 null로 두고 처지만 말한다 — 없는 값을 기본값으로 메우지 않는다.
 */
export function describeLotteOnSellerSettings(
  settings: LotteOnSellerSettingsInput | null | undefined,
): LotteOnSellerSettingRow[] {
  const shipBudget = resolveLotteOnShipBudgetDays(settings);
  const text = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  };

  return [
    {
      label: "출고 소요일",
      settingValue: settings?.outboundLeadTimeDays != null ? `${settings.outboundLeadTimeDays}일` : null,
      usage: shipBudget.source === "FALLBACK" ? "SETTINGS_REQUIRED" : "AUTO_APPLIED",
      lotteOnField: "sndBgtNday",
      note: shipBudget.note,
    },
    {
      label: "상세페이지 공통 이미지 · 기본 구성",
      settingValue:
        settings == null
          ? null
          : [
              settings.topCommonImageEnabled ? "상단 사용" : null,
              settings.bottomCommonImageEnabled ? "하단 사용" : null,
            ]
              .filter(Boolean)
              .join(" · ") || "사용 안 함",
      usage: "AUTO_APPLIED",
      lotteOnField: "epnLst",
      note: "판매자 공통 상세블록과 상·하단 공통 이미지가 롯데ON 상품기술서에도 그대로 들어갑니다 — 쿠팡·스마트스토어와 같은 조립 함수를 씁니다.",
    },
    {
      label: "출고지",
      settingValue: settings?.outboundShippingPlaceCode != null ? String(settings.outboundShippingPlaceCode) : null,
      usage: "CHANNEL_CODE_DIFFERS",
      lotteOnField: "owhpNo",
      note: "셀러 설정의 출고지는 **쿠팡 Wing이 발급한 코드**입니다. 롯데ON 출고지번호는 롯데ON 판매자센터가 따로 발급합니다 — 번호 체계가 달라 그대로 쓸 수 없습니다.",
    },
    {
      label: "반품지",
      settingValue: text(settings?.returnCenterCode),
      usage: "CHANNEL_CODE_DIFFERS",
      lotteOnField: "rtrpNo",
      note: "셀러 설정의 반품지도 **쿠팡 Wing 코드**입니다. 롯데ON 회수지번호는 롯데ON 판매자센터에서 따로 생깁니다.",
    },
    {
      label: "택배사",
      settingValue:
        [text(settings?.deliveryCompanyCode) && `쿠팡 ${text(settings?.deliveryCompanyCode)}`, text(settings?.naverDeliveryCompanyCode) && `스마트스토어 ${text(settings?.naverDeliveryCompanyCode)}`]
          .filter(Boolean)
          .join(" · ") || null,
      usage: "CHANNEL_CODE_DIFFERS",
      lotteOnField: "hdcCd",
      note: "셀러 설정이 이미 택배사를 **플랫폼별로 따로** 저장하고 있습니다(설정 화면 원문: \"플랫폼별로 요구하는 코드 체계가 달라 … 별도로 저장됩니다\"). 롯데ON은 공통코드 DV_CO_CD를 쓰므로 쿠팡/스마트스토어 값을 옮겨 적을 수 없습니다.",
    },
    ...LOTTEON_ONLY_DELIVERY_VALUES.map((row) => ({
      label: row.label,
      settingValue: null,
      usage: "NO_SETTING_CONCEPT" as const,
      lotteOnField: row.lotteOnField,
      note: row.note,
    })),
  ];
}
