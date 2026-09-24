import type { CanonicalProduct } from "./product-types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * NEXT-04d Phase A(CPO 승인, 2026-09-23) — **Master Product 의 «경계» 선언**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 이 파일이 하는 일 ──────────────────────────────────────────────────────
 * 데이터를 옮기지 않는다. `CanonicalProduct` 의 50칸이 각각 «무엇인지» 를
 * 한 곳에 적고, 그 분류에서 타입을 «파생» 할 뿐이다.
 *
 *   저장 모양      바뀌지 않는다(product_snapshots.workspace jsonb 그대로)
 *   런타임 동작    바뀌지 않는다(이 파일은 값을 만들지도 고치지도 않는다)
 *   migration      없다
 *
 * ── 왜 지금 «경계» 부터인가 ────────────────────────────────────────────────
 * 04d 조사에서 나온 것은 제조사보다 큰 문제였다. 채널 정보가 «두 군데» 로
 * 흩어져 있다:
 *
 *   workspace 층        categoryMappings · platformSettings
 *   CanonicalProduct 층 channelPriceOverrides · lotteOnChannelInfo ·
 *                       categoryFieldOverrides · categoryResolverKpi ·
 *                       categoryRecommendationCache
 *
 * 흩어진 이유는 매번 「지금 저장할 자리가 여기밖에 없어서」였고, 그때마다
 * 판단은 옳았다(스냅샷 jsonb 하나뿐이니까). 그런데 그 결과 **Master 가
 * 롯데ON 을 알고 있다.** 그 상태로 신규 커머스를 받으면 상품 타입에
 * `xxxChannelInfo` 가 하나씩 더 붙는다.
 *
 * 그래서 옮기기 «전에» 경계를 먼저 컴파일러가 알게 한다. 아래 지도에 새 필드를
 * 등록하지 않으면 **타입 에러가 난다** — 앞으로 누구도 「이게 상품 사실인지
 * 채널 값인지」를 말하지 않은 채 필드를 추가할 수 없다.
 *
 * ── 🔴 이번 단계에서 하지 «않는» 것 ────────────────────────────────────────
 * ❌ DB migration  ❌ jsonb 구조 변경  ❌ snapshot rewrite  ❌ 필드 삭제/이동
 * ❌ CanonicalProduct 대규모 refactor  ❌ Adapter 두 계열 통합
 * ❌ 신규 Commerce 구현  ❌ Selling 층 «구현»(경계만 적는다)
 *
 * ── 이름이 왜 Master* 인가 ────────────────────────────────────────────────
 * 🔴 `ProductFacts` 를 쓰지 않는다. 그 이름은 이미 `product-facts.ts` 가
 * 쓰고 있고, 뜻이 «다르다» — 거기는 MATCHING-2.0 의 「판매처가 달라도 같은
 * 물건인지」를 재는 비교용 사실이다. 같은 이름을 두 개념에 붙이면 나중에
 * 반드시 섞인다(CPO 지시).
 *
 *   MasterProductFacts    이 상품의 제조/수입/원산지 «사실»
 *   ProductFacts(기존)    비교 매칭용 사실 — packages/shared/src/product-facts.ts
 */

/**
 * 분류 라벨. CPO 가 확정한 6개다.
 *
 * 🔴 `LEGACY` 가 있는 이유: 「모든 필드는 Master 아니면 Binding」으로 강제하면
 * 죽은 필드(customsDutyKrw/customsVatKrw — 읽는 코드 0곳) 때문에 구조가
 * 왜곡된다. 분류를 «빠뜨리는 것» 은 에러지만, 「이건 legacy 다」라고 **말하는
 * 것은 허용**한다.
 */
export type MasterFieldLayer =
  | "MASTER"
  | "CONTENT"
  | "SELLING"
  | "COMMERCE_BINDING"
  | "SOURCE"
  | "LEGACY";

