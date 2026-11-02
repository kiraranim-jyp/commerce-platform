import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SPRINT 3 P0 — **네 층 분모 + CAD 26,300 one-row trace**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `Search → Crawl/Evidence → Identity → Visibility / Price Aggregation`
 *
 * 🔴🔴 **스냅샷을 요구하지 않는다.** 운영 DB 읽기가 도구 안전검사에 막혀 있어
 *    snapshotId/workspaceId 를 얻을 수 없다. 🔴 그래서 지어내지 않고, 대신
 *    **스냅샷이 필요 없는 운영 함수 경로** 를 운영 호출 순서 그대로 탄다
 *    (`search-provider-11-funnel` · `dif-02-identity-funnel` 과 같은 방식).
 * 🟢 측정 목표(「어디서 사라지는가」·「왜 집계에 들어갔는가」)는 그 경로로 전부 답한다 —
 *    `runDomesticPriceCheck` 의 snapshot 인자는 **기록/중복제거용** 이고 판정에 쓰이지 않는다.
 *
 * ── 🔴 하지 않는 것 ────────────────────────────────────────────────────────
 * ```
 * ❌ 운영 코드 변경 · 판정 변경 · threshold · 8축 · Registry · Query 변경 · 가격 정책
 * ❌ 새 판정 — verdict/truth/tier/market 은 **운영 함수가 낸 값** 을 읽는다
 * ❌ 집계 진입을 내가 다시 쓰지 않는다 — `summarizeCandidateOverseasPrices` 를
 *    **후보 하나씩 직접 불러** byCurrency 가 생기는지로 판정한다(복제식 0)
 * ❌ DB write · migration · schema
 * ```
 * 🔴🔴 **외부 과금** — 검색은 `MAX_SEARCHES_PER_PRODUCT = 1`(상품당 1회)이다.
 *    CPO 가 **원인 측정용 1회** 로 승인했다 ⟹ 🔴 숫자가 마음에 들 때까지 다시 돌리지 않는다.
 * 🔴 게이트 `SPRINT3_FUNNEL=1` 없으면 SKIP(회귀에서 외부 HTTP·과금 금지).
 */

const LIVE = process.env.SPRINT3_FUNNEL === "1";

/**
 * 🔴🔴 **TEST A 는 이 실행에서 «측정불가» 다 — 0 으로 적지 않는다.**
 * ```
 * B226AC043 은 ⒜ 운영 DB(차단) ⒝ 라이브 Search(토큰 없음) 둘 중 하나가 필요하고
 * ⒞ 저장 Search 산출물(`search-provider-05-raw.json`)에 **0건** 이다(전수 grep).
 * ⟹ 🔴 URL 을 지어내지 않는다. TEST A 는 권한이 열릴 때 돈다.
 * ```
 * 🟢 **TEST B(Recall)는 지금 정직하게 측정된다** — 저장분이 바로 「**기존에 발견되던
 *    후보 집합**」이고 TEST B 의 질문이 정확히 「그 후보가 **지금도** 살아남는가」다.
 * 🔴 그래서 Search 분모는 **「저장분(질의 33종 합집합)」** 으로 적는다 —
 *    🔴 **운영 1회 질의 산출로 쓰지 않는다**(`MAX_SEARCHES_PER_PRODUCT = 1`).
 */
const TARGETS = [
  {
    id: "TEST B / B226AC010 (Recall)",
    url: "https://bobochoses.com/en-kr/products/b226ac010-booty-ghosts-t-shirt",
    fixtureProductId: "S1",
  },
] as const;

interface RawFixture {
  runs: { productId: string; label: string; query: string; results: { url: string }[] }[];
}

/** 🟢 저장된 Search 산출물 — 과금 0 · DB 0. 🔴 가공하지 않는다(URL 그대로). */
function fixtureUrls(productId: string): { urls: string[]; runs: number; queries: number } {
  const raw = JSON.parse(
    readFileSync(join(__dirname, "fixtures", "search-provider-05-raw.json"), "utf8"),
  ) as RawFixture;
  const runs = raw.runs.filter((r) => r.productId === productId);
  const set = new Set<string>();
  for (const r of runs) for (const x of r.results) if (x?.url) set.add(x.url);
  return { urls: [...set], runs: runs.length, queries: new Set(runs.map((r) => r.query)).size };
}

