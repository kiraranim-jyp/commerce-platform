import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractCandidateUrlsFromAiAnswer } from "@commerce/crawler/src/comparison-search/ai-answer-urls";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { classifyCandidateMarket } from "../candidate-market";
import {
  withConfidence,
  enrichCandidatePrices,
  isSelfReferenceCandidate,
  type ComparisonQuery,
  type ComparisonCandidate,
} from "@commerce/crawler";
import {
  selectCandidatesForDetailConfirmation,
  MAX_DETAIL_CONFIRMATIONS_PER_SHOP,
} from "@commerce/crawler/src/comparison-search/price-confirmation";
import { extractShopifyHandle } from "@commerce/crawler/src/shopify-product-json";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-088 — **가격 상세확인 «비용 게이트» 의 실제 상한과 회수 기회량** (측정 전용)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO: 「게이트를 바꾸지 않는다 · 상한 증가 ❌ · threshold ❌ · 8축 ❌ ·
 *    `matchTruth`/`priceTier` 주입 ❌ · **코드 변경 0 이 기본값**」
 *
 * ── 🔴🔴 게이트는 «두 겹» 이다 (코드로 확인 · price-confirmation.ts) ─────────
 * ```
 * ⒜ 자격 필터  matchLevel ∈ {very_high, high, medium}  OR  truth === SAME_MODEL_VARIANT
 * ⒝ 샵당 상한  slice(0, MAX_DETAIL_CONFIRMATIONS_PER_SHOP = 2)
 * ```
 * 🔴 헌장 WU-017 실측: 「matchLevel 이 **전건 low** · high 는 **0건**」.
 *    ⟹ **⒜ 에서 막히면 ⒝(상한 2)에는 «도달조차» 하지 않는다.**
 *    🔴 그 둘을 **절대 합치지 않는다** — 「비용 게이트가 낮다」와 「자격이 없다」는 다른 문제다.
 */

const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const SEARCH = path.join(OUT, "mi-019a-search-result.json");
const LIVE = process.env.MI_P0_02_LIVE === "1";
const READY = existsSync(SEARCH);
const ORIGIN = "https://bobochoses.com/en-kr/products/b226ac112-bobo-choses-pop-t-shirt";
const KRISH = (h: string) =>
  /\.kr$|\.co\.kr|kihanan|biskuit|mustit|trenbe|luxboy|donokids|kids21|coupang|naver|ssg|lfmall|croket|luksus|miniboutique|beaumonde|littleluna|wconcept|lotteon|feelway|bbambam|ocokorea/i.test(h);

