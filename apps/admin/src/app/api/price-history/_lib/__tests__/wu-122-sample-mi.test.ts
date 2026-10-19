import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import { withConfidence, type ComparisonQuery } from "@commerce/crawler";
import { attachMatchTruth } from "../../../domestic-price-sources/_lib/attach-match-truth";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-122 — **해외 B 목록의 소수 표본을 MI 에 보낸다** (측정 · 구현 0 · 가격 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 2026-10-20: 「679 전수 금지 · **최대 30개** · **source 별 층화** ·
 *    문자열 단서가 **있는 것과 없는 것을 같이** 넣어 **편향을 측정** ·
 *    새 판정 규칙 ❌ · 1-hop 구현 ❌ · 가격 HOLD」
 *
 * 🔴 문자열 단서(`b226ac009` 등)로 **SAME 을 판정하지 않는다** — 표본 «선정» 에만 쓴다.
 * 🟢 판정은 운영 함수(`withConfidence` + `attachMatchTruth`)가 한다.
 */
const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const SRC = path.join(OUT, "wu-121.json");
const LIVE = process.env.MI_P0_02_LIVE === "1";

const ORIGINS = [
  { sid: "S1", code: "B226AC010", url: "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt" },
  { sid: "S2", code: "B226AC009", url: "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt" },
] as const;

const CLUE = /b226ac009|b226ac010|b226ab046|b226ab040|hug-hairy-monster|booty-ghosts/i;
const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "?";
  }
};

describe("WU-122 — B 목록 소수 표본 MI (LIVE · ≤30)", () => {
  (existsSync(SRC) && LIVE ? it : it.skip)(
    "source 별 층화 표본만 판정한다",
    async () => {
      const all: string[] = JSON.parse(readFileSync(SRC, "utf8")).newUrls;
      /** 🔴 층화 — host 별로 「단서 있는 것 우선 2 + 단서 없는 것 1」. 총 상한 30. */
      const byHost = new Map<string, string[]>();
      for (const u of all) {
        const h = host(u);
        if (!byHost.has(h)) byHost.set(h, []);
        byHost.get(h)!.push(u);
      }
      const sample: { url: string; host: string; clue: boolean }[] = [];
      for (const [h, list] of byHost) {
        const withClue = list.filter((u) => CLUE.test(u)).slice(0, 2);
        const without = list.filter((u) => !CLUE.test(u)).slice(0, 1);
        for (const u of [...withClue, ...without]) sample.push({ url: u, host: h, clue: CLUE.test(u) });
      }
      const picked = sample.slice(0, 30);

      /* 원상품 facts — 운영 owner */
      const q: Record<string, ComparisonQuery> = {};
      for (const o of ORIGINS) {
        const f = await factsFromProductUrl(o.url);
        q[o.sid] = { title: f.candidate!.title, sourceUrl: f.crawlerUrl!, facts: f.candidate!.facts } as ComparisonQuery;
      }

      const rows: Record<string, unknown>[] = [];
      for (const p of picked) {
        const f = await factsFromProductUrl(p.url).catch(() => null);
        const cand = f?.candidate ?? null;
        const out: Record<string, unknown> = {
          host: p.host,
          url: p.url,
          clue: p.clue,
          status: f?.status ?? "THREW",
          title: cand?.title ?? null,
          code: cand?.facts?.brandModelCode ?? null,
        };
        /** 🔴 두 원상품 **각각** 에 대해 판정한다(어느 상품의 후보인지 미리 정하지 않는다). */
        for (const o of ORIGINS) {
          if (!cand) {
            out[o.sid] = null;
            continue;
          }
          const t = await attachMatchTruth(
            [{ shopId: "wu122", shopName: "cf", domain: p.host, status: "ok", candidates: withConfidence(q[o.sid], [cand]) } as never],
            q[o.sid].facts?.brandModelCode ?? null,
            q[o.sid].facts?.colorText ?? null,
          );
          const x = t[0].candidates[0] as { crossSellerVerdict?: string | null };
          out[o.sid] = x?.crossSellerVerdict ?? null;
        }
        /** 🟢 둘 중 «더 가까운» 판정 하나를 표에 쓴다(기록은 둘 다 남긴다). */
        const rank: Record<string, number> = { SAME: 0, PRESUMED_SAME: 1, SIMILAR: 2, UNKNOWN: 3, CONFLICT: 4 };
        const best = [out.S1, out.S2]
          .filter((v): v is string => typeof v === "string")
          .sort((a, b) => (rank[a] ?? 9) - (rank[b] ?? 9))[0] ?? null;
        out.best = best;
        rows.push(out);
      }

      /* ── 표 ── */
      const hosts = [...new Set(rows.map((r) => String(r.host)))];
      // eslint-disable-next-line no-console
      console.log(`\n표본 **${rows.length}** / source ${hosts.length}`);
      for (const h of hosts) {
        const g = rows.filter((r) => r.host === h);
        const n = (v: string) => g.filter((r) => r.best === v).length;
        // eslint-disable-next-line no-console
        console.log(
          `  ${h.padEnd(24)} 표본 ${String(g.length).padEnd(3)} 상품확인 ${String(g.filter((r) => r.title).length).padEnd(3)}` +
            ` SAME ${n("SAME")} · PRESUMED ${n("PRESUMED_SAME")} · SIMILAR ${n("SIMILAR")} ·` +
            ` DIFFERENT/CONFLICT ${n("CONFLICT")} · UNKNOWN ${n("UNKNOWN") + g.filter((r) => !r.best).length}`,
        );
      }
      const tot = (v: string) => rows.filter((r) => r.best === v).length;
      // eslint-disable-next-line no-console
      console.log(
        `  ──── 합계 — 상품확인 ${rows.filter((r) => r.title).length} ·` +
          ` SAME **${tot("SAME")}** · PRESUMED **${tot("PRESUMED_SAME")}** · SIMILAR ${tot("SIMILAR")} ·` +
          ` CONFLICT ${tot("CONFLICT")} · UNKNOWN ${tot("UNKNOWN") + rows.filter((r) => !r.best).length}`,
      );
      // eslint-disable-next-line no-console
      console.log(`  단서 있는 표본 ${rows.filter((r) => r.clue).length} / 없는 표본 ${rows.filter((r) => !r.clue).length}`);
      for (const r of rows.filter((x) => x.best === "SAME" || x.best === "PRESUMED_SAME" || /b226ab046|b226ab040/i.test(String(x.url))))
        // eslint-disable-next-line no-console
        console.log(
          `   ${String(r.best).padEnd(14)} clue=${r.clue ? "Y" : "-"} code=${String(r.code).padEnd(11)}` +
            ` S1=${String(r.S1).padEnd(14)} S2=${String(r.S2).padEnd(14)} ${String(r.title).slice(0, 34)} ${String(r.url).slice(0, 56)}`,
        );

      writeFileSync(path.join(OUT, "wu-122.json"), JSON.stringify(rows, null, 1));
      expect(rows.length).toBeLessThanOrEqual(30);
    },
    3_600_000,
  );
});
