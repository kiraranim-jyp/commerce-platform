import type { CanonicalProduct } from "./product-types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * Commerce-6 C-2E — **원본 재고 «사실» 을 한 곳에서만 해석한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 왜 이 파일이 생겼나 ────────────────────────────────────────────────────
 * C-2D 가 「재고 0 이 세 채널에서 조용히 통과한다」를 고쳤다. 그런데 그 수정도
 * **무효였다.** 규칙을 `product.stockQuantity.value > 0` 로 썼는데, 그 값은
 * 사실상 언제나 999 다 — `canonical-product.ts` 가 모든 상품을
 * `{ value: 999, source: "DEFAULT" }` 로 시작시키고 그것을 덮어쓰는 경로가
 * 코드에 없다(전수 확인). 즉 내가 고친 규칙도 절대 실패하지 않았다.
 *
 * 🔴 같은 함정에 두 번 빠진 이유는 하나다 — **「값이 있다」를 「사실이다」로
 * 읽었기 때문**이다. 999 는 재고가 999개라는 뜻이 아니라 «모른다» 는 뜻이다.
 *
 * ── 그래서 사실은 어디에 있나 ──────────────────────────────────────────────
 * 크롤러가 실제로 읽는 재고는 **옵션(variant) 레벨에만** 들어온다.
 *
 *     Shopify        inventory_management 가 켜져 있을 때만 inventory_quantity
 *                    (꺼져 있으면 숫자를 믿을 수 없어 «채우지 않는다»)
 *     schema.org     availability === "OutOfStock" → 0 / "InStock" → undefined
 *     PrestaShop     수량이 유한할 때만
 *
 * 그래서 판정 순서가 이렇게 된다: **옵션의 실측 → 상품의 실측 → 모름.**
 *
 * ── CEO 정책(2026-09-26 확정) ─────────────────────────────────────────────
 *     원본 재고 > 0        등록 가능
 *     원본 재고 = 0        🔴 등록 «차단» — 0 을 1 로 바꾸지 않는다
 *     비정상값(음수 등)    차단 — 원본 재고 확인 필요
 *     UNKNOWN             🔴 임의 보정 «금지». 다만 막지도 않는다 —
 *                         모른다는 것은 품절이라는 뜻이 아니다.
 *
 * 🔴 판매 여부와 판매가격은 셀러가 정한다. 이 파일은 «사실» 만 말한다.
 */
export type SourceStockState =
  /** 원본에 재고가 있다(옵션 합계 또는 상품 실측). */
  | "IN_STOCK"
  /** 🔴 원본이 품절이다 — 확인된 사실이다. 등록을 막는다. */
  | "OUT_OF_STOCK"
  /** 값이 음수거나 숫자가 아니다 — 확인이 필요하다. */
  | "INVALID"
  /** 🔴 확인하지 못했다. 999 가 여기다. 막지 않지만 「있다」고도 하지 않는다. */
  | "UNKNOWN";

export interface SourceStockFact {
  state: SourceStockState;
  /** 확인된 수량(IN_STOCK / OUT_OF_STOCK 일 때만). 모르면 null. */
  quantity: number | null;
  /** 어디서 알아냈는가 — 화면과 보고서가 같은 말을 하게 한다. */
  from: "VARIANTS" | "PRODUCT" | "NONE";
  /** 셀러가 그대로 읽는 한 줄. 판단을 대신하지 않고 사실만 말한다. */
  note: string;
}

/**
 * 상품 레벨 재고가 «실측» 인가.
 *
 * 🔴 `DEFAULT`(파이프라인이 넣은 999)와 `REQUIRED`(hydrate 폴백 0)는 사실이
 * 아니다. 특히 REQUIRED 는 값이 0 이라 그냥 읽으면 «품절» 로 오해된다 —
 * 모르는 것을 품절이라고 말하는 쪽이 등록을 막으므로 더 나쁘다.
 */
function isMeasured(source: string): boolean {
  return source === "ORIGINAL" || source === "USER_EDITED";
}

