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
 * 🔴 SHIPPING-POLICY-01 — 위 둘째 줄의 ¥8,200 은 **우리가 갖고 있던 다섯 칸짜리
 * 표가 만든 값이다.** 일본우편 공개 요금표에는 5.5kg 칸이 실재해서 5.4kg 의
 * 실제 요금은 **¥6,900** 이다(EMS_JAPAN_TO_KOREA_BRACKETS 주석의 출처 참고).
 * 첫째 줄 ¥10,600 은 공개 요금표와 일치한다 — 바뀌지 않았다.
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

/**
 * 🔴 GOLF-04 STEP 1 — **이 요금표가 성립하는 출발국.**
 *
 * 아래 EMS_JAPAN_TO_KOREA_BRACKETS 는 일본우편 EMS 의 «일본 → 한국» 요금이다.
 * 함수 이름(estimateEmsJapanToKorea)에 일본이 적혀 있는데도 호출부는 출발국을
 * 보지 않았고, 그래서 미국·독일·뉴질랜드 판매처 가격에 일본 요금이 조용히
 * 붙었다. 이 상수는 그 조건을 **데이터로** 꺼내 둔 것이다 — 호출부가
 * "이 표를 써도 되는 출발국인가" 를 묻고 갈 수 있게.
 *
 * 다른 나라 요금표를 확인하기 전까지 이 값은 "JP" 하나다. 이 상수가 늘어나는
 * 날은 그 나라의 실제 공개 요금표를 읽은 날이어야 한다 — 국가를 추가하는 것과
 * 요금을 지어내는 것은 같은 일이 된다.
 */
export const EMS_RATE_TABLE_ORIGIN_COUNTRY = "JP";

/** 국가코드 비교를 한 곳에서만 한다(대소문자·공백을 호출부마다 다르게 다루지 않기 위해). */
export function normalizeOriginCountry(country: string | null | undefined): string | null {
  return country?.trim().toUpperCase() || null;
}

/**
 * 이 출발국에 «확인된» 중량기반 국제배송 요금표가 있는가.
 * false 면 배송비를 계산하지 않는다 — 다른 나라 요금으로 대신하지 않는다.
 */
export function hasConfirmedWeightBasedShippingRates(country: string | null | undefined): boolean {
  return normalizeOriginCountry(country) === EMS_RATE_TABLE_ORIGIN_COUNTRY;
}

export interface EmsRateBracket {
  /** 이 중량(kg) 이하면 이 요금. */
  uptoKg: number;
  jpy: number;
}

