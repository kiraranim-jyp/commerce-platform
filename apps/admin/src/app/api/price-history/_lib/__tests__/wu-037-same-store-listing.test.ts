import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isSameStoreListingAcrossMarkets, withConfidence } from "@commerce/crawler";
import type { ProductFacts } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-037 — **같은 브랜드 스토어의 「같은 listing, 다른 시장」** 계약
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 Human GT(WU-036)가 만든 요구다. CPO §12 가 CONTROL 로 지정했다:
 * ```
 * 자기동일 4쌍  C09 · C12 · C17 · C48  → **전부 SAME**
 * ```
 * C48(`bobochoses.co.jp` ↔ `bobochoses.com`, 같은 handle)만 `BRAND_UNCONFIRMED`
 * 로 막혀 그 CONTROL 을 어기고 있었다. 축은 **8개가 전부 일치** 했는데도.
 *
 * 🔴🔴 **이 파일이 같이 잠그는 금지 사항**(CPO §2 P0-2):
 * ```
 * 품번 동일만으로 SAME 금지 · 브랜드+모델 동일만으로 SAME 금지 ·
 * 색상 차이를 무시한 SAME 금지 · threshold 완화 0
 * ```
 */

const base: ProductFacts = {
  sourceUrl: "",
  urlSlug: null,
  brand: null,
  brandModelCode: null,
  sellerSku: null,
  title: "",
  coreTitleTokens: [],
  categoryText: null,
  colorText: null,
  materialText: null,
  fitText: null,
  ageRangeText: null,
  sizeLabels: [],
  audienceSignals: [],
  imageUrls: [],
};

/* ══════════════ A. 술어 — 라벨«과» 경로가 둘 다 같을 때만 참 ══════════════ */

describe("A. isSameStoreListingAcrossMarkets", () => {
  it("🟢 같은 브랜드 스토어의 같은 handle — TLD 만 다르다", () => {
    expect(
      isSameStoreListingAcrossMarkets(
        "https://bobochoses.co.jp/products/b226ac117-b-c-embossed-tracksuit-jacket",
        "https://bobochoses.com/products/b226ac117-b-c-embossed-tracksuit-jacket",
      ),
    ).toBe(true);
  });

  it("🟢 로케일 접두사와 collections 세그먼트는 시장 차이라 걷어낸다", () => {
    expect(
      isSameStoreListingAcrossMarkets(
        "https://www.junioredition.com/en-kr/collections/bobo-choses/products/x-tee",
        "https://www.junioredition.com/products/x-tee",
      ),
    ).toBe(true);
  });

  it("🟢 www · m · global 접두사는 같은 스토어다", () => {
    expect(isSameStoreListingAcrossMarkets("https://www.foo.com/products/a", "https://m.foo.com/products/a")).toBe(true);
  });

  /** 🔴🔴 **경로가 다르면 거짓** — 멀티브랜드 리테일러의 «다른 상품» 이 브랜드를
   *     물려받는 것을 막는 것이 이 조건이다. 라벨만으로는 절대 부족하다. */
  it("🔴 같은 스토어라도 상품이 다르면 거짓", () => {
    expect(
      isSameStoreListingAcrossMarkets(
        "https://www.junioredition.com/en-kr/products/bubble-sweatshirt-in-grey-melange-by-main-story",
        "https://www.junioredition.com/products/bubble-sweatshirt-in-graystone-by-main-story",
      ),
    ).toBe(false);
  });

  it("🔴 경로가 같아도 스토어가 다르면 거짓", () => {
    expect(isSameStoreListingAcrossMarkets("https://a.com/products/x", "https://b.com/products/x")).toBe(false);
  });

  it("🔴 비슷한 이름의 다른 도메인은 거짓", () => {
    expect(
      isSameStoreListingAcrossMarkets("https://bobochoses.com/products/x", "https://bobochoses-fake.com/products/x"),
    ).toBe(false);
  });

  it("🔴 루트/빈 경로로는 참이 되지 않는다", () => {
    expect(isSameStoreListingAcrossMarkets("https://foo.com/", "https://foo.co.jp/")).toBe(false);
  });

  it("🔴 깨진 URL 에 던지지 않는다", () => {
    expect(isSameStoreListingAcrossMarkets("not a url", "https://foo.com/products/x")).toBe(false);
  });
});

