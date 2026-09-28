import type {
  CommonConfirmation,
  CommonField,
  CommonFieldSourcePolicy,
  FieldSource,
  FieldValueSource,
} from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COMMON ORIGIN — **원산지 하나로 Common 구조를 증명한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 원산지를 첫 대상으로 고른 이유는 이 한 필드가 모든 층을 지나기 때문이다 —
 * Master 사실 · 판매자 기본값 · 브랜드 기본값 · 판매자 확인 · 그리고 채널마다
 * 다른 표현(스마트스토어 코드 · 쿠팡 텍스트 · 롯데ON 코드).
 *
 * ── 🔴 여기서 «하지 않는» 것 ──────────────────────────────────────────────
 * 이 파일은 **이름만** 갖는다. `Spain → ES` 같은 채널 코드 변환을 하지 않는다.
 * 그것은 Commerce Mapping 의 일이고, 롯데ON 쪽은 아직 확정되지 않았다.
 *
 * 그리고 지금 흩어져 있는 폴백을 «한 곳으로 모으는» 것이 이 파일의 실제 일이다.
 * 같은 사다리가 채널 빌더마다 따로 쓰여 있었다(`resolveManufacturer` 가 이미
 * 제조사에서 한 것을 원산지에서도 한다).
 */

/**
 * 🔴 제조국에 관용 기본값을 채우지 않는다 — 법률상 중요정보다.
 *
 * 🔴 그리고 «브랜드 기본값이 판매자 기본값보다 먼저» 다. 처음에 반대로 썼다가
 * 실측에서 잡혔다 — Production 두 채널이 이미 같은 순서로 돌고 있다:
 *
 *     coupang/build-payload.ts:1425
 *       product.countryOfOrigin.value || brandProfile?.countryOfOrigin || sellerConfig.defaultCountryOfOrigin
 *     naver/_lib/resolve-context.ts:141
 *       extractedCountryOfOrigin || brandProfile?.countryOfOrigin || sellerSettings.defaultCountryOfOrigin
 *
 * 순서를 내 쪽으로 맞췄다면 «지금 나가는 payload 가 조용히 바뀐다». 이 함수는
 * 기존 동작을 한 곳으로 모으는 것이지 바꾸는 것이 아니다.
 *
 * 🔴 둘 다 `FieldValueSource` 로는 `SELLER_SETTINGS` 다 — 판매자가 관리하는
 * 기본값이라 계층이 같다. 계층이 같아도 «우선순위» 는 구체적인 쪽(브랜드)이 먼저다.
 */
export const ORIGIN_SOURCE_POLICY: CommonFieldSourcePolicy = {
  allowedSources: ["USER_CONFIRMED", "COMMON_PRODUCT", "SELLER_SETTINGS"],
  defaultAllowed: false,
  userConfirmationAllowed: true,
  rationale:
    "제조국은 고시가 「법률상 중요정보이니 정확히 선택해주세요」라고 적은 값이다. " +
    "상품에서 온 사실이 먼저이고, 없으면 판매자가 정해 둔 기본값을 쓴다. " +
    "관용 기본값(DEFAULT)은 판매자가 정한 적이 없는 값이라 허용하지 않는다.",
};

export interface CommonOriginInput {
  /** 상품에서 확인된 원산지 텍스트와 그 출처. */
  product?: { value: string | null | undefined; source?: FieldSource };
  /** 판매자 설정의 기본값(`seller_settings.default_country_of_origin`). */
  sellerDefault?: string | null;
  /**
   * 브랜드 프로필 기본값(`coupang_brand_profiles.country_of_origin`).
   * 🔴 출처 축에서는 `SELLER_SETTINGS` 로 센다 — 판매자가 관리하는 기본값이라
   * 계층이 같다. 새 출처 값을 만들지 않는다(중복 축 금지).
   */
  brandDefault?: string | null;
  /**
   * 판매자가 확인한 기록. 있으면 무엇도 이것을 덮지 않는다.
   * 🔴 «범위» 까지 들어 있는 `CommonConfirmation` 을 그대로 받는다 — 모양을
   * 여기서 다시 정의하면 어느 채널·어느 카테고리에 대한 확인인지 잃어버린다.
   */
  confirmation?: CommonConfirmation | null;
}

