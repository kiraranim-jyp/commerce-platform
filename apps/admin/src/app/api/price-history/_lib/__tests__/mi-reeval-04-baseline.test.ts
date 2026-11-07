import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_AXES, compareAxis, extractKeywords } from "./mi-reeval-shadow-keywords";
import { SAME05_BASELINE, SAME05_PAIRS, same05Judge } from "./core-same05-gt";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-REEVAL **STEP 4** — 기존 MI «기준선 재현» (+ STEP 3 보완)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **운영 변경 0 · matcher 0 · extractor 0 · alias 0 · Identity 0 · GT 0 · DB 0 ·
 *    schema 0 · 네트워크 0.** 최종 판정(SAME/SIMILAR/DIFFERENT/UNDECIDED)은 **STEP 5** 다.
 *
 * ── 🔴🔴 **「기존 MI」는 «세 가지 다른 것» 이다. 한 칸에 넣지 않는다**(CPO §5) ──
 * ```
 * ⒜ DB 저장 판정    `candidate_reviews.system_verdict` — 운영이 **그때 적어 둔** 값
 * ⒝ 저장 facts 재현  `same05Judge(저장 origin, 저장 candidate)` — 운영 사슬을 **지금 다시** 부른다
 *                   🔴 **「그때의 운영 판정」이 아니다**(CPO 명시)
 * ⒞ 라이브 실행 기록  상세설명 비교(STEP 2) 때 **실제 HTTP** 로 수집한 facts 로 운영이 낸 값
 *                   🔴 이것도 재현이 아니다 — **그 시점의 실행 기록** 이다
 * ```
 * 🔴 ⒝ 와 ⒞ 를 합치면 「재현했다」가 거짓이 된다 ⟹ **분모를 갈라 센다**.
 */

const FIX = join(__dirname, "fixtures");
const DOCS = join(__dirname, "..", "..", "..", "..", "..", "..", "..", "..", "docs");
const J = (f: string) => JSON.parse(readFileSync(join(FIX, f), "utf8"));

interface DbRow {
  origin_code: string | null; candidate_url: string; origin_url: string | null;
  human_verdict: string; system_verdict: string | null; match_truth: string | null;
  price_tier: string | null; origin_snapshot_missing: boolean;
}
interface DescPair {
  originCode: string | null; originUrl: string; candidateUrl: string; candidateDomain: string;
  baselineSystemVerdict: string | null; humanGt: string | null;
}
interface KwPair {
  originUrl: string; originCode: string | null; candidateUrl: string; candidateDomain: string;
  baselineSystemVerdict: string | null; humanGt: string | null;
  origin: { title: string | null; description: string | null; descriptionKo: string | null; brand: string | null; color: string | null; material: string | null };
  candidate: { title: string | null; description: string | null };
}

