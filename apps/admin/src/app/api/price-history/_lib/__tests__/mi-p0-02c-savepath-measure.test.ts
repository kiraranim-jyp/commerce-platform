/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-02c ②③⑤⑥⑦⑧ (CPO 지시, 2026-10-11)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 실제 판매처에 요청한다.
 *
 * MI-P0-02b 는 **실시간 라우트** 의 `matchTruth` 까지 쟀다. 이번엔 **Master 가격
 * 사다리**(`runDomesticPriceCheck`)의 최종 owner 까지 간다:
 *
 *     ⑦ priceTierFromLink → EXACT · COMPARISON · REFERENCE · EXCLUDED
 *
 * 🔴 그 앞에 **라우트에는 없는 게이트 둘** 이 있다:
 *       Gate 1  isEvidenceEvaluationWorthwhile   false → 링크 «없음»
 *       Gate 2  matchType === NOT_MATCHED         → 링크 «없음»
 *    그리고 샵당 **대표 1건** 만 링크가 된다(selectDomesticCandidate).
 *    그래서 두 경로의 KPI 분모가 구조적으로 다르다 — 섞어 쓰면 거짓 보고가 된다.
 *
 * 🔴 **합성을 재구현하지 않는다.** `judgeDomesticCandidate` 를 부른다 — 그것이
 *    `runDomesticPriceCheck` 가 부르는 바로 그 함수다(사본이 아니다).
 *
 * ── 🔴 이 측정이 «대체» 한 것 ───────────────────────────────────────────────
 * ① `domestic_price_sources` DB 미사용 — registry DOMESTIC 8곳을 AUTO_SCRAPE/KRW
 *    로 세웠다. 운영에서 꺼진 소스·scope 밖 소스가 섞여 있다 → 후보가 운영보다
 *    «많을» 수 있다(적을 수는 없다).
 * ② `input.dna` 는 운영에서 **Master 행** 에서 온다. 여기서는 route 와 같은
 *    `identityDnaFromFields` 로 만든다 — 🔴 그래서 `imageUrls` 가 비고
 *    `category` 가 null 이다. Vision 경로는 애초에 이 함수 뒤에 있어 영향 없지만,
 *    사다리 칸 수가 운영 Master 경로보다 «적을» 수 있다. 사실로 적는다.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractForeignModelCode,
  listPriceSourceAdapters,
  searchDomesticShops,
  type ComparisonSearchResult,
  type DomesticSourceRef,
} from "@commerce/crawler";
import { buildCrossSellerSearchQueries, identityDnaFromFields, productFactsFromIdentityDna } from "@commerce/shared";
import { extractModelCodeFromSourceUrl } from "../../../domestic-price-sources/_lib/attach-match-truth";
import { judgeDomesticCandidate } from "../run-domestic-price-check";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(os.tmpdir(), "mi-p0-02");
const FIXTURES = path.join(
  __dirname, "..", "..", "..", "..", "..", "..", "..", "..",
  "packages", "crawler", "src", "__tests__", "fixtures",
);

function shopifyDescription(file: string): string {
  const raw = JSON.parse(readFileSync(path.join(FIXTURES, file), "utf8")) as { description?: string };
  return String(raw.description ?? "");
}

interface JobInput {
  jobKey: string;
  basis: string;
  title: string;
  brand: string;
  sourceUrl: string;
  color?: string;
  sku?: string;
  description: string;
}

