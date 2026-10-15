/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-019A-EXT — **Multi-AI Identity Benchmark** (Track A 만 · 엔진 변경 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **CTO 는 AI 값을 생성하지 않는다**(§17). Gemini API ❌ GPT API ❌ 키 ❌ 비용 ❌
 *    자동 브라우저 ❌ 소비자 AI UI 자동화 ❌. 사람이 수동 판정한 결과를 **파일로** 받는다.
 * 🔴 AI 데이터가 없으면 AI/모델 축 전부 **「측정불가」** 다 — 🔴 **0% 로 적지 않는다.**
 *    「AI 데이터가 없다」 ≠ 「AI 가 못 찾았다」(CPO §3).
 *
 * ── 이 하니스가 쓰는 것 ────────────────────────────────────────────────────
 * ```
 * MI 축   `mi-019a-result.json`  ← WU-019A 가 **실측해 남긴** 결과(재측정 안 함 · HTTP 0)
 * AI 축   `mi-019a-ai-verdicts.json`  [{ caseId, verdict, reason?, raw?, model? }, …]
 *         🟢 `model` 이 없으면 "UNSPECIFIED" 로 묶는다(019A 단일축 파일과 호환).
 * ```
 * 🔴 KPI 계산에 쓰는 AI 칸은 **`verdict` 하나** 다(§7). confidence·가격·판매처·
 *    자연어 reasoning 은 보존만 하고 **읽지 않는다**.
 * 🔴 **AI → MI 경로를 만들지 않는다**(§8) — MI 값은 이 파일을 읽기 전에 이미 확정돼 있다.
 * 🔴 **조합(ensemble)을 구현하지 않는다**(§12) — 아래 Rule A/B/C 는 **counterfactual 계산**
 *    이고 제품 코드·정책에 반영하지 않는다.
 * 🔴 Track B(Discovery 능력)는 이 WU 범위가 **아니다**(§4).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CASES, GT_OF, normalizeAiVerdict, type Gt, type ThreeWay } from "./__fixtures__/mi-identity-benchmark";

const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const MI_RESULT = path.join(OUT_DIR, "mi-019a-result.json");
const AI_VERDICTS = path.join(OUT_DIR, "mi-019a-ai-verdicts.json");

/** WU-019A 가 남긴 MI 행 중 이 WU 가 읽는 칸만. 🔴 칸 이름을 추측하지 않고 그 파일 그대로. */
interface MiRow {
  caseId: string;
  productType: string;
  gt: Gt;
  factsStatus: string;
  miRaw: string | null;
  miStrict: ThreeWay | null;
  miThreeWay: ThreeWay | null;
  miCorrect: boolean | null;
}

export interface AiEntry {
  caseId: string;
  verdict: ThreeWay;
  model: string;
  reason: string | null;
  raw: string | null;
}

/** 🔴 **검증 실패를 조용히 넘기지 않는다** — 어느 줄이 왜 빠졌는지 남긴다(§17-5). */
export interface AiFileValidation {
  entries: AiEntry[];
  rejected: { index: number; caseId: string | null; why: string }[];
  models: string[];
  /** caseId 별 커버리지 — 🔴 빠진 케이스를 「DIFFERENT」로 **채우지 않는다**. */
  missingByModel: Record<string, string[]>;
}

/**
 * AI 결과 파일 검증기. 🔴 **순수 함수** 이고 AI 데이터 없이도 테스트된다.
 *
 * 🔴 통과 조건 — `caseId` 가 benchmark 에 있고, `verdict` 가 **세 단어 중 하나** 다.
 *    🔴 `"SAME (0.95)"`·산문·confidence 섞인 값은 **버린다**(정규화기가 null 을 낸다).
 */
