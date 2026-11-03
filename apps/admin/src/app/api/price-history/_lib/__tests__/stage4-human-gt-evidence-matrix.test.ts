import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 STAGE 4 — **IDENTITY-EVIDENCE-HUMAN-GT-ANALYSIS**(CPO 2026-11-04)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO: 「사람이 동일상품이라고 판단할 때 **실제로 어떤 증거를 비교하는지** 밝혀낸다.」
 * 🔴 **코드 수정 0 · threshold 0 · scoring 0 · blocker 0 · policy 0 · 네트워크 0.**
 * 🔴 **정책 제안을 이 파일에 적지 않는다** — 산출은 «비교표» 다.
 *
 * 🔴 새 테스트 상품을 **추가하지 않았다** — 기존 사람 판단 자료만 쓴다.
 */

const FIX = join(__dirname, "fixtures");
const pad = (s: unknown, n: number) => String(s ?? "-").slice(0, n) + " ".repeat(Math.max(0, n - String(s ?? "-").length));
const short = (s: unknown, n: number) => (s == null ? "-" : String(s).replace(/\s+/g, " ").slice(0, n));

interface GtCandidate {
  searchId: string;
  domain: string;
  url: string;
  humanGt: string;
  humanReason?: string;
  title: string;
  facts: Record<string, unknown>;
}
const gt = JSON.parse(readFileSync(join(FIX, "wu-059-gt-facts.json"), "utf8")) as {
  origins: Record<string, { canonicalProduct: Record<string, unknown> }>;
  candidates: Record<string, GtCandidate>;
};
const ops = JSON.parse(readFileSync(join(FIX, "sprint5-brand-gt.json"), "utf8")) as {
  rows: {
    id: string;
    originTitle: string | null;
    candidateDomain: string | null;
    candidateTitle: string | null;
    systemVerdict: string | null;
    blockers: string[];
    humanVerdict: string;
    matchReasons: string[] | null;
    candidateBrandInReason: string | null;
    originBrandInReason: string | null;
  }[];
};

const POSITIVE = new Set(["SAME", "PRESUMED_SAME"]);
/** 🔴 **운영 타입의 칸 이름 그대로** — 추측하지 않는다. */
const AXES = [
  ["brand", "BRAND"],
  ["brandModelCode", "MODEL"],
  ["sellerSku", "SKU"],
  ["title", "TITLE"],
  ["categoryText", "CATEGORY"],
  ["colorText", "COLOR"],
  ["materialText", "MATERIAL"],
  ["fitText", "FIT"],
  ["ageRangeText", "AGE"],
  ["audienceSignals", "AUDIENCE"],
  ["imageUrls", "IMAGE"],
] as const;

