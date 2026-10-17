import { describe, expect, it } from "vitest";
import { compareCrossSellerProducts, productFactsFromListing } from "@commerce/crawler";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-057 축 A — **`BRAND_UNCONFIRMED` 는 왜 EXACT 를 막는가** (현재 동작 고정)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🟢 원인은 **두 줄** 이다(`cross-seller.ts`):
 * ```
 * :751  brandKnown = Boolean(x.brand && y.brand)      ← **한쪽만 비어도 false**
 * :999  if (!brandKnown) blockers.push(BRAND_UNCONFIRMED)
 * :1079 if (!blocked && brandOk && corePoints >= SAME_MIN_AXES) return "SAME"
 * :920  identifierBackedCrossSeller = **brandOk** && modelCode === "exact" && …
 * ```
 * ⟹ 🔴 **품번이 exact 여도 `brandOk` 가 false 면 SAME 에 닿지 못한다.**
 *
 * ── 🔴 GT 51건 전수조사 (WU-057 §1) ────────────────────────────────────────
 * ```
 * BRAND_UNCONFIRMED  **11건** · 빈 쪽이 둘로 갈린다
 *   CANDIDATE 가 빔  6  (origin brand 있음)   품번O·SAME 5 · 품번X·DIFFERENT 1
 *   ORIGIN 이 빔     5  (🔴 원상품 brand = null) 품번O·SAME 2+GT없음1 · 품번X·DIFFERENT 2
 * ⟹ 품번 O → Human **SAME 7/7** · 품번 X → Human **DIFFERENT 3/3**
 * ```
 * 🔴🔴 **그래도 완화하지 않았다. 이유 둘을 테스트로 적는다**:
 * ```
 * ① 품번 O 그룹에 Human DIFFERENT 가 **0** 이다 → **FP 분모가 없다**
 *    ⟹ 「False SAME 증가 없음」을 **증명할 수 없다**(§5-B · CPO §11 HOLD 조건)
 * ② 후보 쪽 brand 를 «채우는» 길은 **판매처명 오염** 으로 간다 — 실측 증거가 있다:
 *    `biskuit.kr` 의 후보 brand 가 **"비스킷"**(= 샵 이름)이었다. 원상품 brand 가
 *    null 이라 BRAND_MISMATCH 를 **면한** 것이고, 브랜드를 채우면 **오히려 더 막힌다.**
 *    (WU-034 의 「추정 ↔ 확인을 섞지 않는다」가 데이터로 재확인됐다)
 * ```
 */

const ORIGIN = productFactsFromListing({
  title: "Booty Ghosts Long Sleeve T-Shirt",
  url: "https://www.junioredition.com/en-kr/products/booty-ghosts-long-sleeve-t-shirt",
  brand: "Bobo Choses",
});

/** 🔴 국내 후보 — 제목에 품번이 있고 **브랜드는 비어 있다**(구조화 데이터 0인 샵). */
const CANDIDATE_NO_BRAND = productFactsFromListing({
  title: "보보쇼즈 26FW 아동 긴팔 티셔츠 Booty Ghosts T-shirt B226AC010",
  url: "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014021",
  brand: undefined,
});

const withCode = (f: ReturnType<typeof productFactsFromListing>, code: string) => ({
  ...f,
  brandModelCode: code,
});

describe("A. 현재 동작 — 품번이 맞아도 브랜드 미확인이면 SAME 이 아니다", () => {
  it("🔴 BRAND_UNCONFIRMED 가 blockers 에 남고 verdict 가 SAME 이 아니다", () => {
    const r = compareCrossSellerProducts(
      withCode(ORIGIN, "B226AC010") as never,
      withCode(CANDIDATE_NO_BRAND, "B226AC010") as never,
    );
    const blockers = (r.blockers ?? []).map((b: { blocker: string }) => b.blocker);
    expect(blockers).toContain("BRAND_UNCONFIRMED");
    expect(r.verdict).not.toBe("SAME");
  });

  /** 🟢 그리고 그것이 **보수적 동작** 이다 — 「다르다」로 단정하지도 않는다. */
  it("🟢 CONFLICT 로 단정하지 않는다 — 보류다", () => {
    const r = compareCrossSellerProducts(
      withCode(ORIGIN, "B226AC010") as never,
      withCode(CANDIDATE_NO_BRAND, "B226AC010") as never,
    );
    expect(r.verdict).not.toBe("CONFLICT");
  });

  /** 🟢 양쪽 브랜드가 **있고 맞으면** 같은 입력에서 SAME 에 닿는다(게이트가 브랜드 하나다). */
  it("🟢 브랜드를 확인하면 같은 입력이 SAME 이 된다", () => {
    const withBrand = productFactsFromListing({
      title: "보보쇼즈 26FW 아동 긴팔 티셔츠 Booty Ghosts T-shirt B226AC010",
      url: "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014021",
      brand: "Bobo Choses",
    });
    const r = compareCrossSellerProducts(
      withCode(ORIGIN, "B226AC010") as never,
      withCode(withBrand, "B226AC010") as never,
    );
    const blockers = (r.blockers ?? []).map((b: { blocker: string }) => b.blocker);
    expect(blockers).not.toContain("BRAND_UNCONFIRMED");
  });
});

describe("B. 🔴🔴 완화하지 않은 이유 — 판매처명 오염 실증", () => {
  /**
   * 🔴 `biskuit.kr` 후보의 brand 가 **"비스킷"**(샵 이름)으로 읽혔다(GT 실측).
   *    브랜드를 「채우는」 쪽으로 가면 이런 값이 브랜드가 되고, 그때는
   *    `BRAND_UNCONFIRMED` 가 **`BRAND_MISMATCH` 로 바뀐다** — 더 막힌다.
   */
  it("🔴 샵 이름을 브랜드로 채우면 BRAND_MISMATCH 로 «더» 막힌다", () => {
    const shopNameAsBrand = productFactsFromListing({
      title: "보보쇼즈 BC 엠보스 트랙수트 자켓 B226AC117",
      url: "https://biskuit.kr/product/x/9445/category/70/display/1/",
      brand: "비스킷",
    });
    const r = compareCrossSellerProducts(
      withCode(ORIGIN, "B226AC117") as never,
      withCode(shopNameAsBrand, "B226AC117") as never,
    );
    const blockers = (r.blockers ?? []).map((b: { blocker: string }) => b.blocker);
    expect(blockers).toContain("BRAND_MISMATCH");
    expect(blockers).not.toContain("BRAND_UNCONFIRMED");
    expect(r.verdict).not.toBe("SAME");
  });

  /**
   * 🔴 그러므로 「품번만 맞으면 SAME」은 **채택하지 않았다**(CPO §4 금지).
   *    이 단언은 그 금지를 **코드로** 고정한다 — 누가 게이트를 풀면 여기서 깨진다.
   */
  it("🔴🔴 품번 exact 만으로 SAME 이 되지 않는다 (게이트 고정)", () => {
    const r = compareCrossSellerProducts(
      withCode(ORIGIN, "B226AC010") as never,
      withCode(CANDIDATE_NO_BRAND, "B226AC010") as never,
    );
    expect(r.verdict).not.toBe("SAME");
  });
});
