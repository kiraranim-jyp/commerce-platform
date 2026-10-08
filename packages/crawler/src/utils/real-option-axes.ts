import type { CanonicalProductOptionGroup } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.5-B B-3(CPO 승인 ㉯, 2026-10-08) — **「고를 수 있는 축」의 판정 하나.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 새 규칙이 아니다. `shopify-product-json.ts:474` 가 쓰던 **바로 그 한 줄** 을
 *    옮겨 두 경로가 «같이» 쓰게 한 것뿐이다. 복제하면 반드시 갈라진다.
 *
 * ── 🔴 왜 지금 옮기는가 (실측) ────────────────────────────────────────────
 * Smallable 116건 중 21건이 「옵션 있음」으로 저장돼 있었는데, 전수로 열어 보니
 * 셋 다 같은 모양이었다:
 *
 *     optionGroups = [{ name: "Color", values: ["Pink"] }]
 *     variants     = [{ id: "variant-0", optionValues: { Color: "Pink" } }]
 *
 * 🔴 **1 축 × 1 값 × 1 조합 — 고를 것이 없다.** 사이즈 축은 116건 중 0건이다.
 *    즉 「21 vs 95」는 「성공 vs 실패」가 아니라 「퇴화된 색상 축이 생겼는가」였고,
 *    그 21건이 화면에 «선택 가능한 옵션이 있는 것처럼» 보이게 만들고 있었다.
 *
 * 🟢 Shopify 경로는 이 모양을 **이미 버린다**(자리표시자 `Title=["Default Title"]`).
 *    JSON-LD 경로(`product-data-extractor.ts` 의 ProductGroup/hasVariant)만
 *    버리지 않아 갈라져 있었다. 그 갈라짐을 없앤다.
 *
 * 🔴 기준을 «완화하지 않는다». 값이 둘 이상인 축이 하나라도 있으면 그대로
 *    옵션이다 — 1×N · N×1 · N×M 은 전부 통과한다.
 */
export function hasRealOptionAxes(optionGroups: CanonicalProductOptionGroup[]): boolean {
  return optionGroups.length > 0 && !(optionGroups.length === 1 && optionGroups[0].values.length === 1);
}
