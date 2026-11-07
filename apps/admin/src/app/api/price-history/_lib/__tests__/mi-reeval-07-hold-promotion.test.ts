import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SAME05_BASELINE, SAME05_PAIRS, same05Judge } from "./core-same05-gt";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-REEVAL **STEP 6-A** — **보류 승격 안전성 검증**(CPO 결정 ③ · Shadow 전용)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **운영 판정 로직 · matcher · extractor · Identity · alias · GT · DB · schema
 *    변경 0 · 네트워크 0 · 운영 반영 0.**
 *
 * ── 🔴 CPO 가 물은 것 ───────────────────────────────────────────────────────
 * ```
 * 「보류를 SAME 으로 올려도 **안전한 조건이 실제로 존재하는가**」
 * 전환을 **분리** 한다 — `PRESUMED_SAME → SAME` · `SIMILAR → SAME` · `CONFLICT → SAME`
 * 그리고 과거 저하 조건(precision 91.7% → 55.6%)을 **재현** 한다
 * ```
 *
 * ── 🔴🔴 **FN 만 최적화하지 않는다** ────────────────────────────────────────
 * ```
 * 통과 조건 — FP 가 기준선보다 **증가하지 않고** · 기존 TP 를 **잃지 않는다**
 * 🔴 두 분모를 **같이** 적는다 — 33쌍(전체 통제) · 22쌍(Main Story 제외 · 운영 적격)
 * ```
 */

