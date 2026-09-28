import type { CoupangRegisteredProduct } from "@commerce/listing";
import type { EditableField } from "../channel-field-capability";
import { FIELD_ORDER } from "../channel-field-capability";
import type { ChannelFieldValues, CommerceEditAdapter } from "../commerce-edit-adapter";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COUPANG-UPDATE-WIRE-01 Phase 3 — **쿠팡 어댑터. 쿠팡 모양은 여기서 끝난다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 SmartStore 어댑터와 «결정적으로 다른 점» 이 하나 있다.
 *
 *     SmartStore   Registered = GET 스냅샷 · Outgoing = Master 재생성 payload
 *     Coupang      Registered = Outgoing = **GET baseline 그 자체**
 *
 * 쿠팡 수정은 전체 교체이고, 보낼 전문은 `applyCoupangEdits(baseline, edits)` 로
 * 만든 «덮어쓴 baseline» 이다. 그래서 두 제네릭 인자가 같은 타입이다 — 이것이
 * 「Master 재생성 payload 를 PUT 하지 않는다」를 **타입에서** 못 박는다.
 * 여기에 `CoupangPayload`(빌더 산출물)를 넣을 자리는 없다.
 *
 * ── 🔴 읽지 «못한» 축은 비운다 ───────────────────────────────────────────
 * `ChannelFieldValues` 의 규칙 그대로다 — `undefined` 는 「읽지 못했다」이고
 * `null`·`0` 은 「읽었는데 이랬다」다. 실측(COUPANG-UPDATE-CAPABILITY-01)으로
 * 확인한 공식 필드만 읽고, **모양을 재 본 적 없는 칸은 추측하지 않는다.**
 */

/** 쿠팡이 문자열로 줄 수도, 숫자로 줄 수도 있는 칸을 «있는 그대로» 읽는다. */
function text(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return undefined;
}

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

/**
 * 🔴 가격·재고는 쿠팡에서 «옵션별» 이다(`items[].salePrice` · `maximumBuyCount`).
 * Core 의 `ChannelFieldValues` 는 상품 하나의 스칼라라, 옵션이 둘 이상이면
 * 어느 값을 「그 상품의 가격」이라고 적을 근거가 없다.
 *
 * 그래서 **옵션이 정확히 하나일 때만** 읽는다. 둘 이상이면 비워 둔다(읽지
 * 못했다) — 아무거나 골라 적으면 그 순간 화면이 사실이 아닌 것을 말한다.
 * 🔴 이 축은 이번 스프린트에서 UNKNOWN 이라 어차피 고칠 수 없다(CPO 확정).
 */
function soleItem(product: CoupangRegisteredProduct): Record<string, unknown> | undefined {
  const items = product.items;
  if (!Array.isArray(items) || items.length !== 1) return undefined;
  const only = items[0];
  return only && typeof only === "object" ? (only as Record<string, unknown>) : undefined;
}

/** GET baseline / 덮어쓴 baseline → 중립 통화. 🔴 둘이 «같은 함수» 여야 한다. */
function toFieldValues(product: CoupangRegisteredProduct): ChannelFieldValues {
  const only = soleItem(product);
  return {
    /* 실측 공식 필드(왕복 100%). `displayProductName` 이 아니라 이쪽이 기준이다 —
       `applyCoupangEdits` 도 이 칸을 덮고, 노출명은 따라간다. */
    name: text(product.sellerProductName),
    salePrice: only ? num(only.salePrice) : undefined,
    /* 🔴 쿠팡의 재고 자리는 `maximumBuyCount` 다(S-17 에서 확정된 기존 매핑). */
    stockQuantity: only ? num(only.maximumBuyCount) : undefined,
    /* 🔴 상세·이미지·고시는 «모양을 재 본 적이 없다». 0 이나 빈 값으로 메우면
       화면이 「없어집니다」를 말하게 된다 — 비워서 「읽지 못했다」로 둔다. */
    detailContent: undefined,
    imageCount: undefined,
    hasProvidedNotice: undefined,
    /* 옵션은 «개수만» 읽힌다 — `items[]` 는 공식 필드라 왕복이 확인됐다. */
    optionCount: Array.isArray(product.items) ? product.items.length : undefined,
    categoryId: text(product.displayCategoryCode),
  };
}

/**
 * 🔴 `editedFields` 가 보는 축.
 *
 * SmartStore 는 payload 경로를 직접 읽지만, 쿠팡은 **중립 통화로 옮긴 뒤** 비교한다.
 * before/after 가 둘 다 baseline 모양(하나는 덮어쓴 것)이라 같은 함수로 옮기면
 * 되고, 그러면 「읽지 못한 축」이 양쪽에서 똑같이 비어 비교에 끼지 않는다.
 */
const COMPARABLE: Record<EditableField, (v: ChannelFieldValues) => unknown> = {
  name: (v) => v.name,
  salePrice: (v) => v.salePrice,
  stockQuantity: (v) => v.stockQuantity,
  detailContent: (v) => v.detailContent,
  images: (v) => v.imageCount,
  options: (v) => v.optionCount,
  providedNotice: (v) => v.hasProvidedNotice,
  category: (v) => v.categoryId,
};

export const coupangEditAdapter: CommerceEditAdapter<
  CoupangRegisteredProduct,
  CoupangRegisteredProduct
> = {
  commerceId: "coupang",

  readRegistered: toFieldValues,

  /* 🔴 「보낼 것」도 baseline 모양이다 — `applyCoupangEdits` 의 결과. 빌더가 만든
     `CoupangPayload` 가 여기 들어오면 타입에서 걸린다. */
  projectOutgoing: toFieldValues,

  editedFields(before, after) {
    const a = toFieldValues(before);
    const b = toFieldValues(after);
    return FIELD_ORDER.filter((field) => {
      const read = COMPARABLE[field];
      /* 🔴 양쪽 다 「읽지 못함」이면 «변경이 아니다». undefined 를 null 로 눕혀
         비교하면 두 미지수가 같다고 나오는데, 그것이 맞는 결론이다 —
         모르는 축을 「바뀌었다」로 만들지 않는다. */
      return JSON.stringify(read(a) ?? null) !== JSON.stringify(read(b) ?? null);
    });
  },
};
