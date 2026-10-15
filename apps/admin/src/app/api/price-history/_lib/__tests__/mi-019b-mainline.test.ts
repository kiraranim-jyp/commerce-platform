/**
 * WU-019B — Shopify Suggest 후보 → 기존 본선 파이프라인 **연결 점검** (새 측정 0)
 *
 * 🔴 새 검색 0 · 새 GT 0 · 새 KPI 0 · parser 0 · threshold 0 · 색상사전 0 ·
 *    정책 0 · UI 0 · DB 0 · Registry 0 · AI 0 · 비용 ₩0 · HTTP 0 · 운영 코드 0.
 * 🟢 입력 = ALT-3 이 저장한 **148 후보** · GT = ALT-3~10 확정분만(재판정 0).
 * 🔴 하니스 규칙(ALT 교훈) — barrel 가정 금지 · 인자 타입 실제 정의 확인 ·
 *    운영 호출 순서 그대로 · owner 를 **실제로 호출** 해 반환값만 기록.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  attachProductMatchTruth,
  deriveMatchTruth,
  withConfidence,
  type ComparisonCandidate,
  type ComparisonSearchResult,
} from "@commerce/crawler";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";
import { overseasMatchDisplay } from "../../../../pipeline/commerce/match-display";

const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

describe("WU-019B 본선 연결 점검", () => {
  it("148 후보를 기존 owner 체인으로 통과시키고 각 단계 반환값/경계를 기록한다", () => {
    const p = path.join(OUT_DIR, "mi-019a-alt3-result.json");
    if (!existsSync(p)) { console.log(`🔴 선행 결과 없음: ${p}`); expect(existsSync(p)).toBe(false); return; }
    const rows = JSON.parse(readFileSync(p, "utf8")).report as { judged?: { title: string; url: string; mi: string | null; conf: number }[] }[];
    const query = { title: "Bubble Sweatshirt in Grey Melange by Main Story", brand: "Main Story",
      sourceUrl: "https://x/products/origin", sku: "AW26MS185" };

    /** verdict 별 집계 — 🔴 각 칸은 owner 반환값이고 내 해석이 아니다. */
    const agg = new Map<string, { n: number; truth: Map<string, number>; tier: Map<string, number>; mt: Map<string, number>; price: Map<string, number> }>();
    let total = 0, accepted = 0;
    for (const r of rows) for (const j of r.judged ?? []) {
      total += 1;
      const base: ComparisonCandidate = { title: j.title, url: j.url, price: null, regularPrice: null, imageUrl: null,
        confidence: j.conf, crossSellerVerdict: (j.mi ?? undefined) as ComparisonCandidate["crossSellerVerdict"] };
      /* ① 운영 입력 형식 수용 여부 */
      const res: ComparisonSearchResult = { shopId: "p", shopName: "p", domain: "p", status: "ok", candidates: withConfidence(query, [base]) };
      if (res.candidates.length === 1) accepted += 1;
      /* ② identity → ③ productMatchTruth → ④ display */
      const out = attachProductMatchTruth(query, [res])[0].candidates[0];
      const tier = out.productMatchTruth ? overseasMatchDisplay(out.productMatchTruth).tier : "(없음)";
      /* ⑤ downstream 경계 — 기존 owner 둘 */
      const mt = deriveMatchTruth(out.matchLevel ?? "low", "unavailable", out.crossSellerVerdict,
        out.crossSellerBlockers, out.crossSellerConflicts, false);
      const priceTier = priceTierFromLink({ matchTruth: mt, verified: false });
      const key = j.mi ?? "(없음)";
      const e = agg.get(key) ?? { n: 0, truth: new Map(), tier: new Map(), mt: new Map(), price: new Map() };
      e.n += 1;
      const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
      bump(e.truth, String(out.productMatchTruth)); bump(e.tier, tier); bump(e.mt, mt); bump(e.price, priceTier);
      agg.set(key, e);
    }
    const fmt = (m: Map<string, number>) => [...m.entries()].map(([k, v]) => `${k}:${v}`).join(" ");
    console.log(`\n══ WU-019B  후보 ${total} · 운영 입력 수용 ${accepted}/${total}`);
    for (const [v, e] of [...agg.entries()].sort((a, b) => b[1].n - a[1].n)) {
      console.log(`\n  cross=${v} (n=${e.n})`);
      console.log(`    productMatchTruth  ${fmt(e.truth)}`);
      console.log(`    display tier       ${fmt(e.tier)}`);
      console.log(`    matchTruth         ${fmt(e.mt)}`);
      console.log(`    🔴 price tier       ${fmt(e.price)}`);
    }
    expect(accepted).toBe(total);
  });
});