describe("STAGE4 — Human GT Evidence Matrix (분석 전용)", () => {
  it("① Human GT Evidence Matrix · ② Description-derived · ③ TP vs FP", () => {
    /* eslint-disable no-console */
    const originFacts = new Map<string, ReturnType<typeof productFactsFromIdentityDna>>();
    const originRaw = new Map<string, Record<string, unknown>>();
    for (const [sid, o] of Object.entries(gt.origins)) {
      originFacts.set(sid, productFactsFromIdentityDna(buildProductIdentityDna(o.canonicalProduct as never)));
      originRaw.set(sid, o.canonicalProduct);
    }

    /* ══ 0. 구조 사실 — 후보가 «설명» 을 들고 다니는가 ══════════════════ */
    const candHasDescription = Object.values(gt.candidates).filter((c) =>
      Object.keys(c.facts).some((k) => /desc/i.test(k)),
    ).length;
    const originHasDescription = [...originRaw.values()].filter((o) => o.description || o.descriptionKo).length;
    console.log("\n═══ 0. 구조 — 설명(DESCRIPTION)은 어디에 있는가 ═══");
    console.log(`  원상품 canonicalProduct 에 description 보유  ${originHasDescription}/${originRaw.size}`);
    console.log(`  🔴 **후보 facts 에 description 계열 칸 보유  ${candHasDescription}/${Object.keys(gt.candidates).length}**`);
    console.log("  🔴 운영 타입 `ProductFacts` 에도 그 칸이 **없다**(brand·modelCode·title·category·");
    console.log("     color·material·fit·age·size·audience·image 뿐) ⟹ 후보측 설명은 **구조적으로 비교 불가**");

    /* ══ ① Human GT Evidence Matrix — 값으로 적는다 ════════════════════ */
    console.log("\n═══ ① Human GT Evidence Matrix(값 · 원상품 ↔ 후보) ═══");
    interface Row {
      id: string;
      group: "A" | "B" | "C" | "D";
      human: string;
      ai: string;
      blockers: string[];
      shared: string[];
      onlyOrigin: string[];
      c: GtCandidate;
    }
    const rows: Row[] = [];
    for (const [cid, c] of Object.entries(gt.candidates)) {
      const of_ = originFacts.get(c.searchId);
      if (!of_) continue;
      const r = compareCrossSellerProducts(of_, c.facts as never) as {
        verdict: string;
        blockers?: { blocker: string }[];
      };
      const blk = (r.blockers ?? []).map((b) => b.blocker);
      const positive = POSITIVE.has(r.verdict);
      const group: Row["group"] =
        c.humanGt === "SAME" ? (positive ? "A" : "C") : positive ? "B" : "D";
      const val = (o: Record<string, unknown>, k: string) => {
        const v = o[k];
        if (v == null) return null;
        if (Array.isArray(v)) return v.length ? String(v.length) : null;
        return String(v).trim() || null;
      };
      const shared: string[] = [];
      const onlyOrigin: string[] = [];
      for (const [k, label] of AXES) {
        const a = val(of_ as unknown as Record<string, unknown>, k);
        const b = val(c.facts, k);
        if (a && b) shared.push(label);
        else if (a && !b) onlyOrigin.push(label);
      }
      rows.push({ id: cid, group, human: c.humanGt, ai: r.verdict, blockers: blk, shared, onlyOrigin, c });
    }

    console.log(
      `${pad("grp", 4)} ${pad("id", 5)} ${pad("human", 10)} ${pad("AI", 14)} ${pad("양쪽 있는 축", 34)} ${pad("후보에 없는 축", 26)} blockers`,
    );
    for (const g of ["A", "B", "C", "D"] as const) {
      for (const r of rows.filter((x) => x.group === g)) {
        console.log(
          `${pad(g, 4)} ${pad(r.id, 5)} ${pad(r.human, 10)} ${pad(r.ai, 14)} ${pad(r.shared.join("+"), 34)} ` +
            `${pad(r.onlyOrigin.join("+"), 26)} ${r.blockers.join("|") || "-"}`,
        );
        console.log(
          `              후보 "${short(r.c.title, 62)}"  brand=${short(r.c.facts.brand, 18)} code=${short(r.c.facts.brandModelCode, 14)}`,
        );
        if (r.c.humanReason) console.log(`              👤 사람 사유: ${short(r.c.humanReason, 80)}`);
      }
    }

    /* ══ ③ TP vs FP — A 와 B 를 가르는 축 ═════════════════════════════ */
    console.log("\n═══ ③ TP(A) vs FP(B) — 축별 보유 빈도 ═══");
    const A = rows.filter((r) => r.group === "A");
    const B = rows.filter((r) => r.group === "B");
    console.log(`${pad("축", 12)} ${pad("A(정상 SAME)", 14)} ${pad("B(잘못된 SAME)", 16)} 차이`);
    for (const [, label] of AXES) {
      const a = A.filter((r) => r.shared.includes(label)).length;
      const b = B.filter((r) => r.shared.includes(label)).length;
      const ar = A.length ? a / A.length : 0;
      const br = B.length ? b / B.length : 0;
      const mark = ar - br >= 0.4 ? "  🟢 A 에서 더 흔하다" : br - ar >= 0.4 ? "  🔴 B 에서 더 흔하다" : "";
      console.log(`${pad(label, 12)} ${pad(`${a}/${A.length}`, 14)} ${pad(`${b}/${B.length}`, 16)}${mark}`);
    }
    console.log(`  A 의 blockers: ${A.map((r) => r.blockers.join("|") || "none").join(" · ")}`);
    console.log(`  B 의 blockers: ${B.map((r) => r.blockers.join("|") || "none").join(" · ")}`);

    /* ══ C06 — 나란히 ═════════════════════════════════════════════════ */
    const c06 = Object.entries(gt.candidates).find(([k]) => k === "C06");
    if (c06) {
      const [, c] = c06;
      const of_ = originFacts.get(c.searchId)! as unknown as Record<string, unknown>;
      console.log("\n═══ C06 — 왜 사람은 DIFFERENT 인데 시스템은 SAME 까지 갔는가 ═══");
      console.log(`${pad("축", 12)} ${pad("원상품", 40)} ${pad("후보", 40)}`);
      for (const [k, label] of AXES) {
        console.log(`${pad(label, 12)} ${pad(short(of_[k], 38), 40)} ${pad(short((c.facts as Record<string, unknown>)[k], 38), 40)}`);
      }
      console.log(`  👤 사람 사유: ${c.humanReason ?? "(없음)"}`);
    }

    /* ══ ② 운영 FP/TP 의 «실제 근거 문장» ═════════════════════════════ */
    console.log("\n═══ ② 운영 데이터 — 사람이 본 것과 AI 가 적은 근거(원문) ═══");
    const scored = ops.rows.filter((r) => r.systemVerdict);
    for (const r of scored.filter((x) => x.humanVerdict === "SAME" && POSITIVE.has(x.systemVerdict!)).slice(0, 3)) {
      console.log(`  🟢TP ${pad(r.candidateDomain, 22)} "${short(r.candidateTitle, 50)}"`);
      console.log(`       근거 ${(r.matchReasons ?? []).filter((l) => l.startsWith("근거:")).map((l) => l.slice(4)).join(" · ") || "-"}`);
    }
    for (const r of scored.filter((x) => x.humanVerdict === "DIFFERENT" && POSITIVE.has(x.systemVerdict!)).slice(0, 5)) {
      console.log(`  🔴FP ${pad(r.candidateDomain, 22)} "${short(r.candidateTitle, 50)}"`);
      console.log(`       근거 ${(r.matchReasons ?? []).filter((l) => l.startsWith("근거:")).map((l) => l.slice(4)).join(" · ") || "-"}`);
      console.log(`       보류 ${(r.matchReasons ?? []).filter((l) => l.startsWith("보류:")).map((l) => l.slice(4)).join(" · ") || "-"}`);
    }

    expect(rows.length, "🔴 기준선이 비었다").toBeGreaterThan(0);
    expect(scored.length, "🔴 운영 분모가 비었다").toBeGreaterThan(0);
  });
});