/**
 * 🟢 **일본우편 EMS 제1지대(第1地帯) 요금표 — 1차 출처에서 직접 옮겼다.**
 *
 * ── 지대 확인이 먼저다 ───────────────────────────────────────────────────
 * EMS 요금은 «출발국 → 목적지» 가 아니라 «지대» 로 갈린다. 지대를 틀리면 표
 * 전체가 틀린다. 일본우편 「該当国・地域一覧（EMS・第1）」 이 第1地帯를
 * **중국 · 한국 · 대만** 으로 못 박고 있고, 한국은 「全域」 으로 등재돼 있다.
 * 우리가 재는 경로는 언제나 «→ 한국» 이므로(KR_TARGET_MARKET) 이 표가 맞는
 * 지대다.
 *   https://www.post.japanpost.jp/service/send/oversea/list/delivery/ems/country/first.html
 *
 * ── 요금 자체의 출처(서로 독립된 두 페이지가 같은 값을 준다) ────────────
 *   ① 料金表(EMS：第1地帯)
 *      https://www.post.japanpost.jp/send/oversea/charge/list-ems/zone1.html
 *   ② 料金表(EMS：取り扱い国すべて) 의 第1地帯 열
 *      https://www.post.japanpost.jp/send/oversea/charge/list-ems/all.html
 * 두 페이지의 500g~10kg 구간이 한 줄도 어긋나지 않았다(2026-09-16 조회).
 *
 * ── 🔴 SHIPPING-POLICY-01 — 무엇이 바뀌었나 ─────────────────────────────
 * 직전까지 이 표는 **2 · 3 · 5 · 7 · 10kg 다섯 칸**이었고, 2kg 미만은 칸이
 * 아예 없어서 «0.06kg 장갑도 0.55kg 골프공도 전부 2kg 요금 ¥3,400» 이었다.
 * 공개 요금표에는 그 아래로 **500g부터 100g·250g 단위 구간이 실재한다**.
 * 즉 우리는 없는 구간을 몰랐던 게 아니라, 있는 구간을 **비워 두고 상위 요금을
 * 씌우고 있었다** — 경량 상품에서 배송비를 2배 넘게 과대계상했다
 * (0.55kg: ¥3,400 → 실제 ¥1,600).
 *
 * 다섯 칸 전부(2/3/5/7/10kg)는 공개 요금표의 같은 값으로 **그대로 남아 있다**.
 * 이번 변경은 «칸을 채운 것» 이지 «값을 고친 것» 이 아니다.
 *
 * ── 🔴 이 표가 하지 않는 것 ─────────────────────────────────────────────
 * ① **보간·외삽하지 않는다.** 아래 줄은 전부 공개 요금표에 인쇄된 줄이다.
 *    6kg 과 7kg 사이에 6.5kg 칸이 없는 것은 우리가 뺀 게 아니라 원표에 없다.
 * ② **10kg 초과를 담지 않는다.** 원표는 30kg까지 이어지지만, EMS 는 중량과
 *    별도로 «길이 1.5m · 길이+둘레 3m» 같은 치수 제한이 있고 우리는 그 제한을
 *    검사하지 않는다. 골프백·장척 화물이 실제로 EMS 로 갈 수 있는지 확인하기
 *    전에 요금만 먼저 채우면, 셀러는 «쓸 수 없는 경로» 로 원가를 계산하게 된다.
 *    10kg 초과는 지금까지처럼 null(계산 불가)이다.
 * ③ **小形包装物(국제소포·소형포장물) · 国際eパケット · 에어메일을 담지 않는다.**
 *    더 싸지만 적용 조건(중량 상한 2kg · 추적/보상 유무 · 발송인 자격)이 다르고,
 *    상품·경로에 맞는 배송수단이 무엇인지 우리 입력에는 없다. 싸다고 자동으로
 *    고르면 그 순간 «실제로는 쓸 수 없는 요금» 으로 계산한다(SHIPPING-POLICY-01 ①).
 *
 * 구간 요금표이므로 "5.4kg"처럼 경계와 딱 맞지 않는 중량은 **그 중량이 속하는
 * 구간**(5.5kg)의 요금이 적용된다. 이건 추정이 아니라 EMS 의 과금 방식 그대로다.
 */
export const EMS_JAPAN_TO_KOREA_BRACKETS: readonly EmsRateBracket[] = [
  { uptoKg: 0.5, jpy: 1450 },
  { uptoKg: 0.6, jpy: 1600 },
  { uptoKg: 0.7, jpy: 1750 },
  { uptoKg: 0.8, jpy: 1900 },
  { uptoKg: 0.9, jpy: 2050 },
  { uptoKg: 1, jpy: 2200 },
  { uptoKg: 1.25, jpy: 2500 },
  { uptoKg: 1.5, jpy: 2800 },
  { uptoKg: 1.75, jpy: 3100 },
  { uptoKg: 2, jpy: 3400 },
  { uptoKg: 2.5, jpy: 3900 },
  { uptoKg: 3, jpy: 4400 },
  { uptoKg: 3.5, jpy: 4900 },
  { uptoKg: 4, jpy: 5400 },
  { uptoKg: 4.5, jpy: 5900 },
  { uptoKg: 5, jpy: 6400 },
  { uptoKg: 5.5, jpy: 6900 },
  { uptoKg: 6, jpy: 7400 },
  { uptoKg: 7, jpy: 8200 },
  { uptoKg: 8, jpy: 9000 },
  { uptoKg: 9, jpy: 9800 },
  { uptoKg: 10, jpy: 10600 },
] as const;

