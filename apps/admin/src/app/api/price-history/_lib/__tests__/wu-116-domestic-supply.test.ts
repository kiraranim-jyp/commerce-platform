import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractCandidateUrlsFromAiAnswer } from "@commerce/crawler/src/comparison-search/ai-answer-urls";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import { withConfidence, isSelfReferenceCandidate, type ComparisonQuery } from "@commerce/crawler";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { classifyCandidateMarket } from "../candidate-market";
import { attachMatchTruth } from "../../../domestic-price-sources/_lib/attach-match-truth";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-116 — **AI URL 풀로 국내 후보를 더 확보한다** (CPO 결정 ⒝ · 2026-10-19)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 허용된 공급원은 **외부 소비자 AI 가 조사한 결과** 하나다 —
 *    AI API ❌ · 자동 브라우저 ❌ · 포털 스크래핑 ❌ · 국내 Adapter ❌ · Registry ❌.
 * 🟢 그래서 **WU-073 과 같은 `cto-websearch` 공급원** 을 쓴다(제품에 통합된 호출 0 · 비용 0 ·
 *    그 라벨은 이미 저장 데이터에 존재한다 · WU-102 §knownAnswersFound).
 *
 * 🔴🔴 **후보를 먼저 자르지 않는다**(CPO §3) — `judgeDomesticCandidate`/샵당 best 를
 *    **부르지 않고** 후보 전수에 per-candidate 판정만 붙인다.
 * 🔴 **가격은 수집·평가하지 않는다**(CPO) — `enrichCandidatePrices` 를 **부르지 않았다**.
 * 🔴 기존 GT 27건은 **다시 판정하지 않는다** — URL 로 대조해 **새 후보만** 표시한다.
 */
const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const LIVE = process.env.MI_P0_02_LIVE === "1";
const GT = path.join(__dirname, "fixtures/wu-112-human-gt.json");

/**
 * 🟢 `cto-websearch` 산출 — 2026-10-20 · 질의 2건:
 *    「보보쇼즈 B226AC010 티셔츠 구매」 · 「보보쇼즈 B226AC009 허그 헤어리 몬스터 티셔츠 국내 판매」
 * 🔴 **검색이 돌려준 URL 을 그대로** 넣는다. 내가 고르거나 손으로 바꾸지 않았다
 *    (바꾸면 그것은 AI 공급이 아니라 내 판단이 된다).
 */
const AI_ANSWER_S1 = [
  "https://kream.co.kr/products/1030865",
  "https://shop.coupang.com/beaumondekr?ocid=17295735&pid=7907482626&viid=88739618284",
  "https://luksusbaby.kr/collections/bobo-choses",
  "https://www.beaumonde.co.kr/",
  "https://www.ocokorea.com/shop/goods/brand_view.do?pgid=29628&view=brand",
  "https://sevenzone.com/guide/790",
  "https://www.tinyapple.net/products/bobo-choses-booty-ghosts-t-shirt-heather-grey-%EC%9E%85%EA%B3%A0%EC%A4%91-1",
].map((u, i) => `${i + 1}. ${u}`).join("\n");

const AI_ANSWER_S2 = [
  "https://shop.coupang.com/beaumondekr?ocid=17295735&pid=7907482626&viid=88739618284",
  "https://www.croket.co.kr/brand/68be424e645fa95a685d14e0",
  "https://m.bunjang.co.kr/keywords/hUG",
  "https://www.beaumonde.co.kr/",
  "https://www.donokids.com/shop/shopbrand.html?xcode=058&type=X",
  "https://global.trenbe.com/products/bobo-choses-kids-hug-hairy-monster-long-sleeve-t-shirt-light-blue-b226ac009-451-160484657-p",
].map((u, i) => `${i + 1}. ${u}`).join("\n");

const CASES = [
  { sid: "S1", code: "B226AC010", origin: "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt", answer: AI_ANSWER_S1 },
  { sid: "S2", code: "B226AC009", origin: "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt", answer: AI_ANSWER_S2 },
] as const;

