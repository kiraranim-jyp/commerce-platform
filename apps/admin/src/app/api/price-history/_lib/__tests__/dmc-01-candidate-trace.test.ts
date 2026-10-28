import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 DISCOVERY-TO-MI-CANONICAL-01 §8·§11·§12 — **후보 하나의 전 이력 추적**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 한 문장 — 「AI Search 가 찾은 후보를 **처음부터 끝까지 추적** 하여, 원본과
 * 비교한 **MI SAME 결과만** 국내/해외 가격 형성과 `따져` 에 연결한다.」
 *
 * 🔴 **새 Search 0** — §17 Production 실행이 돌려준 **그 URL 집합** 을 그대로 쓴다.
 * 🔴 Query · Identity · threshold · Market Attribution · MI 계산식 **변경 0**.
 * 🔴 Registry · adapter · 403 우회 · Browser fallback · 국내/해외 분리 **0**.
 *
 * 🟢 이 파일이 더하는 것은 **§11 근거** 다 — `crossSellerReasons` / `Blockers` /
 *    `Conflicts` 를 **운영이 낸 그대로** 꺼내 「왜 SAME 인가 / 왜 아닌가」를 적는다.
 */

const LIVE = process.env.DMC01_LIVE === "1";
const FIX = join(__dirname, "fixtures");
const ORIGIN = "https://bobochoses.com/en-kr/products/b226ac009-hug-hairy-monster-t-shirt";

/** 🟢 분모를 **손으로 적지 않는다** — Production 실행 기록에서 뽑는다. */
function aiSearchUrls(): string[] {
  const run = (
    JSON.parse(readFileSync(join(FIX, "query-arch-01-production.json"), "utf8")) as {
      runs: { label: string; pool: { dropped: { url: string }[] } | null; rows: { source: string; url: string }[] }[];
    }
  ).runs.find((r) => r.label === "Bobo Choses")!;
  const fromRows = run.rows.filter((r) => r.source === "WEB_SEARCH").map((r) => r.url);
  const dropped = (run.pool?.dropped ?? []).map((d) => d.url);
  return [...new Set([...fromRows, ...dropped])];
}

describe("DMC-01 — ① AI Search 후보 목록", () => {
  it("🟢 분모는 Production 실행에서 나온다(지어내지 않았다)", () => {
    const urls = aiSearchUrls();
    /** 🔴 organic 4 = WEB_SEARCH 생존 3 + 탈락 1. 그 넷이 전부다. */
    expect(urls).toHaveLength(4);
    expect(urls.some((u) => u.includes("bridge.babyshop.com"))).toBe(true);
  });

  /**
   * 🔴🔴 **AI Search 축에 한국 도메인이 하나도 없다** — 이것이 국내 축의 현재 상한이다.
   *    🟢 계약으로 잠가 둔다: 국내 URL 이 하나라도 들어오면 이 단언이 **FAIL 로 뒤집히고**
   *       그것이 「AI Search 가 국내를 내기 시작했다」는 신호다.
   */
  it("🔴 [현상 고정] AI Search 후보에 **한국 TLD 가 0** 이다", () => {
    const kr = aiSearchUrls().filter((u) => {
      try {
        return /\.kr$/i.test(new URL(u).hostname);
      } catch {
        return false;
      }
    });
    expect(kr, `국내 URL 이 들어왔다: ${kr.join(", ")}`).toEqual([]);
  });
});

