/**
 * GOLF-01 축B(CEO 지시, 2026-09-15) — 수입 단계 세금 계산.
 *
 * ── 🔴 개별소비세는 여기 없다. 넣지 마라 ─────────────────────────────────
 * 골프채 수입에는 개별소비세가 붙지 않는다. 골프용품은 **2004년 특별소비세
 * 과세대상에서 제외**됐고, 그 뒤로 되돌아온 적이 없다.
 *
 * 개별소비세법 제1조 **제3항**에 나오는 "골프장 입장 1인 12,000원"을 보고
 * "골프 = 개별소비세"로 오해하기 쉽다. 그 조항은 **골프장이라는 장소에
 * 입장하는 행위**에 붙는 세목이고, 클럽을 수입하는 것과는 과세대상 자체가
 * 다르다. 이 주석이 여기 있는 이유가 그것이다 — 다음 사람이 그 조항을 찾아내고
 * "빠뜨렸구나" 하며 세율을 하나 더 넣지 않게 하기 위해서다.
 *
 * ── 임의값을 넣지 않는다 ─────────────────────────────────────────────────
 * 세율이 확정되지 않았으면 이 함수는 **null을 돌려준다**. 0으로 채우지도,
 * 대충 8%를 박지도 않는다. 지어낸 세율로 계산하면 셀러가 손해 보는 상품을
 * "추천"으로 받는다 — 환율을 모를 때 convertToKrwStrict가 null을 돌려주는
 * 것과 같은 규칙이다.
 *
 * ── 🔴 소액면세(USD 150)는 여기에 없다. 재판매 수입에는 적용되지 않는다 ────
 * 관세법 제94조 3·4호 + 시행규칙 제45조의 소액면세는 **자가사용으로 인정되는
 * 물품**에만 적용된다. 국내에서 판매할 목적으로 들여오는 물품은 금액과 무관하게
 * 수입신고 후 관세·부가세를 낸다(목록통관도 상용 화물에는 쓸 수 없다). 이
 * 저장소의 사용자는 전부 재판매 셀러이므로 면세 한도 분기 자체를 만들지 않는다 —
 * 만들면 그 분기가 언젠가 재판매 건에 켜지고, 그때 셀러는 내야 할 세금을
 * 0으로 본다.
 *
 * (참고로 그 한도의 기준도 CIF가 아니다 — 시행규칙 제45조는 **물품가격**을
 *  "과세가격에서 국제운임·보험료를 뺀 금액"으로 정의한다. 반면 세금의 과세표준은
 *  CIF다. 두 기준이 다르다는 사실이 가장 자주 틀리는 자리라 여기 적어 둔다.)
 */

/** 이 세율을 우리가 **확인했는가**. 근거의 세기를 값과 함께 들고 다닌다. */
export type RateConfidence = "CONFIRMED" | "NEEDS_VERIFICATION";

export interface TaxRateRef {
  /** 확정되지 않았으면 percent가 있어도 계산에 자동으로 쓰지 않는다(아래 참고). */
  percent: number | null;
  confidence: RateConfidence;
  /** 사람이 읽는 근거 한 줄. 화면에 그대로 쓴다. */
  basis: string;
  /** 근거 URL. 확인 못 한 항목은 "무엇을 확인하지 못했는지"를 basis에 적는다. */
  sources: string[];
  /**
   * 이 세율을 **언제** 확인했는가(YYYY-MM-DD). 세율은 해마다 바뀔 수 있는
   * 값이라, 근거만 있고 시점이 없으면 몇 년 전 숫자를 오늘의 사실로 쓰게 된다.
   */
  verifiedOn?: string;
  /** 다음 사람이 다시 확인해야 할 것. 확정이어도 남는 미확인 조각을 숨기지 않는다. */
  reviewNote?: string;
}

/**
 * 세율을 계산에 쓸 수 있는가.
 *
 * **NEEDS_VERIFICATION이면 false다.** percent에 값이 들어 있어도 마찬가지다 —
 * 참고로 보여줄 수는 있지만(provisional) 마진·판정에 흘려보내지 않는다.
 * 이 한 줄이 "확인 필요를 확정처럼 쓰는" 경로를 구조적으로 막는다.
 */
export function isUsableRate(rate: TaxRateRef | null | undefined): rate is TaxRateRef & { percent: number } {
  return rate != null && rate.percent != null && rate.confidence === "CONFIRMED";
}

export interface ImportTaxInput {
  /**
   * 과세가격(CIF) — 물품가 + 국제운임(+보험료). 관세의 과세표준이다.
   * 호출부가 이미 원화로 환산해서 넘긴다(환산 로직을 두 번 만들지 않는다 —
   * unified-price-decision.ts의 sourceProductPriceKrw와 같은 규칙).
   */
  customsValueKrw: number;
  dutyRate: TaxRateRef | null;
  vatRate: TaxRateRef | null;
  /**
   * 셀러가 직접 확인해서 입력한 관세율(%). 있으면 dutyRate보다 우선한다 —
   * 관세사·통관 실적으로 확정한 값이 우리 조사보다 정확하다. 이 값이 들어오는
   * 순간 결과는 confidence="CONFIRMED"가 된다(셀러가 확인한 것이므로).
   */
  sellerConfirmedDutyRatePercent?: number | null;
}

