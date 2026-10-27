import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildDiscoverySearchQuery } from "@commerce/crawler/src/discovery-core/query-planner";
import type { ProductIdentity } from "@commerce/crawler/src/discovery-core/types";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/app/pipeline/commerce/__tests__/source-text";
import { isTransientShopId, TRANSIENT_SHOP_IDS, WEB_SEARCH_SHOP_ID } from "../transient-candidates";
import { collectWebSearchUrls, MAX_SEARCHES_PER_PRODUCT } from "../web-search-pool";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🟢🟢🟢 DISCOVERY-SEARCH-PROVIDER-07 — **Single Query 운영 배선 계약**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 확정(2026-10-27). 🔴 이 파일이 지키는 것은 **여섯** 이다:
 * ```
 * ① Query 는 `"{MODEL_CODE}"` **하나** 이고 owner 도 하나다
 * ② **1 Product = 1 Search** — 재시도·2차 질의·fallback 이 **없다**
 * ③ 「못 물어봤다」와 「결과 없다」를 **가른다**(실패를 0 으로 적지 않는다)
 * ④ 산출은 **일시 후보** 다 — `TRANSIENT_SHOP_IDS` 에 들어가 저장이 끊긴다
 * ⑤ 출처가 **여섯 번째 값** 으로 갈린다(유일한 유료 경로를 섞지 않는다)
 * ⑥ 🔴 **MODEL_CODE → SAME 이 아니다** — 판정 로직에 품번 지름길이 생기지 않는다
 * ```
 */

const LIB = join(__dirname, "..");
const src = (f: string) => stripComments(readFileSync(join(LIB, f), "utf8").replace(/\r\n/g, "\n"));

function identity(p: Partial<ProductIdentity>): ProductIdentity {
  return {
    brand: null,
    productName: null,
    productType: null,
    genderAge: null,
    color: null,
    size: null,
    season: null,
    productCode: null,
    sourceUrl: "",
    sourceSite: null,
    sourceCountry: null,
    market: null,
    ...p,
  };
}

describe("SP-07 §① Query — owner 는 하나이고 모양이 고정이다", () => {
  it('품번이 있으면 **정확히** `"{MODEL_CODE}"` 다', () => {
    expect(buildDiscoverySearchQuery(identity({ productCode: "B226AC010" }))).toBe('"B226AC010"');
    /** 🔴 브랜드·상품명·색상이 **있어도** 질의에 들어가지 않는다(국내가 사라지는 모양이다). */
    expect(
      buildDiscoverySearchQuery(
        identity({ productCode: "B226AC010", brand: "Bobo Choses", productName: "Booty Ghosts", color: "Grey" }),
      ),
    ).toBe('"B226AC010"');
  });

  it("🔴 품번이 없으면 **질의를 만들지 않는다** — 브랜드/상품명 fallback 이 없다", () => {
    expect(buildDiscoverySearchQuery(identity({ brand: "Bobo Choses", productName: "Booty Ghosts" }))).toBeNull();
    expect(buildDiscoverySearchQuery(identity({ productCode: "   " }))).toBeNull();
  });

  it("🔴 검색 생산자는 질의 문자열을 **직접 조립하지 않는다**(owner 하나)", () => {
    const code = src("web-search-pool.ts");
    expect(code).toContain("buildDiscoverySearchQuery");
    /** 🔴 품번을 따옴표로 감싸는 코드가 이 파일에 **또** 있으면 owner 가 둘이 된다. */
    expect(code).not.toMatch(/`"\$\{[^}]*code[^}]*\}"`/i);
  });
});

