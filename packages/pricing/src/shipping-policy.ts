/**
 * ════════════════════════════════════════════════════════════════════════════
 * DOMESTIC-SHIPPING-02 1단계(CEO 지시, 2026-09-16)
 * 「배송비를 모른다」와 「배송비가 무료다」를 영원히 못 섞게 만드는 어휘
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 이 파일은 «계산하지 않는다». 배송비를 국내 가격에 더하지도, 최저가 판정에
 * 참여하지도 않는다(그건 2단계·3단계다). 여기서 하는 일은 딱 하나다 —
 * price_observations.shipping_policy_status 다섯 값의 «의미»를 한 곳에 박고,
 * 금액을 채울 자격이 있는 상태와 없는 상태를 코드가 강제하게 하는 것.
 *
 * ── 왜 «상태»가 따로 필요한가 ───────────────────────────────────────────────
 * shipping_cost_amount 는 027부터 있었다. 숫자 한 칸이다. 그 한 칸으로는
 * 다음 다섯 가지 중 «확인된 무료(0)» 하나만 표현할 수 있고 나머지는 전부
 * null 로 뭉개진다:
 *
 *   ① 아직 읽어보지 않았다        ② 읽었지만 못 찾았다
 *   ③ 상품 페이지에 없는 값이다   ④ 확인된 무료다      ⑤ 조건부 무료다
 *
 * null 하나가 ①②③⑤ 를 모두 뜻하게 되면, 그 null 을 «0» 으로 메우고 싶은
 * 유혹이 반드시 생긴다 — 45885bf(GOLF-04B)가 잡아낸 `domesticRetailShippingKrw
 * ?? 0` 이 정확히 그것이었다. 던롭 공식몰의 「고객직접선택」은 파서가 못 읽은
 * 값(②)이 아니라 주문 단계에서 정해지는 값(③)인데, 그 둘을 구분해 적을 칸이
 * 없으니 0 으로 메워졌고 ₩59,000 이 소비자 실결제액인 것처럼 계산에 들어갔다.
 *
 * 그래서 어휘를 나눈다. 나누고 나면 `?? 0` 을 쓸 자리가 사라진다.
 */

/**
 * 🔴 마이그레이션 054 의 CHECK 제약과 «글자 그대로» 같은 다섯 개다.
 * 한쪽만 늘어나면 domestic-shipping-02.test.ts 가 054 SQL 파일을 직접 읽어
 * 비교해서 깨진다 — 어휘가 두 세계에서 갈라지는 것을 막는 유일한 장치다.
 *
 * null 은 이 배열에 «없다». null 은 상태가 아니라 "상태 데이터가 없음"이고,
 * 그것이 UNREAD 와 구분되어야 하는 이유는 아래 STATUS_MEANINGS 주석에 있다.
 */
export const SHIPPING_POLICY_STATUSES = [
  "FREE",
  "FLAT",
  "CONDITIONAL_FREE",
  "ORDER_TIME",
  "UNREAD",
] as const;

export type ShippingPolicyStatus = (typeof SHIPPING_POLICY_STATUSES)[number];

/**
 * 금액 칸(shipping_cost_amount)을 이 상태가 어떻게 다뤄야 하는가.
 *
 *   "REQUIRED_ZERO"      0 이어야 한다. FREE 는 «0원이라는 주장» 그 자체다.
 *   "REQUIRED_POSITIVE"  양수여야 한다. 숫자 없는 FLAT 은 FLAT 이 아니라 UNREAD 다.
 *   "MUST_BE_NULL"       반드시 null. 숫자를 넣는 순간 없는 사실이 생긴다.
 */
export type ShippingPolicyAmountRule = "REQUIRED_ZERO" | "REQUIRED_POSITIVE" | "MUST_BE_NULL";

