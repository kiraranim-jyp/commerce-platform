/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-02 STEP C/D — **실측 하니스.** Gemini 를 실제로 부른다.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값은 **SKIP** 이다. `MI_P0_02_LIVE=1` 일 때만 돈다 — 회귀 스위트가
 *    매번 Gemini 에 과금되게 만들지 않는다.
 * 🔴 `GEMINI_API_KEY` 는 `scripts/.env` 에 있고 **vitest 가 자동 로드하지 않는다**.
 *    이 파일이 직접 읽는다(이 함정에 이미 한 번 걸렸다).
 * 🔴 **캐시를 쓰지 않는다.** arm 둘을 같은 쿼리로 각각 실제 호출한다 — 한쪽을
 *    저장된 결과로 대체하면 A/B 가 아니라 과거와 현재의 비교가 된다.
 *
 * 측정 결과는 scratchpad 에 **원문 그대로** 저장한다(replay-dataset.ts 의 교훈:
 * 보고용으로 자른 문자열이 측정 데이터로 복구된 사고가 있었다).
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createGoogleDiscoveryProvider } from "../google-discovery";
import { generateQueries } from "../query-generator";
import { matchSupportedDomain, priceSourceCoverage, supportedPriceSourceDomains } from "../supported-sellers";
import type { DiscoveredUrl, ProductIdentity, QueryId } from "../types";

const LIVE = process.env.MI_P0_02_LIVE === "1";
/** 🔴 기본값을 리포 안으로 두지 않는다 — 측정 산출물이 git 에 섞인다. */
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(os.tmpdir(), "mi-p0-02");
const REPO_ROOT = path.join(__dirname, "..", "..", "..", "..", "..");

