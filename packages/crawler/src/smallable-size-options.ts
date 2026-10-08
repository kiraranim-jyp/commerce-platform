import type { Page } from "playwright-core";
import type { CanonicalProductOptionGroup, CanonicalProductVariant } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.5-B(CPO 승인, 2026-10-08) — **Smallable 사이즈 옵션의 «안전한» 경계.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일이 생긴 이유: Smallable 상품에는 사이즈가 «화면에 있는데» 수집이
 *    0이었다. 기존 세 경로가 전부 빗나간다 —
 *      JSON-LD hasVariant     없음
 *      itemprop="offers"      0개
 *      <select>               사이즈 축이 아님 (LI/BUTTON 으로 그린다)
 *
 * ── 🔴 「사이즈처럼 보이는 텍스트」를 긁지 않는다 ─────────────────────────
 * 그렇게 하면 내비게이션("Gifts 2-4 years")·추천상품("3/6 years")·다른 상품의
 * 사이즈(3M~24M)가 섞인다. 실측에서 23개가 섞였다.
 *
 * ── 🟢 대신 «접근성 신호» 로 경계를 잡는다 (실측 4건) ────────────────────
 *     Dalila 434530 (Louise Misha · 아우터)  listbox 1 · 행 6 · 밖 0
 *     Tender 434534 (Louise Misha · 아우터)  listbox 1 · 행 5 · 밖 0
 *     NB 530 428894 (New Balance · 신발)     listbox 1 · 행 13 · 밖 0
 *     GiftCard 82316                         listbox 1 (금액) · 🟢 정확히 배제
 *
 * 🔴 `role="listbox"` «만» 으로 잡으면 기프트카드 금액 선택지를 사이즈로 읽는다.
 *    `aria-labelledby` 에 `productSize` 가 함께 있어야 한다 — 그 둘이 한 쌍이다.
 * 🔴 CSS Module 해시(`___7vDk`)는 selector 로 쓰지 않는다. 빌드마다 바뀐다.
 *
 * ── 🔴 색상은 이 파일이 만들지 않는다 ───────────────────────────────────
 * Smallable 의 색상은 `ProductColorPicker_swatchLink` 이고 **다른 상품 URL** 로
 * 간다(실측: NB 530 의 색상 9개가 각각 다른 상품 ID). 같은 상품의 variant 가
 * 아니므로 옵션 축으로 만들지 않는다.
 *
 * ── 🔴 variant ID·SKU 를 «지어내지 않는다» ──────────────────────────────
 * DOM 에 없다(행 노드에 id/sku/data-* 속성 0개). 없는 것은 없는 대로 둔다.
 */

/** 🔴 해시에 의존하지 않는 유일한 선택자. 둘을 «함께» 요구한다. */
export const SMALLABLE_SIZE_LISTBOX_SELECTOR = '[role="listbox"][aria-labelledby*="productSize"]';

export interface SmallableSizeRow {
  size: string;
  /** 🔴 사이트 문구 «그대로». 수량으로 바꾸지 않는다 — 수량은 어디에도 없다. */
  stockStatus: string;
}

/**
 * 행 텍스트 하나를 `size` 와 `stockStatus` 로 가른다.
 *
 * 🔴 **순수 함수다.** DOM 없이 전 분기를 테스트할 수 있어야 한다 — 이 저장소에서
 *    소스 문자열 검사가 하중을 못 받은 사례가 둘 있었다(M4 · Y4).
 *
 * 실측 입력: `"2 years Only a few left"` · `"4 years In stock"` ·
 *            `"10 years Last item in stock"` · `"27,5EU In stock"`
 */
const STOCK_PHRASES = ["Last item in stock", "Only a few left", "Out of stock", "Sold out", "In stock"] as const;

export function parseSmallableSizeRow(raw: string): SmallableSizeRow | null {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return null;
  /* 🔴 긴 문구부터 본다 — "In stock" 을 먼저 찾으면 "Last item in stock" 이
     "Last item" + "in stock" 으로 갈려 사이즈가 오염된다. */
  for (const phrase of STOCK_PHRASES) {
    const at = text.toLowerCase().lastIndexOf(phrase.toLowerCase());
    if (at <= 0) continue;
    const size = text.slice(0, at).trim();
    if (!size) return null;
    return { size, stockStatus: text.slice(at).trim() };
  }
  return null;
}

/**
 * 행 목록 → `optionGroups` / `variants`.
 *
 * 🔴 축 이름은 `사이즈` 다 — 이 저장소의 기존 어휘이고(`resolveSizeFromOptions`
 *    가 `/size|사이즈/i` 로 치수 고시를 채운다), 새 이름을 만들지 않는다.
 * 🔴 값이 중복이거나 2개 미만이면 «만들지 않는다» — `offerRowsToOptions` 와
 *    같은 규약이다(고를 것이 없는 축은 옵션이 아니다).
 */
export function smallableRowsToOptions(rows: SmallableSizeRow[]): {
  optionGroups: CanonicalProductOptionGroup[];
  variants: CanonicalProductVariant[];
} | null {
  const values = rows.map((r) => r.size);
  if (values.length < 2) return null;
  if (new Set(values).size !== values.length) return null;
  return {
    optionGroups: [{ name: "사이즈", values }],
    variants: rows.map((r) => ({
      /* 🔴 식별자가 없다. 옵션값을 id 로 쓴다(위에서 중복이 없음을 확인했다) —
         `offerRowsToOptions` 가 SKU 가 없을 때 쓰는 그 규칙과 같다.
         🔴 sku 는 «넣지 않는다». DOM 에 없고, 지어내면 거짓이다. */
      id: r.size,
      optionValues: { 사이즈: r.size },
    })),
  };
}

/**
 * 페이지에서 Smallable 사이즈 옵션을 읽는다. 없으면 `null`.
 *
 * 🔴 listbox 가 둘 이상이면 «만들지 않는다» — 실측 4건은 전부 1개였고, 둘이면
 *    어느 것이 이 상품의 축인지 우리가 정할 근거가 없다(다축 상품 미확보).
 */
export async function extractSmallableSizeOptions(page: Page): Promise<{
  optionGroups: CanonicalProductOptionGroup[];
  variants: CanonicalProductVariant[];
} | null> {
  const texts = await page
    .evaluate((selector) => {
      const boxes = [...document.querySelectorAll(selector)];
      if (boxes.length !== 1) return null;
      /* 🔴 listbox «내부» 만 본다. 바깥 사이즈 문자열은 실측에서 0이었고,
         그것이 이 경계가 안전한 이유다. */
      const rows = [...boxes[0].querySelectorAll("*")].filter((el) =>
        [...el.classList].some((c) => c.startsWith("ProductSizeSelector_sizeContainer")),
      );
      return rows.map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim());
    }, SMALLABLE_SIZE_LISTBOX_SELECTOR)
    .catch(() => null);
  if (!texts) return null;
  const rows = texts.map(parseSmallableSizeRow).filter((r): r is SmallableSizeRow => r !== null);
  return smallableRowsToOptions(rows);
}
