import { describe, expect, it } from "vitest";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { enrichCandidatePrices, fetchDomesticModelCode, isSelfReferenceCandidate, withConfidence } from "@commerce/crawler";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { buildCrossSellerSearchQueries, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { judgeDomesticCandidate } from "../run-domestic-price-check";
import { REVIEWED_SAME_SHOP_ID, REVIEWED_SAME_SHOP_NAME } from "../transient-candidates";
import { classifyCandidateMarket } from "../candidate-market";
import { domesticMatchDisplay } from "../../../../pipeline/commerce/match-display";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-163 — **비스킷 브랜드 목록의 후속 페이지에 B226AC009 가 있는가** (측정)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-22) — 「**실제 링크/페이지네이션이 목록 HTML 에 존재하는 경우만**
 * 따라간다. URL 추측 **금지** · 상세 URL 직접 생성 **금지** · 샵 내부 검색 구현 **금지**」.
 *
 * 🔴 운영 코드 **0** · 2-hop 운영 기능 **0** · adapter **0** · registry **0** ·
 *    Playwright **0** · Gemini **0** · MI **0** · 배포 **0**.
 * 🔴 게이트 `WU_163_PROBE=1` 없으면 SKIP.
 *
 * ── robots(비스킷) 재확인 ──────────────────────────────────────────────────
 * ```
 * Disallow — /admin · /api · /exec/front/ · /member/ · /myshop/ · /protected/ ·
 *            /skin-(와일드카드) · /board 계열 page= · page_4= · page_6=
 * 🟢 목록 페이지네이션(`category/...?page=N`)은 **금지 목록에 없다**
 * 🔴 그래도 **`page_4=` · `page_6=` 가 들어간 링크는 따라가지 않는다**(아래 가드)
 * ```
 */
const LIVE = process.env.WU_163_PROBE === "1";
const START = "https://biskuit.kr/category/bobo-choses/70/";
const ORIGIN = "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt";
const TARGET = "b226ac009";

/** 🔴 예의상 상한 — 목록 페이지를 무한히 열지 않는다. 적용 사실을 **출력한다**. */
const PAGE_CAP = 12;

/** 🔴 robots 금지 조각. 하나라도 걸리면 **따라가지 않는다**(우회 0). */
const DISALLOW = ["/admin", "/api", "/exec/front/", "/member/", "/myshop/", "/protected/", "/skin-"] as const;
const DISALLOW_QUERY = ["page_4=", "page_6="] as const;

function allowed(u: string): boolean {
  try {
    const url = new URL(u);
    if (DISALLOW.some((d) => url.pathname.includes(d))) return false;
    if (DISALLOW_QUERY.some((q) => url.search.includes(q))) return false;
    if (/board|article/i.test(url.pathname) && url.searchParams.has("page")) return false;
    return true;
  } catch {
    return false;
  }
}

async function raw(url: string): Promise<{ status: number | null; html: string }> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; ttaejyo-measure/1.0)" },
      signal: AbortSignal.timeout(30000),
    });
    return { status: res.status, html: await res.text() };
  } catch {
    return { status: null, html: "" };
  }
}

function hrefs(html: string, base: string): string[] {
  const out: string[] = [];
  const re = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const h = m[1].trim();
    if (!h || h.startsWith("#") || /^(javascript|mailto|tel):/i.test(h)) continue;
    try {
      out.push(new URL(h, base).toString());
    } catch {
      /* 무시 */
    }
  }
  return out;
}

/** 🔴 비스킷의 **관측된** 상세 모양(WU-159/161/162) — 지어낸 규칙이 아니다. */
const isDetail = (u: string) => {
  try {
    return /\/product\/[^/]+\/\d+/.test(new URL(u).pathname);
  } catch {
    return false;
  }
};

