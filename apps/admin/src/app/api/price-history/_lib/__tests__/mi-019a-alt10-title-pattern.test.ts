/**
 * WU-019A-ALT-10 — 제목 패턴 분포와 `splitModelColor` 색상 미추출 영향 (조사만)
 *
 * 🔴 parser 0 · 색상사전 0 · threshold 0 · UI 0 · MI 정책 0 · 신규 검색 0 ·
 *    신규 GT 0 · Registry 0 · DB 0 · 운영 코드 0 · AI 0 · 비용 ₩0 · HTTP 0.
 * 🟢 입력은 ALT-3 이 저장한 **148 후보** 그대로. 🔴 새 KPI 를 만들지 않는다.
 * 🔴 ALT-9 교훈 — 분기를 읽고 추론하지 않고 **owner 를 실제로 호출** 해 측정한다.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  attachProductMatchTruth,
  withConfidence,
  type ComparisonCandidate,
  type ComparisonSearchResult,
} from "@commerce/crawler";
/** 🔴 barrel 미노출(index.ts 는 import 만 하고 re-export 하지 않는다) — 직접 경로로 쓴다.
 *    🔴 운영 코드에 export 를 추가하지 않는다. */
import { splitModelColor } from "@commerce/crawler/src/comparison-search/match";
import { overseasMatchDisplay } from "../../../../pipeline/commerce/match-display";

const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

/** 🔴 분포 측정용 라벨이다 — **새 parser 규칙이 아니다.** */
function classifyPattern(title: string): string {
  if (/\sin\s.+\sby\s/i.test(title)) return "MODEL_IN_COLOR_BY_BRAND";
  if (/\s-\s.+\s-\s/.test(title)) return "MODEL - PRODUCT - COLOR";
  if (/,\s/.test(title)) return "MODEL, COLOR";
  return "기타/미분류";
}

describe("WU-019A-ALT-10 제목 패턴 분포", () => {
  it("148 후보의 패턴 · 색상 추출 · 최종 등급 영향을 센다", () => {
    const p = path.join(OUT_DIR, "mi-019a-alt3-result.json");
    if (!existsSync(p)) {
      console.log(`🔴 선행 결과 없음: ${p}`);
      expect(existsSync(p)).toBe(false);
      return;
    }
    const rows = JSON.parse(readFileSync(p, "utf8")).report as { id: string; judged?: { title: string; url: string; mi: string | null; conf: number }[] }[];
    const ORIGIN = "Bubble Sweatshirt in Grey Melange by Main Story";
    const query = { title: ORIGIN, brand: "Main Story", sourceUrl: "https://x/products/origin", sku: "AW26MS185" };

    const byPattern = new Map<string, { n: number; colorMissing: number; yellow: number; blue: number }>();
    let total = 0;
    for (const r of rows) {
      for (const j of r.judged ?? []) {
        total += 1;
        const pat = classifyPattern(j.title);
        /* 🟢 owner 를 실제로 부른다(추론 0). */
        const split = splitModelColor(j.title);
        const base: ComparisonCandidate = {
          title: j.title, url: j.url, price: null, regularPrice: null, imageUrl: null,
          confidence: j.conf, crossSellerVerdict: (j.mi ?? undefined) as ComparisonCandidate["crossSellerVerdict"],
        };
        const res: ComparisonSearchResult = { shopId: "p", shopName: "p", domain: "p", status: "ok", candidates: withConfidence(query, [base]) };
        const out = attachProductMatchTruth(query, [res])[0].candidates[0];
        const tier = out.productMatchTruth ? overseasMatchDisplay(out.productMatchTruth).tier : null;
        const e = byPattern.get(pat) ?? { n: 0, colorMissing: 0, yellow: 0, blue: 0 };
        e.n += 1;
        if (!split.color) e.colorMissing += 1;
        if (tier === "PRESUMED_SAME") e.yellow += 1;
        if (tier === "SAME_MODEL_OPTION_DIFF") e.blue += 1;
        byPattern.set(pat, e);
      }
    }
    console.log(`\n══ ALT-10  후보 ${total}건`);
    let missing = 0;
    for (const [pat, e] of [...byPattern.entries()].sort((a, b) => b[1].n - a[1].n)) {
      missing += e.colorMissing;
      console.log(`  ${pat.padEnd(26)} n=${String(e.n).padStart(3)} · 색상 미추출 ${String(e.colorMissing).padStart(3)} · 🟡 ${e.yellow} · 🔵 ${e.blue}`);
    }
    console.log(`  색상 미추출 합계 ${missing}/${total} = ${Math.round((missing / total) * 100)}%`);
    expect(total).toBeGreaterThan(0);
  });
});