/**
 * 세부 묶음. MASTER 는 네 묶음으로 갈린다(CPO 확정 구조).
 *
 *   Master Product
 *   ├─ ProductCore          무엇인가 — 원본 · 이름 · 브랜드 · 설명 · 이미지
 *   ├─ MasterProductFacts   제조/수입/원산지/인증 «사실»
 *   ├─ Variants             SKU · 옵션 · 가격 · 재고 · 이미지
 *   ├─ CategoryAttributes   소재 · 색상 · 사이즈 · 중량 · 사용연령 · 기타 속성
 *   ├─ Content              🔴 AI 가 «등록을 위해» 만든 한국어 콘텐츠
 *   └─ Source / Provenance  각 값이 어디서 왔는가
 */
export type MasterFieldGroup =
  | "MASTER_CORE"
  | "MASTER_FACTS"
  | "MASTER_VARIANTS"
  | "MASTER_ATTRIBUTES"
  | "CONTENT"
  | "SELLING"
  | "COMMERCE_BINDING"
  | "SOURCE"
  | "LEGACY";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 유일한 분류표. `CanonicalProduct` 의 «모든» 칸이 여기 한 줄씩 있다.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `satisfies Record<keyof CanonicalProduct, MasterFieldGroup>` 가 두 가지를
 * 동시에 강제한다:
 *   · 빠뜨린 필드가 있으면 **컴파일 에러**(새 필드를 말없이 추가할 수 없다)
 *   · 없는 필드 이름을 적어도 **컴파일 에러**(지운 필드가 지도에 남지 않는다)
 *
 * `as const` 를 붙여야 값이 리터럴로 좁혀져 아래 `KeysIn<...>` 이 동작한다.
 */
export const MASTER_FIELD_GROUP = {
  /* ── ProductCore — 「이것은 무엇인가」 ─────────────────────────────────── */
  sourceUrl: "MASTER_CORE",
  title: "MASTER_CORE",
  brand: "MASTER_CORE",
  description: "MASTER_CORE",
  images: "MASTER_CORE",

  /* ── MasterProductFacts — 「누가 만들고 어디서 왔는가」 ────────────────── */
  manufacturer: "MASTER_FACTS",
  importer: "MASTER_FACTS",
  countryOfOrigin: "MASTER_FACTS",
  certification: "MASTER_FACTS",
  childCertification: "MASTER_FACTS",
  certificationType: "MASTER_FACTS",

  /* ── Variants — 「무엇을 몇 개, 얼마에 파는 단위인가」 ─────────────────── */
  sku: "MASTER_VARIANTS",
  /* 🔴 `price` 는 «원본 통화 원가» 다(Layer 1). 우리가 정한 판매가
     (priceOverrideKrw)는 SELLING 이다 — 두 개를 같은 층에 두면 「원본이
     얼마였나」와 「우리가 얼마에 파나」가 다시 섞인다. */
  price: "MASTER_VARIANTS",
  regularPrice: "MASTER_VARIANTS",
  priceValidity: "MASTER_VARIANTS",
  /* @deprecated optionGroups 로 대체 예정. 🔴 LEGACY 로 적지 «않는다» —
     어댑터·미리보기 등 아직 읽는 곳이 여러 곳 있다. LEGACY 라고 적으면
     「아무도 안 읽는다」로 읽혀 지워질 수 있다. */
  options: "MASTER_VARIANTS",
  optionGroups: "MASTER_VARIANTS",
  variants: "MASTER_VARIANTS",
  selectedVariant: "MASTER_VARIANTS",
  stockQuantity: "MASTER_VARIANTS",

  /* ── CategoryAttributes — 「이 카테고리가 묻는 속성」 ──────────────────── */
  material: "MASTER_ATTRIBUTES",
  color: "MASTER_ATTRIBUTES",
  recommendedAge: "MASTER_ATTRIBUTES",
  weight: "MASTER_ATTRIBUTES",
  careInstructions: "MASTER_ATTRIBUTES",
  itemName: "MASTER_ATTRIBUTES",
  modelName: "MASTER_ATTRIBUTES",

  /* ── Content — 🔴 원본 사실이 아니라 «AI 가 등록용으로 만든» 것 ────────── */
  titleKo: "CONTENT",
  descriptionKo: "CONTENT",
  keywords: "CONTENT",
  seoTitle: "CONTENT",
  seoDescription: "CONTENT",

  /* ── Selling — 「우리가 파는 조건」. 상품의 사실이 아니다 ──────────────── */
  priceOverrideKrw: "SELLING",
  priceBreakdown: "SELLING",
  shippingFee: "SELLING",
  returnPolicy: "SELLING",

  /* ── CommerceBinding — 🔴 Master 가 커머스를 «알지 않게» 하는 자리 ─────── */
  channelPriceOverrides: "COMMERCE_BINDING",
  /* 🔴 이 한 칸이 이번 분류의 이유다. 이름에 채널이 박혀 있고, Master 에
     두면 「Master 가 롯데ON 을 안다」가 된다 — 그러면 신규 커머스마다
     xxxChannelInfo 가 하나씩 더 붙는다. 물리적으로는 아직 여기 있지만,
     타입에서는 Master 밖이다. */
  lotteOnChannelInfo: "COMMERCE_BINDING",
  smartStoreKcDeclaration: "COMMERCE_BINDING",
  /* 이름은 중립인데 실제 소비자는 쿠팡 build-payload 하나다(고시/구매옵션). */
  categoryFieldOverrides: "COMMERCE_BINDING",
  categoryResolverKpi: "COMMERCE_BINDING",
  categoryRecommendationCache: "COMMERCE_BINDING",

  /* ── Source / Provenance — 「그 값이 어디서 왔는가」 ───────────────────── */
  /* 🔴 분류 기준: «값» 이 아니라 «값의 출처/근거» 를 말하는 칸이다.
     (필드마다 붙는 ProvenanceField{source,inputMode,confidence} 는 별도 칸이
      아니라 값의 «포장» 이라 이 지도에 줄이 없다 — interpretField() 참고.) */
  manufacturerOrigin: "SOURCE",
  brandResolution: "SOURCE",
  priceRawText: "SOURCE",
  breadcrumbPath: "SOURCE",
  jsonLdCategory: "SOURCE",
  shopifyTags: "SOURCE",
  shopifyProductType: "SOURCE",

  /* ── Legacy — 읽는 코드가 «0곳» 인데 스냅샷에 값이 남아 있는 칸 ────────── */
  /* MI-COST-POLICY-1(2026-09-12) 로 관세·부가세는 판매자 계산에서 빠졌다.
     타입에서 지우면 이미 저장된 스냅샷을 고쳐야 해서 그대로 둔 것이다. */
  customsDutyKrw: "LEGACY",
  customsVatKrw: "LEGACY",
} as const satisfies Record<keyof CanonicalProduct, MasterFieldGroup>;

