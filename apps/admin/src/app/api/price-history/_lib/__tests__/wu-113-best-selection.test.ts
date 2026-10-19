import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractCandidateUrlsFromAiAnswer } from "@commerce/crawler/src/comparison-search/ai-answer-urls";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import { withConfidence, enrichCandidatePrices, isSelfReferenceCandidate, type ComparisonQuery } from "@commerce/crawler";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { attachMatchTruth } from "../../../domestic-price-sources/_lib/attach-match-truth";
import { judgeDomesticCandidate, orderByCrossSellerVerdict } from "../run-domestic-price-check";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-113 STEP 1 — **샵 대표(best) 선택의 실제 입력을 전수로 본다** (구현 전 측정)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 2026-10-19 — P1 **만** 채택. 8축·threshold·가격·⑧ 게이트·샵당 다중 후보 구조는
 *    건드리지 않는다. 고칠 자리는 **대표 선택** 하나다.
 *
 * 🔴 WU-112 GT 가 잡은 실패 모양:
 *    tinyapple 에서 verdict(SAME)와 matchTruth(STRONG_IDENTIFIER)가 **같은** 두 후보가
 *    `matchLevel`(very_high ↔ low)로 갈렸고, **Human DIFFERENT 쪽이 대표** 가 됐다.
 *    🔴🔴 그런데 원상품 색상이 **"heather grey"** 이고 **이긴 쪽은 색을 안 적은 후보** 다.
 *
 * 🔴 그래서 「무엇으로 갈라야 하는가」를 **고르기 전에 그 축의 데이터가 실재하는지** 센다.
 *    후보 색상(`facts.colorText`) · 색상 충돌(`crossSellerConflicts`)을 전수로 찍는다.
 * 🔴 운영 코드 변경 **0** · MI 입력 0 · 저장 0.
 */
const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const SEARCH = path.join(OUT, "mi-019a-search-result.json");
const LIVE = process.env.MI_P0_02_LIVE === "1";
const READY = existsSync(SEARCH);

const CASES = [
  { sid: "S1", code: "B226AC010", origin: "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt" },
  { sid: "S2", code: "B226AC009", origin: "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt" },
] as const;

describe("WU-113 STEP1 — 대표 선택 입력 전수 (LIVE)", () => {
  (READY && LIVE ? it : it.skip)(
    "같은 샵 안에서 무엇이 갈리는지 센다",
    async () => {
      const s = JSON.parse(readFileSync(SEARCH, "utf8")) as {
        rows: { searchId: string; candidates?: string[]; dropped?: { url: string }[]; knownAnswersFound?: string[]; unverifiedNew?: string[] }[];
      };
      const out: Record<string, unknown>[] = [];

      for (const c of CASES) {
        const urls = new Set<string>();
        for (const r of s.rows.filter((x) => x.searchId === c.sid)) {
          (r.candidates ?? []).forEach((u) => urls.add(u));
          (r.dropped ?? []).forEach((d) => urls.add(d.url));
          (r.knownAnswersFound ?? []).forEach((u) => urls.add(u));
          (r.unverifiedNew ?? []).forEach((u) => urls.add(u));
        }
        const ex = extractCandidateUrlsFromAiAnswer(
          [...urls].filter((u) => u !== c.origin).map((u, i) => `${i + 1}. ${u}`).join("\n"),
          null,
        );
        const of_ = await factsFromProductUrl(c.origin);
        const q = { title: of_.candidate!.title, sourceUrl: of_.crawlerUrl!, facts: of_.candidate!.facts } as ComparisonQuery;
        const pool = await collectUrlCandidatePool({
          urls: ex.urls, originUrl: q.sourceUrl ?? null, maxUrls: 200, existingCanonicalUrls: new Set<string>(),
        });

        const shops: Record<string, unknown>[] = [];
        for (const r of pool.searchResults) {
          const notSelf = r.candidates.filter((x) => !isSelfReferenceCandidate(q.sourceUrl, x.url));
          if (notSelf.length === 0) continue;
          const priced = await enrichCandidatePrices(withConfidence(q, notSelf), r.domain, q);
          const t = await attachMatchTruth([{ ...r, candidates: priced }], q.facts?.brandModelCode ?? null, q.facts?.colorText ?? null);
          const cands = t[0].candidates;
          const j = await judgeDomesticCandidate({
            domain: r.domain, candidates: cands, sourceUrl: q.sourceUrl,
            foreignModelCode: q.facts?.brandModelCode ?? null, foreignColor: q.facts?.colorText ?? null,
            fetchModelCode: async () => null,
          });
          /** 🟢 운영이 실제로 쓰는 **정렬 결과** 를 그대로 본다(복제 금지). */
          const ordered = orderByCrossSellerVerdict(cands);
          shops.push({
            domain: r.domain,
            judgement: j.kind,
            bestUrl: j.kind === "JUDGED" ? j.best.url : null,
            candidates: ordered.map((x, rank) => ({
              rank,
              url: x.url,
              title: x.title ?? null,
              verdict: (x as { crossSellerVerdict?: string | null }).crossSellerVerdict ?? null,
              truth: (x as { matchTruth?: string | null }).matchTruth ?? null,
              matchLevel: x.matchLevel ?? null,
              confidence: (x as { confidence?: number | null }).confidence ?? null,
              colorText: x.facts?.colorText ?? null,
              modelCode: x.facts?.brandModelCode ?? null,
              conflicts: (x as { crossSellerConflicts?: unknown }).crossSellerConflicts ?? null,
              blockers: (x as { crossSellerBlockers?: unknown }).crossSellerBlockers ?? null,
              price: x.price?.amount ?? null,
              currency: x.price?.currency ?? null,
            })),
          });
        }
        out.push({ sid: c.sid, code: c.code, originColor: q.facts?.colorText ?? null, originTitle: q.title ?? null, shops });
      }

      /* ── 같은 샵에 후보가 둘 이상인 곳만 찍는다 — 대표 선택이 «의미 있는» 자리다 ── */
      for (const g of out) {
        // eslint-disable-next-line no-console
        console.log(`\n==== ${g.sid} (origin color=${JSON.stringify(g.originColor)}) ====`);
        for (const sh of (g.shops as Record<string, unknown>[]).filter((x) => (x.candidates as unknown[]).length > 1)) {
          // eslint-disable-next-line no-console
          console.log(`  ${sh.domain} / ${sh.judgement}`);
          for (const x of sh.candidates as Record<string, unknown>[]) {
            // eslint-disable-next-line no-console
            console.log(
              `   #${x.rank} ${x.url === sh.bestUrl ? "[BEST]" : "      "} v=${String(x.verdict).padEnd(14)}` +
                ` truth=${String(x.truth).slice(0, 18).padEnd(19)} conf=${String(x.confidence).slice(0, 5).padEnd(6)}` +
                ` ml=${String(x.matchLevel).padEnd(10)} color=${JSON.stringify(x.colorText)} ` +
                ` conflicts=${JSON.stringify(x.conflicts)}`,
            );
          }
        }
      }

      writeFileSync(path.join(OUT, "wu-113-step1.json"), JSON.stringify(out, null, 1));
      expect(out).toHaveLength(2);
    },
    3_600_000,
  );
});
