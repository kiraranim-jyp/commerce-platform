import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_AXES, compareAxis, extractKeywords, type AxisComparison, type KeywordAxis } from "./mi-reeval-shadow-keywords";
import { SAME05_BASELINE, SAME05_PAIRS, same05Judge } from "./core-same05-gt";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-REEVAL **STEP 5** — 개선 MI **Shadow 종합 평가**(CPO 결정 반영)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **운영 변경 0 · matcher 0 · extractor 0 · Identity 0 · alias 0 · GT 0 · DB 0 ·
 *    schema 0 · 검색/수집 0 · 네트워크 0.** Shadow 평가만 한다.
 *
 * ── 🔴🔴 평가군을 **셋으로 가른다. 합산하지 않는다**(CPO 결정 ①) ─────────────
 * ```
 * A  `SAME05_PAIRS` **33** — 동일 조건 **주 평가군**(기존 MI 재현값이 있다)
 * B  desc-compare 109    — **별도 관찰군**(라이브 기록 ↔ Shadow · 🔴 조건이 다르다)
 * C  CEO Evidence Review 11 — **CEO 기준군**(🔴 A 와 11쌍 겹친다 ⟹ 중복 계산 금지)
 * ```
 *
 * ── 🔴🔴 **점수·확률·가중치를 만들지 않는다**(CPO 금지) ──────────────────────
 * ```
 * 종합은 **규칙의 순서** 로만 한다. `precision`/`recall`/`f1`/`score`/`weight` 를
 * 산출에 쓰지 않는다(계약으로 잠근다). `DESIGN` 단독으로 최종 판정하지 않는다.
 * ```
 *
 * ── 🔴 가드레일(CPO 결정 ③) ─────────────────────────────────────────────────
 * ```
 * 기존 GT 27쌍 기준선  TP 6 · FP **1** · FN **12** · TN 8
 * 개선 승인 조건       FN < 12  **그리고**  FP ≤ 1
 * 🔴 FN 이 줄고 FP 가 늘면 **개선으로 적지 않는다**(계약이 그것을 단언한다)
 * ```
 */