/** 세부 묶음 → 분류 라벨. */
const GROUP_TO_LAYER = {
  MASTER_CORE: "MASTER",
  MASTER_FACTS: "MASTER",
  MASTER_VARIANTS: "MASTER",
  MASTER_ATTRIBUTES: "MASTER",
  CONTENT: "CONTENT",
  SELLING: "SELLING",
  COMMERCE_BINDING: "COMMERCE_BINDING",
  SOURCE: "SOURCE",
  LEGACY: "LEGACY",
} as const satisfies Record<MasterFieldGroup, MasterFieldLayer>;

export type CanonicalProductKey = keyof typeof MASTER_FIELD_GROUP;

/** 그 묶음에 속한 필드 이름들. 지도 한 곳에서 파생되므로 둘이 갈릴 수 없다. */
type KeysIn<G extends MasterFieldGroup> = {
  [K in CanonicalProductKey]: (typeof MASTER_FIELD_GROUP)[K] extends G ? K : never;
}[CanonicalProductKey];

/* ══════════════════════════════════════════════════════════════════════════
   파생 타입 — 전부 `Pick`. 새 필드도, 새 저장소도 만들지 않는다.
   ══════════════════════════════════════════════════════════════════════════ */

export type MasterProductCore = Pick<CanonicalProduct, KeysIn<"MASTER_CORE">>;
export type MasterProductFacts = Pick<CanonicalProduct, KeysIn<"MASTER_FACTS">>;
export type MasterProductVariants = Pick<CanonicalProduct, KeysIn<"MASTER_VARIANTS">>;
export type MasterCategoryAttributes = Pick<CanonicalProduct, KeysIn<"MASTER_ATTRIBUTES">>;
export type MasterProductContent = Pick<CanonicalProduct, KeysIn<"CONTENT">>;
export type MasterProductSource = Pick<CanonicalProduct, KeysIn<"SOURCE">>;

