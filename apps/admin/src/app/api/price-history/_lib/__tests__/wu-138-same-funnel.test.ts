import { describe, expect, it } from "vitest";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
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
 * WU-138 — **사람이 SAME 이라 한 URL 이 «어느 칸» 에서 사라지는가** (URL 단위)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 지시: 「`국내 0곳` 이라는 최종 숫자부터 보지 않는다. **실제 SAME URL 을
 *    넣고 끝까지 따라간다.** 어느 단계에서 사라지는지 **URL 단위로** 보여야 한다.」
 *
 * 🔴 그래서 이 파일은 **집계를 내지 않는다** — 행마다 통과/탈락과 **사유** 를 찍는다.
 * 🔴 판정을 바꾸지 않는다 · threshold 0 · 8축 0 · Registry 0 · 새 축 0.
 * 🔴 게이트 `WU_138_PROBE=1` 없으면 SKIP(회귀에서 외부 HTTP 금지).
 * 🔴 **열화 감지** — 풀 가용률이 반 미만이면 funnel 을 내지 않고 FAIL 한다
 *    (WU-133 의 「열화된 실행은 0 이 아니다」 게이트와 같은 축).
 */
const LIVE = process.env.WU_138_PROBE === "1";
const ORIGIN = "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt";
const CODE = "B226AC009";

const FIX = path.join(__dirname, "fixtures");
const OUTDIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const loose = (u: string) => String(u).trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");
const fx = <T>(f: string): T => JSON.parse(readFileSync(path.join(FIX, f), "utf8")) as T;
/** 🔴 한국 도메인 추정은 **표 라벨 용도만** 이다 — 운영 시장 판정은 아래 `market` 칸이다. */
const looksKr = (u: string) => {
  try {
    return new URL(u).hostname.endsWith(".kr");
  } catch {
    return false;
  }
};

interface Stage {
  url: string;
  domain: string;
  humanVerdict: string;
  krGuess: boolean;
  /** ② 후보로 들어왔는가(URL 풀 산출) */
  candidate: boolean;
  /** ③ 샵 판정이 돌았는가 — DROPPED 면 그 게이트 사유 */
  judged: boolean;
  dropGate: string | null;
  /** ④ 그 샵의 «대표» 로 뽑혔는가(샵당 1건 구조) */
  isBest: boolean;
  /** ⑤ 운영 판정 */
  matchTruth: string | null;
  displayTier: string | null;
  crossSellerVerdict: string | null;
  blockers: string[];
  /** ⑥ 운영 시장 판정 */
  market: string | null;
  /** ⑦ 판매여부 3상태 */
  sale: string | null;
  /** ⑧ 가격 */
  priceText: string | null;
  priceConfirmed: boolean;
  /** ⑨ 최종 시장 판매 판단에 섰는가 */
  inComparison: boolean;
  /** 🔴 사라진 «첫» 칸 */
  lostAt: string | null;
}