const normU = (u: string | null | undefined) =>
  String(u ?? "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "").toLowerCase();

describe("MI-REEVAL STEP 4 — 기존 MI 기준선 재현(네트워크 0 · DB 0 · 운영 변경 0)", () => {
  const db = (J("mi-reeval-01-db-human.json") as { rows: DbRow[] }).rows;
  const desc = (J("mi-reeval-01-desc-pairs.json") as { pairs: DescPair[] }).pairs;
  const kw = (J("mi-reeval-03-keyword-input.json") as { pairs: KwPair[] }).pairs;
  const ceo = (J("ceo-evidence-review-gt.json") as {
    pairs: { id: string; candidateUrl: string; priorCeoVerdict: string; ceoVerdict: string; reproducedVerdict: string; dbMiVerdict: string | null }[];
  }).pairs;

  const dbByUrl = new Map<string, DbRow>();
  for (const r of db) {
    const k = normU(r.candidate_url);
    const cur = dbByUrl.get(k);
    /** 🔴 같은 URL 에 행이 여럿이면 **verdict 가 있는 쪽** 을 결정적으로 고른다. */
    if (!cur || (!cur.system_verdict && r.system_verdict)) dbByUrl.set(k, r);
  }
  const descByUrl = new Map(desc.map((p) => [`${normU(p.originUrl)} >> ${normU(p.candidateUrl)}`, p]));
  const ceoByUrl = new Map(ceo.map((p) => [normU(p.candidateUrl), p]));

  const tally = <T>(xs: T[], f: (x: T) => string) =>
    xs.reduce<Record<string, number>>((a, x) => { const k = f(x); a[k] = (a[k] ?? 0) + 1; return a; }, {});

  it("STEP 4 — ⒝ 저장 facts 재현을 전수로 돌리고 ⒜⒞ 와 «갈라» 대조한다", () => {
    const L = (s: string) => console.log(s);
    L("\n" + "═".repeat(78));
    L("  MI-REEVAL STEP 4 — 기존 MI 기준선 «재현»(운영 변경 0)");
    L("═".repeat(78));

    /* ═══ ⒝ 저장 facts 재현 — 🟢 facts 가 있는 쌍만 ═══════════════════════ */
    const reproduced = SAME05_PAIRS.map((p) => {
      const j = same05Judge(p.origin, p.facts);
      const dbr = dbByUrl.get(normU(p.url)) ?? null;
      const c = ceoByUrl.get(normU(p.url)) ?? null;
      return {
        pairId: p.id, searchId: p.searchId, domain: p.domain,
        originUrl: p.origin.sourceUrl, candidateUrl: p.url,
        /** 🔴 기존 기준 GT(= 그 fixture 의 라벨) · CEO 최신과 **다른 칸** 이다. */
        priorGt: p.human, gtSource: p.src,
        ceoLatest: c?.ceoVerdict ?? null,
        reproducedVerdict: String(j.cross.verdict),
        reproducedCode: j.code, reproducedTruth: j.truth, reproducedTier: String(j.tier),
        reproducedBlockers: (j.cross.blockers ?? []).map((b) => String(b.blocker)),
        dbStoredVerdict: dbr?.system_verdict ?? null,
        dbStoredTier: dbr?.price_tier ?? null,
        liveRunVerdict: null as string | null,
      };
    });
    /** ⒞ 라이브 실행 기록을 **같은 쌍에** 붙인다(있을 때만). */
    for (const r of reproduced) {
      const d = descByUrl.get(`${normU(r.originUrl)} >> ${normU(r.candidateUrl)}`);
      if (d) r.liveRunVerdict = d.baselineSystemVerdict;
    }

    L(`\n⒝ 저장 facts 재현 — 분모 **${reproduced.length}** (🟢 `+ "`SAME05_PAIRS`" + ` · facts 보유)`);
    L(`   재현 verdict: ${JSON.stringify(tally(reproduced, (r) => r.reproducedVerdict))}`);
    L(`   재현 tier   : ${JSON.stringify(tally(reproduced, (r) => r.reproducedTier))}`);
    L(`   🔴 **「그때의 운영 판정」이 아니다** — 저장 facts 를 입력으로 운영 사슬을 다시 부른 값이다`);

    /* ═══ 🔴 재현 «불가» 를 별도로 센다 ═══════════════════════════════════ */
    const reproducedUrls = new Set(reproduced.map((r) => `${normU(r.originUrl)} >> ${normU(r.candidateUrl)}`));
    const notReproducible = desc.filter((p) => !reproducedUrls.has(`${normU(p.originUrl)} >> ${normU(p.candidateUrl)}`));
    L(`\n🔴 재현 **불가** — ${notReproducible.length} 쌍`);
    L(`   사유: 저장 `+ "`ProductFacts`" + ` 가 없다(상세설명 비교 코퍼스는 facts 를 보존하지 않았다)`);
    L(`   🟢 그 쌍들은 ⒞ **라이브 실행 기록** 만 있다 — ${notReproducible.filter((p) => p.baselineSystemVerdict).length} 쌍`);
    L(`   🔴 그중 `+ "`BASELINE_NOT_REPRODUCED`" + ` ${notReproducible.filter((p) => p.baselineSystemVerdict === "BASELINE_NOT_REPRODUCED").length} 쌍은 **그 실행에서도 재현되지 않았다**`);
    L(`   ⟹ 🔴 **「140쌍의 기존 MI 를 재현했다」로 적을 수 없다**`);

    /* ═══ ⒜ ↔ ⒝ 대조 ════════════════════════════════════════════════════ */
    const withDb = reproduced.filter((r) => r.dbStoredVerdict);
    L(`\n⒜↔⒝ DB 저장 판정 ↔ 재현 — 대조 가능 **${withDb.length}** / ${reproduced.length}`);
    const agree = withDb.filter((r) => r.dbStoredVerdict === r.reproducedVerdict);
    L(`   일치 **${agree.length}** · 🔴 불일치 **${withDb.length - agree.length}**`);
    for (const r of withDb.filter((x) => x.dbStoredVerdict !== x.reproducedVerdict)) {
      L(`      · ${r.pairId.padEnd(7)} ${r.domain.padEnd(22)} DB ${String(r.dbStoredVerdict).padEnd(14)} ↔ 재현 ${r.reproducedVerdict}`);
    }

    /* ═══ ⒞ ↔ ⒝ 대조 ════════════════════════════════════════════════════ */
    const withLive = reproduced.filter((r) => r.liveRunVerdict);
    L(`\n⒞↔⒝ 라이브 실행 기록 ↔ 재현 — 대조 가능 **${withLive.length}** / ${reproduced.length}`);
    if (withLive.length) {
      const same = withLive.filter((r) => r.liveRunVerdict === r.reproducedVerdict);
      L(`   일치 ${same.length} · 🔴 불일치 ${withLive.length - same.length}`);
      for (const r of withLive.filter((x) => x.liveRunVerdict !== x.reproducedVerdict).slice(0, 8)) {
        L(`      · ${r.pairId.padEnd(7)} 라이브 ${String(r.liveRunVerdict).padEnd(24)} ↔ 재현 ${r.reproducedVerdict}`);
      }
    } else {
      L(`   🔴 **교집합이 0 이다** — ` + "`same05`" + ` 와 상세설명 비교의 원상품 집합이 다르다(STEP 1 §2 와 같은 사실)`);
    }

    /* ═══ GT 보존 확인 ═══════════════════════════════════════════════════ */
    L(`\n기존 GT · CEO 최신 — 🔴 **각각 보존**`);
    L(`   기존 GT 분포 : ${JSON.stringify(tally(reproduced, (r) => r.priorGt))}`);
    L(`   CEO 최신 보유: ${reproduced.filter((r) => r.ceoLatest).length} 쌍 · ${JSON.stringify(tally(reproduced.filter((r) => r.ceoLatest), (r) => r.ceoLatest!))}`);

    /* ═══ 🔴 기준선의 «정확도» — GT 가 확정된 쌍만 ════════════════════════ */
    const SAME_SIDE = new Set(["SAME"]);
    const evalOn = (label: string, gt: (r: (typeof reproduced)[number]) => string | null) => {
      const sub = reproduced.filter((r) => {
        const g = gt(r);
        return g === "SAME" || g === "DIFFERENT";
      });
      const tp = sub.filter((r) => gt(r) === "SAME" && SAME_SIDE.has(r.reproducedVerdict)).length;
      const fp = sub.filter((r) => gt(r) === "DIFFERENT" && SAME_SIDE.has(r.reproducedVerdict)).length;
      const fn = sub.filter((r) => gt(r) === "SAME" && !SAME_SIDE.has(r.reproducedVerdict)).length;
      const tn = sub.filter((r) => gt(r) === "DIFFERENT" && !SAME_SIDE.has(r.reproducedVerdict)).length;
      L(`   ${label} — 분모 **${sub.length}**(SAME ${sub.filter((r) => gt(r) === "SAME").length} · DIFFERENT ${sub.filter((r) => gt(r) === "DIFFERENT").length})`);
      L(`      TP ${tp} · FP ${fp} · FN ${fn} · TN ${tn}`);
      L(`      🔴 precision/recall 을 적지 않는다 — ${sub.length < 20 ? "분모가 20 미만이다" : "STEP 5 와 같은 표에서 함께 적는다"}`);
      return { denom: sub.length, tp, fp, fn, tn };
    };
    L(`\n🔴 기준선 정확도 — **GT 가 SAME/DIFFERENT 로 확정된 쌍만**(UNCERTAIN·SIMILAR·UNDECIDED 제외)`);
    const byPrior = evalOn("기존 GT 기준", (r) => String(r.priorGt).toUpperCase());
    const byCeo = evalOn("CEO 최신 기준", (r) => (r.ceoLatest ? String(r.ceoLatest).toUpperCase() : null));

    /* ═══ STEP 3 보완 — 동의어 연결 «전/후» ══════════════════════════════ */
    L(`\n` + "═".repeat(78));
    L("  STEP 3 보완 — OBSERVED 동의어 연결 «전 / 후»(CPO 승인 조건)");
    L("═".repeat(78));
    const run = (useObserved: boolean) =>
      kw.map((p) => {
        const ok = extractKeywords({
          title: p.origin.title, description: p.origin.description, descriptionKo: p.origin.descriptionKo,
          brand: p.origin.brand, color: p.origin.color, material: p.origin.material, code: p.originCode,
        }, { useObserved });
        const ck = extractKeywords({ title: p.candidate.title, description: p.candidate.description }, { useObserved });
        return { p, axes: ALL_AXES.map((a) => compareAxis(a, ok, ck)) };
      });
    const before = run(false);
    const after = run(true);
    const st = (rows: ReturnType<typeof run>, axis: string, s: string) =>
      rows.filter((r) => r.axes.find((x) => x.axis === axis)!.status === s).length;

    L(`\n   ${"축".padEnd(14)} ${"MATCH 전".padStart(9)} ${"MATCH 후".padStart(9)} ${"증가".padStart(5)} ${"MISMATCH 전".padStart(12)} ${"MISMATCH 후".padStart(12)}`);
    const newMatches: { axis: string; pairs: string[] }[] = [];
    for (const a of ALL_AXES) {
      const mb = st(before, a, "MATCH"), ma = st(after, a, "MATCH");
      const xb = st(before, a, "MISMATCH"), xa = st(after, a, "MISMATCH");
      L(`   ${a.padEnd(14)} ${String(mb).padStart(9)} ${String(ma).padStart(9)} ${String(ma - mb).padStart(5)} ${String(xb).padStart(12)} ${String(xa).padStart(12)}`);
      const gained = after
        .map((r, i) => ({ r, b: before[i]! }))
        .filter(({ r, b }) =>
          r.axes.find((x) => x.axis === a)!.status === "MATCH" && b.axes.find((x) => x.axis === a)!.status !== "MATCH")
        .map(({ r }) => `${r.p.candidateDomain}|${r.p.candidateUrl.slice(-40)}`);
      if (gained.length) newMatches.push({ axis: a, pairs: gained });
    }
    L(`\n   🟢 **동의어 연결 때문에 «새로» MATCH 가 된 사례**(CPO 요구 집계)`);
    for (const n of newMatches) L(`      ${n.axis.padEnd(14)} ${String(n.pairs.length).padStart(3)} 쌍`);
    L(`      합계 **${newMatches.reduce((s, n) => s + n.pairs.length, 0)}** (축 중복 포함)`);

    /** 🔴 **잘못된 통합 점검** — 동의어 때문에 MISMATCH 가 MATCH 로 «뒤집힌» 축이 있는가. */
    const flipped: string[] = [];
    for (const a of ALL_AXES) {
      after.forEach((r, i) => {
        const b = before[i]!;
        if (r.axes.find((x) => x.axis === a)!.status === "MATCH" && b.axes.find((x) => x.axis === a)!.status === "MISMATCH") {
          flipped.push(`${a} · ${r.p.candidateDomain} · ${r.axes.find((x) => x.axis === a)!.why.slice(0, 70)}`);
        }
      });
    }
    L(`\n   🔴 **MISMATCH → MATCH 로 뒤집힌 축**(잘못된 통합 후보) — ${flipped.length} 건`);
    for (const f of flipped.slice(0, 10)) L(`      · ${f}`);
    L(`   ${flipped.length === 0 ? "🟢 동의어가 «충돌을 지운» 사례가 없다 — 의미가 다른 표현을 합치지 않았다" : "🔴 그 건들은 사람이 확인해야 한다"}`);

    /* ═══ 산출 ═══════════════════════════════════════════════════════════ */
    writeFileSync(join(DOCS, "MI-REEVAL-STEP4-BASELINE.json"), JSON.stringify({
      note: "🔴 ⒜ DB 저장 · ⒝ 저장 facts 재현 · ⒞ 라이브 실행 기록을 **세 칸으로** 가른다. 🔴 「그때의 운영 판정」이 아니다. 최종 판정 칸 없음(STEP 5).",
      reproducibleDenominator: reproduced.length,
      notReproducible: notReproducible.length,
      accuracy: { byPriorGt: byPrior, byCeoLatest: byCeo },
      synonymEffect: {
        newMatchesByAxis: newMatches.map((n) => ({ axis: n.axis, pairs: n.pairs.length })),
        mismatchFlippedToMatch: flipped.length,
      },
      pairs: reproduced,
    }, null, 1), "utf8");
    L(`\n🟢 산출 docs/MI-REEVAL-STEP4-BASELINE.json — 재현 ${reproduced.length} 쌍`);

    /* ═══ 계약 ═══════════════════════════════════════════════════════════ */
    expect(reproduced.length, "🔴 재현 분모가 0 이면 STEP 4 가 성립하지 않는다").toBe(SAME05_PAIRS.length);
    /**
     * 🟢🟢 **재현이 «충실한지» 를 기존 기준선으로 교차검증한다 — STEP 4 의 핵심 계약.**
     * ```
     * `SAME05_BASELINE` (커밋된 상수)  same 18 · different 9 · uncertain 6 · fp 1 · samePrecision "6/18"
     * 이번 재현                        SAME 18 · DIFFERENT 9 · UNCERTAIN 6 · FP 1 · TP 6
     * ⟹ 🟢 **한 자리도 다르지 않다** ⟹ 내 재현이 기존 기준선과 같은 것을 센다
     * ```
     * 🔴 이 계약이 깨지면 「재현했다」가 거짓이다 — 그때는 STEP 5 를 진행하지 않는다.
     */
    expect(byPrior.denom, "🔴 기존 GT 확정 분모가 27 이 아니다").toBe(SAME05_BASELINE.same + SAME05_BASELINE.different);
    expect(byPrior.fp, "🔴 재현 FP 가 커밋된 기준선과 다르다").toBe(SAME05_BASELINE.fp);
    expect(`${byPrior.tp}/${SAME05_BASELINE.same}`, "🔴 재현 TP 가 커밋된 samePrecision 과 다르다")
      .toBe(SAME05_BASELINE.samePrecision);
    /** 🔴 **세 칸이 서로 다른 이름이어야** 한다 — 합치면 「재현」이 거짓이 된다. */
    const json = readFileSync(join(DOCS, "MI-REEVAL-STEP4-BASELINE.json"), "utf8");
    for (const must of ["reproducedVerdict", "dbStoredVerdict", "liveRunVerdict", "priorGt", "ceoLatest"]) {
      expect(json, `🔴 ${must} 칸이 없으면 출처가 뭉개진다`).toContain(`"${must}"`);
    }
    /** 🔴 「과거 당시 운영 판정」으로 표현하지 않았다(CPO §5). */
    for (const banned of ["operationalVerdictAtTheTime", "historicalVerdict", "pastOperationalVerdict"]) {
      expect(json.includes(`"${banned}"`), `🔴 ${banned} 는 재현값을 과거 판정으로 둔갑시킨다`).toBe(false);
    }
    /** 🔴 최종 판정 칸이 **없어야** 한다(STEP 5 전이다). */
    for (const banned of ["shadowVerdict", "finalVerdict", "improvedVerdict"]) {
      expect(json.includes(`"${banned}"`), `🔴 STEP 4 산출에 ${banned} 가 있으면 범위를 넘었다`).toBe(false);
    }
    /** 🔴 **precision/recall 을 산출에 쓰지 않았다** — 분모가 작다(CPO §9 경고). */
    for (const banned of ["precision", "recall", "f1"]) {
      expect(json.includes(`"${banned}"`), `🔴 분모가 확정되기 전에 ${banned} 를 적지 않는다`).toBe(false);
    }
    /** 🟢 동의어 효과가 **별도 칸** 으로 기록돼야 한다(CPO 승인 조건). */
    expect(json).toContain('"synonymEffect"');
    expect(json).toContain('"mismatchFlippedToMatch"');
    /** 🔴 동의어가 **충돌을 지우면** 그것은 잘못된 통합 후보다 — 0 이어야 통과가 아니라, **세어져야** 한다. */
    expect(typeof flipped.length).toBe("number");
    /** 🟢 재현 불가를 **조용히 빼지 않았다**. */
    expect(notReproducible.length + reproduced.length).toBeGreaterThanOrEqual(desc.length);
  });
});