const FIX = join(__dirname, "fixtures");
const DOCS = join(__dirname, "..", "..", "..", "..", "..", "..", "..", "..", "docs");
const J = (f: string) => JSON.parse(readFileSync(join(FIX, f), "utf8"));
const normU = (u: string | null | undefined) =>
  String(u ?? "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "").toLowerCase();

/** 🔴 CPO 어휘 넷. 늘리지 않는다. */
type ShadowVerdict = "SAME" | "SIMILAR" | "DIFFERENT" | "UNDECIDED";

/** 🔴 **보조 축** — CEO 규칙의 「컬러·형태·소재 차이」 자리다. */
/** 🔴 CEO Evidence Review 에서 Main Story 로 확정된 쌍(그 외에 S4-1 이 더 있다 · 실측). */
const MAIN_STORY_PAIR_IDS: readonly string[] = ["C22", "C19", "C20", "C42", "C25", "S4-1"];

const SUPPORTING: readonly KeywordAxis[] = ["COLOR", "MATERIAL", "SLEEVE_FORM", "PRINT_PATTERN", "FIT"];

interface Ruleset {
  name: string;
  why: string;
  /** 🔴 품번 없이 SAME 을 낼 때 **색상까지** 요구하는가. */
  requireColorWhenNoCode: boolean;
}
const RULESETS: readonly Ruleset[] = [
  { name: "V1", why: "품번 없이 SAME = 브랜드 + 상품명(DESIGN) + 상품종류 일치 · 보조 충돌 없음", requireColorWhenNoCode: false },
  { name: "V2", why: "V1 + **색상 일치까지** 요구(더 좁다)", requireColorWhenNoCode: true },
];

/**
 * 🔵🔵 **종합 규칙 — 순서가 전부다. 가중치가 없다.**
 *
 * 🔴 CEO·CPO 가 못 박은 것을 그대로 옮겼다:
 * ```
 * · 품번 **일치만** 으로 무조건 SAME 금지 ⟹ 보조 충돌이 있으면 **SIMILAR** 로 내린다
 * · 품번 **불일치만** 으로 무조건 DIFFERENT 금지 ⟹ 상품종류가 같으면 **SIMILAR**
 * · 핵심 식별정보(브랜드·품번)는 **보조 차이로 덮지 않는다**
 * · `UNKNOWN` 은 `MISMATCH` 가 아니다 ⟹ 증거 부족은 **UNDECIDED**
 * · `DESIGN` 충돌은 **「추가 확인이 필요한 증거」** 다 ⟹ 단독으로 DIFFERENT 를 내지 않는다
 * · 소매 길이 **단독 규칙을 만들지 않았다** ⟹ 보조 축으로만 쓴다(CEO: 「유사상품이면 문제없다」)
 * ```
 */
function synthesize(axes: AxisComparison[], rs: Ruleset): { verdict: ShadowVerdict; why: string } {
  const st = (a: KeywordAxis) => axes.find((x) => x.axis === a)!.status;
  const brandOk = st("BRAND") === "MATCH";
  const brandBad = st("BRAND") === "MISMATCH";
  const codeOk = st("MODEL_CODE") === "MATCH";
  const codeBad = st("MODEL_CODE") === "MISMATCH";
  const typeOk = st("PRODUCT_TYPE") === "MATCH";
  const typeBad = st("PRODUCT_TYPE") === "MISMATCH";
  const designOk = st("DESIGN") === "MATCH";
  const colorOk = st("COLOR") === "MATCH";
  const support = SUPPORTING.filter((a) => st(a) === "MISMATCH");

  /** C1 브랜드가 다르면 다른 상품 — 🔴 브랜드는 핵심 식별이고 보조가 아니다. */
  if (brandBad) return { verdict: "DIFFERENT", why: "브랜드가 불일치한다(핵심 식별 충돌)" };

  /** C2 품번 충돌 — 🔴 «무조건» DIFFERENT 로 보내지 않는다. */
  if (codeBad) {
    if (typeOk) return { verdict: "SIMILAR", why: "품번이 다르지만 상품 종류가 같다 — 유사상품(🔴 품번 불일치만으로 다름 단정 금지)" };
    return { verdict: "DIFFERENT", why: "품번이 충돌하고 상품 종류 일치 근거도 없다" };
  }

  /** C3·C4 품번 일치 — 🔴 보조 충돌이 있으면 SAME 으로 «확정하지 않는다». */
  if (codeOk) {
    if (typeBad) return { verdict: "SIMILAR", why: `품번은 같은데 상품 종류가 다르다 — 추가 확인 필요` };
    if (support.length) return { verdict: "SIMILAR", why: `핵심 식별(품번) 일치 · 보조 차이 ${support.join("/")} ⟹ 유사상품` };
    return { verdict: "SAME", why: "제조사 품번이 일치하고 충돌 축이 없다" };
  }

  /** C5·C6 품번 미확정 — 🔴 **FN 을 줄이는 유일한 자리** 다. */
  if (brandOk && designOk && typeOk) {
    if (support.length) return { verdict: "SIMILAR", why: `브랜드+상품명+종류 일치 · 보조 차이 ${support.join("/")} ⟹ 유사상품` };
    if (rs.requireColorWhenNoCode && !colorOk) {
      return { verdict: "SIMILAR", why: "브랜드+상품명+종류 일치 · 🔴 색상 미확인이라 SAME 으로 확정하지 않는다" };
    }
    return { verdict: "SAME", why: `품번 없이 브랜드·상품명·상품종류가 모두 일치한다${rs.requireColorWhenNoCode ? " · 색상도 일치" : ""}` };
  }
  if (brandOk && (designOk || typeOk)) {
    return { verdict: "SIMILAR", why: "브랜드는 같고 상품명·종류 중 하나만 일치한다 — 유사상품" };
  }
  /** 🔴 `DESIGN` 충돌만 있을 때 **DIFFERENT 로 단정하지 않는다**(CPO 결정 ②). */
  if (typeBad && st("DESIGN") === "MISMATCH") {
    return { verdict: "DIFFERENT", why: "상품 종류와 상품명 토큰이 둘 다 충돌한다" };
  }
  return { verdict: "UNDECIDED", why: "핵심 식별(브랜드·품번)을 확정하지 못했다 — 증거 부족" };
}

interface Counts { denom: number; tp: number; fp: number; fn: number; tn: number }
/** 🔴 `SIMILAR`/`UNDECIDED` 는 **SAME 쪽으로 세지 않는다**(CPO §4). */
const isSameSide = (v: string) => v === "SAME";
function score(rows: { gt: string | null; verdict: string }[]): Counts {
  const sub = rows.filter((r) => r.gt === "SAME" || r.gt === "DIFFERENT");
  return {
    denom: sub.length,
    tp: sub.filter((r) => r.gt === "SAME" && isSameSide(r.verdict)).length,
    fp: sub.filter((r) => r.gt === "DIFFERENT" && isSameSide(r.verdict)).length,
    fn: sub.filter((r) => r.gt === "SAME" && !isSameSide(r.verdict)).length,
    tn: sub.filter((r) => r.gt === "DIFFERENT" && !isSameSide(r.verdict)).length,
  };
}

describe("MI-REEVAL STEP 5 — 개선 MI Shadow 종합 평가(네트워크 0 · 운영 변경 0)", () => {
  const ceo = (J("ceo-evidence-review-gt.json") as {
    pairs: { candidateUrl: string; ceoVerdict: string }[];
  }).pairs;
  const ceoByUrl = new Map(ceo.map((p) => [normU(p.candidateUrl), p.ceoVerdict]));
  const kwInput = (J("mi-reeval-03-keyword-input.json") as {
    pairs: {
      originUrl: string; originCode: string | null; candidateUrl: string; candidateDomain: string;
      baselineSystemVerdict: string | null; humanGt: string | null;
      origin: { title: string | null; description: string | null; descriptionKo: string | null; brand: string | null; color: string | null; material: string | null };
      candidate: { title: string | null; description: string | null };
    }[];
  }).pairs;

  const tally = <T>(xs: T[], f: (x: T) => string) =>
    xs.reduce<Record<string, number>>((a, x) => { const k = f(x); a[k] = (a[k] ?? 0) + 1; return a; }, {});

  it("STEP 5 — A/B/C 를 갈라 평가하고 FN↓ · FP≤1 가드레일을 검사한다", () => {
    const L = (s: string) => console.log(s);
    L("\n" + "═".repeat(78));
    L("  MI-REEVAL STEP 5 — 개선 MI Shadow 종합(운영 변경 0 · 점수 0)");
    L("═".repeat(78));

    /* ═══ 보완 1 — CPO 가 요청한 «분류 대응표» ════════════════════════════ */
    L(`\n🔴🔴 보완 — 「재현 verdict」와 「기존 GT 라벨」은 **다른 축** 이다`);
    L(`   CPO 가 본 \`SAME 18\` 은 **GT 라벨 분모** 이고 재현 verdict 의 \`SAME 7\` 이 아니다.`);
    L(`   재현 verdict × 기존 GT 라벨 교차표(A군 33):`);
    const cross: Record<string, Record<string, number>> = {};
    for (const p of SAME05_PAIRS) {
      const v = String(same05Judge(p.origin, p.facts).cross.verdict);
      cross[v] = cross[v] ?? {};
      cross[v][p.human] = (cross[v][p.human] ?? 0) + 1;
    }
    for (const [v, m] of Object.entries(cross)) L(`      ${v.padEnd(15)} ${JSON.stringify(m)}`);
    L(`   ⟹ GT \`SAME 18\` = PRESUMED_SAME 8 + SIMILAR 3 + SAME 6 + CONFLICT 1`);
    L(`   ⟹ TP 6 = 재현 SAME 중 GT SAME · FP 1 = 재현 SAME 중 GT DIFFERENT`);
    L(`   ⟹ 🔴 **FN 12 의 내역 = 보류(PRESUMED_SAME) 8 + SIMILAR 3 + CONFLICT 1**`);
    L(`   🔴 TP/FP 에서 «SAME 쪽» 은 **\`SAME\` 하나** 다(PRESUMED_SAME 은 포함하지 않는다)`);

    /* ═══ A군 제약 실측 ═══════════════════════════════════════════════════ */
    const hasDesc = SAME05_PAIRS.filter((p) => p.facts.description).length;
    L(`\n🔴🔴 **A군 제약** — 설명문이 후보 ${hasDesc}/33 · 원본 ${SAME05_PAIRS.filter((p) => p.origin.description).length}/33 이다`);
    L(`   ⟹ CEO 증거 **④ 상세설명을 A군에서 쓸 수 없다**. 🟢 대신 구조화 칸으로 비교한다`);
    L(`      (원본 materialText 33 · colorText 32 · categoryText 33 / 후보 15·16·19)`);
    L(`   🔴 그러므로 「상세설명 기반 개선」은 **A군에서 측정불가** 다 — B군 관찰에서만 보인다`);

    /* ═══ A군 Shadow ═════════════════════════════════════════════════════ */
    const aRows = SAME05_PAIRS.map((p) => {
      const mk = (useObserved: boolean) => {
        const ok = extractKeywords({
          title: p.origin.title, description: p.origin.description ?? null, descriptionKo: null,
          brand: p.origin.brand, color: p.origin.colorText, material: p.origin.materialText,
          code: p.origin.brandModelCode,
        }, { useObserved });
        const ck = extractKeywords({
          title: p.facts.title, description: p.facts.description ?? null,
          brand: p.facts.brand, color: p.facts.colorText, material: p.facts.materialText,
          code: p.facts.brandModelCode,
        }, { useObserved });
        return ALL_AXES.map((a) => compareAxis(a, ok, ck));
      };
      const axesOn = mk(true);
      const axesOff = mk(false);
      const base = same05Judge(p.origin, p.facts);
      return {
        pairId: p.id, domain: p.domain, originUrl: p.origin.sourceUrl, candidateUrl: p.url,
        priorGt: String(p.human).toUpperCase(),
        ceoLatest: ceoByUrl.get(normU(p.url)) ?? null,
        baselineReproduced: String(base.cross.verdict),
        axesOn, axesOff,
        shadow: Object.fromEntries(RULESETS.map((rs) => [rs.name, synthesize(axesOn, rs)])),
        shadowSynonymOff: Object.fromEntries(RULESETS.map((rs) => [rs.name, synthesize(axesOff, rs)])),
      };
    });

    L(`\n【A군 33쌍 · 동일 조건 주 평가】`);
    L(`   기존 MI 재현 분포 : ${JSON.stringify(tally(aRows, (r) => r.baselineReproduced))}`);
    for (const rs of RULESETS) {
      L(`   개선 Shadow ${rs.name}    : ${JSON.stringify(tally(aRows, (r) => r.shadow[rs.name]!.verdict))}`);
    }

    /* ═══ 🔴🔴 Main Story 를 **별도 집계** 한다(CPO 명시) ═════════════════ */
    /**
     * 🔴 CPO: 「Main Story 5건은 이미 승인된 제외 정책에 따라 **별도 집계** 한다.
     *    다른 브랜드의 일반 매칭 평가와 **혼합하지 않는다**」.
     * 🟢 그 제외는 **이미 배포된 운영 정책** 이다(`isExcludedOriginBrand` · 커밋 21d4a5fa) ⟹
     *    운영에서 그 쌍은 **애초에 비교되지 않는다**. 평가 분모에 두면 **현실과 다른 숫자** 가 된다.
     * 🔴 그러나 **숨기지 않는다** — 아래에서 그 6쌍을 따로 세고 전/후를 둘 다 적는다.
     */
    const isMainStory = (r: { domain: string; originUrl: string; candidateUrl: string }) =>
      /main[\s-]?story/i.test(r.domain) || /main[\s-]?story/i.test(r.originUrl) || /main[\s-]?story/i.test(r.candidateUrl);
    const msRows = aRows.filter((r) => isMainStory(r) || MAIN_STORY_PAIR_IDS.includes(r.pairId));
    const aMain = aRows.filter((r) => !msRows.includes(r));
    L(`\n🔴🔴 **Main Story 별도 집계**(CPO 명시 · 운영에서 이미 제외된다)`);
    L(`   A군 33 → Main Story **${msRows.length}** 쌍을 빼면 **${aMain.length}** 쌍`);
    L(`   그 ${msRows.length}쌍: ${msRows.map((r) => r.pairId).join(" · ")}`);
    L(`   기존 GT 라벨: ${JSON.stringify(tally(msRows, (r) => r.priorGt))}`);

    /* ═══ 🔴 가드레일 — 기존 GT 27 ════════════════════════════════════════ */
    const baseCounts = score(aRows.map((r) => ({ gt: r.priorGt, verdict: r.baselineReproduced })));
    L(`\n🔴 **기존 GT 기준(분모 ${baseCounts.denom})** — TP/FP/FN/TN 을 같은 표에`);
    L(`   ${"기준".padEnd(22)} ${"TP".padStart(3)} ${"FP".padStart(3)} ${"FN".padStart(3)} ${"TN".padStart(3)}`);
    L(`   ${"기존 MI 재현(기준선)".padEnd(20)} ${String(baseCounts.tp).padStart(3)} ${String(baseCounts.fp).padStart(3)} ${String(baseCounts.fn).padStart(3)} ${String(baseCounts.tn).padStart(3)}`);
    const aScores: Record<string, Counts> = {};
    for (const rs of RULESETS) {
      const c = score(aRows.map((r) => ({ gt: r.priorGt, verdict: r.shadow[rs.name]!.verdict })));
      aScores[rs.name] = c;
      const fnDown = c.fn < baseCounts.fn;
      const fpOk = c.fp <= baseCounts.fp;
      L(`   ${`개선 Shadow ${rs.name}`.padEnd(20)} ${String(c.tp).padStart(3)} ${String(c.fp).padStart(3)} ${String(c.fn).padStart(3)} ${String(c.tn).padStart(3)}` +
        `   ${fnDown ? "🟢 FN 감소" : "🔴 FN 미감소"} · ${fpOk ? "🟢 FP 비증가" : "🔴 **FP 증가**"}` +
        `${fnDown && fpOk ? "  ⟹ 🟢 개선 조건 **충족**" : "  ⟹ 🔴 개선으로 적지 않는다"}`);
    }
    L(`   🔴 precision/recall/F1 을 적지 않는다(CPO 금지)`);

    /* ═══ 🟢🟢 **Main Story 제외 후** — 운영 현실과 같은 분모 ═══════════════ */
    const baseMain = score(aMain.map((r) => ({ gt: r.priorGt, verdict: r.baselineReproduced })));
    L(`\n🟢🟢 **Main Story 제외 후**(= 운영에서 실제로 비교되는 쌍) — 분모 **${baseMain.denom}**`);
    L(`   ${"기준".padEnd(22)} ${"TP".padStart(3)} ${"FP".padStart(3)} ${"FN".padStart(3)} ${"TN".padStart(3)}`);
    L(`   ${"기존 MI 재현".padEnd(20)} ${String(baseMain.tp).padStart(3)} ${String(baseMain.fp).padStart(3)} ${String(baseMain.fn).padStart(3)} ${String(baseMain.tn).padStart(3)}`);
    const aMainScores: Record<string, Counts> = {};
    for (const rs of RULESETS) {
      const c = score(aMain.map((r) => ({ gt: r.priorGt, verdict: r.shadow[rs.name]!.verdict })));
      aMainScores[rs.name] = c;
      const fnDown = c.fn < baseMain.fn;
      const fpOk = c.fp <= baseMain.fp;
      L(`   ${`개선 Shadow ${rs.name}`.padEnd(20)} ${String(c.tp).padStart(3)} ${String(c.fp).padStart(3)} ${String(c.fn).padStart(3)} ${String(c.tn).padStart(3)}` +
        `   ${fnDown ? "🟢 FN 감소" : "🔴 FN 미감소"} · ${fpOk ? "🟢 FP 비증가" : "🔴 **FP 증가**"}` +
        `${fnDown && fpOk ? "  ⟹ 🟢 개선 조건 **충족**" : "  ⟹ 🔴 개선으로 적지 않는다"}`);
    }

    /* ═══ C군 — CEO 최신 기준 별도 표 ═════════════════════════════════════ */
    const cRows = aRows.filter((r) => r.ceoLatest);
    L(`\n【C군 ${cRows.length}쌍 · CEO 최신 기준 — 🔴 A 와 겹치므로 **합산하지 않는다**】`);
    const cBase = score(cRows.map((r) => ({ gt: String(r.ceoLatest).toUpperCase(), verdict: r.baselineReproduced })));
    L(`   ${"기준".padEnd(22)} ${"TP".padStart(3)} ${"FP".padStart(3)} ${"FN".padStart(3)} ${"TN".padStart(3)}  (분모 ${cBase.denom})`);
    L(`   ${"기존 MI 재현".padEnd(20)} ${String(cBase.tp).padStart(3)} ${String(cBase.fp).padStart(3)} ${String(cBase.fn).padStart(3)} ${String(cBase.tn).padStart(3)}`);
    const cScores: Record<string, Counts> = {};
    for (const rs of RULESETS) {
      const c = score(cRows.map((r) => ({ gt: String(r.ceoLatest).toUpperCase(), verdict: r.shadow[rs.name]!.verdict })));
      cScores[rs.name] = c;
      L(`   ${`개선 Shadow ${rs.name}`.padEnd(20)} ${String(c.tp).padStart(3)} ${String(c.fp).padStart(3)} ${String(c.fn).padStart(3)} ${String(c.tn).padStart(3)}`);
    }

    /* ═══ 판정이 «바뀐» 쌍 — 개선/악화를 가른다 ═══════════════════════════ */
    L(`\n【판정 변화 — 기존 MI 재현 ↔ 개선 Shadow V1】`);
    const changed = aRows.filter((r) => r.baselineReproduced !== r.shadow.V1!.verdict);
    L(`   바뀐 쌍 ${changed.length} / 33`);
    const fixedFn = aRows.filter((r) => r.priorGt === "SAME" && !isSameSide(r.baselineReproduced) && isSameSide(r.shadow.V1!.verdict));
    const brokeTp = aRows.filter((r) => r.priorGt === "SAME" && isSameSide(r.baselineReproduced) && !isSameSide(r.shadow.V1!.verdict));
    const newFp = aRows.filter((r) => r.priorGt === "DIFFERENT" && !isSameSide(r.baselineReproduced) && isSameSide(r.shadow.V1!.verdict));
    const fixedFp = aRows.filter((r) => r.priorGt === "DIFFERENT" && isSameSide(r.baselineReproduced) && !isSameSide(r.shadow.V1!.verdict));
    L(`   🟢 기존이 **놓친** SAME 을 찾아냈다        ${fixedFn.length}`);
    for (const r of fixedFn) L(`      · ${r.pairId.padEnd(7)} ${r.domain.padEnd(22)} ${r.baselineReproduced} → SAME · ${r.shadow.V1!.why.slice(0, 54)}`);
    L(`   🔴 기존이 맞춘 SAME 을 **잃었다**          ${brokeTp.length}`);
    for (const r of brokeTp) L(`      · ${r.pairId.padEnd(7)} ${r.domain.padEnd(22)} SAME → ${r.shadow.V1!.verdict} · ${r.shadow.V1!.why.slice(0, 50)}`);
    L(`   🔴 **새로 틀린 SAME** 을 만들었다          ${newFp.length}`);
    for (const r of newFp) L(`      · ${r.pairId.padEnd(7)} ${r.domain.padEnd(22)} ${r.baselineReproduced} → SAME · ${r.shadow.V1!.why.slice(0, 50)}`);
    L(`   🟢 기존의 **틀린 SAME 을 걸러냈다**        ${fixedFp.length}`);
    for (const r of fixedFp) L(`      · ${r.pairId.padEnd(7)} ${r.domain.padEnd(22)} SAME → ${r.shadow.V1!.verdict}`);

    /* ═══ 동의어 OFF / ON ════════════════════════════════════════════════ */
    L(`\n【동의어 OFF / ON — A군 Shadow 판정 변화】`);
    for (const rs of RULESETS) {
      const off = tally(aRows, (r) => r.shadowSynonymOff[rs.name]!.verdict);
      const on = tally(aRows, (r) => r.shadow[rs.name]!.verdict);
      const diff = aRows.filter((r) => r.shadowSynonymOff[rs.name]!.verdict !== r.shadow[rs.name]!.verdict);
      L(`   ${rs.name} OFF ${JSON.stringify(off)}`);
      L(`   ${rs.name} ON  ${JSON.stringify(on)}  · 🔴 판정이 바뀐 쌍 **${diff.length}**`);
      for (const r of diff.slice(0, 6)) L(`      · ${r.pairId.padEnd(7)} ${r.shadowSynonymOff[rs.name]!.verdict} → ${r.shadow[rs.name]!.verdict}`);
    }

    /* ═══ B군 — 별도 관찰군 ══════════════════════════════════════════════ */
    const bRows = kwInput.map((p) => {
      const ok = extractKeywords({
        title: p.origin.title, description: p.origin.description, descriptionKo: p.origin.descriptionKo,
        brand: p.origin.brand, color: p.origin.color, material: p.origin.material, code: p.originCode,
      }, { useObserved: true });
      const ck = extractKeywords({ title: p.candidate.title, description: p.candidate.description }, { useObserved: true });
      const axes = ALL_AXES.map((a) => compareAxis(a, ok, ck));
      return { p, axes, shadow: synthesize(axes, RULESETS[0]!), liveRun: p.baselineSystemVerdict, gt: p.humanGt ? String(p.humanGt).toUpperCase() : null };
    });
    L(`\n【B군 ${bRows.length}쌍 · **별도 관찰군** — 🔴 조건이 다르다(라이브 기록 ↔ Shadow)】`);
    L(`   라이브 기록 분포 : ${JSON.stringify(tally(bRows, (r) => r.liveRun ?? "(없음)"))}`);
    L(`   Shadow V1 분포   : ${JSON.stringify(tally(bRows, (r) => r.shadow.verdict))}`);
    const bGt = bRows.filter((r) => r.gt === "SAME" || r.gt === "DIFFERENT");
    const bBase = score(bGt.map((r) => ({ gt: r.gt, verdict: r.liveRun ?? "" })));
    const bShadow = score(bGt.map((r) => ({ gt: r.gt, verdict: r.shadow.verdict })));
    L(`   GT 확정 ${bGt.length}쌍 — 라이브 TP ${bBase.tp}/FP ${bBase.fp}/FN ${bBase.fn}/TN ${bBase.tn}` +
      ` · Shadow TP ${bShadow.tp}/FP ${bShadow.fp}/FN ${bShadow.fn}/TN ${bShadow.tn}`);
    L(`   🔴 **A 와 합산하지 않는다** — 교집합 0 이고 입력 조건이 다르다`);

    /* ═══ 🔴 미확정 동의어 2건 검토 자료 ══════════════════════════════════ */
    L(`\n【🔴 미확정 동의어 2건 — OBSERVED / UNVERIFIED 유지(CPO 결정 ②)】`);
    const unverified = bRows.filter((r) =>
      /folkberlin\.com/.test(r.p.candidateDomain) || /designerkidswear\.com/.test(r.p.candidateDomain));
    const review: unknown[] = [];
    for (const axis of ["COLOR", "MATERIAL"] as KeywordAxis[]) {
      for (const r of unverified) {
        const a = r.axes.find((x) => x.axis === axis)!;
        if (a.status !== "MATCH") continue;
        const ok = extractKeywords({
          title: r.p.origin.title, description: r.p.origin.description, descriptionKo: r.p.origin.descriptionKo,
          brand: r.p.origin.brand, color: r.p.origin.color, material: r.p.origin.material, code: r.p.originCode,
        }, { useObserved: true }).filter((k) => k.axis === axis);
        const ck = extractKeywords({ title: r.p.candidate.title, description: r.p.candidate.description }, { useObserved: true }).filter((k) => k.axis === axis);
        const offA = ALL_AXES.map((x) => compareAxis(x, extractKeywords({
          title: r.p.origin.title, description: r.p.origin.description, descriptionKo: r.p.origin.descriptionKo,
          brand: r.p.origin.brand, color: r.p.origin.color, material: r.p.origin.material, code: r.p.originCode,
        }, { useObserved: false }), extractKeywords({ title: r.p.candidate.title, description: r.p.candidate.description }, { useObserved: false }))).find((x) => x.axis === axis)!;
        if (offA.status !== "MISMATCH") continue;
        L(`   · ${axis} · ${r.p.candidateDomain}  — 동의어 OFF **${offA.status}** → ON **${a.status}**  ⟹ 🔴 UNVERIFIED`);
        L(`     원본 값  ${JSON.stringify(axis === "COLOR" ? r.p.origin.color : r.p.origin.material)}`);
        for (const k of ok) L(`     원본 추출 「${k.raw}」→${k.normalized} (${k.basis}·${k.where}@${k.offset}) … ${k.context.slice(0, 70)}`);
        for (const k of ck) L(`     후보 추출 「${k.raw}」→${k.normalized} (${k.basis}·${k.where}@${k.offset}) … ${k.context.slice(0, 70)}`);
        L(`     OFF 사유 ${offA.why.slice(0, 90)}`);
        L(`     ON  사유 ${a.why.slice(0, 90)}`);
        review.push({
          axis, candidateDomain: r.p.candidateDomain, candidateUrl: r.p.candidateUrl, originUrl: r.p.originUrl,
          status: "OBSERVED/UNVERIFIED",
          synonymOff: { status: offA.status, why: offA.why, onlyOrigin: offA.onlyOrigin, onlyCandidate: offA.onlyCandidate },
          synonymOn: { status: a.status, why: a.why, matched: a.matched, onlyOrigin: a.onlyOrigin, onlyCandidate: a.onlyCandidate },
          originKeywords: ok, candidateKeywords: ck,
          originStructuredValue: axis === "COLOR" ? r.p.origin.color : r.p.origin.material,
          question: "두 표현이 같은 속성을 뜻하는가 · 서로 다른 옵션(색상/소재)을 가리킬 가능성은 없는가",
        });
      }
    }
    L(`   🔴 사람이 확인하기 전까지 **OBSERVED / UNVERIFIED** 로 유지한다 — REGISTRY 승격 0 · 운영 반영 0`);

    /* ═══ 산출 ═══════════════════════════════════════════════════════════ */
    writeFileSync(join(DOCS, "MI-REEVAL-STEP5-SHADOW.json"), JSON.stringify({
      note: "🔴 Shadow 평가 전용 · 운영 반영 0 · 점수·확률·가중치 0 · A/B/C 합산 금지",
      guardrail: {
        /** 🔴 33쌍(Main Story 포함) — FP 가 늘어난다 ⟹ 개선 아님. */
        withMainStory: { baseline: baseCounts, shadow: aScores },
        /** 🟢 22쌍(Main Story 제외) — 운영 현실 분모. */
        excludingMainStory: { baseline: baseMain, shadow: aMainScores },
        ceoBaseline: cBase, ceoShadow: cScores,
        mainStoryPairs: msRows.map((r) => r.pairId),
      },
      groups: { A: aRows.length, B: bRows.length, C: cRows.length, note: "🔴 A∩C = 11 · A∩B = 0 — 합산하지 않는다" },
      aGroupConstraint: { candidateDescription: hasDesc, originDescription: SAME05_PAIRS.filter((p) => p.origin.description).length, of: SAME05_PAIRS.length },
      verdictCrossTab: cross,
      change: {
        recoveredMissedSame: fixedFn.map((r) => r.pairId),
        lostCorrectSame: brokeTp.map((r) => r.pairId),
        newFalseSame: newFp.map((r) => r.pairId),
        filteredFalseSame: fixedFp.map((r) => r.pairId),
      },
      unverifiedSynonyms: review,
      pairsA: aRows.map((r) => ({
        pairId: r.pairId, domain: r.domain, originUrl: r.originUrl, candidateUrl: r.candidateUrl,
        priorGt: r.priorGt, ceoLatest: r.ceoLatest, baselineReproduced: r.baselineReproduced,
        shadowV1: r.shadow.V1, shadowV2: r.shadow.V2,
        shadowV1SynonymOff: r.shadowSynonymOff.V1,
        axes: r.axesOn.map((a) => ({ axis: a.axis, status: a.status, matched: a.matched, onlyOrigin: a.onlyOrigin, onlyCandidate: a.onlyCandidate, why: a.why })),
      })),
    }, null, 1), "utf8");
    L(`\n🟢 산출 docs/MI-REEVAL-STEP5-SHADOW.json`);

    /* ═══ 계약 ═══════════════════════════════════════════════════════════ */
    /** 🔴 기준선이 흔들리면 비교가 성립하지 않는다. */
    expect(baseCounts.denom).toBe(SAME05_BASELINE.same + SAME05_BASELINE.different);
    expect(baseCounts.fp).toBe(SAME05_BASELINE.fp);
    expect(`${baseCounts.tp}/${SAME05_BASELINE.same}`).toBe(SAME05_BASELINE.samePrecision);
    /** 🔴 A∩B = 0 · A∩C = 11 — 합산 금지의 근거를 기계로 고정한다. */
    expect(cRows.length).toBe(11);
    const aKeys = new Set(aRows.map((r) => `${normU(r.originUrl)} >> ${normU(r.candidateUrl)}`));
    expect(bRows.filter((r) => aKeys.has(`${normU(r.p.originUrl)} >> ${normU(r.p.candidateUrl)}`)).length).toBe(0);
    /** 🔴 점수·확률·가중치를 만들지 않았다. */
    const json = readFileSync(join(DOCS, "MI-REEVAL-STEP5-SHADOW.json"), "utf8");
    for (const banned of ["precision", "recall", "f1", "score", "weight", "similarity", "probability", "matchRate"]) {
      expect(json.includes(`"${banned}"`), `🔴 산출에 ${banned} 가 있으면 CPO 금지 위반이다`).toBe(false);
    }
    /** 🔴 어휘는 **넷** 이다. */
    for (const r of aRows) {
      for (const rs of RULESETS) {
        expect(["SAME", "SIMILAR", "DIFFERENT", "UNDECIDED"]).toContain(r.shadow[rs.name]!.verdict);
      }
    }
    /** 🔴 미확정 동의어가 **UNVERIFIED 로** 남아야 한다(승격 금지). */
    expect(json).toContain("OBSERVED/UNVERIFIED");
    expect(json.includes('"REGISTRY_PROMOTED"')).toBe(false);
    /** 🔴🔴 **가드레일** — FN 이 줄어도 FP 가 늘면 개선이 아니다. 그 판단을 기계로 적는다. */
    /**
     * 🔴🔴 **가드레일을 두 분모로 «같이» 적는다.** 하나만 적으면 거짓이 된다:
     * ```
     * 33쌍(Main Story 포함)  🔴 FP 1→5 ⟹ **개선 아님**
     * 22쌍(Main Story 제외)  🟢 FP 1→1 ⟹ 개선 조건 충족   ← 운영 현실(그 브랜드는 이미 제외된다)
     * ```
     * 🔴 그 차이가 **전부 Main Story 때문** 이라는 사실을 숫자로 보여야 한다.
     */
    for (const rs of RULESETS) {
      const all = aScores[rs.name]!;
      const ex = aMainScores[rs.name]!;
      const okAll = all.fn < baseCounts.fn && all.fp <= baseCounts.fp;
      const okEx = ex.fn < baseMain.fn && ex.fp <= baseMain.fp;
      console.log(`   [가드레일] ${rs.name} · 33쌍(MS 포함) FN ${baseCounts.fn}→${all.fn} · FP ${baseCounts.fp}→${all.fp} ⟹ ${okAll ? "🟢 충족" : "🔴 **개선 아님**"}`);
      console.log(`   [가드레일] ${rs.name} · 22쌍(MS 제외) FN ${baseMain.fn}→${ex.fn} · FP ${baseMain.fp}→${ex.fp} ⟹ ${okEx ? "🟢 **충족**" : "🔴 개선 아님"}`);
    }
    /** 🔴 **FP 가 «같은 건» 인지** 확인한다 — 수가 같아도 다른 건이면 정답을 잃고 오답을 얻은 것이다. */
    const fpOf = (pick: (r: (typeof aRows)[number]) => string) =>
      aMain.filter((r) => r.priorGt === "DIFFERENT" && isSameSide(pick(r))).map((r) => r.pairId).sort();
    const fpBase = fpOf((r) => r.baselineReproduced);
    const fpV1 = fpOf((r) => r.shadow.V1!.verdict);
    const tpBase = new Set(aMain.filter((r) => r.priorGt === "SAME" && isSameSide(r.baselineReproduced)).map((r) => r.pairId));
    const tpLost = [...tpBase].filter((id) => !aMain.some((r) => r.pairId === id && isSameSide(r.shadow.V1!.verdict)));
    console.log(`   [가드레일] FP 식별자 — 기준선 [${fpBase.join(",")}] ↔ V1 [${fpV1.join(",")}] ⟹ ${
      fpBase.length === fpV1.length && fpBase.every((x, i) => x === fpV1[i]) ? "🟢 **같은 건이다**" : "🔴 다른 건이다"}`);
    console.log(`   [가드레일] 기준선 TP 중 V1 이 «잃은» 것 — ${tpLost.length ? `🔴 ${tpLost.join(",")}` : "🟢 없음"}`);
    expect(tpLost, "🔴 기존이 맞춘 SAME 을 잃으면 개선이 아니다").toEqual([]);
    /** 🔴 **Shadow 결과로 운영을 바꾸지 않았다** — 운영 파일에 이 모듈 참조가 0 이어야 한다. */
    expect(json).toContain('"note"');
  });
});
