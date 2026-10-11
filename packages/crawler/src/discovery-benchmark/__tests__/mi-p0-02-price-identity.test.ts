/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-02 STEP E/F/G/H/I — Price Adapter · Identity · Verified Price · KPI
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 실제 판매처에 요청한다.
 *
 * ── 🔴 2단계 측정 규칙을 그대로 따른다 ─────────────────────────────────────
 * ① 측정값          국내 동일상품 가격 확보율
 * ② 운영 Path       searchOneDomesticShop (index.ts:247)
 * ③ 값의 owner      `adapter.search({term, currency})` — 🔴 `factsFromProductUrl`
 *                   이 «아니다». 그 함수는 주석에 「통화를 모르므로 가격을 만들지
 *                   않는다」고 적어 뒀고, 그 null 은 결함이 아니다
 * ④ signature       PriceSourceSearchInput{term, currency} → ComparisonCandidate[]
 * ⑤ 측정 위치       owner 를 직접 호출한다
 * ⑥ null 의 의미    아래 5분류로 «갈라» 적는다
 * ⑦⑧ defect/KPI    분모·분자를 명시해 적는다
 *
 * 🔴 검색어를 지어내지 않는다. 운영이 쓰는 사다리 `buildCrossSellerSearchQueries`
 *    를 그대로 쓴다 — 내가 만든 검색어로 재면 운영 Recall 이 아니라 내 검색어를
 *    재게 된다.
 * 🔴 DB(`domestic_price_sources`)를 읽지 않는다. 운영 경로가 DB 에서 가져오는 것은
 *    `currency` 와 `collectionStrategy` 둘뿐이고, 어댑터는 전부 WEB 파서라
 *    currency 를 응답에서 읽거나 선언값을 그대로 쓴다. 🔴 그래서
 *    **`collectionStrategy` 게이트는 이 측정이 «건너뛴» 것** 이다 — 사실로 적는다.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isSelfReferenceCandidate } from "../../comparison-search/self-reference";
import { withConfidence } from "../../comparison-search/match";
import { findPriceSourceAdapter, listPriceSourceAdapters } from "../../comparison-search/price-source-adapter";
import { productFactsFromShopifyProduct } from "../../comparison-search/seller-facts";
import { domesticPriceSourceDomains } from "../supported-sellers";
import { buildCrossSellerSearchQueries, identityDnaFromFields } from "@commerce/shared";
import type { ComparisonCandidate, ComparisonQuery } from "../../comparison-search/types";
import type { ProductFacts } from "@commerce/shared";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(os.tmpdir(), "mi-p0-02");
const FIXTURES = path.join(__dirname, "..", "..", "__tests__", "fixtures");

/* ═════════════════ 원상품 — 🔴 fixture 에서 읽는다(지어내지 않는다) ═════════════════ */

function shopifyFacts(file: string, domain: string, sourceUrl: string): ProductFacts {
  const raw = JSON.parse(readFileSync(path.join(FIXTURES, file), "utf8")) as Record<string, unknown>;
  return {
    ...productFactsFromShopifyProduct(
      {
        title: raw.title as string,
        handle: raw.handle as string,
        url: `/products/${raw.handle as string}`,
        description: raw.description as string,
        vendor: raw.vendor as string,
        type: raw.type as string,
        tags: raw.tags as string[],
        options: raw.options as { name?: string; values?: string[] }[],
        images: raw.images as string[],
      },
      domain,
    ),
    sourceUrl,
  };
}

interface Job {
  jobKey: string;
  basis: string;
  query: ComparisonQuery;
}

function buildJobs(): Job[] {
  const je = {
    title: "Bubble Sweatshirt in Grey Melange by Main Story",
    brand: "Main Story",
    sourceUrl: "https://www.junioredition.com/en-kr/products/bubble-sweatshirt-in-grey-melange-by-main-story",
    color: "Grey Melange",
  };
  const bobo = {
    title: "Bobo Choses Bolder half zipped sweatshirt",
    brand: "Bobo Choses",
    sourceUrl: "https://bobochoses.com/products/b226ac114-bobo-choses-bolder-half-zipped-sweatshirt",
  };
  return [
    {
      jobKey: "JOB-JE-MAINSTORY",
      basis: "fixtures/junioredition-bubble-sweatshirt-in-grey-melange-by-main-story.json",
      query: {
        ...je,
        // 🔴 운영 사다리를 그대로 쓴다. 손으로 쓴 검색어가 아니다.
        searchTerms: buildCrossSellerSearchQueries(identityDnaFromFields(je)),
        facts: shopifyFacts(
          "junioredition-bubble-sweatshirt-in-grey-melange-by-main-story.json",
          "junioredition.com",
          je.sourceUrl,
        ),
      },
    },
    {
      jobKey: "JOB-BOBO-B226AC114",
      basis: "fixtures/bobochoses-b226ac114.json",
      query: {
        ...bobo,
        searchTerms: buildCrossSellerSearchQueries(identityDnaFromFields(bobo)),
        facts: shopifyFacts("bobochoses-b226ac114.json", "bobochoses.com", bobo.sourceUrl),
      },
    },
  ];
}

