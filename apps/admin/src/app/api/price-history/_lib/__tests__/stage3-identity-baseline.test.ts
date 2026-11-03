import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 STAGE 3-A — **수집 → Evidence → 동일상품 판단**을 기존 기준선으로 다시 잰다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO(2026-11-04): 「**후보를 수집했는가**가 아니라, 기존 테스트 자료의 실제 판단 결과와
 * 비교했을 때 **동일상품을 제대로 골라내는가**」. 🔴 코드 변경 **0** · 네트워크 **0**.
 *
 * ── 🔴 섞지 않는 것 ────────────────────────────────────────────────────────
 * ```
 * 기존 테스트 자료(wu-059-gt-facts)  → **회귀 기준선**(사람 라벨 + 그때의 facts)
 * 운영 데이터(sprint5-brand-gt)      → **지금 실제 공급/판정 상태**
 * 🔴 운영이 다르다고 **기준선 정답을 바꾸지 않는다** · 기준선 PASS 를 「운영 정상」으로 읽지 않는다
 * ```
 * 🔴 **단계별로 갈라서** 적는다 — 수집 / Evidence / Identity / Human GT 일치.
 */

const FIX = join(__dirname, "fixtures");
const pad = (s: unknown, n: number) => String(s ?? "-").slice(0, n) + " ".repeat(Math.max(0, n - String(s ?? "-").length));

interface GtCandidate {
  searchId: string;
  domain: string;
  url: string;
  humanGt: string;
  title: string;
  facts: Record<string, unknown>;
  price?: unknown;
}

const gt = JSON.parse(readFileSync(join(FIX, "wu-059-gt-facts.json"), "utf8")) as {
  origins: Record<string, { canonicalProduct: unknown }>;
  candidates: Record<string, GtCandidate>;
};
const ops = JSON.parse(readFileSync(join(FIX, "sprint5-brand-gt.json"), "utf8")) as {
  rows: {
    id: string;
    candidateDomain: string | null;
    candidateTitle: string | null;
    systemVerdict: string | null;
    blockers: string[];
    hasBrandMismatch: boolean;
    humanVerdict: string;
    market: string | null;
    candidateBrandInReason: string | null;
  }[];
};

/** 🔴 Evidence 축은 **운영 facts 의 칸 이름 그대로** 본다(추측 금지). */
const AXES: { key: string; label: string }[] = [
  { key: "brand", label: "BRAND" },
  { key: "coreTitleTokens", label: "TITLE" },
  { key: "brandModelCode", label: "MODEL_CODE" },
  { key: "categoryText", label: "CATEGORY" },
  { key: "colorText", label: "COLOR" },
  { key: "materialText", label: "MATERIAL" },
  { key: "fitText", label: "FIT" },
  { key: "audienceSignals", label: "AUDIENCE" },
];
const hasAxis = (f: Record<string, unknown>, k: string) => {
  const v = f[k];
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  return String(v).trim().length > 0;
};

const POSITIVE = new Set(["SAME", "PRESUMED_SAME"]);

