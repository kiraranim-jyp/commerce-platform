import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "../../comparison-search/product-url-facts";
import { classifyUrlShape } from "../../comparison-search/url-shape";
import { generateQueries } from "../query-generator";
import { buildDiscoveryQuerySet } from "../query-planner";
import type { ProductIdentity } from "../types";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 DISCOVERY-SEARCH-PROVIDER-05 — **정의된 Query 전수 × 실제 검색 URL 검증**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **CTO 가 최종 Query 를 고르지 않는다**(CPO §1·§12). 이 하니스는 **재료만** 만든다.
 *
 * ── 🔴 「Q1~Q5」라는 이름이 이 저장소에 «세 벌» 있다 ────────────────────────
 * ```
 * ① 운영 열거기  `query-generator.ts` SPECS = **Q1~Q8**(types.ts 의 `QueryId` 가 고정)
 *      Q1 상품명 / Q2 브랜드+상품명 / Q3 상품명+색상 / Q4 브랜드+상품명+색상 /
 *      Q5 상품코드 / Q6 브랜드+상품코드 / Q7 상품명+buy / Q8 브랜드+상품명+buy
 * ② 운영 Planner `query-planner.ts` = **이름 있는 8축**(Q 번호가 없다)
 *      BRAND_CODE · BRAND_CODE_KO · CODE_ONLY · BRAND_DESIGN · BRAND_DESIGN_KO ·
 *      PURCHASE_KO · PRICE_KO · SHOP_EN
 * ③ SPRINT-03/04 **하니스 라벨** Q1/Q2/Q3 — 🔴 ①의 Q1~Q3 와 **뜻이 완전히 다르다**
 * ```
 * 🔴 그래서 이번에는 **①+②+③ 을 전부** 만들고 **문자열로 dedupe** 한 뒤 전수 실행한다.
 *    「Q4/Q5 가 없다」가 아니라 **①에 Q1~Q8 이 실재한다** 는 것이 §2 의 답이다.
 *
 * ── 🔴 이 하니스가 «하지 않는» 것 ──────────────────────────────────────────
 * ```
 * ❌ 운영 배선   ❌ MI   ❌ Identity 변경   ❌ 가격   ❌ SAME/DIFFERENT 판정
 * ❌ Query Planner 구조 변경   ❌ 새 Query 를 지어내기   ❌ 최종 Query 선정
 * 🟢 `codeMatches` 는 **관측** 이다 — 「품번 문자열이 보인다」이지 동일상품 판정이 아니다
 * ```
 */

const LIVE = process.env.CORE_APIFY_POC_LIVE === "1";
const ACTOR = "apify~google-search-scraper";
/** 🔴 FREE 티어 단가. 실제 청구는 Billing 이 ground truth 다. */
const USD_PER_SEARCH_PAGE = 0.0045;

/**
 * 🟢 **기존 GT fixture 의 canonicalProduct 그대로** 다(CPO §3 · 새 상품 0).
 * 🔴 `sourceUrl` 은 Query 축이 **한 번도 읽지 않는다**(SPECS 의 fields 는
 *    brand/productName/color/productCode 뿐) ⟹ URL 을 **지어내지 않고** 비워 둔다.
 */
const PRODUCTS: { id: string; identity: ProductIdentity }[] = [
  {
    id: "S1",
    identity: baseIdentity({
      brand: "Bobo Choses",
      productName: "Booty Ghosts Long Sleeve T-Shirt by Bobo Choses",
      color: "Heather Grey",
      productCode: "B226AC010",
    }),
  },
  {
    id: "S2",
    identity: baseIdentity({
      brand: "Bobo Choses",
      productName: "Hug Hairy Monster T-Shirt by Bobo Choses",
      color: "Light Blue",
      productCode: "B226AC009",
    }),
  },
  {
    id: "S3",
    identity: baseIdentity({
      brand: "Bobo Choses",
      productName: "Curious Turnip All Over Swim Cap by Bobo Choses - Last One In Stock - 2-6 Years",
      color: "Green",
      productCode: "B126AI018",
    }),
  },
  {
    id: "S4",
    identity: baseIdentity({
      brand: "Main Story",
      productName: "Bubble Sweatshirt in Grey Melange by Main Story",
      color: "Grey Melange",
      productCode: "AW26MS185",
    }),
  },
];

