import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractCandidateUrlsFromAiAnswer } from "@commerce/crawler/src/comparison-search/ai-answer-urls";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { withConfidence, enrichCandidatePrices, isSelfReferenceCandidate, type ComparisonQuery } from "@commerce/crawler";
import { classifyCandidateMarket } from "../candidate-market";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-087 — **실제 AI 결과 한 덩어리 → 국내/해외 가격비교** 운영 E2E (측정 전용)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO: 「AI API ❌ · 자동 브라우저 ❌ · 검색엔진 ❌ · AI 의 SAME 판정 ❌ ·
 *    8축 ❌ · **코드 변경 0 이 기본값**」
 *
 * 🔴🔴 **「한 덩어리」의 출처를 정확히 적는다** — 새 AI 를 부르지 않았다(금지).
 *    WU-073 이 저장한 **실제 AI 산출**(4개 모델 · Bobo Choses 상품군 · URL 181)을 쓴다.
 *    🔴 그래서 이것은 「B226AC112 를 새로 조사시킨 결과」가 **아니다** — 그 한계를 §13 에 적는다.
 *
 * 🟢 운영 owner 를 그대로 부른다: `extractCandidateUrlsFromAiAnswer` →
 *    `classifyUrlShape` → `factsFromProductUrl` → `classifyCandidateMarket`.
 * 🔴 `priceTier` 는 **만들지 않는다**(WU-085 에서 지어내다 걸렸다).
 */

const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const SEARCH = path.join(OUT, "mi-019a-search-result.json");
const CACHE = path.join(OUT, "wu-087-cache.json");
const LIVE = process.env.MI_P0_02_LIVE === "1";
const READY = existsSync(SEARCH);

/** 🔴 서술용 라벨이다 — 운영 규칙이 아니다(운영은 `classifyCandidateMarket`). */
const KRISH = (h: string) =>
  /\.kr$|\.co\.kr|kihanan|biskuit|mustit|trenbe|luxboy|donokids|kids21|coupang|naver|ssg|lfmall|croket|luksus|miniboutique|beaumonde|littleluna|wconcept|lotteon|feelway|bbambam|ocokorea/i.test(h);
const host = (u: string) => {
  try {
    return new URL(u).host;
  } catch {
    return "";
  }
};

