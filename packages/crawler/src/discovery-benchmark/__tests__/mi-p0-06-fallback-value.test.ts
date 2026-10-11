/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-06 — Candidate → Identity Conversion Efficiency (CPO 지시, 2026-10-11)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 돈다. **브라우저가 뜬다.**
 *
 * **전략 질문:** 이미 발견한 후보를 Identity 까지 더 많이 전달하는 데
 * 브라우저 fallback 이 **비용 대비 실제 가치**가 있는가.
 *
 * 🔴 CPO 고정 판정 기준: 「읽어냈다」를 성공으로 보지 «않는다».
 *    `universalExtract` 가 읽었다 → `ProductFacts` 로 전환됐다 →
 *    `compareCrossSellerProducts` 가 돌았다 → **SAME/PRESUMED_SAME 이 늘었다**
 *    까지 연결해서 본다.
 *
 * ── 모집단 (전수 · 표본 아님) ───────────────────────────────────────────────
 *   distinct 후보 456 → 상품 URL 229 → 🔴 Light Fetch 실패 **41건** 이 대상이다.
 *   (MI-P0-05 가 적은 「NOT_READABLE 272」는 상품별 중복이 섞인 수였다.)
 *
 *   유형 × raw HTTP (전수 41):
 *     19  NO_FACTS     raw=200   🟢 응답 있음 → 브라우저가 풀 수 있는 성질
 *     15  UNREACHABLE  raw=403   🔴 차단
 *      4  UNREACHABLE  raw=500 · 1 raw=404 · 1 Timeout   🔴 외부
 *      1  UNREACHABLE  raw=200   🟢 우리 fetcher 문제
 *   → 🟢 회수 상한 가설 20/41(49%). 실측으로 확인한다.
 *
 * 🔴 **비용을 코드가 직접 보고한다.** 건당 latency 를 재고, 브라우저 기동이
 *    포함된 첫 건과 이후를 가른다 — 추정하지 않는다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compareCrossSellerProducts } from "../../comparison-search/cross-seller";
import { factsFromProductUrl } from "../../comparison-search/product-url-facts";
import { productFactsFromShopifyProduct } from "../../comparison-search/seller-facts";
import { isSelfReferenceCandidate } from "../../comparison-search/self-reference";
import { universalExtract } from "../../universal-extractor";
import type { ProductFacts } from "@commerce/shared";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(os.tmpdir(), "mi-p0-02");

interface Target { url: string; crawlerUrl: string | null; host: string | null; lfStatus: string; fetchPath: string; raw: { status: number | null; err: string | null } | null }
interface Golden { host: string; url: string; brand: string; code: string | null }
interface Rec { url: string; level: string; discovered: { url: string }[] }

/** 🔴 새 extractor 를 만들지 않는다 — 기존 변환기를 쓴다(MI-P0-05 와 같은 매핑). */
function toFacts(ue: Awaited<ReturnType<typeof universalExtract>>, url: string, host: string): ProductFacts | null {
  const p = ue.productData;
  if (!p?.title) return null;
  return productFactsFromShopifyProduct(
    {
      title: p.title, url, description: p.description, vendor: p.brand,
      type: p.shopifyProductType, tags: p.shopifyTags,
      options: (p.optionGroups ?? []).map((g) => ({ name: g.name, values: g.values })),
      images: ue.images.map((i) => i.url).filter(Boolean),
    },
    host,
  );
}