export function validateAiVerdictFile(raw: unknown, knownCaseIds: readonly string[]): AiFileValidation {
  const entries: AiEntry[] = [];
  const rejected: AiFileValidation["rejected"] = [];
  const list = Array.isArray(raw) ? raw : [];
  if (!Array.isArray(raw)) rejected.push({ index: -1, caseId: null, why: "최상위가 배열이 아니다" });

  list.forEach((row, index) => {
    const r = (row ?? {}) as Record<string, unknown>;
    const caseId = typeof r.caseId === "string" ? r.caseId : null;
    if (!caseId) {
      rejected.push({ index, caseId: null, why: "caseId 없음" });
      return;
    }
    if (!knownCaseIds.includes(caseId)) {
      rejected.push({ index, caseId, why: "benchmark 에 없는 caseId" });
      return;
    }
    const verdict = normalizeAiVerdict(typeof r.verdict === "string" ? r.verdict : null);
    if (!verdict) {
      rejected.push({ index, caseId, why: `verdict 가 세 단어가 아니다: ${JSON.stringify(r.verdict)}` });
      return;
    }
    const model = typeof r.model === "string" && r.model.trim() ? r.model.trim() : "UNSPECIFIED";
    /* 🔴 같은 (model, caseId) 가 두 번 오면 **뒤엣것을 쓰지 않는다** — 조용한 덮어쓰기 금지. */
    if (entries.some((e) => e.model === model && e.caseId === caseId)) {
      rejected.push({ index, caseId, why: `중복 (model=${model})` });
      return;
    }
    entries.push({
      caseId,
      verdict,
      model,
      reason: typeof r.reason === "string" ? r.reason : null,
      raw: typeof r.raw === "string" ? r.raw : null,
    });
  });

  const models = [...new Set(entries.map((e) => e.model))].sort();
  const missingByModel: Record<string, string[]> = {};
  for (const m of models) {
    const have = new Set(entries.filter((e) => e.model === m).map((e) => e.caseId));
    missingByModel[m] = knownCaseIds.filter((c) => !have.has(c));
  }
  return { entries, rejected, models, missingByModel };
}

interface ModelKpi {
  model: string;
  n: number;
  accuracy: string;
  precision: string;
  recall: string;
  falseSame: string[];
  falseDifferent: string[];
  uncertain: string[];
}

/**
 * 🔴 **분모를 숫자가 아니라 문자열("x/y")로 낸다** — 퍼센트만 적으면 N 이 사라진다(§15).
 * 🔴 UNCERTAIN 은 SAME 도 DIFFERENT 도 아니다 → Precision/Recall 분자에 들어가지 않는다.
 */
function kpiOf(model: string, rows: { gt: Gt; verdict: ThreeWay; caseId: string }[]): ModelKpi {
  const said = rows.filter((r) => r.verdict === "SAME");
  const gtSame = rows.filter((r) => r.gt === "SAME");
  const correct = rows.filter((r) => (r.verdict === "SAME") === (r.gt === "SAME") && r.verdict !== "UNCERTAIN");
  return {
    model,
    n: rows.length,
    accuracy: `${correct.length}/${rows.length}`,
    precision: `${said.filter((r) => r.gt === "SAME").length}/${said.length}`,
    recall: `${gtSame.filter((r) => r.verdict === "SAME").length}/${gtSame.length}`,
    falseSame: rows.filter((r) => r.gt === "DIFFERENT" && r.verdict === "SAME").map((r) => r.caseId),
    falseDifferent: rows.filter((r) => r.gt === "SAME" && r.verdict === "DIFFERENT").map((r) => r.caseId),
    uncertain: rows.filter((r) => r.verdict === "UNCERTAIN").map((r) => r.caseId),
  };
}

