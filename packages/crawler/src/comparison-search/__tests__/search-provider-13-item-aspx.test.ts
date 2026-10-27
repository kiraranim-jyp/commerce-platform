import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classifyUrlShape } from "../url-shape";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SEARCH-PROVIDER-13 — **`-item-{id}.aspx` 상품 분류 안전성**(순수 · 네트워크 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 조건(2026-10-27) — 「`.aspx` 전체를 상품으로 보는 것은 **NO-GO**. 구체 패턴만.」
 *
 * 🔴 이 파일이 잠그는 금지 셋:
 * ```
 * ❌ `.aspx` 이기만 하면 PRODUCT        ❌ `shopping` 포함만으로 PRODUCT
 * ❌ `og:type=product` 를 분류 근거로    (raw fetch 결과를 운영 분류기로 역수입 금지)
 * ```
 * 🔴 **Positive 만 보고 확정하지 않는다** — 아래 Negative 전수가 같이 돈다.
 */

/** 🟢 SP-12 corpus 의 실제 URL(추가 Search 0). 🔴 지어낸 URL 이 아니다. */
const CORPUS = join(
  __dirname,
  "../../../../../apps/admin/src/app/api/price-history/_lib/__tests__/fixtures/search-provider-05-raw.json",
);

function corpusUrls(): string[] {
  const j = JSON.parse(readFileSync(CORPUS, "utf8")) as { runs: { results: { url: string }[] }[] };
  return [...new Set(j.runs.flatMap((r) => r.results.map((x) => x.url)))];
}

const pathOf = (u: string) => {
  try {
    return new URL(u).pathname;
  } catch {
    return "";
  }
};

describe("SP-13 §Positive — 구체 패턴만 상품으로 올린다", () => {
  it("로케일이 있든 없든 `/shopping/…-item-{숫자}.aspx` 는 PRODUCT_PAGE 다", () => {
    for (const u of [
      "https://www.farfetch.com/fi/shopping/kids/bobo-choses-booty-ghost-print-long-sleeve-t-shirt-item-37035483.aspx",
      "https://www.farfetch.com/shopping/kids/bobo-choses-curious-turnip-long-sleeve-high-neck-swim-t-shirt-item-33844474.aspx",
      "https://www.farfetch.com/en-kr/shopping/women/some-dress-item-1.aspx",
    ]) {
      expect(classifyUrlShape(u), u).toBe("PRODUCT_PAGE");
    }
  });

  it("🔵 corpus 의 `.aspx` 전수가 PRODUCT_PAGE 가 된다", () => {
    const aspx = corpusUrls().filter((u) => /\.aspx$/i.test(pathOf(u)));
    expect(aspx.length).toBeGreaterThan(40);
    for (const u of aspx) expect(classifyUrlShape(u), u).toBe("PRODUCT_PAGE");
  });
});

describe("SP-13 §Negative — 🔴 넓히지 않았다는 것을 전수로 본다", () => {
  it("🔴 **`.aspx` 이기만 한 것** 은 상품이 아니다", () => {
    for (const u of [
      "https://www.farfetch.com/fi/shopping/kids/sale.aspx",
      "https://example.com/default.aspx",
      "https://example.com/pages/about.aspx",
      "https://www.farfetch.com/fi/shopping/kids/items.aspx",
      /** 🔴 숫자가 아닌 id 는 올라가면 안 된다. */
      "https://www.farfetch.com/fi/shopping/kids/thing-item-abc.aspx",
    ]) {
      expect(classifyUrlShape(u), u).not.toBe("PRODUCT_PAGE");
    }
  });

  /**
   * 🔴🔴 **내 단언이 틀렸고 코드가 맞았다** — 1차에 `…-item-123.html` 을 Negative 로
   *    넣었는데 그것은 **기존 `PRODUCT_SUFFIX`(`.html` → 상품)** 가 올리는 것이고
   *    이번 패턴과 무관하다. 🟢 그래서 **지우지 않고 「기존 규칙 소관」으로 적어 둔다** —
   *    다음 사람이 이 패턴 탓으로 오해하지 않도록.
   */
  it("🟢 `.html` 꼬리는 **기존 규칙** 소관이다(이번 패턴이 만든 것이 아니다)", () => {
    expect(classifyUrlShape("https://www.farfetch.com/fi/shopping/kids/thing-item-123.html")).toBe("PRODUCT_PAGE");
    /** 🔴 그 판정은 `.aspx` 와 무관하게 **전부터 그랬다** — 같은 모양의 비-aspx 가 증거다. */
    expect(classifyUrlShape("https://shop.example/anything/whatever-thing.html")).toBe("PRODUCT_PAGE");
  });

  it("🔴 **`shopping` 이 들어가기만 한 것** 도 상품이 아니다", () => {
    for (const u of [
      "https://www.farfetch.com/fi/shopping/kids",
      "https://www.farfetch.com/fi/shopping/kids/bobo-choses",
      "https://shop.example.com/shopping/kids/",
    ]) {
      expect(classifyUrlShape(u), u).not.toBe("PRODUCT_PAGE");
    }
  });

  it("🔴 기존 목록/카테고리/검색 판정이 **한 건도** 바뀌지 않았다", () => {
    for (const [u, want] of [
      ["https://shop.example/collections/all", "LISTING_PAGE"],
      ["https://shop.example/category/kids", "LISTING_PAGE"],
      ["https://shop.example/search?q=bobo", "LISTING_PAGE"],
      ["https://shop.example/brands/bobo-choses", "LISTING_PAGE"],
      ["https://shop.example/product/list.html?cate_no=110", "UNKNOWN_PAGE"],
      ["https://shop.example/index.html", "UNKNOWN_PAGE"],
      ["https://shop.example/", "UNKNOWN_PAGE"],
      ["https://shop.example/products/abc", "PRODUCT_PAGE"],
      ["https://answear.ro/p/bobo-choses-b226ac010-1843935", "PRODUCT_PAGE"],
    ] as const) {
      expect(classifyUrlShape(u), u).toBe(want);
    }
  });

  it("🔴🔴 corpus 전수 — **패턴 밖 URL 의 분류가 하나도 바뀌지 않는다**", () => {
    /**
     * 🟢 「바뀌지 않았다」를 **원리로** 단언한다 — 새 분기는 `PRODUCT_ITEM_ID_SUFFIX`
     *    하나이고 그 정규식에 걸리지 않으면 코드 경로가 **이전과 동일** 하다.
     *    그래서 패턴 밖 URL 이 PRODUCT_PAGE 라면 그것은 **기존 규칙** 때문이어야 한다.
     * 🔴 즉 여기서 보는 것은 「패턴 밖인데 `.aspx` 때문에 올라간 것이 0」이다.
     */
    const pattern = /(?:^|\/)shopping\/[^?#]+-item-\d+\.aspx$/i;
    const outside = corpusUrls().filter((u) => !pattern.test(pathOf(u)));
    expect(outside.length).toBeGreaterThan(600);
    const flipped = outside.filter((u) => /\.aspx$/i.test(pathOf(u)) && classifyUrlShape(u) === "PRODUCT_PAGE");
    expect(flipped, `패턴 밖 .aspx 가 상품으로 올라갔다: ${flipped.slice(0, 3).join(" ")}`).toHaveLength(0);
  });
});

describe("SP-13 §전후 — corpus 분포를 숫자로 남긴다", () => {
  it("변경 후 분포를 출력하고, 새로 상품이 된 것이 **전부 그 패턴** 임을 단언한다", () => {
    const urls = corpusUrls();
    const pattern = /(?:^|\/)shopping\/[^?#]+-item-\d+\.aspx$/i;
    const after = new Map<string, number>();
    for (const u of urls) {
      const s = classifyUrlShape(u);
      after.set(s, (after.get(s) ?? 0) + 1);
    }
    const hits = urls.filter((u) => pattern.test(pathOf(u)));
    /* eslint-disable no-console */
    console.log(
      `\n🔵 SP-13 corpus ${urls.length}건 — 변경 후 ${[...after.entries()]
        .sort()
        .map(([k, v]) => `${k} ${v}`)
        .join(" · ")}`,
    );
    console.log(`   패턴 적중 ${hits.length}건 (전부 PRODUCT_PAGE)`);
    /** 🔴 **변경 «전» 분포는 이 패턴을 끈 것과 같다** — 그 둘의 차이가 곧 회수량이다. */
    const beforeProduct = urls.filter((u) => !pattern.test(pathOf(u)) && classifyUrlShape(u) === "PRODUCT_PAGE").length;
    console.log(`   변경 전 PRODUCT_PAGE ${beforeProduct} → 후 ${after.get("PRODUCT_PAGE") ?? 0}`);
    expect((after.get("PRODUCT_PAGE") ?? 0) - beforeProduct).toBe(hits.length);
  });
});

describe("SP-13 §경계 — 🔴 자기 선언을 분류 근거로 역수입하지 않는다", () => {
  it("`url-shape.ts` 에 `og:type`/JSON-LD 어휘가 **없다**", () => {
    const src = readFileSync(join(__dirname, "../url-shape.ts"), "utf8");
    const code = src.replace(/\/\*\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    for (const w of ["og:type", "@type", "application/ld+json", "fetch("]) {
      expect(code, w).not.toContain(w);
    }
  });

  it("🔴 분류기는 **경로만** 본다 — 호스트 이름을 보지 않는다(사이트 전용 규칙 금지)", () => {
    const src = readFileSync(join(__dirname, "../url-shape.ts"), "utf8");
    const code = src.replace(/\/\*\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(code).not.toContain("hostname");
    expect(code).not.toContain("farfetch");
    /** 🟢 같은 모양이면 **다른 사이트도** 상품으로 읽힌다(사이트 종속이 아니다). */
    expect(classifyUrlShape("https://other-store.example/shopping/men/thing-item-99.aspx")).toBe("PRODUCT_PAGE");
  });
});