describe("WU-138 — human SAME URL 전수 funnel", () => {
  it.runIf(LIVE)("URL 단위로 어느 칸에서 사라지는지 적는다", async () => {
    /* ── ① 원상품을 운영 경로로 다시 추출(WU-137 수정이 여기서 발화한다) ── */
    const r = await shopifySiteStrategy.extract(ORIGIN);
    const product = buildCanonicalProduct(
      ORIGIN,
      r!.productData as ExtractedProductData,
      {} as Record<string, ProductDataSource>,
      [],
    );
    const dna = buildProductIdentityDna(product);
    /* eslint-disable no-console */
    console.log(`\n① 원상품 brand=${JSON.stringify(dna.brand)} code=${dna.brandModelCode}`);
    expect(dna.brand.value).toBe("Bobo Choses");

    /* ── ② human 라벨 전수(SAME «그리고» DIFFERENT — Negative 를 같이 본다) ── */
    const seen = new Set<string>();
    const gt: { url: string; verdict: string }[] = [];
    const add = (u?: string, v?: string) => {
      if (!u || !v || seen.has(loose(u))) return;
      seen.add(loose(u));
      gt.push({ url: u, verdict: v });
    };
    for (const c of fx<{ candidates: { originCode: string; url: string; verdict: string }[] }>(
      "wu-112-human-gt.json",
    ).candidates)
      if (c.originCode === CODE) add(c.url, c.verdict);
    for (const c of fx<{ candidates: { originCode: string; url: string; humanVerdict: string }[] }>(
      "wu-111-human-gt.json",
    ).candidates)
      if (c.originCode === CODE) add(c.url, c.humanVerdict);
    for (const c of fx<{ candidates: { origin: string; url: string; human: string }[] }>(
      "wu-125-human-gt.json",
    ).candidates)
      if (c.origin === CODE) add(c.url, c.human);
    const human = new Map(gt.map((g) => [loose(g.url), g.verdict]));
    const sameUrls = gt.filter((g) => g.verdict === "SAME");
    console.log(
      `② GT ${gt.length}건 — SAME ${sameUrls.length} · DIFFERENT ${gt.filter((g) => g.verdict === "DIFFERENT").length}` +
        ` · 🇰🇷(도메인 추정) ${gt.filter((g) => looksKr(g.url)).length}`,
    );

    /* ── ③ 운영 순서 그대로 ── */
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
      urls: gt.map((g) => g.url),
      originUrl: dna.sourceUrl,
      maxUrls: gt.length,
      existingCanonicalUrls: new Set<string>(),
      shopId: REVIEWED_SAME_SHOP_ID,
      shopNamePrefix: REVIEWED_SAME_SHOP_NAME,
    });
    console.log(`③ pool — usable ${pool.metrics.usableProductUrls}/${gt.length}`);
    /** 🔴 열화된 실행으로 funnel 을 내지 않는다(「측정불가」≠「0」). */
    expect(pool.metrics.usableProductUrls, "열화된 실행 — 재실행 필요").toBeGreaterThan(gt.length / 2);

    /** 🟢 풀에 실제로 들어온 URL 집합(② 칸의 근거). */
    const inPool = new Set<string>();
    for (const res of pool.searchResults) for (const c of res.candidates ?? []) inPool.add(loose(c.url));

    const rows: GeminiTransientRow[] = [];
    /** url → 그 URL 이 어느 칸까지 갔는가. 🔴 샵 대표가 아니면 거기서 끊긴다. */
    const judgedByUrl = new Map<string, { best: boolean; j: Awaited<ReturnType<typeof judgeDomesticCandidate>> }>();

    for (const res of pool.searchResults) {
      if (res.status !== "ok" || res.candidates.length === 0) continue;
      const notSelf = res.candidates.filter((c) => !isSelfReferenceCandidate(query.sourceUrl, c.url));
      const scored = withConfidence(query, notSelf);
      let priced = scored;
      try {
        priced = await enrichCandidatePrices(scored, res.domain, query);
      } catch {
        /* 운영과 같다 */
      }
      const j = await judgeDomesticCandidate({
        domain: res.domain,
        candidates: priced,
        sourceUrl: query.sourceUrl,
        foreignModelCode: dna.brandModelCode,
        foreignColor: dna.color,
        fetchModelCode: (u) => fetchDomesticModelCode(res.domain, u),
      });
      for (const c of priced) {
        judgedByUrl.set(loose(c.url), {
          best: j.kind === "JUDGED" && loose(j.best.url) === loose(c.url),
          j,
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
        crossSellerConflicts: (j.best.crossSellerConflicts ?? []).map((c) =>
          typeof c === "string" ? c : c.conflict,
        ),
        priceAmount: j.best.price?.amount ?? null,
        priceCurrency: j.best.price?.currency ?? null,
        priceStatus: j.best.priceStatus ?? null,
        market: m.market,
        basis: m.basis,
      } as GeminiTransientRow);
    }

    /* ── ④ 최종 시장 판매 판단 ── */
    const judgement = buildMarketJudgement(rows);
    const inComparison = new Set(judgement.sellers.map((s) => loose(s.row.discoveredUrl)));

    /* ── ⑤ URL 단위 표 ── */
    const stages: Stage[] = gt.map((g) => {
      const key = loose(g.url);
      const jr = judgedByUrl.get(key);
      const row = rows.find((x) => loose(x.discoveredUrl) === key);
      const tier = row?.matchTruth ? domesticMatchDisplay(row.matchTruth as never).tier : null;
      const s: Stage = {
        url: g.url,
        domain: (() => {
          try {
            return new URL(g.url).hostname;
          } catch {
            return "?";
          }
        })(),
        humanVerdict: g.verdict,
        krGuess: looksKr(g.url),
        candidate: inPool.has(key),
        judged: jr?.j.kind === "JUDGED",
        dropGate: jr && jr.j.kind !== "JUDGED" ? ((jr.j as { reason?: string }).reason ?? jr.j.kind) : null,
        isBest: jr?.best ?? false,
        matchTruth: row?.matchTruth ?? null,
        displayTier: tier,
        crossSellerVerdict: row?.crossSellerVerdict ?? null,
        blockers: [...(row?.crossSellerBlockers ?? []), ...(row?.crossSellerConflicts ?? [])],
        market: row?.market ?? null,
        sale: row ? saleState(row) : null,
        priceText: row?.priceAmount != null ? `${row.priceCurrency} ${row.priceAmount}` : null,
        priceConfirmed: row ? isPriceConfirmed(row) : false,
        inComparison: inComparison.has(key),
        lostAt: null,
      };
      /**
       * 🔴🔴 **같은 판매처가 «다른 URL» 로 통과한 것을 「사라졌다」로 적지 않는다.**
       *    1차 출력이 그 셋(scoutandcokids · junioredition · tinyapple)을
       *    「② 후보 생성 X」로 찍었는데, 그 판매처는 **최종 비교에 서 있다** —
       *    같은 상품의 다른 URL 이 이미 풀에 있어 중복으로 접힌 것이다.
       * 🔴 그대로 보고했으면 **「발견 실패 3건」이라는 거짓 원인** 이었다.
       */
      const sameDomainInComparison = judgement.sellers.some((x) => {
        try {
          return new URL(x.row.discoveredUrl).hostname === s.domain;
        } catch {
          return false;
        }
      });
      /** 🔴 **사라진 첫 칸** 을 적는다 — 그것이 CPO 가 물은 「어디서 사라지는가」다. */
      s.lostAt = !s.candidate
        ? sameDomainInComparison
          ? "🟡 중복 URL(같은 판매처가 다른 URL 로 통과)"
          : "② 후보 생성"
        : !s.judged
          ? "③ 샵 판정(게이트)"
          : !s.isBest
            ? "④ 샵 대표 선정"
            : s.displayTier !== "SAME"
              ? `⑤ MI 판정(${s.blockers.join("·") || s.displayTier})`
              : !s.inComparison
                ? "⑨ 최종 비교"
                : null;
      return s;
    });

    const fmt = (b: boolean) => (b ? "O" : "X");
    console.log("\n④ URL 단위 funnel — 🔴 사람이 SAME 이라 한 것부터");
    console.log(
      "   도메인                     human  🇰🇷  후보 판정 대표 tier            시장      판매     가격        최종  사라진 칸",
    );
    for (const s of [...stages].sort((a, b) => a.humanVerdict.localeCompare(b.humanVerdict) || a.domain.localeCompare(b.domain))) {
      console.log(
        `   ${s.domain.padEnd(26)} ${s.humanVerdict.padEnd(6)} ${s.krGuess ? "🇰🇷" : "🌎"} ` +
          `${fmt(s.candidate).padEnd(4)} ${fmt(s.judged).padEnd(4)} ${fmt(s.isBest).padEnd(4)} ` +
          `${(s.displayTier ?? "-").padEnd(16)} ${(s.market ?? "-").padEnd(9)} ${(s.sale ?? "-").padEnd(8)} ` +
          `${(s.priceText ?? "-").padEnd(11)} ${fmt(s.inComparison).padEnd(5)} ${s.lostAt ?? "🟢 통과"}`,
      );
      if (s.blockers.length > 0) console.log(`      └ 보류/충돌 — ${s.blockers.join(" · ")}`);
    }

    /* ── ⑥ 국내/해외를 가른 요약 ── */
    const kr = stages.filter((s) => s.krGuess);
    const os = stages.filter((s) => !s.krGuess);
    const sum = (xs: Stage[]) => ({
      n: xs.length,
      same: xs.filter((x) => x.humanVerdict === "SAME").length,
      cand: xs.filter((x) => x.candidate).length,
      judged: xs.filter((x) => x.judged).length,
      best: xs.filter((x) => x.isBest).length,
      tierSame: xs.filter((x) => x.displayTier === "SAME").length,
      priced: xs.filter((x) => x.priceConfirmed).length,
      final: xs.filter((x) => x.inComparison).length,
    });
    console.log(`\n⑤ 🇰🇷 국내(도메인 추정) ${JSON.stringify(sum(kr))}`);
    console.log(`⑤ 🌎 해외            ${JSON.stringify(sum(os))}`);
    console.log(
      `\n⑥ 📊 시장 판매 판단 — verdict ${judgement.verdict} · 판매중 ${judgement.onSaleCount}` +
        ` · 확인불가 ${judgement.unknownCount} · 품절 ${judgement.soldOutCount}` +
        ` · 🇰🇷 ${judgement.domesticOnSale} · 🌎 ${judgement.overseasOnSale}`,
    );
    for (const c of judgement.byCurrency)
      console.log(`   💰 ${c.currency} ${c.lowest}~${c.highest} (${c.n}곳 · 판매중 ${c.onSale})`);

    /** 🔴 사라진 칸을 **빈도순** 으로 — 그것이 다음 수정 지점의 근거다. */
    const lost = new Map<string, number>();
    for (const s of stages.filter((x) => x.humanVerdict === "SAME" && x.lostAt))
      lost.set(s.lostAt as string, (lost.get(s.lostAt as string) ?? 0) + 1);
    console.log("\n⑦ human SAME 이 사라진 칸 (빈도순)");
    for (const [k, v] of [...lost.entries()].sort((a, b) => b[1] - a[1])) console.log(`   ${k}: ${v}건`);

    mkdirSync(OUTDIR, { recursive: true });
    writeFileSync(path.join(OUTDIR, "wu-138-funnel.json"), JSON.stringify({ stages, judgement }, null, 2), "utf8");

    /** 🔴 Negative — 사람이 DIFFERENT 라 한 URL 이 최종 비교에 **서지 않는다**. */
    for (const s of stages.filter((x) => x.humanVerdict === "DIFFERENT")) {
      expect(s.inComparison, `DIFFERENT 가 비교에 섰다: ${s.domain}`).toBe(false);
    }
    /** 🟢 표가 실제로 채워졌는지(측정 자체가 성립했는지) */
    expect(stages.filter((s) => s.candidate).length).toBeGreaterThan(gt.length / 2);
  }, 1_800_000);
});
