import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { enrichCandidatePrices, withConfidence } from "@commerce/crawler";
import { backfillCanonicalProduct, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { classifyCandidateMarket } from "../candidate-market";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-051 §1 — **외부 AI 가 찾아낸 「국내 동일상품 URL」 6건 전수 측정**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **AI 의 「동일상품 ✅」 판정과 AI 가 적은 가격은 입력으로 쓰지 않는다**(CPO §1).
 *    쓰는 것은 **URL 문자열 하나** 뿐이고, 그것도 **원본 그대로** 다 —
 *    `utm_source=chatgpt.com` 도, LFmall C 의 **깨진 `%%`** 도 고치지 않는다.
 *    🔴 CPO 명시: 「해당 URL 이 실패하면 **원본 URL 실패로 기록** 하고 별도 정정 URL 을
 *    만들어 측정하지 않는다.」
 *
 * 🔴 운영 경로를 그대로 쓴다(복제 금지) — WU-038 하니스와 **같은 함수·같은 순서**:
 * ```
 * collectUrlCandidatePool → withConfidence → enrichCandidatePrices
 *                         → classifyCandidateMarket → 국내 축 자격
 * ```
 * 🔴 `enrichCandidatePrices` 를 빼면 **보강 전 상태** 를 보고하게 된다(WU-038 의 함정).
 *
 * 실행: `WU_051_LIVE=1`  (기본 skip — 실제 HTTP 를 쓴다 · 읽기 전용 GET)
 * 선행: `node packages/database/scripts/wu-051-origins-dump.mjs`
 */

const LIVE = process.env.WU_051_LIVE === "1";
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const ORIGINS_FILE = path.join(OUT, "wu-051-origins.json");

/**
 * 🔴🔴 **CPO 가 전달한 6건. 한 글자도 바꾸지 않았다.**
 *    LFmall C 의 `%%EC%A6%88` 는 **원본의 오타** 이고 그대로 둔다(CPO 명시).
 */
const AI_URLS: { product: "A" | "B" | "C"; snapshotId: string; label: string; urls: string[] }[] = [
  {
    product: "A",
    snapshotId: "cd93efd9-6c34-42a3-b733-d1178e968113",
    label: "B226AC009 Hug Hairy Monster T-Shirt",
    urls: ["https://www.beaumonde.co.kr/goods/goods_list.php?cateCd=003&utm_source=chatgpt.com"],
  },
  {
    product: "B",
    snapshotId: "799971f2-be14-4b6b-843f-4a7fca2097f7",
    label: "B226AC042 Mystery BC half zipped sweatshirt",
    urls: [
      "https://www.coupleshot.com/shop/shopbrand.html?type=X&xcode=011&utm_source=chatgpt.com",
      "https://www.lfmall.co.kr/app/search/result/%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88%2B%EC%A7%91%EC%97%85?utm_source=chatgpt.com",
    ],
  },
  {
    product: "C",
    snapshotId: "c1b54b9a-f325-415e-b338-eeae08c3c814",
    label: "B226AC043 Mystery BC half zipped sweatshirt",
    urls: [
      "https://www.beaumonde.co.kr/goods/goods_list.php?cateCd=002&page=4&utm_source=chatgpt.com",
      "https://www.lfmall.co.kr/app/search/result/%EB%B3%B4%EB%B3%B4%EC%87%BC%%EC%A6%88%2B%EC%A7%91%EC%97%85?utm_source=chatgpt.com",
      "https://www.lotteon.com/csearch/search/search?mallId=1&platform=pc&q=%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%8826&render=search&utm_source=chatgpt.com",
    ],
  },
];

/** 🔴 분모는 CPO 가 고정했다 — 6. 코드가 세어 확인한다(내가 옮기다 빠뜨리지 않도록). */
const P0_1_DENOMINATOR = 6;

type Origin = { id: string; source_url: string; title: string; canonical_product: unknown };

const maybe = LIVE ? it : it.skip;

describe("WU-051 §1 — AI 발견 국내 URL 6건", () => {
  maybe(
    "P0-1~P0-4 를 전건 측정하고 A/B/C/D/E 로 가른다",
    async () => {
      expect(AI_URLS.reduce((n, c) => n + c.urls.length, 0)).toBe(P0_1_DENOMINATOR);
      expect(existsSync(ORIGINS_FILE), ORIGINS_FILE).toBe(true);
      const origins = JSON.parse(readFileSync(ORIGINS_FILE, "utf8")) as Origin[];

      const report: Record<string, unknown>[] = [];
      let p01 = 0;
      let p02 = 0;
      let p03 = 0;
      let p04 = 0;

      for (const c of AI_URLS) {
        const snap = origins.find((o) => o.id === c.snapshotId);
        expect(snap, `스냅샷 ${c.snapshotId}`).toBeTruthy();
        const dna = buildProductIdentityDna(backfillCanonicalProduct(snap!.canonical_product as never));
        const originFacts = productFactsFromIdentityDna(dna);

        /* ── P0-1. candidate pool 진입 ─────────────────────────────────── */
        const pool = await collectUrlCandidatePool({
          urls: c.urls,
          originUrl: dna.sourceUrl,
          maxUrls: c.urls.length,
          existingCanonicalUrls: new Set<string>(),
        });
        const candidates = pool.searchResults.flatMap((r) => r.candidates ?? []);
        p01 += candidates.length;

        /* ── P0-2. MI ─────────────────────────────────────────────────── */
        const query = {
          title: dna.title,
          brand: dna.brand.value || undefined,
          sourceUrl: dna.sourceUrl,
          facts: originFacts,
        };
        let scored = withConfidence(query, candidates as never);

        /* ── P0-3. 가격 검증 — 🔴 운영이 transient 에도 적용한다 ─────────── */
        for (const r of pool.searchResults) {
          try {
            const enriched = await enrichCandidatePrices(
              scored.filter((s) => (r.candidates ?? []).some((x) => x.url === s.url)),
              r.domain,
              query,
            );
            scored = scored.map((s) => enriched.find((e) => e.url === s.url) ?? s);
          } catch {
            /* fail-soft — 운영과 같다 */
          }
        }

        const rows = scored.map((s) => {
          const host = (() => {
            try {
              return new URL(s.url).hostname.replace(/^(www|m|global)\./, "");
            } catch {
              return "?";
            }
          })();
          const priceStatus = (s as { priceStatus?: string }).priceStatus ?? null;
          const currency = s.price?.currency ?? null;
          /** 🔴 등록부 조회를 하지 않는다 — 이 6건은 **전부 등록부 밖** 이 전제다(CPO §2). */
          const mkt = classifyCandidateMarket({ domain: host, currency, isRegisteredDomesticShop: false });
          /** 🔴 운영 술어를 그대로 적는다(run-domestic-price-check.ts:1294). */
          const priceKrw = priceStatus === "VERIFIED_CURRENT" && currency === "KRW" ? s.price!.amount : null;
          return {
            host,
            verdict: (s.crossSellerVerdict as string | null) ?? null,
            price: s.price ? `${currency} ${s.price.amount}` : null,
            priceStatus,
            market: mkt.market,
            basis: mkt.basis,
            priceKrw,
            /** 🔴 국내 축 자격 = market KR **그리고** priceKrw (market-intelligence.ts:216·236). */
            domesticAxis: mkt.market === "KR" && priceKrw != null,
          };
        });

        p02 += rows.filter((r) => r.verdict === "SAME").length;
        p03 += rows.filter((r) => r.verdict === "SAME" && r.priceKrw != null).length;
        p04 += rows.filter((r) => r.verdict === "SAME" && r.domesticAxis).length;

        /**
         * 🔴 A/B/C/D/E — **첫 탈락 지점 하나만** 찍는다. 뒤 단계는 도달하지 못했으므로
         *    「실패」로 세면 같은 URL 을 두 번 세게 된다.
         */
        const perUrl = c.urls.map((url) => {
          const drop = pool.metrics.dropped.find((d) => d.url === url);
          if (drop) return { url, stage: "A DISCOVERY MISS", detail: drop.reason };
          const row = rows.find((r) => {
            try {
              return new URL(url).hostname.replace(/^(www|m|global)\./, "") === r.host;
            } catch {
              return false;
            }
          });
          if (!row) return { url, stage: "A DISCOVERY MISS", detail: "NOT_IN_POOL" };
          if (row.verdict !== "SAME") return { url, stage: "C MI MISS", detail: row.verdict ?? "null" };
          if (row.priceKrw == null)
            return { url, stage: "D PRICE GATE MISS", detail: `${row.priceStatus}/${row.price ?? "가격없음"}` };
          if (!row.domesticAxis) return { url, stage: "E UI MISS", detail: row.basis };
          return { url, stage: "🟢 국내 가격비교 도달", detail: row.basis };
        });

        report.push({ product: c.product, label: c.label, metrics: pool.metrics, rows, perUrl });

        // eslint-disable-next-line no-console
        console.log(`\n[WU-051 ${c.product}] ${c.label}`);
        // eslint-disable-next-line no-console
        console.log(
          `  pool: 공급 ${pool.metrics.suppliedUrls} · 통과 ${pool.metrics.acceptedUrls} · 열람 ${pool.metrics.usableProductUrls} · MI후보 ${pool.metrics.miEligibleCandidates} · HTTP ${pool.metrics.fetchCalls}`,
        );
        for (const d of pool.metrics.dropped) {
          // eslint-disable-next-line no-console
          console.log(`   ✗ ${d.reason.padEnd(22)} ${d.url.slice(0, 95)}`);
        }
        for (const r of rows) {
          // eslint-disable-next-line no-console
          console.log(
            `   ${r.host.padEnd(18)} ${String(r.verdict).padEnd(14)} price=${r.price ?? "없음"}(${r.priceStatus ?? "-"}) market=${r.market}/${r.basis} 국내축=${r.domesticAxis}`,
          );
        }
        for (const u of perUrl) {
          // eslint-disable-next-line no-console
          console.log(`   → ${u.stage.padEnd(24)} ${u.detail}`);
        }
      }

      const kpi = {
        "P0-1 pool 진입": `${p01}/${P0_1_DENOMINATOR}`,
        "P0-2 MI SAME": `${p02}/${p01}`,
        "P0-3 검증 KRW": `${p03}/${p02}`,
        "P0-4 국내 가격비교": `${p04}/${p03}`,
      };
      // eslint-disable-next-line no-console
      console.log("\n[WU-051 KPI] " + JSON.stringify(kpi));
      writeFileSync(path.join(OUT, "wu-051-ai-urls.json"), JSON.stringify({ kpi, report }, null, 2));

      /**
       * 🔴 **단언은 「분모가 제대로 세어졌는가」까지만** 둔다. P0-1~P0-4 의 값 자체를
       *    기대값으로 박으면, 측정이 아니라 **내 예상을 고정** 하는 테스트가 된다.
       */
      expect(report).toHaveLength(3);
      expect(report.reduce((n, r) => n + (r.perUrl as unknown[]).length, 0)).toBe(P0_1_DENOMINATOR);
    },
    20 * 60_000,
  );
});