function buildJobs(): JobInput[] {
  return [
    {
      jobKey: "JOB-JE-MAINSTORY",
      basis: "fixtures/junioredition-…-by-main-story.json — description 에 「Product code AW26MS185」",
      title: "Bubble Sweatshirt in Grey Melange by Main Story",
      brand: "Main Story",
      sourceUrl: "https://www.junioredition.com/en-kr/products/bubble-sweatshirt-in-grey-melange-by-main-story",
      color: "Grey Melange",
      description: shopifyDescription("junioredition-bubble-sweatshirt-in-grey-melange-by-main-story.json"),
    },
    {
      jobKey: "JOB-BOBO-B226AC114",
      basis: "fixtures/bobochoses-b226ac114.json — description 에 코드 없음 → sourceUrl 폴백",
      title: "Bobo Choses Bolder half zipped sweatshirt",
      brand: "Bobo Choses",
      sourceUrl: "https://bobochoses.com/products/b226ac114-bobo-choses-bolder-half-zipped-sweatshirt",
      description: shopifyDescription("bobochoses-b226ac114.json"),
    },
    /**
     * 🔴 MI-P0-02c ③ — Smallable JOB-C. 전부 fixture JSON-LD 실측값이다
     *    (`smallable-430632-product.html`):
     *      name   All About Monsters Washed T-shirt Organic cotton | Blue
     *      sku    AAA1804532     ← 🔴 Smallable «자체» 재고번호다
     *      brand  Bobo Choses     color Blue
     *      mpn    없음            gtin  없음   ← 🔴 브랜드 품번이 JSON-LD 에 «없다»
     *      desc   "SIZE AND FIT … COMPOSITION 100% Organic Cotton …"
     *             ← 🔴 「Product code」 표기가 «없다»
     *
     * 🔴 그래서 `foreignModelCode` 는 null 이 될 것이다 — `extractForeignModelCode`
     *    가 설명문에서 못 찾고, smallable.com 은 추출기 레지스트리에 없다.
     *    **SKU 를 model/reference 로 승격하지 않는다**(CPO 금지). null 을 null 로
     *    측정하고, 그것이 False Negative 의 «구조적» 원인이라고 적는다.
     */
    {
      jobKey: "JOB-SMALLABLE-430632",
      basis: "fixtures/smallable-430632-product.html JSON-LD 실측 (mpn·gtin 없음 · desc 에 Product code 없음)",
      title: "All About Monsters Washed T-shirt Organic cotton | Blue",
      brand: "Bobo Choses",
      sourceUrl:
        "https://www.smallable.com/en/product/all-about-monsters-washed-t-shirt-organic-cotton-blue-bobo-choses-430632",
      color: "Blue",
      sku: "AAA1804532",
      description: "  SIZE AND FIT    Loose fit    COMPOSITION    100% Organic Cotton    Find out more    Wash Cold-30",
    },
  ];
}

/** 🔴 DB 대체. registry 를 호출해 만든다 — 목록을 손으로 적지 않는다. */
function domesticSources(): DomesticSourceRef[] {
  return listPriceSourceAdapters()
    .filter((a) => a.catalog === "DOMESTIC")
    .map((a) => ({ id: a.domain, name: a.domain, domain: a.domain, currency: "KRW", collectionStrategy: "AUTO_SCRAPE" as const }));
}

