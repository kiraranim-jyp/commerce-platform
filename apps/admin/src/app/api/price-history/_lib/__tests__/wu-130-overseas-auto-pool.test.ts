import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ComparisonSearchResult } from "@commerce/crawler";
import { collectOverseasAutoPool } from "../overseas-auto-pool";
import { isTransientShopId, OVERSEAS_AUTO_SHOP_ID, OVERSEAS_AUTO_SHOP_NAME } from "../transient-candidates";
import {
  DOMESTIC_REVIEW_EMPTY,
  GeminiTransientCandidates,
  OVERSEAS_AUTO_HEADING,
  SOURCE_LABEL,
  SUPPLIED_URL_HEADING,
  TRANSIENT_NOTICE,
  TRANSIENT_SCOPE_NOTICE,
  WEB_SEARCH_HEADING,
} from "../../../../pipeline/commerce/GeminiTransientCandidates";
import { isSuppliedUrlInputVisible } from "../../../../pipeline/commerce/DomesticPriceIntelligencePanel";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-130 — **해외 자동검색 합류 계약**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **HTTP 0 · AI 0 · Gemini 0 · DB 0 · 키 0 · 비용 0** (전부 주입구로 돌린다).
 *
 * ── 🔴🔴🔴 이 파일이 지키는 «가장 중요한» 한 가지 ─────────────────────────
 * ```
 * `searchComparisonShops` 의 shopId 는 **`comparison_shops` 의 실제 uuid** 다.
 * 그 값이 `/check` 의 후보 루프에 그대로 들어가면 그 루프가 「등록된 국내 샵」으로
 * 보고 `upsertDomesticProductLink` 를 부른다 ⟹ **해외 판매처가 «국내» 링크
 * 테이블에 저장되고** 국내 최저가·판정 입력·`price_alerts` 까지 오염된다.
 * 🔴 A-1 이 그 한 줄을 잠근다 — 지우면 **2건이 FAIL** 한다.
 * ```
 *
 * 🔴 소스 문자열 검사는 **주석을 벗기고** 한다(헌장 §5 · 여덟 번 걸린 함정).
 * 🔴 판정 함수를 직접 부르는 단언은 **배선을 못 본다**(WU-110 교훈) → 소스 앵커를 **같이** 둔다.
 */

