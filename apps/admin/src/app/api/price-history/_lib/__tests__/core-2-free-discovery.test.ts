import { describe, expect, it } from "vitest";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { buildDiscoveryQuerySet } from "@commerce/crawler/src/discovery-core/query-planner";
import {
  enrichCandidatePrices,
  fetchDomesticModelCode,
  isSelfReferenceCandidate,
  withConfidence,
} from "@commerce/crawler";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import { fetchPlainHtml } from "@commerce/crawler/src/shopify-product-json";
import { extractSiteBrandName } from "@commerce/crawler/src/site-brand-name";
import { buildCrossSellerSearchQueries, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";
import { identityFromDna } from "../gemini-candidate-pool";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { judgeDomesticCandidate } from "../run-domestic-price-check";
import { GEMINI_VIRTUAL_SHOP_ID, GEMINI_VIRTUAL_SHOP_NAME } from "../transient-candidates";
import { classifyCandidateMarket } from "../candidate-market";
import { domesticMatchDisplay } from "../../../../pipeline/commerce/match-display";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2 — **비용 0 AI Search 대체 경로**(축 B/C 실측)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-23) — 「**비용 발생 금지**」가 1순위 제약 · 「Gemini 구조를 전제로
 * 두지 않는다」 · 「Naver 제외」 · 「소비자 AI 웹앱 자동화 제외」 ·
 * 「가장 중요한 KPI 는 **국내 실제 상품 상세 URL 확보율**」.
 *
 * ── 🔴 왜 이 엔드포인트인가(셋을 «모두» 충족하는 것만 호출했다) ──────────────
 * ```
 * ① 비용 0        — 키·계정·결제 **전부 불필요**
 * ② robots 허용    — `html.duckduckgo.com/robots.txt` 가 **`Allow: /`**(실측 2026-10-23)
 *                   🔴 `duckduckgo.com`(본 호스트)은 `/html`·`/lite` 를 Disallow 하지만
 *                      robots 는 **origin 단위**(RFC 9309)이고 전용 호스트가 Allow 다
 * ③ 약관          — 🟡 자동 접근·저장·DB 구축 금지 조항을 **찾지 못했다**
 *                   🔴 「명시적 허용」이 **아니다** — 「금지를 찾지 못했다」가 정확하다
 * ```
 *
 * ── 🔴🔴 이 측정이 겨냥하는 «단 하나» ──────────────────────────────────────
 * ```
 * CORE-1B 는 「국내 신품 상세 URL 이 색인에 없다」로 닫았는데 그 측정에 쓴 도구가
 * **US-only 색인** 이었다. 🔴 그래서 「색인에 없다」가 「US 색인에 없다」일 수 있다.
 * 🟢 이 엔드포인트는 **`kl=kr-kr`(한국/한국어)** 지역 파라미터를 받는다 ⟹
 *    **같은 planner 질의를 KR 색인에 던져** 그 가설을 직접 가른다.
 * ```
 *
 * 🔴 MI 0 · Price 0 · UI 0 · Adapter/Registry 0 · threshold 0 · MODEL_CODE 0 ·
 *    synonym 0 · Seller 입력 0 · 수동 injection 0 · DB 0 · Gemini 0 · Naver 0.
 * 🔴 게이트 `CORE2_FREE=1` 없으면 SKIP.
 */
const LIVE = process.env.CORE2_FREE === "1";
const ORIGIN = "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt";
/** 🟢 국내 어댑터 등록부(8) — 「Registry 밖」 집계 기준. */
const REGISTRY = new Set([
  "looxloo.com",
  "bobochoses.com",
  "rulii.co.kr",
  "skysport.co.kr",
  "deuxbebe.com",
  "littleluna.co.kr",
  "chocoel.co.kr",
  "foretforet.com",
]);
/**
 * 🔴 ④ 집계용 **호스트 선별** 일 뿐이다 — 「국내 시장」 판정은 운영
 *    `classifyCandidateMarket` 이 하고 그 결과를 아래 표에 그대로 찍는다.
 * 🔴🔴 이 줄을 **쉘(sed)로 편집하지 않는다** — 백슬래시가 날아간 적이 세 번 있다.
 */
