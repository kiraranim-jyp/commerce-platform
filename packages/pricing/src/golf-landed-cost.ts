import { convertToKrwStrict } from "./currency";
import {
  resolveBuyerImportCharge,
  type BuyerImportChargeEstimate,
  type DeliveryTerms,
  type ImportMode,
} from "./buyer-import-charge";
import { resolveCategoryCostPolicy, type CategoryCostPolicy } from "./category-cost-policy";
import {
  estimateEmsJapanToKorea,
  hasConfirmedWeightBasedShippingRates,
  normalizeOriginCountry,
  resolveChargeableWeight,
  type ChargeableWeight,
  type EmsEstimate,
  type PackageDimensionsCm,
} from "./parcel-weight";
import type { PriceComponent } from "./unified-price-decision";

/**
 * GOLF-01-TAX(CEO 최종 결정, 2026-09-15) — CEO가 수용하라고 한 구조 그대로:
 *
 *   상품가 + 국제배송비 + 기타 판매자 비용   → 판매자 원가
 *   [별도 참고] 관세 · 부가가치세            → 구매자 부담 예상액
 *   배송 계산용:  실중량 · 가로 · 세로 · 높이 · 용적중량
 *
 * ── 🔴 직전 방향에서 무엇이 바뀌었나 ─────────────────────────────────────
 * d72575f는 관세·부가세를 components에 넣어 착지원가로 흘려보냈다. 지금은
 * 그 두 칸이 **components에 없다**. 세금은 buyerImportCharge라는 별도 필드로만
 * 나가고, 그 필드는 computeUnifiedPriceDecision이 받지 않는 모양이다 —
 * 실수로도 원가에 이어 붙일 수 없다.
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
 * 치수·중량이 없으면 배송비가 null이고, null은 computeUnifiedPriceDecision에서
 * status="unknown"이 되어 dataCompleteness="INCOMPLETE" → 🟠 "비용 확인 필요"로
 * 흐른다. 값을 지어내서 🟢을 내지 않는다.
 *
 * 세금 쪽은 흐르는 곳이 다르다. 관세율이나 해당 여부가 확정되지 않으면
 * buyerImportCharge가 «확인 필요»를 들고 나가고, 그 사실은 **판매자 원가의
 * 완전성에 영향을 주지 않는다** — 판매자가 치르지 않는 돈을 몰라서 셀러의
 * 판정을 🟠으로 내리면, 그건 관부가세를 원가로 세던 시절로 돌아가는 것과 같다.
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
  /**
   * 🔴 GOLF-04 STEP 1 — **두 곳이 이 값을 읽는다.**
   *   ① 구매자 부담 참고정보의 판단 축(buyer-import-charge.ts)
   *   ② **국제배송비를 계산해도 되는가** — 우리가 가진 중량기반 요금표는
   *      일본발 하나뿐이라(EMS_RATE_TABLE_ORIGIN_COUNTRY), 출발국이 일본이
   *      아니거나 미상이면 배송비는 «확인 필요»로 남는다.
   *
   * 모르면 넘기지 않는다 — 그 축이 «확인 필요»로 남는 것이 정확한 상태다.
   * 넘기지 않았다고 일본으로 가정하지 않는다.
   */
  originCountry?: string | null;
  deliveryTerms?: DeliveryTerms | null;
  importMode?: ImportMode | null;
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
  /**
   * 🔴 **판매자 원가가 아니다.** 구매자가 통관 때 따로 부담하는 금액의
   * 참고정보다(buyer-import-charge.ts). 아래 components와 **다른 필드**인 것이
   * 이 값이 원가로 새지 못하게 하는 구조다.
   */
  buyerImportCharge: BuyerImportChargeEstimate;
  /**
   * 그대로 computeUnifiedPriceDecision(...)에 펼쳐 넣을 수 있는 조각.
   * 호출부가 PriceComponent를 손으로 만들면 status 규칙이 두 곳에 생긴다.
   *
   * 🔴 여기 두 칸뿐이다. 관세·부가세 칸은 GOLF-01-TAX에서 사라졌다.
   */
  components: {
    sourceProductPriceKrw: PriceComponent;
    internationalShippingKrw: PriceComponent;
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

  // ③ 국제배송비. 셀러가 아는 실비 > (출발국이 일본일 때만) EMS 구간 추정 > 모름.
  //
  // 🔴 GOLF-04 STEP 1 — 여기에 «출발국» 문이 하나 생겼다. 예전에는
  // policy.weightBasedShipping 만 보고 estimateEmsJapanToKorea 를 불렀고, 그
  // 함수는 이름 그대로 **일본→한국** 요금표 하나뿐이다. 그래서 Vice(US) ·
  // Titleist(NZ) · Mizuno(DE) 가격을 넣으면 일본 요금이 조용히 붙었다
  // (실측: US 상품에 ₩31,280 이 붙었다 — golf04-shipping-origin-gate.test.ts).
  //
  // 출발국을 «모르는» 경우도 계산하지 않는다. 통화가 JPY 라고 출발국이 일본인
  // 것은 아니고(일본 상품을 파는 배대지·병행수입 판매처가 있다), 모르는 것을
  // 일본으로 가정하는 순간 이 버그가 기본값으로 되돌아온다.
  const originCountry = normalizeOriginCountry(input.originCountry);
  let internationalShippingKrw: number | null = null;
  let shippingStatus: "actual" | "estimated" | "unknown" = "unknown";
  let emsEstimate: EmsEstimate | null = null;
  if (input.knownInternationalShippingKrw != null && input.knownInternationalShippingKrw >= 0) {
    // 셀러가 실제로 치른 금액은 출발국·배송경로와 무관하게 언제나 우선한다.
    // 배대지(포워딩) 경로의 «현지 판매처→배대지 + 배대지→한국» 합계도 이 문으로
    // 들어온다 — 그래서 배대지를 위한 새 계산기가 필요하지 않다.
    internationalShippingKrw = input.knownInternationalShippingKrw;
    shippingStatus = "actual";
    notes.push(`국제배송비는 판매자가 입력한 실제 금액입니다`);
  } else if (policy.weightBasedShipping && !hasConfirmedWeightBasedShippingRates(originCountry)) {
    // 🔴 임의의 배송비를 붙이지 않는다. null 이 그대로 «비용 확인 필요» 로 흐른다.
    notes.push(
      originCountry == null
        ? "출발국이 확인되지 않아 국제배송비를 계산하지 못했습니다 — 어느 나라 요금표를 적용할지 정할 수 없습니다"
        : `출발국 ${originCountry}→한국 국제배송비 요금표를 확인하지 못해 계산하지 못했습니다 — 다른 나라 요금을 대신 적용하지 않습니다`,
    );
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

  // ⑤ 여기서 판매자 원가는 **끝났다.** 아래는 전부 «구매자 부담» 참고정보다.
  //    함수 안에서 순서가 이어지지만 값은 이어지지 않는다 — buyerImportCharge의
  //    어떤 숫자도 위 components로 돌아가지 않는다.
  const buyerImportCharge = resolveBuyerImportCharge({
    categoryProfileId: policy.id,
    // 이 제품이 답하는 질문은 언제나 "한국에서 팔 만한가"다(KR_TARGET_MARKET).
    destinationCountry: "KR",
    originCountry: input.originCountry,
    customsValueKrw,
    // 🔴 소액면세 한도는 CIF가 아니라 **물품가격**으로 잰다(관세법 시행규칙 제45조).
    goodsValueKrw: productCostKrw,
    deliveryTerms: input.deliveryTerms,
    importMode: input.importMode,
    liveRates: input.liveRates,
    sellerConfirmedDutyRatePercent: input.sellerConfirmedDutyRatePercent,
  });

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
    buyerImportCharge,
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
    },
    notes,
  };
}