const LIB = path.join(__dirname, "..");
const strip = (f: string) =>
  readFileSync(path.join(LIB, f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

const RUNNER = strip("run-domestic-price-check.ts");
const POOL = strip("overseas-auto-pool.ts");
const LEAF = strip("transient-candidates.ts");
const ROUTE = strip(path.join("..", "check", "route.ts"));
const PANEL = readFileSync(
  path.join(__dirname, "..", "..", "..", "..", "pipeline", "commerce", "DomesticPriceIntelligencePanel.tsx"),
  "utf8",
)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");
/**
 * 🔴 WU-132 ③ — 가격 비교 **영역** 의 새 owner. WU-130 ④ 가 MI 패널 안에 만든
 *    `unified-price-comparison` 이 **이 파일로 옮겨 왔다**(영역을 둘 두지 않는다).
 */
const AREA = readFileSync(
  path.join(__dirname, "..", "..", "..", "..", "pipeline", "commerce", "MarketPriceComparison.tsx"),
  "utf8",
)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");

/** 🔴 등록부의 실제 모양(uuid) — 이 값이 산출물에 남으면 저장 오염이다. */
const REAL_SHOP_UUID = "743f72f4-a911-439a-b63b-ba8ae6bedcd0";

type Shop = Awaited<ReturnType<typeof import("../../../comparison-shops/_lib/comparison-shop").listComparisonShops>>[number];

function shop(over: Partial<Shop> & { id: string; domain: string }): Shop {
  return {
    name: `샵 ${over.domain}`,
    url: `https://${over.domain}/`,
    country: null,
    currency: "EUR",
    categoryScope: ["KIDS_FASHION"],
    accessStatus: null,
    accessNote: null,
    role: null,
    operatorKey: null,
    source: "SYSTEM",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...over,
  } as Shop;
}

/** 🟢 검색기는 **부르지 않는다** — 운영 반환 모양을 그대로 흉내 낸 주입구다
 *  (실측 WU-130: `shopId`·`shopName`·`domain`·`status`·`candidates` 다섯 칸). */
const fakeSearch = async (
  _q: unknown,
  refs: { id: string; name: string; domain: string; currency: string | null }[],
): Promise<ComparisonSearchResult[]> =>
  refs.map(
    (r) =>
      ({
        shopId: r.id,
        shopName: r.name,
        domain: r.domain,
        status: "ok",
        candidates: [
          {
            title: `${r.domain} 상품`,
            url: `https://${r.domain}/products/x`,
            price: { amount: 37, currency: "GBP" },
            regularPrice: null,
            imageUrl: null,
            confidence: 0.9,
            matchLevel: "very_high",
            priceStatus: "VERIFIED_CURRENT",
          },
        ],
      }) as never,
  );

const QUERY = { title: "Hug Hairy Monster T-shirt" };

/* ══════════════════ A. 🔴🔴🔴 생산자 — 저장 오염을 구조적으로 막는다 ══════════════════ */

describe("A. 🔴🔴🔴 해외 자동검색 생산자", () => {
  it("A-1 🔴🔴 shopId 가 **일시 id 로 갈아진다** — 등록부 uuid 가 산출물에 남지 않는다", async () => {
    const r = await collectOverseasAutoPool({
      query: QUERY,
      categoryScopes: ["KIDS_FASHION"],
      listShops: async () => [shop({ id: REAL_SHOP_UUID, domain: "junioredition.com" })],
      search: fakeSearch as never,
    });
    expect(r.searchResults).toHaveLength(1);
    expect(r.searchResults[0].shopId).toBe(OVERSEAS_AUTO_SHOP_ID);
    /** 🔴 uuid 가 **어디에도** 남지 않는다 — 남으면 upsert 로 흘러간다. */
    expect(JSON.stringify(r.searchResults)).not.toContain(REAL_SHOP_UUID);
    /** 🔴 그리고 그 id 는 저장 차단 술어에 **들어 있어야** 한다. */
    expect(isTransientShopId(r.searchResults[0].shopId)).toBe(true);
  });

  it("A-2 🔴 `domain` 은 **실제 판매처 그대로** 다 — 품번 추출기·샵 대표 선택이 이 값으로 분기한다", async () => {
    const r = await collectOverseasAutoPool({
      query: QUERY,
      categoryScopes: null,
      listShops: async () => [
        shop({ id: REAL_SHOP_UUID, domain: "junioredition.com" }),
        shop({ id: "22222222-2222-2222-2222-222222222222", domain: "nickis.com" }),
      ],
      search: fakeSearch as never,
    });
    expect(r.searchResults.map((x) => x.domain)).toEqual(["junioredition.com", "nickis.com"]);
    /** 🔴 host 를 가상 도메인 하나로 묶지 않는다(WU-024 leaf 주석과 같은 이유). */
    expect(new Set(r.searchResults.map((x) => x.domain)).size).toBe(2);
    /** 🟢 출처는 `shopName` 이 말한다 — 「자동으로 찾았다」가 보고에서 사라지지 않는다. */
    for (const x of r.searchResults) expect(x.shopName).toContain(OVERSEAS_AUTO_SHOP_NAME);
    /** 🔴🔴 **깊이 방어** — A-1 과 같은 성질을 여기서 한 번 더 본다(가장 파괴적인 회귀다). */
    for (const x of r.searchResults) expect(isTransientShopId(x.shopId)).toBe(true);
  });

  it("A-3 🔴 세 필터가 걸린다 — 비활성 · 접근차단 · 카테고리 불일치는 **부르지 않는다**", async () => {
    const called: string[] = [];
    const r = await collectOverseasAutoPool({
      query: QUERY,
      categoryScopes: ["KIDS_FASHION"],
      listShops: async () => [
        shop({ id: "a", domain: "ok.com" }),
        shop({ id: "b", domain: "off.com", isActive: false }),
        shop({ id: "c", domain: "blocked.com", accessStatus: "BLOCKED" }),
        shop({ id: "d", domain: "login.com", accessStatus: "LOGIN_REQUIRED" }),
        shop({ id: "e", domain: "dead.com", accessStatus: "API_DISCONTINUED" }),
        shop({ id: "f", domain: "golf.com", categoryScope: ["GOLF"] }),
      ],
      search: (async (_q: unknown, refs: { domain: string }[]) => {
        called.push(...refs.map((x) => x.domain));
        return fakeSearch(_q, refs as never);
      }) as never,
    });
    expect(called).toEqual(["ok.com"]);
    expect(r.metrics.registrySources).toBe(6);
    expect(r.metrics.eligibleShops).toBe(1);
  });

  it("A-4 🔴 후보를 **손대지 않는다** — 재점수 0 · 가격 0", async () => {
    const r = await collectOverseasAutoPool({
      query: QUERY,
      categoryScopes: null,
      listShops: async () => [shop({ id: "a", domain: "junioredition.com" })],
      search: fakeSearch as never,
    });
    const c = r.searchResults[0].candidates[0];
    /** 🟢 `searchOneShop` 이 이미 `withConfidence` 를 불렀다(실측) — 여기서 다시 계산하지 않는다. */
    expect(c.matchLevel).toBe("very_high");
    expect(c.confidence).toBe(0.9);
    expect(c.price).toEqual({ amount: 37, currency: "GBP" });
    expect(c.priceStatus).toBe("VERIFIED_CURRENT");
  });

  it("A-5 🟢 계측이 정직하다 — status 분포를 뭉치지 않고 provider 호출은 구조상 0", async () => {
    const r = await collectOverseasAutoPool({
      query: QUERY,
      categoryScopes: null,
      listShops: async () => [
        shop({ id: "a", domain: "ok.com" }),
        shop({ id: "b", domain: "none.com" }),
        shop({ id: "c", domain: "err.com" }),
      ],
      search: (async (_q: unknown, refs: { id: string; name: string; domain: string }[]) =>
        refs.map((x, i) => ({
          shopId: x.id,
          shopName: x.name,
          domain: x.domain,
          status: i === 0 ? "ok" : i === 1 ? "unsupported" : "error",
          candidates: i === 0 ? [{ title: "t", url: `https://${x.domain}/products/x`, confidence: 0.5 }] : [],
        })) as never) as never,
    });
    expect(r.metrics.outcomes).toEqual({ ok: 1, unsupported: 1, error: 1 });
    expect(r.metrics.candidates).toBe(1);
    expect(r.metrics.providerCalls).toBe(0);
  });

  it("A-6 🟢 자격 샵이 0 이면 검색을 **부르지 않는다**", async () => {
    let calls = 0;
    const r = await collectOverseasAutoPool({
      query: QUERY,
      categoryScopes: ["GOLF"],
      listShops: async () => [shop({ id: "a", domain: "kids.com", categoryScope: ["KIDS_FASHION"] })],
      search: (async () => {
        calls += 1;
        return [];
      }) as never,
    });
    expect(calls).toBe(0);
    expect(r.searchResults).toEqual([]);
    expect(r.metrics.eligibleShops).toBe(0);
  });

  it("A-7 🔴 생산자 모듈에 **저장/AI/Registry 어휘가 없다**", () => {
    for (const forbidden of ["supabase", "prisma", "upsert", "INSERT", "gemini", "Gemini", "openai", "apiKey"]) {
      expect(POOL).not.toContain(forbidden);
    }
    expect(POOL).not.toMatch(/domestic_price_sources|createComparisonShop|registerShop/i);
    /** 🔴 재점수·가격 보강을 **여기서** 하지 않는다(호출부가 그 둘을 돌리지 않게 하는 근거다). */
    expect(POOL).not.toContain("withConfidence");
    expect(POOL).not.toContain("enrichCandidatePrices");
  });

  it("A-8 🔴 scope 를 **다시 계산하지 않는다** — 호출부가 준 값을 그대로 쓴다", () => {
    expect(POOL).not.toContain("resolveCategoryScopes");
    expect(POOL).not.toContain("selectedMarketSourceScopes");
    expect(POOL).toContain("input.categoryScopes");
  });
});

/* ══════════════════ B. 🔴🔴 저장 차단 — 술어 하나 ══════════════════ */

describe("B. 🔴🔴 해외 후보는 «국내 링크 테이블» 에 저장되지 않는다", () => {
  it("B-1 일시 샵 술어가 해외 자동검색 id 를 막는다", () => {
    expect(isTransientShopId(OVERSEAS_AUTO_SHOP_ID)).toBe(true);
    expect(OVERSEAS_AUTO_SHOP_ID).toBe("__overseas_auto__");
    /** 🔴 uuid 모양이 아니다 — FK 로 들어갈 수 없다는 것이 안전의 근거다. */
    expect(OVERSEAS_AUTO_SHOP_ID).not.toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("B-2 leaf 가 그 id 를 **집합에** 넣는다 — 술어를 갈라 적지 않는다", () => {
    expect(LEAF).toContain("OVERSEAS_AUTO_SHOP_ID");
    const set = LEAF.slice(LEAF.indexOf("TRANSIENT_SHOP_IDS"), LEAF.indexOf("export function isTransientShopId"));
    expect(set).toContain("OVERSEAS_AUTO_SHOP_ID");
  });
});

/* ══════════════════ C. 🔴 배선 — 함수를 직접 불러서는 보이지 않는 것 ══════════════════ */

describe("C. 🔴 배선(소스 앵커)", () => {
  it("C-1 runner 가 생산자를 부르고 `searchResults` 에 **합류** 시킨다", () => {
    expect(RUNNER).toContain("collectOverseasAutoPool({");
    expect(RUNNER).toContain("const searchResults = [...p0Results, ...otherResults, ...(overseasAuto?.searchResults ?? [])]");
  });

  it("C-2 🔴 `transientPools` 에 **넣지 않는다** — 같은 일을 두 번 하지 않는다", () => {
    /** 🔴 해외 경로는 `searchOneShop` 안에서 재점수·가격보강을 이미 끝냈다(실측). */
    expect(RUNNER).not.toContain("transientPools.push(...overseasAuto");
    const push = RUNNER.split("transientPools.push(");
    for (const seg of push.slice(1)) expect(seg.slice(0, 40)).not.toContain("overseas");
  });

  it("C-3 🔴 `check/route` 가 **MI 입력에 합친다** — 그 한 곳만 합치고 응답 배열은 가른다", () => {
    const merge = ROUTE.slice(ROUTE.indexOf("const transientEvidence ="), ROUTE.indexOf("intelligence = await"));
    expect(merge).toContain("domesticShop.overseasAutoEvidence");
    expect(merge).toContain("...(domesticShop.overseasAutoEvidence ?? [])");
    /** 🔴 세 배열이 전부 그 입력에 들어간다. */
    expect(merge).toContain("...(domesticShop.geminiEvidence ?? [])");
    expect(merge).toContain("...(domesticShop.urlCandidateEvidence ?? [])");
  });

  it("C-3b 🔴 sink 가 **해외 자동검색 id 를 따로** 알아본다 — 「그 외는 Gemini」로 흘리지 않는다", () => {
    const branch = RUNNER.slice(
      RUNNER.indexOf("const evidenceSource"),
      RUNNER.indexOf("transientEvidenceSink.push("),
    );
    expect(branch).toContain("OVERSEAS_AUTO_SHOP_ID");
    expect(branch).toContain('"OVERSEAS_AUTO"');
    expect(branch).toContain("overseasAutoEvidence");
  });

  it("C-4 🔴 응답은 세 배열을 **가른 채로** 내보낸다(출처 보존)", () => {
    expect(RUNNER).toContain("overseasAutoEvidence: overseasAutoMetrics === null ? null : overseasAutoEvidence");
    expect(RUNNER).toContain("urlCandidateEvidence: urlCandidateMetrics === null ? null : urlCandidateEvidence");
    expect(RUNNER).toContain("geminiEvidence: geminiMetrics === null ? null : geminiEvidence");
  });

  it("C-5 🟢 국내 검색 범위는 **한 글자도** 바뀌지 않았다", () => {
    /** 🔴 2차 국내 검색 조건은 여전히 **국내 결과만** 본다(해외 very_high 가 끼면 범위가 바뀐다). */
    expect(RUNNER).toContain(
      "const foundVeryHighInP0 = p0Results.some((r) => r.candidates.some((c) => c.matchLevel === \"very_high\"));",
    );
    const idx = RUNNER.indexOf("const foundVeryHighInP0");
    expect(RUNNER.indexOf("const searchResults =")).toBeGreaterThan(idx);
  });
});

/* ══════════════════ D. 🔴 화면 — 마운트한 DOM 으로만 본다 ══════════════════ */

const row = (over: Record<string, unknown> = {}) => ({
  domain: "junioredition.com",
  title: "Hug Hairy Monster T-Shirt",
  source: "OVERSEAS_AUTO" as const,
  discoveredUrl: "https://www.junioredition.com/en-kr/products/hug-hairy-monster",
  market: "OVERSEAS",
  priceAmount: 37,
  priceCurrency: "GBP",
  priceStatus: "VERIFIED_CURRENT",
  ...over,
});

describe("D. 🔴 화면(마운트 DOM)", () => {
  it("D-1 구역 제목 셋이 **서로 다르다** — 출처가 화면에서 구별된다", () => {
    for (const [a, b] of [
      [OVERSEAS_AUTO_HEADING, WEB_SEARCH_HEADING],
      [OVERSEAS_AUTO_HEADING, SUPPLIED_URL_HEADING],
      [WEB_SEARCH_HEADING, SUPPLIED_URL_HEADING],
    ]) {
      expect(a).not.toBe(b);
      /** 🔴 상호 비포함 — 한쪽이 다른쪽의 부분문자열이면 단언이 서로를 통과한다(WU-056-R1 계약). */
      expect(a.includes(b)).toBe(false);
      expect(b.includes(a)).toBe(false);
    }
  });

  it("D-2 🔴 행에 **「해외 자동검색」** 배지가 선다 — 셀러가 넣은 것이 아니라는 사실이 보인다", () => {
    const html = renderToStaticMarkup(
      GeminiTransientCandidates({
        evidence: [row()],
        heading: OVERSEAS_AUTO_HEADING,
        testId: "overseas-auto-transient",
      }) as never,
    );
    expect(html).toContain(OVERSEAS_AUTO_HEADING);
    expect(html).toContain(SOURCE_LABEL.OVERSEAS_AUTO);
    expect(SOURCE_LABEL.OVERSEAS_AUTO).toBe("해외 자동검색");
    expect(html).not.toContain(SOURCE_LABEL.SELLER_URL);
    /** 🔴 두 고정 안내문은 이 구역에도 **그대로** 있다(수명·영향 범위를 구역이 직접 말한다). */
    expect(html).toContain(TRANSIENT_NOTICE);
    expect(html).toContain(TRANSIENT_SCOPE_NOTICE);
  });

  it("D-3 🔴 사람 검토 버튼은 이 구역에 **없다** — 🇰🇷 구역의 계약이다(WU-081)", () => {
    const html = renderToStaticMarkup(
      GeminiTransientCandidates({
        evidence: [row()],
        heading: OVERSEAS_AUTO_HEADING,
        testId: "overseas-auto-transient",
      }) as never,
    );
    expect(html).not.toContain("gt-human-review");
    /** 🔴 승격 버튼도 없다 — DB 로 올리는 길을 만들지 않는다. */
    expect(html).not.toContain("동일상품 확인");
  });

  it("D-4 🔴 KR 로 판정된 행은 🇰🇷 구역으로 **옮긴다** — 총 행 수가 바뀌지 않는다", () => {
    /** 🟢 패널 소스로 그 파생을 잠근다(렌더는 패널 전체 마운트가 필요하므로 앵커로 본다). */
    /** 🔴 WU-132 — 입력이 **넷** 이 됐다(이전 판단 재투입). 성질·강화는 그대로다. */
    expect(PANEL).toContain(
      "const krRows = [...(web ?? []), ...(supplied ?? []), ...(overseasAuto ?? []), ...(reviewedSame ?? [])].filter(isKr)",
    );
    expect(PANEL).toContain("const overseasAutoRest = (overseasAuto ?? []).filter((r) => !isKr(r));");
    /** 🔴 복제가 아니다 — 자동검색 구역은 `overseasAutoRest`(KR 제거 후)만 받는다. */
    expect(PANEL).toContain("evidence={overseasAutoRest}");
    expect(PANEL).not.toContain("evidence={overseasAuto}");
    /** 🔴 WU-132 — 재투입 구역도 **같은 규칙** 이다(KR 제거 후만 받는다). */
    expect(PANEL).toContain("const reviewedSameRest = (reviewedSame ?? []).filter((r) => !isKr(r));");
    expect(PANEL).toContain("evidence={reviewedSameRest}");
    expect(PANEL).not.toContain("evidence={reviewedSame}");
  });

  it("D-5 🔴 요약이 자동검색 후보를 **센다** — 요약과 본문이 다른 말을 하지 않는다", () => {
    expect(PANEL).toContain('{ sourceLabel: "해외 자동검색", rows: overseasAutoEvidence ?? [] }');
  });

  it("D-6 🔴 자동 1회차 응답에서 그 배열을 **읽는다** — 「다시 분석」을 누르기 전에도 보인다", () => {
    expect(PANEL).toContain("setOverseasAutoEvidence(j.domesticShop?.overseasAutoEvidence ?? null)");
    expect(PANEL).toContain("setOverseasAutoEvidence(json.domesticShop?.overseasAutoEvidence ?? null)");
  });
});

/* ══════════════════ E. 🇰🇷 국내 — 조회 사실과 후보 부재를 가른다 (WU-130 ②) ══════════════════ */

describe("E. 🇰🇷 국내 (WU-130 ②)", () => {
  /**
   * 🔴🔴 **실측 근거**(운영 함수 · 두 상품): 국내 등록부 자격 **18곳 중 6곳이 응답** 하고
   *    후보 **20건** 이 실제로 왔다. 🔴 그런데 그 후보가 **전부 다른 상품** 이라
   *    ⑧ 게이트가 샵 전체를 DROPPED 했다(**올바른 차단**) ⟹ 화면 후보 0.
   *    ⟹ 「조회했다」와 「후보가 없다」는 **다른 사실** 이고 화면이 둘을 말해야 한다.
   */
  it("E-1 🔴 조회가 돌았으면 🇰🇷 구역이 **참고 집계 없이도** 선다", () => {
    expect(PANEL).toContain("const showDomesticReview = checkRan");
    const def = PANEL.slice(PANEL.indexOf("const checkRan ="), PANEL.indexOf("const showDomesticReview"));
    /** 🔴 세 배열 **전부** 가 「조회가 돌았다」의 근거다 — 하나만 보면 국내 구역이 또 사라진다. */
    /** 🔴 WU-132 — **네** 배열 전부가 근거다. 하나만 보면 국내 구역이 또 사라진다. */
    for (const k of ["web != null", "supplied != null", "overseasAuto != null", "reviewedSame != null"]) {
      expect(def).toContain(k);
    }
  });

  it("E-2 🔴 빈 상태 문구가 **조회 사실** 을 말하고 부재를 단정하지 않는다", () => {
    expect(DOMESTIC_REVIEW_EMPTY).toContain("조회");
    expect(DOMESTIC_REVIEW_EMPTY).toContain("찾지 못했습니다");
    expect(DOMESTIC_REVIEW_EMPTY).not.toMatch(/국내에 (동일상품|상품)이 없/);
  });

  it("E-3 🟢 국내 등록부 후보는 여전히 **sink 가 아니라 upsert** 로 간다(이중 집계 금지)", () => {
    /** 🔴 sink push 는 일시 샵 가드 **안** 에만 있어야 한다 — 밖으로 나오면
     *  국내 등록부 후보가 `domesticCompetition` «그리고» `candidateDomesticPrice` 에
     *  **두 번** 들어간다(가격 집계 오염). */
    const guard = RUNNER.indexOf("if (isTransientShopId(result.shopId)) {");
    const push = RUNNER.indexOf("transientEvidenceSink.push(");
    expect(guard).toBeGreaterThan(-1);
    expect(push).toBeGreaterThan(guard);
    expect(RUNNER.split("transientEvidenceSink.push(").length - 1).toBe(1);
  });
});

/* ══════════════════ F. ③ 붙여넣기 UI · ④ 가격 구역 통합 (WU-130) ══════════════════ */

describe("F. ③④ 화면 구조 (WU-130)", () => {
  it("F-1 🔴 붙여넣기 입력칸은 **기본 숨김** 이다 — 기능은 지우지 않았다", () => {
    /** 🟢 기본값: 환경변수가 없으면 `false`. */
    expect(isSuppliedUrlInputVisible()).toBe(false);
    /** 🔴 렌더가 **그 술어에 걸려** 있어야 한다(상수 선언만 있고 안 쓰면 의미가 없다). */
    expect(PANEL).toContain("{isSuppliedUrlInputVisible() && (");
    /** 🟢🟢 **기능 보존** — 파서·풀·API 경계·상태·배선이 **전부 남아 있다**. */
    expect(PANEL).toContain("candidateUrlsText");
    expect(PANEL).toContain("onCandidateUrlsChange");
    expect(PANEL).toContain('data-testid="wu024-candidate-urls"');
    expect(ROUTE).toContain("candidateUrls");
    expect(RUNNER).toContain("collectUrlCandidatePool({");
  });

  it("F-2 🟢 스위치를 켜면 **그 술어가 true** 가 된다(되돌릴 수 있다)", () => {
    const before = process.env.NEXT_PUBLIC_MI_SUPPLIED_URL_INPUT;
    process.env.NEXT_PUBLIC_MI_SUPPLIED_URL_INPUT = "true";
    try {
      expect(isSuppliedUrlInputVisible()).toBe(true);
    } finally {
      if (before === undefined) delete process.env.NEXT_PUBLIC_MI_SUPPLIED_URL_INPUT;
      else process.env.NEXT_PUBLIC_MI_SUPPLIED_URL_INPUT = before;
    }
  });

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴🔴 WU-132 ③ — **그 영역은 «제거» 됐고 자리가 하나로 합쳐졌다**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * WU-130 ④ 는 MI 패널 **안** 에 `unified-price-comparison` 을 만들었다. 그런데
   * 「📊 시장 가격 비교」가 패널 **밖** 에 따로 있어서 **가격 비교 영역이 둘** 이었다 —
   * WU-128 이 지목한 중복의 남은 절반이다. CPO 확정: 「가격비교 영역을 둘 두지 않는다」.
   *
   * 🟢 그래서 F-3/F-4/F-5 의 **뜻을 그대로 새 owner 에 적용** 한다. 약해지는 단언은
   *    없고, **「패널에 그 영역이 없다」는 단언이 하나 늘었다**(강화).
   */
  it("F-3 🔴 두 참고가격이 **한 영역 안** 에 들어간다 — 구역 «안» 분리", () => {
    /** 🔴 좌표를 추측하지 않는다 — 여는 testid 부터 그 `</section>` 까지만 자른다. */
    const start = AREA.indexOf('data-testid="market-price-comparison"');
    expect(start).toBeGreaterThan(-1);
    const end = AREA.indexOf("</section>", start);
    expect(end).toBeGreaterThan(start);
    const area = AREA.slice(start, end);
    expect(area).toContain("MI_SAME_AREA_TITLE");
    /** 🔴 국내·해외가 **그 영역 안** 에서 갈린다(밖에 있으면 통합이 아니다). */
    expect(area).toContain("MI_SAME_DOMESTIC_HEADING");
    expect(area).toContain("MI_SAME_OVERSEAS_HEADING");
    expect(area).toContain('testId: "domestic-reference"');
    expect(area).toContain("reference={overseasReference}");
    expect(area).toContain("DOMESTIC_REFERENCE_TITLE");
    /** 🔴🔴 **패널에는 더 이상 그 영역이 없다** — 둘이 되면 FAIL 이다. */
    expect(PANEL).not.toContain("unified-price-comparison");
    expect(PANEL).not.toContain("<OverseasReferencePrice");
  });

  it("F-4 🔴 통합은 **표시만** 이다 — 집계/판정/알림 어휘가 그 영역에 없다", () => {
    /** 🔴 파일 전체를 본다 — 그 파일이 **곧 그 영역** 이다(섞인 다른 코드가 없다). */
    for (const forbidden of [
      "domesticTransientRecords",
      "candidateDomesticPrice",
      "computeMarketAlert",
      "domesticCompetition",
      "sellerDecision",
      "summarize",
    ]) {
      expect(AREA).not.toContain(forbidden);
    }
  });

  it("F-5 🔴 조회가 돌지 않았으면 **빈 테두리를 만들지 않는다**", () => {
    /**
     * 🔴🔴 **조건이 「값이 있는가」에서 「조회가 돌았는가」로 «강화» 됐다**(WU-130 ② 계약).
     *    전자는 후보 0 일 때 영역을 지워 「조회조차 안 했다」로 읽히게 만든다.
     */
    expect(AREA).toContain("const checkRan = rows != null || !!domesticReference || !!overseasReference");
    expect(AREA).toContain("if (!checkRan) return null;");
  });
});