export interface ShippingPolicyMeaning {
  status: ShippingPolicyStatus;
  /** 사람이 읽는 한 줄. 3단계(화면)가 이 문구를 쓸 수 있지만, 이번엔 화면을 바꾸지 않는다. */
  summary: string;
  amountRule: ShippingPolicyAmountRule;
  /**
   * 🔴 「모른다」와 「안다」를 가르는 축 — 판매처의 배송비 정책을 실제로
   * «확인했는가».
   *
   * 이 칸은 처음에 없었고, 없으니 CONDITIONAL_FREE 와 UNREAD 가 나머지 세
   * 축에서 완전히 같은 값이 됐다(둘 다 MUST_BE_NULL · 페이지에서 알 수 있음 ·
   * 무료 주장 안 함). 즉 «조건부 무료라고 확인한 행»과 «못 찾은 행»을 시스템이
   * 구분하지 못했다 — 칸만 다섯 개인 상태다. domestic-shipping-02.test.ts 의
   * 지문 유일성 테스트가 그 사실을 먼저 깨서 이 축이 생겼다.
   *
   *   true  = 확인했다. 확인 결과가 숫자가 아닐 수는 있어도(CONDITIONAL_FREE ·
   *           ORDER_TIME) 「확인했다」는 사실 자체는 관측이다.
   *   false = 확인하지 못했다(UNREAD, 그리고 상태 자체가 없는 null).
   */
  policyConfirmed: boolean;
  /**
   * 🔴 UNREAD 와 ORDER_TIME 을 가르는 축. 둘 다 amount = null 이지만 «다음에
   * 해야 할 일»이 정반대다.
   *   true  = 상품 페이지에 값이 있다. 우리 파서를 «고치면 알 수 있다».
   *   false = 상품 페이지에 값 자체가 없다. 파서를 «고쳐도 안 나온다».
   * 이 칸이 없으면 운영이 ORDER_TIME 을 붙잡고 파서를 영원히 고치려 든다.
   */
  knowableFromProductPage: boolean;
  /**
   * 🔴 이 상태가 «배송비가 0원이다» 라고 «주장»하는가. 정확히 FREE 하나뿐이다.
   * "모른다"가 "무료다"로 승격되는 모든 경로는 결국 이 플래그가 true 가 되는
   * 것으로 나타난다 — 그래서 별도 칸으로 둔다.
   */
  assertsFreeShipping: boolean;
}

/**
 * 다섯 상태의 «의미»가 코드에 박히는 곳. 다른 곳에서 문자열을 비교해 분기하지
 * 말고 이 표를 읽는다 — 상태가 늘거나 의미가 바뀌면 여기 한 곳만 바뀐다.
 *
 * 🔴 다섯 행의 (amountRule, policyConfirmed, knowableFromProductPage,
 *    assertsFreeShipping) 조합은 서로 «전부 다르다». 두 상태가 같은 조합을 갖게
 *    되는 순간, 그 둘은 시스템이 구분하지 못하는 같은 값이 된 것이다 — 칸만
 *    다섯 개인 상태다. domestic-shipping-02.test.ts 가 그 유일성을 지킨다.
 */
export const SHIPPING_POLICY_MEANINGS: Readonly<Record<ShippingPolicyStatus, ShippingPolicyMeaning>> = {
  /** 확인된 무료배송. 0원이라는 «사실»을 적는 유일한 상태다. */
  FREE: {
    status: "FREE",
    summary: "무료배송으로 확인됨",
    amountRule: "REQUIRED_ZERO",
    policyConfirmed: true,
    knowableFromProductPage: true,
    assertsFreeShipping: true,
  },
  /** 확인된 고정 배송비. 숫자가 반드시 있다 — 없으면 확인한 것이 아니다. */
  FLAT: {
    status: "FLAT",
    summary: "고정 배송비로 확인됨",
    amountRule: "REQUIRED_POSITIVE",
    policyConfirmed: true,
    knowableFromProductPage: true,
    assertsFreeShipping: false,
  },
  /**
   * 조건부 무료("5만원 이상 무료" 등). 🔴 금액 칸에 숫자를 넣지 않는다 —
   * 조건을 숫자 한 칸에 욱여넣으면 그 숫자가 «이 상품의 배송비»로 읽힌다.
   * 조건 원문은 note 에 판매처 원문 그대로 남긴다(해석하지 않는다).
   * 별도 free_threshold 테이블도 만들지 않는다(CEO 명시 — 실측 1건으로
   * 스키마를 만들지 않는다).
   */
  CONDITIONAL_FREE: {
    status: "CONDITIONAL_FREE",
    summary: "조건부 무료배송(조건 원문은 note 참조)",
    amountRule: "MUST_BE_NULL",
    // 조건을 «확인했다». 숫자로 줄일 수 없을 뿐이다 — UNREAD 와 갈라지는 지점.
    policyConfirmed: true,
    knowableFromProductPage: true,
    assertsFreeShipping: false,
  },
  /**
   * 상품 페이지에 배송비가 아예 없고 주문 단계에서 정해진다(던롭 공식몰
   * 「고객직접선택」 — GOLF-04B 실측). 🔴 파서를 고쳐도 안 나온다.
   */
  ORDER_TIME: {
    status: "ORDER_TIME",
    summary: "주문 단계에서 결정됨(상품 페이지에 없음)",
    amountRule: "MUST_BE_NULL",
    // 「주문 단계에서 정해진다」는 것 자체가 확인된 사실이다.
    policyConfirmed: true,
    knowableFromProductPage: false,
    assertsFreeShipping: false,
  },
  /**
   * 페이지는 읽었는데 배송비 정책을 찾지 못했다. 🔴 파서를 고치면 알 수 있다.
   * ORDER_TIME 과 달리 «우리 쪽 결함»이라는 주장이다.
   */
  UNREAD: {
    status: "UNREAD",
    summary: "읽었으나 배송비 정책을 확인하지 못함",
    amountRule: "MUST_BE_NULL",
    // 🔴 확인하지 못했다. 이 한 칸이 CONDITIONAL_FREE 와 UNREAD 를 가른다.
    policyConfirmed: false,
    knowableFromProductPage: true,
    assertsFreeShipping: false,
  },
};

