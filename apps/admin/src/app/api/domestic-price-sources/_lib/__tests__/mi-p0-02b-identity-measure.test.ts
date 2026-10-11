/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-02b (CPO 지시, 2026-10-11) — **운영 사슬 «전체» 로 Identity 를 다시 잰다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 실제 판매처에 요청한다.
 *
 * ── 🔴 왜 다시 재는가 — 앞 측정이 «입력» 을 «결과» 로 보고했다 ──────────────
 * MI-P0-02 STEP G 는 `withConfidence()` 까지만 돌리고 `crossSellerVerdict` 를
 * Identity 결과로 적었다. 그래서 「SAME 0」이라고 보고했다. **그 값은 최종 판정이
 * 아니다** — `deriveMatchTruth` 의 여섯 인자 중 **하나** 다. 운영의 최종 판정은
 * `matchTruth` 이고, 그것을 만드는 합성은 `search/route.ts` 안에 있었다.
 *
 * 그래서 앞 측정은 **두 가지를 아예 돌리지 않았다**:
 *
 *     ① `lookupBrandAlias` 폴백
 *        `searchOneDomesticShop`(index.ts) 안에 있다. 사다리가 0건이면 브랜드
 *        한글 alias(「메인스토리」)로 재검색한다. 하니스가 `adapter.search()` 를
 *        직접 불러서 이 폴백을 건너뛰었다 — littleluna·deuxbebe 는 영문 질의에
 *        0건이고 한글에만 반응한다(실측). 그래서 「후보 없음 12/16」이 과대였다.
 *     ② `confirmBrandCodeInTitle` → `compareModelCode` → `deriveMatchTruth`
 *        식별자 축 «전체». 그래서 앞 측정의 `matchTruth` 가 전건 null 이었고,
 *        그 null 을 「미판정」으로만 적고 원인을 짚지 못했다.
 *
 * 🔴 이번에는 **운영 함수를 부른다.** `searchDomesticShops`(폴백 포함) 와
 *    `attachMatchTruth`(식별자 축 포함) 둘 다 운영이 쓰는 그 함수다.
 *    합성을 재구현하지 않는다 — 그러면 expected 와 actual 을 같은 손으로 만드는
 *    circular test 가 된다(MI-P0-02 금지 ⑥).
 *
 * ── 🔴 이 측정이 «대체» 한 것 (사실로 적는다) ───────────────────────────────
 * `domestic_price_sources` DB 를 읽지 않는다. 운영은 그 테이블에서
 * `currency`·`collectionStrategy`·활성 여부·카테고리 scope 를 가져온다. 여기서는
 * registry 의 DOMESTIC 8곳을 `AUTO_SCRAPE`/`KRW` 로 세워 넣는다.
 * 🔴 그래서 **「운영에서 꺼져 있는 소스」와 「scope 밖 소스」는 이 측정에 섞여 있다.**
 *    후보 수가 운영보다 «많을» 수 있다 — 적을 수는 없다.
 */
import { readFileSync } from "node:fs";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  confirmBrandCodeInTitle,
  extractForeignModelCode,
  listPriceSourceAdapters,
  searchDomesticShops,
  type ComparisonSearchResult,
  type DomesticSourceRef,
} from "@commerce/crawler";
import { buildCrossSellerSearchQueries, identityDnaFromFields, productFactsFromIdentityDna } from "@commerce/shared";
import { attachMatchTruth, extractModelCodeFromSourceUrl } from "../attach-match-truth";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(os.tmpdir(), "mi-p0-02");
const FIXTURES = path.join(
  __dirname,
  "..", "..", "..", "..", "..", "..", "..", "..",
  "packages", "crawler", "src", "__tests__", "fixtures",
);

/** 🔴 운영이 SAME 으로 취급하는 등급. 새 어휘를 만들지 않는다 —
 *  p54c-google-discovery.test.ts:108 의 `IS_SAME` 과 같은 정의다. */
const SAME_TRUTHS = new Set(["EXACT_IDENTIFIER", "STRONG_IDENTIFIER"]);