/**
 * Master Product — CPO 확정 구조 그대로 여섯 층의 합이다.
 *
 * 🔴 여기 «없는» 것이 이 타입의 존재 이유다: 판매 조건(Selling)과 채널 값
 * (CommerceBinding)이 빠져 있다. 그래서 `MasterProduct` 를 받는 함수는
 * 롯데ON·쿠팡·스마트스토어를 알 방법이 타입 수준에서 없다.
 *
 * 🔴 `CanonicalProduct` 를 대체하지 «않는다». 저장·복원은 그대로
 * `CanonicalProduct` 한 모양이고, 이 타입은 그것을 «좁게 보는 창» 이다.
 */
export type MasterProduct = MasterProductCore &
  MasterProductFacts &
  MasterProductVariants &
  MasterCategoryAttributes &
  MasterProductContent &
  MasterProductSource;

/**
 * 판매 조건 — 「우리가 이 상품을 어떤 조건으로 파는가」.
 *
 * 🔴 Phase A 에서는 «경계만» 적는다(CPO 지시). 별도 저장소도, 이 타입을
 * 받는 새 함수도 만들지 않는다. 채널별로 갈리는 가격은 여기가 아니라
 * CommerceBinding 에 있다 — 그게 「채널을 아는」 값이기 때문이다.
 */
export type SellingConditions = Pick<CanonicalProduct, KeysIn<"SELLING">>;

/**
 * 커머스 바인딩 — 채널을 «아는» 값 전부.
 *
 * 🔴 지금은 채널 키 구조가 제각각이다(조사 결과 그대로):
 *   channelPriceOverrides       Partial<Record<PlatformId, …>>  ✅ 채널 키
 *   lotteOnChannelInfo          이름에 채널이 박힘               ❌
 *   categoryFieldOverrides      이름은 중립, 소비자는 쿠팡 하나   ❌
 *   categoryResolverKpi/Cache   쿠팡 카테고리 추천 전용           ❌
 * 이것을 `Record<CommerceId, …>` 하나로 모으는 것은 Phase B 이후의 일이고,
 * PlatformId/NextGen 두 어댑터 계열 통합과 «별개 프로젝트» 다(CPO 확정).
 */
export type CommerceBinding = Pick<CanonicalProduct, KeysIn<"COMMERCE_BINDING">>;

/** 읽는 코드가 없는 칸. 분류를 «말한» 것이지 되살린 것이 아니다. */
export type LegacyProductFields = Pick<CanonicalProduct, KeysIn<"LEGACY">>;

/* ══════════════════════════════════════════════════════════════════════════
   런타임 조회 — 화면/테스트/도구가 「이 칸은 무슨 층인가」를 물어볼 때.
   ══════════════════════════════════════════════════════════════════════════ */

/** 필드 → 분류 라벨. 위 지도 하나에서 파생된다. */
export const CANONICAL_FIELD_LAYER: Record<CanonicalProductKey, MasterFieldLayer> = Object.fromEntries(
  (Object.keys(MASTER_FIELD_GROUP) as CanonicalProductKey[]).map((key) => [
    key,
    GROUP_TO_LAYER[MASTER_FIELD_GROUP[key]],
  ]),
) as Record<CanonicalProductKey, MasterFieldLayer>;

export function masterFieldLayerOf(key: CanonicalProductKey): MasterFieldLayer {
  return CANONICAL_FIELD_LAYER[key];
}

/**
 * 🔴 「Master 가 커머스를 알지 않는다」를 코드로 물어볼 수 있게 한다.
 *
 * 이름에 판매 채널이 박힌 필드는 Master 층에 있으면 안 된다. `shopify` 는
 * 여기 없다 — 그건 우리가 파는 채널이 아니라 «원본 상품이 있던 사이트» 의
 * 플랫폼이고, 실제로 그 값은 SOURCE 로 분류돼 있다.
 */
export const COMMERCE_NAME_PATTERN = /(lotteon|lotte|coupang|smartstore|naver|elevenst|gmarket|kakao|ssg)/i;
