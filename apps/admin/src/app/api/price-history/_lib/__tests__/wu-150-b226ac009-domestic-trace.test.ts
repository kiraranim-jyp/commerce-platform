import { describe, expect, it } from "vitest";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import {
  enrichCandidatePrices,
  fetchDomesticModelCode,
  isSelfReferenceCandidate,
  withConfidence,
} from "@commerce/crawler";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { factsFromProductUrl } from "@commerce/crawler";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import { buildCrossSellerSearchQueries, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { judgeDomesticCandidate } from "../run-domestic-price-check";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";
import { REVIEWED_SAME_SHOP_ID, REVIEWED_SAME_SHOP_NAME } from "../transient-candidates";
import { classifyCandidateMarket } from "../candidate-market";
import { buildMarketJudgement, buildPriceGuide, saleState, isPriceConfirmed } from "../../../../pipeline/commerce/mi-same-candidates";
import { domesticMatchDisplay } from "../../../../pipeline/commerce/match-display";
import type { GeminiTransientRow } from "../../../../pipeline/commerce/GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-150 STEP 1 — **B226AC009 국내 실제 판매처 URL 전수 추적**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO/CEO 확정(2026-10-22) — 「국내 공급 자체가 없다」는 가설은 **폐기** 한다.
 * B226AC009 는 국내 여러 곳에서 **실제로 판매 중** 이고, 그 URL 이 주어졌다.
 * ⟹ 🔴 물어야 할 것은 하나다: **「그 URL 이 우리 파이프라인의 어느 칸에서 죽는가」.**
 *
 * ── 🔴 추측 금지 ───────────────────────────────────────────────────────────────
 * 단계마다 **운영 함수를 그대로** 부른다(복제식 아님):
 * ```
 * ① classifyUrlShape      URL 모양        (collectUrlCandidatePool 의 입구 게이트)
 * ② collectUrlCandidatePool  후보 풀      (accepted / usable / dropped 사유)
 * ③ factsFromProductUrl   상품 사실        (status · brand · code · price)
 * ④ withConfidence        점수/매칭 이유
 * ⑤ enrichCandidatePrices 가격 보강
 * ⑥ judgeDomesticCandidate 샵 판정(⑧ 게이트 + 샵 대표)
 * ⑦ classifyCandidateMarket 시장 확정
 * ⑧ buildMarketJudgement  최종 비교 진입
 * ```
 * 🔴 운영 코드 변경 **0** · threshold **0** · 8축 **0** · 새 축 **0**.
 * 🔴 게이트 `WU_150_PROBE=1` 없으면 SKIP(네트워크를 쓰는 측정이다).
 *
 * ── 🔴 URL 을 지어내지 않았다 ─────────────────────────────────────────────────
 * 아래 7 개는 **지시서에 글자로 적힌 URL 그대로** 다.
 * 🔴 11번가 · POSTY 는 **URL 이 제공되지 않았다** ⟹ **측정불가** 로 적는다(0 이 아니다).
 */
const LIVE = process.env.WU_150_PROBE === "1";

const ORIGIN = "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt";

/** 🔴 `kind` 는 **CEO 가 준 맥락** 이지 우리 판정이 아니다. */
const TARGETS = [
  {
    label: "보몽드",
    url: "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014022",
    kind: "상세" as const,
  },
  {
    label: "신세계몰 공식스토어",
    url: "https://shinsegaemall.ssg.com/item/itemView.ssg?itemId=1000856624845&salestrNo=6005&siteNo=6004",
    kind: "상세" as const,
  },
  {
    label: "신세계몰 아울렛",
    url: "https://shinsegaemall.ssg.com/item/itemView.ssg?itemId=1000876753638&salestrNo=6005&siteNo=6004",
    kind: "상세" as const,
  },
  { label: "LF몰", url: "https://m.lfmall.co.kr/app/product/EUCIXX00308", kind: "상세" as const },
  {
    label: "쁘띠루이",
    url: "https://petitlouie.co.kr/category/bobo-choses/555/",
    kind: "목록" as const,
  },
  {
    label: "도노키즈",
    url: "https://www.donokids.com/shop/shopbrand.html?xcode=058",
    kind: "목록" as const,
  },
  {
    label: "주니어에디션(en-kr)",
    url: "https://www.junioredition.com/en-kr/collections/bobo-choses/products/hug-hairy-monster-t-shirt-by-bobo-choses",
    kind: "상세" as const,
  },
  /**
   * 🔴🔴 WU-153 — **기존 fixture 의 국내 URL 둘을 되살린다**(CPO STEP 3 ②번 우선순위).
   *    🔴 새로 지어낸 URL 이 **아니다** — `wu-138-domestic-funnel` 의 그 URL 그대로다.
   * ```
   * biskuit.kr    human **SAME**      · KRW 88,000 보유(WU-138 실측) ← 두 번째 국내 SAME 후보
   * m.luxboy.com  human **DIFFERENT** · KRW 59,000                  ← 🔴 **FP 대조군**
   * ```
   * 🔴 대조군을 **같이** 넣는다 — 두 번째 SAME 을 얻으려다 DIFFERENT 가 같이 열리면
   *    그것이 이 트랙에서 여덟 번 측정된 그 실패다(완화 = Human DIFFERENT 동반 개방).
   */
  {
    label: "비스킷(human SAME)",
    url: "https://biskuit.kr/product/%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88-%ED%97%88%EA%B7%B8-%ED%97%A4%EC%96%B4%EB%A6%AC-%EB%AA%AC%EC%8A%A4%ED%84%B0-%ED%8B%B0%EC%85%94%EC%B8%A0-b226ac009/8891/category/367/display/1/",
    kind: "상세" as const,
  },
  {
    label: "럭스보이(human DIFF)",
    url: "https://m.luxboy.com/product/detail.html?product_no=103477",
    kind: "상세" as const,
  },
  /**
   * ══════════════════════════════════════════════════════════════════════════════
   * 🔴🔴 WU-156 — **CPO/CEO 가 직접 검색해 준 URL 전수**(2026-10-22 · 줄이지 않았다)
   * ══════════════════════════════════════════════════════════════════════════════
   *
   * 🔴 **지어내지 않았다** — 받은 표의 URL 그대로다(`utm_source` 는 뗐다 —
   *    `canonicalizeProductUrl` 이 떼는 추적 파라미터이고, 남기면 같은 상품이
   *    두 후보로 세어진다).
   * 🔴 **모양으로 미리 거르지 않았다**(CPO 조건) — 목록·검색·홈도 **그대로** 넣는다.
   *    거르는 것은 우리 파이프라인의 일이고, 그 결과가 이 측정의 산출물이다.
   */
  { label: "보몽드(목록)", url: "https://www.beaumonde.co.kr/goods/goods_list.php?brandCd=070031", kind: "목록" as const },
  {
    label: "롯데ON(검색)",
    url: "https://www.lotteon.com/csearch/search/search?mallId=1&platform=pc&q=%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%8826&render=search",
    kind: "검색" as const,
  },
  {
    label: "롯데홈쇼핑",
    url: "https://m.lotteimall.com/goods/viewGoodsDetail.lotte?goods_no=1287736300",
    kind: "상세" as const,
  },
  {
    label: "이마트몰(검색)",
    url: "https://emart.ssg.com/search.ssg?query=%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88%ED%8B%B0%EC%85%94%EC%B8%A0",
    kind: "검색" as const,
  },
  { label: "도노키즈(홈)", url: "https://donokids.com/", kind: "홈" as const },
  {
    label: "주니어에디션(글로벌)",
    url: "https://www.junioredition.com/products/hug-hairy-monster-t-shirt-by-bobo-choses",
    kind: "상세" as const,
  },
  { label: "라쿠텐", url: "https://item.rakuten.co.jp/little-lemonade/60980/", kind: "상세" as const },
  { label: "LL-Days(목록)", url: "https://ll-days.com/?gid=1607574&mode=grp&page=10", kind: "목록" as const },
  { label: "보보재팬(목록)", url: "https://bobochoses.co.jp/collections/all-kids?page=1", kind: "목록" as const },
] as const;

const loose = (u: string) => String(u).trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");
const hostOf = (u: string) => {
  try {
    return new URL(u).hostname;
  } catch {
    return "?";
  }
};

describe("WU-150 STEP 1 — B226AC009 국내 URL 전수 funnel", () => {
  it.runIf(LIVE)("각 URL 이 **어느 칸에서** 죽는지 한 줄씩 적는다", async () => {
    /* eslint-disable no-console */

    /* ── ① 원상품을 운영 경로로 추출 ───────────────────────────────────────── */
    const ex = await shopifySiteStrategy.extract(ORIGIN);
    expect(ex, "원상품 추출 실패").not.toBeNull();
    const product = buildCanonicalProduct(
      ORIGIN,
      ex!.productData as ExtractedProductData,
      {} as Record<string, ProductDataSource>,
      [],
    );
    const dna = buildProductIdentityDna(product);

    /* ── 🔴 STEP 2 — SKU/식별자가 «원상품에서» 무엇으로 잡히는가 ────────────── */
    console.log("\n══════ STEP 2 — 원상품 식별 데이터 ══════");
    console.log(`  brand           ${JSON.stringify(dna.brand.value)} (confident=${dna.brand.confident})`);
    console.log(`  brandModelCode  ${JSON.stringify(dna.brandModelCode)}   ← 🔴 B226AC009 여야 한다`);
    console.log(`  identifier      ${JSON.stringify(dna.identifier ?? null)}`);
    console.log(`  color           ${JSON.stringify(dna.color ?? null)}`);
    console.log(`  canonical sku   ${JSON.stringify(product.sku?.value ?? null)}`);
    console.log(`  canonical model ${JSON.stringify(product.modelName?.value ?? null)}`);
    console.log(`  title           ${JSON.stringify(dna.title)}`);
    const terms = buildCrossSellerSearchQueries(dna).filter(Boolean);
    console.log(`  검색어 ${terms.length}개 — ${JSON.stringify(terms.slice(0, 4))}`);

    const query = {
      title: dna.title,
      brand: dna.brand.value || undefined,
      sourceUrl: dna.sourceUrl,
      sku: dna.identifier?.tier === "SKU" ? dna.identifier.value : undefined,
      searchTerm: terms[0] ?? dna.title,
      searchTerms: terms,
      facts: productFactsFromIdentityDna(dna),
    };

    /* ── ② URL 모양 게이트 — 풀에 들어가기 «전» 에 무엇이 걸리는가 ──────────── */
    console.log("\n══════ ① URL 모양(classifyUrlShape) ══════");
    for (const t of TARGETS) {
      console.log(`  ${t.label.padEnd(14)} ${classifyUrlShape(t.url).padEnd(18)} ${t.url}`);
    }

    /* ── ③ 운영 추출기를 URL 하나씩 직접 — status 와 사실 칸을 본다 ────────── */
    console.log("\n══════ ③ factsFromProductUrl (운영 추출기 · URL 단건) ══════");
    const factsByUrl = new Map<string, Awaited<ReturnType<typeof factsFromProductUrl>>>();
    for (const t of TARGETS) {
      let f: Awaited<ReturnType<typeof factsFromProductUrl>> | null = null;
      try {
        f = await factsFromProductUrl(t.url);
      } catch (e) {
        console.log(`  ${t.label.padEnd(14)} THREW ${String(e).slice(0, 80)}`);
      }
      if (f) {
        factsByUrl.set(loose(t.url), f);
        const anyF = f as unknown as Record<string, unknown>;
        console.log(
          `  ${t.label.padEnd(14)} status=${String(anyF.status).padEnd(18)}` +
            ` path=${String(anyF.fetchPath ?? "-").padEnd(12)}` +
            ` brand=${JSON.stringify(anyF.brand ?? null)}` +
            ` code=${JSON.stringify(anyF.brandModelCode ?? null)}` +
            ` price=${JSON.stringify(anyF.price ?? null)}`,
        );
      }
    }

    /* ── ④ 운영 후보 풀 ────────────────────────────────────────────────────── */
    const pool = await collectUrlCandidatePool({
      urls: TARGETS.map((t) => t.url),
      originUrl: dna.sourceUrl,
      maxUrls: TARGETS.length,
      existingCanonicalUrls: new Set<string>(),
      shopId: REVIEWED_SAME_SHOP_ID,
      shopNamePrefix: REVIEWED_SAME_SHOP_NAME,
    });
    console.log("\n══════ ② collectUrlCandidatePool ══════");
    console.log(`  metrics ${JSON.stringify(pool.metrics)}`);

    const inPool = new Set<string>();
    for (const res of pool.searchResults) for (const x of res.candidates ?? []) inPool.add(loose(x.url));

    /* ── ⑤⑥⑦ 샵 판정 → 시장 → 최종 ───────────────────────────────────────── */
    const rows: GeminiTransientRow[] = [];
    const judgedByUrl = new Map<string, { best: boolean; kind: string; reason: string | null }>();
    /** 🔴 하니스 결함 방지 — 풀이 URL 을 정규화하므로 **host** 로도 잡는다. */
    const byHost = new Map<string, { kind: string; reason: string | null; best: boolean }>();

    console.log("\n══════ ④⑤ 후보 상세(운영 점수/보강 뒤) ══════");
    for (const res of pool.searchResults) {
      if (res.status !== "ok" || res.candidates.length === 0) continue;
      const notSelf = res.candidates.filter((x) => !isSelfReferenceCandidate(query.sourceUrl, x.url));
      const scored = withConfidence(query, notSelf);
      let priced = scored;
      try {
        priced = await enrichCandidatePrices(scored, res.domain, query);
      } catch {
        /* 운영과 같다 */
      }
      for (const x of priced) {
        const anyX = x as unknown as Record<string, unknown>;
        console.log(
          `  [${res.domain}] conf=${String(anyX.confidence ?? "-").slice(0, 5).padEnd(5)}` +
            ` level=${String(anyX.matchLevel ?? "-").padEnd(10)} verdict=${String(anyX.crossSellerVerdict ?? "-").padEnd(14)}` +
            ` price=${JSON.stringify(anyX.price ?? null)} status=${String(anyX.priceStatus ?? "-")}`,
        );
        console.log(`      title=${JSON.stringify(String(anyX.title ?? "").slice(0, 70))}`);
        console.log(
          `      blockers=${JSON.stringify((anyX.crossSellerBlockers ?? []) as unknown[])}` +
            ` conflicts=${JSON.stringify((anyX.crossSellerConflicts ?? []) as unknown[])}`,
        );
        console.log(`      reasons=${JSON.stringify(((anyX.matchReasons ?? []) as string[]).slice(0, 6))}`);
        /** 🔴 **STEP 2 의 핵심** — 후보측 식별 칸이 실제로 무엇으로 채워졌는가. */
        const cf = (anyX.facts ?? {}) as Record<string, unknown>;
        console.log(
          `      facts.brand=${JSON.stringify(cf.brand ?? null)}` +
            ` facts.brandModelCode=${JSON.stringify(cf.brandModelCode ?? null)}` +
            ` facts.sellerSku=${JSON.stringify(cf.sellerSku ?? null)}` +
            ` facts.colorText=${JSON.stringify(cf.colorText ?? null)}`,
        );
        console.log(`      crossSellerReasons=${JSON.stringify((anyX.crossSellerReasons ?? []) as unknown[])}`);
      }
      const j = await judgeDomesticCandidate({
        domain: res.domain,
        candidates: priced,
        sourceUrl: query.sourceUrl,
        foreignModelCode: dna.brandModelCode,
        foreignColor: dna.color,
        fetchModelCode: (u) => fetchDomesticModelCode(res.domain, u),
      });
      /** 🔴 DROPPED 의 **사유 칸 이름을 추측하지 않는다** — 객체를 통째로 찍는다. */
      if (j.kind !== "JUDGED") {
        console.log(`  🔴 [${res.domain}] DROPPED 원문 = ${JSON.stringify(j)}`);
      }
      const dropReason =
        j.kind !== "JUDGED"
          ? ((j as unknown as Record<string, unknown>).reason ??
            (j as unknown as Record<string, unknown>).dropGate ??
            (j as unknown as Record<string, unknown>).gate ??
            null)
          : null;
      for (const x of priced) {
        const entry = {
          best: j.kind === "JUDGED" && loose(j.best.url) === loose(x.url),
          kind: j.kind,
          reason: dropReason == null ? null : String(dropReason),
        };
        judgedByUrl.set(loose(x.url), entry);
        byHost.set(hostOf(x.url), entry);
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
        crossSellerBlockers: (j.best.crossSellerBlockers ?? []).map((b) => (typeof b === "string" ? b : b.blocker)),
        crossSellerConflicts: (j.best.crossSellerConflicts ?? []).map((x) => (typeof x === "string" ? x : x.conflict)),
        priceAmount: j.best.price?.amount ?? null,
        priceCurrency: j.best.price?.currency ?? null,
        priceStatus: j.best.priceStatus ?? null,
        market: m.market,
        basis: m.basis,
      } as GeminiTransientRow);
    }

    const judgement = buildMarketJudgement(rows);
    const inComparison = new Set(judgement.sellers.map((s) => loose(s.row.discoveredUrl)));

    /* ── 결과 표 ───────────────────────────────────────────────────────────── */
    console.log("\n══════ 🔴 STEP 1 결과 — 어느 칸에서 죽는가 ══════");
    for (const t of TARGETS) {
      const key = loose(t.url);
      const host = hostOf(t.url);
      const shape = classifyUrlShape(t.url);
      const f = factsByUrl.get(key) as unknown as Record<string, unknown> | undefined;
      /** 🔴 풀이 URL 을 정규화하므로 **host 폴백** 을 둔다(1차에 주니어에디션을 놓쳤다). */
      const jr = judgedByUrl.get(key) ?? byHost.get(host);
      const row = rows.find((x) => loose(x.discoveredUrl) === key || hostOf(x.discoveredUrl) === host);
      const inPoolHere = inPool.has(key) || [...inPool].some((u) => hostOf(u) === host);
      const tier = row?.matchTruth ? domesticMatchDisplay(row.matchTruth as never).tier : null;
      const died =
        shape !== "PRODUCT_PAGE"
          ? `① URL 모양 (${shape})`
          : !inPoolHere
            ? `② 후보 풀 (facts=${String(f?.status ?? "?")})`
            : !jr
              ? "③ 판정 입력 미도달"
              : jr.kind !== "JUDGED"
                ? `⑥ 샵 게이트 (${jr.reason ?? jr.kind})`
                : !jr.best
                  ? "⑥ 샵 대표 탈락(2순위)"
                  : tier !== "SAME"
                    ? `🧠 MI 판정 (tier=${tier} · ${[...(row?.crossSellerBlockers ?? []), ...(row?.crossSellerConflicts ?? [])].join(",") || "blocker 0"})`
                    : row?.market !== "KR"
                      ? `⑦ 시장 (market=${row?.market} · basis=${row?.basis})`
                      : !isPriceConfirmed(row)
                        ? `💰 가격 (${row?.priceStatus ?? "없음"})`
                        : inComparison.has(key)
                          ? "🟢 최종 비교까지 통과"
                          : "⑧ 최종 집계";
      console.log(
        `  ${t.label.padEnd(14)} ${t.kind}  ${died}\n` +
          `      host=${hostOf(t.url)} tier=${tier ?? "-"} market=${row?.market ?? "-"}` +
          ` price=${row?.priceAmount != null ? `${row.priceCurrency} ${row.priceAmount}` : "-"}` +
          ` sale=${row ? saleState(row) : "-"}`,
      );
    }
    console.log(
      `\n  📊 최종 — verdict ${judgement.verdict} · 판매중 ${judgement.onSaleCount}` +
        ` · 🇰🇷 ${judgement.domesticOnSale} · 🌎 ${judgement.overseasOnSale}`,
    );
    /**
     * 🔴🔴 WU-153 — **「🇰🇷 0곳」과 「국내 가격 근거 0」은 다른 말이다.**
     *    `domesticOnSale` 은 **판매중이 «확인된»** 수다. 국내 후보는 Shopify 가
     *    아니라 재고 신호가 없어 `UNKNOWN` 이고(WU-136 계약 — 모르는 것을 판매중으로
     *    세지 않는다) 그래서 0 으로 나온다. 🟢 그러나 **가격 축은 그것과 별개** 다.
     */
    const guide = buildPriceGuide(judgement, "KR");
    console.log(
      `\n  🇰🇷 국내 가격 축 — sameCount ${guide.sameCount} · onSale ${guide.onSaleCount}` +
        ` · priced ${guide.pricedCount} · unpriced ${guide.unpricedCount} · basis ${guide.basis}` +
        ` · byCurrency ${JSON.stringify(guide.byCurrency)}`,
    );
    console.log("\n  🔴 측정불가 — 11번가 · POSTY: **URL 이 제공되지 않았다**(0 으로 세지 않는다)");

    /** 🔴 이 테스트는 **측정** 이다 — 통과/실패를 단언하지 않는다(숫자를 만들지 않기 위해). */
    expect(TARGETS.length).toBe(18);
  }, 600_000);
});
