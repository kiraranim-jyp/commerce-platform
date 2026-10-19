import { writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import {
  searchDomesticShops,
  withConfidence,
  isSelfReferenceCandidate,
  type ComparisonQuery,
} from "@commerce/crawler";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-092 STEP 3 — **A(discovery) / B(extraction) / C(matching)** (LIVE)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO §3: 「셋을 절대 한 문장으로 『동일상품을 못 찾음』이라 보고하지 않는다」
 * 🔴 금지: 8축 ❌ · matchLevel ❌ · threshold ❌ · 가격 게이트 ❌ · AI ❌ ·
 *    Registry **변경** ❌ · 가격 계산 ❌ · 후보 판정 기준 ❌
 *
 * ── 🔴 등록부는 «DB 로 읽은 실제 값» 을 그대로 쓴다 ──────────────────────────
 * `listDomesticPriceSources` 는 로컬에서 `SUPABASE_SERVICE_ROLE_KEY` 가 없어 **조용히
 * `[]`** 를 준다. 그대로 두면 「후보 0 = 검색 실패」라는 **틀린 결론** 이 난다(헌장 §12).
 * 🟢 그래서 **운영 DB 에서 읽은 7곳**(AUTO_* + enabled + KIDS_FASHION)을 박아 둔다.
 * 🔴 이 목록을 **늘리지 않는다** — Registry 확대는 금지다. 운영이 지금 뒤지는 그대로다.
 */

const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const LIVE = process.env.MI_P0_02_LIVE === "1";

/**
 * 🟢 2026-10-19 DB 실측(`domestic_price_sources`):
 *    전체 34곳 · AUTO_* 이면서 enabled 인 곳 **7**.
 *    🔴 `biskuit.kr` 은 **등록부에 없다** · `bobochoses.com` 은 있으나 **enabled=false**.
 */
/**
 * 🔴🔴 **1차 하니스가 틀렸고 그것을 적는다** — 처음에 `{id,name,domain}` 만 넣고
 *    `as never` 로 타입을 **가렸다**. `DomesticSourceRef` 는 `currency` 와
 *    `collectionStrategy` 를 요구하고, 후자가 없으면 운영이 **요청을 보내지 않고**
 *    `status:"unsupported"` 를 돌려준다(index.ts:251 주석).
 *    ⟹ 🔴 **6/6 unsupported · 후보 0** 이 나왔고 그대로 보고했으면
 *    **「A_DISCOVERY 에서 끊긴다」는 거짓 결론** 이었다.
 * 🟢 아래 값은 **운영 DB 에서 읽은 그대로** 다(2026-10-19 · `enabled AND AUTO%`).
 */
const SHOPS = [
  { id: "1479ca9d-8a13-4cf2-813a-0e25ec3c9439", name: "CHOCO.EL(초코엘)", domain: "chocoel.co.kr", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" as const },
  { id: "03677bb2-da2d-4603-ba8c-67f673c8b245", name: "DEUXBEBE(듀베베)", domain: "deuxbebe.com", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" as const },
  { id: "85b573b1-2f89-4a4f-a54c-40391d211800", name: "포레포레", domain: "foretforet.com", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" as const },
  { id: "04e8aa1d-b430-4d4b-b453-1c9f7a808e23", name: "LITTLE LUNA(리틀루나)", domain: "littleluna.co.kr", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" as const },
  { id: "bd66e5ab-94d0-44ce-bc45-bedf706aebcf", name: "LOOXLOO", domain: "looxloo.com", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" as const },
  { id: "4de6b18e-cc58-4eb9-9def-b2fb96ef2350", name: "RULII(루리샵)", domain: "rulii.co.kr", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" as const },
];

const CASES = [
  {
    id: "S1-biskuit-B226AC009",
    code: "B226AC009",
    url: "https://biskuit.kr/product/%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88-%ED%97%88%EA%B7%B8-%ED%97%A4%EC%96%B4%EB%A6%AC-%EB%AA%AC%EC%8A%A4%ED%84%B0-%ED%8B%B0%EC%85%94%EC%B8%A0-b226ac009/8891/category/367/display/1/?utm_source=chatgpt.com",
  },
  {
    id: "S2-bobo-B226AC042",
    code: "B226AC042",
    url: "https://bobochoses.com/en-kr/products/b226ac042-mystery-bc-half-zipped-sweatshirt?pr_prod_strat=similar&pr_rec_id=793ca40cb&pr_rec_pid=1569266t1588351&pr_ref_pid=15692661621119&pr_seq=uniform&utm_source=chatgpt.com",
  },
] as const;

describe("WU-092 STEP 3 — A/B/C (LIVE)", () => {
  (LIVE ? it : it.skip)(
    "운영 7곳에서 실제로 뒤지고, 끊기는 지점을 셋으로 가른다",
    async () => {
      const report: Record<string, unknown>[] = [];
      for (const c of CASES) {
        /* ── 원상품 — 운영 owner 로 만든다(손으로 짓지 않는다) ── */
        const of_ = await factsFromProductUrl(c.url);
        const query: ComparisonQuery = {
          title: of_.candidate!.title,
          sourceUrl: of_.crawlerUrl!,
          facts: of_.candidate!.facts,
        } as ComparisonQuery;

        // eslint-disable-next-line no-console
        console.log(`\n════════ ${c.id} ════════`);
        // eslint-disable-next-line no-console
        console.log(
          `  원상품  title=«${query.title}»\n          brand=${JSON.stringify(query.facts?.brand)} ` +
            `code=${JSON.stringify(query.facts?.brandModelCode)} color=${JSON.stringify(query.facts?.colorText)}`,
        );
        /** 🔴🔴 품번이 **원상품에 있는가** — 없으면 품번 쿼리가 애초에 나갈 수 없다. */
        const hasCode = Boolean(query.facts?.brandModelCode);
        // eslint-disable-next-line no-console
        console.log(
          `  🔴 원상품 품번 ${hasCode ? "🟢 있다" : "🔴 **없다**"} · 제목에 글자로는 ` +
            `${String(query.title).toUpperCase().includes(c.code) ? "🟢 있다" : "🔴 없다"}`,
        );

        /* ── A. discovery — 운영 검색을 그대로 돌린다 ── */
        const results = await searchDomesticShops(query, SHOPS);
        const okShops = results.filter((r) => r.status !== "error");
        const errShops = results.filter((r) => r.status === "error");
        const raw = results.reduce((n, r) => n + (r.candidates?.length ?? 0), 0);
        // eslint-disable-next-line no-console
        console.log(`\n  ── A. discovery ──  샵 ${results.length}(정상 ${okShops.length} · 오류 ${errShops.length}) · 후보 **${raw}건**`);
        for (const r of results)
          // eslint-disable-next-line no-console
          console.log(`     ${r.domain.padEnd(20)} ${String(r.status).padEnd(8)} ${(r.candidates?.length ?? 0)}건 ${r.error ?? ""}`);

        /* ── B/C. 후보 facts 와 판정 ── */
        let withFacts = 0;
        let judged = 0;
        const verdicts: Record<string, number> = {};
        const levels: Record<string, number> = {};
        const sample: Record<string, unknown>[] = [];
        for (const r of results) {
          const notSelf = (r.candidates ?? []).filter((x) => !isSelfReferenceCandidate(query.sourceUrl, x.url));
          const scored = withConfidence(query, notSelf);
          for (const x of scored) {
            if (x.facts) withFacts += 1;
            if (x.crossSellerVerdict) {
              judged += 1;
              verdicts[x.crossSellerVerdict] = (verdicts[x.crossSellerVerdict] ?? 0) + 1;
            }
            levels[String(x.matchLevel)] = (levels[String(x.matchLevel)] ?? 0) + 1;
            if (sample.length < 5)
              sample.push({
                shop: r.domain, title: x.title.slice(0, 44),
                code: x.facts?.brandModelCode ?? null, brand: x.facts?.brand ?? null,
                level: x.matchLevel ?? null, verdict: x.crossSellerVerdict ?? null,
                blockers: x.crossSellerBlockers ?? [],
              });
          }
        }
        // eslint-disable-next-line no-console
        console.log(`  ── B. extraction ──  facts 보유 **${withFacts}/${raw}**`);
        // eslint-disable-next-line no-console
        console.log(`  ── C. matching   ──  판정 도달 **${judged}** · verdict ${JSON.stringify(verdicts)} · matchLevel ${JSON.stringify(levels)}`);
        for (const s of sample) console.log(`     · ${JSON.stringify(s)}`);

        /** 🔴 **셋 중 어디서 끊겼는지** 를 한 단어로 적되, 숫자를 같이 남긴다. */
        const stage = raw === 0 ? "A_DISCOVERY" : withFacts === 0 ? "B_EXTRACTION" : "C_MATCHING";
        // eslint-disable-next-line no-console
        console.log(`  ⟹ **끊긴 지점 = ${stage}**  (후보 ${raw} · facts ${withFacts} · 판정 ${judged})`);
        report.push({ id: c.id, hasCode, raw, withFacts, judged, verdicts, levels, stage, sample });
      }
      writeFileSync(path.join(OUT, "wu-092-abc.json"), JSON.stringify(report, null, 1));
      expect(report).toHaveLength(CASES.length);
    },
    1_800_000,
  );
});
