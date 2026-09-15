import { convertToKrwStrict } from "./currency";
import { computeImportTaxes, isUsableRate, type ImportTaxResult, type TaxRateRef } from "./import-tax";
import { resolveCategoryCostPolicy, type CategoryCostPolicy } from "./category-cost-policy";

/**
 * GOLF-01-TAX(CEO 최종 결정, 2026-09-15) — **관세·부가가치세는 판매자 원가가
 * 아니다. 모든 카테고리에서 «별도의 예상 구매자 부담 정보»다.**
 *
 * ── 직전 방향에서 무엇이 뒤집혔나 ────────────────────────────────────────
 * d72575f(GOLF-01 축B)는 골프 카테고리에 한해 관부가세를 착지원가에 넣었다
 * (importTaxesInLandedCost: true). CEO가 그 방향을 거뒀다. 이제 어떤
 * 카테고리에서도 관부가세는 판매자 원가·마진·verdict에 들어가지 않는다 —
 * MI-COST-POLICY-1의 «판매자 원가 계산 원칙»이 카테고리 예외 없이 되살아났고,
 * 그 대신 **빠진 사실을 말할 자리**가 생겼다:
 *
 *     상품가 / 배송비 / 기타 판매자 비용
 *     ────────────
 *     판매자 원가
 *
 *     [별도 참고]
 *     관세        예상 ○○원
 *     부가가치세  예상 ○○원
 *     ────────────
 *     구매자 부담 예상액
 *
 * 이 파일은 그 **아랫단(별도 참고)만** 만든다. 윗단(판매자 원가)은
 * computeUnifiedPriceDecision이 그대로 계산하고, 이 파일의 어떤 값도 그쪽으로
 * 흘러가지 않는다. 두 함수가 서로의 결과를 인자로 받지 않는 것이 그 장치다 —
 * 이어 붙일 인자 자체가 없으면 다음 사람이 이어 붙일 수 없다.
 *
 * ── 왜 «해당 여부»가 금액보다 먼저인가 ───────────────────────────────────
 * 세율을 아는 것과 그 세금이 이 수입에 붙는지를 아는 것은 다른 문제다.
 * 부가세 10%는 법정 세율이라 언제나 확정이지만, 소액면세로 통관되는 건에는
 * 애초에 붙지 않는다. 세율만 보고 곱하면 «내지 않을 세금»을 구매자 부담으로
 * 적게 된다. 그래서 각 세목이 먼저 **해당 / 비해당 / 확인 필요** 를 답하고,
 * «해당»일 때만 금액을 묻는다.
 *
 * ── 🔴 판단 축은 여섯이다(CEO 명시) ──────────────────────────────────────
 *   국가 · 원산지 · 품목/HS · 과세가격 · 배송 조건 · 수입 형태
 * 이 여섯이 타입으로 들어와 있고, 각 축이 «알고 있는지»를 결과가 그대로
 * 들고 나간다(axes). 모르는 축을 기본값으로 채우지 않는다 — 채우는 순간
 * 화면은 우리가 모르는 것을 아는 것처럼 말한다.
 */

/** 이 세목이 이 수입에 붙는가. 화면의 세 갈래가 이 타입 그대로다. */
export type ImportChargeApplicability = "APPLICABLE" | "NOT_APPLICABLE" | "NEEDS_REVIEW";

export const IMPORT_CHARGE_APPLICABILITY_LABEL: Record<ImportChargeApplicability, string> = {
  APPLICABLE: "해당",
  NOT_APPLICABLE: "비해당",
  NEEDS_REVIEW: "확인 필요",
};

/** CEO가 명시한 판단 축 여섯. 늘리지 않는다 — 늘리면 판단 근거가 흩어진다. */
export type ImportChargeAxisId =
  | "DESTINATION"
  | "ORIGIN"
  | "ITEM_HS"
  | "CUSTOMS_VALUE"
  | "DELIVERY_TERMS"
  | "IMPORT_MODE";

export const IMPORT_CHARGE_AXIS_LABEL: Record<ImportChargeAxisId, string> = {
  DESTINATION: "국가",
  ORIGIN: "원산지",
  ITEM_HS: "품목/HS",
  CUSTOMS_VALUE: "과세가격",
  DELIVERY_TERMS: "배송 조건",
  IMPORT_MODE: "수입 형태",
};

