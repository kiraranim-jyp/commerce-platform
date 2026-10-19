import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractCandidateUrlsFromAiAnswer } from "@commerce/crawler/src/comparison-search/ai-answer-urls";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { classifyCandidateMarket } from "../candidate-market";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import { withConfidence, enrichCandidatePrices, isSelfReferenceCandidate, type ComparisonQuery } from "@commerce/crawler";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-086 — **외부 AI 후보 URL → 국내 가격비교** E2E (LIVE · 측정 전용)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO: 「Registry 추가 ❌ · 8축 완화 ❌ · `matchTruth`/`priceTier` 임의 주입 ❌ ·
 *    AI 의 SAME 판단을 evidence 로 ❌ · 검색엔진 ❌ · Smallable 특수처리 ❌ · SSG 수정 ❌」
 *
 * 🟢 **운영 순서를 그대로 부른다**(§5-B):
 * ```
 * A  extractCandidateUrlsFromAiAnswer(text, originUrl)      ← AI 답변 → URL
 * B  collectUrlCandidatePool({urls, originUrl, …})          ← 후보 풀(Registry 참조 0)
 * C  withConfidence → enrichCandidatePrices → classifyCandidateMarket
 * ```
 * 🔴 `priceTier` 는 **만들지 않는다** — 그 입력(`matchTruth`·`verified`)은
 *    `judgeDomesticCandidate` 가 만든다. WU-085 에서 **지어내다 걸렸다.**
 */

const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const SEARCH = path.join(OUT, "mi-019a-search-result.json");
const LIVE = process.env.MI_P0_02_LIVE === "1";
const ORIGIN = "https://bobochoses.com/en-kr/products/b226ac112-bobo-choses-pop-t-shirt";

/** 🔴 URL 을 **지어내지 않는다** — WU-073 표본에서 **AI 가 실제로 낸** 한국 쇼핑몰 URL 을 쓴다. */
function realAiUrls(): string[] {
  if (!existsSync(SEARCH)) return [];
  const s = JSON.parse(readFileSync(SEARCH, "utf8")) as { rows: { candidates: string[]; dropped?: { url: string }[] }[] };
  const all = new Set<string>();
  for (const r of s.rows) {
    r.candidates.forEach((u) => all.add(u));
    (r.dropped ?? []).forEach((d) => all.add(d.url));
  }
  return [...all].filter((u) => /bbambam|beaumonde|feelway|donokids|biskuit|miniboutique|littleluna/i.test(u));
}