describe("WU-019A-EXT ① AI 결과 파일 검증기 (AI 데이터 0 · HTTP 0)", () => {
  const ids = CASES.map((c) => c.caseId);

  it("🟢 정상 입력은 모델별로 묶인다 — `model` 이 없으면 UNSPECIFIED", () => {
    const v = validateAiVerdictFile(
      [
        { caseId: "B01", verdict: "SAME", model: "gemini" },
        { caseId: "B01", verdict: "DIFFERENT", model: "gpt" },
        { caseId: "B02", verdict: "UNCERTAIN" },
      ],
      ids,
    );
    expect(v.models).toEqual(["UNSPECIFIED", "gemini", "gpt"]);
    expect(v.rejected).toEqual([]);
    expect(v.entries).toHaveLength(3);
  });

  it("🔴 세 단어가 아니면 **버린다** — confidence·가격·산문이 섞인 값", () => {
    const v = validateAiVerdictFile(
      [
        { caseId: "B01", verdict: "SAME (0.95)", model: "gemini" },
        { caseId: "B02", verdict: "동일상품입니다 ₩49,000", model: "gemini" },
        { caseId: "B03", verdict: "같다", model: "gemini" },
      ],
      ids,
    );
    expect(v.entries).toEqual([]);
    expect(v.rejected).toHaveLength(3);
    for (const r of v.rejected) expect(r.why).toMatch(/세 단어가 아니다/);
  });

  it("🔴 모르는 caseId · caseId 누락 · 중복을 **조용히 넘기지 않는다**", () => {
    const v = validateAiVerdictFile(
      [
        { caseId: "ZZZ", verdict: "SAME", model: "gpt" },
        { verdict: "SAME", model: "gpt" },
        { caseId: "B01", verdict: "SAME", model: "gpt" },
        { caseId: "B01", verdict: "DIFFERENT", model: "gpt" },
      ],
      ids,
    );
    expect(v.entries.map((e) => e.verdict)).toEqual(["SAME"]);
    expect(v.rejected.map((r) => r.why.replace(/:.*$/, ""))).toEqual([
      "benchmark 에 없는 caseId",
      "caseId 없음",
      "중복 (model=gpt)",
    ]);
  });

  it("🔴 빠진 케이스를 **채우지 않는다** — 누락을 그대로 보고한다", () => {
    const v = validateAiVerdictFile([{ caseId: "B01", verdict: "SAME", model: "gemini" }], ids);
    expect(v.missingByModel.gemini).toEqual(ids.filter((i) => i !== "B01"));
    expect(v.missingByModel.gemini).toHaveLength(13);
  });

  it("🔴 배열이 아니면 거부한다(파일이 깨졌을 때 0건으로 조용히 넘어가지 않는다)", () => {
    const v = validateAiVerdictFile({ caseId: "B01", verdict: "SAME" }, ids);
    expect(v.entries).toEqual([]);
    expect(v.rejected[0].why).toBe("최상위가 배열이 아니다");
  });

  it("🔴 UNCERTAIN 은 Precision/Recall 분자에 들어가지 않는다", () => {
    const k = kpiOf("t", [
      { caseId: "a", gt: "SAME", verdict: "UNCERTAIN" },
      { caseId: "b", gt: "SAME", verdict: "SAME" },
      { caseId: "c", gt: "DIFFERENT", verdict: "SAME" },
    ]);
    expect(k.precision).toBe("1/2");
    expect(k.recall).toBe("1/2");
    expect(k.accuracy).toBe("1/3");
    expect(k.falseSame).toEqual(["c"]);
    expect(k.uncertain).toEqual(["a"]);
  });
});