function baseIdentity(p: Partial<ProductIdentity>): ProductIdentity {
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

/** 🟢 SPRINT-03/04 하니스 라벨 — **이미 측정된 두 문자열** 을 같은 표에 넣어 비교 가능하게 한다. */
function harnessVariants(id: ProductIdentity): { label: string; text: string }[] {
  const brand = id.brand?.trim();
  const code = id.productCode?.trim();
  if (!brand || !code) return [];
  /** 🔴 디자인명은 **운영 Planner 가 쓰는 코어 토큰** 과 같은 출처로 뽑는다(새 규칙 0). */
  const design = designTokens(id);
  const out = [{ label: "H-Q2", text: `${brand} ${code}` }];
  if (design) out.push({ label: "H-Q3", text: `${brand} ${code} ${design}` });
  return out;
}

/** 🟢 `buildDiscoveryQuerySet` 과 **같은 방법** 으로 코어 토큰을 얻는다(복제 아님 · 그 축의 산출을 읽는다). */
function designTokens(id: ProductIdentity): string {
  const brand = id.brand?.trim() ?? "";
  const axes = buildDiscoveryQuerySet({ ...id }, { max: 8 });
  const design = axes.find((a) => a.axis === "BRAND_DESIGN");
  if (!design) return "";
  return design.text.replace(`"${brand}"`, "").replace(/"/g, "").trim();
}

export interface PlannedEntry {
  /** 사람이 읽는 라벨 — `G-Q1`(열거기) · `P-BRAND_CODE`(Planner) · `H-Q2`(하니스). */
  label: string;
  source: "GENERATOR" | "PLANNER" | "HARNESS";
  axis: string;
  text: string;
}

/**
 * 🔴 **정의된 모든 축** 을 모아 문자열로 dedupe 한다.
 * 🔴 같은 문자열이 두 출처에서 나오면 **먼저 나온 라벨** 을 쓰고 `alsoFrom` 에 적는다 —
 *    「같은 질의를 두 번 돌려 비용을 두 배로 쓰는 것」을 막는다.
 */
export function planAllQueries(identity: ProductIdentity): {
  entries: (PlannedEntry & { alsoFrom: string[] })[];
  skipped: { label: string; reason: string }[];
} {
  const raw: PlannedEntry[] = [];
  for (const q of generateQueries(identity)) {
    raw.push({ label: `G-${q.id}`, source: "GENERATOR", axis: q.axis, text: q.text });
  }
  for (const a of buildDiscoveryQuerySet(identity, { max: 8 })) {
    raw.push({ label: `P-${a.axis}`, source: "PLANNER", axis: a.axis, text: a.text });
  }
  for (const h of harnessVariants(identity)) {
    raw.push({ label: h.label, source: "HARNESS", axis: "SPRINT-03/04 라벨", text: h.text });
  }

  const byText = new Map<string, PlannedEntry & { alsoFrom: string[] }>();
  for (const e of raw) {
    const key = e.text.trim();
    const hit = byText.get(key);
    if (hit) hit.alsoFrom.push(e.label);
    else byText.set(key, { ...e, text: key, alsoFrom: [] });
  }

  /** 🔴 만들어지지 «않은» 축도 적는다 — 「왜 없는가」가 보고에 필요하다. */
  const skipped: { label: string; reason: string }[] = [];
  const missing = (f: keyof ProductIdentity) => !String(identity[f] ?? "").trim();
  if (missing("color")) skipped.push({ label: "G-Q3 / G-Q4", reason: "color 없음" });
  if (missing("productCode")) skipped.push({ label: "G-Q5 / G-Q6", reason: "productCode 없음" });
  if (missing("productName")) skipped.push({ label: "G-Q1/Q2/Q7/Q8", reason: "productName 없음" });

  return { entries: [...byText.values()], skipped };
}

const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - [...s].length));
const padL = (s: string, n: number) => " ".repeat(Math.max(0, n - [...s].length)) + s;
const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "?";
  }
};

