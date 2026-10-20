import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import {
  enrichCandidatePrices,
  fetchDomesticModelCode,
  isSelfReferenceCandidate,
  withConfidence,
} from "@commerce/crawler";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { buildCrossSellerSearchQueries, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { judgeDomesticCandidate } from "../run-domestic-price-check";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";
import { REVIEWED_SAME_SHOP_ID, REVIEWED_SAME_SHOP_NAME } from "../transient-candidates";
import { classifyCandidateMarket } from "../candidate-market";
import { buildMarketJudgement, saleState, isPriceConfirmed } from "../../../../pipeline/commerce/mi-same-candidates";
import { domesticMatchDisplay } from "../../../../pipeline/commerce/match-display";
import type { GeminiTransientRow } from "../../../../pipeline/commerce/GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-138 후속 — **국내 GT 5건 전수 funnel** (CPO 승인 분모)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 확정 분모 — B226AC009 (SAME 1 · DIFF 1) + B226AC010 (SAME 1 · DIFF 2).
 *    `UNCERTAIN` 2건은 **분모에서 제외** 하고 관측으로만 적는다.
 * 🔴 **과거 CEO 라벨을 「현재 시스템 GT」로 재해석하지 않는다** — 그 라벨은 그 시점의
 *    human judgment 이고, 여기서는 **현재 시스템이 그 URL 을 어떻게 처리하는지** 를
 *    재측정하는 **비교 기준** 으로만 쓴다(CPO 전제).
 *
 * 🔴🔴 **CPO §③ — 결과를 «두 축» 으로 가른다**:
 * ```
 * A 동일상품 판정 문제   SAME → MI 에서 탈락 / DIFFERENT → SAME 누출
 * B 가격·판매정보 문제   SAME → 대표 → KR 까지 갔는데 **가격이 없다**
 * 🔴 둘을 섞으면 「MI 를 고쳤는데 화면이 안 바뀐다」가 된다.
 *    특히 `beaumonde.co.kr` 은 WU-061/079 가 **가격 추출 실패 사이트** 로 측정했다.
 * ```
 * 🔴 운영 코드 변경 0 · threshold 0 · 8축 0 · 새 축 0.
 * 🔴 게이트 `WU_138_PROBE=1` 없으면 SKIP.
 */
const LIVE = process.env.WU_138_PROBE === "1";
const OUTDIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const loose = (u: string) => String(u).trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");
const hostOf = (u: string) => {
  try {
    return new URL(u).hostname;
  } catch {
    return "?";
  }
};

/**
 * 🔴 **URL 을 지어내지 않았다** — 원상품은 저장된 기록에서 확인한 값이고(두 로케일
 *    모두 관측됨 · `ko-kr` 을 쓴다 — WU-134/136 E2E 와 같은 입력), 후보 URL 은
 *    `wu-112/116` fixture 의 라벨 URL 그대로다.
 */
const CASES = [
  {
    code: "B226AC009",
    origin: "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt",
    gt: [
      {
        url: "https://biskuit.kr/product/%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88-%ED%97%88%EA%B7%B8-%ED%97%A4%EC%96%B4%EB%A6%AC-%EB%AA%AC%EC%8A%A4%ED%84%B0-%ED%8B%B0%EC%85%94%EC%B8%A0-b226ac009/8891/category/367/display/1/",
        human: "SAME",
      },
      { url: "https://m.luxboy.com/product/detail.html?product_no=103477", human: "DIFFERENT" },
    ],
  },
  {
    code: "B226AC010",
    origin: "https://bobochoses.com/ko-kr/products/b226ac010-booty-ghosts-t-shirt",
    gt: [
      { url: "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014021", human: "SAME" },
      { url: "https://luksusbaby.kr/collections/bobo-choses", human: "DIFFERENT" },
      {
        url: "https://kream.co.kr/products/285755",
        human: "DIFFERENT",
      },
    ],
  },
] as const;

interface Row {
  code: string;
  url: string;
  host: string;
  human: string;
  candidate: boolean;
  judged: boolean;
  dropGate: string | null;
  isBest: boolean;
  displayTier: string | null;
  blockers: string[];
  market: string | null;
  sale: string | null;
  priceText: string | null;
  priceConfirmed: boolean;
  inComparison: boolean;
  /** 🔴 CPO §③ — A(판정) / B(가격·판매) / C(discovery) 로 가른다. */
  axis: string;
}

describe("WU-138 후속 — 국내 GT 5건 전수 funnel", () => {
  it.runIf(LIVE)("국내 SAME/DIFFERENT 가 어느 칸에서 갈리는지 적는다", async () => {
    const all: Row[] = [];
    /* eslint-disable no-console */

    for (const c of CASES) {
      /* ── ① 원상품을 운영 경로로 직접 추출 (추가 HTTP = 원상품 1건) ── */
      const ex = await shopifySiteStrategy.extract(c.origin);
      expect(ex, `원상품 추출 실패: ${c.code}`).not.toBeNull();
      const product = buildCanonicalProduct(
        c.origin,
        ex!.productData as ExtractedProductData,
        {} as Record<string, ProductDataSource>,
        [],
      );
      const dna = buildProductIdentityDna(product);
      console.log(
        `\n━━ ${c.code} 원상품 — brand=${JSON.stringify(dna.brand.value)} code=${dna.brandModelCode}` +
          ` color=${JSON.stringify(dna.color ?? null)}`,
      );

      const terms = buildCrossSellerSearchQueries(dna).filter(Boolean);
      const query = {
        title: dna.title,
        brand: dna.brand.value || undefined,
        sourceUrl: dna.sourceUrl,
        sku: dna.identifier?.tier === "SKU" ? dna.identifier.value : undefined,
        searchTerm: terms[0] ?? dna.title,
        searchTerms: terms,
        facts: productFactsFromIdentityDna(dna),
      };

      const pool = await collectUrlCandidatePool({
        urls: c.gt.map((g) => g.url),
        originUrl: dna.sourceUrl,
        maxUrls: c.gt.length,
        existingCanonicalUrls: new Set<string>(),
        shopId: REVIEWED_SAME_SHOP_ID,
        shopNamePrefix: REVIEWED_SAME_SHOP_NAME,
      });
      console.log(`   pool usable ${pool.metrics.usableProductUrls}/${c.gt.length}`);

      const inPool = new Set<string>();
      for (const res of pool.searchResults) for (const x of res.candidates ?? []) inPool.add(loose(x.url));

      const rows: GeminiTransientRow[] = [];
      const judgedByUrl = new Map<string, { best: boolean; kind: string; reason: string | null }>();

      for (const res of pool.searchResults) {
        if (res.status !== "ok" || res.candidates.length === 0) continue;
        const notSelf = res.candidates.filter((x) => !isSelfReferenceCandidate(query.sourceUrl, x.url));
        const scored = withConfidence(query, notSelf);
        let pricedCands = scored;
        try {
          pricedCands = await enrichCandidatePrices(scored, res.domain, query);
        } catch {
          /* 운영과 같다 */
        }
        const j = await judgeDomesticCandidate({
          domain: res.domain,
          candidates: pricedCands,
          sourceUrl: query.sourceUrl,
          foreignModelCode: dna.brandModelCode,
          foreignColor: dna.color,
          fetchModelCode: (u) => fetchDomesticModelCode(res.domain, u),
        });
        for (const x of pricedCands) {
          judgedByUrl.set(loose(x.url), {
            best: j.kind === "JUDGED" && loose(j.best.url) === loose(x.url),
            kind: j.kind,
            reason: j.kind !== "JUDGED" ? ((j as { reason?: string }).reason ?? null) : null,
          });
        }
        if (j.kind !== "JUDGED") continue;
        const m = classifyCandidateMarket({
          domain: res.domain,
          currency: j.best.price?.currency ?? null,
          isRegisteredDomesticShop: false,
        });
        rows.push({
          source: "REVIEWED_SAME",
          domain: res.domain,
          title: j.best.title,
          imageUrl: j.best.imageUrl ?? null,
          soldOut: j.best.soldOut ?? null,
          discoveredUrl: j.best.url,
          matchTruth: j.matchTruth,
          priceTier: priceTierFromLink({ matchTruth: j.matchTruth, verified: j.verified }),
          crossSellerVerdict: j.best.crossSellerVerdict ?? null,
          confidence: j.best.confidence ?? null,
          matchReasons: j.best.matchReasons ?? [],
          crossSellerBlockers: (j.best.crossSellerBlockers ?? []).map((b) =>
            typeof b === "string" ? b : b.blocker,
          ),
          crossSellerConflicts: (j.best.crossSellerConflicts ?? []).map((x) =>
            typeof x === "string" ? x : x.conflict,
          ),
          priceAmount: j.best.price?.amount ?? null,
          priceCurrency: j.best.price?.currency ?? null,
          priceStatus: j.best.priceStatus ?? null,
          market: m.market,
          basis: m.basis,
        } as GeminiTransientRow);
      }

      const judgement = buildMarketJudgement(rows);
      const inComparison = new Set(judgement.sellers.map((s) => loose(s.row.discoveredUrl)));

      for (const g of c.gt) {
        const key = loose(g.url);
        const jr = judgedByUrl.get(key);
        const row = rows.find((x) => loose(x.discoveredUrl) === key);
        const tier = row?.matchTruth ? domesticMatchDisplay(row.matchTruth as never).tier : null;
        const r: Row = {
          code: c.code,
          url: g.url,
          host: hostOf(g.url),
          human: g.human,
          candidate: inPool.has(key),
          judged: jr?.kind === "JUDGED",
          dropGate: jr?.reason ?? (jr && jr.kind !== "JUDGED" ? jr.kind : null),
          isBest: jr?.best ?? false,
          displayTier: tier,
          blockers: [...(row?.crossSellerBlockers ?? []), ...(row?.crossSellerConflicts ?? [])],
          market: row?.market ?? null,
          sale: row ? saleState(row) : null,
          priceText: row?.priceAmount != null ? `${row.priceCurrency} ${row.priceAmount}` : null,
          priceConfirmed: row ? isPriceConfirmed(row) : false,
          inComparison: inComparison.has(key),
          axis: "",
        };
        /**
         * 🔴🔴 CPO §③ — **두 축으로 가른다.** 섞으면 처방이 틀린다.
         */
        r.axis = !r.candidate
          ? "C 🔎 Discovery(후보 자체가 없다)"
          : !r.judged
            ? "A ⑧ 샵 게이트"
            : !r.isBest
              ? "A ④ 샵 대표 선정"
              : r.human === "SAME" && r.displayTier !== "SAME"
                ? "A 🧠 MI 판정(SAME 을 못 올린다)"
                : r.human === "DIFFERENT" && r.displayTier === "SAME"
                  ? "🔴 A MI false positive"
                  : r.human === "SAME" && r.displayTier === "SAME" && !r.priceConfirmed
                    ? "B 💰 가격 수집(판정은 맞다)"
                    : r.human === "SAME" && r.inComparison
                      ? "🟢 통과"
                      : "🟢 정확히 차단(DIFFERENT)";
        all.push(r);
      }

      console.log(
        `   📊 ${c.code} — verdict ${judgement.verdict} · 판매중 ${judgement.onSaleCount}` +
          ` · 확인불가 ${judgement.unknownCount} · 🇰🇷 ${judgement.domesticOnSale} · 🌎 ${judgement.overseasOnSale}`,
      );
      for (const cur of judgement.byCurrency)
        console.log(`      💰 ${cur.currency} ${cur.lowest}~${cur.highest} (${cur.n}곳 · 판매중 ${cur.onSale})`);
    }

    /* ── ② 표 ── */
    const f = (b: boolean) => (b ? "O" : "X");
    console.log("\n════ 국내 GT 5건 전수 funnel ════");
    console.log(
      "   원상품      호스트                human     후보 판정 대표 tier            시장      판매     가격        최종  축",
    );
    for (const r of all) {
      console.log(
        `   ${r.code.padEnd(11)} ${r.host.padEnd(21)} ${r.human.padEnd(9)} ` +
          `${f(r.candidate).padEnd(4)} ${f(r.judged).padEnd(4)} ${f(r.isBest).padEnd(4)} ` +
          `${(r.displayTier ?? "-").padEnd(16)} ${(r.market ?? "-").padEnd(9)} ${(r.sale ?? "-").padEnd(8)} ` +
          `${(r.priceText ?? "-").padEnd(11)} ${f(r.inComparison).padEnd(5)} ${r.axis}`,
      );
      if (r.blockers.length > 0) console.log(`      └ 보류/충돌 — ${r.blockers.join(" · ")}`);
      if (r.dropGate) console.log(`      └ 게이트 — ${r.dropGate}`);
    }

    /* ── ③ 두 축으로 집계 ── */
    const byAxis = new Map<string, number>();
    for (const r of all) byAxis.set(r.axis, (byAxis.get(r.axis) ?? 0) + 1);
    console.log("\n════ CPO §③ 축별 집계 ════");
    for (const [k, v] of [...byAxis.entries()].sort((a, b) => b[1] - a[1])) console.log(`   ${k}: ${v}건`);

    const sameRows = all.filter((r) => r.human === "SAME");
    const diffRows = all.filter((r) => r.human === "DIFFERENT");
    console.log(
      `\n🇰🇷 국내 SAME ${sameRows.length}건 — 최종 비교 도달 ${sameRows.filter((r) => r.inComparison).length}`,
    );
    console.log(
      `🇰🇷 국내 DIFFERENT ${diffRows.length}건 — 🔴 누출 ${diffRows.filter((r) => r.inComparison).length}`,
    );

    mkdirSync(OUTDIR, { recursive: true });
    writeFileSync(path.join(OUTDIR, "wu-138-domestic-funnel.json"), JSON.stringify(all, null, 2), "utf8");

    /** 🔴 Negative — human DIFFERENT 가 최종 비교에 서면 **지금 상태가 이미 틀렸다**. */
    for (const r of diffRows) expect(r.inComparison, `DIFFERENT 누출: ${r.host}`).toBe(false);
    /** 🟢 측정이 성립했는지 — 전건 후보 실패면 열화된 실행이다(「측정불가」≠「0」). */
    expect(all.filter((r) => r.candidate).length, "열화된 실행 — 재실행 필요").toBeGreaterThan(0);
  }, 1_800_000);
});
