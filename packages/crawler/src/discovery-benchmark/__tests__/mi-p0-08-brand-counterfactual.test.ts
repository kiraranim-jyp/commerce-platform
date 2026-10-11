/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-08 ②③④ — Brand Evidence Recovery & Identity Impact (CPO 지시)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 돈다.
 * 🔴 **DB 를 UPDATE 하지 않는다.** counterfactual 은 하니스 메모리에서만 한다.
 *
 * ── 전수 사실 (N=497) ───────────────────────────────────────────────────────
 *   Identity 사용 가능 429 · 🔴 사용 불가 68 (`"AW26"` 44 + `""` 24)
 *   사용 불가 호스트: bobochoses 58 · rakuten 5 · smallable 3 · junioredition 2
 *   `resolveBrandIdentity("AW26")` → `{value: null}` → `brandKnown=false`
 *   → `BRAND_UNCONFIRMED` → SAME 차단
 *
 * ── 🟢 자연실험이 이미 데이터에 있다 ───────────────────────────────────────
 *   같은 후보군을 두 origin 이 판정한다:
 *     junioredition / "Bobo Choses"  ← brand 있음
 *     bobochoses    / "AW26"         ← brand 없음(null 로 해소)
 *   둘의 verdict 차이가 **brand 축만의 효과** 다. 다른 축은 같은 후보라 동일하다.
 *
 * ── ③ counterfactual ───────────────────────────────────────────────────────
 *   `"AW26"` origin 의 brand 를 **기존 capability** 로 복구해 재판정한다:
 *     `OFFICIAL_STORE_BRANDS["bobochoses.com"] = "Bobo Choses"` (seller-facts.ts)
 *   🔴 새 매핑을 만들지 않는다. 이미 코드에 있는 것만 쓴다.
 *
 * ── ④ False Positive 방어 ──────────────────────────────────────────────────
 *   host 매핑이 «이미 정상인» 상품을 덮어쓰지 않는지, 그리고 그 host 에 다른
 *   브랜드가 실제로 있는지를 497 전수로 확인한다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compareCrossSellerProducts } from "../../comparison-search/cross-seller";
import { factsFromProductUrl } from "../../comparison-search/product-url-facts";
import { isSelfReferenceCandidate } from "../../comparison-search/self-reference";
import type { ProductFacts } from "@commerce/shared";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(os.tmpdir(), "mi-p0-02");

/** 🔴 기존 capability 그대로. 새 매핑을 만들지 않는다(seller-facts.ts 와 같은 값). */
const OFFICIAL_STORE_BRANDS: Record<string, string> = { "bobochoses.com": "Bobo Choses" };

interface Golden { host: string; url: string; brand: string; code: string | null }
interface Rec { url: string; level: string; discovered: { url: string }[] }

