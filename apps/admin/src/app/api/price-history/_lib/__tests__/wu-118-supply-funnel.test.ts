import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractCandidateUrlsFromAiAnswer } from "@commerce/crawler/src/comparison-search/ai-answer-urls";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import { withConfidence, isSelfReferenceCandidate, type ComparisonQuery } from "@commerce/crawler";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { attachMatchTruth } from "../../../domestic-price-sources/_lib/attach-match-truth";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-118 — **후보 공급 단계별 탈락 전수** (측정 전용 · 구현 0 · 가격 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 2026-10-20: 「가격 중단 · 8축 ❌ · Registry ❌ · UI ❌.
 *    **「동일상품 후보 공급률」** 만 본다. 국내/해외를 **분리** 해서 단계별 숫자만 잡는다.
 *    그리고 **사람이 SAME 이라 판정한 URL 이 왜 후보 풀에 안정적으로 남지 않는지** 까지 확인한다.」
 *
 * 🔴🔴 **칸 이름을 코드에서 읽었다** — 풀 산출은 `pool.metrics` 아래다
 *    (`suppliedUrls · acceptedUrls · usableProductUrls · miEligibleCandidates · fetchCalls · dropped[]`).
 *    🔴 WU-116 에서 내가 `pool.droppedUrls` 를 읽어 「탈락 사유 []」로 찍었다 —
 *       **이 트랙에서 반복된 「칸 이름 추측」 오류** 이고 그 줄은 **무효** 다.
 *
 * 🔴 가격 경로를 부르지 않는다 — `enrichCandidatePrices` 0 · `judgeDomesticCandidate` 0.
 */
const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const SEARCH = path.join(OUT, "mi-019a-search-result.json");
const LIVE = process.env.MI_P0_02_LIVE === "1";
const GT = path.join(__dirname, "fixtures/wu-112-human-gt.json");

const CASES = [
  { sid: "S1", code: "B226AC010", origin: "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt" },
  { sid: "S2", code: "B226AC009", origin: "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt" },
] as const;

/** 🔴 국내/해외는 **도메인 표기** 로만 가른다(시장 확정은 가격·통화가 필요해 이번 범위 밖). */
const isKrDomain = (u: string) => {
  try {
    const h = new URL(u).hostname.toLowerCase();
    return h.endsWith(".kr") || h.endsWith(".co.kr");
  } catch {
    return false;
  }
};
const tally = (xs: string[]) =>
  xs.reduce<Record<string, number>>((a, k) => ((a[k] = (a[k] ?? 0) + 1), a), {});

async function runPool(urls: string[], q: ComparisonQuery) {
  const pool = await collectUrlCandidatePool({
    urls,
    originUrl: q.sourceUrl ?? null,
    maxUrls: 200,
    existingCanonicalUrls: new Set<string>(),
  });
  let candidates = 0;
  for (const r of pool.searchResults) {
    const notSelf = r.candidates.filter((x) => !isSelfReferenceCandidate(q.sourceUrl, x.url));
    if (notSelf.length === 0) continue;
    const t = await attachMatchTruth(
      [{ ...r, candidates: withConfidence(q, notSelf) }],
      q.facts?.brandModelCode ?? null,
      q.facts?.colorText ?? null,
    );
    candidates += t[0].candidates.length;
  }
  return { m: pool.metrics, candidates, shops: pool.searchResults.length };
}

describe("WU-118 — 후보 공급 단계별 탈락 (LIVE)", () => {
  (existsSync(SEARCH) && LIVE ? it : it.skip)(
    "국내/해외를 분리해 단계마다 몇 개가 죽는지 센다",
    async () => {
      const gt = JSON.parse(readFileSync(GT, "utf8")).candidates as {
        sid: string;
        url: string;
        verdict: string;
      }[];
      const s = JSON.parse(readFileSync(SEARCH, "utf8")) as {
        rows: { searchId: string; candidates?: string[]; dropped?: { url: string }[]; knownAnswersFound?: string[]; unverifiedNew?: string[] }[];
      };
      const report: Record<string, unknown>[] = [];

      for (const c of CASES) {
        const of_ = await factsFromProductUrl(c.origin);
        const q = {
          title: of_.candidate!.title,
          sourceUrl: of_.crawlerUrl!,
          facts: of_.candidate!.facts,
        } as ComparisonQuery;

        /* ── ① 저장된 AI 답변 전체 → 단계별 ── */
        const raw = new Set<string>();
        for (const r of s.rows.filter((x) => x.searchId === c.sid)) {
          (r.candidates ?? []).forEach((u) => raw.add(u));
          (r.dropped ?? []).forEach((d) => raw.add(d.url));
          (r.knownAnswersFound ?? []).forEach((u) => raw.add(u));
          (r.unverifiedNew ?? []).forEach((u) => raw.add(u));
        }
        const urlsAll = [...raw].filter((u) => u !== c.origin);
        const ex = extractCandidateUrlsFromAiAnswer(
          urlsAll.map((u, i) => `${i + 1}. ${u}`).join("\n"),
          null,
        );
        const all = await runPool([...ex.urls], q);

        const krSupplied = urlsAll.filter(isKrDomain);
        const krExtracted = [...ex.urls].filter(isKrDomain);
        const krShape = krExtracted.filter((u) => classifyUrlShape(u) === "PRODUCT_PAGE");
        const osSupplied = urlsAll.filter((u) => !isKrDomain(u));
        const osExtracted = [...ex.urls].filter((u) => !isKrDomain(u));
        const osShape = osExtracted.filter((u) => classifyUrlShape(u) === "PRODUCT_PAGE");

        /* ── ② Human SAME URL 재투입 — 「왜 안 남는가」 ── */
        const sameUrls = gt.filter((g) => g.sid === c.sid && g.verdict === "SAME").map((g) => g.url);
        const replay = await runPool(sameUrls, q);

        // eslint-disable-next-line no-console
        console.log(
          `\n════ ${c.sid} / ${c.code} ════\n` +
            `  ① AI 답변 URL **${urlsAll.length}** (🇰🇷 ${krSupplied.length} · 🌎 ${osSupplied.length})\n` +
            `  ② URL 추출 통과 ${ex.urls.length} (🇰🇷 ${krExtracted.length} · 🌎 ${osExtracted.length})\n` +
            `  ③ 상세 URL 모양 — 🇰🇷 ${krShape.length} · 🌎 ${osShape.length}\n` +
            `  ④ 풀 accepted ${all.m.acceptedUrls} → ⑤ 상품확인(usable) **${all.m.usableProductUrls}**` +
            ` → ⑥ MI 자격 ${all.m.miEligibleCandidates} · fetch ${all.m.fetchCalls}\n` +
            `  ⑦ 후보 등록 **${all.candidates}** (샵 ${all.shops})\n` +
            `  탈락 사유 ${JSON.stringify(tally(all.m.dropped.map((d) => d.reason)))}\n` +
            `  🔴 Human SAME URL 재투입 ${sameUrls.length}건 → accepted ${replay.m.acceptedUrls} ·` +
            ` usable **${replay.m.usableProductUrls}** · 후보 **${replay.candidates}**\n` +
            `     재투입 탈락 ${JSON.stringify(tally(replay.m.dropped.map((d) => d.reason)))}`,
        );
        for (const d of replay.m.dropped)
          // eslint-disable-next-line no-console
          console.log(`     🔴 ${String(d.reason).padEnd(24)} ${d.url.slice(0, 72)}`);

        report.push({
          sid: c.sid,
          supplied: { total: urlsAll.length, kr: krSupplied.length, os: osSupplied.length },
          extracted: { total: ex.urls.length, kr: krExtracted.length, os: osExtracted.length },
          productShape: { kr: krShape.length, os: osShape.length },
          pool: all.m,
          candidates: all.candidates,
          sameReplay: { supplied: sameUrls.length, metrics: replay.m, candidates: replay.candidates },
        });
      }

      writeFileSync(path.join(OUT, "wu-118.json"), JSON.stringify(report, null, 1));
      expect(report).toHaveLength(2);
    },
    3_600_000,
  );
});