interface JobInput {
  jobKey: string;
  basis: string;
  title: string;
  brand: string;
  sourceUrl: string;
  color?: string;
  sku?: string;
  /** 🔴 fixture 의 실제 description. 여기서 「Product code …」를 읽는다. */
  description: string;
}

function fixtureDescription(file: string): string {
  const raw = JSON.parse(readFileSync(path.join(FIXTURES, file), "utf8")) as { description?: string };
  return String(raw.description ?? "");
}

function buildJobs(): JobInput[] {
  return [
    {
      jobKey: "JOB-JE-MAINSTORY",
      basis: "fixtures/junioredition-bubble-sweatshirt-…-by-main-story.json — description 에 「Product code AW26MS185」",
      title: "Bubble Sweatshirt in Grey Melange by Main Story",
      brand: "Main Story",
      sourceUrl: "https://www.junioredition.com/en-kr/products/bubble-sweatshirt-in-grey-melange-by-main-story",
      color: "Grey Melange",
      description: fixtureDescription("junioredition-bubble-sweatshirt-in-grey-melange-by-main-story.json"),
    },
    {
      jobKey: "JOB-BOBO-B226AC114",
      // 🔴 이쪽은 description 에 코드 표기가 «없다» — sourceUrl 폴백 경로를 탄다.
      //    두 갈래를 둘 다 실제로 돌리는 것이 이 측정의 일부다.
      basis: "fixtures/bobochoses-b226ac114.json — description 에 코드 없음 → sourceUrl 폴백",
      title: "Bobo Choses Bolder half zipped sweatshirt",
      brand: "Bobo Choses",
      sourceUrl: "https://bobochoses.com/products/b226ac114-bobo-choses-bolder-half-zipped-sweatshirt",
      description: fixtureDescription("bobochoses-b226ac114.json"),
    },
  ];
}

/** 🔴 DB 대체. registry 를 호출해 만든다 — 목록을 손으로 적지 않는다. */
function domesticSources(): DomesticSourceRef[] {
  return listPriceSourceAdapters()
    .filter((a) => a.catalog === "DOMESTIC")
    .map((a) => ({
      id: a.domain,
      name: a.domain,
      domain: a.domain,
      currency: "KRW",
      collectionStrategy: "AUTO_SCRAPE" as const,
    }));
}