export function resolveSourceStock(product: CanonicalProduct): SourceStockFact {
  /* ① 옵션에 실측이 하나라도 있으면 그것이 원본의 사실이다. 일부 옵션만
        수량을 준 경우에도 «준 것» 만 더한다 — 모르는 옵션을 0 으로 세지 않는다. */
  const measuredVariants = product.variants.filter((v) => typeof v.stockQuantity === "number");
  if (measuredVariants.length > 0) {
    const quantities = measuredVariants.map((v) => v.stockQuantity as number);
    if (quantities.some((q) => !Number.isFinite(q) || q < 0)) {
      return {
        state: "INVALID",
        quantity: null,
        from: "VARIANTS",
        note: "원본 옵션의 재고 값이 올바르지 않습니다 — 원본 상품을 확인해 주세요.",
      };
    }
    const total = quantities.reduce((sum, q) => sum + q, 0);
    return total > 0
      ? { state: "IN_STOCK", quantity: total, from: "VARIANTS", note: `원본 재고 ${total}개(옵션 합계).` }
      : {
          state: "OUT_OF_STOCK",
          quantity: 0,
          from: "VARIANTS",
          note: "원본 상품의 옵션이 모두 품절입니다 — 재고가 없는 상태에서는 등록할 수 없습니다.",
        };
  }

  /* ② 상품 레벨은 «실측일 때만» 본다. */
  const raw = product.stockQuantity;
  if (isMeasured(raw.source)) {
    if (!Number.isFinite(raw.value) || raw.value < 0) {
      return {
        state: "INVALID",
        quantity: null,
        from: "PRODUCT",
        note: "원본 재고 값이 올바르지 않습니다 — 원본 상품을 확인해 주세요.",
      };
    }
    return raw.value > 0
      ? { state: "IN_STOCK", quantity: raw.value, from: "PRODUCT", note: `원본 재고 ${raw.value}개.` }
      : {
          state: "OUT_OF_STOCK",
          quantity: 0,
          from: "PRODUCT",
          note: "원본 상품의 재고가 없어 등록할 수 없습니다.",
        };
  }

  /* ③ 🔴 여기가 지금 대부분이다. 막지 않는다 — 모른다는 것은 품절이 아니다. */
  return {
    state: "UNKNOWN",
    quantity: null,
    from: "NONE",
    note: "원본 재고를 확인하지 못했습니다 — 등록은 가능하지만 판매 전에 원본 재고를 확인해 주세요.",
  };
}

/** 등록을 막아야 하는가. 🔴 UNKNOWN 은 막지 않는다(CEO 정책). */
export function blocksRegistration(fact: SourceStockFact): boolean {
  return fact.state === "OUT_OF_STOCK" || fact.state === "INVALID";
}

/**
 * payload 에 실을 수량.
 *
 * 🔴 여기서 «보정하지 않는다». 예전 네이버 빌더의 `|| 1` 이 정확히 그 보정이었고,
 * 그 한 글자가 검증기를 무효로 만들었다(C-2D). 품절이면 0 을 그대로 실어야
 * 검증기가 제 일을 한다 — 막힌 상품은 애초에 전송되지 않는다.
 */
/**
 * 🔴 P5.6 P0-5(CEO 실측, 2026-10-09) — **파이프라인 DEFAULT 를 재고로 싣지 않는다.**
 *
 * CEO 가 롯데ON 등록에서 재고 999 를 봤다. 추적해 보니 원본에 재고 정보가 없는
 * 상품에서 `product.stockQuantity` 의 **DEFAULT 999**(파이프라인 초기값)가 그대로
 * 채널로 나갔다. 999 는 「재고가 999개」가 아니라 「재고를 모른다」는 뜻이다.
 *
 * 🔴 모르는 것을 숫자로 지어내지 않는다 — 이 저장소의 상수 규칙 그대로다
 *    (payload 상수에는 근거가 있어야 한다).
 * 🔴 그렇다고 0 으로 적지도 않는다 — 0 은 「품절」이라는 «다른 사실» 이고,
 *    실측 품절(OUT_OF_STOCK)과 구분되지 않으면 멀쩡한 상품이 품절로 등록된다.
 * 🔴 그래서 «실측이 아닌 값» 은 null 로 돌려주고, 채널 빌더가 자기 정책으로
 *    정하게 한다. 보정은 여기서 하지 않는다(C-2D 의 `|| 1` 이 그 실수였다).
 */
export const PIPELINE_DEFAULT_STOCK = 999;

/**
 * ══ 🔴 D4(라이브 실측, 2026-10-09) — **상품 재고가 옵션과 어긋났다.** ═══════
 *
 * 실측: 판매자가 기본 재고 10 을 적은 Smallable 상품의 payload —
 *   옵션 4개 = 각 10         상품 레벨 stockQuantity = **999**
 *
 * `payloadStockQuantity` 가 `resolvedPayloadStock`(실측만) 뒤에서 999 로
 * 떨어졌고, 판매자 기본값을 «몰랐다». 화면은 10 을 말하고 payload 는 999 를
 * 말하는 상태다 — 999 날조를 상품 레벨에서 다시 만든 셈이다.
 *
 * 🔴 그래서 옵션 합계 → 상품 실측 → 판매자 기본값 순으로 본다. 그 셋이 다
 *    없을 때만 마지막 폴백이 남는다.
 */
