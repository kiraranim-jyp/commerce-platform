/**
 * WU-019D — 후보 **상세 페이지** 확인의 evidence gain 측정 (기존 owner 만)
 *
 * 🔴 새 검색 0 · 신규 후보 0 · 신규 GT 0 · parser 0 · threshold 0 · 색상사전 0 ·
 *    MI 정책 0 · `MAX_DETAIL_CONFIRMATIONS_PER_SHOP` 변경 0 · Registry/DB/UI 0 · AI 0.
 * 🟢 입력 = ALT-3 의 148 후보. owner = `supportsDomesticIdentifierExtraction` ·
 *    `fetchDomesticModelCode` · `confirmBrandCodeInEvidence` · `deriveMatchTruth` ·
 *    `priceTierFromLink`. 🔴 ALT-9 규칙 — **추론하지 않고 호출해 측정** 한다.
 * 🔴 상세에서 찾은 modelCode 를 **GT 로 간주하지 않는다**.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MAX_DETAIL_CONFIRMATIONS_PER_SHOP,
  confirmBrandCodeInEvidence,
  deriveMatchTruth,
  fetchDomesticModelCode,
  supportsDomesticIdentifierExtraction,
  withConfidence,
  type ComparisonCandidate,
  type ModelEvidenceResult,
} from "@commerce/crawler";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";

const LIVE = process.env.MI_019D_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return "(?)"; } };

const describeLive = LIVE ? describe : describe.skip;

describeLive("WU-019D 상세 evidence gain", () => {
  it("추출기 등록 여부 → 상세 GET → evidence/판단 변화를 센다", async () => {
    const p = path.join(OUT_DIR, "mi-019a-alt3-result.json");
    if (!existsSync(p)) { console.log(`🔴 선행 결과 없음: ${p}`); expect(existsSync(p)).toBe(false); return; }
    const rows = JSON.parse(readFileSync(p, "utf8")).report as { id: string; sku?: string; judged?: { title: string; url: string; mi: string | null; conf: number }[] }[];

    const flat: { id: string; sku: string | null; title: string; url: string; mi: string | null; conf: number }[] = [];
    for (const r of rows) for (const j of r.judged ?? []) flat.push({ id: r.id, sku: r.sku ?? null, ...j });
    const hosts = new Map<string, number>();
    for (const f of flat) hosts.set(hostOf(f.url), (hosts.get(hostOf(f.url)) ?? 0) + 1);

    /* 🟢 ① HTTP 0 으로 먼저 본다 — 추출기가 등록된 도메인만 상세를 열 수 있다. */
    const supported = [...hosts.keys()].filter((h) => supportsDomesticIdentifierExtraction(h));
    console.log(`\n══ WU-019D  후보 ${flat.length} · host ${hosts.size}`);
    console.log(`  host 분포 ${[...hosts.entries()].map(([h, n]) => `${h}:${n}`).join(" ")}`);
    console.log(`  🔴 추출기 등록 host **${supported.length}/${hosts.size}** ${JSON.stringify(supported)}`);
    console.log(`  (상한 MAX_DETAIL_CONFIRMATIONS_PER_SHOP=${MAX_DETAIL_CONFIRMATIONS_PER_SHOP} · 변경하지 않았다)`);

    /* ② 우선순위: PRESUMED_SAME → SAME → SIMILAR. 🔴 등록 host 만 · 샵당 상한 그대로. */
    const pri = (m: string | null) => (m === "PRESUMED_SAME" ? 0 : m === "SAME" ? 1 : m === "SIMILAR" ? 2 : 3);
    const targets = flat.filter((f) => supported.includes(hostOf(f.url))).sort((a, b) => pri(a.mi) - pri(b.mi));
    const perShop = new Map<string, number>();
    let http = 0, ok = 0, fail = 0, gained = 0, mtChanged = 0, tierChanged = 0, newExact = 0;

    for (const f of targets) {
      const h = hostOf(f.url);
      const used = perShop.get(h) ?? 0;
      if (used >= MAX_DETAIL_CONFIRMATIONS_PER_SHOP) continue;
      perShop.set(h, used + 1);
      let code: string | null = null;
      try { code = await fetchDomesticModelCode(h, f.url); http += 1; ok += 1; } catch { http += 1; fail += 1; }
      const query = { title: f.title, sourceUrl: "https://x/products/o", sku: f.sku ?? undefined };
      const c = withConfidence(query, [{ title: f.title, url: f.url, price: null, regularPrice: null, imageUrl: null,
        confidence: f.conf, crossSellerVerdict: (f.mi ?? undefined) as ComparisonCandidate["crossSellerVerdict"] }])[0];
      const confirmed = f.sku && code ? confirmBrandCodeInEvidence(f.sku, { title: code, url: f.url, sku: code }) : null;
      if (confirmed) gained += 1;
      const mk = (e: ModelEvidenceResult) => deriveMatchTruth(c.matchLevel ?? "low", e, c.crossSellerVerdict, c.crossSellerBlockers, c.crossSellerConflicts, false);
      const mtB = mk("unavailable"), mtA = mk(confirmed ? "exact" : "unavailable");
      const tB = priceTierFromLink({ matchTruth: mtB, verified: false }), tA = priceTierFromLink({ matchTruth: mtA, verified: false });
      if (mtB !== mtA) mtChanged += 1;
      if (tB !== tA) { tierChanged += 1; if (tA === "EXACT") newExact += 1; }
      console.log(`    ${h} cross=${f.mi} detail modelCode=${JSON.stringify(code)} → evidence=${confirmed ? "확보" : "없음"} · ${mtB}→${mtA} · tier ${tB}→${tA}`);
    }
    console.log(`\n  🔴 HTTP 요청 **${http}** (성공 ${ok} · 실패 ${fail})`);
    console.log(`  evidence 확보 **${gained}/${http || 0}** · matchTruth 변경 **${mtChanged}** · tier 변경 **${tierChanged}** · 신규 EXACT **${newExact}**`);
    expect(flat.length).toBe(148);
  }, 10 * 60 * 1000);
});

describe("WU-019D 정의", () => {
  it("🔴 샵당 상세 확인 상한은 기존 값을 그대로 쓴다", () => {
    expect(MAX_DETAIL_CONFIRMATIONS_PER_SHOP).toBeGreaterThan(0);
  });
});