describe("WU-163 — 비스킷 목록 페이지네이션에서 목표 상품 찾기", () => {
  it.runIf(LIVE)("실제 링크만 따라가며 B226AC009 를 찾는다", async () => {
    /* eslint-disable no-console */
    const startPath = new URL(START).pathname;
    const seen = new Set<string>([START]);
    const queue: string[] = [START];
    const pagesVisited: string[] = [];
    const detailAll = new Set<string>();
    let targetDetail: string | null = null;
    let paginationLinksFound = 0;

    console.log("\n══════ 🔴 WU-163 — 비스킷 목록 페이지네이션 ══════");
    console.log(`  시작 ${START}\n  🔴 페이지 상한 **${PAGE_CAP}**(예의상) · 🔴 URL 추측 0 — HTML 의 링크만`);

    while (queue.length > 0 && pagesVisited.length < PAGE_CAP) {
      const page = queue.shift()!;
      const res = await raw(page);
      pagesVisited.push(page);
      if (res.status !== 200 || res.html.length === 0) {
        console.log(`  🔴 ${res.status ?? "fetch 실패"} — ${page.slice(0, 90)}`);
        continue;
      }
      const links = hrefs(res.html, page).filter(allowed);
      /** 🔴 **같은 목록 경로** 이고 쿼리가 다른 링크 = 페이지네이션/정렬. 실제 링크만. */
      const paging = [...new Set(links.filter((u) => {
        try {
          const x = new URL(u);
          return x.hostname.replace(/^www\./, "") === "biskuit.kr" && x.pathname.startsWith(startPath) && x.search !== "";
        } catch {
          return false;
        }
      }))];
      const details = [...new Set(links.filter(isDetail))];
      for (const d of details) detailAll.add(d);

      const hitHtml = res.html.toLowerCase().includes(TARGET);
      const hitUrl = details.find((u) => u.toLowerCase().includes(TARGET)) ?? null;
      if (hitUrl && !targetDetail) targetDetail = hitUrl;

      console.log(
        `  🟢 200 · ${String(Math.round(res.html.length / 1024) + "KB").padStart(6)} · 상세 ${String(details.length).padStart(3)} ·` +
          ` 목록링크 ${String(paging.length).padStart(3)} · 목표 ${hitHtml ? "🟢HTML" : "--"}${hitUrl ? "/🟢URL" : ""}` +
          `  ${page.replace("https://biskuit.kr", "").slice(0, 60)}`,
      );

      if (pagesVisited.length === 1) paginationLinksFound = paging.length;
      for (const p of paging) {
        if (!seen.has(p)) {
          seen.add(p);
          queue.push(p);
        }
      }
    }

    console.log("\n══════ 🔴🔴 KPI ══════");
    console.log(`  ① 1페이지에 **실제 페이지네이션/목록 링크** 가 있는가 = ${paginationLinksFound > 0 ? `🟢 ${paginationLinksFound}건` : "🔴 **0건**"}`);
    console.log(`  ② 열어 본 목록 페이지 = ${pagesVisited.length}(상한 ${PAGE_CAP})`);
    console.log(`  ③ 회수한 상세 URL(고유) = **${detailAll.size}**`);
    console.log(`  ④ 🔴 **목표 상품 상세 URL** = ${targetDetail ? "🟢 **찾았다**" : "🔴 **없다**"}`);
    if (targetDetail) console.log(`     ${targetDetail}`);

    if (!targetDetail) {
      console.log("\n  🔴 ⟹ **목록 1-hop(+실제 페이지네이션)만으로는 부족하다** 가 확정된다(CPO 문장).");
      console.log("  🔴 단 「비스킷이 그 상품을 팔지 않는다」로 적지 않는다 — 품절/삭제/다른 분류를 **가르지 못했다**.");
      console.log("  🔴 샵 내부 검색은 **구현하지 않았다**(CPO 금지) — 그 판단은 CPO 몫이다.");
      expect(detailAll.size).toBeGreaterThanOrEqual(0);
      return;
    }

    /** 🟢 찾았으면 **기존 파이프라인 그대로** 검증한다(새 경로 0). */
    const ex = await shopifySiteStrategy.extract(ORIGIN);
    expect(ex, "원상품 추출 실패").not.toBeNull();
    const product = buildCanonicalProduct(
      ORIGIN,
      ex!.productData as ExtractedProductData,
      {} as Record<string, ProductDataSource>,
      [],
    );
    const dna = buildProductIdentityDna(product);
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
      urls: [targetDetail],
      originUrl: dna.sourceUrl,
      maxUrls: 10,
      existingCanonicalUrls: new Set<string>(),
      shopId: REVIEWED_SAME_SHOP_ID,
      shopNamePrefix: REVIEWED_SAME_SHOP_NAME,
    });
    console.log(
      `\n  pool — supplied ${pool.metrics.suppliedUrls} → usable ${pool.metrics.usableProductUrls} → miEligible ${pool.metrics.miEligibleCandidates}`,
    );
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
      const j = await judgeDomesticCandidate({
        domain: res.domain,
        candidates: priced,
        sourceUrl: query.sourceUrl,
        foreignModelCode: dna.brandModelCode,
        foreignColor: dna.color,
        fetchModelCode: (u) => fetchDomesticModelCode(res.domain, u),
      });
      if (j.kind !== "JUDGED") {
        console.log(`  → ${res.domain}: **${j.kind}**`);
        continue;
      }
      const tier = domesticMatchDisplay(j.matchTruth as never).tier;
      const mk = classifyCandidateMarket({
        domain: res.domain,
        currency: j.best.price?.currency ?? null,
        isRegisteredDomesticShop: false,
      });
      console.log(
        `  🔴🔴 **최종** — tier=**${tier}** · market=**${mk.market}** ·` +
          ` ${j.best.price?.amount != null ? `**${j.best.price.currency} ${j.best.price.amount}**` : "가격 없음"}`,
      );
      console.log(`     ${String(j.best.title).slice(0, 70)}`);
      console.log(`     blockers=${JSON.stringify((j.best.crossSellerBlockers ?? []).map((b) => (typeof b === "string" ? b : b.blocker)))}`);
    }

    expect(targetDetail).not.toBeNull();
  }, 900_000);
});