/**
 * 상태 자체가 «없는» 경우(null)를 다섯 상태와 같은 모양으로 설명한다.
 *
 * 🔴 왜 null 이 UNREAD 가 아닌가 — UNREAD 는 "읽어봤다"는 «주장»이다. 054 이전에
 *    쌓인 행들에 대해 우리는 그 주장을 할 근거가 없다(그때는 배송비 정책을
 *    보러 간 적조차 없다). null 을 UNREAD 로 backfill 하면 없는 관측을
 *    지어내는 것이고, 동시에 "고치면 알 수 있다"는 잘못된 작업 지시가 된다.
 *    그래서 054 는 DEFAULT 도 backfill 도 두지 않았고, 이 함수는 null 을
 *    끝까지 null 로 취급한다.
 */
export interface ShippingPolicyDescription {
  /** false 면 status 컬럼에 아무 값도 없다(054 이전 행 등). */
  hasStatusData: boolean;
  status: ShippingPolicyStatus | null;
  summary: string;
  amountRule: ShippingPolicyAmountRule;
  policyConfirmed: boolean;
  knowableFromProductPage: boolean;
  assertsFreeShipping: boolean;
}

export const NO_SHIPPING_POLICY_DATA_SUMMARY = "배송비 정책 데이터 없음";

export function describeShippingPolicy(status: ShippingPolicyStatus | null | undefined): ShippingPolicyDescription {
  if (status == null) {
    return {
      hasStatusData: false,
      status: null,
      summary: NO_SHIPPING_POLICY_DATA_SUMMARY,
      // 상태를 모르면 금액도 적을 자격이 없다. 숫자만 덩그러니 있는 행은
      // 그 숫자가 무엇을 뜻하는지 아무도 말할 수 없는 행이다.
      amountRule: "MUST_BE_NULL",
      // 🔴 확인한 적이 없다. UNREAD(읽어봤지만 못 찾음)와 같은 false 지만,
      //    hasStatusData 가 둘을 가른다.
      policyConfirmed: false,
      // 🔴 "확인하면 알 수 있다"는 주장도 하지 않는다 — 확인하러 간 적이 없다.
      knowableFromProductPage: false,
      assertsFreeShipping: false,
    };
  }
  const meaning = SHIPPING_POLICY_MEANINGS[status];
  return {
    hasStatusData: true,
    status: meaning.status,
    summary: meaning.summary,
    amountRule: meaning.amountRule,
    policyConfirmed: meaning.policyConfirmed,
    knowableFromProductPage: meaning.knowableFromProductPage,
    assertsFreeShipping: meaning.assertsFreeShipping,
  };
}

/** 알 수 없는 문자열을 상태로 승격시키지 않는다(DB CHECK 와 같은 어휘). */
export function isShippingPolicyStatus(value: unknown): value is ShippingPolicyStatus {
  return typeof value === "string" && (SHIPPING_POLICY_STATUSES as readonly string[]).includes(value);
}

/**
 * 🔴 CEO §② — "amount 를 채우는 건 FREE · FLAT 둘뿐이다."
 * 그 문장을 코드가 대답할 수 있게 만든 함수. null(상태 없음)도 false 다.
 */
