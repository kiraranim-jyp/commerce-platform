import { writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import { withConfidence, type ComparisonQuery } from "@commerce/crawler";
import { attachMatchTruth } from "../../../domestic-price-sources/_lib/attach-match-truth";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-124 — **오판 3건이 «판정 시점에 갖고 있던 증거»** (측정 · 구현 0 · 가격 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 2026-10-20: 「새 축을 무작정 추가하지 않는다. **이번 3건의 오판 원인을 기존 MI
 *    증거 구조 «안에서»** 조사한다. 가격·Registry·1-hop·외부 검색 확대 ❌」
 *
 * 🟢 CEO GT(WU-123) — SAME precision **4/5** · recall 4/4.
 *    ❌ c2 긴팔↔반팔 · ❌ c4 전혀 다른 제품 · ❌ c7 티셔츠↔스웨트셔츠(재질)
 *
 * 🔴 운영 함수만 부른다 — `withConfidence` + `attachMatchTruth`. 판정 규칙 변경 **0**.
 */
const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const LIVE = process.env.MI_P0_02_LIVE === "1";

const ORIGINS = {
  B226AC010: "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt",
  B226AC009: "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt",
} as const;

/** 🟢 WU-123 의 CEO GT 그대로(라벨을 내가 바꾸지 않았다). */
const GT = [
  { id: "c1", o: "B226AC010", url: "https://www.junioredition.com/en-kr/collections/bobo-choses/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses", human: "SAME" },
  { id: "c2", o: "B226AC010", url: "https://www.tinyapple.net/en-kr/products/bobo-choses-booty-ghosts-t-shirt", human: "DIFFERENT" },
  { id: "c3", o: "B226AC009", url: "https://www.tinyapple.net/en-kr/products/bobo-choses-hug-hairy-monster-t-shirt-light-blue", human: "SAME" },
  { id: "c4", o: "B226AC010", url: "https://www.tinyapple.net/en-kr/products/bobo-choses-bobo-choses-embossed-t-shirt-multicolor", human: "DIFFERENT" },
  { id: "c5", o: "B226AC010", url: "https://scoutandcokids.com/collections/bobo-choses/products/bobo-choses-booty-ghosts-t-shirt", human: "SAME" },
  { id: "c6", o: "B226AC009", url: "https://scoutandcokids.com/collections/bobo-choses/products/bobo-choses-hug-hairy-monster-t-shirt", human: "SAME" },
  { id: "c7", o: "B226AC009", url: "https://cemarose.ca/products/bobo-choses-kids-booty-ghosts-sweatshirt-light-blue-c7907", human: "DIFFERENT" },
] as const;

describe("WU-124 — 오판 3건의 증거 (LIVE)", () => {
  (LIVE ? it : it.skip)(
    "판정 시점에 무엇이 있었는지 전수로 찍는다",
    async () => {
      const q: Record<string, ComparisonQuery> = {};
      for (const [code, url] of Object.entries(ORIGINS)) {
        const f = await factsFromProductUrl(url);
        q[code] = { title: f.candidate!.title, sourceUrl: f.crawlerUrl!, facts: f.candidate!.facts } as ComparisonQuery;
        // eslint-disable-next-line no-console
        console.log(
          `원상품 ${code} — title«${f.candidate!.title}» category=${JSON.stringify((f.candidate!.facts as { category?: unknown })?.category)}` +
            ` material=${JSON.stringify((f.candidate!.facts as { materialComposition?: unknown })?.materialComposition ?? null)} color=${JSON.stringify(f.candidate!.facts?.colorText)}`,
        );
      }

      const rows: Record<string, unknown>[] = [];
      for (const g of GT) {
        const f = await factsFromProductUrl(g.url).catch(() => null);
        const cand = f?.candidate ?? null;
        if (!cand) {
          rows.push({ ...g, status: f?.status ?? "THREW" });
          continue;
        }
        const t = await attachMatchTruth(
          [{ shopId: "wu124", shopName: "cf", domain: new URL(g.url).hostname, status: "ok", candidates: withConfidence(q[g.o], [cand]) } as never],
          q[g.o].facts?.brandModelCode ?? null,
          q[g.o].facts?.colorText ?? null,
        );
        const x = t[0].candidates[0] as {
          crossSellerVerdict?: string | null;
          crossSellerReasons?: string[];
          crossSellerBlockers?: { blocker: string }[];
          crossSellerConflicts?: { conflict: string }[];
          matchReasons?: string[];
          matchTruth?: string | null;
        };
        const r = {
          ...g,
          sys: x.crossSellerVerdict ?? null,
          agree: (x.crossSellerVerdict === "SAME" || x.crossSellerVerdict === "PRESUMED_SAME") === (g.human === "SAME"),
          truth: x.matchTruth ?? null,
          title: cand.title,
          code: cand.facts?.brandModelCode ?? null,
          color: cand.facts?.colorText ?? null,
          category: (cand.facts as { category?: unknown })?.category ?? null,
          material: (cand.facts as { materialComposition?: unknown })?.materialComposition ?? null,
          reasons: x.crossSellerReasons ?? [],
          blockers: (x.crossSellerBlockers ?? []).map((b) => b.blocker),
          conflicts: (x.crossSellerConflicts ?? []).map((c) => c.conflict),
        };
        rows.push(r);
        // eslint-disable-next-line no-console
        console.log(
          `\n${g.id} ${r.agree ? "✅" : "❌"} human=${g.human.padEnd(9)} sys=${String(r.sys).padEnd(14)} truth=${String(r.truth)}\n` +
            `   title «${String(r.title).slice(0, 52)}»\n` +
            `   code=${String(r.code)} color=${JSON.stringify(r.color)} category=${JSON.stringify(r.category)} material=${JSON.stringify(r.material)}\n` +
            `   축: ${JSON.stringify(r.reasons)}\n` +
            `   blockers=${JSON.stringify(r.blockers)} conflicts=${JSON.stringify(r.conflicts)}`,
        );
      }

      writeFileSync(path.join(OUT, "wu-124.json"), JSON.stringify(rows, null, 1));
      expect(rows).toHaveLength(7);
    },
    3_600_000,
  );
});
