import { convertToKrw } from "./currency";

/**
 * GOLF-01 축B(CEO 지시, 2026-09-15) — "배송 계산용: 실중량 · 가로 · 세로 · 높이 ·
 * 용적중량".
 *
 * ── 왜 이 파일이 생겼나 ──────────────────────────────────────────────────
 * 이 저장소에는 오늘까지 **중량이라는 개념이 없었다**(weightKg · volumetric ·
 * dimensionalWeight grep 0건). 국제배송비는 언제나 판매자 기본값
 * DEFAULT_PRICE_BREAKDOWN_INPUT.shippingKrw = ₩12,000 하나였다. 아동의류는
 * 그 값이 실제와 크게 어긋나지 않아서 문제가 드러나지 않았다.
 *
 * 골프채에서는 그 가정이 무너진다. CEO 실측:
 *
 *   46인치(116cm) 클럽 → 125×20×20 박스 → 용적 10kg → EMS ¥10,600 ≈ ₩97,520
 *   같은 클럽        → 120×15×15 슬림 튜브 → 용적 5.4kg → EMS ¥8,200
 *
 * **포장 하나로 배송비가 16,000~97,000원 사이에서 갈린다.** ₩12,000 기본값을
 * 그대로 쓰면 셀러는 8만 원 적자를 마진으로 착각한다.
 *
 * ── 이 파일이 하지 않는 것 ───────────────────────────────────────────────
 * 치수를 추정하지 않는다. 상품에서 박스 크기를 읽어내는 코드는 없고, 만들지도
 * 않는다("46인치 클럽이니까 125cm 박스겠지"는 우리가 지어내는 값이다). 치수도
 * 실중량도 없으면 chargeableWeightKg = null 이고, 그때 배송비는 계산되지 않는다 —
 * 0으로 채우지 않는다. 이 저장소가 환율·관세에서 지키는 규칙과 같다.
 */

/**
 * 부피중량 제수. EMS(일본우편)·대부분의 국제 특송이 쓰는 값이다
 * (가로×세로×높이(cm) ÷ 5,000 = kg).
 *
 * 상수로 두는 이유: 항공 특송사마다 5,000과 6,000이 갈린다. 숫자를 식에 박아
 * 두면 다른 배송수단을 붙일 때 그 식을 복사하게 되고, 그 순간 두 곳이 서로 다른
 * 제수를 쓰기 시작한다.
 */
export const EMS_VOLUMETRIC_DIVISOR = 5000;

