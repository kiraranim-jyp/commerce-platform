/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-C STEP 3(CEO 승인, 2026-09-20) — **배송비는 «숫자» 가 아니라 «숫자와 근거»다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 무엇이 문제였나 ────────────────────────────────────────────────────────
 * 지금까지 근거는 저장되지 않았고, **숫자를 보고 역추론**됐다:
 *
 *     resolveOverseasShippingBasis(shippingKrw)
 *       = shippingKrw === 12000 ? "DEFAULT" : "SELLER_INPUT"
 *
 * 그래서 실제 데이터가 이렇게 됐다(2026-09-20 실측, 저장된 239건):
 *
 *     12,000 × 210   「기본값 — 확인된 값 아님」
 *          0 ×  14   🔴 「판매자가 입력한 해외물류비」 ← 배송비 0원을 «확인했다» 고 말한다
 *     20,000 ×  10
 *     19,800 ×   5
 *
 * ₩0 이 들어간 기전까지 확인했다. 입력칸이 `Number("") === 0` 이라 **비우기만
 * 해도** 0 이 값이 되고 저장된다. 즉 판매자에게 **「모른다」를 말할 방법이
 * 없었다**, 그리고 시스템은 그 침묵을 「0원으로 확인됨」이라고 옮겨 적었다.
 *
 * ── 그래서 이 파일이 하는 일 ────────────────────────────────────────────────
 * 값과 근거를 **한 쌍으로 묶어서 돌려준다.** 숫자로 되묻지 않는다.
 *
 * 🔴 이 파일은 **금액을 정하지 않는다.** CEO 결정: 아동의류 해외물류비 기본값
 *    금액은 HOLD. `CATEGORY_DEFAULT` 는 구조만 있고 오늘은 어떤 카테고리도
 *    금액을 주지 않는다(category-cost-policy 의 overseasShippingDefaultKrw 는
 *    전부 null). 금액이 정해지면 그 표 한 곳만 채우면 된다.
 *
 * 🔴 `MI_MEASURED` 는 **일부러 없다.** 우리가 실측한 배송비는 «국내 판매처가
 *    구매자에게 청구하는 배송비» 이고, 여기서 다루는 것은 «판매자가 해외 상품을
 *    들여오는 원가» 다. 이름이 비슷하다고 이어 붙이면 지금까지 지켜 온
 *    구매자/판매자 분리가 무너진다(CEO 지시).
 */

/**
 * 이 배송비가 «왜» 그 값인가.
 *
 *   SELLER_OVERRIDE   판매자가 명시적으로 넣었다. 🔴 값이 아니라 «행위» 가 근거다.
 *   CATEGORY_DEFAULT  카테고리 정책이 준 값. 카테고리가 «선택돼 있을 때만» 성립한다.
 *   LEGACY_FALLBACK   ₩12,000. 🔴 이번에 의미를 재정의하지 «않는다» — 지금까지
 *                     쓰이던 그 자리를 그대로 이름만 붙였다(CEO: 의미 확정은 조사 후).
 *   UNKNOWN           금액이 없다. 🔴 0 이 아니다. 「모른다」는 관측이다.
 */
export type ShippingBasis = "SELLER_OVERRIDE" | "CATEGORY_DEFAULT" | "LEGACY_FALLBACK" | "UNKNOWN";

export interface ResolvedOverseasShipping {
  /** 🔴 UNKNOWN 이면 null 이다. 0 으로 내려가지 않는다. */
  amountKrw: number | null;
  basis: ShippingBasis;
  /** 화면이 그대로 쓰는 한 줄. 🔴 LEGACY_FALLBACK 은 절대 «실제 배송비» 라고 말하지 않는다. */
  label: string;
}

export const SHIPPING_BASIS_LABEL: Readonly<Record<ShippingBasis, string>> = {
  SELLER_OVERRIDE: "판매자가 입력한 해외물류비",
  CATEGORY_DEFAULT: "카테고리 기본 해외물류비 — 실제 배송비로 확인된 값이 아닙니다",
  LEGACY_FALLBACK: "기본 해외물류비 적용 — 실제 배송비로 확인된 값이 아닙니다",
  UNKNOWN: "해외물류비가 확인되지 않았습니다",
};

/** 이 근거가 「실제 배송비로 확인된 값」이라고 «주장» 하는가. 오늘은 하나뿐이다. */
export function shippingBasisIsConfirmed(basis: ShippingBasis): boolean {
  return basis === "SELLER_OVERRIDE";
}

export interface ResolveOverseasShippingInput {
  /**
   * 판매자가 «명시적으로» 넣은 금액. 입력칸을 비웠으면 `null` 을 넘긴다 —
   * 🔴 0 을 넘기지 않는다. 0 은 「무료라고 확인했다」는 뜻이고 그건 다른 사실이다.
   * 아예 손대지 않았으면 `undefined`.
   */
  sellerEnteredKrw?: number | null;
  /**
   * 카테고리 정책이 주는 기본 금액. 🔴 오늘은 모든 카테고리가 null 이다(금액 HOLD).
   * 카테고리가 «선택되지 않았으면» 호출부가 애초에 null 을 넘긴다 — 미선택
   * 상품에 카테고리 기본값을 자동 적용하지 않는다(CEO 지시).
   */
  categoryDefaultKrw?: number | null;
  /**
   * 기존 ₩12,000 이 적용되던 자리인가. 🔴 이 값의 «의미» 는 이번에 바꾸지 않는다.
   * 호출부가 지금까지와 똑같은 조건에서 true 를 넘기면 결과 숫자는 그대로다.
   */
  legacyFallbackKrw?: number | null;
}

/**
 * 🔴 순서가 곧 정책이다. 위에서 정해지면 아래는 보지 않는다.
 *
 *     판매자가 명시적으로 넣었다        → SELLER_OVERRIDE
 *     카테고리가 금액을 준다            → CATEGORY_DEFAULT
 *     기존 기본값 자리다                → LEGACY_FALLBACK
 *     그 외                             → UNKNOWN (금액 null)
 *
 * 판매자가 입력칸을 «비운» 경우(`sellerEnteredKrw === null`)는 아래로 흘려보내지
 * 않고 곧장 UNKNOWN 이다. 비운 것은 「모른다」는 «의사표시» 이므로, 그 위에
 * 기본값을 덮어씌우면 판매자가 지운 값이 되살아난다.
 */
export function resolveOverseasShipping(input: ResolveOverseasShippingInput): ResolvedOverseasShipping {
  const withBasis = (amountKrw: number | null, basis: ShippingBasis): ResolvedOverseasShipping => ({
    amountKrw,
    basis,
    label: SHIPPING_BASIS_LABEL[basis],
  });

  if (input.sellerEnteredKrw != null) return withBasis(input.sellerEnteredKrw, "SELLER_OVERRIDE");
  // 🔴 비운 것과 손대지 않은 것을 가른다. null 은 「모른다」, undefined 는 「아직 안 봤다」.
  if (input.sellerEnteredKrw === null) return withBasis(null, "UNKNOWN");
  if (input.categoryDefaultKrw != null) return withBasis(input.categoryDefaultKrw, "CATEGORY_DEFAULT");
  if (input.legacyFallbackKrw != null) return withBasis(input.legacyFallbackKrw, "LEGACY_FALLBACK");
  return withBasis(null, "UNKNOWN");
}
