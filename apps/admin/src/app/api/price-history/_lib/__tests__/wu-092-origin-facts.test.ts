import { writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-092 STEP 1~2 — **원상품 facts 와 URL 정규화** (LIVE · 측정 전용)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 지시 2026-10-19: 「먼저 **왜 못 찾는지** 를 확정한다. UI 를 또 고치지 않는다.」
 *    8축 ❌ · matchLevel ❌ · threshold ❌ · 가격 게이트 ❌ · AI ❌ · Registry ❌ ·
 *    가격 계산 ❌ · 후보 판정 기준 ❌
 *
 * ── 🔴🔴 이 WU 가 «절대» 하지 않는 것 ────────────────────────────────────────
 * 「동일상품을 못 찾음」을 **한 문장으로 보고하지 않는다**(CPO §3). 셋으로 가른다:
 * ```
 * A discovery   후보 **자체** 를 못 찾는다
 * B extraction  후보는 찾았는데 **fetch/추출** 이 실패한다
 * C matching    후보 facts 까지 확보했는데 **SAME 이 아니다**
 * ```
 *
 * ── STEP 2 의 질문 ──────────────────────────────────────────────────────────
 * CEO 가 준 URL 에는 추적 파라미터가 붙어 있다(`?pr_prod_strat=similar&…`).
 * 🔴 CPO: 「이 URL 은 **정상 상품 URL 로 봐야 한다**」. 그래서 **쿼리 있는 URL** 과
 * **쿼리 제거 URL** 의 결과가 **다른지** 를 먼저 본다 — 다르면 **정규화 문제** 다.
 * 🟢 이 리포에는 선례가 있다(WU-007A: 우리 검색어가 증거로 재활용된 사건).
 */

const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const LIVE = process.env.MI_P0_02_LIVE === "1";

/** 🔴 CEO 가 준 URL 을 **그대로** 쓴다. 손으로 고치지 않는다. */
const CASES = [
  {
    id: "S1-biskuit-B226AC009",
    expectCode: "B226AC009",
    url: "https://biskuit.kr/product/%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88-%ED%97%88%EA%B7%B8-%ED%97%A4%EC%96%B4%EB%A6%AC-%EB%AA%AC%EC%8A%A4%ED%84%B0-%ED%8B%B0%EC%85%94%EC%B8%A0-b226ac009/8891/category/367/display/1/?utm_source=chatgpt.com",
  },
  {
    id: "S2-bobo-B226AC042",
    expectCode: "B226AC042",
    url: "https://bobochoses.com/en-kr/products/b226ac042-mystery-bc-half-zipped-sweatshirt?pr_prod_strat=similar&pr_rec_id=793ca40cb&pr_rec_pid=1569266t1588351&pr_ref_pid=15692661621119&pr_seq=uniform&utm_source=chatgpt.com",
  },
] as const;

/** 🔴 쿼리만 떼어 낸다 — 경로/호스트/로케일은 **그대로** 둔다(로케일은 시장이다 · WU-008A). */
const stripQuery = (u: string) => {
  const x = new URL(u);
  x.search = "";
  return x.toString();
};

describe("WU-092 STEP 1~2 — 원상품 facts · URL 정규화 (LIVE)", () => {
  (LIVE ? it : it.skip)(
    "쿼리 있는 URL ↔ 쿼리 제거 URL 을 같은 운영 owner 로 비교한다",
    async () => {
      const out: Record<string, unknown>[] = [];
      for (const c of CASES) {
        const bare = stripQuery(c.url);
        /** 🟢 운영 owner 를 **그대로** 부른다 — 복제하지 않는다(§5-B). */
        const withQ = await factsFromProductUrl(c.url);
        const noQ = await factsFromProductUrl(bare);

        const pick = (r: Awaited<ReturnType<typeof factsFromProductUrl>>) => ({
          status: r.status,
          shape: classifyUrlShape(r.crawlerUrl ?? ""),
          title: r.candidate?.title ?? null,
          brand: r.candidate?.facts?.brand ?? null,
          code: r.candidate?.facts?.brandModelCode ?? null,
          color: r.candidate?.facts?.colorText ?? null,
          price: r.candidate?.price ?? null,
          httpCalls: r.httpCalls,
          fetchPath: r.fetchPath,
        });
        const a = pick(withQ);
        const b = pick(noQ);

        // eslint-disable-next-line no-console
        console.log(`\n════ ${c.id} ════`);
        // eslint-disable-next-line no-console
        console.log(`  쿼리 O  ${JSON.stringify(a)}`);
        // eslint-disable-next-line no-console
        console.log(`  쿼리 X  ${JSON.stringify(b)}`);
        // eslint-disable-next-line no-console
        console.log(
          `  🔴 기대 품번 ${c.expectCode} — 쿼리O ${a.code === c.expectCode ? "🟢 일치" : `🔴 «${String(a.code)}»`}` +
            ` · 쿼리X ${b.code === c.expectCode ? "🟢 일치" : `🔴 «${String(b.code)}»`}`,
        );
        const differs = JSON.stringify({ ...a, httpCalls: 0 }) !== JSON.stringify({ ...b, httpCalls: 0 });
        // eslint-disable-next-line no-console
        console.log(`  ⟹ 두 경로 결과 ${differs ? "🔴 **다르다**(정규화 문제)" : "🟢 같다(정규화 문제 아님)"}`);
        out.push({ id: c.id, url: c.url, bare, withQuery: a, noQuery: b, differs });
      }
      writeFileSync(path.join(OUT, "wu-092-origin.json"), JSON.stringify(out, null, 1));
      expect(out).toHaveLength(CASES.length);
    },
    900_000,
  );
});
