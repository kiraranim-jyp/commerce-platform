import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_AXES, compareAxis, extractKeywords, type KeywordAxis } from "./mi-reeval-shadow-keywords";
import { SAME05_PAIRS } from "./core-same05-gt";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-REEVAL **STEP 6-B** — Shadow COLOR 추출 결함 수정(CPO 결정 ④ · Shadow 한정)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **운영 extractor · matcher · alias · Identity 변경 0 · GT 0 · DB 0 · 네트워크 0.**
 *
 * ── 🔴 고친 결함 ────────────────────────────────────────────────────────────
 * ```
 * `folkberlin.com` 후보 설명문 「The **Gray Label** logo embroidery …」 에서 `Gray` 가
 * **색상** 으로 추출돼 원본 `grey` 와 COLOR MATCH 가 됐다.
 * 🔴 그 상품의 실제 색상은 제목의 「''Blue Moon''」(blue) 다 ⟹ 거짓 일치였다.
 * 🟢 원인은 동의어가 아니라 **브랜드 엔티티가 COLOR 축으로 유입된 것** 이다.
 * ```
 *
 * ── 🔴🔴 **기존 측정값을 덮지 않는다**(CPO 조건) ─────────────────────────────
 * ```
 * `colorBrandGuard` 기본값 **false** ⟹ STEP 5 산출은 **바이트 동일** 하다.
 * `true` 로 부른 것만 **`B-shadow-v2`** 로 따로 적는다.
 * 🔴 A군(33쌍) 결과가 바뀌면 **FAIL** 한다 — 그 분모는 STEP 5 가 이미 보고했다.
 * ```
 */

const FIX = join(__dirname, "fixtures");
const DOCS = join(__dirname, "..", "..", "..", "..", "..", "..", "..", "..", "docs");
const J = (f: string) => JSON.parse(readFileSync(join(FIX, f), "utf8"));

interface KwPair {
  originUrl: string; originCode: string | null; candidateUrl: string; candidateDomain: string;
  baselineSystemVerdict: string | null; humanGt: string | null;
  origin: { title: string | null; description: string | null; descriptionKo: string | null; brand: string | null; color: string | null; material: string | null };
  candidate: { title: string | null; description: string | null };
}

