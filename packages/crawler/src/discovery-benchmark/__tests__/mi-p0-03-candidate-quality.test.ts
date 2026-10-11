/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-03 B-2 — Discovery → Light Fetch → Identity (CPO 지시서 §11)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 실제 HTTP 를 쓴다.
 *
 * 🔴 **후보 수로 판정하지 않는다**(CPO 금지). Gemini 후보가 많아도 Light Fetch 가
 *    읽지 못하면 조사에 쓸 수 없다. 그래서 끝까지 연결해 본다:
 *
 *      Gemini candidate → resolve → readable → extracted identity → SAME 판정
 *
 * 🔴 **Gemini 후보를 SAME 으로 취급하지 않는다.** 판정은 기존 MI
 *    (`compareCrossSellerProducts`)가 한다. 이 파일은 그 함수를 부르고 결과를
 *    «그대로» 적는다 — 새 판정 어휘를 만들지 않는다.
 *
 * ── 🔴 비용 상한을 «구조» 로 만든다 ────────────────────────────────────────
 * 같은 후보 URL 이 여러 Level 에 중복 등장한다(실측). 그래서 **distinct URL 을
 * 한 번만** resolve/fetch 하고 그 결과를 Level 로 되돌려 귀속시킨다. Level 별
 * 숫자는 보존되고 HTTP 는 중복되지 않는다.
 * 🔴 상한에 걸려 «버린» 건수는 숫자로 남긴다 — 조용히 truncate 하면 「전부 쟀다」로 읽힌다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compareCrossSellerProducts } from "../../comparison-search/cross-seller";
import { factsFromProductUrl } from "../../comparison-search/product-url-facts";
import { isSelfReferenceCandidate } from "../../comparison-search/self-reference";
import { createLivePageProbe } from "../live-page-probe";
import { resolveCandidate } from "../url-resolver";
import type { ProductFacts } from "@commerce/shared";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(os.tmpdir(), "mi-p0-02");
/** 🔴 비용 상한. 넘긴 건수는 리포트에 적는다. */
const MAX_DISTINCT_URLS = Number(process.env.MI_P0_03_MAX_URLS ?? 140);

type Level = "L0" | "L1" | "L2" | "L3" | "L4";
interface Rec { host: string; url: string; level: Level; discovered: { url: string; title: string | null }[] }
interface Golden { host: string; url: string; brand: string; title: string; code: string | null }