export interface PackageDimensionsCm {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

/** 가로×세로×높이 ÷ 제수. 소수점 셋째 자리에서 반올림한다(요금 구간 판정에만 쓴다). */
export function volumetricWeightKg(
  dimensions: PackageDimensionsCm,
  divisor: number = EMS_VOLUMETRIC_DIVISOR,
): number | null {
  const { lengthCm, widthCm, heightCm } = dimensions;
  if (!(lengthCm > 0) || !(widthCm > 0) || !(heightCm > 0) || !(divisor > 0)) return null;
  return Number(((lengthCm * widthCm * heightCm) / divisor).toFixed(3));
}

/**
 * 과금 기준. EMS는 **실중량과 부피중량 중 큰 쪽**으로 요금을 매긴다 —
 * 골프채처럼 가볍고 긴 물건은 거의 언제나 부피중량이 이긴다.
 *
 *   ACTUAL     실중량이 더 크거나 치수를 모른다
 *   VOLUMETRIC 부피중량이 더 크거나 실중량을 모른다
 *   UNKNOWN    둘 다 모른다 — 배송비를 계산할 수 없다
 */
export type ChargeableWeightBasis = "ACTUAL" | "VOLUMETRIC" | "UNKNOWN";

export interface ChargeableWeightInput {
  actualWeightKg?: number | null;
  dimensionsCm?: PackageDimensionsCm | null;
  /** 배송수단별 제수. 기본 EMS 5,000. */
  volumetricDivisor?: number;
}

export interface ChargeableWeight {
  actualWeightKg: number | null;
  volumetricWeightKg: number | null;
  /** 실제로 요금이 매겨지는 중량. 둘 다 모르면 null — 0으로 채우지 않는다. */
  chargeableWeightKg: number | null;
  basis: ChargeableWeightBasis;
  volumetricDivisor: number;
  /** 화면에 그대로 쓰는 한 줄. "왜 이 중량인가"를 셀러가 읽을 수 있어야 한다. */
  note: string;
}

export function resolveChargeableWeight(input: ChargeableWeightInput): ChargeableWeight {
  const divisor = input.volumetricDivisor ?? EMS_VOLUMETRIC_DIVISOR;
  const actual = input.actualWeightKg != null && input.actualWeightKg > 0 ? input.actualWeightKg : null;
  const volumetric = input.dimensionsCm ? volumetricWeightKg(input.dimensionsCm, divisor) : null;

  if (actual == null && volumetric == null) {
    return {
      actualWeightKg: null,
      volumetricWeightKg: null,
      chargeableWeightKg: null,
      basis: "UNKNOWN",
      volumetricDivisor: divisor,
      note: "실중량·박스 치수가 모두 없어 배송 중량을 계산할 수 없습니다",
    };
  }
  if (volumetric == null) {
    return {
      actualWeightKg: actual,
      volumetricWeightKg: null,
      chargeableWeightKg: actual,
      basis: "ACTUAL",
      volumetricDivisor: divisor,
      // 치수를 모르면 부피중량이 실중량보다 클 가능성을 확인할 수 없다. 그
      // 사실을 숨기면 셀러는 이 값을 확정 배송비로 읽는다.
      note: `실중량 ${actual}kg 기준 · 박스 치수가 없어 부피중량은 확인하지 못했습니다`,
    };
  }
  if (actual == null) {
    return {
      actualWeightKg: null,
      volumetricWeightKg: volumetric,
      chargeableWeightKg: volumetric,
      basis: "VOLUMETRIC",
      volumetricDivisor: divisor,
      note: `부피중량 ${volumetric}kg 기준(가로×세로×높이÷${divisor.toLocaleString("ko-KR")}) · 실중량은 확인하지 못했습니다`,
    };
  }
  const usesVolumetric = volumetric > actual;
  return {
    actualWeightKg: actual,
    volumetricWeightKg: volumetric,
    chargeableWeightKg: usesVolumetric ? volumetric : actual,
    basis: usesVolumetric ? "VOLUMETRIC" : "ACTUAL",
    volumetricDivisor: divisor,
    note: usesVolumetric
      ? `부피중량 ${volumetric}kg이 실중량 ${actual}kg보다 커서 부피중량으로 과금됩니다`
      : `실중량 ${actual}kg이 부피중량 ${volumetric}kg보다 커서 실중량으로 과금됩니다`,
  };
}

/* ─────────────────────────── EMS 일본 → 한국 요금 ─────────────────────────── */

export interface EmsRateBracket {
  /** 이 중량(kg) 이하면 이 요금. */
  uptoKg: number;
  jpy: number;
}

/**
 * 🟡 **확인 필요** — CEO가 이미 조사해 넘긴 표를 그대로 옮긴 것이다(재조사 금지
 * 지시). 일본우편 EMS 대한민국(제1지역) 요금으로 보고된 값이며, 일본우편 1차
 * 요금표로 우리가 직접 확인한 값은 아니다.
 *
 * **2kg 미만 구간과 10kg 초과 구간은 이 표에 없다.** 없는 구간의 요금을 지어내지
 * 않는다 — estimateEmsJapanToKorea()가 그 사실을 flag로 돌려준다.
 *
 * 구간 요금표이므로 "5.4kg"처럼 표에 없는 중량은 **상위 구간**(7kg) 요금이
 * 적용된다. EMS가 실제로 그렇게 과금하고, 그 방향이 셀러에게 보수적이다.
 */
export const EMS_JAPAN_TO_KOREA_BRACKETS: readonly EmsRateBracket[] = [
  { uptoKg: 2, jpy: 3400 },
  { uptoKg: 3, jpy: 4400 },
  { uptoKg: 5, jpy: 6400 },
  { uptoKg: 7, jpy: 8200 },
  { uptoKg: 10, jpy: 10600 },
] as const;

export interface EmsEstimate {
  chargeableWeightKg: number;
  bracketUptoKg: number;
  jpy: number;
  /** 원화 환산. liveRates가 없으면 FIXED_RATES_TO_KRW 폴백이고 isEstimate=true. */
  krw: number;
  isRateEstimate: boolean;
  /**
   * 이 중량이 요금표의 구간과 정확히 맞는가. false면 우리가 가진 표에 없는
   * 중량이라 **상위 구간 요금으로 보수 추정**한 값이다(예: 5.4kg → 7kg 요금).
   */
  exactBracket: boolean;
  note: string;
}

/**
 * 과금중량 → EMS 요금. 표 범위 밖(10kg 초과)이면 **null** 이다 — 비례식으로
 * 늘려서 만들어내지 않는다. 골프백·장척 화물은 EMS 자체가 받지 않거나 별도
 * 요금이라, 여기서 숫자를 지어내면 셀러가 없는 배송수단으로 원가를 계산한다.
 */
export function estimateEmsJapanToKorea(
  chargeableWeightKg: number | null,
  liveRates?: Record<string, number>,
): EmsEstimate | null {
  if (chargeableWeightKg == null || !(chargeableWeightKg > 0)) return null;
  const bracket = EMS_JAPAN_TO_KOREA_BRACKETS.find((b) => chargeableWeightKg <= b.uptoKg);
  if (!bracket) return null;

  // 표에 있는 구간 경계와 정확히 같거나, 바로 아래 구간보다 크면서 이 구간
  // 이하인 경우 — 후자는 "이 구간 요금이 맞다"는 뜻이지만 우리 표가 1kg 단위로
  // 성겨서 중간값 요금을 확인하지 못한 것이기도 하다. 두 상태를 구분한다.
  const exactBracket = EMS_JAPAN_TO_KOREA_BRACKETS.some((b) => b.uptoKg === chargeableWeightKg);
  const belowTableFloor = chargeableWeightKg < EMS_JAPAN_TO_KOREA_BRACKETS[0].uptoKg;
  const converted = convertToKrw(bracket.jpy, "JPY", liveRates);

  const note = belowTableFloor
    ? `2kg 미만 구간 요금표를 확인하지 못해 2kg 요금(¥${bracket.jpy.toLocaleString()})으로 보수 추정했습니다`
    : exactBracket
      ? `EMS 일본→한국 ${bracket.uptoKg}kg 구간 ¥${bracket.jpy.toLocaleString()}`
      : `${chargeableWeightKg}kg은 요금표에 없는 중량이라 상위 구간 ${bracket.uptoKg}kg 요금(¥${bracket.jpy.toLocaleString()})을 적용했습니다`;

  return {
    chargeableWeightKg,
    bracketUptoKg: bracket.uptoKg,
    jpy: bracket.jpy,
    krw: converted.amountKrw,
    isRateEstimate: converted.isEstimate,
    exactBracket,
    note,
  };
}