describe.skipIf(!LIVE)("🔴 MI-P0-06 — 브라우저 fallback 의 비용 대비 가치", () => {
  it(
    "41건 전수 회수 시도 → ProductFacts → Identity → SAME 증가분 · 건당 비용",
    async () => {
      const tp = path.join(OUT_DIR, "mi-p0-06-targets.json");
      if (!existsSync(tp)) throw new Error(`대상 목록 없음: ${tp}`);
      const targets = JSON.parse(readFileSync(tp, "utf8")) as Target[];
      const { golden, recs } = JSON.parse(readFileSync(path.join(OUT_DIR, "mi-p0-03-levels.json"), "utf8")) as { golden: Golden[]; recs: Rec[] };
      const e2e = JSON.parse(readFileSync(path.join(OUT_DIR, "mi-p0-05-e2e.json"), "utf8")) as {
        perProduct: { host: string; brand: string; SAME: number; SAME_LIKELY: number }[];
      };

      /* ── ① origin facts (MI-P0-05 와 같은 폴백) ── */
      const originFacts = new Map<string, ProductFacts | null>();
      for (const g of golden) {
        const lf = await factsFromProductUrl(g.url);
        if (lf.candidate?.facts) { originFacts.set(g.url, lf.candidate.facts); continue; }
        try {
          const ue = await universalExtract(g.url);
          originFacts.set(g.url, toFacts(ue, g.url, g.host));
        } catch { originFacts.set(g.url, null); }
      }

      /* ── ② 어느 후보가 어느 원상품에 속하는가 ── */
      const urlToOrigins = new Map<string, Set<string>>();
      for (const r of recs) for (const d of r.discovered ?? []) {
        const s = urlToOrigins.get(d.url) ?? new Set<string>(); s.add(r.url); urlToOrigins.set(d.url, s);
      }

      /* ── ③ 41건 전수 회수 시도 — 🔴 건당 latency 를 «코드가» 잰다 ── */
      interface Row {
        url: string; host: string | null; lfStatus: string; rawStatus: number | null; rawErr: string | null;
        ueOk: boolean; factsOk: boolean; ms: number; isFirst: boolean;
        /** 🔴 회수 «뒤» 에 새로 얻은 판정. 기존엔 판정 자체가 없었다. */
        newVerdicts: Record<string, string>;
        gainedSame: number; gainedLikely: number; error: string | null;
      }
      const rows: Row[] = [];
      let i = 0;
      for (const t of targets) {
        const target = t.crawlerUrl ?? t.url;
        const t0 = Date.now();
        let ueOk = false, factsOk = false, error: string | null = null;
        const newVerdicts: Record<string, string> = {};
        let gs = 0, gl = 0;
        try {
          const ue = await universalExtract(target);
          ueOk = !!ue.productData?.title;
          const f = toFacts(ue, target, t.host ?? "");
          factsOk = !!f;
          if (f) {
            for (const origin of urlToOrigins.get(t.url) ?? []) {
              if (isSelfReferenceCandidate(origin, target)) continue;
              const of_ = originFacts.get(origin);
              if (!of_) { newVerdicts[origin] = "ORIGIN_FACTS_MISSING"; continue; }
              const v = compareCrossSellerProducts(of_, f).verdict;
              newVerdicts[origin] = v;
              if (v === "SAME") gs++; else if (v === "PRESUMED_SAME") gl++;
            }
          }
        } catch (e) { error = e instanceof Error ? `${e.name}: ${e.message.split("\n")[0]}` : "?"; }
        const ms = Date.now() - t0;
        rows.push({ url: t.url, host: t.host, lfStatus: t.lfStatus, rawStatus: t.raw?.status ?? null,
                    rawErr: t.raw?.err ?? null, ueOk, factsOk, ms, isFirst: i === 0,
                    newVerdicts, gainedSame: gs, gainedLikely: gl, error });
        i++;
        // eslint-disable-next-line no-console
        console.log(`${String(i).padStart(2)}/${targets.length} ${(t.host ?? "?").padEnd(22)} ${t.lfStatus.padEnd(12)} raw=${String(t.raw?.status ?? t.raw?.err ?? "-").padEnd(12)} ue=${ueOk} facts=${factsOk} +SAME=${gs} +LIKELY=${gl} ${ms}ms`);
      }

      /* ── ④ 유형별 · 호스트별 회수율 ── */
      const group = <K extends string>(key: (r: Row) => K) => {
        const m: Record<string, { n: number; facts: number; same: number; likely: number; ms: number }> = {};
        for (const r of rows) {
          const k = key(r);
          m[k] = m[k] ?? { n: 0, facts: 0, same: 0, likely: 0, ms: 0 };
          m[k].n++; if (r.factsOk) m[k].facts++;
          m[k].same += r.gainedSame; m[k].likely += r.gainedLikely; m[k].ms += r.ms;
        }
        return m;
      };
      const nonFirst = rows.filter((r) => !r.isFirst);
      const cost = {
        totalMs: rows.reduce((a, r) => a + r.ms, 0),
        firstCallMs: rows[0]?.ms ?? null,
        medianMsExcludingFirst: (() => {
          const s = nonFirst.map((r) => r.ms).sort((a, b) => a - b);
          return s.length ? s[Math.floor(s.length / 2)] : null;
        })(),
        /** 🔴 브라우저 기동 비용 = 첫 건 − 이후 중앙값 */
        browserStartupMs: null as number | null,
      };
      if (cost.firstCallMs != null && cost.medianMsExcludingFirst != null)
        cost.browserStartupMs = cost.firstCallMs - cost.medianMsExcludingFirst;

      /* ── ⑤ 정책 비교 — 전부 적용 vs 선택 적용 ── */
      const recovered = rows.filter((r) => r.factsOk);
      const sameGain = rows.reduce((a, r) => a + r.gainedSame, 0);
      const likelyGain = rows.reduce((a, r) => a + r.gainedLikely, 0);
      /** 🟢 선택 정책 = raw 200 인 것만(응답이 온 것). 차단·5xx·404 는 건너뛴다. */
      const selective = rows.filter((r) => r.rawStatus === 200);
      const policies = {
        ALL: { attempts: rows.length, ms: cost.totalMs,
               factsRecovered: recovered.length, sameGain, likelyGain },
        SELECTIVE_raw200: {
          attempts: selective.length,
          ms: selective.reduce((a, r) => a + r.ms, 0),
          factsRecovered: selective.filter((r) => r.factsOk).length,
          sameGain: selective.reduce((a, r) => a + r.gainedSame, 0),
          likelyGain: selective.reduce((a, r) => a + r.gainedLikely, 0),
        },
      };

      /* ── ⑥ 상품당 SAME 증가분 — MI-P0-05 대비 ── */
      const beforeByProduct = new Map(e2e.perProduct.map((p) => [`${p.host}|${p.brand}`, p]));
      const gainByOrigin: Record<string, { same: number; likely: number }> = {};
      for (const r of rows) for (const [origin, v] of Object.entries(r.newVerdicts)) {
        gainByOrigin[origin] = gainByOrigin[origin] ?? { same: 0, likely: 0 };
        if (v === "SAME") gainByOrigin[origin].same++; else if (v === "PRESUMED_SAME") gainByOrigin[origin].likely++;
      }
      const perProductGain = golden.map((g) => {
        const before = beforeByProduct.get(`${g.host}|${g.brand}`);
        const gain = gainByOrigin[g.url] ?? { same: 0, likely: 0 };
        return { host: g.host, brand: g.brand, beforeSAME: before?.SAME ?? null,
                 beforeLIKELY: before?.SAME_LIKELY ?? null, gainedSAME: gain.same, gainedLIKELY: gain.likely };
      });

      const report = {
        population: { note: "🔴 전수 — 표본 아님", distinctCandidates: 456, productUrls: 229, fallbackTargets: targets.length },
        byFailureType: group((r) => r.lfStatus as "UNREACHABLE" | "NO_FACTS"),
        byRawStatus: group((r) => String(r.rawStatus ?? r.rawErr ?? "none")),
        byHost: Object.fromEntries(Object.entries(group((r) => r.host ?? "?")).sort((a, b) => b[1].n - a[1].n)),
        cost, policies, perProductGain, rows,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "mi-p0-06-fallback.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, rows: undefined, byHost: undefined }, null, 2));
      expect(rows.length).toBe(targets.length);
    },
    240 * 60 * 1000,
  );
});