/**
 * 🔴 **수입 형태 — 이 한 축이 소액면세를 가른다. 임의로 고르지 마라.**
 *
 * 관세법 시행규칙 제45조 제2항 제1호의 소액면세는 "미화 150달러 이하로서
 * **자가사용 물품으로 인정되는 것**"에만 적용된다. 관세청 공식 답변도 같다 —
 * "판매를 목적으로 수입하는 경우에는 관부가세를 납부해야" 한다.
 *
 * 즉 같은 금액·같은 물건이라도 **구매대행(개인 자가사용 통관)**인지
 * **사업자 정식수입**인지에 따라 결과가 정반대다. 이 저장소는 오늘 그 값을
 * 어디에도 저장하지 않는다. 그러므로 기본값은 null이고, null은 «확인 필요»다.
 *
 * 한쪽을 가정하면 어느 쪽으로 가정해도 틀린다:
 *   개인 자가사용으로 가정 → 사업자 수입 건의 세금이 0원으로 사라진다
 *   사업자 수입으로 가정   → 구매대행 건에 없는 부담을 구매자에게 적는다
 */
export type ImportMode =
  /** 구매대행 등 개인 자가사용 통관. 소액면세 한도의 적용 대상이 될 수 있다. */
  | "PERSONAL_CLEARANCE"
  /** 사업자 정식수입(판매 목적). 금액과 무관하게 소액면세 대상이 아니다. */
  | "COMMERCIAL_IMPORT";

export const IMPORT_MODE_LABEL: Record<ImportMode, string> = {
  PERSONAL_CLEARANCE: "구매대행(개인 자가사용 통관)",
  COMMERCIAL_IMPORT: "사업자 정식수입(판매 목적)",
};

/**
 * 배송 조건 — 관세·부가세를 **누가 국경에서 내는가**.
 *
 *   DDP  해외 판매처/포워더가 선납한다. 구매자가 별도로 내지 않는다.
 *   DDU  수취인이 통관 때 낸다(해외 직구의 통상적인 조건).
 *
 * 모르면 null이고, null은 "구매자가 낸다"로 가정되지 않는다 — 대신 결과의
 * notes에 그 사실이 남는다(아래 resolveBuyerImportCharge 참고).
 */
export type DeliveryTerms = "DDP" | "DDU";

export const DELIVERY_TERMS_LABEL: Record<DeliveryTerms, string> = {
  DDP: "관세지급인도(DDP) · 해외 판매처 선납",
  DDU: "관세미지급인도(DDU) · 수취인 부담",
};

export interface ImportChargeAxisState {
  id: ImportChargeAxisId;
  label: string;
  /** 이 축의 값을 실제로 알고 있는가. */
  known: boolean;
  /** 사람이 읽는 값. 모르면 null이다 — "미확인" 같은 글자를 값 자리에 넣지 않는다. */
  value: string | null;
  /** 모르면 무엇을 확인해야 하는가 / 알면 그 값이 어디서 왔는가. */
  note: string;
}

export interface ImportChargeLine {
  kind: "CUSTOMS_DUTY" | "IMPORT_VAT";
  /** "관세" / "부가가치세". CEO 원문의 이름 그대로다. */
  label: string;
  applicability: ImportChargeApplicability;
  applicabilityLabel: string;
  /** 실제로 적용한 세율(%). 확정되지 않았으면 null. */
  ratePercent: number | null;
  /**
   * 금액. **«해당» + 확정 세율 + 과세가격**이 모두 있을 때만 값이 있다.
   * «비해당»이면 0이고(모르는 것이 아니라 붙지 않는 것이다), «확인 필요»면 null이다.
   */
  amountKrw: number | null;
  /** 화면에 그대로 쓰는 한 칸("예상 ₩87,142" / "확인 필요" / "비해당"). */
  display: string;
  /** 왜 이 판단인가. 세율 근거이거나, 어느 축이 모자란지다. */
  basis: string;
  /** «확인 필요»일 때 무엇을 확인해야 하는가(축 id). 아니면 빈 배열. */
  blockingAxes: ImportChargeAxisId[];
}