describe.skipIf(!LIVE)("🔴 MI-P0-03 B-2 — 후보가 SAME 까지 가는 비율", () => {
  it(
    "Gemini 후보 → resolve → Light Fetch → Identity 를 Level 별로 귀속한다",
    async () => {
      const levelsPath = path.join(OUT_DIR, "mi-p0-03-levels.json");
      if (!existsSync(levelsPath)) throw new Error(`선행 측정이 없다: ${levelsPath}`);
      const { golden, recs } = JSON.parse(readFileSync(levelsPath, "utf8")) as { golden: Golden[]; recs: Rec[] };

      /* ── ① 원상품 facts — Light Fetch owner 로 얻는다 ── */
      const originFacts = new Map<string, ProductFacts>();
      const originFail: string[] = [];
      for (const g of golden) {
        const r = await factsFromProductUrl(g.url);
        if (r.candidate?.facts) originFacts.set(g.url, r.candidate.facts);
        else originFail.push(`${g.host} status=${r.status}`);
      }

      /* ── ② distinct 후보 URL — 한 번만 처리한다 ── */
      const urlToLevels = new Map<string, { origins: Set<string>; levels: Set<Level> }>();
      for (const rec of recs) {
        for (const d of rec.discovered ?? []) {
          const slot = urlToLevels.get(d.url) ?? { origins: new Set(), levels: new Set() };
          slot.origins.add(rec.url); slot.levels.add(rec.level);
          urlToLevels.set(d.url, slot);
        }
      }
      const allUrls = [...urlToLevels.keys()];
      const targets = allUrls.slice(0, MAX_DISTINCT_URLS);
      const dropped = allUrls.length - targets.length;

      /* ── ③ resolve → Light Fetch → Identity ── */
      let probeBytes = 0;
      const probe = createLivePageProbe({ onResult: (r) => (probeBytes += r.bytes) });
      interface Out {
        url: string; classification: string; crawlerUrl: string | null; readable: boolean;
        candidateHost: string | null; verdictByOrigin: Record<string, string>; selfRefOrigins: string[];
      }
      const out: Out[] = [];
      for (const u of targets) {
        const slot = urlToLevels.get(u)!;
        const resolved = await resolveCandidate(u, [], probe);
        let readable = false; let facts: ProductFacts | undefined;
        if (resolved.classification === "PRODUCT_PAGE" && resolved.crawlerUrl) {
          const f = await factsFromProductUrl(resolved.crawlerUrl);
          facts = f.candidate?.facts; readable = !!facts;
        }
        const verdictByOrigin: Record<string, string> = {};
        const selfRef: string[] = [];
        for (const origin of slot.origins) {
          if (isSelfReferenceCandidate(origin, resolved.finalUrl)) { selfRef.push(origin); continue; }
          const of_ = originFacts.get(origin);
          // 🔴 판정 불가와 판정 결과를 섞지 않는다.
          if (!of_ || !facts) { verdictByOrigin[origin] = of_ ? "NOT_READABLE" : "ORIGIN_FACTS_MISSING"; continue; }
          /**
           * 🔴 `?? "UNKNOWN"` 를 쓰지 않는다. `CrossSellerVerdict` 에 «실제»
           *    `"UNKNOWN"` 판정이 있어서(SAME|PRESUMED_SAME|SIMILAR|UNKNOWN|CONFLICT)
           *    폴백과 판정이 같은 값이 되면 둘을 구분할 수 없다.
           *    🟢 `verdict` 는 non-optional 이므로 폴백이 애초에 필요 없다(타입 확인).
           */
          verdictByOrigin[origin] = compareCrossSellerProducts(of_, facts).verdict;
        }
        let h: string | null = null; try { h = new URL(resolved.finalUrl).hostname.replace(/^www\./, ""); } catch {}
        out.push({ url: u, classification: resolved.classification, crawlerUrl: resolved.crawlerUrl,
                   readable, candidateHost: h, verdictByOrigin, selfRefOrigins: selfRef });
        if (out.length % 20 === 0) console.log(`  …${out.length}/${targets.length} 처리`); // eslint-disable-line no-console
      }

      /* ── ④ Level 로 귀속 ── */
      const byUrl = new Map(out.map((o) => [o.url, o]));
      const LEVELS: Level[] = ["L0", "L1", "L2", "L3", "L4"];
      const perLevel = LEVELS.map((level) => {
        const rs = recs.filter((r) => r.level === level);
        const cand = rs.flatMap((r) => (r.discovered ?? []).map((d) => ({ url: d.url, origin: r.url })));
        const seen = new Set<string>();
        let distinct = 0, product = 0, readableN = 0, selfRef = 0, measured = 0;
        const tally: Record<string, number> = {};
        for (const c of cand) {
          const o = byUrl.get(c.url); if (!o) continue;
          const k = `${c.origin}|${c.url}`; if (seen.has(k)) continue; seen.add(k); distinct++;
          if (o.classification === "PRODUCT_PAGE") product++;
          if (o.readable) readableN++;
          if (o.selfRefOrigins.includes(c.origin)) { selfRef++; continue; }
          const v = o.verdictByOrigin[c.origin]; if (!v) continue;
          measured++; tally[v] = (tally[v] ?? 0) + 1;
        }
        const same = tally["SAME"] ?? 0;
        // 🔴 SAME 과 PRESUMED_SAME 을 «갈라» 적는다. 합치면 CPO 가 요구한
        //    SAME / SAME_LIKELY 구분이 사라진다.
        const presumed = tally["PRESUMED_SAME"] ?? 0;
        return { level, queriesRun: rs.filter((r) => (r.discovered ?? []).length > 0).length,
                 rawCandidates: cand.length, distinctPairs: distinct, productPage: product,
                 readable: readableN, selfReferenceExcluded: selfRef, judged: measured, verdicts: tally,
                 SAME: same, SAME_LIKELY: presumed,
                 sameRate: measured === 0 ? "측정불가(분모 0)" : `${Math.round((100 * same) / measured)}%`,
                 sameOrLikelyRate: measured === 0 ? "측정불가(분모 0)" : `${Math.round((100 * (same + presumed)) / measured)}%` };
      });

      const report = {
        bounds: { distinctUrlsTotal: allUrls.length, processed: targets.length,
                  droppedByCap: dropped, cap: MAX_DISTINCT_URLS, probeBytes },
        originFactsMissing: originFail,
        perLevel, details: out,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "mi-p0-03-candidate-quality.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ bounds: report.bounds, originFactsMissing: originFail, perLevel }, null, 2));

      // 🔴 결과 방향을 단언하지 않는다.
      expect(perLevel).toHaveLength(5);
    },
    180 * 60 * 1000,
  );
});
