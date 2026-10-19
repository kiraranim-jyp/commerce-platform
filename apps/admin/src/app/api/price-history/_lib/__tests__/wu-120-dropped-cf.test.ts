import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractCandidateUrlsFromAiAnswer } from "@commerce/crawler/src/comparison-search/ai-answer-urls";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import { withConfidence, type ComparisonQuery } from "@commerce/crawler";
import { attachMatchTruth } from "../../../domestic-price-sources/_lib/attach-match-truth";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-120 — **②에서 잘린 URL 을 MI 까지 보내 본다** (counterfactual · 구현 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 2026-10-20: 「질문을 바꾼다 — 『상품 상세 URL 인가』가 아니라
 *    **『MI 가 동일/유사를 판단할 상품 근거를 얻을 수 있는가』**. ②에서 탈락한 URL 을
 *    **샘플이 아니라 전수로** MI 까지 보내 **경우 A(AI 가 못 찾음) ↔ 경우 B(우리가 버림)**
 *    를 가른다.」 🔴 가격 ❌ · GT 저장 ❌ · snapshot 재사용 ❌ · 8축 ❌ · threshold ❌.
 *
 * 🟢 **운영 함수만 쓴다** — 추출기를 우회해 `factsFromProductUrl` 에 **직접** 넣고,
 *    근거가 나오면 `withConfidence` + `attachMatchTruth` 로 **운영 판정** 을 받는다.
 * 🔴 운영 코드 한 줄도 바꾸지 않았다(필터를 «우회해 재는» 것이지 «푸는» 것이 아니다).
 */
const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const SEARCH = path.join(OUT, "mi-019a-search-result.json");
const LIVE = process.env.MI_P0_02_LIVE === "1";

const CASES = [
  { sid: "S1", code: "B226AC010", origin: "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt" },
  { sid: "S2", code: "B226AC009", origin: "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt" },
] as const;

const isKr = (u: string) => {
  try {
    const h = new URL(u).hostname.toLowerCase();
    return h.endsWith(".kr") || h.endsWith(".co.kr");
  } catch {
    return false;
  }
};
const tally = (xs: string[]) => xs.reduce<Record<string, number>>((a, k) => ((a[k] = (a[k] ?? 0) + 1), a), {});

describe("WU-120 — ②탈락 URL 의 MI counterfactual (LIVE)", () => {
  (existsSync(SEARCH) && LIVE ? it : it.skip)(
    "경우 A 와 B 를 가른다",
    async () => {
      const s = JSON.parse(readFileSync(SEARCH, "utf8")) as {
        rows: { searchId: string; candidates?: string[]; dropped?: { url: string }[]; knownAnswersFound?: string[]; unverifiedNew?: string[] }[];
      };
      const report: Record<string, unknown>[] = [];

      for (const c of CASES) {
        const raw = new Set<string>();
        for (const r of s.rows.filter((x) => x.searchId === c.sid)) {
          (r.candidates ?? []).forEach((u) => raw.add(u));
          (r.dropped ?? []).forEach((d) => raw.add(d.url));
          (r.knownAnswersFound ?? []).forEach((u) => raw.add(u));
          (r.unverifiedNew ?? []).forEach((u) => raw.add(u));
        }
        const all = [...raw].filter((u) => u !== c.origin);
        const kept = new Set(
          extractCandidateUrlsFromAiAnswer(all.map((u, i) => `${i + 1}. ${u}`).join("\n"), null).urls,
        );
        /** 🔴 ②에서 **잘린** 것 전수. */
        const dropped = all.filter((u) => !kept.has(u));

        const of_ = await factsFromProductUrl(c.origin);
        const q = {
          title: of_.candidate!.title,
          sourceUrl: of_.crawlerUrl!,
          facts: of_.candidate!.facts,
        } as ComparisonQuery;

        const rows: Record<string, unknown>[] = [];
        for (const u of dropped) {
          const f = await factsFromProductUrl(u).catch(() => null);
          const cand = f?.candidate ?? null;
          let verdict: string | null = null;
          let truth: string | null = null;
          if (cand) {
            const t = await attachMatchTruth(
              [{ shopId: "wu120", shopName: "cf", domain: new URL(u).hostname, status: "ok", candidates: withConfidence(q, [cand]) } as never],
              q.facts?.brandModelCode ?? null,
              q.facts?.colorText ?? null,
            );
            const x = t[0].candidates[0] as { crossSellerVerdict?: string | null; matchTruth?: string | null };
            verdict = x?.crossSellerVerdict ?? null;
            truth = x?.matchTruth ?? null;
          }
          rows.push({
            url: u,
            kr: isKr(u),
            shape: classifyUrlShape(u),
            status: f?.status ?? "THREW",
            /** 🔴 「상품 근거를 얻었는가」 = 운영 facts 가 섰는가(제목 + 브랜드/품번 중 하나). */
            hasEvidence: Boolean(cand?.title) && Boolean(cand?.facts?.brand || cand?.facts?.brandModelCode),
            title: cand?.title ?? null,
            code: cand?.facts?.brandModelCode ?? null,
            verdict,
            truth,
          });
        }

        const kr = rows.filter((r) => r.kr);
        const os = rows.filter((r) => !r.kr);
        const ev = (xs: Record<string, unknown>[]) => xs.filter((r) => r.hasEvidence);
        // eslint-disable-next-line no-console
        console.log(
          `\n════ ${c.sid} / ${c.code} ════\n` +
            `  ②탈락 전수 **${dropped.length}** (🇰🇷 ${kr.length} · 🌎 ${os.length})\n` +
            `  그중 상품 근거 확보 — 🇰🇷 **${ev(kr).length}** · 🌎 **${ev(os).length}**\n` +
            `  status ${JSON.stringify(tally(rows.map((r) => String(r.status))))}\n` +
            `  모양  ${JSON.stringify(tally(rows.map((r) => String(r.shape))))}\n` +
            `  판정  ${JSON.stringify(tally(rows.filter((r) => r.verdict).map((r) => String(r.verdict))))}`,
        );
        for (const r of rows.filter((x) => x.hasEvidence))
          // eslint-disable-next-line no-console
          console.log(
            `   ${r.kr ? "🇰🇷" : "🌎"} ${String(r.shape).padEnd(14)} v=${String(r.verdict).padEnd(14)}` +
              ` code=${String(r.code).padEnd(11)} ${String(r.title).slice(0, 42)}  ${String(r.url).slice(0, 60)}`,
          );

        report.push({ sid: c.sid, droppedTotal: dropped.length, kr: kr.length, os: os.length, evidenceKr: ev(kr).length, evidenceOs: ev(os).length, rows });
      }

      writeFileSync(path.join(OUT, "wu-120.json"), JSON.stringify(report, null, 1));
      expect(report).toHaveLength(2);
    },
    3_600_000,
  );
});