describe.skipIf(!LIVE)("🔴 MI-P0-08 — brand 복구의 Identity 효과 (counterfactual)", () => {
  it(
    "자연실험 + counterfactual 재판정 + FP 방어",
    async () => {
      const lp = path.join(OUT_DIR, "mi-p0-03-levels.json");
      if (!existsSync(lp)) throw new Error(`선행 측정 없음: ${lp}`);
      const { golden, recs } = JSON.parse(readFileSync(lp, "utf8")) as { golden: Golden[]; recs: Rec[] };
      const det = new Map((JSON.parse(readFileSync(path.join(OUT_DIR, "mi-p0-03-candidate-quality.json"), "utf8")) as
        { details: { url: string; classification: string; crawlerUrl: string | null; readable: boolean }[] }).details.map((d) => [d.url, d]));
      const census = JSON.parse(readFileSync(path.join(OUT_DIR, "mi-p0-08-brand-census.json"), "utf8")) as
        { rows: { host: string; url: string; stored: string; identValue: string | null }[] };

      /* ── ④ FP 방어: 해당 host 에 «다른» 브랜드가 실제로 있는가 (N=497 전수) ── */
      const fpRisk = Object.keys(OFFICIAL_STORE_BRANDS).map((h) => {
        const rows = census.rows.filter((r) => r.host === h);
        const distinct: Record<string, number> = {};
        for (const r of rows) distinct[r.stored || "(빈값)"] = (distinct[r.stored || "(빈값)"] ?? 0) + 1;
        const mapped = OFFICIAL_STORE_BRANDS[h].toLowerCase();
        // 🔴 「이미 정상이고 매핑과 «다른» 브랜드」가 있으면 덮어쓰기 위험이다.
        const conflicting = rows.filter((r) => r.identValue !== null && !r.identValue.includes(mapped));
        return { host: h, totalRows: rows.length, distinctStored: distinct,
                 wouldOverwriteOkRows: conflicting.length,
                 conflictingValues: [...new Set(conflicting.map((r) => r.stored))] };
      });

      /* ── 후보 facts 를 한 번만 만든다 ── */
      const candFacts = new Map<string, ProductFacts | null>();
      for (const u of [...new Set(recs.flatMap((r) => (r.discovered ?? []).map((d) => d.url)))]) {
        const d = det.get(u);
        if (!d?.readable || !d.crawlerUrl) { candFacts.set(u, null); continue; }
        candFacts.set(u, (await factsFromProductUrl(d.crawlerUrl)).candidate?.facts ?? null);
      }

      /* ── origin facts (Light Fetch) ── */
      const originFacts = new Map<string, ProductFacts | null>();
      for (const g of golden) originFacts.set(g.url, (await factsFromProductUrl(g.url)).candidate?.facts ?? null);

      /**
       * 🔴 verdict 만 세면 «왜» 가 사라진다. `blockers` 와 **후보 쪽 brand 보유** 를
       *    같이 센다 — `cross-seller.ts` 의 `brandKnown = Boolean(x.brand && y.brand)`
       *    는 **양쪽** 을 요구하므로, 후보에 brand 가 없으면 origin 복구는 구조적으로
       *    효과가 0 이다. 그 구분 없이 「brand 복구 무효」라고 쓰면 원인을 틀리게 적는다.
       */
      interface Judged { verdicts: Record<string, number>; blockers: Record<string, number>; candBrandPresent: number; judgedN: number }
      const judge = (of_: ProductFacts, originUrl: string): Judged => {
        const t: Record<string, number> = {};
        const bl: Record<string, number> = {};
        let candBrandPresent = 0, judgedN = 0;
        const seen = new Set<string>();
        for (const r of recs.filter((x) => x.url === originUrl)) {
          for (const d of r.discovered ?? []) {
            if (seen.has(d.url)) continue;
            seen.add(d.url);
            if (isSelfReferenceCandidate(originUrl, d.url)) continue;
            const cf = candFacts.get(d.url);
            if (!cf) continue;
            judgedN++;
            if (cf.brand?.trim()) candBrandPresent++;
            const m = compareCrossSellerProducts(of_, cf);
            t[m.verdict] = (t[m.verdict] ?? 0) + 1;
            for (const b of m.blockers ?? []) bl[b.blocker] = (bl[b.blocker] ?? 0) + 1;
          }
        }
        return { verdicts: t, blockers: bl, candBrandPresent, judgedN };
      };

      /* ── ②③ counterfactual — 🔴 방향을 정정했다 ───────────────────────
       * 1차 설계는 「stored 가 오염 → 복구」였다. **측정이 그 전제를 깼다:**
       *   bobochoses stored="AW26"            → facts.brand="Bobo Choses" 🟢 이미 복구됨
       *     (`OFFICIAL_STORE_BRANDS` 가 `productFactsFromShopifyProduct` 안에 있다)
       *   tennis     stored="Sergio Tacchini" → facts.brand=null          🔴 정상인데 손실
       * → 🔴 DB backfill 은 Identity 에 닿지 않는다. 진짜 손실은 반대 방향 —
       *   **DB 에 쓸 수 있는 brand 가 있는데 Light Fetch facts 가 그것을 못 담는다.**
       * → 그래서 counterfactual 은 «stored brand 를 facts 에 주입» 하는 쪽이다.
       */
      const storedByUrl = new Map(census.rows.map((r) => [r.url, r]));
      const results = golden.map((g) => {
        const of_ = originFacts.get(g.url);
        if (!of_) return { host: g.host, storedBrand: g.brand, skipped: "ORIGIN_FACTS_MISSING" as const };
        const before = judge(of_, g.url);
        const stored = storedByUrl.get(g.url);
        const factsBrand = of_.brand?.trim() || null;
        // 🔴 복구 «가능» 조건: facts 에 brand 가 없고 · DB stored 는 Identity 에 쓸 수 있다
        const recoverable = !factsBrand && !!stored?.identValue;
        if (!recoverable) {
          return { host: g.host, storedBrand: g.brand, factsBrand, storedIdentValue: stored?.identValue ?? null,
                   recoverable: false, before, after: null, delta: null };
        }
        // 🔴 brand «한 칸» 만 stored 원문으로 채운다. 다른 축은 손대지 않는다.
        const after = judge({ ...of_, brand: stored!.stored }, g.url);
        const d = (k: string) => (after.verdicts[k] ?? 0) - (before.verdicts[k] ?? 0);
        return { host: g.host, storedBrand: g.brand, factsBrand, storedIdentValue: stored!.identValue,
                 recoverable: true, injected: stored!.stored, before, after,
                 // 🔴 blocker 가 실제로 사라졌는가 — 이것이 인과 사슬의 직접 증거다
                 brandBlockerBefore: (before.blockers.BRAND_UNCONFIRMED ?? 0) + (before.blockers.BRAND_MISMATCH ?? 0),
                 brandBlockerAfter: (after.blockers.BRAND_UNCONFIRMED ?? 0) + (after.blockers.BRAND_MISMATCH ?? 0),
                 delta: { SAME: d("SAME"), PRESUMED_SAME: d("PRESUMED_SAME"), SIMILAR: d("SIMILAR"),
                          UNKNOWN: d("UNKNOWN"), CONFLICT: d("CONFLICT") } };
      });

      /* ── 자연실험: brand 있는 origin vs 없는 origin (같은 후보 성격) ── */
      const natural = {
        note: "🔴 후보군이 완전히 같지는 않다 — 같은 호스트/브랜드 계열이라는 점만 통제됐다",
        withBrand: results.find((r) => r.host === "junioredition.com" && r.storedBrand === "Bobo Choses") ?? null,
        withoutBrand: results.filter((r) => r.host === "bobochoses.com"),
      };

      /* ── 🔴 ② 모집단 — 호스트 단위로 전수 추정한다 ────────────────────────
       * 전략 질문은 「497 중 몇 건이 brand 를 잃는가」다. 497 전부에 Light Fetch 를
       * 치는 것은 비용이 과하다. 🔴 그래서 **호스트당 대표 1건** 으로 재고
       * 행 수로 가중한다 — 호스트가 brand 를 담는 경로는 호스트마다 고정이다
       * (Shopify vendor / OFFICIAL_STORE_BRANDS / 없음).
       * 🔴 이것은 sample 1-per-host 추정이다. 전수 측정이 «아니다».
       */
      const hostRows: Record<string, { rows: number; storedUsable: number; sampleUrl: string }> = {};
      for (const r of census.rows) {
        const h = (hostRows[r.host] ??= { rows: 0, storedUsable: 0, sampleUrl: r.url });
        h.rows++;
        if (r.identValue !== null) h.storedUsable++;
      }
      const hostProbe: {
        host: string; rows: number; storedUsableRows: number;
        lfStatus: string; lfBrand: string | null; brandCarried: boolean;
        verdict: string;
      }[] = [];
      for (const [host, h] of Object.entries(hostRows).sort((a, b) => b[1].rows - a[1].rows)) {
        const lf = await factsFromProductUrl(h.sampleUrl);
        const b = lf.candidate?.facts?.brand?.trim() || null;
        const carried = !!b;
        hostProbe.push({
          host, rows: h.rows, storedUsableRows: h.storedUsable,
          lfStatus: lf.status, lfBrand: b, brandCarried: carried,
          // 🔴 세 상태를 갈라 적는다 — 「brand 없음」 하나로 묶으면 원인이 사라진다
          verdict: lf.status !== "OK" ? "🔴 LIGHT_FETCH_FAIL(brand 판단 불가)"
                 : carried ? "🟢 BRAND_CARRIED"
                 : h.storedUsable > 0 ? "🔴 RECOVERABLE(DB 엔 있는데 facts 에 없다)"
                 : "⚪ NO_BRAND_ANYWHERE",
        });
        // eslint-disable-next-line no-console
        console.log(`host ${host.padEnd(24)} rows=${String(h.rows).padStart(3)} lf=${lf.status.padEnd(12)} brand=${b ?? "null"}`);
      }
      const weighted: Record<string, number> = {};
      for (const p of hostProbe) weighted[p.verdict] = (weighted[p.verdict] ?? 0) + p.rows;

      const report = {
        population: { censusN: 497, unusableN: 68, note: "🔴 census 는 전수 · 아래 counterfactual 은 sample N=7" },
        falsePositiveDefense: fpRisk,
        counterfactual: results,
        naturalExperiment: natural,
        hostLevelPopulation: {
          note: "🔴 sample 1-per-host 추정 · 행 수로 가중. 전수 측정이 아니다.",
          hostsProbed: hostProbe.length, rowsCovered: census.rows.length,
          weightedRowsByVerdict: weighted, perHost: hostProbe,
        },
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "mi-p0-08-counterfactual.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify(report, null, 2));
      expect(results).toHaveLength(golden.length);
    },
    180 * 60 * 1000,
  );
});
