import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractCandidateUrlsFromAiAnswer } from "@commerce/crawler/src/comparison-search/ai-answer-urls";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import {
  withConfidence,
  enrichCandidatePrices,
  isSelfReferenceCandidate,
  type ComparisonQuery,
  type ComparisonCandidate,
} from "@commerce/crawler";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { classifyCandidateMarket } from "../candidate-market";
import { attachMatchTruth } from "../../../domestic-price-sources/_lib/attach-match-truth";
/**
 * 🔴🔴 **tier 를 지어내지 않는다.** 1차에 `priceTierFromLink({matchTruth, verified:false})`
 *    를 썼는데 `verified` 는 **내가 만든 값** 이다 — 헌장이 기록한 **WU-085 의 그 실수**
 *    (「운영 게이트를 지어낸 것이 1번」)를 **세 번째로** 반복할 뻔했다.
 * 🟢 운영 owner `judgeDomesticCandidate` 를 **그대로 부르고** 그것이 내놓은
 *    `JUDGED.priceTier`(코드 주석이 **「최종 owner 의 값」** 이라 적은 칸)를 **읽는다**.
 * 🔴 그 함수는 **샵당 best 1건** 만 판정한다 ⟹ ⑧⑨ 는 **샵 단위** 로 센다(운영 그대로).
 */
import { judgeDomesticCandidate } from "../run-domestic-price-check";
import {
  isVisualCheckTier,
  mayShowCandidate,
  overseasMatchDisplay,
  domesticMatchDisplay,
} from "../../../../pipeline/commerce/match-display";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-096 — **AI 후보 → MI → 국내/해외 가격비교 노출** 전수 funnel (LIVE · 측정 전용)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 지시 2026-10-19: 「**코드 변경을 먼저 하지 않는다.** Production 기준으로
 *    전체 경로를 실제 데이터로 전수 추적한다.」
 * 🔴 금지: threshold ❌ · 8축 재개방 ❌ · 숫자 slug 재개방 ❌ · Registry ❌ ·
 *    새 AI API ❌ · UI 수정 선행 ❌ · 근거 없는 recall 개선안 ❌
 *
 * ── 🔴🔴 왜 «다시» 재는가 ───────────────────────────────────────────────────
 * WU-087/088/089 의 숫자는 **WU-095 수정 «이전»** 값이다. 그 수정이
 * `confidence`·`matchLevel`·`EXACT_PRODUCT` 를 바꿨으므로 **그대로 인용하면 틀린다**.
 *
 * ── 🔴 CPO §4·§5 가 요구한 «분리» ──────────────────────────────────────────
 * ```
 * ④ 가격을 «못 가져온 것»  ↔  가격은 있는데 «판정» 때문에 비교에서 빠진 것
 * ⑤ 백엔드엔 있는데 «UI 에서» 사라지는 것 ↔ 애초에 «백엔드까지» 못 간 것
 * ```
 */

const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const SEARCH = path.join(OUT, "mi-019a-search-result.json");
const LIVE = process.env.MI_P0_02_LIVE === "1";
const READY = existsSync(SEARCH);
/** 🔴 WU-087/088/089 와 **같은 원상품** — 분모를 바꾸지 않는다. */
const ORIGIN = "https://bobochoses.com/en-kr/products/b226ac112-bobo-choses-pop-t-shirt";

type Stage = {
  url: string;
  domain: string;
  market: string;
  marketBasis: string;
  extracted: boolean;
  poolDrop: string | null;
  factsOk: boolean;
  price: { amount: number; currency: string } | null;
  priceStatus: string | null;
  matchLevel: string | null;
  verdict: string | null;
  matchTruth: string | null;
  tier: string | null;
  uiShown: boolean | null;
  uiCardTier: boolean | null;
};

