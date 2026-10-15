/**
 * WU-019C — `modelCode` evidence 보강이 matchTruth/price tier 를 바꾸는가 (HTTP 0)
 *
 * 🔴 새 검색 0 · HTTP 0 · 신규 후보 0 · 신규 GT 0 · threshold 0 · 색상사전 0 ·
 *    parser 0 · 정책 0 · `deriveMatchTruth` 0 · price tier 로직 0 · UI/DB/Registry 0.
 * 🟢 입력 = ALT-3 저장 데이터(title/url) + **원상품별 품번**. owner 만 호출한다.
 * 🔴 한계 — 이 측정은 **owner-level modelCode evidence impact** 이고
 *    「그 품번이 실제 그 상품의 품번이다」를 새로 GT 검증한 것이 **아니다.**
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { confirmBrandCodeInEvidence, deriveMatchTruth, withConfidence, type ComparisonCandidate, type ModelEvidenceResult } from "@commerce/crawler";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";

const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

describe("WU-019C modelCode evidence 영향", () => {
  it("148 후보에 품번 증거를 채워 보강 전후를 비교한다", () => {
    const p = path.join(OUT_DIR, "mi-019a-alt3-result.json");
    if (!existsSync(p)) { console.log(`🔴 선행 결과 없음: ${p}`); expect(existsSync(p)).toBe(false); return; }
    const rows = JSON.parse(readFileSync(p, "utf8")).report as { id: string; sku?: string; judged?: { title: string; url: string; mi: string | null; conf: number }[] }[];

    let total = 0, confirmed = 0, mtChanged = 0, tierChanged = 0, newExact = 0, downgraded = 0;
    const detail: string[] = [];
    for (const r of rows) {
      const sku = r.sku ?? null;
      const query = { title: "x", brand: undefined, sourceUrl: "https://x/products/o", sku: sku ?? undefined };
      for (const j of r.judged ?? []) {
        total += 1;
        const base: ComparisonCandidate = { title: j.title, url: j.url, price: null, regularPrice: null, imageUrl: null,
          confidence: j.conf, crossSellerVerdict: (j.mi ?? undefined) as ComparisonCandidate["crossSellerVerdict"] };
        const c = withConfidence(query, [base])[0];
        /* 🟢 owner 호출 — WU-007A 수정 덕에 URL 의 `_psq`(우리 질의)는 증거에서 제외된다. */
        const code = sku ? confirmBrandCodeInEvidence(sku, { title: c.title, url: c.url, sku: c.sku ?? null }) : null;
        if (code) confirmed += 1;
        const before: ModelEvidenceResult = "unavailable";
        const after: ModelEvidenceResult = code ? "exact" : "unavailable";
        const mtB = deriveMatchTruth(c.matchLevel ?? "low", before, c.crossSellerVerdict, c.crossSellerBlockers, c.crossSellerConflicts, false);
        const mtA = deriveMatchTruth(c.matchLevel ?? "low", after, c.crossSellerVerdict, c.crossSellerBlockers, c.crossSellerConflicts, false);
        const tB = priceTierFromLink({ matchTruth: mtB, verified: false });
        const tA = priceTierFromLink({ matchTruth: mtA, verified: false });
        if (mtB !== mtA) mtChanged += 1;
        if (tB !== tA) {
          tierChanged += 1;
          if (tA === "EXACT") newExact += 1;
          if (tB === "EXACT" && tA !== "EXACT") downgraded += 1;
          if (detail.length < 8) detail.push(`${r.id} cross=${j.mi} ${mtB}→${mtA} · tier ${tB}→${tA} | ${j.title.slice(0, 34)}`);
        }
      }
    }
    console.log(`\n══ WU-019C  후보 ${total}`);
    console.log(`  modelCode evidence 확보 **${confirmed}/${total}** = ${Math.round((confirmed / total) * 100)}%`);
    console.log(`  matchTruth 변경 **${mtChanged}** · price tier 변경 **${tierChanged}**`);
    console.log(`  EXACT 로 새로 올라감 **${newExact}** · EXACT 에서 내려감 **${downgraded}**`);
    for (const d of detail) console.log(`    ${d}`);
    expect(total).toBeGreaterThan(0);
  });
});