describe("MI-REEVAL STEP 6-B — Shadow COLOR 추출 결함 수정(네트워크 0 · 운영 변경 0)", () => {
  const kw = (J("mi-reeval-03-keyword-input.json") as { pairs: KwPair[] }).pairs;

  /* ═══ A. 결함 자체 — 「Gray Label」이 색상으로 들어오지 않는다 ═══════════ */
  it("A-1 🔴 브랜드 표지 명사 바로 앞의 색상 단어는 **색상으로 쓰지 않는다**", () => {
    const text = "100% organic cotton with some elastane. The Gray Label logo embroidery is embroidered on the chest.";
    const off = extractKeywords({ title: null, description: text }, { useObserved: true });
    const on = extractKeywords({ title: null, description: text }, { useObserved: true, colorBrandGuard: true });
    const colorsOf = (ks: typeof off) => ks.filter((k) => k.axis === "COLOR").map((k) => k.normalized).sort();
    /** 🔴 수정 전에는 `grey` 가 들어왔다 — 그 사실을 **고정** 한다(회귀 방지). */
    expect(colorsOf(off), "🔴 수정 전 동작이 바뀌면 STEP 5 측정값이 흔들린다").toContain("grey");
    expect(colorsOf(on), "🔴 「Gray Label」의 Gray 가 여전히 색상으로 들어온다").not.toContain("grey");
  });

  it("A-2 🟢 **실제 색상 표기는 살아 있다** — 「Blue Moon」 은 그대로 추출된다", () => {
    const title = "Baby Sweater Suit ''Blue Moon'' Organic Cotton";
    const on = extractKeywords({ title, description: null }, { useObserved: true, colorBrandGuard: true });
    expect(on.filter((k) => k.axis === "COLOR").map((k) => k.normalized), "🔴 실제 색상을 죽였다").toContain("blue");
  });

  it("A-3 🔴 브랜드명/색상명 중복 회귀 — 표지 명사만 막고 나머지는 **건드리지 않는다**", () => {
    const g = (s: string) => extractKeywords({ title: s, description: null }, { useObserved: true, colorBrandGuard: true })
      .filter((k) => k.axis === "COLOR").map((k) => k.normalized);
    /** 🔴 막아야 하는 모양 — 색상 + 브랜드 표지 명사. */
    for (const s of ["Gray Label tee", "Blue Studio shirt", "Black Label pants", "그레이 라벨 티셔츠"]) {
      expect(g(s), `🔴 「${s}」 에서 색상이 들어왔다`).toEqual([]);
    }
    /** 🟢 살려야 하는 모양 — 실제 색상 표기. */
    expect(g("Blue Moon sweater")).toContain("blue");
    expect(g("Light heather grey sweatshirt")).toContain("grey");
    expect(g("네이비 아동 티셔츠")).toContain("navy");
    expect(g("Navy blue anorak")).toContain("navy");
    /** 🔴 표지 명사가 **뒤에 멀리** 있으면 막지 않는다(과잉 차단 금지). */
    expect(g("Blue sweater with embroidered brand logo")).toContain("blue");
  });

  /* ═══ B. 🔴 A군(33쌍) 결과가 **바뀌지 않는다** ═══════════════════════════ */
  it("B-1 🔴🔴 A군 33쌍의 COLOR 비교 결과가 **한 쌍도 바뀌지 않는다**", () => {
    const run = (guard: boolean) =>
      SAME05_PAIRS.map((p) => {
        const ok = extractKeywords({
          title: p.origin.title, description: p.origin.description ?? null, descriptionKo: null,
          brand: p.origin.brand, color: p.origin.colorText, material: p.origin.materialText,
          code: p.origin.brandModelCode,
        }, { useObserved: true, colorBrandGuard: guard });
        const ck = extractKeywords({
          title: p.facts.title, description: p.facts.description ?? null,
          brand: p.facts.brand, color: p.facts.colorText, material: p.facts.materialText,
          code: p.facts.brandModelCode,
        }, { useObserved: true, colorBrandGuard: guard });
        return ALL_AXES.map((a) => compareAxis(a, ok, ck).status).join("|");
      });
    const before = run(false);
    const after = run(true);
    const changed = before.map((b, i) => ({ id: SAME05_PAIRS[i]!.id, b, a: after[i]! })).filter((x) => x.b !== x.a);
    console.log(`\n   A군 33쌍 — 가드 적용 전후로 축 상태가 바뀐 쌍 **${changed.length}**`);
    for (const c of changed) console.log(`      · ${c.id} ${c.b} → ${c.a}`);
    expect(changed, "🔴 A군이 바뀌면 STEP 5 보고 수치가 흔들린다").toEqual([]);
  });

  /* ═══ C. B군 — `B-shadow-v1` ↔ `B-shadow-v2` 를 **한 표에** ═════════════ */
  it("C-1 B군 109쌍 — v1 / v2 를 나란히 적고 **v1 을 덮지 않는다**", () => {
    const L = (s: string) => console.log(s);
    const run = (guard: boolean) =>
      kw.map((p) => {
        const ok = extractKeywords({
          title: p.origin.title, description: p.origin.description, descriptionKo: p.origin.descriptionKo,
          brand: p.origin.brand, color: p.origin.color, material: p.origin.material, code: p.originCode,
        }, { useObserved: true, colorBrandGuard: guard });
        const ck = extractKeywords({ title: p.candidate.title, description: p.candidate.description }, { useObserved: true, colorBrandGuard: guard });
        return { p, axes: ALL_AXES.map((a) => compareAxis(a, ok, ck)) };
      });
    const v1 = run(false);
    const v2 = run(true);
    const st = (rows: ReturnType<typeof run>, axis: KeywordAxis, s: string) =>
      rows.filter((r) => r.axes.find((x) => x.axis === axis)!.status === s).length;

    L("\n" + "═".repeat(78));
    L("  STEP 6-B — B군 COLOR 축: `B-shadow-v1`(기존) ↔ `B-shadow-v2`(가드 적용)");
    L("═".repeat(78));
    L(`\n   ${"축".padEnd(14)} ${"MATCH v1".padStart(9)} ${"MATCH v2".padStart(9)} ${"MISMATCH v1".padStart(12)} ${"MISMATCH v2".padStart(12)} ${"UNKNOWN v1".padStart(11)} ${"UNKNOWN v2".padStart(11)}`);
    const diffs: { axis: KeywordAxis; domain: string; from: string; to: string; why: string }[] = [];
    for (const a of ALL_AXES) {
      L(`   ${a.padEnd(14)} ${String(st(v1, a, "MATCH")).padStart(9)} ${String(st(v2, a, "MATCH")).padStart(9)}` +
        ` ${String(st(v1, a, "MISMATCH")).padStart(12)} ${String(st(v2, a, "MISMATCH")).padStart(12)}` +
        ` ${String(st(v1, a, "UNKNOWN")).padStart(11)} ${String(st(v2, a, "UNKNOWN")).padStart(11)}`);
      v1.forEach((r, i) => {
        const b = r.axes.find((x) => x.axis === a)!;
        const c = v2[i]!.axes.find((x) => x.axis === a)!;
        if (b.status !== c.status) diffs.push({ axis: a, domain: r.p.candidateDomain, from: b.status, to: c.status, why: c.why });
      });
    }
    L(`\n   🔴 **상태가 바뀐 (쌍, 축) = ${diffs.length}**`);
    for (const d of diffs) L(`      · ${d.axis.padEnd(10)} ${d.domain.padEnd(24)} ${d.from} → ${d.to}  ${d.why.slice(0, 62)}`);
    /** 🟢 COLOR 축에서만 바뀌어야 한다 — 다른 축에 번지면 과잉 차단이다. */
    expect([...new Set(diffs.map((d) => d.axis))], "🔴 가드가 COLOR 밖으로 번졌다").toEqual(diffs.length ? ["COLOR"] : []);
    /** 🔴 그리고 **MATCH 가 줄어드는 방향** 이어야 한다(거짓 일치를 지우는 수정이다). */
    expect(st(v2, "COLOR", "MATCH"), "🔴 가드가 COLOR MATCH 를 늘렸다면 방향이 거꾸로다").toBeLessThanOrEqual(st(v1, "COLOR", "MATCH"));

    const folk = v1.map((r, i) => ({ r, c: v2[i]! })).filter((x) => /folkberlin/.test(x.r.p.candidateDomain));
    L(`\n   🟢 `+ "`folkberlin.com`" + ` 확인 — ${folk.length} 쌍`);
    for (const f of folk) {
      const b = f.r.axes.find((x) => x.axis === "COLOR")!;
      const c = f.c.axes.find((x) => x.axis === "COLOR")!;
      L(`      v1 ${b.status} (${b.why.slice(0, 48)})`);
      L(`      v2 ${c.status} (${c.why.slice(0, 58)})`);
    }
    expect(folk.length, "🔴 folkberlin 쌍이 없으면 이 수정의 근거 사례가 사라진다").toBeGreaterThan(0);
    /**
     * 🔴 **대상 쌍으로 좁힌다** — 1차 단언은 folkberlin **전체** 가 MATCH 가 아니어야 한다고
     *    썼고 **FAIL 했다. 코드가 맞았다.** 그 판매처의 다른 쌍들은 `blue` 로 **정당하게** 일치한다.
     * 🟢 고쳐야 하는 것은 **`grey` 로 일치했던 그 한 쌍** 이다(브랜드/인명에서 온 거짓 일치).
     */
    /**
     * 🔴🔴 **단언을 또 넓게 썼고 또 FAIL 했다 — 코드가 맞았다.** 같은 판매처에
     *    `''Grey Melange''` 쌍이 있고 그것은 **정당하게 grey** 다(제목이 그렇게 적혀 있다).
     * 🟢 그래서 「grey 로 일치한 모든 쌍」이 아니라 **«전이» 로** 단언한다.
     */
    const lostGrey = folk.filter((f) => {
      const b = f.r.axes.find((x) => x.axis === "COLOR")!;
      const c = f.c.axes.find((x) => x.axis === "COLOR")!;
      return b.status === "MATCH" && b.matched.includes("grey") && !c.matched.includes("grey");
    });
    expect(lostGrey.length, "🔴 브랜드/인명에서 온 grey 거짓 일치가 하나도 제거되지 않았다").toBeGreaterThan(0);
    for (const f of lostGrey) {
      expect(f.c.axes.find((x) => x.axis === "COLOR")!.why, "🔴 실제 색상(blue)이 근거로 남아야 한다").toContain("blue");
    }
    /** 🟢 **정당한 grey 는 살아 있어야** 한다 — 「Grey Melange」 처럼 제목이 적어 둔 색상. */
    const keptGrey = folk.filter((f) => f.c.axes.find((x) => x.axis === "COLOR")!.matched.includes("grey"));
    expect(keptGrey.length, "🔴 제목에 적힌 정당한 grey 까지 죽였다(과잉 차단)").toBeGreaterThan(0);
    /** 🟢 그리고 정당한 `blue` 일치도 살아 있어야 한다. */
    expect(folk.filter((f) => f.c.axes.find((x) => x.axis === "COLOR")!.matched.includes("blue")).length,
      "🔴 정당한 blue 일치까지 죽였다").toBeGreaterThan(0);

    writeFileSync(join(DOCS, "MI-REEVAL-STEP6B-COLOR-GUARD.json"), JSON.stringify({
      note: "🔴 Shadow 한정 수정 · 운영 extractor 변경 0 · 🔴 `B-shadow-v1` 수치를 덮지 않는다(두 열로 적는다)",
      aGroupUnchanged: true,
      bShadow: Object.fromEntries(ALL_AXES.map((a) => [a, {
        v1: { match: st(v1, a, "MATCH"), mismatch: st(v1, a, "MISMATCH"), unknown: st(v1, a, "UNKNOWN") },
        v2: { match: st(v2, a, "MATCH"), mismatch: st(v2, a, "MISMATCH"), unknown: st(v2, a, "UNKNOWN") },
      }])),
      changedPairAxes: diffs,
    }, null, 1), "utf8");
    L(`\n🟢 산출 docs/MI-REEVAL-STEP6B-COLOR-GUARD.json`);
  });
});