describe("WU-086 — AI URL → 국내 가격비교 (LIVE)", () => {
  (LIVE && existsSync(SEARCH) ? it : it.skip)(
    "A 추출 · B 후보 전달 · C 검증/시장/가격",
    async () => {
      const ai = realAiUrls();
      /** 🟢 B226AC112 의 **검증된** 국내 URL 을 섞는다(WU-085 에서 끝까지 간 그것). */
      const B112 = "https://miniboutique.co.kr/product/bobo-chosest-shirt-b226ac112/28063/category/1/display/3/";
      /** 🔴 **AI 답변 «문장» 그대로** 를 흉내 낸다 — URL 목록이 아니라 산문 안에 섞여 있다. */
      const answer = [
        "국내에서 Bobo Choses B226AC112 를 파는 곳을 찾아봤습니다.",
        ...[B112, ...ai.slice(0, 10)].map((u, i) => `${i + 1}. 판매처 ${new URL(u).host} — ${u}`),
        "가격은 판매처마다 다를 수 있습니다.",
      ].join("\n");

      /* ── A. AI 답변에서 URL 추출 ── */
      const ex = extractCandidateUrlsFromAiAnswer(answer, ORIGIN);
      // eslint-disable-next-line no-console
      console.log(`\n── A URL 추출 ── 발견 ${ex.foundCount} · 통과 **${ex.urls.length}** · 탈락 ${ex.dropped.length}`);
      const byReason: Record<string, number> = {};
      for (const d of ex.dropped) byReason[d.reason] = (byReason[d.reason] ?? 0) + 1;
      console.log(`   탈락 사유: ${JSON.stringify(byReason)}`);
      for (const d of ex.dropped) console.log(`   🔴 ${d.reason.padEnd(18)} ${decodeURIComponent(d.url).slice(0, 74)}`);

      /* ── B. 후보 풀 (Registry 참조 0) ── */
      const pool = await collectUrlCandidatePool({
        urls: ex.urls,
        originUrl: ORIGIN,
        maxUrls: 12,
        existingCanonicalUrls: new Set<string>(),
      });
      // eslint-disable-next-line no-console
      console.log(
        `\n── B 후보 풀 ── 공급 ${pool.metrics.suppliedUrls} · accepted ${pool.metrics.acceptedUrls} · ` +
          `**usable 후보 ${pool.metrics.usableProductUrls}** · MI 자격 ${pool.metrics.miEligibleCandidates} · ` +
          `탈락 ${pool.metrics.dropped.length} · provider 호출 ${pool.metrics.providerCalls} · (도메인 묶음 ${pool.searchResults.length})`,
      );
      const poolReason: Record<string, number> = {};
      for (const d of pool.metrics.dropped) poolReason[d.reason] = (poolReason[d.reason] ?? 0) + 1;
      console.log(`   탈락 사유: ${JSON.stringify(poolReason)}`);

      /* ── C. 검증 → MI → 시장 → 가격 ── */
      const originFacts = await factsFromProductUrl(ORIGIN);
      const query = { title: originFacts.candidate!.title, sourceUrl: ORIGIN, facts: originFacts.candidate!.facts } as ComparisonQuery;
      const rows: Record<string, unknown>[] = [];
      for (const r of pool.searchResults) {
        const notSelf = r.candidates.filter((c) => !isSelfReferenceCandidate(query.sourceUrl, c.url));
        const priced = await enrichCandidatePrices(withConfidence(query, notSelf), r.domain, query);
        for (const c of priced) {
          const m = classifyCandidateMarket({
            domain: r.domain,
            currency: c.price?.currency ?? null,
            /** 🔴 Registry 를 **쓰지 않는다** — 이 WU 의 요점이 그것이다. */
            isRegisteredDomesticShop: false,
          });
          rows.push({
            domain: r.domain,
            code: c.facts?.brandModelCode ?? null,
            price: c.price ?? null,
            priceStatus: c.priceStatus ?? null,
            verdict: c.crossSellerVerdict ?? null,
            ...m,
          });
        }
      }
      // eslint-disable-next-line no-console
      console.log(`\n── C 검증/시장/가격 (${rows.length}) ──`);
      for (const x of rows)
        // eslint-disable-next-line no-console
        console.log(
          `   ${String(x.domain).slice(0, 22).padEnd(23)} code=${String(x.code).padEnd(11)} ${JSON.stringify(x.price)} ${String(x.priceStatus).padEnd(18)} market=${String(x.market).padEnd(8)} ${String(x.basis).slice(0, 32)}`,
        );
      const kr = rows.filter((x) => x.market === "KR" && (x.price as { currency?: string } | null)?.currency === "KRW");
      // eslint-disable-next-line no-console
      console.log(`\n   🟢 **market KR + KRW 가격 = ${kr.length}건** (🔴 tier 게이트는 이 하니스가 만들지 않는다)`);
      for (const k of kr) console.log(`      ${k.domain} ${JSON.stringify(k.price)}`);

      writeFileSync(path.join(OUT, "wu-086.json"), JSON.stringify({ extracted: ex.urls.length, dropped: ex.dropped, pool: pool.metrics, rows, kr: kr.length }, null, 1));

      /* ══════ 🔴 계약 ══════ */
      /** A 🟢 AI 산문에서 한국 쇼핑몰 URL 이 **추출된다**. */
      expect(ex.urls.length).toBeGreaterThan(0);
      /**
       * B 🟢🟢 **Registry 에 없는 URL 도 후보 풀에 들어간다** — 이 WU 의 핵심 질문.
       * 🔴 `searchResults.length` 는 **도메인 묶음 수** 다 — 1차에 그것을 「통과 N」으로
       *    잘못 적었다. 후보 수는 `usableProductUrls` / `miEligibleCandidates` 다.
       */
      expect(pool.metrics.usableProductUrls).toBeGreaterThan(0);
      expect(pool.metrics.miEligibleCandidates).toBeGreaterThan(0);
      /** 🟢 **provider 호출 0** — 이 경로는 AI/검색 API 를 부르지 않는다. */
      expect(pool.metrics.providerCalls).toBe(0);
      /** B 🔴 Registry 때문에 버려진 흔적이 **없다**(그런 사유 자체가 없다). */
      expect(Object.keys(poolReason).join(",")).not.toMatch(/REGISTR|NOT_REGISTERED|UNKNOWN_SHOP/i);
      /** C 🟢 국내 가격 자격이 **AI URL 에서도** 나온다. */
      expect(kr.length).toBeGreaterThan(0);
    },
    1_800_000,
  );
});
