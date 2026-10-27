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

/* ───────────── §6 SPRINT-06 — **목적형(Intent) Query** ───────────── */

/**
 * 🔵🔵🔵 CPO 재정의(2026-10-27) — 「검색어를 잘 만드는 것보다 **무엇을 찾으라고 검색하는지**
 *    를 명시하는 것이 먼저다」. Query 는 검색어가 아니라 **Discovery Intent** 다.
 *
 * ── 🔴 이 실험이 «하지 않는» 것 ────────────────────────────────────────────
 * ```
 * 🔴 **한글/영어를 Query 축으로 삼지 않는다** — 셋 다 **영어로 통일** 하고,
 *    국내/해외가 결과에서 «실제로» 어떻게 분포하는지만 본다
 *    (검색엔진의 지역/언어 편향을 Query 로 간접 유도하지 않는다 · CPO 명시)
 * 🔴 Q1~Q8 을 더 늘리지 않는다 · 운영 Query Planner 를 바꾸지 않는다
 * ```
 * 🔴 셋 다 **BRAND + MODEL_CODE + PRODUCT_NAME** 을 공통 뼈대로 쓴다(CPO 지정).
 */
const INTENT_QUERIES: { label: string; axis: string; suffix: string }[] = [
  { label: "I-1", axis: "IDENTITY — 동일상품 URL 탐색", suffix: "" },
  { label: "I-2", axis: "EXACT — 동일상품 상세페이지 집중", suffix: "exact product" },
  { label: "I-3", axis: "BUY — 실제 판매처 집중", suffix: "buy" },
];

/**
 * 🟢 상품명은 **GT 제목 그대로** 쓰지 않는다 — 그 제목에 `by {브랜드}` 와 재고/사이즈
 *    꼬리표가 붙어 있어(`… - Last One In Stock - 2-6 Years`) 브랜드가 두 번 들어가고
 *    질의가 길어진다(SPRINT-05 에서 G-Q2/Q4/Q8 이 실제로 그랬다).
 * 🔴 **새 규칙을 만들지 않는다** — 운영 Planner 가 이미 쓰는 **코어 토큰**(`BRAND_DESIGN` 축)
 *    을 그대로 가져온다.
 */
export function buildIntentQuery(identity: ProductIdentity, suffix: string): string {
  const brand = identity.brand?.trim() ?? "";
  const code = identity.productCode?.trim() ?? "";
  const design = designTokens(identity);
  return [brand, code, design, suffix].filter(Boolean).join(" ").trim();
}

describe("SEARCH-PROVIDER-06 §Intent — 목적형 질의(순수 · 네트워크 0)", () => {
  it("셋 다 BRAND + MODEL_CODE + 디자인명을 공통 뼈대로 쓴다", () => {
    for (const p of PRODUCTS) {
      for (const q of INTENT_QUERIES) {
        const text = buildIntentQuery(p.identity, q.suffix);
        expect(text, `${p.id} ${q.label}`).toContain(p.identity.brand!);
        expect(text, `${p.id} ${q.label}`).toContain(p.identity.productCode!);
        if (q.suffix) expect(text.endsWith(q.suffix), `${p.id} ${q.label}`).toBe(true);
      }
    }
  });

  it("🔴 셋 다 **영어** 다 — 한글 축을 만들지 않는다(지역 유도 금지)", () => {
    for (const p of PRODUCTS) {
      for (const q of INTENT_QUERIES) {
        expect(/[가-힣]/.test(buildIntentQuery(p.identity, q.suffix)), `${p.id} ${q.label}`).toBe(false);
      }
    }
  });

  it("질의 전수를 출력한다", () => {
    for (const p of PRODUCTS) {
      for (const q of INTENT_QUERIES) {
        console.log(`   ${pad(p.id, 4)} ${pad(q.label, 5)} ${buildIntentQuery(p.identity, q.suffix)}`);
      }
    }
    expect(INTENT_QUERIES).toHaveLength(3);
  });
});

const INTENT_LIVE = process.env.CORE_SP06_LIVE === "1";

