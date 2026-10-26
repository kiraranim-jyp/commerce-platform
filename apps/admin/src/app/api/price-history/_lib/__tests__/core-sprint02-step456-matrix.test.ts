import { describe, expect, it } from "vitest";
import { compareModelCode } from "@commerce/crawler/src/comparison-search/model-code";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import { deriveMatchTruth } from "@commerce/crawler/src/comparison-search/match-truth";
import type { ProductFacts } from "@commerce/shared";
import { SAME05_PAIRS, type Same05Pair } from "./core-same05-gt";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-SAME-SPRINT-02 **STEP 4~6** — 5행 표 + 안전조건 6(구현 0 · 네트워크 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **운영 반영 0.** 반사실은 **운영 함수에 입력만 바꿔** 넣는다(코드 수정 0).
 * 🔴 새 SAME 축 **0** · MODEL_CODE 완화 **0** · NO_TITLE_OVERLAP **0** · threshold **0**.
 *
 * ── 🔴 평가 방식(CPO §3) — 「기존 MODEL_CODE 축에 증거를 공급」만 한다 ──────
 * ```
 * 후보 `brandModelCode` 가 **null 일 때만** 후보측 상세설명에서 품번을 찾아 채운다.
 *   ⟹ 일치하면 기존 `MODEL_CODE` 축이 +3 을 준다(SAME 근거 보강)
 *   ⟹ 불일치하면 기존 `compareModelCode` 가 **conflict** 를 낸다(차단) — **보호 강화** 다
 * 🔴 값이 있는 후보 코드는 **절대 덮지 않는다** ⟹ 기존 충돌 보호가 한 글자도 안 바뀐다
 * 🔴 **후보측 설명만** 본다 — 원상품 설명을 후보 증거로 쓰면 그것이 오염이다
 * ```
 */

/** 🔴 원상품과 **같은 모양** 만 찾는다(느슨한 숫자 매칭 금지). */
const CODE_RE = /\bB\d{3}[A-Z]{2}\d{3}\b/gi;
const codesIn = (s: string | null): string[] =>
  s ? [...new Set((s.match(CODE_RE) ?? []).map((x) => x.toUpperCase()))] : [];

/**
 * 🟢 **행 ②** — description → MODEL_CODE 증거 공급.
 * 🔴 `materialText` 가 현재 설명문이 실려 오는 칸이다(SPRINT-02 STEP 3-b 실측).
 *    🔴 그 칸을 「소재」로 쓰는 기존 축은 **건드리지 않는다** — 읽기만 한다.
 */
function cfDescriptionCode(p: Same05Pair): ProductFacts {
  if (p.facts.brandModelCode) return p.facts; // 🔴 값이 있으면 덮지 않는다
  const found = codesIn(p.facts.materialText);
  if (found.length !== 1) return p.facts; // 🔴 둘 이상이면 고르지 않는다(지어내기 금지)
  return { ...p.facts, brandModelCode: found[0] };
}

/**
 * 🟡 **행 ③** — form/category. 🔴 CPO 가 변경안을 지정하지 않았고 이 GT 에
 *    `GARMENT_FORM` 발화가 **0** 이다(SPRINT-01 실측) ⟹ **측정불가** 로 적는다.
 */
const FORM_UNMEASURABLE = "🔴 측정불가 — 이 GT 에 GARMENT_FORM 발화 0 (SPRINT-01)";

/**
 * 🟢 **행 ④** — 기존 evidence 조합(SAME-05 의 brand 보강 + 절단 품번 복원).
 * 🔴 SAME-05 가 이미 쟀다 — 같은 술어를 **그대로** 쓴다(재구현 0).
 */
const KNOWN_ALIAS_BRAND: Record<string, string> = { 보보쇼즈: "Bobo Choses", 페페: "Pèpè Shoes" };
function cfExisting(p: Same05Pair): ProductFacts {
  let f = p.facts;
  if (!f.brand) {
    const hit = f.coreTitleTokens.find((t) => KNOWN_ALIAS_BRAND[t]);
    if (hit) f = { ...f, brand: KNOWN_ALIAS_BRAND[hit] };
  }
  if (!f.brandModelCode) {
    const code = p.origin.brandModelCode?.trim();
    if (code && code.length >= 4 && /^[A-Za-z]$/.test(code[0])) {
      const tail = code.slice(1).toLowerCase();
      if (tail.length >= 3 && f.coreTitleTokens.some((t) => t.toLowerCase() === tail)) {
        f = { ...f, brandModelCode: code };
      }
    }
  }
  return f;
}

type Mode = "baseline" | "description" | "form" | "existing" | "integrated";

function factsFor(p: Same05Pair, mode: Mode): ProductFacts {
  if (mode === "baseline" || mode === "form") return p.facts;
  if (mode === "description") return cfDescriptionCode(p);
  if (mode === "existing") return cfExisting(p);
  /** integrated — 🔴 **설명 품번을 먼저** 공급하고(강한 증거) 그 뒤 기존 보강. */
  const withCode = cfDescriptionCode(p);
  return cfExisting({ ...p, facts: withCode });
}

/** 🔴 운영 순서 그대로. */
function judge(p: Same05Pair, mode: Mode) {
  const f = factsFor(p, mode);
  const cross = compareCrossSellerProducts(p.origin, f);
  const code = compareModelCode(p.origin.brandModelCode, f.brandModelCode ?? null);
  const truth = deriveMatchTruth("low", code, cross.verdict, cross.blockers, cross.conflicts, !f.colorText);
  return { f, cross, code: String(code), truth: String(truth), tier: priceTierFromLink({ matchTruth: truth, verified: false }) };
}

interface Tally {
  tp: number;
  fn: number;
  fp: number;
  tn: number;
  und: number;
  undSysSame: number;
  fired: number;
}
function tally(mode: Mode): Tally {
  const t: Tally = { tp: 0, fn: 0, fp: 0, tn: 0, und: 0, undSysSame: 0, fired: 0 };
  for (const p of SAME05_PAIRS) {
    const j = judge(p, mode);
    if (factsFor(p, mode).brandModelCode !== p.facts.brandModelCode || factsFor(p, mode).brand !== p.facts.brand) t.fired += 1;
    const same = j.cross.verdict === "SAME";
    if (p.human === "SAME") same ? (t.tp += 1) : (t.fn += 1);
    else if (p.human === "DIFFERENT") same ? (t.fp += 1) : (t.tn += 1);
    else {
      t.und += 1;
      if (same) t.undSysSame += 1;
    }
  }
  return t;
}

describe("CORE-SAME-SPRINT-02 STEP 4~6 — 5행 표 + 안전조건 6(운영 반영 0)", () => {
  const base = tally("baseline");

  it("[STEP 4~5] 5행 표를 완성한다", () => {
    const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - [...s].length));
    const MODES: { m: Mode; label: string }[] = [
      { m: "baseline", label: "Baseline" },
      { m: "description", label: "Description→MODEL_CODE" },
      { m: "form", label: "Form/category" },
      { m: "existing", label: "기존 evidence 조합" },
      { m: "integrated", label: "Integrated" },
    ];
    console.log(`\n${"═".repeat(112)}`);
    console.log(`  STEP 4~5 — GT ${SAME05_PAIRS.length}쌍 (human SAME ${base.tp + base.fn} · DIFFERENT ${base.fp + base.tn} · UNCERTAIN ${base.und})`);
    console.log(`${"═".repeat(112)}`);
    console.log(
      `  ${pad("개선안", 26)}${pad("발화", 6)}${pad("SAME 회수", 11)}${pad("🔴 누출", 9)}${pad("UND(sysSAME)", 14)}${pad("기존FP영향", 12)}생산적용`,
    );
    for (const { m, label } of MODES) {
      if (m === "form") {
        console.log(`  ${pad(label, 26)}${pad("—", 6)}${pad("측정불가", 11)}${pad("—", 9)}${pad("—", 14)}${pad("—", 12)}${FORM_UNMEASURABLE}`);
        continue;
      }
      const t = tally(m);
      const dFp = t.fp - base.fp;
      const dTp = t.tp - base.tp;
      const apply =
        m === "baseline"
          ? "—"
          : dFp > 0
            ? "🔴 **NO-GO**(누출 증가)"
            : t.fired === 0
              ? "🔴 측정불가(발화 0)"
              : dTp < 0
                ? "🔴 NO-GO(SAME 손실)"
                : `🟢 **안전**(누출 ${dFp >= 0 ? "+" : ""}${dFp} · SAME ${dTp >= 0 ? "+" : ""}${dTp})`;
      console.log(
        `  ${pad(label, 26)}${pad(String(t.fired), 6)}${pad(`${t.tp}/${t.tp + t.fn}`, 11)}${pad(`${t.fp}/${t.fp + t.tn}`, 9)}` +
          `${pad(`${t.und}(${t.undSysSame})`, 14)}${pad(`${base.fp}→${t.fp}`, 12)}${apply}`,
      );
    }
    expect(base.tp).toBe(5);
    expect(base.fp).toBe(2);
  });

  /**
   * 🔴🔴🔴 **안전조건 6(CPO §6) 전부 판정** — 하나라도 깨지면 NO-GO 다.
   */
  it("[STEP 6] 안전조건 6을 전부 판정한다", () => {
    const results: { n: string; ok: boolean; detail: string }[] = [];
    const t = tally("integrated");
    const d = tally("description");

    /** ① FP 증가 0 */
    results.push({ n: "① FP 증가 0", ok: t.fp <= base.fp && d.fp <= base.fp, detail: `baseline ${base.fp} → description ${d.fp} → integrated ${t.fp}` });

    /** ② seller brand 오염 0 — 🔴 **선언된 brand 를 덮지 않는다**(전수). */
    const overwritten = SAME05_PAIRS.filter((p) => {
      const f = factsFor(p, "integrated");
      return Boolean(p.facts.brand) && f.brand !== p.facts.brand;
    });
    results.push({ n: "② seller brand 오염 0", ok: overwritten.length === 0, detail: `덮어쓴 건 ${overwritten.length}` });

    /** ③ MODEL_CODE conflict 보호 유지 — 값이 있는 코드를 덮지 않고, 품번 재사용 2건이 non-SAME. */
    const codeOverwritten = SAME05_PAIRS.filter((p) => {
      const f = factsFor(p, "integrated");
      return Boolean(p.facts.brandModelCode) && f.brandModelCode !== p.facts.brandModelCode;
    });
    const guarded = SAME05_PAIRS.filter((p) => p.human === "DIFFERENT" && compareModelCode(p.origin.brandModelCode, p.facts.brandModelCode) === "exact");
    const guardHeld = guarded.every((p) => judge(p, "integrated").cross.verdict !== "SAME");
    results.push({
      n: "③ MODEL_CODE 보호 유지",
      ok: codeOverwritten.length === 0 && guardHeld && guarded.length === 2,
      detail: `값 덮어쓴 건 ${codeOverwritten.length} · 품번재사용 ${guarded.length}건 전부 non-SAME=${guardHeld}`,
    });

    /** ④⑤ NO_TITLE_OVERLAP · threshold 완화 0 — 🔴 반사실이 **입력만** 바꾼다(코드 0). */
    const titleUntouched = SAME05_PAIRS.every((p) => {
      const f = factsFor(p, "integrated");
      return JSON.stringify(f.coreTitleTokens) === JSON.stringify(p.facts.coreTitleTokens);
    });
    results.push({ n: "④ NO_TITLE_OVERLAP 완화 0", ok: titleUntouched, detail: `제목 토큰 변경 건 ${titleUntouched ? 0 : "있음"}` });
    results.push({ n: "⑤ threshold 완화 0", ok: true, detail: "운영 함수를 그대로 호출 — 상수 변경 0" });

    /** ⑥ 기존 DIFFERENT 보호 — TN 이 줄지 않는다. */
    results.push({ n: "⑥ 기존 DIFFERENT 보호", ok: t.tn >= base.tn, detail: `TN ${base.tn} → ${t.tn}` });

    console.log(`\n═══ STEP 6 — 안전조건 6 ═══`);
    for (const r of results) console.log(`  ${r.ok ? "🟢 PASS" : "🔴 FAIL"}  ${r.n.padEnd(26)} ${r.detail}`);
    const failed = results.filter((r) => !r.ok);
    console.log(`\n  ⟹ ${failed.length === 0 ? "🟢🟢 **안전조건 6/6 PASS**" : `🔴 **${failed.length}건 FAIL** — ${failed.map((f) => f.n).join(" · ")}`}`);

    expect(failed.map((f) => f.n)).toEqual([]);
  });

  /** 🔴 발화가 0 이면 「안전」이 아니라 「측정불가」다(「변화 0 = 안전」 금지). */
  it("[발화 확인] description 반사실이 실제로 입력을 바꿨는가", () => {
    const fired = SAME05_PAIRS.filter((p) => cfDescriptionCode(p).brandModelCode !== p.facts.brandModelCode);
    console.log(`\n═══ description 발화 ${fired.length}건 ═══`);
    for (const p of fired) {
      const recovered = cfDescriptionCode(p).brandModelCode;
      const j = judge(p, "description");
      console.log(
        `  ${p.id.padEnd(7)} ${p.domain.padEnd(22)} human=${p.human.padEnd(10)} 복원=${recovered} ↔ 원상품=${p.origin.brandModelCode} ` +
          `⟹ code=${j.code} · sys=${j.cross.verdict}`,
      );
    }
    expect(fired.length, "🔴 발화 0 이면 「누출 +0」을 안전 근거로 쓰지 않는다").toBeGreaterThan(0);
  });
});
