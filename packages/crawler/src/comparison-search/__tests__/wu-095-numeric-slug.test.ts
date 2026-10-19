import { describe, expect, it } from "vitest";
import { withConfidence } from "../match";
import { deriveProductMatchTruth } from "../product-identity";
import { extractUrlSlug } from "@commerce/shared";
import type { ComparisonCandidate, ComparisonQuery } from "../types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-095 — **숫자만인 URL 세그먼트를 식별 신호로 쓰지 않는다** (네트워크 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 왜 (WU-094 실측): Cafe24 상품 URL 이 전부 `…/display/1/` 로 끝나서
 *    **서로 다른 사이트의 서로 다른 상품이 전부 slug `"1"`** 이 됐다. 그 결과
 *    ⒜ `score = Math.max(score, 0.95)` 가 무조건 발화 → `very_high`
 *    ⒝ `deriveProductMatchTruth` 가 **즉시 `EXACT_PRODUCT`** → 화면 🟢「동일상품」
 *
 * 🔴 이 계약은 **SAME 을 늘리지 않는다** — 거짓 신호를 **빼는** 것만 단언한다.
 *    (CPO §5: SAME threshold ❌ · 8축 ❌ · `very_high → SAME` ❌)
 */

/** 🟢 실제 운영 URL 모양 그대로(WU-093 실측). 손으로 단순화하지 않는다. */
const CAFE24_A = "https://biskuit.kr/product/보보쇼즈-허그-헤어리-몬스터-티셔츠-b226ac009/8891/category/367/display/1/";
const CAFE24_B = "https://www.looxloo.com/product/보보쇼즈-베이비-허그헤어리몬스터티셔츠-76a7d-l30-05/11453/category/28/display/1/";
/** 🟢 Shopify 는 고유 handle 이다 — **이쪽이 깨지면 안 된다**(1,402건 중 숫자 slug 1건). */
const SHOPIFY_A = "https://bobochoses.com/en-kr/products/b226ac042-mystery-bc-half-zipped-sweatshirt";
const SHOPIFY_B = "https://junioredition.com/products/b226ac042-mystery-bc-half-zipped-sweatshirt";

const cand = (url: string, title: string): ComparisonCandidate =>
  ({ title, url, price: null, imageUrl: null, sku: null }) as unknown as ComparisonCandidate;
const query = (url: string, title: string): ComparisonQuery =>
  ({ title, sourceUrl: url }) as unknown as ComparisonQuery;

describe("WU-095 ① 숫자 slug 는 confidence 를 올리지 못한다", () => {
  it("🔴 Cafe24 ↔ Cafe24 — 제목이 달라도 0.95 가 나오지 않는다", () => {
    const [c] = withConfidence(query(CAFE24_A, "허그 헤어리 몬스터 티셔츠"), [
      cand(CAFE24_B, "보보쇼즈 베이비 허그헤어리몬스터티셔츠"),
    ]);
    expect(c.confidence).toBeLessThan(0.95);
    expect(c.matchLevel).toBe("low");
    /** 🔴 **reasons 에도 남지 않는다** — 「모델명 유사도 0%」와 「URL slug 일치」가 공존하면 버그다. */
    expect((c.matchReasons ?? []).join(" ")).not.toContain("URL slug 일치");
  });

  it("🟢 Shopify 의 «진짜» handle 일치는 **그대로 살아 있다**", () => {
    const [c] = withConfidence(query(SHOPIFY_A, "Mystery BC half zipped sweatshirt"), [
      cand(SHOPIFY_B, "Mystery BC half zipped sweatshirt"),
    ]);
    expect((c.matchReasons ?? []).join(" ")).toContain("URL slug 일치");
    expect(c.confidence).toBeGreaterThanOrEqual(0.95);
    expect(c.matchLevel).toBe("very_high");
  });
});

describe("WU-095 ② 숫자 slug 는 EXACT_PRODUCT 를 만들지 못한다", () => {
  it("🔴 Cafe24 ↔ Cafe24 — 즉시 확정되지 않는다", () => {
    const t = deriveProductMatchTruth(
      query(CAFE24_A, "허그 헤어리 몬스터 티셔츠"),
      cand(CAFE24_B, "보보쇼즈 베이비 허그헤어리몬스터티셔츠"),
      0.1,
    );
    expect(t).not.toBe("EXACT_PRODUCT");
  });

  it("🟢 Shopify handle 일치는 **여전히** EXACT_PRODUCT 다", () => {
    const t = deriveProductMatchTruth(
      query(SHOPIFY_A, "Mystery BC half zipped sweatshirt"),
      cand(SHOPIFY_B, "Mystery BC half zipped sweatshirt"),
      0.9,
    );
    expect(t).toBe("EXACT_PRODUCT");
  });
});

describe("WU-095 ③ 공유 extractUrlSlug 도 같은 가드를 가진다", () => {
  it("🔴 숫자만인 세그먼트는 null 이다", () => {
    expect(extractUrlSlug(CAFE24_A)).toBeNull();
    expect(extractUrlSlug(CAFE24_B)).toBeNull();
    expect(extractUrlSlug("https://x.com/a/b/7417855")).toBeNull();
  });

  it("🟢 식별력 있는 slug 는 그대로다", () => {
    expect(extractUrlSlug(SHOPIFY_A)).toBe("b226ac042-mystery-bc-half-zipped-sweatshirt");
    expect(extractUrlSlug("https://x.com/p/some-item.html")).toBe("some-item");
  });

  it("🔴 세 함수가 **같은 판단** 을 한다 — 하나만 고치면 다른 경로에서 거짓 신호가 계속 난다", () => {
    /** 🟢 ①②③ 이 전부 Cafe24 쌍에서 「모른다」로 떨어지는 것을 **한 자리에서** 잠근다. */
    const [c] = withConfidence(query(CAFE24_A, "A"), [cand(CAFE24_B, "B")]);
    expect(c.matchLevel).toBe("low");
    expect(deriveProductMatchTruth(query(CAFE24_A, "A"), cand(CAFE24_B, "B"), 0.1)).not.toBe("EXACT_PRODUCT");
    expect(extractUrlSlug(CAFE24_A)).toBeNull();
  });
});