export interface ImportTaxResult {
  customsValueKrw: number;
  /** 실제로 적용된 관세율. 확정되지 않았으면 null. */
  appliedDutyRatePercent: number | null;
  customsDutyKrw: number | null;
  appliedVatRatePercent: number | null;
  /** 부가세 과세표준 = 과세가격 + 관세. 관세를 모르면 이 값도 null이다. */
  vatBaseKrw: number | null;
  importVatKrw: number | null;
  /** 관세 + 수입부가세. 하나라도 모르면 null — 부분 합계를 총액이라 부르지 않는다. */
  totalImportTaxKrw: number | null;
  /** 두 세금이 모두 확정된 값으로 계산됐는가. */
  resolved: boolean;
  /** resolved=false일 때 무엇이 모자란지. 화면의 "확인 필요" 문구가 이 값이다. */
  unresolvedReason: string | null;
  /**
   * 확정되지 않은 세율로 "이 정도일 것"만 보여줄 참고 금액. 마진·판정에는
   * 절대 들어가지 않는다(customsDutyKrw와 별도 필드인 것이 그 장치다 —
   * customerChargedShippingKrw가 원가 합산에 끼지 못하는 것과 같은 방식).
   */
  provisionalTotalImportTaxKrw: number | null;
  provisionalNote: string | null;
}

/**
 * 관세 = 과세가격(CIF) × 관세율
 * 수입부가세 = (과세가격 + 관세) × 10%
 *
 * 부가세 과세표준에 관세가 들어간다는 것이 중요하다. 둘을 각각 CIF에 곱해서
 * 더하면 부가세를 과소 계산한다.
 */
export function computeImportTaxes(input: ImportTaxInput): ImportTaxResult {
  const base = input.customsValueKrw;

  // 셀러가 직접 확인한 세율이 최우선이다.
  const sellerRate = input.sellerConfirmedDutyRatePercent;
  const dutyPercent =
    sellerRate != null && sellerRate >= 0 ? sellerRate : isUsableRate(input.dutyRate) ? input.dutyRate.percent : null;
  const vatPercent = isUsableRate(input.vatRate) ? input.vatRate.percent : null;

  // 참고 금액 — 확인되지 않은 세율이라도 "대략 얼마"를 말할 수는 있다.
  // 단, 아래 customsDutyKrw/importVatKrw와 **다른 필드**로만 나간다.
  const provisionalDutyPercent = dutyPercent ?? input.dutyRate?.percent ?? null;
  const provisionalVatPercent = vatPercent ?? input.vatRate?.percent ?? null;
  let provisionalTotalImportTaxKrw: number | null = null;
  let provisionalNote: string | null = null;
  if (provisionalDutyPercent != null && provisionalVatPercent != null) {
    const pDuty = Math.round((base * provisionalDutyPercent) / 100);
    const pVat = Math.round(((base + pDuty) * provisionalVatPercent) / 100);
    provisionalTotalImportTaxKrw = pDuty + pVat;
    provisionalNote = `관세 ${provisionalDutyPercent}% · 부가세 ${provisionalVatPercent}% 가정 시 약 ₩${provisionalTotalImportTaxKrw.toLocaleString("ko-KR")}`;
  }

  if (dutyPercent == null || vatPercent == null) {
    const missing = [
      dutyPercent == null ? (input.dutyRate?.basis ?? "관세율 확인 필요") : null,
      vatPercent == null ? (input.vatRate?.basis ?? "수입부가세율 확인 필요") : null,
    ].filter(Boolean);
    return {
      customsValueKrw: base,
      appliedDutyRatePercent: null,
      customsDutyKrw: null,
      appliedVatRatePercent: vatPercent,
      vatBaseKrw: null,
      importVatKrw: null,
      totalImportTaxKrw: null,
      resolved: false,
      unresolvedReason: missing.join(" · "),
      provisionalTotalImportTaxKrw,
      provisionalNote,
    };
  }

  const customsDutyKrw = Math.round((base * dutyPercent) / 100);
  const vatBaseKrw = base + customsDutyKrw;
  const importVatKrw = Math.round((vatBaseKrw * vatPercent) / 100);

  return {
    customsValueKrw: base,
    appliedDutyRatePercent: dutyPercent,
    customsDutyKrw,
    appliedVatRatePercent: vatPercent,
    vatBaseKrw,
    importVatKrw,
    totalImportTaxKrw: customsDutyKrw + importVatKrw,
    resolved: true,
    unresolvedReason: null,
    provisionalTotalImportTaxKrw,
    provisionalNote,
  };
}