export interface BuyerImportChargeEstimate {
  policyId: CategoryCostPolicy["id"];
  categoryLabel: string;
  /** 여섯 축의 상태. 화면이 "무엇을 알고 무엇을 모르는가"를 그대로 읽는다. */
  axes: ImportChargeAxisState[];
  duty: ImportChargeLine;
  vat: ImportChargeLine;
  /**
   * 구매자 부담 예상액 = 관세 + 부가가치세. **둘 다 금액이 있을 때만** 값이
   * 있다 — 하나가 «확인 필요»인 채로 나머지를 합계라고 부르지 않는다.
   *
   * 🔴 판매자 원가는 여기 들어오지 않는다. 이 값은 «판매자 원가에서 빼낸 것»이
   *    아니라 «판매자 원가 밖에 따로 서 있는 것»이다.
   */
  totalKrw: number | null;
  /** 위 값을 화면에 그대로 쓰는 한 칸. */
  totalDisplay: string;
  /** 한 칸이라도 «확인 필요»인가. 화면이 참고 블록에 ⚠를 다는 기준이다. */
  needsReview: boolean;
  /**
   * 확정되지 않은 세율로 «이 정도일 것»만 말하는 참고금액(import-tax.ts의
   * provisionalTotalImportTaxKrw 그대로). 🔴 위 totalKrw와 **다른 필드**이고,
   * 화면의 금액 자리에 쓰지 않는다 — 확인 필요는 확인 필요로 표시한다.
   */
  provisionalTotalKrw: number | null;
  /** 계산 과정에서 남은 사실들. 화면이 그대로 줄로 쓴다. */
  notes: string[];
  /** 세금 계산의 원자료. 없으면 null(과세가격을 몰라 계산 자체를 못 한 경우). */
  importTax: ImportTaxResult | null;
}

export interface BuyerImportChargeInput {
  /** CATEGORY_PROFILES의 id. 없으면 DEFAULT 정책(품목/HS 미확정)이다. */
  categoryProfileId?: string | null;
  /** 축① 국가 — 수입국(ISO 2자). 이 제품은 한국 판매가 목적이라 호출부가 "KR"을 넘긴다. */
  destinationCountry?: string | null;
  /** 축② 원산지 — 협정세율을 받을 수 있는지가 여기서 갈린다. 모르면 null. */
  originCountry?: string | null;
  /** 축④ 과세가격(CIF) = 물품가 + 국제운임(+보험료). 호출부가 이미 원화로 만든 값. */
  customsValueKrw?: number | null;
  /**
   * 소액면세 한도를 재는 **물품가격**. 관세법 시행규칙 제45조는 이것을
   * "과세가격에서 국제운임·보험료를 뺀 금액"으로 정의한다 — 🔴 과세가격(CIF)과
   * 기준이 다르다. 가장 자주 틀리는 자리라 인자를 따로 받는다.
   */
  goodsValueKrw?: number | null;
  /** 축⑤ 배송 조건. 모르면 null. */
  deliveryTerms?: DeliveryTerms | null;
  /** 축⑥ 수입 형태. 🔴 모르면 null이고, 그 null이 «확인 필요»가 된다. */
  importMode?: ImportMode | null;
  /** 실측 환율표. 소액면세 한도(달러)를 원화로 옮길 때만 쓴다. */
  liveRates?: Record<string, number>;
  /** 셀러가 관세사·통관 실적으로 확인한 관세율(%). 있으면 조사값보다 우선한다. */
  sellerConfirmedDutyRatePercent?: number | null;
}

