import { convertToKrwStrict } from "./currency";
import { computeImportTaxes, type ImportTaxResult } from "./import-tax";
import { resolveCategoryCostPolicy, type CategoryCostPolicy } from "./category-cost-policy";
import {
  estimateEmsJapanToKorea,
  resolveChargeableWeight,
  type ChargeableWeight,
  type EmsEstimate,
  type PackageDimensionsCm,
} from "./parcel-weight";
import type { PriceComponent } from "./unified-price-decision";

/**
 * GOLF-01 축B(CEO 지시, 2026-09-15) — CEO가 수용하라고 한 구조 그대로:
 *
 *   상품가 + 국제배송비 + 관세 + 수입부가세 + 기타 비용
 *   배송 계산용:  실중량 · 가로 · 세로 · 높이 · 용적중량
 *
 * ── 이 파일은 새 가격 엔진이 아니다 ──────────────────────────────────────
 * 계산은 전부 기존 조각을 **부르기만** 한다: 환산은 convertToKrwStrict,
 * 중량은 parcel-weight, 세금은 import-tax, 원가 합산·마진·판정은 그대로
 * computeUnifiedPriceDecision이다. 이 파일이 하는 일은 그 조각들을 **순서대로
 * 잇고**, 결과를 computeUnifiedPriceDecision이 이미 받는 PriceComponent 모양으로
 * 바꿔 주는 것뿐이다.
 *
 * 그래서 반환값에 마진도 판정도 없다. 있으면 언젠가 두 번째 판정 엔진이 된다 —
 * 이 저장소가 P-1-3에서 한 번 겪은 사고다.
 *
 * ── 모르면 멈춘다 ────────────────────────────────────────────────────────
 * 치수·중량이 없으면 배송비가 null이고, 관세율이 확정되지 않았으면 세금이
 * null이다. null은 computeUnifiedPriceDecision에서 status="unknown"이 되어
 * dataCompleteness="INCOMPLETE" → 🟠 "비용 확인 필요"로 흐른다. 값을 지어내서
 * 🟢을 내지 않는다.
 */
export interface GolfLandedCostInput {
  /** 해외 판매처 가격(원본 통화 그대로). 환산은 이 함수가 한 번만 한다. */
  sourcePriceAmount: number;
  sourcePriceCurrency: string;
  /** 실측 환율표(/api/exchange-rates). 없으면 FIXED_RATES_TO_KRW 폴백이다. */
  liveRates?: Record<string, number>;
  /** 박스 실중량(kg). 모르면 생략한다 — 0을 넣지 않는다. */
  actualWeightKg?: number | null;
  /** 박스 가로·세로·높이(cm). 모르면 생략한다. */
  dimensionsCm?: PackageDimensionsCm | null;
  /**
   * 셀러가 아는 실제 국제배송비(KRW). 있으면 EMS 추정보다 **우선한다** —
   * 실제로 치른 돈이 우리 추정표보다 정확하다.
   */
  knownInternationalShippingKrw?: number | null;
  /** 셀러가 관세사/통관 실적으로 확인한 관세율(%). 있으면 조사값보다 우선한다. */
  sellerConfirmedDutyRatePercent?: number | null;
  /** CATEGORY_PROFILES의 id. 기본 "GOLF". */
  categoryProfileId?: string;
}

export interface GolfLandedCostBreakdown {
  policy: CategoryCostPolicy;
  /** 환율을 모르는 통화면 null이다 — 금액 그대로 KRW로 취급하지 않는다. */
  productCostKrw: number | null;
  weight: ChargeableWeight;
  /** EMS 추정. 셀러가 실제 배송비를 넘겼거나 중량을 모르면 null. */
  emsEstimate: EmsEstimate | null;
  internationalShippingKrw: number | null;
  /** 국제배송비가 실측인지 추정인지. */
  shippingStatus: "actual" | "estimated" | "unknown";
  /** 과세가격(CIF) = 상품가 + 국제운임. 둘 중 하나라도 없으면 null. */
  customsValueKrw: number | null;
  importTax: ImportTaxResult | null;
  /**
   * 그대로 computeUnifiedPriceDecision(...)에 펼쳐 넣을 수 있는 조각.
   * 호출부가 PriceComponent를 손으로 만들면 status 규칙이 두 곳에 생긴다.
   */
  components: {
    sourceProductPriceKrw: PriceComponent;
    internationalShippingKrw: PriceComponent;
    customsDutyKrw: PriceComponent;
    customsVatKrw: PriceComponent;
  };
  /** 화면에 그대로 쓰는 "왜 이 숫자인가" 줄들. 순서가 곧 계산 순서다. */
  notes: string[];
}