describe("SEARCH-PROVIDER-05 §2 — 정의된 Query 전수(순수 · 네트워크 0)", () => {
  it("운영 열거기는 **Q1~Q8** 을 정의한다 — 「Q4/Q5 없음」이 아니다", () => {
    const ids = generateQueries(PRODUCTS[0]!.identity).map((q) => q.id);
    for (const q of ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8"]) expect(ids).toContain(q);
  });

  it("Planner 8축은 Q 번호가 아니라 **이름** 을 쓴다(두 체계를 섞지 않는다)", () => {
    const axes = buildDiscoveryQuerySet(PRODUCTS[0]!.identity, { max: 8 }).map((a) => a.axis);
    expect(axes).toContain("BRAND_CODE");
    expect(axes.some((a) => /^Q\d$/.test(a))).toBe(false);
  });

  it("dedupe 가 같은 문자열을 두 번 돌리지 않는다", () => {
    for (const p of PRODUCTS) {
      const { entries } = planAllQueries(p.identity);
      expect(new Set(entries.map((e) => e.text)).size, p.id).toBe(entries.length);
      expect(entries.length, p.id).toBeGreaterThan(5);
    }
  });

  it("🔴 **증거가 없으면 축을 만들지 않는다** — 빈 identity 는 질의 0", () => {
    const { entries } = planAllQueries(baseIdentity({}));
    expect(entries).toHaveLength(0);
  });

  it("질의 전수를 출력한다(실행 계획)", () => {
    let total = 0;
    for (const p of PRODUCTS) {
      const { entries, skipped } = planAllQueries(p.identity);
      total += entries.length;
      console.log(`\n── ${p.id} ─ 질의 ${entries.length}`);
      for (const e of entries) {
        console.log(`   ${pad(e.label, 20)} ${pad(e.source, 10)} ${e.text}${e.alsoFrom.length ? `   (= ${e.alsoFrom.join(", ")})` : ""}`);
      }
      if (skipped.length) console.log(`   🔴 생성 안 됨 — ${skipped.map((s) => `${s.label}(${s.reason})`).join(" · ")}`);
    }
    console.log(`\n합계 검색 ${total}회 · 예상 $${(total * USD_PER_SEARCH_PAGE).toFixed(3)}`);
    expect(total).toBeGreaterThan(0);
  });
});

/* ─────────────────────────── 라이브 ─────────────────────────── */

interface SearchItem {
  organicResults?: { url?: string; title?: string; displayedUrl?: string; description?: string }[];
}

const OUT = join(
  __dirname,
  "../../../../../apps/admin/src/app/api/price-history/_lib/__tests__/fixtures/search-provider-05-raw.json",
);

describe.skipIf(!LIVE)("SEARCH-PROVIDER-05 §4 — 정의된 Query 전수 실제 검색(라이브)", () => {
  it(
    "상품 4 × 정의된 Query 전수 — 원본 URL 을 전건 보존한다",
    async () => {
      const token = process.env.APIFY_API_TOKEN?.trim();
      expect(token, "APIFY_API_TOKEN 이 없다").toBeTruthy();

      type Run = {
        productId: string;
        label: string;
        source: string;
        axis: string;
        alsoFrom: string[];
        query: string;
        startedAt: string;
        results: { url: string; title?: string; displayedUrl?: string; description?: string }[];
      };

      const origins = Object.fromEntries(
        PRODUCTS.map((p) => [
          p.id,
          {
            brand: p.identity.brand,
            code: p.identity.productCode,
            name: p.identity.productName,
            color: p.identity.color,
          },
        ]),
      );

      /**
       * 🔴🔴 **이어서 돌린다.** 1차 실행은 1건당 약 90초라 전수가 한 세션에 안 들어갔다.
       *    그래서 **매 검색마다 파일에 쓰고**, 이미 저장된 (상품, 질의) 는 **다시 검색하지 않는다**
       *    — 같은 질의에 두 번 과금하지 않기 위해서다.
       */
      const fsmod = await import("node:fs");
      let runs: Run[] = [];
      try {
        runs = (JSON.parse(fsmod.readFileSync(OUT, "utf8")) as { runs: Run[] }).runs ?? [];
        console.log(`  🟢 이어서 — 이미 저장된 검색 ${runs.length}회는 건너뛴다`);
      } catch {
        /* 첫 실행 */
      }
      const done = new Set(runs.map((r) => `${r.productId} ${r.query}`));
      const flush = () => {
        mkdirSync(dirname(OUT), { recursive: true });
        writeFileSync(
          OUT,
          `${JSON.stringify(
            {
              sprint: "DISCOVERY-SEARCH-PROVIDER-05",
              capturedAt: new Date().toISOString().slice(0, 10),
              note: "🔴 정의된 Query 전수(열거기 Q1~Q8 · Planner 8축 · 하니스 라벨)를 같은 설정으로 실행한 원본이다. CTO 가 URL 을 지어내지 않았다.",
              actor: "apify/google-search-scraper",
              origins,
              runs,
            },
            null,
            1,
          )}\n`,
        );
      };

      let searches = 0;
      let failed = 0;

      const pending: { p: (typeof PRODUCTS)[number]; e: ReturnType<typeof planAllQueries>["entries"][number] }[] = [];
      for (const p of PRODUCTS) {
        for (const e of planAllQueries(p.identity).entries) {
          if (!done.has(`${p.id} ${e.text}`)) pending.push({ p, e });
        }
      }
      console.log(`  남은 검색 ${pending.length}회 · 예상 $${(pending.length * USD_PER_SEARCH_PAGE).toFixed(3)}`);

      /**
       * 🔴🔴 **실패한 검색은 기록하지 «않는다».** 기록하면 `results: []` 가 남아
       *    「그 Query 는 결과가 0 이었다」는 **거짓 데이터** 가 된다 — 이번 Sprint 의 판단 기준이
       *    바로 그 숫자다. 🟢 기록하지 않으면 다음 실행이 그 질의만 **재시도** 한다.
       */
      const runOne = async (
        p: (typeof PRODUCTS)[number],
        e: (typeof pending)[number]["e"],
      ): Promise<Run | null> => {
        {
          const startedAt = new Date().toISOString();
          let results: { url: string; title?: string; displayedUrl?: string; description?: string }[] = [];
          try {
            const res = await fetch(
              `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(token!)}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                /** 🔴 **설정은 전 Query 가 동일하다** — 변수는 `queries` 문자열 하나뿐(CPO §4). */
                body: JSON.stringify({
                  queries: e.text,
                  maxPagesPerQuery: 1,
                  resultsPerPage: 20,
                  saveHtml: false,
                  saveHtmlToKeyValueStore: false,
                }),
              },
            );
            searches += 1;
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const items = (await res.json()) as SearchItem[];
            results = (items[0]?.organicResults ?? [])
              .filter((o): o is { url: string } & typeof o => Boolean(o.url))
              .map((o) => ({
                url: o.url,
                title: o.title,
                displayedUrl: o.displayedUrl,
                description: o.description,
              }));
          } catch (err) {
            failed += 1;
            console.log(`  🔴 ${p.id} ${e.label} 실패(기록하지 않는다) — ${String(err).slice(0, 100)}`);
            return null;
          }
          return {
            productId: p.id,
            label: e.label,
            source: e.source,
            axis: e.axis,
            alsoFrom: e.alsoFrom,
            query: e.text,
            startedAt,
            results,
          };
        }
      };

      /** 🟢 동시 실행 — 1건 약 90초 × 64건은 한 세션에 들어가지 않는다. 🔴 **검색 설정은 그대로다**. */
      const CONCURRENCY = 4;
      for (let i = 0; i < pending.length; i += CONCURRENCY) {
        const got = await Promise.all(pending.slice(i, i + CONCURRENCY).map(({ p, e }) => runOne(p, e)));
        for (const r of got) {
          if (!r) continue;
          runs.push(r);
          console.log(
            `  ${pad(r.productId, 4)} ${pad(r.label, 20)} 결과 ${padL(String(r.results.length), 2)}  ${r.query}`,
          );
        }
        /** 🟢 **배치마다 저장** — 중간에 끊겨도 이미 쓴 돈이 사라지지 않는다. */
        flush();
      }

      flush();
      if (failed > 0) console.log(`  🔴 실패 ${failed}회 — 다시 실행하면 **그 질의만** 재시도한다`);
      console.log(`\n이번 검색 ${searches}회 · 예상 $${(searches * USD_PER_SEARCH_PAGE).toFixed(3)} · 누적 ${runs.length}회 · 결과 ${runs.reduce((a, r) => a + r.results.length, 0)}건`);
      console.log(`저장 → ${OUT}`);
      expect(runs.length).toBeGreaterThan(0);
    },
    /** 🔴 1건당 약 90초 × 64건. **이어서 돌리기** 가 있으므로 중간에 끊겨도 손실은 0 이다. */
    3 * 60 * 60_000,
  );
});

/* ───────────── §4-b 「결과 0」이 진짜 0 인지 재확인 ───────────── */

const RECHECK = process.env.CORE_SP05_RECHECK === "1";

/**
 * 🔴🔴 **「0건」을 그대로 믿지 않는다.** Apify 가 HTTP 200 으로 **빈 결과** 를 줄 수 있고,
 *    그러면 「그 Query 는 아무것도 못 찾는다」는 **거짓 결론** 이 된다(§5-B 「측정불가 ≠ 0」).
 * 🟢 그래서 0 이 나온 질의만 **한 번 더** 돌려 재현되는지 본다. 🔴 결과를 fixture 에
 *    덮어쓰지 않는다 — **관측만** 하고 보고에 둘 다 적는다.
 */
describe.skipIf(!RECHECK)("SEARCH-PROVIDER-05 §4-b — 「결과 0」 재확인(라이브)", () => {
  it(
    "0건으로 기록된 질의를 한 번 더 돌려 재현 여부를 본다",
    async () => {
      const token = process.env.APIFY_API_TOKEN?.trim();
      expect(token, "APIFY_API_TOKEN 이 없다").toBeTruthy();
      const fsmod = await import("node:fs");
      const raw = JSON.parse(fsmod.readFileSync(OUT, "utf8")) as {
        runs: { productId: string; label: string; query: string; results: unknown[] }[];
      };
      const zeros = raw.runs.filter((r) => r.results.length === 0);
      console.log(`  0건 질의 ${zeros.length}개를 재확인한다`);
      for (const z of zeros) {
        let n = -1;
        try {
          const res = await fetch(
            `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(token!)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                queries: z.query,
                maxPagesPerQuery: 1,
                resultsPerPage: 20,
                saveHtml: false,
                saveHtmlToKeyValueStore: false,
              }),
            },
          );
          const items = (await res.json()) as SearchItem[];
          n = (items[0]?.organicResults ?? []).filter((o) => o.url).length;
        } catch (err) {
          console.log(`  🔴 ${z.productId} ${z.label} 재확인 실패 — ${String(err).slice(0, 80)}`);
        }
        console.log(
          `  ${pad(z.productId, 4)} ${pad(z.label, 20)} 1차 0 → 재확인 ${n < 0 ? "오류" : n}  ${z.query}`,
        );
      }
      expect(zeros.length).toBeGreaterThanOrEqual(0);
    },
    60 * 60_000,
  );
});