/**
 * 🟢 소액면세 한도 — **두 개의 선을 모두 들고 있는다.**
 *
 * 관세법 시행규칙 제45조 제2항이 정하는 자가사용 물품의 면세 한도는 미화
 * 150달러다. 다만 같은 항이 원산지에 따른 예외를 두고 있어(미합중국과의
 * 협정에 따른 일반물품 200달러) **원산지를 모르면 한도가 하나로 정해지지
 * 않는다**.
 *
 * 그래서 이 파일은 한도를 하나로 고르지 않고 두 선을 그대로 쓴다:
 *
 *   물품가격 > 200달러  →  어느 한도로 보아도 초과다. 원산지를 몰라도 «해당».
 *   물품가격 ≤ 150달러  →  어느 한도로 보아도 이하다. (자가사용이면) «비해당».
 *   그 사이            →  원산지에 따라 갈린다. «확인 필요».
 *
 * 이 구조가 중요한 이유: 우리가 200달러라는 숫자를 틀리게 알고 있더라도
 * (실제 한도가 150달러뿐이더라도) 200달러 초과를 «해당»으로 보는 판단은
 * 여전히 옳다. 틀릴 수 있는 방향이 «확인 필요»쪽으로만 열려 있다.
 *
 * 🔴 두 숫자 모두 사람이 법령 원문으로 한 번 확인할 것(reviewNote).
 */
export const DE_MINIMIS_BASE_USD = 150;
export const DE_MINIMIS_UPPER_USD = 200;
export const DE_MINIMIS_NOTE =
  "관세법 시행규칙 제45조 제2항 — 자가사용 물품 미화 150달러 이하 면세(원산지에 따라 200달러가 적용되는 예외가 있어 그 사이 금액은 원산지를 확인해야 합니다)";

const KIND_LABEL = { CUSTOMS_DUTY: "관세", IMPORT_VAT: "부가가치세" } as const;

/** 우리가 수입국으로 판단을 세울 수 있는 유일한 국가. 다른 나라는 «확인 필요»다. */
const SUPPORTED_DESTINATION = "KR";

function axis(
  id: ImportChargeAxisId,
  value: string | null,
  note: string,
): ImportChargeAxisState {
  return { id, label: IMPORT_CHARGE_AXIS_LABEL[id], known: value != null, value, note };
}

function line(
  kind: ImportChargeLine["kind"],
  applicability: ImportChargeApplicability,
  basis: string,
  options: { ratePercent?: number | null; amountKrw?: number | null; blockingAxes?: ImportChargeAxisId[] } = {},
): ImportChargeLine {
  const amountKrw = applicability === "NOT_APPLICABLE" ? 0 : (options.amountKrw ?? null);
  const display =
    applicability === "NOT_APPLICABLE"
      ? IMPORT_CHARGE_APPLICABILITY_LABEL.NOT_APPLICABLE
      : amountKrw != null
        ? `예상 ₩${amountKrw.toLocaleString("ko-KR")}`
        : // 🔴 «해당»이지만 세율이나 과세가격을 몰라 금액을 못 낸 경우도 여기다.
          // 임의로 계산하지 않는다 — 참고금액은 별도 필드로만 존재한다.
          IMPORT_CHARGE_APPLICABILITY_LABEL.NEEDS_REVIEW;
  return {
    kind,
    label: KIND_LABEL[kind],
    applicability,
    applicabilityLabel: IMPORT_CHARGE_APPLICABILITY_LABEL[applicability],
    ratePercent: options.ratePercent ?? null,
    amountKrw,
    display,
    basis,
    blockingAxes: options.blockingAxes ?? [],
  };
}

/**
 * 소액면세 한도를 넘었는가.
 *
 *   true   넘었다(= 소액면세 비해당 → 관부가세 해당)
 *   false  넘지 않았다(= 소액면세 해당 → 관부가세 비해당)
 *   null   모른다. 어느 쪽으로도 가정하지 않는다.
 */