describe("WU-019A-EXT ② Benchmark 집계 (MI 는 019A 실측 결과를 읽는다 · HTTP 0)", () => {
  it("모델별 KPI · Agreement · 4분면 · 충돌 · Counterfactual 을 낸다", () => {
    if (!existsSync(MI_RESULT)) {
      console.log(`\n🔴 MI 실측 결과 없음: ${MI_RESULT} — WU-019A 를 MI_019A_LIVE=1 로 먼저 돌린다.`);
      expect(existsSync(MI_RESULT), "MI 결과 파일이 없으면 이 WU 는 측정이 아니다").toBe(false);
      return;
    }
    const miRows = (JSON.parse(readFileSync(MI_RESULT, "utf8")).rows as MiRow[]).filter((r) => r.factsStatus === "OK");
    const ids = CASES.map((c) => c.caseId);

    const aiAvailable = existsSync(AI_VERDICTS);
    const validation = aiAvailable
      ? validateAiVerdictFile(JSON.parse(readFileSync(AI_VERDICTS, "utf8")), ids)
      : { entries: [], rejected: [], models: [], missingByModel: {} as Record<string, string[]> };

    /* ── MI 축 (항상 가능) ──────────────────────────────────────────────── */
    const miKpi = kpiOf(
      "MI(strict)",
      miRows.map((r) => ({ caseId: r.caseId, gt: r.gt, verdict: r.miStrict as ThreeWay })),
    );
    const miByCase = new Map(miRows.map((r) => [r.caseId, r]));

    console.log(`\n══ WU-019A-EXT  N=${ids.length} (MI 분모 ${miRows.length} · facts OK)`);
    console.log(`  [GT] ${Object.entries(
      CASES.reduce<Record<string, number>>((a, c) => ({ ...a, [c.productType]: (a[c.productType] ?? 0) + 1 }), {}),
    ).map(([k, v]) => `${k} ${v}(N=${v})`).join(" · ")}`);
    console.log(
      `  [MI] Accuracy ${miKpi.accuracy} · Precision ${miKpi.precision} · Recall ${miKpi.recall} · False SAME ${
        miKpi.falseSame.join(",") || "없음"
      } · False DIFFERENT ${miKpi.falseDifferent.join(",") || "없음"}`,
    );

    const perModel: ModelKpi[] = [];
    const quadrants: Record<string, Record<string, string[]>> = {};
    const conflicts: Record<string, Record<string, string[]>> = {};
    const counterfactual: Record<string, Record<string, string>> = {};

    for (const model of validation.models) {
      const rows = validation.entries
        .filter((e) => e.model === model && miByCase.has(e.caseId))
        .map((e) => ({ caseId: e.caseId, verdict: e.verdict, gt: GT_OF[CASES.find((c) => c.caseId === e.caseId)!.productType] }));
      if (rows.length === 0) continue;
      const k = kpiOf(model, rows);
      perModel.push(k);

      /* §10 4분면 — 🔴 AI correct / MI correct 네 칸 */
      const q: Record<string, string[]> = { "AI✓MI✓": [], "AI✓MI✗": [], "AI✗MI✓": [], "AI✗MI✗": [] };
      const cf: Record<string, string[]> = {
        "AI SAME / MI DIFFERENT": [], "AI DIFFERENT / MI SAME": [],
        "AI UNCERTAIN / MI SAME": [], "AI UNCERTAIN / MI DIFFERENT": [],
      };
      for (const r of rows) {
        const mi = miByCase.get(r.caseId)!;
        const aiOk = (r.verdict === "SAME") === (r.gt === "SAME") && r.verdict !== "UNCERTAIN";
        const miOk = mi.miCorrect === true;
        q[`AI${aiOk ? "✓" : "✗"}MI${miOk ? "✓" : "✗"}`].push(r.caseId);
        const m = mi.miStrict;
        if (r.verdict === "SAME" && m === "DIFFERENT") cf["AI SAME / MI DIFFERENT"].push(r.caseId);
        if (r.verdict === "DIFFERENT" && m === "SAME") cf["AI DIFFERENT / MI SAME"].push(r.caseId);
        if (r.verdict === "UNCERTAIN" && m === "SAME") cf["AI UNCERTAIN / MI SAME"].push(r.caseId);
        if (r.verdict === "UNCERTAIN" && m === "DIFFERENT") cf["AI UNCERTAIN / MI DIFFERENT"].push(r.caseId);
      }
      quadrants[model] = q;
      conflicts[model] = cf;

      /* §12 counterfactual — 🔴 **계산만** 한다. 코드/정책에 반영하지 않는다. */
      const rule = (pick: (ai: ThreeWay, mi: ThreeWay) => ThreeWay): string => {
        const out = rows.map((r) => ({
          caseId: r.caseId, gt: r.gt, verdict: pick(r.verdict, miByCase.get(r.caseId)!.miStrict as ThreeWay),
        }));
        const k2 = kpiOf("rule", out);
        return `${k2.accuracy} (False SAME ${k2.falseSame.length})`;
      };
      counterfactual[model] = {
        "Rule A 둘 다 SAME 일 때만 SAME": rule((ai, mi) => (ai === "SAME" && mi === "SAME" ? "SAME" : "DIFFERENT")),
        "Rule B 하나라도 DIFFERENT 면 DIFFERENT": rule((ai, mi) =>
          ai === "DIFFERENT" || mi === "DIFFERENT" ? "DIFFERENT" : ai === "SAME" && mi === "SAME" ? "SAME" : "UNCERTAIN",
        ),
        "Rule C 다르면 UNCERTAIN": rule((ai, mi) => (ai === mi ? ai : "UNCERTAIN")),
      };

      console.log(
        `  [${model}] Accuracy ${k.accuracy} · Precision ${k.precision} · Recall ${k.recall} · False SAME ${
          k.falseSame.join(",") || "없음"
        } · False DIFFERENT ${k.falseDifferent.join(",") || "없음"} · UNCERTAIN ${k.uncertain.length}/${k.n}`,
      );
      console.log(`     4분면 ${JSON.stringify(q)}`);
      console.log(`     충돌  ${JSON.stringify(cf)}`);
      console.log(`     counterfactual ${JSON.stringify(counterfactual[model])}`);
    }

    /* §9 Agreement — 모델쌍 전부(🔴 Agreement ≠ Accuracy) */
    const agreements: Record<string, string> = {};
    const axes = [...validation.models, "MI(strict)"];
    for (let i = 0; i < axes.length; i += 1) {
      for (let j = i + 1; j < axes.length; j += 1) {
        const a = axes[i];
        const b = axes[j];
        const verdictOf = (axis: string, caseId: string): ThreeWay | null =>
          axis === "MI(strict)"
            ? (miByCase.get(caseId)?.miStrict ?? null)
            : (validation.entries.find((e) => e.model === axis && e.caseId === caseId)?.verdict ?? null);
        const both = ids.filter((c) => verdictOf(a, c) !== null && verdictOf(b, c) !== null);
        if (both.length === 0) continue;
        agreements[`${a} ↔ ${b}`] = `${both.filter((c) => verdictOf(a, c) === verdictOf(b, c)).length}/${both.length}`;
      }
    }
    console.log(`  [Agreement] ${Object.keys(agreements).length ? JSON.stringify(agreements) : "🔴 측정불가"}`);

    /* §11 B10 별도 보고 */
    const b10Mi = miByCase.get("B10");
    const b10Ai = validation.entries.filter((e) => e.caseId === "B10");
    console.log(
      `  [B10] GT=DIFFERENT · MI=${b10Mi?.miRaw}/${b10Mi?.miStrict}(${b10Mi?.miCorrect ? "정답" : "오판"}) · ` +
        (b10Ai.length ? b10Ai.map((e) => `${e.model}=${e.verdict}`).join(" · ") : "AI 🔴 측정불가"),
    );

    if (!aiAvailable) {
      console.log(
        `\n  🔴🔴 AI 축 **측정불가** — ${AI_VERDICTS} 없음.\n` +
          `     「AI 데이터가 없다」 ≠ 「AI 가 못 찾았다」. 0% 로 적지 않는다.\n` +
          `     🟢 수집표/프롬프트: docs/AI-VS-MI-IDENTITY-BENCHMARK-019A.md §10 · §10-B`,
      );
    }
    if (validation.rejected.length) console.log(`  🔴 거부된 입력 ${validation.rejected.length}건: ${JSON.stringify(validation.rejected)}`);
    for (const [m, miss] of Object.entries(validation.missingByModel)) {
      if (miss.length) console.log(`  🔴 ${m} 누락 ${miss.length}건: ${miss.join(",")} — **채우지 않았다**`);
    }

    writeFileSync(
      path.join(OUT_DIR, "mi-019a-ext-result.json"),
      JSON.stringify(
        { n: ids.length, miDenominator: miRows.length, mi: miKpi, perModel, agreements, quadrants, conflicts, counterfactual,
          aiAvailable, rejected: validation.rejected, missingByModel: validation.missingByModel },
        null,
        2,
      ),
      "utf8",
    );

    /* 🔴 MI 축은 항상 있어야 한다. AI 축은 없을 수 있고 그때는 **측정불가** 다. */
    expect(miKpi.n).toBeGreaterThan(0);
    expect(miKpi.falseSame).toEqual(["B10"]);
    if (!aiAvailable) expect(perModel).toEqual([]);
  });
});