describe.skipIf(!INTENT_LIVE)("SEARCH-PROVIDER-06 §Intent — 실제 검색(라이브 · 12회)", () => {
  it(
    "상품 4 × Intent 3 — 같은 설정으로 돌리고 같은 fixture 에 이어 붙인다",
    async () => {
      const token = process.env.APIFY_API_TOKEN?.trim();
      expect(token, "APIFY_API_TOKEN 이 없다").toBeTruthy();
      const fsmod = await import("node:fs");
      const file = JSON.parse(fsmod.readFileSync(OUT, "utf8")) as {
        runs: {
          productId: string;
          label: string;
          source: string;
          axis: string;
          alsoFrom: string[];
          query: string;
          startedAt: string;
          results: unknown[];
        }[];
      };
      const byKey = new Map(file.runs.map((r) => [`${r.productId} ${r.query}`, r]));
      const flush = () => fsmod.writeFileSync(OUT, `${JSON.stringify(file, null, 1)}\n`);

      const pending: { p: (typeof PRODUCTS)[number]; q: (typeof INTENT_QUERIES)[number]; text: string }[] = [];
      for (const p of PRODUCTS) {
        for (const q of INTENT_QUERIES) {
          const text = buildIntentQuery(p.identity, q.suffix);
          const hit = byKey.get(`${p.id} ${text}`);
          if (!hit) {
            pending.push({ p, q, text });
            continue;
          }
          /**
           * 🟢🟢 **I-1 은 SPRINT-05 의 `H-Q3` 와 문자열이 같다** — 다시 검색하면 **같은 질의에
           *    두 번 과금** 한다. 그래서 저장된 결과를 **그대로 복사** 해 라벨만 붙인다(검색 0).
           * 🔴 「새로 검색했다」로 적지 않는다 — `alsoFrom` 에 출처를 남긴다.
           */
          if (file.runs.some((r) => r.productId === p.id && r.label === q.label)) continue;
          file.runs.push({ ...hit, label: q.label, source: "INTENT", axis: q.axis, alsoFrom: [hit.label] });
          console.log(`  ${pad(p.id, 4)} ${pad(q.label, 5)} 🟢 기존 ${hit.label} 와 **같은 질의** — 재검색 0`);
        }
      }
      console.log(`  남은 검색 ${pending.length}회 · 예상 $${(pending.length * USD_PER_SEARCH_PAGE).toFixed(3)}`);

      const runOne = async (x: (typeof pending)[number]) => {
        const startedAt = new Date().toISOString();
        try {
          const res = await fetch(
            `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(token!)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              /** 🔴 **SPRINT-05 와 같은 설정** 이다 — 비교 가능성을 지킨다. */
              body: JSON.stringify({
                queries: x.text,
                maxPagesPerQuery: 1,
                resultsPerPage: 20,
                saveHtml: false,
                saveHtmlToKeyValueStore: false,
              }),
            },
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const items = (await res.json()) as SearchItem[];
          const results = (items[0]?.organicResults ?? [])
            .filter((o): o is { url: string } & typeof o => Boolean(o.url))
            .map((o) => ({ url: o.url, title: o.title, displayedUrl: o.displayedUrl, description: o.description }));
          return {
            productId: x.p.id,
            label: x.q.label,
            source: "INTENT",
            axis: x.q.axis,
            alsoFrom: [],
            query: x.text,
            startedAt,
            results,
          };
        } catch (err) {
          /** 🔴 실패는 **기록하지 않는다** — `results: []` 가 「결과 0」이라는 거짓 데이터가 된다. */
          console.log(`  🔴 ${x.p.id} ${x.q.label} 실패(기록하지 않는다) — ${String(err).slice(0, 90)}`);
          return null;
        }
      };

      for (let i = 0; i < pending.length; i += 4) {
        const got = await Promise.all(pending.slice(i, i + 4).map(runOne));
        for (const r of got) {
          if (!r) continue;
          file.runs.push(r);
          console.log(`  ${pad(r.productId, 4)} ${pad(r.label, 5)} 결과 ${padL(String(r.results.length), 2)}  ${r.query}`);
        }
        flush();
      }
      flush();
      expect(file.runs.length).toBeGreaterThan(64);
    },
    3 * 60 * 60_000,
  );
});

/* ───────────── §8 SPRINT-08 — **검색 «목적» 문구** PoC ───────────── */

/**
 * 🔵🔵🔵 CPO 지시(2026-10-27) — 「Query 에 **검색 목적** 을 자연어로 붙이면 국내 비중이
 *    오르는가」. 🔴 **구현이 아니다 · PoC 다**(운영 코드 변경 0).
 *
 * ── 🔴🔴 측정 전에 적는 «교란» 하나 ───────────────────────────────────────
 * ```
 * B·C·D 의 목적 문구는 **한국어** 다. 그래서 효과가 나와도
 *   ⒜ 「목적을 말해서」인지  ⒝ 「한국어 토큰이 들어가서」인지 **가를 수 없다**.
 * 🟢 그래서 CTO 가 **E(영어 목적 문구)** 를 CONTROL 로 추가했다 — 지시서에는 없다.
 *    E 가 국내를 못 올리고 B/C 만 올리면 효과의 정체는 **한국어** 다.
 * ```
 * 🔴 A 는 SPRINT-06 의 `I-1` 과 **같은 문자열** 이라 **재검색하지 않는다**(기준선 보존).
 */
const PURPOSE_KO_SHORT = "국내/해외 동일상품 URL 찾아줘";
const PURPOSE_KO_LONG = "국내와 해외에서 이 상품을 판매하는 동일상품 URL을 찾아줘";
/** 🔴 **CTO 가 추가한 CONTROL** — 같은 «목적» 을 영어로 말한다(언어 축을 분리하기 위해). */
const PURPOSE_EN = "find stores selling this exact product in Korea and overseas";

const PURPOSE_QUERIES: { label: string; axis: string; build: (id: ProductIdentity) => string }[] = [
  {
    label: "A",
    axis: "기존 — BRAND + CODE + 상품명",
    build: (id) => buildIntentQuery(id, ""),
  },
  {
    label: "B",
    axis: "목적(한국어 · 짧게)",
    build: (id) => `${buildIntentQuery(id, "")} ${PURPOSE_KO_SHORT}`,
  },
  {
    label: "C",
    axis: "목적(한국어 · 자연스럽게)",
    build: (id) => `${buildIntentQuery(id, "")} ${PURPOSE_KO_LONG}`,
  },
  {
    label: "D",
    axis: "목적(한국어) · **품번 없이**",
    build: (id) =>
      `${buildIntentQuery({ ...id, productCode: null }, "").trim()} ${PURPOSE_KO_SHORT}`,
  },
  {
    label: "E",
    axis: "🔴 CONTROL — 목적(영어) · 언어 ↔ 목적 분리",
    build: (id) => `${buildIntentQuery(id, "")} ${PURPOSE_EN}`,
  },
];

describe("SEARCH-PROVIDER-08 §목적 문구 — 질의 생성(순수 · 네트워크 0)", () => {
  it("🔴 **A 는 기존 기준선과 같은 문자열** 이다(재검색하지 않기 위해)", () => {
    for (const p of PRODUCTS) {
      expect(PURPOSE_QUERIES[0]!.build(p.identity)).toBe(buildIntentQuery(p.identity, ""));
    }
  });

  it("🔴 D 는 **품번을 쓰지 않는다** — 「품번 없는 상품」 조건을 재현한다", () => {
    for (const p of PRODUCTS) {
      const text = PURPOSE_QUERIES[3]!.build(p.identity);
      expect(text, p.id).not.toContain(p.identity.productCode!);
      expect(text, p.id).toContain(PURPOSE_KO_SHORT);
    }
  });

  it("🔴 CONTROL E 는 **한글이 없다** — 그래야 언어 축과 목적 축이 갈린다", () => {
    for (const p of PRODUCTS) {
      expect(/[가-힣]/.test(PURPOSE_QUERIES[4]!.build(p.identity)), p.id).toBe(false);
    }
  });

  it("질의 전수를 출력한다", () => {
    for (const p of PRODUCTS) {
      for (const q of PURPOSE_QUERIES) console.log(`   ${pad(p.id, 4)} ${pad(q.label, 3)} ${q.build(p.identity)}`);
    }
    expect(PURPOSE_QUERIES).toHaveLength(5);
  });
});

const PURPOSE_LIVE = process.env.CORE_SP08_LIVE === "1";

describe.skipIf(!PURPOSE_LIVE)("SEARCH-PROVIDER-08 §목적 문구 — 실제 검색(라이브)", () => {
  it(
    "상품 4 × 질의 5 — A 는 재사용하고 나머지만 검색한다",
    async () => {
      const token = process.env.APIFY_API_TOKEN?.trim();
      expect(token, "APIFY_API_TOKEN 이 없다").toBeTruthy();
      const fsmod = await import("node:fs");
      const file = JSON.parse(fsmod.readFileSync(OUT, "utf8")) as {
        runs: {
          productId: string;
          label: string;
          source: string;
          axis: string;
          alsoFrom: string[];
          query: string;
          startedAt: string;
          results: unknown[];
        }[];
      };
      const byKey = new Map(file.runs.map((r) => [`${r.productId} ${r.query}`, r]));
      const flush = () => fsmod.writeFileSync(OUT, `${JSON.stringify(file, null, 1)}\n`);

      const pending: { p: (typeof PRODUCTS)[number]; q: (typeof PURPOSE_QUERIES)[number]; text: string }[] = [];
      for (const p of PRODUCTS) {
        for (const q of PURPOSE_QUERIES) {
          const text = q.build(p.identity);
          if (file.runs.some((r) => r.productId === p.id && r.label === q.label)) continue;
          const hit = byKey.get(`${p.id} ${text}`);
          if (hit) {
            /** 🟢 **같은 질의를 두 번 과금하지 않는다** — 결과를 복사하고 출처를 적는다. */
            file.runs.push({ ...hit, label: q.label, source: "PURPOSE", axis: q.axis, alsoFrom: [hit.label] });
            console.log(`  ${pad(p.id, 4)} ${pad(q.label, 3)} 🟢 기존 ${hit.label} 와 같은 질의 — 재검색 0`);
            continue;
          }
          pending.push({ p, q, text });
        }
      }
      flush();
      console.log(`  남은 검색 ${pending.length}회 · 예상 $${(pending.length * USD_PER_SEARCH_PAGE).toFixed(3)}`);

      const runOne = async (x: (typeof pending)[number]) => {
        const startedAt = new Date().toISOString();
        try {
          const res = await fetch(
            `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(token!)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              /** 🔴 **설정은 앞 Sprint 와 동일** — 변수는 질의 문자열 하나뿐. */
              body: JSON.stringify({
                queries: x.text,
                maxPagesPerQuery: 1,
                resultsPerPage: 20,
                saveHtml: false,
                saveHtmlToKeyValueStore: false,
              }),
            },
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const items = (await res.json()) as SearchItem[];
          const results = (items[0]?.organicResults ?? [])
            .filter((o): o is { url: string } & typeof o => Boolean(o.url))
            .map((o) => ({ url: o.url, title: o.title, displayedUrl: o.displayedUrl, description: o.description }));
          return {
            productId: x.p.id,
            label: x.q.label,
            source: "PURPOSE",
            axis: x.q.axis,
            alsoFrom: [],
            query: x.text,
            startedAt,
            results,
          };
        } catch (err) {
          /** 🔴 실패는 **기록하지 않는다** — `results: []` 가 「결과 0」이라는 거짓이 된다. */
          console.log(`  🔴 ${x.p.id} ${x.q.label} 실패(기록하지 않는다) — ${String(err).slice(0, 90)}`);
          return null;
        }
      };

      for (let i = 0; i < pending.length; i += 4) {
        const got = await Promise.all(pending.slice(i, i + 4).map(runOne));
        for (const r of got) {
          if (!r) continue;
          file.runs.push(r);
          console.log(`  ${pad(r.productId, 4)} ${pad(r.label, 3)} 결과 ${padL(String(r.results.length), 2)}  ${r.query}`);
        }
        flush();
      }
      flush();
      expect(file.runs.length).toBeGreaterThan(76);
    },
    3 * 60 * 60_000,
  );
});