describe("WU-096 — Production funnel 전수 (LIVE)", () => {
  (READY && LIVE ? it : it.skip)(
    "① AI → ⑩ UI 까지 국내/해외를 갈라 센다",
    async () => {
      /* ── ① AI 후보 (저장분 · 새 AI 호출 0) ── */
      const s = JSON.parse(readFileSync(SEARCH, "utf8")) as {
        rows: { candidates: string[]; dropped?: { url: string }[] }[];
      };
      const all = new Set<string>();
      for (const r of s.rows) {
        r.candidates.forEach((u) => all.add(u));
        (r.dropped ?? []).forEach((d) => all.add(d.url));
      }
      const aiUrls = [...all];

      /* ── ② URL 추출 (운영 owner) ── */
      const ex = extractCandidateUrlsFromAiAnswer(aiUrls.map((u, i) => `${i + 1}. ${u}`).join("\n"), null);
      const extracted = new Set(ex.urls);

      /* ── 원상품 — 운영 owner 로 만든다 ── */
      const of_ = await factsFromProductUrl(ORIGIN);
      const query = {
        title: of_.candidate!.title,
        sourceUrl: of_.crawlerUrl!,
        facts: of_.candidate!.facts,
      } as ComparisonQuery;

      /* ── ③ 풀 (fetch 포함) ── */
      const pool = await collectUrlCandidatePool({
        urls: ex.urls,
        originUrl: query.sourceUrl ?? null,
        maxUrls: 400,
        existingCanonicalUrls: new Set<string>(),
      });
      const dropBy = new Map<string, string>();
      for (const d of pool.metrics.dropped) dropBy.set(d.url, d.reason);

      const rows: Stage[] = [];
      /** 🟢 운영 `judgeDomesticCandidate` 가 낸 **샵 단위** 결과. */
      const judgements: Record<string, unknown>[] = [];
      for (const r of pool.searchResults) {
        const notSelf = r.candidates.filter((c) => !isSelfReferenceCandidate(query.sourceUrl, c.url));
        const scored = withConfidence(query, notSelf);
        /* ── ⑤ 가격 (운영 보강 포함) ── */
        const priced = await enrichCandidatePrices(scored, r.domain, query);
        /* ── ⑦ MI 판정 (운영 owner · 복제 금지) ── */
        const truthed = await attachMatchTruth(
          [{ ...r, candidates: priced }],
          query.facts?.brandModelCode ?? null,
          query.facts?.colorText ?? null,
        );
        for (const c of truthed[0].candidates) {
          const m = classifyCandidateMarket({
            domain: r.domain,
            currency: c.price?.currency ?? null,
            isRegisteredDomesticShop: false,
          });
          /** 🔴 tier 는 **후보 단위로 존재하지 않는다** — 아래 샵 단위 판정에서 읽는다. */
          /* ── ⑩ UI — 운영 표시 게이트를 그대로 부른다 ── */
          const display = m.market === "KR" && c.matchTruth
            ? domesticMatchDisplay(c.matchTruth)
            : c.productMatchTruth
              ? overseasMatchDisplay(c.productMatchTruth)
              : null;
          rows.push({
            url: c.url,
            domain: r.domain,
            market: m.market,
            marketBasis: String(m.basis),
            extracted: true,
            poolDrop: null,
            factsOk: Boolean(c.facts),
            price: c.price ?? null,
            priceStatus: c.priceStatus ?? null,
            matchLevel: c.matchLevel ?? null,
            verdict: c.crossSellerVerdict ?? null,
            matchTruth: c.matchTruth ?? null,
            tier: null,
            uiShown: display
              ? mayShowCandidate({ tier: display.tier, confidence: c.confidence })
              : null,
            uiCardTier: display ? isVisualCheckTier(display.tier) : null,
          });
        }
        /* ── ⑧ 운영 판정 — 샵 단위. 🔴 `fetchModelCode` 는 운영과 같은 함수를 주입한다. */
        const judged = await judgeDomesticCandidate({
          domain: r.domain,
          candidates: truthed[0].candidates,
          sourceUrl: query.sourceUrl,
          foreignModelCode: query.facts?.brandModelCode ?? null,
          foreignColor: query.facts?.colorText ?? null,
          /** 🔴 추가 HTTP 를 쓰지 않는다 — 이 측정은 **도달 여부** 를 보는 것이다. */
          fetchModelCode: async () => null,
        });
        judgements.push({ domain: r.domain, kind: judged.kind, ...(judged.kind === "JUDGED"
          ? { priceTier: judged.priceTier, matchTruth: judged.matchTruth, verified: judged.verified, bestUrl: judged.best.url }
          : judged.kind === "DROPPED" ? { gate: judged.gate } : {}) });
      }
      /**
       * 풀 이전에서 죽은 것도 «행으로» 남긴다 — 분모를 숨기지 않는다.
       * 🔴🔴 **1차에 분모가 192 로 부풀었다**(AI URL 은 181). 풀을 통과한 후보의 URL 이
       *    **정규화돼** 원래 AI URL 문자열과 달라 매칭이 안 됐고, 같은 URL 이 **양쪽에**
       *    들어갔다. 🟢 호스트+경로로 **정규화 비교** 해서 고친다.
       */
      /**
       * 🔴 **정규식을 쉘로 편집하지 않는다**(헌장 WU-078 교훈 — 이 WU 에서 또 어겼다).
       *    여기서는 아예 정규식을 쓰지 않는다 — 문자열 연산만으로 같은 일을 한다.
       */
      const key = (u: string) => {
        try {
          const x = new URL(u);
          const host = x.host.toLowerCase().startsWith("www.") ? x.host.toLowerCase().slice(4) : x.host.toLowerCase();
          let p2 = x.pathname.toLowerCase();
          while (p2.endsWith("/")) p2 = p2.slice(0, -1);
          return host + p2;
        } catch {
          return u.toLowerCase();
        }
      };
      const seen = new Set(rows.map((x) => key(x.url)));
      for (const u of aiUrls) {
        if (seen.has(key(u))) continue;
        seen.add(key(u));
        let domain = "";
        try {
          domain = new URL(u).hostname;
        } catch {
          /* 잘못된 URL 도 분모에 남긴다 */
        }
        rows.push({
          url: u, domain, market: "—", marketBasis: "—",
          extracted: extracted.has(u), poolDrop: dropBy.get(u) ?? (extracted.has(u) ? "POOL_UNKNOWN" : "NOT_EXTRACTED"),
          factsOk: false, price: null, priceStatus: null, matchLevel: null,
          verdict: null, matchTruth: null, tier: null, uiShown: null, uiCardTier: null,
        });
      }

      /** 🔴 국내/해외는 **운영 `classifyCandidateMarket`** 으로 가른다. 휴리스틱 금지. */
      const KR = rows.filter((x) => x.market === "KR");
      const OS = rows.filter((x) => x.market === "OVERSEAS");
      const UNK = rows.filter((x) => x.market === "UNKNOWN");

      const funnel = (xs: Stage[], label: string) => {
        const n = {
          "① AI 후보": xs.length,
          "② URL 추출": xs.filter((x) => x.extracted).length,
          "③ 풀 통과(fetch OK)": xs.filter((x) => x.factsOk).length,
          "④ facts 확보": xs.filter((x) => x.factsOk).length,
          "⑤ 가격 확보": xs.filter((x) => x.price != null).length,
          "⑥ market 확정": xs.filter((x) => x.market === "KR" || x.market === "OVERSEAS").length,
          "⑦ MI 판정 도달": xs.filter((x) => x.matchTruth != null).length,
          "⑧⑨ tier — 🔴 샵 단위(아래 표)": -1,
          "⑩ UI 노출": xs.filter((x) => x.uiShown === true).length,
          "⑩-b UI 카드(동일상품)": xs.filter((x) => x.uiCardTier === true).length,
        };
        // eslint-disable-next-line no-console
        console.log(`\n──────── ${label} (N=${xs.length}) ────────`);
        for (const [k, v] of Object.entries(n)) console.log(`  ${k.padEnd(26)} ${String(v).padStart(5)}`);
        return n;
      };

      // eslint-disable-next-line no-console
      console.log(`\n시장 분포 — KR ${KR.length} · 해외 ${OS.length} · UNKNOWN ${UNK.length} · 풀이전탈락 ${rows.length - KR.length - OS.length - UNK.length}`);
      const fAll = funnel(rows, "② 전체");
      const fKr = funnel(KR, "③ 국내(KR)");
      const fOs = funnel(OS, "④ 해외(OVERSEAS)");

      /* ── ⑧ 운영 판정 결과 (샵 단위) ── */
      // eslint-disable-next-line no-console
      console.log(`
──────── ⑧ 운영 judgeDomesticCandidate (샵 ${judgements.length}곳) ────────`);
      const jk: Record<string, number> = {};
      for (const j of judgements) {
        const k = j.kind === "JUDGED" ? `JUDGED/${String(j.priceTier)}` : j.kind === "DROPPED" ? `DROPPED/${String(j.gate)}` : String(j.kind);
        jk[k] = (jk[k] ?? 0) + 1;
      }
      // eslint-disable-next-line no-console
      console.log(`  ${JSON.stringify(jk)}`);
      for (const j of judgements.filter((x) => x.kind === "JUDGED"))
        // eslint-disable-next-line no-console
        console.log(`   🟢 ${String(j.domain).padEnd(26)} tier=${String(j.priceTier).padEnd(12)} truth=${String(j.matchTruth).padEnd(20)} verified=${j.verified}`);

      /* ── 탈락 원인 ── */
      const tally = (xs: Stage[], f: (x: Stage) => string | null) => {
        const t: Record<string, number> = {};
        for (const x of xs) {
          const k = f(x);
          if (k) t[k] = (t[k] ?? 0) + 1;
        }
        return t;
      };
      // eslint-disable-next-line no-console
      console.log(`\n🔴 풀 이전 탈락 사유: ${JSON.stringify(tally(rows, (x) => x.poolDrop))}`);
      // eslint-disable-next-line no-console
      console.log(`🔴 market basis 분포: ${JSON.stringify(tally(rows.filter((x) => x.factsOk), (x) => x.marketBasis))}`);
      // eslint-disable-next-line no-console
      console.log(`🔴 matchTruth 분포: ${JSON.stringify(tally(rows, (x) => x.matchTruth))}`);
      // eslint-disable-next-line no-console
      console.log(`🔴 matchLevel 분포(WU-095 이후): ${JSON.stringify(tally(rows, (x) => x.matchLevel))}`);

      /* ── 🔴 CPO §4 — 가격 «실패» 와 «판정 제외» 를 가른다 ── */
      const reached = rows.filter((x) => x.factsOk);
      const priceFail = reached.filter((x) => x.price == null);
      /** 🔴 「판정으로 제외」는 **샵 판정** 기준이다 — 후보 단위 tier 는 운영에 없다. */
      const judgedTierByDomain = new Map(
        judgements.filter((j) => j.kind === "JUDGED").map((j) => [String(j.domain), String(j.priceTier)]),
      );
      const inBucket = (x: Stage) => {
        const t = judgedTierByDomain.get(x.domain);
        return t === "EXACT" || t === "COMPARISON";
      };
      const pricedButExcluded = reached.filter((x) => x.price != null && !inBucket(x));
      // eslint-disable-next-line no-console
      console.log(
        `\n🔴🔴 §4 분리 — 가격 **실패** ${priceFail.length} (국내 ${priceFail.filter((x) => x.market === "KR").length} · 해외 ${priceFail.filter((x) => x.market === "OVERSEAS").length})` +
          ` ↔ 가격은 있는데 **판정으로 제외** ${pricedButExcluded.length} (국내 ${pricedButExcluded.filter((x) => x.market === "KR").length} · 해외 ${pricedButExcluded.filter((x) => x.market === "OVERSEAS").length})`,
      );
      // eslint-disable-next-line no-console
      console.log(`   판정 제외의 **샵 판정** 분포: ${JSON.stringify(tally(pricedButExcluded, (x) => judgedTierByDomain.get(x.domain) ?? "판정없음"))}`);

      /* ── 🔴 CPO §5 — 백엔드 도달 ↔ UI 소실 ── */
      const backendOk = reached.filter((x) => x.price != null && inBucket(x));
      const lostInUi = backendOk.filter((x) => x.uiShown !== true);
      // eslint-disable-next-line no-console
      console.log(
        `\n🔴🔴 §5 분리 — 백엔드 «자격 있음» ${backendOk.length} · 그중 **UI 에서 사라짐** ${lostInUi.length}` +
          ` · 애초에 **백엔드까지 못 감** ${rows.length - backendOk.length}`,
      );

      writeFileSync(path.join(OUT, "wu-096.json"), JSON.stringify({ fAll, fKr, fOs, judgements, rows }, null, 1));
      expect(rows.length).toBeGreaterThan(0);
    },
    3_600_000,
  );
});