export function computeGolfLandedCost(input: GolfLandedCostInput): GolfLandedCostBreakdown {
  const policy = resolveCategoryCostPolicy(input.categoryProfileId ?? "GOLF");
  const notes: string[] = [];

  // ① 상품가 환산. 환율을 모르는 통화는 null 이다(convertToKrwStrict의 규칙 그대로).
  const converted = convertToKrwStrict(input.sourcePriceAmount, input.sourcePriceCurrency, input.liveRates);
  const productCostKrw = converted?.amountKrw ?? null;
  if (converted == null) {
    notes.push(`${input.sourcePriceCurrency} 환율을 알 수 없어 원화로 환산하지 못했습니다`);
  }

  // ② 과금중량 — 실중량과 용적중량 중 큰 쪽. 골프채는 거의 언제나 용적이 이긴다.
  const weight = resolveChargeableWeight({
    actualWeightKg: input.actualWeightKg,
    dimensionsCm: input.dimensionsCm,
    volumetricDivisor: policy.volumetricDivisor ?? undefined,
  });
  notes.push(weight.note);

  // ③ 국제배송비. 셀러가 아는 실비 > EMS 구간 추정 > 모름.
  let internationalShippingKrw: number | null = null;
  let shippingStatus: "actual" | "estimated" | "unknown" = "unknown";
  let emsEstimate: EmsEstimate | null = null;
  if (input.knownInternationalShippingKrw != null && input.knownInternationalShippingKrw >= 0) {
    internationalShippingKrw = input.knownInternationalShippingKrw;
    shippingStatus = "actual";
    notes.push(`국제배송비는 판매자가 입력한 실제 금액입니다`);
  } else if (policy.weightBasedShipping) {
    emsEstimate = estimateEmsJapanToKorea(weight.chargeableWeightKg, input.liveRates);
    if (emsEstimate) {
      internationalShippingKrw = emsEstimate.krw;
      shippingStatus = "estimated";
      notes.push(emsEstimate.note);
    } else if (weight.chargeableWeightKg != null) {
      // 표 범위 밖(10kg 초과). 비례식으로 늘려 만들지 않는다.
      notes.push(
        `과금중량 ${weight.chargeableWeightKg}kg은 확인된 EMS 요금표(최대 10kg) 범위를 넘어 배송비를 계산하지 못했습니다`,
      );
    }
  }

  // ④ 과세가격(CIF) = 상품가 + 국제운임. 한쪽이라도 없으면 세금을 계산할 수 없다.
  const customsValueKrw =
    productCostKrw != null && internationalShippingKrw != null ? productCostKrw + internationalShippingKrw : null;

  // ⑤ 관세 → 수입부가세. 정책이 관부가세를 원가로 보지 않으면 아예 계산하지 않는다.
  let importTax: ImportTaxResult | null = null;
  if (policy.importTaxesInLandedCost && customsValueKrw != null) {
    importTax = computeImportTaxes({
      customsValueKrw,
      dutyRate: policy.customsDutyRate,
      vatRate: policy.importVatRate,
      sellerConfirmedDutyRatePercent: input.sellerConfirmedDutyRatePercent,
    });
    if (importTax.resolved) {
      notes.push(
        `관세 ${importTax.appliedDutyRatePercent}%(과세가격 ₩${customsValueKrw.toLocaleString("ko-KR")} 기준) + 수입부가세 ${importTax.appliedVatRatePercent}%(과세가격+관세 기준)`,
      );
    } else {
      notes.push(`관세·수입부가세 확인 필요 — ${importTax.unresolvedReason}`);
      if (importTax.provisionalNote) notes.push(`참고: ${importTax.provisionalNote}(계산에는 넣지 않았습니다)`);
    }
  } else if (policy.importTaxesInLandedCost) {
    notes.push("상품가 또는 국제배송비를 몰라 과세가격을 만들 수 없어 세금을 계산하지 못했습니다");
  }

  const component = (value: number | null, status: PriceComponent["status"], source: string): PriceComponent =>
    value == null ? { value: null, status: "unknown", source } : { value, status, source };

  return {
    policy,
    productCostKrw,
    weight,
    emsEstimate,
    internationalShippingKrw,
    shippingStatus,
    customsValueKrw,
    importTax,
    components: {
      sourceProductPriceKrw: component(
        productCostKrw,
        converted?.isEstimate ? "estimated" : "actual",
        "source_price × exchange_rate",
      ),
      internationalShippingKrw: component(
        internationalShippingKrw,
        shippingStatus === "actual" ? "actual" : "estimated",
        emsEstimate ? `EMS ${emsEstimate.bracketUptoKg}kg 구간` : "seller_input",
      ),
      // 🔴 확정되지 않은 세율의 provisional 금액은 여기로 오지 않는다. 오는 것은
      //    importTax.customsDutyKrw(확정 세율로만 채워지는 값)뿐이다.
      customsDutyKrw: component(
        importTax?.customsDutyKrw ?? null,
        input.sellerConfirmedDutyRatePercent != null ? "actual" : "estimated",
        policy.customsDutyRate?.basis ?? "관세율 확인 필요",
      ),
      customsVatKrw: component(
        importTax?.importVatKrw ?? null,
        "estimated",
        policy.importVatRate?.basis ?? "수입부가세율 확인 필요",
      ),
    },
    notes,
  };
}