function resolveDeMinimis(input: BuyerImportChargeInput): {
  exceeded: boolean | null;
  note: string;
  blockingAxes: ImportChargeAxisId[];
} {
  const goods = input.goodsValueKrw;
  if (goods == null) {
    return {
      exceeded: null,
      note: "물품가격(국제운임 제외)을 몰라 소액면세 한도를 재지 못했습니다",
      blockingAxes: ["CUSTOMS_VALUE"],
    };
  }
  const upper = convertToKrwStrict(DE_MINIMIS_UPPER_USD, "USD", input.liveRates);
  const base = convertToKrwStrict(DE_MINIMIS_BASE_USD, "USD", input.liveRates);
  if (upper == null || base == null) {
    // 환율을 모르면 달러 한도를 원화와 비교할 수 없다. 지어낸 환율로 재지 않는다.
    return {
      exceeded: null,
      note: "USD 환율을 몰라 소액면세 한도(달러)를 원화와 비교하지 못했습니다",
      blockingAxes: ["CUSTOMS_VALUE"],
    };
  }

  // ① 판매 목적 수입은 금액과 무관하게 소액면세 대상이 아니다(관세청 공식 답변).
  if (input.importMode === "COMMERCIAL_IMPORT") {
    return {
      exceeded: true,
      note: `${IMPORT_MODE_LABEL.COMMERCIAL_IMPORT} — 판매 목적 수입은 금액과 무관하게 소액면세 대상이 아닙니다`,
      blockingAxes: [],
    };
  }

  // ② 어느 한도로 보아도 초과인 금액이면 수입 형태·원산지를 몰라도 결론이 같다.
  if (goods > upper.amountKrw) {
    return {
      exceeded: true,
      note: `물품가격이 소액면세 한도(미화 ${DE_MINIMIS_UPPER_USD}달러 ≈ ₩${upper.amountKrw.toLocaleString("ko-KR")})를 넘어 수입 형태와 무관하게 과세 대상입니다`,
      blockingAxes: [],
    };
  }

  // ③ 여기부터는 «자가사용으로 인정되는가»가 결론을 가른다. 모르면 확인 필요다.
  if (input.importMode == null) {
    return {
      exceeded: null,
      note: `구매대행(개인 자가사용)인지 사업자 정식수입인지에 따라 소액면세 적용이 갈립니다 — ${DE_MINIMIS_NOTE}`,
      blockingAxes: ["IMPORT_MODE"],
    };
  }

  // ④ 자가사용 통관 + 낮은 선(150달러) 이하 → 원산지를 몰라도 면세다.
  if (goods <= base.amountKrw) {
    return {
      exceeded: false,
      note: `${IMPORT_MODE_LABEL.PERSONAL_CLEARANCE} · 물품가격이 미화 ${DE_MINIMIS_BASE_USD}달러(≈ ₩${base.amountKrw.toLocaleString("ko-KR")}) 이하 — ${DE_MINIMIS_NOTE}`,
      blockingAxes: [],
    };
  }

  // ⑤ 150 ~ 200달러 사이. 원산지에 따라 한도가 갈린다.
  return {
    exceeded: null,
    note: `물품가격이 미화 ${DE_MINIMIS_BASE_USD}달러와 ${DE_MINIMIS_UPPER_USD}달러 사이라 원산지에 따라 소액면세 적용이 갈립니다`,
    blockingAxes: ["ORIGIN"],
  };
}

/**
 * **모든 카테고리가 쓰는 하나의 함수.** 아동의류도 골프도 여기를 지난다 —
 * 갈라지는 것은 정책이 들고 있는 세율(품목/HS 축)뿐이고, 표시 구조는 같다.
 *
 * 이 함수는 판매자 원가를 한 원도 만들지 않는다. 반환 타입 어디에도 원가·마진·
 * verdict가 없는 것이 그 장치다.
 */