const pad = (s: unknown, n: number) => String(s) + " ".repeat(Math.max(0, n - String(s).length));
const padL = (s: unknown, n: number) => " ".repeat(Math.max(0, n - String(s).length)) + String(s);
const loose = (u: string) => String(u).trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");
const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "?";
  }
};

/** 🟢 토큰은 운영과 같은 자리에서 읽는다 — 값은 **출력하지 않는다**. */
function loadEnvToken(): string | null {
  if (process.env.APIFY_API_TOKEN) return process.env.APIFY_API_TOKEN;
  for (const p of ["../../../../../../../scripts/.env", "../../../../../../../.env.local", "../../../../../../../.env"]) {
    try {
      const txt = readFileSync(join(__dirname, p), "utf8");
      const m = txt.match(/^APIFY_API_TOKEN=(.*)$/m);
      if (m?.[1]) return m[1].trim().replace(/^["']|["']$/g, "");
    } catch {
      /* 없으면 다음 후보 */
    }
  }
  return null;
}

type Row = {
  url: string;
  domain: string;
  /** ① Search 가 돌려줬는가 */
  fromSearch: boolean;
  /** ② Crawl/Evidence */
  crawled: boolean;
  hasBrand: boolean;
  hasTitle: boolean;
  hasCode: boolean;
  dropReason: string | null;
  /** ③ Identity */
  verdict: string | null;
  truth: string | null;
  blockers: string;
  conflicts: string;
  judged: boolean;
  dropGate: string | null;
  isBest: boolean;
  /** ④ Price / Visibility */
  tier: string | null;
  price: number | null;
  currency: string | null;
  priceStatus: string | null;
  market: string | null;
  enteredAggregate: boolean;
  title: string;
  lostAt: string | null;
};

describe("SPRINT 3 P0 — Search/Crawl/Identity/Price 네 층 분모", () => {
  it.runIf(LIVE)(
    "🔴 후보가 어디서 사라지는가 · 어떤 후보가 가격 집계에 들어가는가",
    async () => {
      const token = loadEnvToken();
      console.log(`[env] 라이브 Search 가능 = ${token ? "yes" : "🔴 no(토큰 없음) ⟹ 저장분으로 ②~⑥ 만 측정"}`);

      const { shopifySiteStrategy } = await import("@commerce/crawler/src/site-strategies/shopify.site-strategy");
      const {
        enrichCandidatePrices,
        fetchDomesticModelCode,
        isSelfReferenceCandidate,
        withConfidence,
      } = await import("@commerce/crawler");
      const { buildCrossSellerSearchQueries, buildProductIdentityDna, productFactsFromIdentityDna } = await import(
        "@commerce/shared"
      );
      const { buildCanonicalProduct } = await import("../../../pipeline/canonical-product");
      const { priceTierFromLink } = await import("../../../domestic-price-sources/_lib/domestic-product-link");
      const { classifyCandidateMarket, summarizeCandidateOverseasPrices } = await import("../candidate-market");
      const { judgeDomesticCandidate } = await import("../run-domestic-price-check");
      const { REVIEWED_SAME_SHOP_ID, REVIEWED_SAME_SHOP_NAME } = await import("../transient-candidates");
      const { collectUrlCandidatePool } = await import("../url-candidate-pool");
      const { collectWebSearchUrls } = await import("../web-search-pool");

      /* eslint-disable no-console */
      for (const target of TARGETS) {
        console.log(`\n${"=".repeat(96)}\n=== ${target.id}\n${"=".repeat(96)}`);

        /* ── ① 원상품 — 운영 추출 경로 ──────────────────────────────────── */
        const extracted = await shopifySiteStrategy.extract(target.url);
        const product = buildCanonicalProduct(target.url, extracted!.productData as never, {} as never, []);
        const dna = buildProductIdentityDna(product);
        const terms = buildCrossSellerSearchQueries(dna);
        const query = {
          title: dna.title,
          brand: dna.brand.value || undefined,
          sourceUrl: dna.sourceUrl,
          sku: dna.identifier?.tier === "SKU" ? dna.identifier.value : undefined,
          searchTerm: terms[0] ?? dna.title,
          searchTerms: terms,
          facts: productFactsFromIdentityDna(dna),
        };
        console.log(
          `[origin] brand="${dna.brand.value}" code=${dna.brandModelCode} color=${dna.color}\n` +
            `[origin] title="${dna.title}"`,
        );

        /* ── ② Search ─────────────────────────────────────────────────────
         * 🔴 토큰이 있으면 **운영 함수 1회**, 없으면 **저장분**(과금 0)으로 간다.
         *    🔴 둘을 같은 숫자로 적지 않는다 — `source` 를 같이 출력한다.
         */
        /**
         * 🔴🔴 `ProductIdentity` 는 `ProductIdentityDna` 가 **아니다**(`brand` 가 문자열 ↔ 객체).
         *    🟢 그래서 운영 호출부(`run-domestic-price-check.ts:1588`)의 **칸 옮기기를 그대로
         *    베낀다** — 여기서 문자열을 조립하지 않는다. 🔴 1차에 dna 를 그대로 넘겨
         *    `identity.brand?.trim is not a function` 로 **FAIL 했고 그것이 맞았다**.
         */
        const identity = {
          brand: dna.brand.value || null,
          productName: dna.title || null,
          productType: dna.category?.value ?? null,
          genderAge: null,
          color: dna.color,
          size: null,
          season: null,
          productCode: dna.brandModelCode,
          facts: [dna.material, dna.fit].filter((v): v is string => Boolean(v)),
          sourceUrl: query.sourceUrl,
          sourceSite: null,
          sourceCountry: null,
          market: null,
        };

        let search: { urls: string[]; metrics: Record<string, unknown> };
        if (token) {
          const live = await collectWebSearchUrls({ identity: identity as never, token });
          search = { urls: live.urls, metrics: { source: "LIVE(운영 1회)", ...live.metrics } };
        } else {
          const fx = fixtureUrls(target.fixtureProductId);
          search = {
            urls: fx.urls,
            metrics: {
              source: "FIXTURE(search-provider-05-raw · 저장분)",
              runs: fx.runs,
              distinctQueries: fx.queries,
              uniqueUrls: fx.urls.length,
              note: "🔴 질의 합집합이라 운영 1회 산출이 아니다 — Recall 분모로만 쓴다",
            },
          };
          /** 🟢 운영 질의 «문자열» 은 비용 0 으로 확인할 수 있다 — 같이 적는다. */
          const { buildDiscoverySearchQuery } = await import("@commerce/crawler/src/discovery-core/query-planner");
          console.log(`[① 운영 질의(참고 · 호출 0)] "${buildDiscoverySearchQuery(identity as never) ?? "(null)"}"`);
        }
        console.log(`[① Search] ${JSON.stringify(search.metrics)}`);
        console.log(`[① Search] urls ${search.urls.length}건`);

        /* ── ③ Crawl / Evidence — 운영 pool ───────────────────────────── */
        const pool = await collectUrlCandidatePool({
          urls: search.urls,
          originUrl: query.sourceUrl,
          maxUrls: search.urls.length,
          existingCanonicalUrls: new Set<string>(),
          shopId: REVIEWED_SAME_SHOP_ID,
          shopNamePrefix: REVIEWED_SAME_SHOP_NAME,
        } as never);
        console.log(`[② Pool] metrics ${JSON.stringify(pool.metrics)}`);

        const dropReason = new Map<string, string>();
        for (const d of pool.metrics.dropped) dropReason.set(loose(d.url), d.reason);

        const byUrl = new Map<string, Row>();
        for (const u of search.urls) {
          byUrl.set(loose(u), {
            url: u,
            domain: hostOf(u),
            fromSearch: true,
            crawled: false,
            hasBrand: false,
            hasTitle: false,
            hasCode: false,
            dropReason: dropReason.get(loose(u)) ?? null,
            verdict: null,
            truth: null,
            blockers: "[]",
            conflicts: "[]",
            judged: false,
            dropGate: null,
            isBest: false,
            tier: null,
            price: null,
            currency: null,
            priceStatus: null,
            market: null,
            enteredAggregate: false,
            title: "",
            lostAt: null,
          });
        }

        /* ── ④ Identity → Price — 운영 호출 순서 그대로 ────────────────── */
        for (const res of pool.searchResults) {
          if (res.status !== "ok" || res.candidates.length === 0) continue;
          const notSelf = res.candidates.filter((c) => !isSelfReferenceCandidate(query.sourceUrl, c.url));
          const scored = withConfidence(query as never, notSelf);
          let priced = scored;
          try {
            priced = await enrichCandidatePrices(scored, res.domain, query as never);
          } catch {
            /* 운영과 같다 — 실패해도 점수만으로 계속 간다 */
          }
          const j = await judgeDomesticCandidate({
            domain: res.domain,
            candidates: priced,
            sourceUrl: query.sourceUrl,
            foreignModelCode: dna.brandModelCode,
            foreignColor: dna.color,
            fetchModelCode: (u: string) => fetchDomesticModelCode(res.domain, u),
          } as never);
          for (const c of priced) {
            const row = byUrl.get(loose(c.url)) ?? {
              ...({} as Row),
              url: c.url,
              domain: res.domain,
              fromSearch: false,
            };
            if (!byUrl.has(loose(c.url))) byUrl.set(loose(c.url), row as Row);
            row.crawled = true;
            /** 🟢 `ComparisonCandidate` 가 이 칸들을 **직접** 갖는다 — 캐스팅하지 않는다. */
            const f = c.facts;
            row.domain = res.domain;
            row.title = String(c.title ?? "");
            row.hasBrand = Boolean(f?.brand || c.brand);
            row.hasTitle = Boolean(c.title && String(c.title).trim().length > 0);
            row.hasCode = Boolean(f?.brandModelCode || c.sku);
            row.verdict = c.crossSellerVerdict ?? null;
            row.blockers = JSON.stringify(c.crossSellerBlockers ?? []);
            row.conflicts = JSON.stringify(c.crossSellerConflicts ?? []);
            row.price = c.price?.amount ?? null;
            row.currency = c.price?.currency ?? null;
            row.priceStatus = c.priceStatus ?? null;
            row.judged = j.kind === "JUDGED";
            row.dropGate = j.kind === "DROPPED" ? j.gate : j.kind === "JUDGED" ? null : j.kind;
            if (j.kind === "JUDGED" && loose(j.best.url) === loose(c.url)) {
              row.isBest = true;
              row.truth = j.matchTruth;
              row.tier = priceTierFromLink({ matchTruth: j.matchTruth, verified: j.verified });
              row.market = classifyCandidateMarket({
                domain: res.domain,
                currency: j.best.price?.currency ?? null,
                isRegisteredDomesticShop: false,
              }).market;
              /**
               * 🔴🔴 집계 진입을 **내가 판정하지 않는다** — 운영 집계기를 **이 후보 하나만**
               *    넣어 부르고 금액 버킷이 생기면 「진입」이다. 생산자(market-intelligence)
               *    가 만드는 레코드 모양을 그대로 베낀다(해외 축 = KRW 제외).
               */
              const amt = j.best.price?.amount ?? null;
              const cur = j.best.price?.currency ?? null;
              if (row.market !== "KR" && amt != null && cur && cur.toUpperCase() !== "KRW") {
                const s = summarizeCandidateOverseasPrices([
                  { market: row.market!, currency: cur, amount: amt, priceTier: row.tier! },
                ]);
                row.enteredAggregate = Object.keys(s.byCurrency).length > 0;
              }
            }
          }
        }

        /** 🔴 사라진 «첫» 지점을 적는다 — 뭉치지 않는다. */
        for (const row of byUrl.values()) {
          if (!row.crawled) {
            row.lostAt = row.dropReason ? `② 입력경계/접근(${row.dropReason})` : "② Crawl 실패(사유 미기록)";
          } else if (!(row.hasBrand || row.hasTitle || row.hasCode)) row.lostAt = "③ Evidence 없음";
          else if (!row.judged) row.lostAt = `④ 샵 판정 전 탈락(${row.dropGate ?? "?"})`;
          else if (!row.isBest) row.lostAt = "④ 샵 대표 아님";
          else if (row.price == null) row.lostAt = "⑤ 가격 없음";
          else if (!row.enteredAggregate && row.market === "KR") row.lostAt = null;
          else if (!row.enteredAggregate) row.lostAt = `⑥ 집계 제외(tier=${row.tier} market=${row.market})`;
        }

        const rows = [...byUrl.values()];
        /* ── ⑤ 층별 분모 ───────────────────────────────────────────────── */
        const n = (f: (r: Row) => boolean) => rows.filter(f).length;
        console.log("\n──── 층별 분모 ────");
        console.log(`① Search discovered   ${padL(search.urls.length, 4)}`);
        console.log(`② Crawl evidence      ${padL(n((r) => r.crawled), 4)}`);
        console.log(`③ Identity judged     ${padL(n((r) => r.judged), 4)}`);
        console.log(`④ Visible(샵 대표)     ${padL(n((r) => r.isBest), 4)}`);
        console.log(`⑤ Price available     ${padL(n((r) => r.isBest && r.price != null), 4)}`);
        console.log(`⑥ Aggregation entry   ${padL(n((r) => r.enteredAggregate), 4)}`);

        console.log("\n──── 후보 전수(한 행 = 네 층) ────");
        for (const r of rows) {
          console.log(
            `[row] ${pad(r.domain, 26)} v=${pad(r.verdict ?? "-", 14)} truth=${pad(r.truth ?? "-", 20)}` +
              ` tier=${pad(r.tier ?? "-", 11)} ${padL(r.price ?? "-", 10)} ${pad(r.currency ?? "", 4)}` +
              ` mk=${pad(r.market ?? "-", 9)} AGG=${r.enteredAggregate ? "🔴진입" : "·"} lost=${r.lostAt ?? "-"}`,
          );
          console.log(`      "${r.title.slice(0, 88)}"  blk=${r.blockers} cf=${r.conflicts}`);
          console.log(`      ${r.url.slice(0, 150)}`);
        }

        /* ── ⑥ 집계에 들어간 후보 · 통화별 최저가의 «출처» ─────────────── */
        const agg = rows.filter((r) => r.enteredAggregate);
        const lowest: Record<string, Row> = {};
        for (const r of agg) {
          const c = (r.currency ?? "?").toUpperCase();
          if (lowest[c] == null || (r.price ?? Infinity) < (lowest[c].price ?? Infinity)) lowest[c] = r;
        }
        console.log("\n──── 통화별 «최저 확인가» 의 실제 출처 ────");
        for (const [c, r] of Object.entries(lowest)) {
          console.log(
            `[lowest] ${pad(c, 4)} ${padL(r.price ?? "-", 10)} v=${pad(r.verdict ?? "-", 14)}` +
              ` truth=${pad(r.truth ?? "-", 20)} tier=${pad(r.tier ?? "-", 11)} ${r.domain}`,
          );
          console.log(`         "${r.title.slice(0, 88)}"`);
        }
        const sameish = (v: string | null) => v === "SAME" || v === "PRESUMED_SAME";
        console.log(
          `\n🔎 집계 진입 ${agg.length}건 · verdict 가 SAME/PRESUMED «아닌» 것 ${agg.filter((r) => !sameish(r.verdict)).length}건`,
        );
        console.log(`   verdict 분포 ${JSON.stringify(agg.reduce<Record<string, number>>((a, r) => ((a[r.verdict ?? "null"] = (a[r.verdict ?? "null"] ?? 0) + 1), a), {}))}`);
        console.log(`   tier 분포    ${JSON.stringify(agg.reduce<Record<string, number>>((a, r) => ((a[r.tier ?? "null"] = (a[r.tier ?? "null"] ?? 0) + 1), a), {}))}`);

        /** 🔴 열화 감지 — 전건 0 이면 「없다」가 아니라 **측정불가** 다. */
        expect(
          search.urls.length,
          "🔴 Search URL 0 — 못 물어봤거나 열화다. 이 실행의 숫자를 제품 사실로 쓰지 않는다",
        ).toBeGreaterThan(0);
      }
    },
    1_800_000,
  );
});