/* ───────────────────── §8 4~5순위 — Crawl / Evidence ───────────────────── */

const CRAWL = process.env.CORE_SP05_CRAWL === "1";

describe.skipIf(!CRAWL)("SEARCH-PROVIDER-05 §8 — Query 버킷별 Crawl · Evidence(라이브)", () => {
  it(
    "상품상세로 분류된 URL 을 운영 추출기에 넣어 Crawl/Evidence 성공을 Query 별로 센다",
    async () => {
      const raw = JSON.parse(
        (await import("node:fs")).readFileSync(OUT, "utf8"),
      ) as {
        origins: Record<string, { code: string | null }>;
        runs: { productId: string; label: string; query: string; results: { url: string }[] }[];
      };

      console.log(
        `\n${pad("상품", 5)}${pad("Query", 20)}${padL("결과", 5)}${padL("상품URL", 8)}${padL("판매처", 7)}${padL("Crawl", 7)}${padL("Evid", 6)}${padL("품번", 6)}${padL("Evid판매처", 8)}`,
      );
      /**
       * 🟢 **같은 URL 을 두 번 crawl 하지 않는다** — Query 가 겹치므로 캐시가 없으면
       *    같은 페이지를 수십 번 때린다(외부 사이트에 대한 예의이자 측정 시간 문제).
       * 🔴 캐시는 **집계를 바꾸지 않는다** — 버킷별 숫자는 그대로 센다.
       */
      const cache = new Map<string, { ok: boolean; evidence: boolean; code: string }>();
      const probe = async (url: string) => {
        const hit = cache.get(url);
        if (hit) return hit;
        let v = { ok: false, evidence: false, code: "" };
        try {
          const f = await factsFromProductUrl(url);
          /**
           * 🔴🔴 **칸 이름을 또 틀렸다.** 1차 구현이 `f.facts` 를 읽었는데 그 칸은 **없다** —
           *    owner 는 `f.candidate`(`ProductUrlFactsResult.candidate`)이고 상품 사실은
           *    그 안의 `candidate.facts` 다. 🔴 그래서 TypeError 가 catch 로 떨어져
           *    **「Crawl 0 · Evidence 0」이라는 거짓 표** 가 나왔다(보고 직전에 잡았다).
           */
          if (f.status === "OK" && f.candidate) {
            const c = f.candidate;
            const facts = c.facts;
            v = {
              ok: true,
              evidence: Boolean(
                facts?.brand || facts?.brandModelCode || (facts?.coreTitleTokens?.length ?? 0) > 0 || c.brand || c.sku,
              ),
              code: `${facts?.brandModelCode ?? c.sku ?? ""}`.toUpperCase(),
            };
          }
        } catch (err) {
          /** 🔴 실패는 ok 를 올리지 않는다 — 조용히 성공으로 세지 않는다. 🟢 단 **조용히 넘기지도** 않는다. */
          console.log(`    🔴 crawl 예외 ${url.slice(0, 70)} — ${String(err).slice(0, 80)}`);
        }
        cache.set(url, v);
        return v;
      };

      const out: Record<string, { crawlOk: number; evidence: number; codeMatch: number }> = {};
      for (const run of raw.runs) {
        const code = (raw.origins[run.productId]?.code ?? "").toUpperCase();
        const productUrls = run.results.map((r) => r.url).filter((u) => classifyUrlShape(u) === "PRODUCT_PAGE");
        const sellers = new Set(productUrls.map(hostOf));
        let crawlOk = 0;
        let evidence = 0;
        let codeMatch = 0;
        /**
         * 🔴🔴 **이것이 결정적 지표다**(CPO §8 3순위 + 5순위의 교집합) —
         *    「Evidence 를 내는 **서로 다른 판매처** 수」. 개수(URL)로 세면 같은 판매처의
         *    로케일 중복이 숫자를 부풀린다.
         */
        const evidenceSellers = new Set<string>();
        for (const url of productUrls) {
          const v = await probe(url);
          if (!v.ok) continue;
          crawlOk += 1;
          if (v.evidence) {
            evidence += 1;
            evidenceSellers.add(hostOf(url));
          }
          if (code && v.code.includes(code)) codeMatch += 1;
        }
        out[`${run.productId}/${run.label}`] = { crawlOk, evidence, codeMatch };
        console.log(
          `${pad(run.productId, 5)}${pad(run.label, 20)}${padL(String(run.results.length), 5)}${padL(String(productUrls.length), 8)}${padL(String(sellers.size), 7)}${padL(String(crawlOk), 7)}${padL(String(evidence), 6)}${padL(String(codeMatch), 6)}${padL(String(evidenceSellers.size), 8)}`,
        );
      }
      expect(Object.keys(out).length).toBeGreaterThan(0);
    },
    60 * 60_000,
  );
});