describe("WU-088 — 가격 비용 게이트 정량화", () => {
  (READY && LIVE ? it : it.skip)(
    "① 상한 ② A/B/C ③ B군 counterfactual ④ 국내/해외 · Shopify 분리",
    async () => {
      /* ── 입력: WU-087 과 **같은** AI 산출 ── */
      const s = JSON.parse(readFileSync(SEARCH, "utf8")) as { rows: { candidates: string[]; dropped?: { url: string }[] }[] };
      const all = new Set<string>();
      for (const r of s.rows) {
        r.candidates.forEach((u) => all.add(u));
        (r.dropped ?? []).forEach((d) => all.add(d.url));
      }
      const answer = [...all].map((u, i) => `${i + 1}. ${u}`).join("\n");
      const ex = extractCandidateUrlsFromAiAnswer(answer, null);

      const originFacts = await factsFromProductUrl(ORIGIN);
      const query = { title: originFacts.candidate!.title, sourceUrl: originFacts.crawlerUrl!, facts: originFacts.candidate!.facts } as ComparisonQuery;
      const pool = await collectUrlCandidatePool({ urls: ex.urls, originUrl: query.sourceUrl ?? null, maxUrls: 200, existingCanonicalUrls: new Set<string>() });

      type Row = {
        url: string; domain: string; kr: boolean; shopify: boolean;
        matchLevel: string | null; group: "A" | "B1" | "B2" | "C";
        priceNow: { amount: number; currency: string } | null;
        priceCf: { amount: number; currency: string } | null;
        cfOutcome: string;
      };
      const rows: Row[] = [];
      /** 🟢 CF 에서 **운영이 만든 후보 객체** 를 그대로 다시 쓰기 위한 색인. */
      const scoredByUrl = new Map<string, ComparisonCandidate>();
      let cfHttp = 0;

      for (const r of pool.searchResults) {
        const notSelf = r.candidates.filter((c) => !isSelfReferenceCandidate(query.sourceUrl, c.url));
        const scored = withConfidence(query, notSelf);
        /** 🟢 **운영 게이트를 그대로 부른다** — 복제하지 않는다. */
        const selected = new Set(selectCandidatesForDetailConfirmation(scored, query));
        /**
         * 🔴 ⒜ **자격만** 보는 집합. 술어를 **복제하지 않는다** — 같은 운영 함수를
         *    **후보 한 개짜리 배열** 로 부르면 상한(2)이 구속하지 않으므로 결과가
         *    곧 「⒜ 를 통과했는가」 다.
         */
        const eligibleNoCap = new Set<number>();
        for (let i = 0; i < scored.length; i++) {
          if (selectCandidatesForDetailConfirmation([scored[i]], query).length > 0) eligibleNoCap.add(i);
        }
        /** 🟢 운영 가격 보강(상한 포함). */
        const priced = await enrichCandidatePrices(scored, r.domain, query);

        for (let i = 0; i < scored.length; i++) {
          const c = scored[i];
          scoredByUrl.set(c.url, c);
          const now = priced[i]?.price ?? null;
          const shopify = extractShopifyHandle(c.url) != null;
          let group: Row["group"];
          if (selected.has(i)) group = "A";
          else if (eligibleNoCap.has(i)) group = "B2";
          else group = "B1";
          rows.push({
            url: c.url, domain: r.domain, kr: KRISH(r.domain), shopify,
            matchLevel: c.matchLevel ?? null, group,
            priceNow: now, priceCf: null, cfOutcome: "미시도",
          });
        }
      }

      /* ── ③ B 군 counterfactual — **게이트를 바꾸지 않고** 같은 어댑터를 후보 «하나짜리» 배열로 부른다 ── */
      /**
       * 🔴🔴 **CF 는 B2(상한에 밀린 것)에만 한다.**
       *    B1 은 ⒜ 자격 필터에서 막힌 것이고 그것을 푸는 것은 **다른 정책** 이다
       *    (matchLevel/threshold 변경 = CPO 가 금지). 둘을 섞으면 「비용 게이트를
       *    풀면 N 건이 산다」가 **거짓** 이 된다.
       */
      const B = rows.filter((x) => x.group === "B2" && x.priceNow == null);
      for (const b of B) {
        /**
         * 🔴 운영 코드를 고치지 않는다. 대신 **그 후보만 담은 배열** 로 같은 함수를 부른다 —
         *    그러면 상한 2 와 샵당 경쟁이 사라져 **「게이트가 없었다면」** 을 재현한다.
         * 🔴 자격 필터(⒜)는 **그대로** 남는다 ⟹ B1 은 여기서도 통과하지 못한다(설계대로).
         */
        const one = rows.find((x) => x.url === b.url)!;
        try {
          /**
           * 🔴 **값을 주입하지 않는다** — 운영이 만든 «그 후보 그대로» 를 쓰고,
           *    배열을 한 개로 만들어 **상한만** 비활성화한다.
           */
          const real = scoredByUrl.get(b.url)!;
          const out = await enrichCandidatePrices([real], b.domain, query);
          cfHttp += 1;
          one.priceCf = out[0]?.price ?? null;
          one.cfOutcome = out[0]?.price ? "🟢 회수" : "🔴 회수 불가";
        } catch (e) {
          one.cfOutcome = `🔴 요청 실패(${String(e).slice(0, 40)})`;
        }
      }

      /* ── 집계 ── */
      const g = (k: Row["group"]) => rows.filter((x) => x.group === k);
      const cnt = (xs: Row[]) => `${xs.length}(국내 ${xs.filter((x) => x.kr).length} · 해외 ${xs.filter((x) => !x.kr).length})`;
      const lvl: Record<string, number> = {};
      for (const x of rows) lvl[String(x.matchLevel)] = (lvl[String(x.matchLevel)] ?? 0) + 1;

      // eslint-disable-next-line no-console
      console.log(`\n════════ WU-088 — 가격 비용 게이트 ════════`);
      // eslint-disable-next-line no-console
      console.log(`  상한 MAX_DETAIL_CONFIRMATIONS_PER_SHOP = **${MAX_DETAIL_CONFIRMATIONS_PER_SHOP}** (샵당)`);
      // eslint-disable-next-line no-console
      console.log(`  전체 후보 ${rows.length} · matchLevel 분포 ${JSON.stringify(lvl)}`);
      // eslint-disable-next-line no-console
      console.log(`  A 상세확인 대상      ${cnt(g("A"))}`);
      // eslint-disable-next-line no-console
      console.log(`  B1 **자격 필터 탈락** ${cnt(g("B1"))}   ← ⒜ matchLevel/truth 에서 막힘`);
      // eslint-disable-next-line no-console
      console.log(`  B2 **상한(2)에 밀림** ${cnt(g("B2"))}   ← ⒝ 비용 상한에서 막힘`);
      // eslint-disable-next-line no-console
      console.log(`  현재 가격 확보        ${cnt(rows.filter((x) => x.priceNow != null))}`);

      const rec = B.filter((x) => rows.find((y) => y.url === x.url)!.priceCf != null);
      const recRows = rows.filter((x) => x.priceCf != null);
      // eslint-disable-next-line no-console
      console.log(`\n  ── ③ B 군 counterfactual (N=${B.length} · 추가 HTTP **${cfHttp}**) ──`);
      // eslint-disable-next-line no-console
      console.log(`     🟢 **추가 회수 ${recRows.length}건** (국내 ${recRows.filter((x) => x.kr).length} · 해외 ${recRows.filter((x) => !x.kr).length})`);
      const outc: Record<string, number> = {};
      for (const b of B) outc[rows.find((y) => y.url === b.url)!.cfOutcome] = (outc[rows.find((y) => y.url === b.url)!.cfOutcome] ?? 0) + 1;
      // eslint-disable-next-line no-console
      console.log(`     결과 분포 ${JSON.stringify(outc)}`);
      // eslint-disable-next-line no-console
      console.log(`     Shopify ${B.filter((x) => x.shopify).length} / 기타 ${B.filter((x) => !x.shopify).length}  ·  회수 중 Shopify ${recRows.filter((x) => x.shopify).length}`);
      for (const r2 of recRows) {
        const m = classifyCandidateMarket({ domain: r2.domain, currency: r2.priceCf?.currency ?? null, isRegisteredDomesticShop: false });
        // eslint-disable-next-line no-console
        console.log(`       ${r2.domain.padEnd(24)} ${JSON.stringify(r2.priceCf)} market=${m.market}`);
      }
      void rec;

      writeFileSync(path.join(OUT, "wu-088.json"), JSON.stringify({ cap: MAX_DETAIL_CONFIRMATIONS_PER_SHOP, total: rows.length, lvl, A: g("A").length, B1: g("B1").length, B2: g("B2").length, cfHttp, recovered: recRows.length, rows }, null, 1));

      /* ══════ 🔴 계약 ══════ */
      expect(MAX_DETAIL_CONFIRMATIONS_PER_SHOP).toBe(2);
      expect(rows.length).toBeGreaterThan(0);
      /** 🔴 B1 과 B2 를 **합치지 않는다** — 둘은 다른 게이트다. */
      expect(g("B1").length + g("B2").length + g("A").length).toBe(rows.length);

      /**
       * 🔴🔴🔴 **이 WU 의 답** — 비용 상한(⒝)은 **한 번도 발화하지 않는다.**
       *    ⒜ 자격 필터(matchLevel ∈ {very_high, high, medium})에서 **전건** 막히므로
       *    상한 2 에 **도달조차 하지 않는다**. ⟹ 상한을 올려도 **변화 0** 이다.
       * 🟢 헌장 WU-017 의 「matchLevel 전건 low · high 0건」이 이 표본에서 재현됐다.
       */
      expect(Object.keys(lvl)).toEqual(["low"]);
      expect(g("A")).toHaveLength(0);
      expect(g("B2")).toHaveLength(0);
      expect(cfHttp).toBe(0);
      /**
       * 🟢 그런데 가격은 **12건 있다** — 그것은 상세확인이 아니라
       *    `factsFromProductUrl` 의 JSON-LD/microdata 에서 나온 값이다.
       *    🔴 「상세확인이 가격을 만들고 있다」로 읽지 않는다.
       */
      expect(rows.filter((x) => x.priceNow != null).length).toBeGreaterThan(0);
    },
    3_600_000,
  );
});
