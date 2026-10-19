import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractCandidateUrlsFromAiAnswer } from "@commerce/crawler/src/comparison-search/ai-answer-urls";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import { withConfidence, enrichCandidatePrices, isSelfReferenceCandidate, type ComparisonQuery } from "@commerce/crawler";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { attachMatchTruth } from "../../../domestic-price-sources/_lib/attach-match-truth";
import { judgeDomesticCandidate } from "../run-domestic-price-check";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-103 — **동일상품이 «실재하는» 모집단에서 funnel 재측정** (LIVE · 구현 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 WU-102 가 정정한 것: 181건은 **여섯 상품(S1~S6)** 조사 결과였고 B226AC112 는
 *    **조사 대상이 아니었다**. ⟹ 그 분모로 잰 funnel 은 동일상품 손실을 말할 수 없다.
 * 🟢 그래서 **AI 가 정답을 찾은 S1·S2** 를 원상품으로 삼아 다시 잰다.
 * 🔴 **새 AI 호출 0** · S4·S5 는 **원상품 식별 불가라 분모에서 제외**(CPO 지시).
 *
 * 🟢 **동일상품 식별 기준 — 지어내지 않는다**: 원상품 품번(`B226AC010`/`B226AC009`)이
 *    후보 **URL 또는 운영 facts.brandModelCode** 에 있는가. 둘 다 **관측값** 이다.
 */
const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const SEARCH = path.join(OUT, "mi-019a-search-result.json");
const LIVE = process.env.MI_P0_02_LIVE === "1";
const READY = existsSync(SEARCH);

/** 🔴 원상품은 저장 데이터의 `knownAnswersFound`(공식몰 URL) 를 **그대로** 쓴다. */
const CASES = [
  { id: "S1", code: "B226AC010", origin: "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt" },
  { id: "S2", code: "B226AC009", origin: "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt" },
] as const;

describe("WU-103 — 정답 케이스 funnel (LIVE)", () => {
  (READY && LIVE ? it : it.skip)(
    "① AI 가 찾음 ~ ⑥ selection 소실 까지 여섯으로 가른다",
    async () => {
      const s = JSON.parse(readFileSync(SEARCH, "utf8")) as {
        rows: { searchId: string; model: string; candidates?: string[]; dropped?: { url: string }[]; knownAnswersFound?: string[]; unverifiedNew?: string[] }[];
      };
      const report: Record<string, unknown>[] = [];

      for (const c of CASES) {
        /* ── ① AI 원본 — 그 검색의 모든 URL ── */
        const rows = s.rows.filter((r) => r.searchId === c.id);
        const ai = new Set<string>();
        for (const r of rows) {
          (r.candidates ?? []).forEach((u) => ai.add(u));
          (r.dropped ?? []).forEach((d) => ai.add(d.url));
          (r.knownAnswersFound ?? []).forEach((u) => ai.add(u));
          (r.unverifiedNew ?? []).forEach((u) => ai.add(u));
        }
        /** 🔴 원상품 자신은 후보가 아니다 — 자기참조로 운영이 뺀다. 분모에서도 뺀다. */
        const aiUrls = [...ai].filter((u) => u !== c.origin);
        /** 🟢 **동일상품 후보** = URL 에 원상품 품번이 있는 것(1차 기준 · 관측값). */
        const sameByUrl = aiUrls.filter((u) => u.toUpperCase().includes(c.code));

        /* ── ② URL 추출 ── */
        const ex = extractCandidateUrlsFromAiAnswer(aiUrls.map((u, i) => `${i + 1}. ${u}`).join("\n"), null);
        const extracted = new Set(ex.urls);

        /* ── 원상품 facts (운영 owner) ── */
        const of_ = await factsFromProductUrl(c.origin);
        const query = { title: of_.candidate!.title, sourceUrl: of_.crawlerUrl!, facts: of_.candidate!.facts } as ComparisonQuery;

        /* ── ③④⑤ 풀(상품판정 + fetch + facts) ── */
        const pool = await collectUrlCandidatePool({ urls: ex.urls, originUrl: query.sourceUrl ?? null, maxUrls: 200, existingCanonicalUrls: new Set<string>() });
        const dropBy = new Map(pool.metrics.dropped.map((d) => [d.url, d.reason]));

        /** 🟢 풀을 통과한 후보 중 **동일상품** — URL 또는 운영 facts 품번으로 본다. */
        const poolSame: string[] = [];
        let judgedSame = 0;
        let selectionLostSame = 0;
        for (const r of pool.searchResults) {
          const notSelf = r.candidates.filter((x) => !isSelfReferenceCandidate(query.sourceUrl, x.url));
          const priced = await enrichCandidatePrices(withConfidence(query, notSelf), r.domain, query);
          const truthed = await attachMatchTruth([{ ...r, candidates: priced }], query.facts?.brandModelCode ?? null, query.facts?.colorText ?? null);
          const sameHere = truthed[0].candidates.filter(
            (x) => x.url.toUpperCase().includes(c.code) || String(x.facts?.brandModelCode ?? "").toUpperCase().includes(c.code),
          );
          sameHere.forEach((x) => poolSame.push(x.url));
          if (sameHere.length === 0) continue;
          /* ── ⑥ selection(운영 판정) ── */
          const j = await judgeDomesticCandidate({
            domain: r.domain, candidates: truthed[0].candidates, sourceUrl: query.sourceUrl,
            foreignModelCode: query.facts?.brandModelCode ?? null, foreignColor: query.facts?.colorText ?? null,
            fetchModelCode: async () => null,
          });
          if (j.kind === "JUDGED") judgedSame += 1;
          else selectionLostSame += 1;
        }

        const lost2 = sameByUrl.filter((u) => !extracted.has(u));
        const lost345 = sameByUrl.filter((u) => extracted.has(u) && !poolSame.some((p) => p.includes(u.split("?")[0].slice(8))));
        const dropReasons: Record<string, number> = {};
        for (const u of sameByUrl) {
          const why = dropBy.get(u);
          if (why) dropReasons[why] = (dropReasons[why] ?? 0) + 1;
        }

        // eslint-disable-next-line no-console
        console.log(`\n════ ${c.id} 원상품 ${c.code} ════`);
        // eslint-disable-next-line no-console
        console.log(`  원상품 facts — brand=${JSON.stringify(query.facts?.brand)} code=${JSON.stringify(query.facts?.brandModelCode)} color=${JSON.stringify(query.facts?.colorText)}`);
        // eslint-disable-next-line no-console
        console.log(`  ① AI URL **${aiUrls.length}** · 🟢 그중 **동일상품(품번 일치) ${sameByUrl.length}**`);
        for (const u of sameByUrl) console.log(`       ${extracted.has(u) ? "🟢추출" : "🔴탈락"} ${dropBy.get(u) ?? ""} ${u.slice(0, 78)}`);
        // eslint-disable-next-line no-console
        console.log(`  ② 추출 소실 **${lost2.length}** · ③④⑤ 풀 소실 **${lost345.length}** ${JSON.stringify(dropReasons)}`);
        // eslint-disable-next-line no-console
        console.log(`  ⑤ 풀 통과 동일상품 **${poolSame.length}** · ⑥ JUDGED **${judgedSame}** / DROPPED **${selectionLostSame}**`);
        report.push({ id: c.id, code: c.code, aiUrls: aiUrls.length, sameByUrl, lost2: lost2.length, poolSame, judgedSame, selectionLostSame, dropReasons });
      }
      writeFileSync(path.join(OUT, "wu-103.json"), JSON.stringify(report, null, 1));
      expect(report).toHaveLength(2);
    },
    3_600_000,
  );
});