/* ══════════════ B. 운영 경로(withConfidence)를 실제로 통과한다 ══════════════ */

/** 🟢 C48 재현 — 값은 WU-036 캐시 실측에서 온 것이다(지어내지 않았다). */
const ORIGIN_C48: ProductFacts = {
  ...base,
  sourceUrl: "https://bobochoses.co.jp/products/b226ac117-b-c-embossed-tracksuit-jacket",
  /** 🔴 `.co.jp` 가 brand 칸에 시즌코드 `SS26` 을 적어 resolver 가 거부했다 → null */
  brand: null,
  brandModelCode: "B226AC117",
  title: "B.C. Embossed tracksuit jacket",
  coreTitleTokens: ["embossed", "tracksuit", "jacket"],
  categoryText: "Jacket",
  colorText: "Blue",
  materialText: "100% Organic Cotton",
  fitText: "relaxed",
  sizeLabels: ["2-3Y", "4-5Y"],
  audienceSignals: ["kids"],
};

const candidateFactsC48: ProductFacts = {
  ...ORIGIN_C48,
  sourceUrl: "https://bobochoses.com/products/b226ac117-b-c-embossed-tracksuit-jacket",
  brand: "Bobo Choses",
};

const runCross = (origin: ProductFacts, candFacts: ProductFacts) =>
  withConfidence(
    { title: origin.title, brand: origin.brand ?? undefined, sourceUrl: origin.sourceUrl, facts: origin },
    [
      {
        title: candFacts.title,
        url: candFacts.sourceUrl,
        price: null,
        imageUrl: null,
        confidence: 0,
        brand: candFacts.brand ?? undefined,
        facts: candFacts,
      } as never,
    ],
  )[0];

