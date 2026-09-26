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
export function payloadStockQuantity(product: CanonicalProduct): number {
  const fact = resolveSourceStock(product);
  if (fact.state === "OUT_OF_STOCK") return 0;
  if (fact.quantity != null) return fact.quantity;
  return product.stockQuantity.value;
}