/* ═════════════════ STEP F — 가격을 다섯으로 «갈라» 적는다 ═════════════════ */

/**
 * 🔴 **하나의 `price=0` 으로 뭉개지 않는다.** 이 스프린트 직전 세션이 정확히
 *    그렇게 해서 「price 0/6」이라는 없는 P0 결함을 보고했다.
 */
type PriceClass =
  | "NO_ADAPTER"
  | "ADAPTER_PARSER_FAILED"
  | "ADAPTER_NO_CANDIDATES"
  | "CANDIDATE_NO_PRICE"
  | "PRICE_NO_CURRENCY"
  | "PRICE_OK";

interface ShopMeasure {
  jobKey: string;
  domain: string;
  /** 🔴 어느 사다리 칸에서 결과가 나왔는가. 「그 말로는 못 찾았다」를 가른다. */
  hitTermIndex: number | null;
  hitTerm: string | null;
  termsTried: number;
  priceClass: PriceClass;
  failureDetail: string | null;
  candidates: {
    title: string;
    url: string;
    price: { amount: number; currency: string } | null;
    sku: string | null;
    matchLevel: string | null;
    matchTruth: string | null;
    crossSellerVerdict: string | null;
    selfReference: boolean;
    soldOut: boolean | null;
    priceStatus: string | null;
  }[];
}

function classifyPrice(scored: ComparisonCandidate[]): PriceClass {
  if (scored.length === 0) return "ADAPTER_NO_CANDIDATES";
  // 🔴 「가장 좋은 상태」로 분류한다 — 한 후보라도 정상 가격이면 그 사실이 참이다.
  if (scored.some((c) => c.price != null && c.price.currency)) return "PRICE_OK";
  if (scored.some((c) => c.price != null && !c.price.currency)) return "PRICE_NO_CURRENCY";
  return "CANDIDATE_NO_PRICE";
}

async function measureShop(job: Job, domain: string): Promise<ShopMeasure> {
  const base = { jobKey: job.jobKey, domain, termsTried: 0, hitTermIndex: null, hitTerm: null, candidates: [] };
  const adapter = findPriceSourceAdapter(domain, "DOMESTIC");
  if (!adapter) return { ...base, priceClass: "NO_ADAPTER", failureDetail: "registry 에 DOMESTIC 어댑터 없음" };

  const terms = job.query.searchTerms ?? [job.query.title];
  // 🔴 운영과 같은 사다리·같은 멈춤 조건(crossSellerVerdict==="SAME" 그리고
  //    자기참조 제외). 내가 멈춤 조건을 새로 만들지 않는다.
  const seen = new Set<string>();
  const collected: ComparisonCandidate[] = [];
  let hitIndex: number | null = null;
  let tried = 0;
  try {
    for (let i = 0; i < terms.length; i += 1) {
      tried += 1;
      const got = await adapter.search({ term: terms[i], currency: "KRW" });
      for (const c of withConfidence(job.query, got)) {
        if (seen.has(c.url)) continue;
        seen.add(c.url);
        collected.push(c);
        if (hitIndex === null) hitIndex = i;
      }
      const same = collected.some(
        (c) => c.crossSellerVerdict === "SAME" && !isSelfReferenceCandidate(job.query.sourceUrl ?? "", c.url),
      );
      if (same) break;
    }
  } catch (error) {
    return {
      ...base,
      termsTried: tried,
      priceClass: "ADAPTER_PARSER_FAILED",
      failureDetail: error instanceof Error ? `${error.name}: ${error.message}` : "unknown",
    };
  }

  const scored = [...collected].sort((a, b) => b.confidence - a.confidence);
  const enriched = adapter.enrichScored ? await adapter.enrichScored(scored) : scored;
  return {
    jobKey: job.jobKey,
    domain,
    hitTermIndex: hitIndex,
    hitTerm: hitIndex === null ? null : terms[hitIndex],
    termsTried: tried,
    priceClass: classifyPrice(enriched),
    failureDetail: null,
    candidates: enriched.map((c) => ({
      title: c.title,
      url: c.url,
      price: c.price,
      sku: c.sku ?? null,
      matchLevel: c.matchLevel ?? null,
      matchTruth: c.matchTruth ?? null,
      crossSellerVerdict: c.crossSellerVerdict ?? null,
      selfReference: isSelfReferenceCandidate(job.query.sourceUrl ?? "", c.url),
      soldOut: c.soldOut ?? null,
      priceStatus: c.priceStatus ?? null,
    })),
  };
}