describe.skipIf(!LIVE)("🔴 MI-P0-02b — 운영 사슬 전체로 Identity 재측정", () => {
  it(
    "searchDomesticShops(폴백 포함) + attachMatchTruth(식별자 축 포함)",
    async () => {
      const sources = domesticSources();
      expect(sources).toHaveLength(8);

      const perJob: Record<string, unknown>[] = [];
      const allCandidates: Record<string, unknown>[] = [];

      for (const job of buildJobs()) {
        // ── 운영 route 와 «같은 순서» ──────────────────────────────────────
        const dna = identityDnaFromFields({
          title: job.title,
          brand: job.brand,
          sku: job.sku,
          sourceUrl: job.sourceUrl,
          color: job.color,
        });
        const searchTerms = buildCrossSellerSearchQueries(dna);
        const rawResults: ComparisonSearchResult[] = await searchDomesticShops(
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
        // 🔴 두 갈래 전부 — description 먼저, 없으면 sourceUrl.
        const foreignModelCode =
          extractForeignModelCode(job.description) ?? (await extractModelCodeFromSourceUrl(job.sourceUrl));
        const results = await attachMatchTruth(rawResults, foreignModelCode, dna.color ?? null);

        const flat = results.flatMap((r) =>
          r.candidates.map((c) => ({
            jobKey: job.jobKey,
            domain: r.domain,
            status: r.status,
            querySource: r.querySource ?? null,
            title: c.title,
            url: c.url,
            price: c.price,
            sku: c.sku ?? null,
            matchLevel: c.matchLevel ?? null,
            crossSellerVerdict: c.crossSellerVerdict ?? null,
            /** 🔴 운영 최종 판정. 앞 측정이 놓친 칸이다. */
            matchTruth: c.matchTruth ?? null,
            /** ③ — 한글/혼합 제목에서 브랜드 품번이 «확인되는가». */
            titleCodeConfirmed: confirmBrandCodeInTitle(foreignModelCode, c.title),
          })),
        );
        allCandidates.push(...flat);

        perJob.push({
          jobKey: job.jobKey,
          basis: job.basis,
          foreignModelCode,
          foreignModelCodeSource: extractForeignModelCode(job.description) ? "description" : "sourceUrl",
          searchTerms,
          shopStatuses: results.map((r) => ({
            domain: r.domain,
            status: r.status,
            n: r.candidates.length,
            // 🔴 「별칭 폴백으로 찾았다」를 사실로 남긴다 — 앞 측정이 건너뛴 경로다.
            querySource: r.querySource ?? null,
          })),
        });
        // eslint-disable-next-line no-console
        console.log(
          `${job.jobKey} · foreignModelCode=${foreignModelCode} · 후보 ${flat.length} · ` +
            `품번확인 ${flat.filter((c) => c.titleCodeConfirmed).length} · ` +
            `SAME ${flat.filter((c) => c.matchTruth && SAME_TRUTHS.has(String(c.matchTruth))).length}`,
        );
      }

      /* ── ③ 한글 제목 품번 확인율 ── */
      const titleCode = {
        분모_정의: "attachMatchTruth 를 통과한 국내 후보 전체",
        분모: allCandidates.length,
        분자_정의: "confirmBrandCodeInTitle 이 해외 품번을 제목에서 «확인» 한 건수",
        분자: allCandidates.filter((c) => c.titleCodeConfirmed).length,
        확인된_도메인: [
          ...new Set(allCandidates.filter((c) => c.titleCodeConfirmed).map((c) => String(c.domain))),
        ],
      };

      /* ── 핵심 KPI 재계산 — 🔴 이번엔 matchTruth 로 ── */
      const truthTally: Record<string, number> = {};
      for (const c of allCandidates) {
        const k = c.matchTruth === null ? "NULL(미판정)" : String(c.matchTruth);
        truthTally[k] = (truthTally[k] ?? 0) + 1;
      }
      const same = allCandidates.filter((c) => c.matchTruth && SAME_TRUTHS.has(String(c.matchTruth)));
      const samePriced = same.filter((c) => {
        const p = c.price as { amount?: number; currency?: string } | null;
        return p != null && p.amount != null && !!p.currency;
      });
      const kpi = {
        name: "Domestic Same-Product Price Match Rate (운영 사슬 전체)",
        분모_정의: "국내 후보 중 matchTruth ∈ {EXACT_IDENTIFIER, STRONG_IDENTIFIER}",
        분모: same.length,
        분자_정의: "그중 price.amount «그리고» price.currency 가 둘 다 있는 건수",
        분자: samePriced.length,
        rate:
          same.length === 0
            ? "측정불가(분모 0)"
            : `${Math.round((samePriced.length / same.length) * 100)}%`,
      };

      const report = {
        substituted: [
          "domestic_price_sources DB 미사용 — registry DOMESTIC 8곳을 AUTO_SCRAPE/KRW 로 세웠다",
          "운영에서 꺼진 소스·scope 밖 소스가 섞여 있다 → 후보 수가 운영보다 많을 수 있다",
        ],
        perJob,
        titleCode,
        truthTally,
        kpi,
        candidates: allCandidates,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "mi-p0-02b-identity.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ titleCode, truthTally, kpi }, null, 2));

      // 🔴 결과 방향을 단언하지 않는다. 운영 사슬이 «실제로 돌았다» 만 단언한다.
      expect(perJob).toHaveLength(2);
      for (const j of perJob) {
        expect(j.foreignModelCode, `${String(j.jobKey)} 의 품번이 비었다 — 측정이 성립하지 않는다`).toBeTruthy();
      }
    },
    30 * 60 * 1000,
  );
});

/* ═══════════════ ③ 한글 질의로 품번이 «확인되는가» ═══════════════ */

/**
 * 🔴 위 측정에서 「한글 제목 품번 확인 0/18」이 나왔다. 그 숫자를
 *    「`confirmBrandCodeInTitle` 이 한글에서 실패한다」로 읽으면 **틀린다.**
 *
 * 품번을 제목에 적는 판매처(littleluna · deuxbebe, domestic-identifiers.ts 주석의
 * 실측)가 후보를 **0건** 돌려줬다. 그 둘은 영문 질의에 0건이고 한글에만 반응한다.
 * 운영에서 한글로 바꾸는 경로는 `lookupBrandAlias` 하나뿐이고 `BRAND_ALIASES` 는
 * **3개** 다 — Pèpè Shoes · Emile et Ida · Konges Slojd Clothing.
 * 「Main Story」·「Bobo Choses」는 **둘 다 없다** → 폴백이 발화하지 않는다.
 *
 * 즉 품번 축은 **비교에 실패한 것이 아니라 비교할 기회가 없었다.**
 *
 * 🔴 이 테스트는 **등록을 하지 않는다.** `brand-alias.ts` 는 「실측으로 동일 브랜드
 *    후보가 돌아오는 것이 확인된 표기만 · 오탐 0 · 추론/번역 금지」를 요구한다.
 *    그 요건을 «재는» 것까지가 CTO 의 일이고, 등록 여부는 CPO 판정이다.
 */
describe.skipIf(!LIVE)("🔴 MI-P0-02b ③ — 한글 alias 후보를 실측한다(등록은 하지 않는다)", () => {
  it(
    "alias 질의가 품번이 확인되는 후보를 실제로 돌려주는가",
    async () => {
      const probes = [
        { brand: "Main Story", alias: "메인스토리", foreignModelCode: "AW26MS185" },
        { brand: "Bobo Choses", alias: "보보쇼즈", foreignModelCode: "B226AC114" },
      ];
      const rows: Record<string, unknown>[] = [];

      for (const p of probes) {
        for (const adapter of listPriceSourceAdapters().filter((a) => a.catalog === "DOMESTIC")) {
          let got: { title: string; url: string; price: { amount: number; currency: string } | null }[] = [];
          let error: string | null = null;
          try {
            // 🔴 alias 단독. brand-alias.ts 가 쓰는 폴백 1차 질의와 같은 모양이다.
            got = await adapter.search({ term: p.alias, currency: "KRW" });
          } catch (e) {
            error = e instanceof Error ? `${e.name}: ${e.message}` : "unknown";
          }
          const confirmed = got.filter((c) => confirmBrandCodeInTitle(p.foreignModelCode, c.title) !== null);
          rows.push({
            brand: p.brand,
            alias: p.alias,
            domain: adapter.domain,
            error,
            returned: got.length,
            /** 🔴 핵심 — 이 판매처가 제목에 브랜드 품번을 적는가. */
            codeConfirmed: confirmed.length,
            confirmedTitles: confirmed.map((c) => c.title),
            sampleTitles: got.slice(0, 3).map((c) => c.title),
          });
          // eslint-disable-next-line no-console
          console.log(
            `${p.alias} @ ${adapter.domain.padEnd(18)} → ${String(got.length).padStart(3)}건 · 품번확인 ${confirmed.length}${error ? ` · ${error}` : ""}`,
          );
        }
      }

      const summary = {
        /** 🔴 「후보가 왔다」와 「품번이 확인됐다」를 가른다 — 전자는 오탐일 수 있다. */
        aliasReturnsCandidates: rows.filter((r) => Number(r.returned) > 0).length,
        aliasConfirmsCode: rows.filter((r) => Number(r.codeConfirmed) > 0).length,
        byDomain: rows
          .filter((r) => Number(r.returned) > 0)
          .map((r) => `${String(r.alias)}@${String(r.domain)}=${String(r.returned)}건/품번${String(r.codeConfirmed)}`),
        registrationRequirement:
          "brand-alias.ts 요건 = 실측 후보 반환 «그리고» 오탐 0. 오탐 판정은 품번 확인으로만 하지 않는다 — 품번이 없어도 동일상품일 수 있다(CPO 판정 필요)",
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "mi-p0-02b-alias-probe.json"), JSON.stringify({ summary, rows }, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(summary, null, 2));

      expect(rows).toHaveLength(probes.length * 8);
    },
    30 * 60 * 1000,
  );
});