/* ───────────── §9 SPRINT-09 — **짧은 판매처 Signal** + 품번 없는 상품 ───────────── */

/**
 * 🔵🔵🔵 CPO 판정(2026-10-27) — 목적 자연어는 **NO-GO**, 그러나 `"{MODEL_CODE}"` 단독도
 *    **NO-GO** 다(품번 없는 상품에서 Search 가 **0** 이 된다). 기본 골격은 아래로 잠겼다:
 * ```
 * BRAND + PRODUCT_NAME + [MODEL_CODE 있으면]      ← 🔴 품번은 **optional**
 * ```
 * 이번에 찾는 것은 그 뒤에 붙일 **짧은 판매처/시장 Signal** 하나다.
 *
 * 🔴 **구현이 아니다 · PoC 다** — 운영 Query 를 **수정하지 않는다**(CPO 명시).
 */
const SIGNAL_SAME_SELLER = "동일상품 판매처";
const SIGNAL_KR_OS_SELLER = "국내외 판매처";

/**
 * 🔴🔴 **품번이 «구조적으로» 없는 실제 상품을 넣는다**(CPO 필수 조건).
 *
 * 🟢 운영 DB 실측으로 골랐다 — 그 브랜드는 스냅샷 **전건** 에 `sku` 가 비어 있다
 *    (The Animals Observatory 18/18 · Konges Slojd 12/12).
 * 🔴 **`brand = "AW26"` 인 Bobo 스냅샷을 쓰지 않았다** — 그것들은 URL 에 품번이 있는데
 *    추출만 실패한 것이라 「품번 없는 상품」과 **다른 조건** 이다(섞으면 원인이 뭉개진다).
 */