describe("STAGE3-A — 기존 기준선으로 동일상품 판단을 다시 잰다", () => {
  it("🔎 ①수집 ②Evidence ③Identity ④Human GT 를 **갈라서** 센다", () => {
    /* eslint-disable no-console */
    const originFacts = new Map<string, ReturnType<typeof productFactsFromIdentityDna>>();
    for (const [sid, o] of Object.entries(gt.origins)) {
      originFacts.set(sid, productFactsFromIdentityDna(buildProductIdentityDna(o.canonicalProduct as never)));
    }
    const rows = Object.entries(gt.candidates);

    /* ── ① 수집 ───────────────────────────────────────────────────────── */
    const withUrl = rows.filter(([, c]) => Boolean(c.url));
    const withTitle = rows.filter(([, c]) => Boolean(c.title));
    const withPrice = rows.filter(([, c]) => c.price != null);
    const kr = rows.filter(([, c]) => /\.kr(\/|$)|\.co\.kr/.test(c.domain));
    console.log("\n═══ ① 수집(기준선 fixture) ═══");
    console.log(
      `  후보 ${rows.length} · URL ${withUrl.length} · 제목 ${withTitle.length} · 가격 ${withPrice.length}` +
        ` · 🇰🇷 ${kr.length} · 🌎 ${rows.length - kr.length}`,
    );

    /* ── ② Evidence 축별 확보율 ──────────────────────────────────────── */
    console.log("\n═══ ② Evidence 축별 확보(후보 기준) ═══");
    const axisHave = new Map<string, number>();
    for (const a of AXES) {
      const n = rows.filter(([, c]) => hasAxis(c.facts, a.key)).length;
      axisHave.set(a.label, n);
      console.log(`  ${pad(a.label, 12)} ${pad(n, 3)}/${rows.length}${n === 0 ? "  🔴 전건 없음" : ""}`);
    }

    /* ── ③ Identity ──────────────────────────────────────────────────── */
    console.log("\n═══ ③ Identity(운영 compareCrossSellerProducts) ═══");
    console.log(`${pad("id", 6)} ${pad("판매처", 22)} ${pad("human", 10)} ${pad("verdict", 14)} ${pad("축", 22)} blockers`);
    const verdictFreq = new Map<string, number>();
    let fn = 0;
    let fp = 0;
    let pass = 0;
    const fnRows: string[] = [];
    const fpRows: string[] = [];
    let conflictLeak = 0;
    let noIdAxisPositive = 0;

    for (const [cid, c] of rows) {
      const of_ = originFacts.get(c.searchId);
      if (!of_) continue;
      const r = compareCrossSellerProducts(of_, c.facts as never) as {
        verdict: string;
        blockers?: { blocker: string }[];
      };
      const blk = (r.blockers ?? []).map((b) => b.blocker);
      verdictFreq.set(r.verdict, (verdictFreq.get(r.verdict) ?? 0) + 1);
      const positive = POSITIVE.has(r.verdict);
      const axesHere = AXES.filter((a) => hasAxis(c.facts, a.key)).map((a) => a.label);
      /** 🔴 Sprint 5 의 그 패턴 — 식별 축(TITLE·MODEL_CODE)이 **0** 인데 positive. */
      const hasIdAxis = axesHere.includes("TITLE") || axesHere.includes("MODEL_CODE");
      if (positive && !hasIdAxis) noIdAxisPositive++;
      /** 🔴 CONFLICT 누출 — CONFLICT 인데 positive 로 올라오면 안 된다. */
      if (blk.includes("MODEL_CODE") && positive) conflictLeak++;

      let mark = "  ·";
      if (c.humanGt === "SAME") {
        if (positive) {
          pass++;
          mark = "🟢PASS";
        } else {
          fn++;
          mark = "🔴FN";
          fnRows.push(`${cid} ${c.domain} → ${r.verdict}`);
        }
      } else if (c.humanGt === "DIFFERENT") {
        if (positive) {
          fp++;
          mark = "🔴FP";
          fpRows.push(`${cid} ${c.domain} → ${r.verdict} blk=${blk.join("|") || "-"}`);
        } else {
          pass++;
          mark = "🟢PASS";
        }
      }
      console.log(
        `${mark} ${pad(cid, 5)} ${pad(c.domain, 22)} ${pad(c.humanGt, 10)} ${pad(r.verdict, 14)} ` +
          `${pad(axesHere.join("+"), 22)} ${blk.join("|") || "-"}`,
      );
    }
    console.log(`\n  verdict 분포 ${JSON.stringify(Object.fromEntries(verdictFreq))}`);

    /* ── ④ Human GT 일치 ─────────────────────────────────────────────── */
    const labelled = rows.filter(([, c]) => ["SAME", "DIFFERENT"].includes(c.humanGt)).length;
    console.log("\n═══ ④ 기존 정답 대비 ═══");
    console.log(`  라벨 있는 후보 ${labelled} · 🟢 PASS ${pass} · 🔴 FN(동일상품 놓침) ${fn} · 🔴 FP(과대 승격) ${fp}`);
    for (const l of fnRows) console.log(`   🔴 FN ${l}`);
    for (const l of fpRows) console.log(`   🔴 FP ${l}`);
    console.log(`  CONFLICT 누출 ${conflictLeak} · 🔴 식별축 0 인데 positive ${noIdAxisPositive}`);

    /* ── ⑤ Sprint 5 패턴을 «운영 데이터» 에서 재현 ─────────────────── */
    const scored = ops.rows.filter((r) => r.systemVerdict);
    const opsFp = scored.filter((r) => r.humanVerdict === "DIFFERENT" && POSITIVE.has(r.systemVerdict!));
    const opsTp = scored.filter((r) => r.humanVerdict === "SAME" && POSITIVE.has(r.systemVerdict!));
    const opsFpBrand = opsFp.filter((r) => r.hasBrandMismatch);
    const reverse = scored.filter((r) => r.humanVerdict === "SAME" && r.hasBrandMismatch);
    console.log("\n═══ ⑤ Sprint 5 패턴 재현(운영 데이터 · 별도 분모) ═══");
    console.log(`  판정 보유 ${scored.length} · FP ${opsFp.length} · TP ${opsTp.length}`);
    console.log(`  ① BRAND_MISMATCH FP ${opsFpBrand.length}/${opsFp.length}  ← Sprint 5 의 10/13 이 재현되는가`);
    console.log(`  ② reverse-risk(human SAME × BRAND_MISMATCH) ${reverse.length}`);
    console.log(`  ③ 운영 verdict 분포 ${JSON.stringify(
      scored.reduce<Record<string, number>>((a, r) => ((a[r.systemVerdict!] = (a[r.systemVerdict!] ?? 0) + 1), a), {}),
    )}`);
    const krOps = scored.filter((r) => r.market === "KR");
    console.log(`  ④ 🇰🇷 운영 분모 ${krOps.length} · 🌎 ${scored.length - krOps.length}`);

    /** 🔴 숫자를 단언으로 고정하지 않는다(측정이다). 🟢 분모 성립만 단언한다. */
    expect(rows.length, "🔴 기준선이 비었다 — 측정불가").toBeGreaterThan(0);
    expect(labelled, "🔴 사람 라벨이 없다 — 대조 불가").toBeGreaterThan(0);
    expect(scored.length, "🔴 운영 분모가 비었다").toBeGreaterThan(0);
  });
});