const DOCS = join(__dirname, "..", "..", "..", "..", "..", "..", "..", "..", "docs");
const FIX = join(__dirname, "fixtures");
const J = (f: string) => JSON.parse(readFileSync(join(FIX, f), "utf8"));
const normU = (u: string | null | undefined) =>
  String(u ?? "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "").toLowerCase();

/** 🔴 Main Story 쌍 — 운영에서 **이미 제외** 된다(배포 `21d4a5fa`). */
const MAIN_STORY_PAIR_IDS: readonly string[] = ["C22", "C19", "C20", "C42", "C25", "S4-1"];
/** 🟢 STEP 5 의 V1 이 회수한 7건 — 🔴 **그 회수의 성질** 을 이 WU 가 가른다. */
const RECOVERED_BY_V1: readonly string[] = ["C27", "C11", "C48", "C14", "C37", "S1-1", "S1-4"];

interface Counts { denom: number; tp: number; fp: number; fn: number; tn: number }
const isSameSide = (v: string) => v === "SAME";
function score(rows: { gt: string; verdict: string }[]): Counts {
  const sub = rows.filter((r) => r.gt === "SAME" || r.gt === "DIFFERENT");
  return {
    denom: sub.length,
    tp: sub.filter((r) => r.gt === "SAME" && isSameSide(r.verdict)).length,
    fp: sub.filter((r) => r.gt === "DIFFERENT" && isSameSide(r.verdict)).length,
    fn: sub.filter((r) => r.gt === "SAME" && !isSameSide(r.verdict)).length,
    tn: sub.filter((r) => r.gt === "DIFFERENT" && !isSameSide(r.verdict)).length,
  };
}

describe("MI-REEVAL STEP 6-A — 보류 승격 안전성(네트워크 0 · 운영 반영 0)", () => {
  const ceo = (J("ceo-evidence-review-gt.json") as { pairs: { candidateUrl: string; ceoVerdict: string }[] }).pairs;
  const ceoByUrl = new Map(ceo.map((p) => [normU(p.candidateUrl), p.ceoVerdict]));

  const rows = SAME05_PAIRS.map((p) => {
    const j = same05Judge(p.origin, p.facts);
    return {
      id: p.id, domain: p.domain, url: p.url,
      gt: String(p.human).toUpperCase(),
      ceo: ceoByUrl.get(normU(p.url)) ?? null,
      baseline: String(j.cross.verdict),
      blockers: (j.cross.blockers ?? []).map((b) => String(b.blocker)),
      conflicts: (j.cross.conflicts ?? []).map((x) => String(x.conflict)),
      truth: j.truth, tier: String(j.tier), code: j.code,
      /** 🔴 **신규 증거 ↔ 상태 승격을 가르는 열쇠** — baseline 이 품번을 **이미 갖고 있었는가**. */
      originCode: p.origin.brandModelCode ?? null,
      candidateCode: p.facts.brandModelCode ?? null,
      isMainStory: MAIN_STORY_PAIR_IDS.includes(p.id),
    };
  });
  const noMs = rows.filter((r) => !r.isMainStory);

  it("STEP 6-A — 전환을 분리 측정하고 과거 저하 조건을 재현한다", () => {
    const L = (s: string) => console.log(s);
    L("\n" + "═".repeat(78));
    L("  STEP 6-A — 보류 승격 안전성(Shadow 전용 · 운영 반영 0)");
    L("═".repeat(78));

    const base33 = score(rows.map((r) => ({ gt: r.gt, verdict: r.baseline })));
    const base22 = score(noMs.map((r) => ({ gt: r.gt, verdict: r.baseline })));
    L(`\n기준선 — 33쌍(확정 ${base33.denom}) TP ${base33.tp} · FP ${base33.fp} · FN ${base33.fn} · TN ${base33.tn}`);
    L(`         22쌍(확정 ${base22.denom}) TP ${base22.tp} · FP ${base22.fp} · FN ${base22.fn} · TN ${base22.tn}`);

    /* ═══ ① 전환 유형을 «분리» 해 무조건 승격한다 — 과거 저하 조건의 재현 ═══ */
    const PROMOTIONS: { name: string; from: string[] }[] = [
      { name: "PRESUMED_SAME → SAME", from: ["PRESUMED_SAME"] },
      { name: "SIMILAR → SAME", from: ["SIMILAR"] },
      { name: "CONFLICT → SAME", from: ["CONFLICT"] },
      { name: "셋 모두(= 과거 저하 조건)", from: ["PRESUMED_SAME", "SIMILAR", "CONFLICT"] },
    ];
    L(`\n① **무조건 승격**(근거 추가 0 · 상태만 완화) — 🔴 과거 WU 가 위험하다고 측정한 그 축`);
    L(`   ${"전환".padEnd(26)} ${"분모".padStart(4)} ${"TP".padStart(3)} ${"FP".padStart(3)} ${"FN".padStart(3)} ${"TN".padStart(3)}  판정`);
    const blanket: Record<string, { all: Counts; ms: Counts }> = {};
    for (const pr of PROMOTIONS) {
      const map = (r: (typeof rows)[number]) => (pr.from.includes(r.baseline) ? "SAME" : r.baseline);
      const a = score(rows.map((r) => ({ gt: r.gt, verdict: map(r) })));
      const b = score(noMs.map((r) => ({ gt: r.gt, verdict: map(r) })));
      blanket[pr.name] = { all: a, ms: b };
      const ok33 = a.fp <= base33.fp;
      const ok22 = b.fp <= base22.fp;
      L(`   ${`${pr.name} · 33쌍`.padEnd(26)} ${String(a.denom).padStart(4)} ${String(a.tp).padStart(3)} ${String(a.fp).padStart(3)} ${String(a.fn).padStart(3)} ${String(a.tn).padStart(3)}  ${ok33 ? "🟢 FP 비증가" : `🔴 **FP ${base33.fp}→${a.fp}**`}`);
      L(`   ${`${pr.name} · 22쌍`.padEnd(26)} ${String(b.denom).padStart(4)} ${String(b.tp).padStart(3)} ${String(b.fp).padStart(3)} ${String(b.fn).padStart(3)} ${String(b.tn).padStart(3)}  ${ok22 ? "🟢 FP 비증가" : `🔴 **FP ${base22.fp}→${b.fp}**`}`);
    }
    L(`   🔴 **「셋 모두」가 과거 저하 조건의 재현** 이다 — 근거를 더하지 않고 상태만 올린다`);

    /* ═══ ② 🔴 조건부 승격 — 「품번 일치」를 요구하면 안전한가 ══════════════ */
    L(`\n② **조건부 승격** — 보류라도 «품번이 일치할 때만» 올린다`);
    const codeEq = (r: (typeof rows)[number]) =>
      Boolean(r.originCode && r.candidateCode
        && r.originCode.toLowerCase().replace(/[^a-z0-9]/g, "") === r.candidateCode.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const CONDS: { name: string; ok: (r: (typeof rows)[number]) => boolean }[] = [
      { name: "보류 + 품번 일치", ok: (r) => ["PRESUMED_SAME", "SIMILAR", "CONFLICT"].includes(r.baseline) && codeEq(r) },
      { name: "보류 + 품번 일치 + 충돌 0", ok: (r) => ["PRESUMED_SAME", "SIMILAR", "CONFLICT"].includes(r.baseline) && codeEq(r) && r.conflicts.length === 0 },
      { name: "PRESUMED_SAME + 품번 일치", ok: (r) => r.baseline === "PRESUMED_SAME" && codeEq(r) },
    ];
    L(`   ${"조건".padEnd(30)} ${"분모".padStart(4)} ${"TP".padStart(3)} ${"FP".padStart(3)} ${"FN".padStart(3)} ${"TN".padStart(3)}  판정`);
    const conditional: Record<string, { all: Counts; ms: Counts; promoted: string[] }> = {};
    for (const c of CONDS) {
      const map = (r: (typeof rows)[number]) => (c.ok(r) ? "SAME" : r.baseline);
      const a = score(rows.map((r) => ({ gt: r.gt, verdict: map(r) })));
      const b = score(noMs.map((r) => ({ gt: r.gt, verdict: map(r) })));
      const promoted = rows.filter(c.ok).map((r) => r.id);
      conditional[c.name] = { all: a, ms: b, promoted };
      const pass22 = b.fp <= base22.fp && b.fn < base22.fn;
      L(`   ${`${c.name} · 33쌍`.padEnd(30)} ${String(a.denom).padStart(4)} ${String(a.tp).padStart(3)} ${String(a.fp).padStart(3)} ${String(a.fn).padStart(3)} ${String(a.tn).padStart(3)}  ${a.fp <= base33.fp ? "🟢 FP 비증가" : `🔴 FP ${base33.fp}→${a.fp}`}`);
      L(`   ${`${c.name} · 22쌍`.padEnd(30)} ${String(b.denom).padStart(4)} ${String(b.tp).padStart(3)} ${String(b.fp).padStart(3)} ${String(b.fn).padStart(3)} ${String(b.tn).padStart(3)}  ${pass22 ? "🟢 **통과**" : b.fp > base22.fp ? `🔴 FP ${base22.fp}→${b.fp}` : "🟡 FN 미감소"}`);
      L(`      승격 ${promoted.length}건: ${promoted.join(" · ") || "없음"}`);
    }

    /* ═══ ③ 🔴 V1 회수 7건 — **신규 증거 ↔ 상태 승격** 을 가른다 ═══════════ */
    L(`\n③ 🔴🔴 **V1 이 회수한 7건 — 신규 증거인가 상태 승격인가**`);
    L(`   ${"id".padEnd(7)} ${"GT".padEnd(10)} ${"기준선".padEnd(14)} ${"품번(원↔후)".padEnd(26)} 성질`);
    const classify: { id: string; gt: string; baseline: string; nature: string; blockers: string[]; ceo: string | null }[] = [];
    for (const id of RECOVERED_BY_V1) {
      const r = rows.find((x) => x.id === id)!;
      /**
       * 🔴 **판정 기준** — baseline 이 쓰는 `facts.brandModelCode` 가 **양쪽에 있고 같으면**
       *    그 증거는 **운영이 이미 갖고 있었다** ⟹ **상태 승격** 이다(새로 찾은 것이 아니다).
       * 🟢 한쪽이 비어 있는데 Shadow 가 원문에서 찾았다면 **신규 증거** 다.
       */
      const nature = codeEq(r)
        ? "🔴 **상태 승격**(운영이 품번을 이미 갖고 있었다)"
        : "🟢 신규 증거(원문에서 찾았다)";
      classify.push({ id, gt: r.gt, baseline: r.baseline, nature, blockers: r.blockers, ceo: r.ceo });
      L(`   ${id.padEnd(7)} ${r.gt.padEnd(10)} ${r.baseline.padEnd(14)} ${`${r.originCode ?? "-"} ↔ ${r.candidateCode ?? "-"}`.padEnd(26)} ${nature}`);
      L(`           기준선 blocker [${r.blockers.join(",") || "없음"}] · conflict [${r.conflicts.join(",") || "없음"}]${r.ceo ? ` · CEO ${r.ceo}` : ""}`);
    }
    const promoCount = classify.filter((c) => c.nature.startsWith("🔴")).length;
    L(`\n   ⟹ **상태 승격 ${promoCount} / 7** · 신규 증거 ${7 - promoCount} / 7`);
    L(`   🔴 상태 승격은 **근거가 늘지 않았다** — 같은 증거에서 결론만 바뀐 것이다`);

    /* ═══ ④ 반증 가능성 — 승격 건이 뚫릴 수 있는 모양 ══════════════════════ */
    L(`\n④ 🔴 **승격 건의 반증 가능성**`);
    for (const c of classify) {
      const r = rows.find((x) => x.id === c.id)!;
      const risk = [
        r.blockers.includes("BRAND_MISMATCH") ? "브랜드가 불일치로 기록돼 있다" : null,
        r.blockers.includes("BRAND_UNCONFIRMED") ? "브랜드 미확인 상태다" : null,
        r.conflicts.length ? `충돌 축이 있다(${r.conflicts.join("/")})` : null,
        r.gt === "DIFFERENT" ? "🔴 기존 GT 가 DIFFERENT 다" : null,
        c.ceo && c.ceo !== "SAME" ? `🔴 CEO 최신이 ${c.ceo} 다` : null,
      ].filter(Boolean);
      L(`   ${c.id.padEnd(7)} ${risk.length ? risk.join(" · ") : "🟢 기록된 반증 신호 없음"}`);
    }

    /* ═══ 산출 ═══════════════════════════════════════════════════════════ */
    writeFileSync(join(DOCS, "MI-REEVAL-STEP6A-HOLD-PROMOTION.json"), JSON.stringify({
      note: "🔴 Shadow 전용 · 운영 반영 0 · 두 분모(33 · 22)를 같이 적는다 · 점수/확률 0",
      baseline: { all33: base33, excludingMainStory22: base22 },
      blanketPromotion: blanket,
      conditionalPromotion: conditional,
      recoveredSevenNature: classify,
      promotedByStateOnly: promoCount,
      newEvidence: 7 - promoCount,
    }, null, 1), "utf8");
    L(`\n🟢 산출 docs/MI-REEVAL-STEP6A-HOLD-PROMOTION.json`);

    /* ═══ 계약 ═══════════════════════════════════════════════════════════ */
    expect(base33.denom).toBe(SAME05_BASELINE.same + SAME05_BASELINE.different);
    expect(base33.fp).toBe(SAME05_BASELINE.fp);
    /** 🔴🔴 **과거 저하 조건이 실제로 재현돼야** 한다 — 안 되면 이 검증이 성립하지 않는다. */
    const all3 = blanket["셋 모두(= 과거 저하 조건)"]!;
    expect(all3.all.fp, "🔴 무조건 승격이 FP 를 늘리지 않으면 과거 측정과 모순이다").toBeGreaterThan(base33.fp);
    expect(all3.ms.fp, "🔴 Main Story 제외 분모에서도 FP 가 늘어야 위험이 재현된다").toBeGreaterThan(base22.fp);
    /** 🔴 **점수·확률 금지.** */
    const json = readFileSync(join(DOCS, "MI-REEVAL-STEP6A-HOLD-PROMOTION.json"), "utf8");
    for (const banned of ["precision", "recall", "f1", "score", "weight", "probability"]) {
      expect(json.includes(`"${banned}"`), `🔴 ${banned} 는 금지다`).toBe(false);
    }
    /** 🔴 회수 7건의 **성질이 전부 분류** 돼야 한다(빈칸 금지). */
    expect(classify.length).toBe(RECOVERED_BY_V1.length);
    for (const c of classify) expect(c.nature.length).toBeGreaterThan(0);
  });
});