describe("SP-07 §② 1 Product = 1 Search", () => {
  it("상한 상수가 **1** 이다", () => {
    expect(MAX_SEARCHES_PER_PRODUCT).toBe(1);
  });

  it("성공해도 실패해도 검색 호출은 **정확히 1회** 다", async () => {
    let calls = 0;
    const ok = await collectWebSearchUrls({
      identity: identity({ productCode: "B226AC010" }),
      search: async () => {
        calls += 1;
        return ["https://shop.example/products/a"];
      },
    });
    expect(calls).toBe(1);
    expect(ok.metrics.searches).toBe(1);
    expect(ok.urls).toEqual(["https://shop.example/products/a"]);

    calls = 0;
    const bad = await collectWebSearchUrls({
      identity: identity({ productCode: "B226AC010" }),
      search: async () => {
        calls += 1;
        throw new Error("boom");
      },
    });
    /** 🔴 **재시도가 없다** — 실패해도 한 번이다. */
    expect(calls).toBe(1);
    expect(bad.metrics.failed).toBe(true);
  });

  it("🔴 결과가 적어도 **2차 질의를 만들지 않는다** — 코드에 fallback 분기가 없다", async () => {
    const queries: string[] = [];
    await collectWebSearchUrls({
      identity: identity({ productCode: "B226AC010", brand: "Bobo Choses", productName: "Booty Ghosts" }),
      search: async (q) => {
        queries.push(q);
        return [];
      },
    });
    expect(queries).toEqual(['"B226AC010"']);
    /** 🔴 소스에도 2차 검색 어휘가 없어야 한다(나중에 조용히 생기는 자리다). */
    const code = src("web-search-pool.ts");
    for (const w of ["retry", "fallback", "secondQuery", "widen"]) {
      expect(code.toLowerCase(), w).not.toContain(w.toLowerCase());
    }
  });
});

describe("SP-07 §③ 「못 물어봤다」와 「결과 없다」를 가른다", () => {
  it("품번이 없으면 `NO_MODEL_CODE` — 검색 0회", async () => {
    const r = await collectWebSearchUrls({ identity: identity({ brand: "X" }), search: async () => ["x"] });
    expect(r.metrics.skipped).toBe("NO_MODEL_CODE");
    expect(r.metrics.searches).toBe(0);
    expect(r.urls).toEqual([]);
  });

  it("🔴 토큰이 없으면 `NOT_CONFIGURED` — **「결과 0」이 아니다**", async () => {
    const r = await collectWebSearchUrls({ identity: identity({ productCode: "B226AC010" }), token: "" });
    expect(r.metrics.skipped).toBe("NOT_CONFIGURED");
    expect(r.metrics.searches).toBe(0);
    expect(r.metrics.failed).toBe(false);
  });

  it("🔴 실패는 `failed: true` 로 남는다 — 빈 결과와 **구별된다**", async () => {
    const failed = await collectWebSearchUrls({
      identity: identity({ productCode: "B226AC010" }),
      search: async () => {
        throw new Error("HTTP 500");
      },
    });
    const empty = await collectWebSearchUrls({
      identity: identity({ productCode: "B226AC010" }),
      search: async () => [],
    });
    expect(failed.metrics.failed).toBe(true);
    expect(empty.metrics.failed).toBe(false);
    expect(failed.urls).toEqual(empty.urls);
    /** 🔴 **URL 이 같아도 상태가 다르다** — 그 차이가 사라지면 거짓 결론이 난다. */
    expect(failed.metrics).not.toEqual(empty.metrics);
  });

  it("🔴 토큰이 로그/반환값에 **실리지 않는다**", async () => {
    const r = await collectWebSearchUrls({
      identity: identity({ productCode: "B226AC010" }),
      token: "SECRET-TOKEN-VALUE",
      search: async () => [],
    });
    expect(JSON.stringify(r)).not.toContain("SECRET-TOKEN-VALUE");
    const code = src("web-search-pool.ts");
    /** 🔴 오류 본문/응답 URL 을 찍으면 토큰이 새어 나간다(토큰이 쿼리스트링에 있다). */
    expect(code).not.toContain("console.log");
    expect(code).not.toContain("res.url");
  });
});