describe("WU-116 — AI URL 풀 국내 공급 확대 (LIVE · 가격 0)", () => {
  (LIVE ? it : it.skip)(
    "새 후보를 전수로 남긴다",
    async () => {
      const known = new Set<string>(
        (JSON.parse(readFileSync(GT, "utf8")).candidates as { url: string }[]).map((x) => x.url),
      );
      const out: Record<string, unknown>[] = [];

      for (const c of CASES) {
        const ex = extractCandidateUrlsFromAiAnswer(c.answer, null);
        const of_ = await factsFromProductUrl(c.origin);
        const q = {
          title: of_.candidate!.title,
          sourceUrl: of_.crawlerUrl!,
          facts: of_.candidate!.facts,
        } as ComparisonQuery;
        const pool = await collectUrlCandidatePool({
          urls: ex.urls,
          originUrl: q.sourceUrl ?? null,
          maxUrls: 50,
          existingCanonicalUrls: new Set<string>(),
        });

        const rows: Record<string, unknown>[] = [];
        for (const r of pool.searchResults) {
          const notSelf = r.candidates.filter((x) => !isSelfReferenceCandidate(q.sourceUrl, x.url));
          if (notSelf.length === 0) continue;
          /** 🔴 가격 보강 **없음** · best 선정 **없음** — per-candidate 판정만 붙인다. */
          const t = await attachMatchTruth(
            [{ ...r, candidates: withConfidence(q, notSelf) }],
            q.facts?.brandModelCode ?? null,
            q.facts?.colorText ?? null,
          );
          for (const x of t[0].candidates) {
            const m = classifyCandidateMarket({
              domain: r.domain,
              currency: x.price?.currency ?? null,
              isRegisteredDomesticShop: false,
            });
            rows.push({
              isNew: !known.has(x.url),
              domain: r.domain,
              url: x.url,
              title: x.title ?? null,
              imageUrl: (x as { imageUrl?: string | null }).imageUrl ?? null,
              urlShape: classifyUrlShape(x.url),
              market: m.market,
              marketBasis: String(m.basis),
              verdict: (x as { crossSellerVerdict?: string | null }).crossSellerVerdict ?? null,
              truth: (x as { matchTruth?: string | null }).matchTruth ?? null,
              matchLevel: x.matchLevel ?? null,
              modelCode: x.facts?.brandModelCode ?? null,
              blockers: ((x as { crossSellerBlockers?: { blocker: string }[] }).crossSellerBlockers ?? []).map((b) => b.blocker),
              reasons: ((x as { matchReasons?: string[] }).matchReasons ?? []).slice(0, 4),
            });
          }
        }

        // eslint-disable-next-line no-console
        console.log(
          `\n════ ${c.sid} / ${c.code} ════\n` +
            /** 🔴 WU-118 정정 — 풀 산출 칸은 `pool.metrics` 아래다(내가 없는 칸을 읽었다). */
            `  AI URL ${ex.urls.length} → 추출 통과 ${pool.metrics.acceptedUrls} →` +
            ` 후보 **${rows.length}** (새 후보 **${rows.filter((x) => x.isNew).length}**)\n` +
            `  탈락 사유 ${JSON.stringify(pool.metrics.dropped.map((d) => d.reason))}`,
        );
        for (const x of rows)
          // eslint-disable-next-line no-console
          console.log(
            `   ${x.isNew ? "[NEW]" : "[기존]"} ${String(x.domain).padEnd(20)} ${String(x.urlShape).padEnd(14)}` +
              ` market=${String(x.market).padEnd(8)} v=${String(x.verdict).padEnd(14)} code=${String(x.modelCode).padEnd(11)}` +
              ` ${String(x.title).slice(0, 40)}`,
          );
        out.push({ sid: c.sid, code: c.code, originUrl: c.origin, originTitle: q.title ?? null, originColor: q.facts?.colorText ?? null, originCode: q.facts?.brandModelCode ?? null, aiUrls: ex.urls.length, candidates: rows });
      }

      writeFileSync(path.join(OUT, "wu-116.json"), JSON.stringify(out, null, 1));
      expect(out).toHaveLength(2);
    },
    3_600_000,
  );
});
