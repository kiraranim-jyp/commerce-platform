import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import { withConfidence, type ComparisonQuery } from "@commerce/crawler";
import { attachMatchTruth } from "../../../domestic-price-sources/_lib/attach-match-truth";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-125 — **표본 추가**: 소매 길이/형태 차이가 «반복» 되는지 본다 (측정 · 구현 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 2026-10-20: 「⒞ 표본 추가. **바로 소매 길이 축을 만들지 않는다** —
 *    추가 표본을 화면으로 검토해 **소매 길이 차이가 반복적으로 실제 오판 원인인지** 확인한다.
 *    8축 유지 · threshold ❌ · 가격 ❌」
 *
 * 🟢 공급원은 **WU-121 이 이미 모은 679 링크** 다(새 AI 호출 0 · 새 검색 0).
 * 🔴 WU-122 에서 이미 판정한 24건은 **제외** 한다(같은 것을 또 묻지 않는다).
 * 🔴 선정 기준은 **표본 선정용** 이고 판정이 아니다 — 소매/형태 어휘가 들어간 URL 을 고른다.
 */
const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const LIVE = process.env.MI_P0_02_LIVE === "1";
const SRC121 = path.join(OUT, "wu-121.json");
const SRC122 = path.join(OUT, "wu-122.json");

const ORIGINS = [
  { sid: "S1", code: "B226AC010", url: "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt" },
  { sid: "S2", code: "B226AC009", url: "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt" },
] as const;

/** 🔴 **표본 선정용** 어휘 — 우리 두 원상품 계열이면서 «형태/소매» 가 갈릴 수 있는 것. */
const PICK = /booty-ghosts|hug-hairy-monster|long-sleeve|short-sleeve|sweatshirt|sweat-shirt|t-shirt|tshirt/i;
const MAX_SAMPLE = 18;

describe("WU-125 — 소매/형태 표본 추가 (LIVE · ≤18)", () => {
  (existsSync(SRC121) && LIVE ? it : it.skip)(
    "새 표본만 MI 에 보낸다",
    async () => {
      const all: string[] = JSON.parse(readFileSync(SRC121, "utf8")).newUrls;
      const already = new Set<string>(
        existsSync(SRC122) ? (JSON.parse(readFileSync(SRC122, "utf8")) as { url: string }[]).map((r) => r.url) : [],
      );
      /** host 별 최대 3건으로 층화 — 한 샵이 표본을 독식하지 않게 한다. */
      const perHost = new Map<string, number>();
      const picked: string[] = [];
      for (const u of all) {
        if (already.has(u) || !PICK.test(u)) continue;
        let h = "?";
        try {
          h = new URL(u).hostname.replace(/^www\./, "");
        } catch {
          continue;
        }
        const n = perHost.get(h) ?? 0;
        if (n >= 3) continue;
        perHost.set(h, n + 1);
        picked.push(u);
        if (picked.length >= MAX_SAMPLE) break;
      }

      const q: Record<string, ComparisonQuery> = {};
      for (const o of ORIGINS) {
        const f = await factsFromProductUrl(o.url);
        q[o.sid] = { title: f.candidate!.title, sourceUrl: f.crawlerUrl!, facts: f.candidate!.facts } as ComparisonQuery;
      }

      const rows: Record<string, unknown>[] = [];
      for (const u of picked) {
        const f = await factsFromProductUrl(u).catch(() => null);
        const cand = f?.candidate ?? null;
        const host = (() => {
          try {
            return new URL(u).hostname.replace(/^www\./, "");
          } catch {
            return "?";
          }
        })();
        const row: Record<string, unknown> = {
          host,
          url: u,
          clue: true,
          status: f?.status ?? "THREW",
          title: cand?.title ?? null,
          code: cand?.facts?.brandModelCode ?? null,
        };
        for (const o of ORIGINS) {
          if (!cand) {
            row[o.sid] = null;
            continue;
          }
          const t = await attachMatchTruth(
            [{ shopId: "wu125", shopName: "cf", domain: host, status: "ok", candidates: withConfidence(q[o.sid], [cand]) } as never],
            q[o.sid].facts?.brandModelCode ?? null,
            q[o.sid].facts?.colorText ?? null,
          );
          const x = t[0].candidates[0] as { crossSellerVerdict?: string | null; crossSellerBlockers?: { blocker: string }[] };
          row[o.sid] = x?.crossSellerVerdict ?? null;
          row[`${o.sid}_blockers`] = (x?.crossSellerBlockers ?? []).map((b) => b.blocker);
        }
        const rank: Record<string, number> = { SAME: 0, PRESUMED_SAME: 1, SIMILAR: 2, UNKNOWN: 3, CONFLICT: 4 };
        row.best =
          [row.S1, row.S2].filter((v): v is string => typeof v === "string").sort((a, b) => (rank[a] ?? 9) - (rank[b] ?? 9))[0] ?? null;
        rows.push(row);
      }

      const n = (v: string) => rows.filter((r) => r.best === v).length;
      // eslint-disable-next-line no-console
      console.log(
        `\n새 표본 **${rows.length}** (host ${perHost.size}) · 상품확인 ${rows.filter((r) => r.title).length}\n` +
          `  SAME **${n("SAME")}** · PRESUMED **${n("PRESUMED_SAME")}** · CONFLICT ${n("CONFLICT")} ·` +
          ` UNKNOWN ${n("UNKNOWN") + rows.filter((r) => !r.best).length}`,
      );
      for (const r of rows)
        // eslint-disable-next-line no-console
        console.log(
          `  ${String(r.best).padEnd(14)} ${String(r.host).padEnd(22)} code=${String(r.code).padEnd(11)}` +
            ` bl=${JSON.stringify((r.S1_blockers as string[]) ?? [])}/${JSON.stringify((r.S2_blockers as string[]) ?? [])}` +
            ` ${String(r.title).slice(0, 44)}`,
        );

      writeFileSync(path.join(OUT, "wu-125.json"), JSON.stringify(rows, null, 1));
      expect(rows.length).toBeLessThanOrEqual(MAX_SAMPLE);
    },
    3_600_000,
  );
});