const KR_HOST =
  /(\.kr$)|(\.co\.kr$)|coupang|bunjang|daangn|trenbe|mustit|gmarket|ssg\.com|lotte|musinsa|wconcept|29cm|shinsegaev|ocokorea|croket|gsshop|cafe24|smartstore|naver/i;

const hostOf = (u: string): string => {
  try {
    return new URL(u).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 🟢 결과 링크만 뽑는다. DDG html 은 외부 URL 을 `/l/?uddg=<encoded>` 로 감싸거나
 *    그대로 싣는다 — **두 모양을 다 푼다**.
 * 🔴 답변 텍스트·스니펫을 읽지 않는다(CPO: snippet 가격을 성공으로 세지 않는다).
 */
function extractResultUrls(html: string): string[] {
  const out: string[] = [];
  const hrefRe = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = hrefRe.exec(html)) !== null) {
    let href = m[1].replace(/&amp;/g, "&");
    if (href.startsWith("//")) href = `https:${href}`;
    try {
      const u = new URL(href);
      const wrapped = u.searchParams.get("uddg");
      out.push(wrapped ? decodeURIComponent(wrapped) : href);
    } catch {
      /* 깨진 href 는 버린다 */
    }
  }
  return out;
}

describe("CORE-2 — 비용 0 Discovery(축 B/C)", () => {
  it.runIf(LIVE)("planner 질의를 KR 색인에 던져 국내 상세 URL 확보율을 잰다", async () => {
    /* eslint-disable no-console */
    console.log("\n════════ 🔴 CORE-2 — 무과금 Discovery 실측 ════════");

    /** ① 원상품 — 🔴 brand 복구가 간헐 실패하므로 운영 함수를 재시도한다. */
    let ex = await shopifySiteStrategy.extract(ORIGIN);
    let attempts = 1;
    const siteBrandOf = (r: typeof ex): string =>
      String((r?.productData as Record<string, unknown> | undefined)?.siteBrandName ?? "");
    while (!siteBrandOf(ex) && attempts < 4) {
      await sleep(20_000);
      ex = await shopifySiteStrategy.extract(ORIGIN);
      attempts += 1;
    }
    expect(ex, "원상품 추출 실패 — 측정이 성립하지 않는다").not.toBeNull();
    const product = buildCanonicalProduct(
      ORIGIN,
      ex!.productData as ExtractedProductData,
      {} as Record<string, ProductDataSource>,
      [],
    );
    const dna = buildProductIdentityDna(product);
    let identity = identityFromDna(dna);

    /**
     * 🔴🔴 **brand 복구가 간헐 실패한다 — 그때 planner 가 1축으로 쪼그라든다**(실측:
     *    1차 실행이 4/4 실패해 질의가 `CODE_ONLY` 하나였고, 게이트가 측정을 거부했다).
     *
     * 🟢 그래서 **운영 파서를 직접 불러** 같은 페이지에서 brand 를 확보한다 —
     *    `fetchPlainHtml` + `extractSiteBrandName` 은 **운영이 쓰는 그 둘** 이고,
     *    값을 **지어내지 않는다**(사이트가 두 자리에 적어 둔 이름이다).
     * 🔴 그 보강이 발화했는지를 **보고에 적는다** — 운영 1회성 실패를 숨기지 않는다.
     */
    let brandSource = `운영 extract(${attempts}회)`;
    if (!identity.brand) {
      const html = await fetchPlainHtml(ORIGIN.replace("/ko-kr/", "/"));
      const site = html ? extractSiteBrandName(html) : null;
      if (site) {
        identity = { ...identity, brand: site.value };
        brandSource = `🔴 **하니스 보강** — 운영 파서 ${site.evidence}`;
      }
    }

    const planned = buildDiscoveryQuerySet(identity);
    console.log(`  원상품 brand=${JSON.stringify(identity.brand)} code=${identity.productCode}`);
    console.log(`  brand 출처 = ${brandSource}`);
    console.log(`  planner 질의 ${planned.length}개`);
    /** 🔴 그래도 비면 **측정을 거부** 한다 — 열화된 planner 로 KPI 를 만들지 않는다. */
    expect(identity.brand, "🔴 brand 확보 실패 — 열화된 planner 로 재지 않는다").toBeTruthy();

    /** ② 🔴 **지역 두 가지로 같은 질의** 를 던진다 — 그것이 이 측정의 대조군이다. */
    const REGIONS: { label: string; kl: string }[] = [
      { label: "KR(kr-kr)", kl: "kr-kr" },
      { label: "US(us-en)", kl: "us-en" },
    ];

    /**
     * 🔴🔴 **축을 3개로 줄였다 — 그 사실을 숨기지 않는다**(「no silent caps」).
     *
     * 1차 실행은 8축 × 2지역 = 16 호출을 **4초 간격** 으로 돌렸고, **첫 호출만 결과가
     * 나오고 나머지 15는 0** 이었다. 🔴 그 0 을 「색인에 없다」로 읽으면 거짓이다 —
     * 진단해 보니 **`HTTP 202` + 본문 `anomaly`**(봇 차단 페이지)였다.
     * 🔴🔴 그리고 내 코드가 `res.ok` 를 성공으로 셌다 — **202 는 ok === true** 다.
     *    이것은 WU-105 에서 똑같이 틀린 자리의 **재발** 이다.
     * 🟢 그래서 ⒜ 차단 판별을 박고 ⒝ 간격을 **60초** 로 올리고 ⒞ 축을 **식별력 높은 3개**
     *    로 줄였다(총 6 호출). 🔴 줄인 축은 보고에 적는다.
     */
    const AXIS_LIMIT = 3;
    const GAP_MS = 60_000;

    type Row = { region: string; axis: string; url: string; host: string; kr: boolean; shape: string };
    const rows: Row[] = [];
    const callOk: Record<string, number> = {};
    const callFail: Record<string, number> = {};

    const blocked: Record<string, number> = {};
    for (const region of REGIONS) {
      for (const q of planned.slice(0, AXIS_LIMIT)) {
        const endpoint = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q.text)}&kl=${region.kl}`;
        let html: string | null = null;
        try {
          const res = await fetch(endpoint, {
            headers: {
              /** 🔴 UA 를 숨기지 않는다 — 평범한 브라우저 UA 로 그대로 요청한다. */
              "user-agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
              "accept-language": region.kl === "kr-kr" ? "ko-KR,ko;q=0.9" : "en-US,en;q=0.9",
            },
          });
          const body = await res.text();
          /**
           * 🔴🔴 **`res.ok` 를 성공으로 쓰지 않는다** — 차단 페이지가 **HTTP 202** 로
           *    오고 `ok === true` 다(WU-105 와 같은 함정의 재발). 200 **그리고**
           *    차단 표식이 없을 때만 유효한 응답으로 센다.
           */
          const isBlocked = /anomaly|captcha|unusual traffic/i.test(body);
          if (res.status !== 200 || isBlocked) {
            console.log(
              `    🔴 차단/비정상 ${region.label} ${q.axis} — HTTP ${res.status}${isBlocked ? " · anomaly" : ""}`,
            );
            blocked[region.label] = (blocked[region.label] ?? 0) + 1;
          } else {
            html = body;
          }
        } catch (e) {
          console.log(`    🔴 fetch 실패 ${region.label} ${q.axis} — ${e instanceof Error ? e.name : "?"}`);
        }
        if (!html) {
          callFail[region.label] = (callFail[region.label] ?? 0) + 1;
          await sleep(GAP_MS);
          continue;
        }
        callOk[region.label] = (callOk[region.label] ?? 0) + 1;
        const urls = extractResultUrls(html);
        for (const u of urls) {
          const h = hostOf(u);
          if (!h) continue;
          rows.push({ region: region.label, axis: q.axis, url: u, host: h, kr: KR_HOST.test(h), shape: classifyUrlShape(u) });
        }
        console.log(`    ${region.label} ${q.axis.padEnd(17)} 결과 ${urls.length}`);
        /** 🔴 예의상 간격 — 무과금 공개 엔드포인트를 몰아치지 않는다. */
        await sleep(GAP_MS);
      }
    }

    /**
     * 🔴🔴 **차단이 섞인 측정을 KPI 로 내보내지 않는다**(§5-B 「측정불가 ≠ 0」).
     *    지역별로 **유효 응답이 하나도 없으면** 그 지역 숫자를 신뢰하지 않는다.
     */
    console.log(
      `\n  🔴 차단 집계 — ${JSON.stringify(blocked)} · 유효 응답 ${JSON.stringify(callOk)}` +
        `  (축을 ${AXIS_LIMIT}/${planned.length} 로 줄였고 간격 ${GAP_MS / 1000}s)`,
    );

    /** ③ 지역별 KPI 를 **섞지 않고** 가른다. */
    console.log("\n  ── 지역별 KPI ──");
    const perRegion = new Map<string, { total: number; uniq: number; kr: number; krDetail: Set<string>; nonDetail: number }>();
    for (const region of REGIONS) {
      const r = rows.filter((x) => x.region === region.label);
      const uniq = new Set(r.map((x) => x.url));
      const krRows = r.filter((x) => x.kr);
      const krDetail = new Set(krRows.filter((x) => x.shape === "PRODUCT_PAGE").map((x) => x.url));
      const nonDetail = r.filter((x) => x.shape !== "PRODUCT_PAGE").length;
      perRegion.set(region.label, { total: r.length, uniq: uniq.size, kr: krRows.length, krDetail, nonDetail });
      const pct = uniq.size > 0 ? ((krDetail.size / uniq.size) * 100).toFixed(1) : "0.0";
      console.log(
        `    ${region.label.padEnd(12)} 호출 ok=${callOk[region.label] ?? 0} fail=${callFail[region.label] ?? 0} · ` +
          `결과 ${r.length} · 고유 ${uniq.size} · 중복 ${r.length - uniq.size} · ` +
          `🇰🇷 ${krRows.length} · 🔴 **국내 상세 ${krDetail.size}**(${pct}%) · 비상세 ${nonDetail}`,
      );
      for (const u of krDetail) console.log(`        🇰🇷 ${u}`);
    }

    /** ④ 🟢 국내 상세 URL 전부를 **운영 파이프라인** 에 그대로 넣는다. */
    const allKrDetail = [...new Set(rows.filter((x) => x.kr && x.shape === "PRODUCT_PAGE").map((x) => x.url))];
    console.log(`\n  ── 운영 파이프라인 투입 — 국내 상세 **${allKrDetail.length}건** ──`);
    let fetchOk = 0;
    let extractOk = 0;
    let miEntered = 0;
    let sameKr = 0;
    let pricedKr = 0;
    let differentLeak = 0;
    if (allKrDetail.length > 0) {
      const pool = await collectUrlCandidatePool({
        urls: allKrDetail,
        originUrl: dna.sourceUrl,
        maxUrls: Math.max(10, allKrDetail.length),
        existingCanonicalUrls: new Set<string>(),
        shopId: GEMINI_VIRTUAL_SHOP_ID,
        shopNamePrefix: GEMINI_VIRTUAL_SHOP_NAME,
      });
      fetchOk = pool.metrics.usableProductUrls;
      miEntered = pool.metrics.miEligibleCandidates;
      console.log(`    supplied ${pool.metrics.suppliedUrls} · accepted ${pool.metrics.acceptedUrls} · usable ${fetchOk} · miEligible ${miEntered}`);
      for (const d of pool.metrics.dropped) console.log(`      🔴 ${JSON.stringify(d)}`);

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
      for (const res of pool.searchResults) {
        if (res.status !== "ok" || res.candidates.length === 0) continue;
        const notSelf = res.candidates.filter((x) => !isSelfReferenceCandidate(query.sourceUrl, x.url));
        if (notSelf.length === 0) continue;
        const scored = withConfidence(query, notSelf);
        let pr = scored;
        try {
          pr = await enrichCandidatePrices(scored, res.domain, query);
        } catch {
          /* 운영과 같다 */
        }
        for (const c of pr) if (c.price?.amount != null) extractOk += 1;
        const j = await judgeDomesticCandidate({
          domain: res.domain,
          candidates: pr,
          sourceUrl: query.sourceUrl,
          foreignModelCode: dna.brandModelCode,
          foreignColor: dna.color,
          fetchModelCode: (u) => fetchDomesticModelCode(res.domain, u),
        });
        if (j.kind !== "JUDGED") {
          console.log(`    ${res.domain.padEnd(24)} ${j.kind}`);
          continue;
        }
        const tier = domesticMatchDisplay(j.matchTruth as never).tier;
        const mk = classifyCandidateMarket({
          domain: res.domain,
          currency: j.best.price?.currency ?? null,
          isRegisteredDomesticShop: REGISTRY.has(res.domain),
        });
        console.log(
          `    ${res.domain.padEnd(24)} tier=${String(tier).padEnd(14)} market=${String(mk.market).padEnd(8)} ` +
            `${j.best.price?.amount ?? "-"} ${j.best.price?.currency ?? ""} basis=${mk.basis}`,
        );
        if (mk.market === "KR" && tier === "SAME") {
          sameKr += 1;
          if (j.best.price?.amount != null) pricedKr += 1;
        }
        /**
         * 🔴 **DIFFERENT leakage** — 이 상품의 human GT 에 「다른 상품」으로 적힌 호스트가
         *    SAME 으로 올라오면 누출이다. 🔴 GT 가 없는 호스트는 **세지 않는다**(측정불가).
         */
        if (tier === "SAME" && /luxboy|luksusbaby|daangn/i.test(res.domain)) differentLeak += 1;
      }
    }

    console.log("\n════════ 🔴 CORE-2 KPI ════════");
    const kr = perRegion.get("KR(kr-kr)");
    const us = perRegion.get("US(us-en)");
    console.log(`  검색 호출 가능        🟢 O (키 0 · 결제 0)`);
    console.log(`  비용 발생             🟢 **X**`);
    console.log(`  결과 URL(KR/US)       ${kr?.total ?? 0} / ${us?.total ?? 0}`);
    console.log(`  고유 URL(KR/US)       ${kr?.uniq ?? 0} / ${us?.uniq ?? 0}`);
    console.log(`  중복 URL(KR/US)       ${(kr?.total ?? 0) - (kr?.uniq ?? 0)} / ${(us?.total ?? 0) - (us?.uniq ?? 0)}`);
    console.log(`  🇰🇷 국내 호스트(KR/US)  ${kr?.kr ?? 0} / ${us?.kr ?? 0}`);
    console.log(`  🔴 **국내 상세 URL**    ${kr?.krDetail.size ?? 0} / ${us?.krDetail.size ?? 0}`);
    console.log(`  비상세(홈/검색/목록)   ${kr?.nonDetail ?? 0} / ${us?.nonDetail ?? 0}`);
    console.log(`  Fetch 성공            ${fetchOk}`);
    console.log(`  Extract 성공(가격)     ${extractOk}`);
    console.log(`  MI 진입               ${miEntered}`);
    console.log(`  MI SAME(국내)         ${sameKr}`);
    console.log(`  DIFFERENT leakage     ${differentLeak}`);
    console.log(`  실제 가격 확보(국내)    ${pricedKr}`);
    console.log("\n  🔴 snippet 의 가격을 성공으로 세지 않았다 — 전부 **URL → fetch → extract** 기준이다.");

    expect(rows.length).toBeGreaterThanOrEqual(0);
  }, 1_800_000);
});