export function shippingPolicyAllowsAmount(status: ShippingPolicyStatus | null | undefined): boolean {
  return describeShippingPolicy(status).amountRule !== "MUST_BE_NULL";
}

export interface ShippingPolicyInput {
  status?: ShippingPolicyStatus | null;
  /** price_observations.shipping_cost_amount 에 들어갈 값. 국내 소스는 KRW. */
  amount?: number | null;
  /** 판매처 원문 그대로. 우리가 해석한 값을 적지 않는다(046 market_code 원칙). */
  note?: string | null;
}

export interface ResolvedShippingPolicy {
  status: ShippingPolicyStatus | null;
  amount: number | null;
  note: string | null;
}

export type ShippingPolicyResolution =
  | { ok: true; value: ResolvedShippingPolicy }
  | { ok: false; error: string };

/**
 * 저장 직전에 «상태와 금액이 서로 모순되지 않는지»를 막는 문. 이 문을 통과하지
 * 못한 관측은 저장되지 않는다 — 틀린 배송비 한 칸이 들어가는 것보다 그 배치가
 * 실패하는 편이 낫다(0원으로 메우는 것이 바로 45885bf 가 잡은 회귀다).
 *
 * 오늘 shipping_cost_amount 를 채우는 호출부는 저장소 전체에 «0곳»이다
 * (run-price-check.ts · run-domestic-price-check.ts 둘 다 넘기지 않는다).
 * 그래서 이 문을 세워도 기존 동작은 한 줄도 바뀌지 않는다 — 앞으로 생길
 * 호출부만 이 규칙을 지나게 된다.
 */
export function resolveShippingPolicy(input: ShippingPolicyInput): ShippingPolicyResolution {
  const rawStatus = input.status ?? null;
  if (rawStatus !== null && !isShippingPolicyStatus(rawStatus)) {
    return { ok: false, error: `허용되지 않은 배송비 상태입니다: ${String(rawStatus)}` };
  }
  const amount = input.amount ?? null;
  if (amount !== null && !Number.isFinite(amount)) {
    return { ok: false, error: "배송비 금액이 숫자가 아닙니다." };
  }

  const described = describeShippingPolicy(rawStatus);
  switch (described.amountRule) {
    case "MUST_BE_NULL":
      if (amount !== null) {
        return {
          ok: false,
          error: rawStatus === null
            ? "배송비 상태 없이 배송비 금액만 저장할 수 없습니다(그 숫자가 무엇을 뜻하는지 말할 수 없습니다)."
            : `${rawStatus} 상태에는 배송비 금액을 적을 수 없습니다(FREE·FLAT 만 금액을 가집니다).`,
        };
      }
      break;
    case "REQUIRED_ZERO":
      // FREE 는 «0원»이라는 주장 그 자체다. 금액을 생략한 FREE 는 그 주장을
      // 이미 한 것이므로 0 을 적는다 — 없는 사실을 지어내는 것이 아니라
      // 같은 사실을 금액 칸에도 적는 것이다.
      if (amount !== null && amount !== 0) {
        return { ok: false, error: `FREE 는 배송비 0원을 뜻합니다(받은 값: ${amount}).` };
      }
      return { ok: true, value: { status: rawStatus, amount: 0, note: normalizeNote(input.note) } };
    case "REQUIRED_POSITIVE":
      // 숫자 없는 FLAT 은 «고정 배송비를 확인했다»고 말하면서 그 값을 못 대는
      // 상태다. 그건 FLAT 이 아니라 UNREAD 다.
      if (amount === null) {
        return { ok: false, error: "FLAT 은 확인된 고정 배송비 금액이 필요합니다(모르면 UNREAD 입니다)." };
      }
      if (amount <= 0) {
        return { ok: false, error: `FLAT 의 배송비는 0보다 커야 합니다(0원이면 FREE 입니다, 받은 값: ${amount}).` };
      }
      break;
  }

  return { ok: true, value: { status: rawStatus, amount, note: normalizeNote(input.note) } };
}

/** 빈 문자열/공백만 있는 note 는 "근거를 적었다"가 아니다 — null 로 둔다. */
function normalizeNote(note: string | null | undefined): string | null {
  if (typeof note !== "string") return null;
  const trimmed = note.trim();
  return trimmed.length > 0 ? trimmed : null;
}