const PRODUCTS_NO_CODE: { id: string; identity: ProductIdentity }[] = [
  {
    id: "S5",
    identity: baseIdentity({
      brand: "The Animals Observatory",
      productName: "Pupfish Kid T-Shirt in Grey Heather by The Animals Observatory",
      color: "Medium Grey Heather",
      productCode: null,
    }),
  },
  {
    id: "S6",
    identity: baseIdentity({
      brand: "Konges Slojd Clothing",
      productName: "Jody Teddy Onesie in Erba Stripe by Konges Sløjd",
      color: "Erba Stripe",
      productCode: null,
    }),
  },
];

const SP09_PRODUCTS = [...PRODUCTS, ...PRODUCTS_NO_CODE];

/**
 * 🔴🔴 **측정 전에 발견한 교란 하나 — 질의 꼬리에 전치사가 남는다.**
 *
 * 운영 Planner 의 코어 토큰은 `tokens.slice(0, 4)` 라서 품번 없는 상품에서
 * `The Animals Observatory Pupfish Kid T-Shirt **in**` 처럼 **끊긴 구** 가 된다
 * (「Pupfish Kid T-Shirt in Grey Heather by …」의 앞 4토큰).
 *
 * 🔴 **운영 Planner 를 고치지 않는다**(CPO: 운영 Query 수정 금지). 대신 그 꼬리를
 *    턴 판(`S-A2`)을 **대조군으로만** 둔다 — 그래야 결과가 나빠졌을 때
 *    ⒜「품번이 없어서」인지 ⒝「질의가 끊겨서」인지 **가를 수 있다**.
 * 🔴 이 목록은 **대조군 전용** 이고 운영 denylist 가 아니다.
 */