/**
 * 이 표가 담고 있는 최대 중량(kg). 이 값을 넘으면 estimateEmsJapanToKorea 는
 * null 이다 — 공개 요금표에 줄이 있어도 치수 제한을 확인하기 전에는 채우지
 * 않는다(위 주석 ②).
 */
export const EMS_JAPAN_TO_KOREA_MAX_KG =
  EMS_JAPAN_TO_KOREA_BRACKETS[EMS_JAPAN_TO_KOREA_BRACKETS.length - 1].uptoKg;

export interface EmsEstimate {
  chargeableWeightKg: number;
  bracketUptoKg: number;
  jpy: number;
  /** 원화 환산. liveRates가 없으면 FIXED_RATES_TO_KRW 폴백이고 isEstimate=true. */
  krw: number;
  isRateEstimate: boolean;
  /**
   * 이 중량이 요금표의 **구간 경계와 정확히 같은가**(예: 5.0kg · 10kg).
   *
   * 🔴 SHIPPING-POLICY-01 — 이 값의 의미가 좁아졌다. 예전 표는 2/3/5/7/10kg
   * 다섯 칸뿐이라 false 는 «표에 없는 중량이라 상위 구간으로 보수 추정했다» 는
   * 뜻이었다. 이제 표는 공개 요금표 전체(500g~10kg)라, false 는 **중량이 경계에
   * 딱 떨어지지 않는다**는 사실만 말한다 — 요금 자체는 추정이 아니라 EMS 가
   * 실제로 그 구간에 매기는 공시 요금이다.
   */
  exactBracket: boolean;
  note: string;
}

/**
 * 과금중량 → EMS 요금. 표 범위 밖(10kg 초과)이면 **null** 이다 — 비례식으로
 * 늘려서 만들어내지 않는다. 골프백·장척 화물은 EMS 자체가 받지 않거나 별도
 * 요금이라, 여기서 숫자를 지어내면 셀러가 없는 배송수단으로 원가를 계산한다.
 *
 * 🔴 **출발국을 이 함수가 묻지 않는다.** 이름 그대로 «일본→한국» 요금표 하나만
 * 본다. 출발국 확인은 호출부의 책임이고, 그 문은
 * hasConfirmedWeightBasedShippingRates() 한 곳뿐이다(GOLF-04).
 */
export function estimateEmsJapanToKorea(
  chargeableWeightKg: number | null,
  liveRates?: Record<string, number>,
): EmsEstimate | null {
  if (chargeableWeightKg == null || !(chargeableWeightKg > 0)) return null;
  const bracket = EMS_JAPAN_TO_KOREA_BRACKETS.find((b) => chargeableWeightKg <= b.uptoKg);
  if (!bracket) return null;

  // 경계와 딱 맞는가. 🔴 SHIPPING-POLICY-01 이후 이건 «정확도» 가 아니라 «표시»
  // 의 문제다 — 어느 쪽이든 요금은 공개 요금표의 그 구간 요금 그대로다.
  const exactBracket = EMS_JAPAN_TO_KOREA_BRACKETS.some((b) => b.uptoKg === chargeableWeightKg);
  const converted = convertToKrw(bracket.jpy, "JPY", liveRates);

  const note = exactBracket
    ? `EMS 일본→한국 ${bracket.uptoKg}kg 구간 ¥${bracket.jpy.toLocaleString()}`
    : `과금중량 ${chargeableWeightKg}kg은 EMS 일본→한국 ${bracket.uptoKg}kg 구간(¥${bracket.jpy.toLocaleString()})에 해당합니다 — EMS는 구간 상한 요금으로 과금합니다`;

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