describe("WU-087 — AI 결과 전체 funnel", () => {
  (READY && LIVE ? it : it.skip)(
    "① 추출 ② 상품페이지 ③ fetch/evidence ④ market ⑤ 가격 — 국내/해외 분리",
    async () => {
      /* ── 입력: 저장된 실제 AI 산출을 **답변 산문** 으로 되돌린다 ── */
      const s = JSON.parse(readFileSync(SEARCH, "utf8")) as { rows: { candidates: string[]; dropped?: { url: string }[] }[] };
      const all = new Set<string>();
      for (const r of s.rows) {
        r.candidates.forEach((u) => all.add(u));
        (r.dropped ?? []).forEach((d) => all.add(d.url));
      }
      const aiUrls = [...all];
      const answer =
        "동일상품 후보 판매처를 찾았습니다.\n" +
        aiUrls.map((u, i) => `${i + 1}. ${host(u)} — ${u}`).join("\n") +
        "\n가격은 판매처마다 다를 수 있습니다.";

      /* ── ① URL 추출(운영) ── */
      const ex = extractCandidateUrlsFromAiAnswer(answer, null);
      const exDrop: Record<string, number> = {};
      for (const d of ex.dropped) exDrop[d.reason] = (exDrop[d.reason] ?? 0) + 1;

      /* ── ② URL 모양(운영) ── */
      const shapes: Record<string, number> = {};
      for (const u of aiUrls) shapes[classifyUrlShape(u)] = (shapes[classifyUrlShape(u)] ?? 0) + 1;

      /* ── ③④⑤ fetch → evidence → market → price (운영 owner · 캐시) ── */
      type Rec = { url: string; host: string; kr: boolean; status: string; fetchPath: string; brand: string | null; code: string | null; price: { amount: number; currency: string } | null; priceStatus: string | null; market: string; basis: string };
      const cache: Record<string, Rec> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
      let n = 0;
      for (const u of ex.urls) {
        if (cache[u]) continue;
        let rec: Rec;
        try {
          const f = await factsFromProductUrl(u);
          const price = f.candidate?.price ?? null;
          const m = classifyCandidateMarket({
            domain: host(u).replace(/^www\./, ""),
            currency: price?.currency ?? null,
            /** 🔴 Registry 를 쓰지 않는다 — WU-086 이 그 독립성을 확정했다. */
            isRegisteredDomesticShop: false,
          });
          rec = {
            url: u, host: host(u), kr: KRISH(host(u)),
            status: f.status, fetchPath: f.fetchPath,
            brand: f.candidate?.facts?.brand ?? null,
            code: f.candidate?.facts?.brandModelCode ?? null,
            price, priceStatus: f.candidate?.priceStatus ?? null,
            market: m.market, basis: m.basis,
          };
        } catch (e) {
          rec = { url: u, host: host(u), kr: KRISH(host(u)), status: "__THREW__", fetchPath: "NONE", brand: null, code: null, price: null, priceStatus: String(e).slice(0, 60), market: "UNKNOWN", basis: "__THREW__" };
        }
        cache[u] = rec;
        if (++n % 10 === 0) writeFileSync(CACHE, JSON.stringify(cache));
      }
      writeFileSync(CACHE, JSON.stringify(cache));
      const recs = ex.urls.map((u) => cache[u]).filter(Boolean);

      /**
       * 🔴🔴 **1차 측정이 틀렸다 — 가격을 «운영 경로로» 재지 않았다.**
       *    `factsFromProductUrl` 만 부르면 `fetchPath = SHOPIFY_JSON` 인 후보는
       *    **설계상 `price: null`** 이다(통화를 모른다 · product-url-facts 주석).
       *    실측: 가격 없는 57건 중 **53건이 SHOPIFY_JSON** 이었다.
       * 🟢 운영은 그 뒤 `enrichCandidatePrices` 로 채운다(run-domestic-price-check:1078).
       *    그래서 **그 경로를 그대로** 한 번 더 돌려 ⑤~⑦ 을 다시 잰다(WU-079 와 같은 교훈).
       */
      const originFacts = await factsFromProductUrl("https://bobochoses.com/en-kr/products/b226ac112-bobo-choses-pop-t-shirt");
      const query = { title: originFacts.candidate!.title, sourceUrl: originFacts.crawlerUrl!, facts: originFacts.candidate!.facts } as ComparisonQuery;
      const pool = await collectUrlCandidatePool({ urls: ex.urls, originUrl: query.sourceUrl ?? null, maxUrls: 200, existingCanonicalUrls: new Set<string>() });
      const opRows: { host: string; kr: boolean; price: { amount: number; currency: string } | null; market: string; basis: string; code: string | null }[] = [];
      for (const r of pool.searchResults) {
        const notSelf = r.candidates.filter((c) => !isSelfReferenceCandidate(query.sourceUrl, c.url));
        const priced = await enrichCandidatePrices(withConfidence(query, notSelf), r.domain, query);
        for (const c of priced) {
          const m = classifyCandidateMarket({ domain: r.domain, currency: c.price?.currency ?? null, isRegisteredDomesticShop: false });
          opRows.push({ host: r.domain, kr: KRISH(r.domain), price: c.price ?? null, market: m.market, basis: m.basis, code: c.facts?.brandModelCode ?? null });
        }
      }
      const opPrice = opRows.filter((r) => r.price != null);
      const opKr = opPrice.filter((r) => r.market === "KR" && r.price?.currency === "KRW");
      const opOs = opPrice.filter((r) => r.market === "OVERSEAS");
      // eslint-disable-next-line no-console
      console.log(`
🟢🟢 **운영 경로(enrichCandidatePrices 포함) 재측정** — 후보 ${opRows.length} · 가격 ${opPrice.length}(국내 ${opPrice.filter((r) => r.kr).length} · 해외 ${opPrice.filter((r) => !r.kr).length}) · **국내 자격 ${opKr.length}** · 해외 ${opOs.length}`);
      for (const d of opKr) console.log(`     🇰🇷 ${d.host.padEnd(24)} ${JSON.stringify(d.price)} code=${d.code}`);

      /* ── 표 ── */
      const split = (xs: Rec[]) => [xs.length, xs.filter((x) => x.kr).length, xs.length - xs.filter((x) => x.kr).length] as const;
      const ok = recs.filter((r) => r.status === "OK");
      const withEvidence = ok.filter((r) => r.brand || r.code);
      const withPrice = ok.filter((r) => r.price != null);
      const krMarket = withPrice.filter((r) => r.market === "KR");
      const osMarket = withPrice.filter((r) => r.market === "OVERSEAS");
      const domQual = krMarket.filter((r) => r.price?.currency === "KRW");

      const line = (label: string, t: readonly [number, number, number]) =>
        `  ${label.padEnd(22)} ${String(t[0]).padStart(5)} ${String(t[1]).padStart(6)} ${String(t[2]).padStart(6)}`;
      // eslint-disable-next-line no-console
      console.log(`\n════════ WU-087 — AI 결과 전체 funnel ════════`);
      // eslint-disable-next-line no-console
      console.log(`  단계                    전체    국내    해외`);
      const aiRecs = aiUrls.map((u) => ({ kr: KRISH(host(u)) })) as Rec[];
      // eslint-disable-next-line no-console
      console.log(line("① AI URL", split(aiRecs)));
      // eslint-disable-next-line no-console
      console.log(line("② URL 추출", split(ex.urls.map((u) => ({ kr: KRISH(host(u)) })) as Rec[])));
      // eslint-disable-next-line no-console
      console.log(line("③ fetch OK", split(ok)));
      // eslint-disable-next-line no-console
      console.log(line("④ evidence(브랜드/품번)", split(withEvidence)));
      // eslint-disable-next-line no-console
      console.log(line("⑤ 가격", split(withPrice)));
      // eslint-disable-next-line no-console
      console.log(line("⑥ market 확정", split([...krMarket, ...osMarket])));
      // eslint-disable-next-line no-console
      console.log(line("⑦ 국내/해외 자격", split([...domQual, ...osMarket])));

      // eslint-disable-next-line no-console
      console.log(`\n  ── ① 추출 탈락 사유 ── ${JSON.stringify(exDrop)}`);
      // eslint-disable-next-line no-console
      console.log(`  ── ② URL 모양(운영 classifyUrlShape) ── ${JSON.stringify(shapes)}`);
      const statusDist: Record<string, number> = {};
      for (const r of recs) statusDist[r.status] = (statusDist[r.status] ?? 0) + 1;
      // eslint-disable-next-line no-console
      console.log(`  ── ③ fetch 결과 ── ${JSON.stringify(statusDist)}`);
      const basisDist: Record<string, number> = {};
      for (const r of withPrice) basisDist[r.basis] = (basisDist[r.basis] ?? 0) + 1;
      // eslint-disable-next-line no-console
      console.log(`  ── ④ market basis(가격 있는 것만) ── ${JSON.stringify(basisDist)}`);
      // eslint-disable-next-line no-console
      console.log(`\n  🟢 **국내 가격 자격(market KR && KRW): ${domQual.length}건** · 해외(OVERSEAS): ${osMarket.length}건`);
      for (const d of domQual) console.log(`     🇰🇷 ${d.host.padEnd(24)} ${JSON.stringify(d.price)} code=${d.code}`);

      writeFileSync(path.join(OUT, "wu-087.json"), JSON.stringify({ ai: aiUrls.length, extracted: ex.urls.length, exDrop, shapes, statusDist, basisDist, domQual: domQual.length, overseas: osMarket.length }, null, 1));

      /* ══════ 🔴 계약 ══════ */
      expect(aiUrls.length).toBe(181);
      expect(ex.urls.length).toBeGreaterThan(0);
      /** 🔴 추출 탈락은 **상품 페이지가 아님** 이 지배적이어야 한다(Registry 사유 0). */
      expect(Object.keys(exDrop).join(",")).not.toMatch(/REGISTR|NOT_REGISTERED/i);
      /** 🟢 국내 가격 자격이 **0 이 아니다**. */
      expect(domQual.length).toBeGreaterThan(0);
    },
    3_600_000,
  );
});