describe.skipIf(!LIVE)("🔴 MI-P0-02c — 저장경로 최종 owner(priceTierFromLink)까지 측정", () => {
  it(
    "judgeDomesticCandidate 전수 × Golden 3 — 게이트·tier·KPI",
    async () => {
      const sources = domesticSources();
      expect(sources).toHaveLength(8);

      const rows: Record<string, unknown>[] = [];
      const perJob: Record<string, unknown>[] = [];

      for (const job of buildJobs()) {
        const dna = identityDnaFromFields({
          title: job.title,
          brand: job.brand,
          sku: job.sku,
          sourceUrl: job.sourceUrl,
          color: job.color,
        });
        const searchTerms = buildCrossSellerSearchQueries(dna);
        const results: ComparisonSearchResult[] = await searchDomesticShops(
          {
            title: job.title,
            brand: job.brand,
            sourceUrl: job.sourceUrl,
            sku: job.sku,
            description: job.description,
            searchTerm: searchTerms[0] ?? job.title,
            searchTerms,
            facts: productFactsFromIdentityDna(dna),
          },
          sources,
        );
        const foreignModelCode =
          extractForeignModelCode(job.description) ?? (await extractModelCodeFromSourceUrl(job.sourceUrl));

        for (const result of results) {
          if (result.status !== "ok") {
            rows.push({ jobKey: job.jobKey, domain: result.domain, outcome: `SHOP_${result.status.toUpperCase()}` });
            continue;
          }
          // 🔴 운영이 부르는 그 함수. 합성을 재구현하지 않는다.
          const j = await judgeDomesticCandidate({
            domain: result.domain,
            candidates: result.candidates,
            sourceUrl: job.sourceUrl,
            foreignModelCode,
            foreignColor: dna.color ?? null,
            // 🔴 운영과 같은 추출기. 네트워크를 쓰는 경로도 그대로 돈다.
            fetchModelCode: async (url) => {
              const { fetchDomesticModelCode } = await import("@commerce/crawler");
              return fetchDomesticModelCode(result.domain, url);
            },
          });
          const base = {
            jobKey: job.jobKey,
            domain: result.domain,
            rawCandidates: result.candidates.length,
            selfReferenceExcluded: j.selfReferenceExcluded,
            querySource: result.querySource ?? null,
          };
          if (j.kind === "NO_CANDIDATES") {
            rows.push({ ...base, outcome: "NO_CANDIDATES" });
          } else if (j.kind === "DROPPED") {
            rows.push({
              ...base,
              outcome: `DROPPED_${j.gate}`,
              observedTitle: j.observed.candidate.title,
              observedMatchLevel: j.observed.candidate.matchLevel ?? null,
              observedCrossSeller: j.observed.candidate.crossSellerVerdict ?? null,
              modelCodeEvidence: j.observed.modelCodeEvidence,
              initialMatchType: j.observed.initialMatchType,
            });
          } else {
            rows.push({
              ...base,
              outcome: "JUDGED",
              title: j.best.title,
              url: j.best.url,
              price: j.best.price,
              matchType: j.matchType,
              verified: j.verified,
              matchTruth: j.matchTruth,
              // 🔴🔴 최종 owner 의 값
              priceTier: j.priceTier,
              modelCodeEvidence: j.modelCodeEvidence,
              domesticModelCode: j.domesticModelCode,
              crossSellerVerdict: j.best.crossSellerVerdict ?? null,
            });
          }
          // eslint-disable-next-line no-console
          console.log(
            `${job.jobKey} · ${result.domain.padEnd(18)} → ${String(rows[rows.length - 1].outcome).padEnd(30)}` +
              (j.kind === "JUDGED" ? ` tier=${j.priceTier} truth=${j.matchTruth} verified=${j.verified}` : ""),
          );
        }

        perJob.push({
          jobKey: job.jobKey,
          basis: job.basis,
          foreignModelCode,
          foreignModelCodeSource: extractForeignModelCode(job.description)
            ? "description"
            : foreignModelCode
              ? "sourceUrl"
              : "🔴 없음(둘 다 실패)",
          searchTerms,
          ladderRungs: searchTerms.length,
        });
      }

      /* ── ⑦ KPI — 🔴 분모는 최종 owner 가 정한다 ── */
      const judged = rows.filter((r) => r.outcome === "JUDGED");
      const exact = judged.filter((r) => r.priceTier === "EXACT");
      const exactPriced = exact.filter((r) => {
        const p = r.price as { amount?: number; currency?: string } | null;
        return p != null && p.amount != null && !!p.currency;
      });
      const kpi = {
        name: "Domestic Same-Product Price Match Rate (저장경로 · 최종 owner)",
        owner: "priceTierFromLink({matchTruth, verified})",
        분모_정의:
          "자기참조 제외 · Gate1(worthwhile) 통과 · Gate2(NOT_MATCHED 아님) 통과 · 샵당 대표 1건 · priceTier === 'EXACT'",
        분모: exact.length,
        분자_정의: "그중 price.amount «그리고» price.currency 가 둘 다 있는 건수",
        분자: exactPriced.length,
        // 🔴 분모 0 을 0% 로 적지 않는다.
        rate: exact.length === 0 ? "측정불가(분모 0)" : `${Math.round((exactPriced.length / exact.length) * 100)}%`,
      };

      const outcomeTally: Record<string, number> = {};
      for (const r of rows) outcomeTally[String(r.outcome)] = (outcomeTally[String(r.outcome)] ?? 0) + 1;
      const tierTally: Record<string, number> = {};
      for (const r of judged) tierTally[String(r.priceTier)] = (tierTally[String(r.priceTier)] ?? 0) + 1;

      const report = {
        substituted: [
          "domestic_price_sources DB 미사용 — registry DOMESTIC 8곳을 AUTO_SCRAPE/KRW 로 세웠다",
          "input.dna 를 Master 가 아니라 identityDnaFromFields 로 만들었다 — imageUrls 빈 배열 · category null",
          "🔴 그래서 사다리 칸 수가 운영 Master 경로보다 적을 수 있다",
        ],
        perJob,
        outcomeTally,
        tierTally,
        kpi,
        rows,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "mi-p0-02c-savepath.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ perJob, outcomeTally, tierTally, kpi }, null, 2));

      // 🔴 결과 방향을 단언하지 않는다. 전수를 실제로 돌았다는 것만 단언한다.
      expect(perJob).toHaveLength(3);
      expect(rows.length).toBeGreaterThanOrEqual(8 * 3 - 4);
    },
    30 * 60 * 1000,
  );
});