const TRAILING_STOPWORDS = new Set(["in", "with", "by", "for", "and", "of", "the", "a"]);
function trimTrailingStopword(text: string): string {
  const parts = text.trim().split(/\s+/);
  while (parts.length > 1 && TRAILING_STOPWORDS.has(parts[parts.length - 1]!.toLowerCase())) parts.pop();
  return parts.join(" ");
}

const SIGNAL_QUERIES: { label: string; axis: string; build: (id: ProductIdentity) => string }[] = [
  { label: "S-A", axis: "기준선 — BRAND + 상품명 + [품번]", build: (id) => buildIntentQuery(id, "") },
  {
    label: "S-A2",
    axis: "🔴 CONTROL — 기준선에서 **끊긴 전치사만** 제거(운영 변경 0)",
    build: (id) => trimTrailingStopword(buildIntentQuery(id, "")),
  },
  { label: "S-B", axis: `+ ${SIGNAL_SAME_SELLER}`, build: (id) => `${buildIntentQuery(id, "")} ${SIGNAL_SAME_SELLER}` },
  { label: "S-C", axis: `+ ${SIGNAL_KR_OS_SELLER}`, build: (id) => `${buildIntentQuery(id, "")} ${SIGNAL_KR_OS_SELLER}` },
  {
    label: "S-D",
    axis: `**품번 제외** + ${SIGNAL_SAME_SELLER}`,
    build: (id) => `${buildIntentQuery({ ...id, productCode: null }, "")} ${SIGNAL_SAME_SELLER}`,
  },
];

describe("SEARCH-PROVIDER-09 §Signal — 질의 생성(순수 · 네트워크 0)", () => {
  it("🔴 품번 없는 상품이 **실제로** 포함돼 있다 — 그리고 질의가 만들어진다", () => {
    expect(PRODUCTS_NO_CODE.length).toBeGreaterThanOrEqual(1);
    for (const p of PRODUCTS_NO_CODE) {
      expect(p.identity.productCode, p.id).toBeNull();
      for (const q of SIGNAL_QUERIES) {
        const text = q.build(p.identity);
        /** 🔴🔴 **「품번이 없으면 Search 0」이 되지 않는다** — 그것이 이 조건의 핵심이다. */
        expect(text.trim().length, `${p.id} ${q.label}`).toBeGreaterThan(0);
        expect(text, `${p.id} ${q.label}`).toContain(p.identity.brand!);
      }
    }
  });

  it("🔴 S-D 는 **품번을 쓰지 않는다**(품번 있는 상품에서도)", () => {
    for (const p of PRODUCTS) {
      expect(SIGNAL_QUERIES[4]!.build(p.identity), p.id).not.toContain(p.identity.productCode!);
    }
  });

  it("🟢 S-A 는 기준선과 같은 문자열이다(재검색하지 않기 위해)", () => {
    for (const p of SP09_PRODUCTS) {
      expect(SIGNAL_QUERIES[0]!.build(p.identity)).toBe(buildIntentQuery(p.identity, ""));
    }
  });

  it("질의 전수를 출력한다", () => {
    for (const p of SP09_PRODUCTS) {
      for (const q of SIGNAL_QUERIES) console.log(`   ${pad(p.id, 4)} ${pad(q.label, 5)} ${q.build(p.identity)}`);
    }
    expect(SP09_PRODUCTS).toHaveLength(6);
  });
});