/** 🔴 `scripts/.env` 를 직접 읽는다. 값은 로그에 절대 출력하지 않는다. */
function loadGeminiKey(): void {
  if (process.env.GEMINI_API_KEY?.trim()) return;
  const envPath = path.join(REPO_ROOT, "scripts", ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const hit = /^\s*GEMINI_API_KEY\s*=\s*(.+?)\s*$/.exec(line);
    if (hit) process.env.GEMINI_API_KEY = hit[1].replace(/^["']|["']$/g, "");
  }
}

/* ───────────────────────── Golden 3 (전부 실측 fixture 기반) ───────────────────────── */

/**
 * 🔴 손으로 지어낸 identity 를 쓰지 않는다. 세 건 전부 이 저장소의 실측 근거가
 *    있다 — fixture 파일 또는 Production DB 에서 읽은 값이다.
 */
const JOBS: { jobKey: string; basis: string; identity: ProductIdentity }[] = [
  {
    jobKey: "JOB-JE-MAINSTORY",
    basis: "Production DB (p54c-google-discovery.test.ts:44 와 같은 값)",
    identity: {
      brand: "Main Story",
      productName: "Bubble Sweatshirt",
      productType: "Sweatshirt",
      genderAge: null,
      color: "Grey Melange",
      size: null,
      season: "AW26",
      productCode: "AW26MS185",
      sourceUrl: "https://www.junioredition.com/en-kr/products/bubble-sweatshirt-in-grey-melange-by-main-story",
      sourceSite: "junioredition.com",
      sourceCountry: "GB",
      market: "GB",
    },
  },
  {
    jobKey: "JOB-BOBO-B226AC114",
    basis: "fixtures/bobochoses-b226ac114.json (title·handle 실측)",
    identity: {
      brand: "Bobo Choses",
      productName: "Bolder half zipped sweatshirt",
      productType: "Sweatshirts",
      genderAge: null,
      // 🔴 fixture 의 title·options 어디에도 색상이 없다. 지어내지 않고 null 로 둔다
      //    → Q3·Q4 는 «물어보지 못한» 축이 된다(SEARCH_QUERY_MISS 가 아니다).
      color: null,
      size: null,
      season: "AW26",
      productCode: "B226AC114",
      sourceUrl: "https://bobochoses.com/products/b226ac114-bobo-choses-bolder-half-zipped-sweatshirt",
      sourceSite: "bobochoses.com",
      sourceCountry: "ES",
      market: "ES",
    },
  },
  {
    jobKey: "JOB-SMALLABLE-430632",
    basis: "fixtures/smallable-430632-product.html (canonical·JSON-LD 실측)",
    identity: {
      brand: "Bobo Choses",
      productName: "All About Monsters Washed T-shirt Organic cotton",
      productType: "T-shirt",
      genderAge: "Boy",
      color: "Blue",
      size: null,
      season: null,
      // 🔴 Smallable 이 JSON-LD `sku` 로 선언한 값이다. 브랜드 품번이 «아니다» —
      //    사이트 품번이다(Owner Mapping: site article code → candidate.sku).
      productCode: "AAA1804532",
      sourceUrl:
        "https://www.smallable.com/en/product/all-about-monsters-washed-t-shirt-organic-cotton-blue-bobo-choses-430632",
      sourceSite: "smallable.com",
      sourceCountry: "FR",
      market: "FR",
    },
  },
];

/** 🔴 측정 축을 셋으로 고정한다 — 8축 전부면 Gemini 호출이 48회가 되고, 축을
 *  늘리는 것이 이번 질문(whitelist 효과)의 답을 더 정확하게 만들지 않는다.
 *  고른 근거: Q2 는 실측에서 가장 강했고, Q4 는 색상축(Shopify suggest 상한
 *  회피), Q6 는 품번축(국내 후보가 죽는 지점)이다. */
const AXES: QueryId[] = ["Q2", "Q4", "Q6"];

interface ArmRecord {
  arm: "OFF" | "ON";
  jobKey: string;
  queryId: QueryId;
  queryText: string;
  /** 🔴 호출 결과 분류. 「0 후보」와 실패를 섞지 않는다. */
  outcome: "OK" | "API_FAILURE" | "CONFIG_MISSING";
  failureDetail: string | null;
  discovered: DiscoveredUrl[];
  /** webTitle 에서 읽은 registry 적중 — 🔴 probe 전 유일한 신호다. */
  supportedTitleHits: string[];
}

function titleHits(discovered: DiscoveredUrl[], domains: string[]): string[] {
  const hits: string[] = [];
  for (const d of discovered) {
    if (!d.title) continue;
    // 🔴 실측: grounding 의 web.title 은 상품명이 아니라 «도메인» 이다
    //    (replay-dataset.ts:32). 그래서 호스트처럼 취급해 매칭한다.
    const hit = matchSupportedDomain(d.title.trim(), domains);
    if (hit) hits.push(hit);
  }
  return hits;
}

async function runArm(arm: "OFF" | "ON", domains: string[]): Promise<ArmRecord[]> {
  const out: ArmRecord[] = [];
  for (const job of JOBS) {
    const queries = generateQueries(job.identity).filter((q) => AXES.includes(q.id));
    for (const query of queries) {
      // 🔴 arm 마다 provider 를 새로 만든다 — usage 누적이 arm 간에 섞이지 않게.
      const provider = createGoogleDiscoveryProvider({
        // 🔴 OFF arm 은 `[]` 를 **명시** 한다. 생략하면 registry 가 기본으로 들어가
        //    대조군이 사라진다(google-discovery.ts 의 resolvePreferred 주석).
        preferredDomains: arm === "OFF" ? [] : domains,
      });
      let record: ArmRecord = {
        arm,
        jobKey: job.jobKey,
        queryId: query.id,
        queryText: query.text,
        outcome: "OK",
        failureDetail: null,
        discovered: [],
        supportedTitleHits: [],
      };
      try {
        const discovered = await provider.discover(job.identity, query);
        record = { ...record, discovered, supportedTitleHits: titleHits(discovered, domains) };
      } catch (error) {
        const name = error instanceof Error ? error.name : "unknown";
        record = {
          ...record,
          outcome: name === "GoogleDiscoveryConfigError" ? "CONFIG_MISSING" : "API_FAILURE",
          failureDetail: error instanceof Error ? error.message : "unknown",
        };
      }
      out.push(record);
      // eslint-disable-next-line no-console
      console.log(
        `[${arm}] ${job.jobKey} ${query.id} → ${record.outcome} · ${record.discovered.length}건 · registry적중 ${record.supportedTitleHits.length}건 ${record.supportedTitleHits.join(",")}`,
      );
    }
  }
  return out;
}

describe.skipIf(!LIVE)("🔴 MI-P0-02 STEP C — Gemini 실측 A/B (whitelist OFF vs ON)", () => {
  it(
    "arm 둘을 같은 쿼리로 실제 호출하고 원문을 저장한다",
    async () => {
      loadGeminiKey();
      const domains = supportedPriceSourceDomains();
      const coverage = priceSourceCoverage();
      // eslint-disable-next-line no-console
      console.log(`registry: ${JSON.stringify(coverage)}`);
      expect(domains.length).toBe(coverage.total);

      const off = await runArm("OFF", domains);
      const on = await runArm("ON", domains);

      mkdirSync(OUT_DIR, { recursive: true });
      const outPath = path.join(OUT_DIR, "mi-p0-whitelist-candidates.json");
      writeFileSync(
        outPath,
        // 🔴 URL 을 자르지 않는다. 원문 그대로 저장한다.
        JSON.stringify({ coverage, whitelist: domains, axes: AXES, jobs: JOBS, records: [...off, ...on] }, null, 1),
        "utf8",
      );
      // eslint-disable-next-line no-console
      console.log(`saved → ${outPath}`);

      const sum = (rs: ArmRecord[], f: (r: ArmRecord) => number) => rs.reduce((a, r) => a + f(r), 0);
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify(
          {
            OFF: {
              calls: off.length,
              ok: off.filter((r) => r.outcome === "OK").length,
              discovered: sum(off, (r) => r.discovered.length),
              registryHits: sum(off, (r) => r.supportedTitleHits.length),
              distinctDomains: [...new Set(off.flatMap((r) => r.supportedTitleHits))],
            },
            ON: {
              calls: on.length,
              ok: on.filter((r) => r.outcome === "OK").length,
              discovered: sum(on, (r) => r.discovered.length),
              registryHits: sum(on, (r) => r.supportedTitleHits.length),
              distinctDomains: [...new Set(on.flatMap((r) => r.supportedTitleHits))],
            },
          },
          null,
          2,
        ),
      );

      // 🔴 「효과가 있었다」를 단언하지 «않는다». 이것은 측정이고, 결과가 어느
      //    방향이든 사실로 적는다. 단언하는 것은 「실제로 두 arm 을 돌렸다」뿐이다.
      expect(off.length).toBeGreaterThan(0);
      expect(on.length).toBe(off.length);
    },
    30 * 60 * 1000,
  );
});

/* ═══════════════════════ STEP D — resolveCandidate ═══════════════════════ */

/**
 * 🔴 **UNKNOWN_PAGE 를 PRODUCT_PAGE 로 승격하지 않는다.** 분류를 그대로 적는다.
 *
 * 🔴 **registry 적중 URL 만 probe 한다.** grounding URL 은 vertexaisearch
 *    리다이렉트라 모양에 상품 신호가 없고, 도메인은 `web.title` 이 이미 알려 준다
 *    (replay-dataset.ts:32 실측). 적중이 아닌 URL 을 probe 하면 「우리에게 파서가
 *    있는 판매처의 resolve 율」이라는 이 측정의 질문과 무관한 HTTP 비용만 든다.
 * 🔴 그래서 **몇 건을 probe 하지 «않았는가» 를 숫자로 남긴다** — 조용히 빠뜨리면
 *    「전부 쟀다」로 읽힌다.
 */
describe.skipIf(!LIVE)("🔴 MI-P0-02 STEP D — grounding URL 을 resolve 한다", () => {
  it(
    "registry 적중 URL 의 분류를 그대로 기록한다",
    async () => {
      const raw = readFileSync(path.join(OUT_DIR, "mi-p0-whitelist-candidates.json"), "utf8");
      const saved = JSON.parse(raw) as { whitelist: string[]; records: ArmRecord[] };
      const { createLivePageProbe } = await import("../live-page-probe");
      const { resolveCandidate } = await import("../url-resolver");

      let bytes = 0;
      const probe = createLivePageProbe({ onResult: (r) => (bytes += r.bytes) });

      const targets: { arm: string; jobKey: string; queryId: string; domain: string; url: string }[] = [];
      let skipped = 0;
      for (const rec of saved.records) {
        for (const d of rec.discovered) {
          const hit = d.title ? matchSupportedDomain(d.title.trim(), saved.whitelist) : null;
          if (!hit) {
            skipped += 1;
            continue;
          }
          targets.push({ arm: rec.arm, jobKey: rec.jobKey, queryId: rec.queryId, domain: hit, url: d.url });
        }
      }

      const resolved: Record<string, unknown>[] = [];
      for (const t of targets) {
        const r = await resolveCandidate(t.url, [], probe);
        resolved.push({
          ...t,
          classification: r.classification,
          httpStatus: r.httpStatus,
          steps: r.steps,
          // 🔴 원문 그대로. 자르지 않는다.
          finalUrl: r.finalUrl,
          crawlerUrl: r.crawlerUrl,
          dedupeKey: r.dedupeKey,
        });
      }

      const tally = (arm: string) => {
        const t: Record<string, number> = {};
        for (const r of resolved.filter((x) => x.arm === arm)) {
          const k = String(r.classification);
          t[k] = (t[k] ?? 0) + 1;
        }
        return t;
      };
      const crawlable = (arm: string) =>
        resolved.filter((r) => r.arm === arm && r.classification === "PRODUCT_PAGE" && r.crawlerUrl !== null).length;

      const report = {
        probedTargets: targets.length,
        /** 🔴 probe 하지 않은 건수 — 「전부 쟀다」로 읽히지 않게 사실로 남긴다. */
        notProbed_notRegistryHit: skipped,
        probeBytes: bytes,
        OFF: { ...tally("OFF"), crawlable: crawlable("OFF") },
        ON: { ...tally("ON"), crawlable: crawlable("ON") },
        resolved,
      };
      writeFileSync(path.join(OUT_DIR, "mi-p0-resolve.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify(
          { probedTargets: report.probedTargets, notProbed_notRegistryHit: skipped, OFF: report.OFF, ON: report.ON },
          null,
          2,
        ),
      );
      expect(resolved).toHaveLength(targets.length);
    },
    30 * 60 * 1000,
  );
});