export function resolvedPayloadStockWithSellerDefault(product: CanonicalProduct): number | null {
  const measured = resolvedPayloadStock(product);
  if (measured != null) return measured;
  /* 🔴 옵션이 있으면 «판매자 기본값 × 옵션 수» 가 아니라 옵션별 값의 합이다 —
     variantStockWithSellerDefault 가 옵션마다 같은 값을 돌려주므로 그 합을 센다.
     옵션이 없으면 기본값 하나가 상품 재고다. */
  if (product.variants.length > 0) {
    const perVariant = product.variants.map((v) => variantStockWithSellerDefault(product, v));
    if (perVariant.some((q) => q == null)) return null;
    return (perVariant as number[]).reduce((a, b) => a + b, 0);
  }
  const fallback = product.sellerDefaultStock;
  if (typeof fallback !== "number" || !Number.isFinite(fallback) || fallback < 0) return null;
  if (fallback === PIPELINE_DEFAULT_STOCK) return null;
  return fallback;
}

export function payloadStockQuantity(product: CanonicalProduct): number {
  /* 🔴 D4 — 판매자 기본값까지 «본다». 전에는 `resolvedPayloadStock`(실측만) 뒤에서
     바로 999 로 떨어져, 옵션이 10 인데 상품 재고가 999 로 나갔다(실측). */
  return resolvedPayloadStockWithSellerDefault(product) ?? PIPELINE_DEFAULT_STOCK;
}

/**
 * 🔴 실측에 근거한 수량만 돌려준다. 근거가 없으면 `null` —
 *    「모른다」를 숫자로 바꾸지 않는다.
 */