const SIGNAL_LIVE = process.env.CORE_SP09_LIVE === "1";

describe.skipIf(!SIGNAL_LIVE)("SEARCH-PROVIDER-09 §Signal — 실제 검색(라이브)", () => {
  it(
    "상품 6(품번 있음 4 · **없음 2**) × 질의 4 — 같은 질의는 재검색하지 않는다",
    async () => {
      const token = process.env.APIFY_API_TOKEN?.trim();
      expect(token, "APIFY_API_TOKEN 이 없다").toBeTruthy();
      const fsmod = await import("node:fs");
      const file = JSON.parse(fsmod.readFileSync(OUT, "utf8")) as {
        origins: Record<string, unknown>;
        runs: {
          productId: string;
          label: string;
          source: string;
          axis: string;
          alsoFrom: string[];
          query: string;
          startedAt: string;
          results: unknown[];
        }[];
      };
      /** 🟢 새 상품 둘의 원상품 정보를 fixture 에 적는다(화면이 비교 대상을 보여줘야 한다). */
      for (const p of PRODUCTS_NO_CODE) {
        file.origins[p.id] = {
          brand: p.identity.brand,
          code: p.identity.productCode,
          name: p.identity.productName,
          color: p.identity.color,
        };
      }
      const byKey = new Map(file.runs.map((r) => [`${r.productId} ${r.query}`, r]));
      const flush = () => fsmod.writeFileSync(OUT, `${JSON.stringify(file, null, 1)}\n`);

      const pending: { p: (typeof SP09_PRODUCTS)[number]; q: (typeof SIGNAL_QUERIES)[number]; text: string }[] = [];
      for (const p of SP09_PRODUCTS) {
        for (const q of SIGNAL_QUERIES) {
          const text = q.build(p.identity);
          if (file.runs.some((r) => r.productId === p.id && r.label === q.label)) continue;
          const hit = byKey.get(`${p.id} ${text}`);
          if (hit) {
            const copy = { ...hit, label: q.label, source: "SIGNAL", axis: q.axis, alsoFrom: [hit.label] };
            file.runs.push(copy);
            /**
             * 🔴🔴 **같은 루프 안에서 추가된 것도 dedupe 대상이다.** 1차 구현이 이 줄을
             *    빠뜨려, 품번 없는 상품에서 `S-D`(품번이 없으니 `S-B` 와 **문자열이 같다**)를
             *    **두 번 검색** 했다($0.009 낭비 · 계약이 잡았다).
             * 🟢 그 사고가 뜻밖의 증거를 줬다 — 같은 질의를 몇 분 뒤 다시 돌렸더니
             *    S6 는 **8↔9건 중 3건만 겹쳤다**(실행 간 변동이 크다).
             */
            byKey.set(`${p.id} ${text}`, copy);
            console.log(`  ${pad(p.id, 4)} ${pad(q.label, 5)} 🟢 기존 ${hit.label} 와 같은 질의 — 재검색 0`);
            continue;
          }
          pending.push({ p, q, text });
        }
      }
      flush();
      console.log(`  남은 검색 ${pending.length}회 · 예상 $${(pending.length * USD_PER_SEARCH_PAGE).toFixed(3)}`);

      const runOne = async (x: (typeof pending)[number]) => {
        const startedAt = new Date().toISOString();
        try {
          const res = await fetch(
            `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(token!)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                queries: x.text,
                maxPagesPerQuery: 1,
                resultsPerPage: 20,
                saveHtml: false,
                saveHtmlToKeyValueStore: false,
              }),
            },
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const items = (await res.json()) as SearchItem[];
          const results = (items[0]?.organicResults ?? [])
            .filter((o): o is { url: string } & typeof o => Boolean(o.url))
            .map((o) => ({ url: o.url, title: o.title, displayedUrl: o.displayedUrl, description: o.description }));
          return {
            productId: x.p.id,
            label: x.q.label,
            source: "SIGNAL",
            axis: x.q.axis,
            alsoFrom: [],
            query: x.text,
            startedAt,
            results,
          };
        } catch (err) {
          console.log(`  🔴 ${x.p.id} ${x.q.label} 실패(기록하지 않는다) — ${String(err).slice(0, 90)}`);
          return null;
        }
      };

      for (let i = 0; i < pending.length; i += 4) {
        const got = await Promise.all(pending.slice(i, i + 4).map(runOne));
        for (const r of got) {
          if (!r) continue;
          file.runs.push(r);
          console.log(`  ${pad(r.productId, 4)} ${pad(r.label, 5)} 결과 ${padL(String(r.results.length), 2)}  ${r.query}`);
        }
        flush();
      }
      flush();
      expect(file.runs.length).toBeGreaterThan(96);
    },
    3 * 60 * 60_000,
  );
});

/* ───────────── §10 SPRINT-10 — **Query 안정성 2회 관측**(정확히 18회) ───────────── */

/**
 * 🔵🔵🔵 CPO 지시(2026-10-27) — SP-09 가 찾은 **검색 자체의 변동성** 을 먼저 통제한다.
 *    (같은 질의를 몇 분 뒤 돌렸더니 S6 는 8↔9건 중 **3건만** 겹쳤다.)
 *
 * ── 🔴 계약 ───────────────────────────────────────────────────────────────
 * ```
 * 대상      S-A · S-C · S-D **셋만**(S-B 탈락 · 새 Query 발명 금지)
 * 표본      SP-09 와 **같은 6 상품**(품번 있음 4 + **실제 code-less 2**)
 * 실행      각 조건 **정확히 1회 추가** ⟹ 6 × 3 = **18회**. 🔴 그 이상 돌리지 않는다
 * 기존      SP-09 1차 관측을 **버리지 않는다** ⟹ 조건당 **총 2회 관측**
 * ```
 * 🔴🔴 **POC_REPEAT = true · OPERATING_SEARCH = 0** — 이 2차 관측은 **PoC 전용** 이고
 *    운영 계약 **「1 Product = 1 Search」는 그대로** 다(운영 retry 가 아니다).
 */
const STABILITY_LABELS = ["S-A", "S-C", "S-D"] as const;
/** 🔴 **상한이자 기대값** 이다 — 넘으면 호출하지 않고 멈춘다(CPO §4 STOP). */
const SP10_EXPECTED_SEARCHES = 18;

const STABILITY_LIVE = process.env.CORE_SP10_LIVE === "1";

describe.skipIf(!STABILITY_LIVE)("SEARCH-PROVIDER-10 §안정성 — 2차 관측(라이브 · 정확히 18회)", () => {
  it(
    "S-A/S-C/S-D × 상품 6 — 같은 질의를 **한 번 더** 돌려 변동을 잰다",
    async () => {
      const token = process.env.APIFY_API_TOKEN?.trim();
      expect(token, "APIFY_API_TOKEN 이 없다").toBeTruthy();
      const fsmod = await import("node:fs");
      const file = JSON.parse(fsmod.readFileSync(OUT, "utf8")) as {
        runs: {
          productId: string;
          label: string;
          source: string;
          axis: string;
          alsoFrom: string[];
          query: string;
          startedAt: string;
          results: { url: string; title?: string; displayedUrl?: string; description?: string }[];
          pocRepeat?: boolean;
          repeatOf?: string;
        }[];
      };
      const flush = () => fsmod.writeFileSync(OUT, `${JSON.stringify(file, null, 1)}\n`);

      /**
       * 🔴🔴 **여기서는 dedupe 를 «일부러» 하지 않는다.** 같은 질의를 다시 도는 것이
       *    이 실험의 목적이기 때문이다. 🟢 대신 `pocRepeat` 로 **운영 retry 와 구별** 한다.
       */
      const pending: { productId: string; label: string; query: string }[] = [];
      for (const p of SP09_PRODUCTS) {
        for (const label of STABILITY_LABELS) {
          const first = file.runs.find((r) => r.productId === p.id && r.label === label);
          if (!first) {
            console.log(`  🔴 ${p.id} ${label} — 1차 관측이 없다(건너뛴다)`);
            continue;
          }
          if (file.runs.some((r) => r.productId === p.id && r.label === `${label}#2`)) continue;
          pending.push({ productId: p.id, label, query: first.query });
        }
      }
      /** 🔴 **18회를 넘으면 호출하지 않고 멈춘다**(CPO §4). */
      expect(pending.length, `추가 검색이 ${pending.length}회다 — 18회를 넘으면 STOP`).toBeLessThanOrEqual(
        SP10_EXPECTED_SEARCHES,
      );
      console.log(
        `  추가 검색 ${pending.length}회 · 예상 $${(pending.length * USD_PER_SEARCH_PAGE).toFixed(3)} · POC_REPEAT=true · OPERATING_SEARCH=0`,
      );

      const runOne = async (x: (typeof pending)[number]) => {
        const startedAt = new Date().toISOString();
        try {
          const res = await fetch(
            `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(token!)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              /** 🔴 **설정이 1차와 한 글자도 다르지 않다** — 변동만 보려는 실험이다. */
              body: JSON.stringify({
                queries: x.query,
                maxPagesPerQuery: 1,
                resultsPerPage: 20,
                saveHtml: false,
                saveHtmlToKeyValueStore: false,
              }),
            },
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const items = (await res.json()) as SearchItem[];
          const results = (items[0]?.organicResults ?? [])
            .filter((o): o is { url: string } & typeof o => Boolean(o.url))
            .map((o) => ({ url: o.url, title: o.title, displayedUrl: o.displayedUrl, description: o.description }));
          return {
            productId: x.productId,
            label: `${x.label}#2`,
            source: "STABILITY",
            axis: `${x.label} 2차 관측(PoC 전용 반복)`,
            alsoFrom: [],
            query: x.query,
            startedAt,
            results,
            /** 🔴🔴 **운영 retry 가 아니다** — 이 두 칸이 그것을 구별한다. */
            pocRepeat: true,
            repeatOf: x.label,
          };
        } catch (err) {
          console.log(`  🔴 ${x.productId} ${x.label}#2 실패(기록하지 않는다) — ${String(err).slice(0, 90)}`);
          return null;
        }
      };

      let done = 0;
      for (let i = 0; i < pending.length; i += 4) {
        const got = await Promise.all(pending.slice(i, i + 4).map(runOne));
        for (const r of got) {
          if (!r) continue;
          file.runs.push(r);
          done += 1;
          console.log(`  ${pad(r.productId, 4)} ${pad(r.label, 7)} 결과 ${padL(String(r.results.length), 2)}`);
        }
        flush();
      }
      flush();
      console.log(`  ✅ 추가 검색 ${done}회 수행(상한 ${SP10_EXPECTED_SEARCHES})`);
      expect(done).toBeLessThanOrEqual(SP10_EXPECTED_SEARCHES);
    },
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
        `\n${pad("상품", 5)}${pad("Query", 20)}${padL("결과", 5)}${padL("상품URL", 8)}${padL("판매처", 7)}${padL("Crawl", 7)}${padL("Evid", 6)}${padL("품번", 6)}${padL("Evid판매처", 8)}${padL("🇰🇷Evid", 9)}`,
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
        /**
         * 🔴🔴 **CPO 기준의 실제 분자** — 「국내 판매처인데 **Evidence 까지 살아남은** 수」.
         *    전체 Evidence 판매처만 보면 「국내가 늘었다」와 「국내가 **쓸모 있게** 늘었다」를
         *    구별할 수 없다. 🔴 KR 판별은 **`.kr` TLD 하나** 로만 한다(등록부는 시장 증거가
         *    아니라는 WU-019R 결론 때문에 여기서 섞지 않는다 · 보수적으로 **과소** 추정).
         */
        const krEvidenceSellers = new Set<string>();
        for (const url of productUrls) {
          const v = await probe(url);
          if (!v.ok) continue;
          crawlOk += 1;
          if (v.evidence) {
            evidence += 1;
            evidenceSellers.add(hostOf(url));
            if (hostOf(url).endsWith(".kr")) krEvidenceSellers.add(hostOf(url));
          }
          if (code && v.code.includes(code)) codeMatch += 1;
        }
        out[`${run.productId}/${run.label}`] = { crawlOk, evidence, codeMatch };
        console.log(
          `${pad(run.productId, 5)}${pad(run.label, 20)}${padL(String(run.results.length), 5)}${padL(String(productUrls.length), 8)}${padL(String(sellers.size), 7)}${padL(String(crawlOk), 7)}${padL(String(evidence), 6)}${padL(String(codeMatch), 6)}${padL(String(evidenceSellers.size), 8)}${padL(String(krEvidenceSellers.size), 9)}`,
        );
      }
      expect(Object.keys(out).length).toBeGreaterThan(0);
    },
    60 * 60_000,
  );
});