export function resolveBuyerImportCharge(input: BuyerImportChargeInput): BuyerImportChargeEstimate {
  const policy = resolveCategoryCostPolicy(input.categoryProfileId);
  const notes: string[] = [];

  /* ── 여섯 축의 상태를 먼저 세운다. 판단은 그다음이다. ────────────────── */
  const destination = input.destinationCountry?.trim().toUpperCase() || null;
  const origin = input.originCountry?.trim().toUpperCase() || null;
  const axes: ImportChargeAxisState[] = [
    axis(
      "DESTINATION",
      destination,
      destination === SUPPORTED_DESTINATION
        ? "한국으로 수입하는 것을 기준으로 판단했습니다"
        : "어느 나라로 수입하는지 확인해야 세목과 세율이 정해집니다",
    ),
    axis(
      "ORIGIN",
      origin,
      origin == null
        ? "원산지를 몰라 협정세율(FTA·RCEP)은 적용하지 않고 기본세율로 판단했습니다"
        : "원산지증명서가 있으면 협정세율이 적용될 수 있습니다",
    ),
    axis(
      "ITEM_HS",
      policy.hsCode,
      policy.hsCode != null
        ? (policy.customsDutyRate?.basis ?? "품목 분류 기준")
        : "이 카테고리의 품목 분류(HS)가 확정되지 않아 관세율을 정할 수 없습니다",
    ),
    axis(
      "CUSTOMS_VALUE",
      input.customsValueKrw != null ? `₩${input.customsValueKrw.toLocaleString("ko-KR")}` : null,
      input.customsValueKrw != null
        ? "과세가격(CIF) = 물품가 + 국제운임"
        : "상품가 또는 국제배송비를 몰라 과세가격을 만들지 못했습니다",
    ),
    axis(
      "DELIVERY_TERMS",
      input.deliveryTerms ? DELIVERY_TERMS_LABEL[input.deliveryTerms] : null,
      input.deliveryTerms == null
        ? "배송 조건(DDP/DDU)이 확인되지 않았습니다 — 해외 판매처가 선납하는 조건이면 구매자가 별도로 내지 않습니다"
        : "누가 통관 때 세금을 내는지가 이 조건으로 정해집니다",
    ),
    axis(
      "IMPORT_MODE",
      input.importMode ? IMPORT_MODE_LABEL[input.importMode] : null,
      input.importMode == null
        ? "구매대행(개인 자가사용)인지 사업자 정식수입인지가 확인되지 않았습니다"
        : "소액면세 적용 여부가 이 값으로 정해집니다",
    ),
  ];

  const finish = (duty: ImportChargeLine, vat: ImportChargeLine, importTax: ImportTaxResult | null) => {
    const needsReview = duty.applicability === "NEEDS_REVIEW" || vat.applicability === "NEEDS_REVIEW";
    const totalKrw =
      duty.amountKrw != null && vat.amountKrw != null && !needsReview ? duty.amountKrw + vat.amountKrw : null;
    return {
      policyId: policy.id,
      categoryLabel: policy.label,
      axes,
      duty,
      vat,
      totalKrw,
      totalDisplay:
        totalKrw != null
          ? `예상 ₩${totalKrw.toLocaleString("ko-KR")}`
          : IMPORT_CHARGE_APPLICABILITY_LABEL.NEEDS_REVIEW,
      needsReview,
      provisionalTotalKrw: importTax?.provisionalTotalImportTaxKrw ?? null,
      notes,
      importTax,
    } satisfies BuyerImportChargeEstimate;
  };

  /* ── ① 국가. 한국이 아니면(또는 모르면) 여기서 멈춘다. ───────────────── */
  if (destination !== SUPPORTED_DESTINATION) {
    const basis = "수입국을 확인하지 못해 어떤 세목이 붙는지 판단할 수 없습니다";
    notes.push(basis);
    return finish(
      line("CUSTOMS_DUTY", "NEEDS_REVIEW", basis, { blockingAxes: ["DESTINATION"] }),
      line("IMPORT_VAT", "NEEDS_REVIEW", basis, { blockingAxes: ["DESTINATION"] }),
      null,
    );
  }

  /* ── ② 배송 조건. DDP면 구매자가 «별도로» 내는 돈이 없다. ────────────── */
  if (input.deliveryTerms === "DDP") {
    const basis = `${DELIVERY_TERMS_LABEL.DDP} — 통관 세금을 해외 판매처가 선납하므로 구매자가 별도로 부담하지 않습니다`;
    notes.push(basis);
    return finish(
      line("CUSTOMS_DUTY", "NOT_APPLICABLE", basis),
      line("IMPORT_VAT", "NOT_APPLICABLE", basis),
      null,
    );
  }
  if (input.deliveryTerms == null) {
    notes.push(
      "배송 조건(DDP/DDU) 미확인 — 아래 금액은 수취인이 통관 때 부담하는 경우를 기준으로 한 참고값입니다",
    );
  }

  /* ── ③ 수입 형태 + 과세가격 → 소액면세. 여기가 «해당/비해당»의 분기다. ── */
  const deMinimis = resolveDeMinimis(input);
  notes.push(deMinimis.note);
  if (deMinimis.exceeded === false) {
    return finish(
      line("CUSTOMS_DUTY", "NOT_APPLICABLE", deMinimis.note),
      // 관세가 면제되는 소액 수입은 수입부가세도 함께 면제된다
      // (부가가치세법 제27조 — 관세가 면제되는 재화의 수입).
      line("IMPORT_VAT", "NOT_APPLICABLE", `${deMinimis.note} · 관세가 면제되면 수입부가세도 면제됩니다`),
      null,
    );
  }
  if (deMinimis.exceeded == null) {
    return finish(
      line("CUSTOMS_DUTY", "NEEDS_REVIEW", deMinimis.note, { blockingAxes: deMinimis.blockingAxes }),
      line("IMPORT_VAT", "NEEDS_REVIEW", deMinimis.note, { blockingAxes: deMinimis.blockingAxes }),
      null,
    );
  }

  /* ── ④ 여기부터는 둘 다 «해당»이다. 남은 질문은 «얼마인가»뿐이다. ────── */
  const dutyRate: TaxRateRef | null = policy.customsDutyRate;
  const vatRate: TaxRateRef | null = policy.importVatRate;
  const sellerRate = input.sellerConfirmedDutyRatePercent;
  const dutyRateKnown = (sellerRate != null && sellerRate >= 0) || isUsableRate(dutyRate);

  if (input.customsValueKrw == null) {
    const basis = "과세가격(CIF)을 몰라 금액을 계산하지 못했습니다";
    return finish(
      line("CUSTOMS_DUTY", "APPLICABLE", `${deMinimis.note} · ${basis}`, {
        ratePercent: dutyRateKnown ? (sellerRate ?? dutyRate?.percent ?? null) : null,
        blockingAxes: ["CUSTOMS_VALUE"],
      }),
      line("IMPORT_VAT", "APPLICABLE", `${vatRate?.basis ?? "수입부가세율 확인 필요"} · ${basis}`, {
        ratePercent: isUsableRate(vatRate) ? vatRate.percent : null,
        blockingAxes: ["CUSTOMS_VALUE"],
      }),
      null,
    );
  }

  const importTax = computeImportTaxes({
    customsValueKrw: input.customsValueKrw,
    dutyRate,
    vatRate,
    sellerConfirmedDutyRatePercent: sellerRate,
  });

  if (!importTax.resolved) {
    // 🔴 세율이 확정되지 않았다. 세목은 «해당»이지만 금액은 «확인 필요»다.
    //    provisional 금액은 결과의 별도 필드로만 나가고 display에는 오지 않는다.
    notes.push(`세율 확인 필요 — ${importTax.unresolvedReason}`);
    if (importTax.provisionalNote) {
      notes.push(`참고: ${importTax.provisionalNote}(확정된 값이 아니라 금액으로 표시하지 않습니다)`);
    }
    return finish(
      line("CUSTOMS_DUTY", "APPLICABLE", dutyRate?.basis ?? "관세율 확인 필요", {
        ratePercent: importTax.appliedDutyRatePercent,
        amountKrw: importTax.customsDutyKrw,
        blockingAxes: dutyRateKnown ? [] : ["ITEM_HS"],
      }),
      line("IMPORT_VAT", "APPLICABLE", vatRate?.basis ?? "수입부가세율 확인 필요", {
        ratePercent: importTax.appliedVatRatePercent,
        amountKrw: importTax.importVatKrw,
        // 부가세 과세표준은 (과세가격 + 관세)다. 관세를 모르면 부가세도 못 낸다.
        blockingAxes: dutyRateKnown ? [] : ["ITEM_HS"],
      }),
      importTax,
    );
  }

  notes.push(
    `관세 ${importTax.appliedDutyRatePercent}% × 과세가격 ₩${input.customsValueKrw.toLocaleString("ko-KR")} · 부가가치세 ${importTax.appliedVatRatePercent}% × (과세가격 + 관세)`,
  );
  if (dutyRate?.reviewNote) notes.push(dutyRate.reviewNote);

  return finish(
    line("CUSTOMS_DUTY", "APPLICABLE", dutyRate?.basis ?? "셀러가 확인한 관세율", {
      ratePercent: importTax.appliedDutyRatePercent,
      amountKrw: importTax.customsDutyKrw,
    }),
    line("IMPORT_VAT", "APPLICABLE", vatRate?.basis ?? "수입부가세율", {
      ratePercent: importTax.appliedVatRatePercent,
      amountKrw: importTax.importVatKrw,
    }),
    importTax,
  );
}