describe("DMC-01 — ② 원본 vs 후보 → MI 판정(근거 포함)", () => {
  it.runIf(LIVE)(
    "🔴🔴 후보 4건의 **전 이력** 을 한 표로 낸다",
    async () => {
      const { shopifySiteStrategy } = await import(
        "@commerce/crawler/src/site-strategies/shopify.site-strategy"
      );
      const { classifyUrlShape } = await import("@commerce/crawler/src/comparison-search/url-shape");
      const { buildProductIdentityDna } = await import("@commerce/shared");
      const { buildCanonicalProduct } = await import("../../../pipeline/canonical-product");
      /**
       * 🔴 **pool 단계에는 판정 칸이 없다**(실측: 후보 키는 title·url·price·
       *    regularPrice·soldOut·imageUrl·confidence·brand·facts 뿐). 교차판매처
       *    판정은 runner 안의 `withConfidence`/`judgeDomesticCandidate` 가 한다
       *    ⟹ 🟢 그래서 **운영 runner** 를 태운다(1차에 pool 만 봐서 verdict 가 전건 비었다).
       */
      const { runDomesticPriceCheck } = await import("../run-domestic-price-check");
      const { collectUrlCandidatePool } = await import("../url-candidate-pool");

      const urls = aiSearchUrls();
      const extracted = await shopifySiteStrategy.extract(ORIGIN);
      const product = buildCanonicalProduct(ORIGIN, extracted!.productData as never, {} as never, []);
      const dna = buildProductIdentityDna(product);
      /* eslint-disable no-console */
      console.log(
        `[DMC01-origin] brand=${dna.brand.value} code=${dna.brandModelCode} color=${dna.color} title=${dna.title}`,
      );

      /** 🔴 운영 pool 그대로 — 모양 게이트 · fetch · facts · 점수 전부 운영 함수다. */
      const pool = await collectUrlCandidatePool({
        urls,
        originUrl: ORIGIN,
        maxUrls: 10,
        existingCanonicalUrls: new Set<string>(),
        shopId: "__web_search__",
        shopNamePrefix: "웹 검색 후보(일시)",
      });
      const dropReason = new Map(pool.metrics.dropped.map((d) => [d.url, d.reason]));

      /** 🔴 운영 runner — 같은 URL 집합을 `candidateUrls`(공급 생산자)로 넣는다. Search 0. */
      const run = (await runDomesticPriceCheck({
        snapshotId: "c88d2ca4-bfe1-4851-9c1d-92f69222a3f2",
        workspaceId: "b60b0ad7-d750-4f70-a1c3-a4d220f76756",
        dna,
        description: product.description.value || undefined,
        candidateUrls: urls,
        webSearch: false,
      } as never)) as unknown as Record<string, unknown>;
      const evidence = ((run.urlCandidateEvidence as Record<string, unknown>[] | null) ?? []);
      console.log(`[DMC01-evidence] ${evidence.length}건`);

      const trace: Record<string, unknown>[] = [];
      for (const u of urls) {
        const host = (() => {
          try {
            return new URL(u).hostname;
          } catch {
            return "?";
          }
        })();
        const row: Record<string, unknown> = {
          host,
          url: u,
          shape: classifyUrlShape(u),
          drop: dropReason.get(u) ?? null,
        };
        for (const r of pool.searchResults) {
          for (const c of r.candidates) {
            if (new URL(c.url).hostname !== host) continue;
            row.crawl = "OK";
            row.title = c.title ?? null;
            /** 🔴 `price` 는 **객체** 다(`{amount,currency}`) — 1차에 `[object Object]` 를 찍었다. */
            row.price = c.price?.amount ?? null;
            row.currency = c.price?.currency ?? null;
          }
        }
        /**
         * 🔴 §11 근거는 **evidence 행** 이 들고 있다(위 주석 참조).
         * 🔴 evidence 의 `domain` 은 `www.` 가 없을 수 있다 — 1차에 문자열 완전일치로
         *    맞추다 **2건을 놓쳤고** verdict 가 비어 나왔다. 접두를 벗겨 맞춘다.
         */
        const bare = (s: string) => s.replace(/^www\./i, "").toLowerCase();
        const e = evidence.find((x) => bare(String(x.domain)) === bare(host));
        if (e) {
          row.verdict = e.crossSellerVerdict ?? null;
          row.reasons = e.matchReasons ?? null;
          row.blockers = e.crossSellerBlockers ?? null;
          row.conflicts = e.crossSellerConflicts ?? null;
          row.market = e.market ?? null;
          row.tier = e.priceTier ?? null;
          row.priceStatus = e.priceStatus ?? null;
        }
        row.crawl = row.crawl ?? "FAIL";
        trace.push(row);
        console.log(
          `[DMC01-row] ${host.padEnd(24)} shape=${String(row.shape).padEnd(14)} crawl=${String(row.crawl).padEnd(4)}` +
            ` drop=${String(row.drop ?? "-").padEnd(18)} verdict=${String(row.verdict ?? "-").padEnd(14)}` +
            ` ${String(row.price ?? "-")} ${String(row.currency ?? "")}`,
        );
        if (row.reasons) console.log(`        근거: ${JSON.stringify(row.reasons)}`);
        if (row.blockers && (row.blockers as unknown[]).length) {
          console.log(`        🔴 보류사유: ${JSON.stringify(row.blockers)}`);
        }
        if (row.conflicts && Object.keys(row.conflicts as object).length) {
          console.log(`        🔴 충돌: ${JSON.stringify(row.conflicts)}`);
        }
      }
      console.log(
        `[DMC01-kpi] ${JSON.stringify({
          raw: urls.length,
          accepted: pool.metrics.acceptedUrls,
          usable: pool.metrics.usableProductUrls,
          miEligible: pool.metrics.miEligibleCandidates,
          crawlOk: trace.filter((t) => t.crawl === "OK").length,
        })}`,
      );
      writeFileSync(join(FIX, "dmc-01-trace.json"), JSON.stringify({ origin: ORIGIN, trace }, null, 2));
      expect(trace).toHaveLength(4);
    },
    1_800_000,
  );
});