const clean = (value: string | null | undefined): string => (value ?? "").trim();

/**
 * 원산지의 지금 상태. **값을 만들지 않는다** — 없으면 `MISSING` 이다.
 *
 * 🔴 사다리 순서는 `ORIGIN_SOURCE_POLICY.allowedSources` 하나에서만 말한다.
 * 규칙이 여러 줄에 흩어지면 한 줄만 뒤집힌다(배송에서 겪은 것).
 */
export function resolveCommonOrigin(input: CommonOriginInput): CommonField<string> {
  const base = {
    concept: "ORIGIN",
    requirement: "REQUIRED" as const,
    confirmation: input.confirmation ?? null,
  };

  for (const source of ORIGIN_SOURCE_POLICY.allowedSources) {
    const found = pick(source, input);
    if (!found) continue;
    return {
      ...base,
      value: found.value,
      valueState: "VALUE",
      source,
      provenance: found.provenance,
      reason: found.reason,
    };
  }

  return {
    ...base,
    value: null,
    valueState: "MISSING",
    source: "MISSING",
    reason: "상품정보·판매자 설정 어디에도 원산지가 없습니다.",
  };
}

function pick(
  source: FieldValueSource,
  input: CommonOriginInput,
): { value: string; provenance?: FieldSource; reason: string } | null {
  if (source === "USER_CONFIRMED") {
    /* 🔴 확인 «기록» 만으로는 값이 되지 않는다. 판매자가 확인한 것은 상품의
       원산지이고, 값 자체는 상품에서 온다. 그래서 여기서는 값을 꺼내지 않는다 —
       확인은 `confirmation` 칸이 따로 말한다. */
    return null;
  }
  if (source === "COMMON_PRODUCT") {
    const value = clean(input.product?.value);
    return value ? { value, provenance: input.product?.source, reason: "상품정보에서 확인된 원산지입니다." } : null;
  }
  if (source === "SELLER_SETTINGS") {
    /* 🔴 브랜드가 먼저다 — Production 두 채널의 순서 그대로다(위 주석). */
    const brand = clean(input.brandDefault);
    if (brand) return { value: brand, reason: "상품정보에 없어 브랜드 기본 원산지를 사용했습니다." };
    const seller = clean(input.sellerDefault);
    if (seller) return { value: seller, reason: "상품정보에 없어 판매자 설정의 기본 원산지를 사용했습니다." };
    return null;
  }
  return null;
}

/**
 * ── Commerce Mapping ──────────────────────────────────────────────────────
 *
 * Common 은 «이름» 을 갖고, 채널이 «자기 표현» 으로 바꾼다.
 * 🔴 필드 이름(`payloadField`)과 방식(`strategy`)은 `common/logistics.ts` 의
 * `ChannelBinding` 과 «같은 어휘» 다. 새 말을 만들지 않는다.
 */
export interface OriginChannelBinding {
  payloadField: string;
  strategy: "CHANNEL_LIST" | "SELLER_TYPED" | "CONSTANT" | "NOT_APPLICABLE" | "UNKNOWN";
  evidence: string;
}

export const ORIGIN_CHANNEL_BINDINGS: Record<"SMARTSTORE" | "COUPANG" | "LOTTEON", OriginChannelBinding> = {
  SMARTSTORE: {
    payloadField: "originAreaInfo.originAreaCode",
    strategy: "CHANNEL_LIST",
    evidence:
      "naver/origin-match.ts 의 resolveNaverOriginArea() 가 채널이 준 지역 목록에서 고른다. " +
      "우리가 코드표를 갖지 않는다.",
  },
  COUPANG: {
    payloadField: "items[].notices[] · attributes",
    strategy: "SELLER_TYPED",
    evidence: "쿠팡은 코드가 아니라 텍스트를 받는다(coupang/build-payload.ts 의 COUNTRY_SYNONYMS 경로).",
  },
  LOTTEON: {
    payloadField: "oplcCd",
    strategy: "CHANNEL_LIST",
    evidence:
      "89 공통코드 OPLC_CD 목록(실응답 239건)에서 판매자가 고른다. " +
      "🔴 원산지 «텍스트 → 코드» 변환 규칙은 아직 확정되지 않았다 — 우리가 추론하지 않는다.",
  },
};