export function resolvedPayloadStock(product: CanonicalProduct): number | null {
  const fact = resolveSourceStock(product);
  if (fact.state === "OUT_OF_STOCK") return 0;
  if (fact.quantity != null) return fact.quantity;
  /* 🔴 상품 레벨 값이 파이프라인 DEFAULT 면 그것은 실측이 아니다. */
  const level = product.stockQuantity;
  if (level.source === "DEFAULT" || level.value === PIPELINE_DEFAULT_STOCK) return null;
  return level.value;
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.6 FINAL(CPO FAIL ①, 2026-10-09) — **옵션별 재고에 999 를 넣지 않는다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 운영 빌더로 실측해서 잡은 결함이다. 옵션 3개 중 하나가 재고를 모를 때 —
 *
 *   NAVER_COMBOS = [ {2Y: 3}, {3Y: 0}, {4Y: 999} ]   ← 모르는 옵션에 999
 *   NAVER_TOP_STOCK = 3                              ← 합계와 어긋난다(3+0+999)
 *
 * 세 채널이 «같은 모양» 으로 틀려 있었다:
 *   naver:353    variant.stockQuantity ?? product.stockQuantity.value ?? 0
 *   coupang:1652 variant?.stockQuantity ?? payloadStockQuantity(product)   ← 999 포함
 *   lotteon:310  variant.stockQuantity ?? defaultStock                     ← 0 폴백
 *
 * 🔴 앞선 스프린트에서 「재고 999 방지」를 닫았다고 보고했는데, 그것은 **상품
 *    레벨** 한 줄이었다. 옵션별 경로는 그대로 999 를 쓰고 있었다 — 같은 결함을
 *    두 번째로 고친다. 그래서 이번에는 세 채널이 «한 함수» 를 보게 만든다.
 *
 * ── 🔴 무엇으로 폴백하는가 ───────────────────────────────────────────────
 * CPO: 「옵션 상품은 variant별 재고, 단일 상품은 기존 기본 재고를 사용 ·
 *       999 같은 fallback 으로 문제를 가리지 않음」.
 *
 *   ① variant 에 실측이 있으면 그 값                      ← 가장 구체적인 사실
 *   ② 없으면 «상품 레벨 실측»(resolvedPayloadStock)        ← 셀러가 넣은 값 포함
 *   ③ 둘 다 없으면 **null** — 지어내지 않는다
 *
 * ③ 이 되면 호출부가 그 사실을 다룬다. 🔴 0 으로 메우지 않는다 — 0 은 「품절」
 *    이라는 «사실의 주장» 이고, 팔 수 있는 옵션이 품절로 등록된다.
 */
export function variantStockForPayload(
  product: CanonicalProduct,
  variant: { stockQuantity?: number } | undefined,
): number | null {
  if (typeof variant?.stockQuantity === "number" && Number.isFinite(variant.stockQuantity) && variant.stockQuantity >= 0) {
    return variant.stockQuantity;
  }
  /* ══ 🔴 실측이 잡은 두 번째 결함 — 폴백이 «순환» 이었다 ══════════════════
     처음에는 `resolvedPayloadStock(product)` 로 내려갔다. 그런데 그 함수는
     옵션 합계를 «먼저» 본다(resolveSourceStock → from VARIANTS). 그래서
     옵션 [3, 0, 모름] 에서 모름 칸에 **합계 3** 이 들어가, payload 합이
     3+0+3 = 6 으로 늘었다 — 원본에 없던 재고를 우리가 만든 것이다.

     🔴 그래서 여기서는 «상품 레벨 실측» 만 본다. 옵션에서 파생된 값을 다시
        옵션에 넣지 않는다. */
  const level = product.stockQuantity;
  if (!isMeasured(level.source)) return null;
  if (!Number.isFinite(level.value) || level.value < 0) return null;
  /* 🔴 999 는 파이프라인이 넣은 「모른다」의 표시다 — 실측으로 취급하지 않는다
     (resolvedPayloadStock 이 같은 이유로 그 값을 걸러낸다). */
  if (level.value === PIPELINE_DEFAULT_STOCK) return null;
  return level.value;
}

/**
 * 🔴 「이 옵션의 재고를 모른다」 목록 — 화면·검증이 그 사실을 말한다.
 *
 * ══ 🔴 같은 순환 결함이 여기에도 있었다(2026-10-09) ═══════════════════════
 * 처음에는 `resolvedPayloadStock(product) != null` 이면 전부 안다고 보고 빈
 * 배열을 돌려줬다. 그 함수는 «옵션 합계» 를 먼저 보므로, 옵션이 하나라도 실측이면
 * 항상 non-null 이 되어 **모르는 옵션이 있어도 빈 배열** 이 나왔다 — 가드가 잡았다.
 *
 * 🔴 그래서 판정 기준을 `variantStockForPayload` «하나» 로 맞춘다. payload 에
 *    실릴 값이 null 인 옵션이 곧 「모르는 옵션」이다 — 화면이 말하는 것과 payload
 *    가 하는 것이 어긋날 수 없다.
 */
export function variantsWithUnknownStock(product: CanonicalProduct): string[] {
  return product.variants
    /* 🔴 P5.6 P0-1 — 판매자 기본값까지 «포함해» 판정한다. 기본값을 적었는데도
       화면이 「재고 모름」이라고 말하면 셀러는 자기가 적은 값이 무시된 줄 안다. */
    .filter((v) => variantStockWithSellerDefault(product, v) == null)
    .map((v) => Object.values(v.optionValues ?? {}).join(" / ") || v.id);
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.6 P0-1(CPO, 2026-10-09) — **판매자가 정한 기본 재고.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO: 「source stock UNKNOWN → 판매자가 입력한 기본재고 적용 · 기본재고가
 * source 의 실제 수량을 덮지 않음 · 999/0 임의 생성 금지」.
 *
 * 실측 근거: Smallable 은 사이즈만 주고 수량을 «한 칸도» 주지 않는다. 그 상품은
 * 지금 옵션 전부가 「재고 모름」이고 payload 에서 빠진다 — 팔 수 있는 상품인데
 * 등록이 안 되는 상태다. 그래서 판매자가 한 번 정하면 그 값을 쓴다.
 *
 * 🔴 이것은 «추정값이 아니다» — 판매자가 화면에서 직접 적은 수다. 999 는 파이프
 *    라인이 넣은 「모른다」의 표시이고, 그것과 섞이지 않게 저장 자리를 따로 둔다
 *    (`CanonicalProduct.sellerDefaultStock`).
 * 🔴 실측을 덮지 않는다. 적용 대상은 「variantStockForPayload 가 null 인 옵션」
 *    하나뿐이다 — 그 판정은 이미 한 곳에 있다.
 */
export function variantStockWithSellerDefault(
  product: CanonicalProduct,
  variant: { stockQuantity?: number } | undefined,
): number | null {
  const measured = variantStockForPayload(product, variant);
  if (measured != null) return measured;
  const fallback = product.sellerDefaultStock;
  if (typeof fallback !== "number" || !Number.isFinite(fallback) || fallback < 0) return null;
  /* 🔴 999 를 판매자 기본값으로도 허용하지 않는다 — 그 숫자는 이 저장소에서
     「모른다」를 뜻하고, 화면·payload 가 그렇게 읽는다. */
  if (fallback === PIPELINE_DEFAULT_STOCK) return null;
  return fallback;
}
