import type { CanonicalProductOptionGroup, CanonicalProductVariant } from "@commerce/shared";
import { hasRealOptionAxes } from "./utils/real-option-axes";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.6 Phase 1(CPO 승인, 2026-10-09) — **사이트별 추출 결과가 지나는 «한 문».**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 옵션을 만드는 경로가 다섯이다 —
 *
 *   shopify-product-json.ts        Shopify `options`/`variants`
 *   prestashop.site-strategy.ts    `var combinations`
 *   product-data-extractor.ts      JSON-LD hasVariant · DOM select · microdata offers · 본문
 *   smallable-size-options.ts      `role=listbox[aria-labelledby*=productSize]`
 *
 * 🔴 다섯이 각자 `CanonicalProduct` 로 흘러들어서, 한 경로에만 생긴 규칙이
 *    다른 경로에 없다. 실제로 그런 일이 있었다 — Shopify 는 1축×1값을 버리는데
 *    JSON-LD 경로는 버리지 않아 Smallable 21건이 「고를 수 없는 색상 축」으로
 *    저장됐다(P5.5-B B-3 에서 공용 판정으로 모아 고쳤다).
 *
 * ── 🔴 이 파일이 하는 일 ────────────────────────────────────────────────────
 * **추출하지 않는다.** 이미 추출된 결과가 CanonicalProduct 에 닿기 «직전» 에
 * 지나는 한 문일 뿐이다. 그래서 어떤 사이트 전략도 고치지 않고, 어떤 결과도
 * 새로 만들지 않는다 — 걸러내고 정리만 한다.
 *
 * ── 🔴 하지 않는 것 ────────────────────────────────────────────────────────
 *   · 축 이름을 바꾸지 않는다(「사이즈」·「Size」·「옵션」을 통일하지 않는다).
 *     사이트가 쓴 말이 셀러가 보는 말이고, 통일하면 그 근거가 사라진다.
 *   · 값을 번역·정규화하지 않는다("2 years" 를 "2Y" 로 바꾸지 않는다).
 *   · 없는 variant 를 만들지 않는다. variants 가 비면 비운 채로 둔다.
 */

export interface NormalizedOptions {
  optionGroups: CanonicalProductOptionGroup[];
  variants: CanonicalProductVariant[];
}

/** 원본 그대로 유지하되 «쓸 수 없는» 것만 떨어내는 규칙. */
export function normalizeOptionModel(
  optionGroups: CanonicalProductOptionGroup[] | undefined,
  variants: CanonicalProductVariant[] | undefined,
): NormalizedOptions {
  /* ① 이름이 없거나 값이 없는 축은 축이 아니다 — 셀러가 고를 것이 없다.
     🔴 값 «안» 의 빈 문자열도 뺀다. 빈 옵션값은 채널이 거절한다
        (offerRowsToOptions 가 같은 이유로 포기하는 그 조건이다). */
  const cleanedGroups = (optionGroups ?? [])
    .map((g) => ({
      ...g,
      values: Array.from(new Set((g.values ?? []).map((v) => (v ?? "").trim()).filter(Boolean))),
    }))
    .filter((g) => (g.name ?? "").trim().length > 0 && g.values.length > 0);

  /* ② 🔴 「고를 수 있는 축」 판정은 «새로 만들지 않는다» — Shopify 경로가 쓰던
     그 함수를 그대로 쓴다. 1축×1값은 옵션이 아니다. */
  if (!hasRealOptionAxes(cleanedGroups)) {
    return { optionGroups: [], variants: [] };
  }

  /* ③ variant 는 «축에 있는 값» 만 가리킬 수 있다. 축에 없는 값을 가리키는
     조합은 타입 계약이 깨진 것이고, 그대로 두면 채널 payload 에서 터진다.
     🔴 고쳐서 살리지 않는다 — 어느 값이 맞는지 우리가 모른다. 떨어낸다. */
  const allowed = new Map(cleanedGroups.map((g) => [g.name, new Set(g.values)]));
  const cleanedVariants = (variants ?? []).filter((v) => {
    const entries = Object.entries(v.optionValues ?? {});
    if (entries.length === 0) return false;
    return entries.every(([axis, value]) => allowed.get(axis)?.has(value) === true);
  });

  /* 🔴 variants 가 전부 떨어져도 축은 남긴다 — 축은 사이트가 실제로 보여 준
     선택지이고, 조합 정보가 없다는 것이 축이 없다는 뜻은 아니다
     (Smallable 이 그렇다: 사이즈는 있고 variant 식별자는 없다). */
  return { optionGroups: cleanedGroups, variants: cleanedVariants };
}