describe("B. withConfidence — 같은 스토어 listing 이면 브랜드가 «확인» 된다", () => {
  it("🟢 C48: 원상품 brand 가 비어 있어도 SAME 에 도달한다", () => {
    const out = runCross(ORIGIN_C48, candidateFactsC48);
    expect(out.crossSellerBlockers?.map((b) => (typeof b === "string" ? b : b.blocker))).not.toContain(
      "BRAND_UNCONFIRMED",
    );
    expect(out.crossSellerVerdict).toBe("SAME");
  });

  /** 🔴 **다른 상품이면 그대로 막힌다** — 경로가 다르므로 술어가 거짓이다. */
  it("🔴 같은 스토어의 «다른 상품» 에는 브랜드가 번지지 않는다", () => {
    const other: ProductFacts = {
      ...candidateFactsC48,
      sourceUrl: "https://bobochoses.com/products/b226ac160-bobo-choses-embossed-hoodie",
      brandModelCode: "B226AC160",
      title: "Bobo Choses Embossed hoodie",
      coreTitleTokens: ["embossed", "hoodie"],
    };
    const out = runCross(ORIGIN_C48, other);
    expect(out.crossSellerVerdict).not.toBe("SAME");
  });

  /** 🔴🔴 **색상이 다르면 같은 스토어라도 SAME 이 아니다**(CPO §2 P0-2 · C06 교훈). */
  it("🔴 같은 handle 이라도 색상이 다르면 SAME 이 아니다", () => {
    const out = runCross({ ...ORIGIN_C48, colorText: "Blue" }, { ...candidateFactsC48, colorText: "Red" });
    expect(out.crossSellerVerdict).not.toBe("SAME");
  });

  /**
   * 🔴🔴 **측정으로 드러난 한계를 테스트로 «적어 둔다».** 처음에 이 단언을
   *    `"Grey Melange"` ↔ `"Conker Stripe"` 로 썼는데 **SAME 이 나왔다** —
   *    comparator 가 모르는 색상 문자열은 `MISMATCH` 가 아니라 **UNKNOWN** 이라
   *    충돌을 만들지 않기 때문이다. 🔴 이것은 이 WU 가 고치는 범위가 아니다
   *    (색상 사전 확대 = CPO 금지). 성질을 고정해 다음 사람이 다시 밟지 않게 한다.
   */
  it("🟡 알 수 없는 색상 문자열은 «다름» 이 아니라 «모름» 이다 (현재 성질)", () => {
    const out = runCross({ ...ORIGIN_C48, colorText: "Grey Melange" }, { ...candidateFactsC48, colorText: "Conker Stripe" });
    expect(out.crossSellerConflicts?.map((c) => (typeof c === "string" ? c : c.conflict))).not.toContain("COLOR");
  });

  /** 🔴 **원상품 brand 가 이미 있으면 덮어쓰지 않는다** — 확인이지 주입이 아니다. */
  it("🔴 원상품 brand 가 있으면 건드리지 않는다", () => {
    const originWithBrand: ProductFacts = { ...ORIGIN_C48, brand: "Bobo Choses" };
    const candOtherBrand: ProductFacts = { ...candidateFactsC48, brand: "Main Story" };
    const out = runCross(originWithBrand, candOtherBrand);
    expect(out.crossSellerVerdict).not.toBe("SAME");
  });

  /** 🔴 **양쪽 다 비어 있으면 아무것도 만들지 않는다.** */
  it("🔴 양쪽 brand 가 없으면 브랜드를 지어내지 않는다", () => {
    const out = runCross(ORIGIN_C48, { ...candidateFactsC48, brand: null });
    const blockers = out.crossSellerBlockers?.map((b) => (typeof b === "string" ? b : b.blocker)) ?? [];
    expect(blockers).toContain("BRAND_UNCONFIRMED");
  });
});

/* ══════════════ C. 🔴 소스 가드 — 술어까지 잠근다 ══════════════ */

describe("C. 적용 조건이 소스에서 유지된다", () => {
  /** 🔴 경로를 세어 올라가다 틀렸다 — repo 루트를 «찾아서» 쓴다(한 칸 밀려도 깨지지 않는다). */
  const repoRoot = (() => {
    let dir = __dirname;
    for (let i = 0; i < 12; i++) {
      if (existsSync(path.join(dir, "packages", "crawler", "src", "comparison-search", "match.ts"))) return dir;
      dir = path.dirname(dir);
    }
    throw new Error("repo 루트를 찾지 못했다");
  })();
  const src = readFileSync(path.join(repoRoot, "packages", "crawler", "src", "comparison-search", "match.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  /** 🔴 **대입문만 보면 `if (false)` 로 죽여도 통과한다** — 술어를 단언한다
   *    (메모 source-guard-must-lock-the-predicate). */
  it("라벨«과» 경로를 둘 다 요구한다", () => {
    const fn = src.slice(src.indexOf("export function isSameStoreListingAcrossMarkets"));
    const body = fn.slice(0, fn.indexOf("\n}"));
    expect(body).toContain("lo !== lc");
    expect(body).toContain("po === pc");
    expect(body).toMatch(/po\.length\s*>\s*1/);
  });

  it("원상품 brand 가 비었을 때«만» 채운다", () => {
    expect(src).toContain("sameStoreListing && !query.facts!.brand && !!c.facts!.brand");
  });

  it("브랜드 확인이 없으면 query.facts 를 그대로 쓴다", () => {
    expect(src).toContain("brandConfirmedAcrossMarkets");
    expect(src).toMatch(/:\s*query\.facts;/);
  });
});