describe("SP-07 §④⑤ 일시 후보 · 출처 분리", () => {
  it("웹 검색 샵 id 가 **저장 차단 집합** 에 있다", () => {
    expect(TRANSIENT_SHOP_IDS.has(WEB_SEARCH_SHOP_ID)).toBe(true);
    expect(isTransientShopId(WEB_SEARCH_SHOP_ID)).toBe(true);
    /** 🔴 집합 전수 — 숫자만 고쳐 통과하는 길을 막는다. */
    for (const id of TRANSIENT_SHOP_IDS) expect(isTransientShopId(id)).toBe(true);
  });

  it("🔴 출처가 **여섯 번째 값** 으로 갈린다 — 「그 외는 Gemini」로 두지 않는다", () => {
    const code = src("run-domestic-price-check.ts");
    expect(code).toContain('"WEB_SEARCH"');
    expect(code).toContain("WEB_SEARCH_SHOP_ID");
    expect(code).toContain("webSearchEvidence");
    /** 🔴 유료 경로의 HTTP 를 다른 칸에 합산하지 않는다. */
    expect(code).toContain("webSearchPriceEnrichCalls");
  });

  it("🔴 **후보 생성 코드를 새로 만들지 않았다** — 기존 pool 을 그대로 쓴다", () => {
    const pool = src("web-search-pool.ts");
    for (const w of ["factsFromProductUrl", "withConfidence", "enrichCandidatePrices", "classifyUrlShape"]) {
      expect(pool, w).not.toContain(w);
    }
    const runner = src("run-domestic-price-check.ts");
    /** 🟢 웹 검색 URL 은 기존 `collectUrlCandidatePool` 로 들어간다. */
    expect(runner).toMatch(/shopId: WEB_SEARCH_SHOP_ID/);
  });
});

describe("SP-07 §⑥ 🔴🔴 Search 와 Identity 를 섞지 않는다", () => {
  it("검색 생산자에 판정 어휘가 **하나도 없다**", () => {
    const code = src("web-search-pool.ts");
    for (const w of ["SAME", "DIFFERENT", "matchTruth", "priceTier", "crossSeller", "verdict"]) {
      expect(code, w).not.toContain(w);
    }
  });

  it("🔴 Query owner 파일도 **판정을 하지 않는다**", () => {
    const planner = stripComments(
      readFileSync(
        join(LIB, "../../../../../../../packages/crawler/src/discovery-core/query-planner.ts"),
        "utf8",
      ).replace(/\r\n/g, "\n"),
    );
    for (const w of ["matchTruth", "priceTier", "SAME_MIN_AXES", "crossSeller"]) {
      expect(planner, w).not.toContain(w);
    }
  });
});

describe("SP-07 §호출부 — 켜는 곳이 «하나» 다", () => {
  /**
   * 🔴🔴 **이 계약이 비용을 지킨다.** `runDomesticPriceCheck` 호출부는 넷이고
   *    그중 **셋은 일괄/자동 경로** 다(스냅샷 생성 · 가격 재확인 · 일괄 트리거).
   *    거기서 켜지면 검색 과금이 **상품 수만큼** 곱해진다.
   */
  const CALLERS = [
    { file: "../check/route.ts", on: true },
    { file: "./trigger-domestic-price-check.ts", on: false },
    { file: "./run-price-check.ts", on: false },
    { file: "../../snapshots/route.ts", on: false },
  ] as const;

  it("`webSearch: true` 는 **「지금 확인」 라우트 하나** 에만 있다", () => {
    for (const c of CALLERS) {
      const code = stripComments(readFileSync(join(LIB, c.file), "utf8").replace(/\r\n/g, "\n"));
      if (c.on) expect(code, c.file).toContain("webSearch: true");
      else expect(code, `${c.file} 가 유료 검색을 켰다`).not.toContain("webSearch");
    }
  });
});