/* ═════════════════ STEP G/H/I ═════════════════ */

/** 🔴 SAME 의 정의를 새로 만들지 않는다 — 기존 `crossSellerVerdict` 어휘 그대로. */
const SAME_VERDICTS = new Set(["SAME"]);

describe.skipIf(!LIVE)("🔴 MI-P0-02 STEP E~I — 국내 가격 owner 실측", () => {
  it(
    "DOMESTIC 어댑터 전수 × Golden 2 — 가격 5분류 · Identity · KPI",
    async () => {
      const jobs = buildJobs();
      const domains = domesticPriceSourceDomains();
      expect(domains).toHaveLength(8);

      const measures: ShopMeasure[] = [];
      for (const job of jobs) {
        for (const domain of domains) {
          const m = await measureShop(job, domain);
          measures.push(m);
          // eslint-disable-next-line no-console
          console.log(
            `${job.jobKey} · ${domain} → ${m.priceClass} · 후보 ${m.candidates.length} · 사다리 ${m.hitTermIndex ?? "-"}/${m.termsTried}${m.failureDetail ? ` · ${m.failureDetail}` : ""}`,
          );
        }
      }

      /* ── STEP G — Identity. 🔴 SIMILAR 를 SAME 으로 올리지 않는다 ── */
      const allCandidates = measures.flatMap((m) => m.candidates.map((c) => ({ ...c, domain: m.domain, jobKey: m.jobKey })));
      // 🔴 자기참조는 「외부 판매처를 찾았다」가 아니다 — 분모·분자에서 뺀다.
      const external = allCandidates.filter((c) => !c.selfReference);
      const identity = {
        total: external.length,
        SAME: external.filter((c) => c.crossSellerVerdict && SAME_VERDICTS.has(c.crossSellerVerdict)).length,
        PRESUMED_SAME: external.filter((c) => c.crossSellerVerdict === "PRESUMED_SAME").length,
        SIMILAR: external.filter((c) => c.crossSellerVerdict === "SIMILAR").length,
        CONFLICT: external.filter((c) => c.crossSellerVerdict === "CONFLICT").length,
        UNKNOWN: external.filter((c) => c.crossSellerVerdict === "UNKNOWN").length,
        /** 🔴 판정을 «시도하지 못한» 것. INSUFFICIENT_EVIDENCE ≠ NO_MATCH 와 같은 축이다. */
        NOT_JUDGED: external.filter((c) => c.crossSellerVerdict === null).length,
        selfReferenceExcluded: allCandidates.length - external.length,
      };

      /* ── STEP H/I — Verified Price + 핵심 KPI ── */
      const sameCandidates = external.filter((c) => c.crossSellerVerdict && SAME_VERDICTS.has(c.crossSellerVerdict));
      const sameWithPrice = sameCandidates.filter((c) => c.price != null && !!c.price.currency);
      const kpi = {
        name: "Domestic Same-Product Price Match Rate",
        분모_정의:
          "DOMESTIC 어댑터가 돌려준 후보 중 자기참조가 아니고 crossSellerVerdict==='SAME' 인 건수",
        분모: sameCandidates.length,
        분자_정의: "그중 price.amount 와 price.currency 가 «둘 다» 있는 건수",
        분자: sameWithPrice.length,
        // 🔴 분모 0 을 0% 로 적지 않는다 — 「측정 불가」와 「0%」는 다른 사실이다.
        rate: sameCandidates.length === 0 ? "측정불가(분모 0)" : `${Math.round((sameWithPrice.length / sameCandidates.length) * 100)}%`,
      };

      const priceTally: Record<string, number> = {};
      for (const m of measures) priceTally[m.priceClass] = (priceTally[m.priceClass] ?? 0) + 1;

      const report = {
        measuredAt: "호출부가 넣는다(이 하니스는 시간을 만들지 않는다)",
        jobs: jobs.map((j) => ({ jobKey: j.jobKey, basis: j.basis, searchTerms: j.query.searchTerms })),
        registry: { domesticDomains: domains, totalAdapters: listPriceSourceAdapters().length },
        skipped: ["domestic_price_sources.collectionStrategy 게이트(DB 없이 측정했다)"],
        priceTally,
        identity,
        kpi,
        measures,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      const outPath = path.join(OUT_DIR, "mi-p0-price-identity.json");
      writeFileSync(outPath, JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ priceTally, identity, kpi }, null, 2));
      // eslint-disable-next-line no-console
      console.log(`saved → ${outPath}`);

      // 🔴 결과 방향을 단언하지 «않는다». 단언하는 것은 「전수를 실제로 돌았다」뿐이다.
      expect(measures).toHaveLength(jobs.length * domains.length);
      expect(measures.every((m) => m.priceClass !== "NO_ADAPTER")).toBe(true);
    },
    30 * 60 * 1000,
  );
});
