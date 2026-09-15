/**
 * PRICING-BASIS-1(파일럿에서 확정된 결함, CEO가 GOLF-01에 흡수 지시 2026-09-15) —
 * **기준이 다른 두 숫자를 나란히 놓으면 매번 우리가 유리해 보인다.**
 *
 * ── 실측 ─────────────────────────────────────────────────────────────────
 *   우리 화면 가격   세전. MI-COST-POLICY-1이 "관부가세는 구매자 부담"으로
 *                    판매자 원가에서 뺐기 때문이다.
 *   다나와 최저가    세후. 소비자가 카드로 실제로 긁는 금액이다.
 *
 * 부가세 10%만 해도 세후가 세전보다 약 18.8% 높게 나온다(관세까지 얹히면 더).
 * 두 숫자를 같은 크기로 나란히 놓고 빼면, 존재하지 않는 마진이 매번 그만큼
 * 생긴다. 이건 표시 실수가 아니라 **구조적 오판**이다 — 어떤 상품을 넣어도 한
 * 방향으로만 틀린다.
 *
 * ── 이 파일이 하는 일 ────────────────────────────────────────────────────
 * 숫자에 "이 값은 어느 세금 기준인가"를 타입으로 붙이고, 기준이 다른 두 값의
 * 뺄셈을 **구조적으로 막는다**. 화면에 경고 문구를 다는 방식은 이미 실패했다 —
 * 문구는 다음 사람이 다른 자리에 같은 뺄셈을 쓸 때 따라오지 않는다.
 *
 * 이 파일은 아무것도 계산하지 않는다(환산·마진·판정 산식 전부 그대로다).
 * 두 값을 빼도 되는지만 답한다.
 */

/**
 * 이 금액이 어느 세금 기준인가.
 *
 *   TAX_INCLUDED  소비자가 실제로 결제하는 금액(부가세 포함). 국내 시장가·
 *                 다나와 최저가·편집샵 판매가가 전부 여기다.
 *   TAX_EXCLUDED  세금이 아직 얹히지 않은 금액. 해외 판매처 가격, 그리고
 *                 MI-COST-POLICY-1 정책 아래의 착지원가가 여기다.
 *   LANDED_TAXED  한국 도착 기준 — 관세·수입부가세까지 치른 원가.
 *                 TAX_INCLUDED와 **비교 가능한** 유일한 원가 기준이다.
 *   UNKNOWN       기준을 모른다. 모르는 것을 아는 것처럼 쓰지 않는다.
 */
export type PriceTaxBasis = "TAX_INCLUDED" | "TAX_EXCLUDED" | "LANDED_TAXED" | "UNKNOWN";

/** 화면에 그대로 쓰는 말. 같은 문자열이 두 기준에 붙으면 안 된다. */
export const PRICE_TAX_BASIS_LABEL: Record<PriceTaxBasis, string> = {
  TAX_INCLUDED: "소비자 결제 기준 · 세금 포함",
  TAX_EXCLUDED: "세금 별도 · 관세·수입부가세는 구매자 부담",
  LANDED_TAXED: "한국 도착 기준 · 관세·수입부가세 포함",
  UNKNOWN: "세금 기준 미확인",
};

export interface BasisTaggedPrice {
  amountKrw: number | null;
  basis: PriceTaxBasis;
  /** 이 값이 무엇인지 사람이 읽는 한 줄("국내 시장가격" 등). */
  label: string;
}

/**
 * 두 값을 빼도 되는가.
 *
 *   comparable=true   같은 기준이거나(둘 다 세후) 서로 맞물리는 기준이다.
 *   comparable=false  빼면 안 된다. gapKrw는 null이고, reason이 왜인지 말한다.
 *
 * LANDED_TAXED ↔ TAX_INCLUDED 를 비교 가능으로 두는 것이 이 함수의 핵심이다.
 * "한국에 도착해서 세금까지 치른 내 원가"와 "한국 소비자가 내는 값"은 같은
 * 지점을 재는 두 숫자다. 반대로 TAX_EXCLUDED ↔ TAX_INCLUDED 는 절대 아니다 —
 * 그 뺄셈이 PRICING-BASIS-1이 잡아낸 바로 그 오판이다.
 */
export interface PriceBasisComparison {
  comparable: boolean;
  /** comparable일 때만 값이 있다. 아니면 null 이다 — 숫자를 내보내지 않는다. */
  gapKrw: number | null;
  /** 화면에 그대로 쓰는 한 줄. comparable이어도 무엇끼리의 차이인지 밝힌다. */
  reason: string;
}

export function comparePriceBasis(
  domestic: BasisTaggedPrice,
  overseas: BasisTaggedPrice,
): PriceBasisComparison {
  if (domestic.amountKrw == null || overseas.amountKrw == null) {
    return {
      comparable: false,
      gapKrw: null,
      reason: "두 값 중 하나가 아직 확인되지 않아 비교할 수 없습니다",
    };
  }
  if (domestic.basis === "UNKNOWN" || overseas.basis === "UNKNOWN") {
    return {
      comparable: false,
      gapKrw: null,
      reason: "세금 기준을 확인하지 못한 값이 있어 그대로 빼면 안 됩니다",
    };
  }
  const bothTaxed =
    (domestic.basis === "TAX_INCLUDED" || domestic.basis === "LANDED_TAXED") &&
    (overseas.basis === "TAX_INCLUDED" || overseas.basis === "LANDED_TAXED");
  if (!bothTaxed) {
    return {
      comparable: false,
      gapKrw: null,
      // 문구가 "표시 주의"가 아니라 **사실**이어야 한다. 셀러가 이 줄을 읽고
      // 스스로 암산하는 것까지 막을 수는 없지만, 우리가 그 뺄셈의 결과를
      // 숫자로 내놓지는 않는다.
      reason: `${domestic.label}(${PRICE_TAX_BASIS_LABEL[domestic.basis]})와 ${overseas.label}(${PRICE_TAX_BASIS_LABEL[overseas.basis]})는 세금 기준이 달라 그대로 뺄 수 없습니다`,
    };
  }
  return {
    comparable: true,
    gapKrw: domestic.amountKrw - overseas.amountKrw,
    reason: `${domestic.label}(${PRICE_TAX_BASIS_LABEL[domestic.basis]}) − ${overseas.label}(${PRICE_TAX_BASIS_LABEL[overseas.basis]})`,
  };
}
