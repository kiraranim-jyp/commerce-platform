import { writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractCandidateUrlsFromAiAnswer } from "@commerce/crawler/src/comparison-search/ai-answer-urls";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import { withConfidence, enrichCandidatePrices, isSelfReferenceCandidate, type ComparisonQuery } from "@commerce/crawler";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { attachMatchTruth } from "../../../domestic-price-sources/_lib/attach-match-truth";
import { judgeDomesticCandidate } from "../run-domestic-price-check";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-104 — **동일상품 5건을 «개별로» 추적한다** (LIVE · 구현 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO: 「새 AI 호출 ❌ · 코드 ❌ · URL 품번 **외에** brand/code/color/host/facts 로
 *    **교차검증** · 5건 **각각** 7단계 trace · 5/5 가 후단에 도달했는지 **확정**」
 * 🔴 WU-103 의 「풀 소실」 계산이 **거칠었다**(통과 3·소실 1 동시 발생) — 이번엔
 *    **URL 단위로 한 건씩** 돌려 그 모호함을 없앤다.
 */
const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const LIVE = process.env.MI_P0_02_LIVE === "1";

/** 🔴 WU-103 이 찾은 동일상품 5건. 🔴 URL 을 **지어내지 않았다** — 저장 AI 산출 그대로. */
const CASES = [
  { sid: "S1", code: "B226AC010", origin: "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt",
    url: "https://bobochoses.com/ko-kr/products/b226ac010-booty-ghosts-t-shirt" },
  { sid: "S1", code: "B226AC010", origin: "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt",
    url: "https://search.shopping.naver.com/search/all?query=B226AC010" },
  { sid: "S2", code: "B226AC009", origin: "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt",
    url: "https://global.trenbe.com/products/bobo-choses-kids-hug-hairy-monster-long-sleeve-t-shirt-light-blue-b226ac009-451-160484657-p" },
  { sid: "S2", code: "B226AC009", origin: "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt",
    url: "https://www.skroutz.ro/s/69624733/bobo-choses-bluza-pentru-copii-cu-maneca-lunga-hug-hairy-monster-b226ac009.html" },
  { sid: "S2", code: "B226AC009", origin: "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt",
    url: "https://biskuit.kr/product/%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88-%ED%97%88%EA%B7%B8-%ED%97%A4%EC%96%B4%EB%A6%AC-%EB%AA%AC%EC%8A%A4%ED%84%B0-%ED%8B%B0%EC%85%94%EC%B8%A0-b226ac009/8891/category/367/display/1/" },
] as const;

describe("WU-104 — 동일상품 5건 개별 trace (LIVE)", () => {
  (LIVE ? it : it.skip)(
    "① AI 존재 ~ ⑦ JUDGED 까지 한 건씩",
    async () => {
      /** 🟢 원상품 facts 를 케이스별로 한 번만 만든다. */
      const originCache = new Map<string, ComparisonQuery>();
      const rows: Record<string, unknown>[] = [];

      for (const c of CASES) {
        if (!originCache.has(c.origin)) {
          const of_ = await factsFromProductUrl(c.origin);
          originCache.set(c.origin, {
            title: of_.candidate!.title, sourceUrl: of_.crawlerUrl!, facts: of_.candidate!.facts,
          } as ComparisonQuery);
        }
        const q = originCache.get(c.origin)!;

        /* ── ① AI 원본에 존재 (WU-103 이 그 목록에서 뽑았으므로 참) ── */
        const inAi = true;
        /* ── ② URL extraction ── */
        const ex = extractCandidateUrlsFromAiAnswer(`1. ${c.url}`, null);
        const extracted = ex.urls.includes(c.url);
        /* ── ③ product-page 판정 ── */
        const shape = classifyUrlShape(c.url);
        /* ── ④⑤ fetch + facts (운영 단일 owner) ── */
        const f = await factsFromProductUrl(c.url);
        /* ── ⑥ candidate pool ── */
        const pool = await collectUrlCandidatePool({
          urls: extracted ? [c.url] : [], originUrl: q.sourceUrl ?? null, maxUrls: 5, existingCanonicalUrls: new Set<string>(),
        });
        const drop = pool.metrics.dropped.find((d) => d.url === c.url)?.reason ?? null;
        let inPool = false;
        let judged = "미도달";
        let cand: Record<string, unknown> = {};
        for (const r of pool.searchResults) {
          const notSelf = r.candidates.filter((x) => !isSelfReferenceCandidate(q.sourceUrl, x.url));
          if (notSelf.length === 0) { judged = "자기참조 제외"; continue; }
          const priced = await enrichCandidatePrices(withConfidence(q, notSelf), r.domain, q);
          const t = await attachMatchTruth([{ ...r, candidates: priced }], q.facts?.brandModelCode ?? null, q.facts?.colorText ?? null);
          const x = t[0].candidates[0];
          if (!x) continue;
          inPool = true;
          /** 🟢 **품번 외 축으로 교차검증** (CPO 요구) — 전부 운영 facts 에서 읽는다. */
          cand = {
            host: new URL(x.url).host,
            brand: x.facts?.brand ?? null,
            code: x.facts?.brandModelCode ?? null,
            color: x.facts?.colorText ?? null,
            price: x.price ?? null,
            verdict: x.crossSellerVerdict ?? null,
            matchTruth: x.matchTruth ?? null,
            matchLevel: x.matchLevel ?? null,
          };
          const j = await judgeDomesticCandidate({
            domain: r.domain, candidates: t[0].candidates, sourceUrl: q.sourceUrl,
            foreignModelCode: q.facts?.brandModelCode ?? null, foreignColor: q.facts?.colorText ?? null,
            fetchModelCode: async () => null,
          });
          judged = j.kind === "JUDGED" ? `JUDGED/${j.priceTier}` : j.kind === "DROPPED" ? `DROPPED/${j.gate}` : j.kind;
        }

        const oq = originCache.get(c.origin)!;
        const sameHost = (() => { try { return new URL(c.url).host.replace(/^www\./, "") === new URL(c.origin).host.replace(/^www\./, ""); } catch { return false; } })();
        const row = {
          sid: c.sid, code: c.code, url: c.url, sameHostAsOrigin: sameHost,
          "①AI": inAi, "②추출": extracted, "③모양": shape, "④⑤facts": f.status,
          factsCode: f.candidate?.facts?.brandModelCode ?? null,
          factsBrand: f.candidate?.facts?.brand ?? null,
          factsColor: f.candidate?.facts?.colorText ?? null,
          "⑥풀": inPool ? "통과" : (drop ?? "탈락(사유없음)"),
          "⑦판정": judged,
          origin: { brand: oq.facts?.brand ?? null, code: oq.facts?.brandModelCode ?? null, color: oq.facts?.colorText ?? null },
        };
        rows.push(row);
        // eslint-disable-next-line no-console
        console.log(
          `\n── ${c.sid} ${new URL(c.url).host} ──\n  ①AI ${inAi ? "🟢" : "🔴"} · ②추출 ${extracted ? "🟢" : "🔴"} · ③모양 ${shape} · ④⑤facts ${f.status}` +
            `\n  교차검증  code=${JSON.stringify(row.factsCode)} brand=${JSON.stringify(row.factsBrand)} color=${JSON.stringify(row.factsColor)}` +
            `  (원상품 code=${JSON.stringify(row.origin.code)} brand=${JSON.stringify(row.origin.brand)} color=${JSON.stringify(row.origin.color)})` +
            `\n  ⑥풀 ${row["⑥풀"]} · ⑦판정 **${judged}** · 같은호스트=${sameHost ? "🔴 예" : "🟢 아니오"}`,
        );
      }
      const reached = rows.filter((r) => String(r["⑦판정"]).startsWith("JUDGED")).length;
      // eslint-disable-next-line no-console
      console.log(`\n🔴🔴 **후단(JUDGED) 도달 ${reached} / ${rows.length}**`);
      writeFileSync(path.join(OUT, "wu-104.json"), JSON.stringify(rows, null, 1));
      expect(rows).toHaveLength(5);
    },
    3_600_000,
  );
});
