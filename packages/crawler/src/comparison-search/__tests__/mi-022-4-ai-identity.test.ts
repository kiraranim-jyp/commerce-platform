/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-022-4 — AI Identity 실측 · AI vs MI vs Combination
 * ════════════════════════════════════════════════════════════════════════════
 *
 * MI 축   `mi-022-result.json`      ← WU-022-3 이 **이미 실측해 남긴** 값(재측정 0 · HTTP 0)
 * GT 축   같은 파일 안의 `gt`        ← WU-022-3 GT 를 **그대로** 쓴다(수정 0)
 * AI 축   `mi-022-ai-verdicts.json` ← [{ searchId, candidateUrl, model, verdict }]
 *
 * 🔴 운영 코드 0 · MI 0 · threshold 0 · 색상사전 0 · PRESUMED_SAME 정책 0 ·
 *    ensemble production 0 · AI API 0 · 새 후보 0 · 새 normalizer 0 · HTTP **0**.
 * 🔴🔴 **AI verdict 를 MI 입력으로 넣지 않는다.** 두 축은 끝까지 독립이다.
 * 🔴🔴 **AI 산문을 사람이 SAME/DIFFERENT 로 재해석하지 않는다** — 세 단어가 아니면
 *      `AI_VERDICT_INVALID` 로 «기록» 한다(버리지 않는다 · 분모가 조용히 줄면 안 된다).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Gt, ThreeWay } from "./__fixtures__/mi-identity-benchmark";
import {
  AI_VERDICT_INVALID, axisKpi, combine, crossMatrix, quadrantOf,
  readAiVerdict, validateAiFile, verdictDistribution,
} from "./__fixtures__/mi-022-kpi";

const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const MI_RESULT = path.join(OUT_DIR, "mi-022-result.json");
const AI_FILE = path.join(OUT_DIR, "mi-022-ai-verdicts.json");

interface MiRow {
  searchId: string; model: string; candidateUrl: string; observedTitle: string | null;
  miRaw: string | null; miStrict: ThreeWay | null; miThreeWay: ThreeWay | null; gt: Gt;
}

/* ══ ① 계약 — AI 데이터 0 에서도 항상 돈다 ═══════════════════════════════════ */

describe("WU-022-4 ① AI verdict 검증기 (AI 0 · HTTP 0)", () => {
  it("🟢 세 단어만 받는다", () => {
    expect(readAiVerdict("SAME")).toBe("SAME");
    expect(readAiVerdict("  DIFFERENT  ")).toBe("DIFFERENT");
    expect(readAiVerdict("UNCERTAIN")).toBe("UNCERTAIN");
  });

  it("🔴🔴 confidence·산문·혼합은 **정규화하지 않는다** — 전부 INVALID", () => {
    for (const bad of ["SAME (0.95)", "동일상품입니다", "판정: 동일상품", "동일상품으로 보입니다", "SAME - confidence 0.9", "same", "", null, 1]) {
      expect(readAiVerdict(bad)).toBe(AI_VERDICT_INVALID);
    }
  });

  it("🔴 INVALID 를 **버리지 않고 기록** 한다 — 버리면 분모가 조용히 줄어든다", () => {
    const keys = new Set(["S1::u1", "S1::u2"]);
    const v = validateAiFile(
      [
        { searchId: "S1", candidateUrl: "u1", model: "m", verdict: "SAME" },
        { searchId: "S1", candidateUrl: "u2", model: "m", verdict: "판정: 동일상품" },
      ],
      keys,
    );
    expect(v.entries).toHaveLength(2);
    expect(v.invalid).toHaveLength(1);
    expect(v.invalid[0]!.raw).toContain("판정");
  });

  it("🔴 모르는 후보 · 중복 · 비배열을 거부한다", () => {
    const keys = new Set(["S1::u1"]);
    const v = validateAiFile(
      [
        { searchId: "S1", candidateUrl: "zzz", model: "m", verdict: "SAME" },
        { searchId: "S1", candidateUrl: "u1", model: "m", verdict: "SAME" },
        { searchId: "S1", candidateUrl: "u1", model: "m", verdict: "DIFFERENT" },
      ],
      keys,
    );
    expect(v.entries).toHaveLength(1);
    expect(v.rejected).toHaveLength(2);
    expect(validateAiFile({ x: 1 }, keys).rejected[0]!.reason).toContain("배열이 아니다");
  });

  it("🟢 model 이 없으면 UNSPECIFIED 로 «표시» 한다 — 합치지 않는다", () => {
    const v = validateAiFile([{ searchId: "S1", candidateUrl: "u1", verdict: "SAME" }], new Set(["S1::u1"]));
    expect(v.models).toEqual(["UNSPECIFIED"]);
  });
});

describe("WU-022-4 ② 집계 축 (AI 0 · HTTP 0)", () => {
  it("🔴 분모가 0 이면 **0 이 아니라 N/A(null)** 다", () => {
    const k = axisKpi([]);
    expect(k.accuracy).toBeNull();
    expect(k.precisionSame).toBeNull();
    expect(k.n).toBe(0);
  });

  it("🟢 분포는 INVALID 를 **별도 칸**으로 센다", () => {
    const d = verdictDistribution(["SAME", "SAME", "UNCERTAIN", AI_VERDICT_INVALID]);
    expect(d).toEqual({ SAME: 2, DIFFERENT: 0, UNCERTAIN: 1, [AI_VERDICT_INVALID]: 1 });
  });

  it("🔴 3×3 로 센다 — 2×2 로 접으면 UNCERTAIN 이 숨는다", () => {
    const m = crossMatrix([
      { ai: "SAME", mi: "SAME" },
      { ai: "DIFFERENT", mi: "SAME" },
      { ai: "UNCERTAIN", mi: "SAME" },
    ]);
    expect(m.AI_UNCERTAIN__MI_SAME).toBe(1);
    expect(Object.keys(m)).toHaveLength(3);
  });

  it("🟢 Combination 은 **둘 다 같을 때만** 확정한다(그 외 UNCERTAIN)", () => {
    expect(combine("SAME", "SAME")).toBe("SAME");
    expect(combine("DIFFERENT", "DIFFERENT")).toBe("DIFFERENT");
    expect(combine("SAME", "DIFFERENT")).toBe("UNCERTAIN");
    expect(combine("SAME", "UNCERTAIN")).toBe("UNCERTAIN");
    expect(combine("UNCERTAIN", "UNCERTAIN")).toBe("UNCERTAIN");
  });

  it("🔴🔴 Combination 은 **평가용** 이다 — 운영 정책 함수가 아니다(입력이 두 verdict 뿐)", () => {
    /* 🔴 상품·가격·threshold 를 받지 않는다. 받게 되는 순간 그것은 정책이다. */
    expect(combine.length).toBe(2);
  });
});

/* ══ ③ 집계 — MI 결과는 있고 AI 파일이 있으면 비교까지 간다 ══════════════════ */

describe("WU-022-4 ③ AI vs MI vs Combination (HTTP 0)", () => {
  it("AI 파일이 있으면 KPI 를 내고, 없으면 **측정불가**로 끝낸다", () => {
    if (!existsSync(MI_RESULT)) {
      console.log(`\n🔴 MI 결과 없음(${MI_RESULT}) — WU-022-3 을 먼저 돌린다.`);
      expect(existsSync(MI_RESULT)).toBe(false);
      return;
    }
    const rows = (JSON.parse(readFileSync(MI_RESULT, "utf8")) as { rows: MiRow[] }).rows;
    /* 🔴 AI 에게 물어야 할 «고유» 후보 — (searchId, url) 기준. 모델 행 중복을 분모로 쓰지 않는다. */
    const uniq = new Map<string, MiRow>();
    for (const r of rows) uniq.set(`${r.searchId}::${r.candidateUrl}`, r);
    const keys = new Set(uniq.keys());

    if (!existsSync(AI_FILE)) {
      console.log(
        `\n🔴🔴 **AI Identity 측정불가** — ${AI_FILE} 없음.\n` +
          `   🔴 「AI 가 틀렸다」·「0%」가 아니다. 아직 수집하지 않았다.\n` +
          `   🟢 수집 대상 고유 후보 **${keys.size}건** (GT SAME ${[...uniq.values()].filter((r) => r.gt === "SAME").length} ·` +
          ` DIFFERENT ${[...uniq.values()].filter((r) => r.gt === "DIFFERENT").length})\n` +
          `   🟢 규격: docs/AI-IDENTITY-COLLECTION-PACKET-022-4.md`,
      );
      expect(existsSync(AI_FILE)).toBe(false);
      return;
    }

    const av = validateAiFile(JSON.parse(readFileSync(AI_FILE, "utf8")), keys);
    const out: Record<string, unknown> = {
      uniqueCandidates: keys.size,
      aiRejected: av.rejected,
      aiInvalid: av.invalid,
      models: av.models,
    };

    /* ── MI 축(WU-022-3 과 같은 기준 · 고유 후보 단위로 다시 센다) ───────────── */
    const u = [...uniq.values()];
    out.miStrict = axisKpi(u.map((r) => ({ gt: r.gt, call: r.miStrict })));
    out.miThreeWay = axisKpi(u.map((r) => ({ gt: r.gt, call: r.miThreeWay })));

    const perModel: Record<string, unknown> = {};
    for (const model of av.models) {
      const mine = av.entries.filter((e) => e.model === model);
      const joined = mine
        .map((e) => ({ e, r: uniq.get(`${e.searchId}::${e.candidateUrl}`)! }))
        .filter((x) => x.r != null);
      const valid = joined.filter((x) => x.e.verdict !== AI_VERDICT_INVALID) as {
        e: { verdict: ThreeWay }; r: MiRow;
      }[];
      const aiRows = valid.map((x) => ({ gt: x.r.gt, call: x.e.verdict }));

      /* 🔴 AI↔MI 비교는 **MI 의 어느 축과** 비교하는지 밝힌다. 둘 다 낸다. */
      const vsStrict = valid.filter((x) => x.r.miStrict != null).map((x) => ({ gt: x.r.gt, ai: x.e.verdict, mi: x.r.miStrict! }));
      const vsThree = valid.filter((x) => x.r.miThreeWay != null).map((x) => ({ gt: x.r.gt, ai: x.e.verdict, mi: x.r.miThreeWay! }));

      perModel[model] = {
        collected: mine.length,
        invalid: mine.filter((e) => e.verdict === AI_VERDICT_INVALID).length,
        distribution: verdictDistribution(mine.map((e) => e.verdict)),
        ai: axisKpi(aiRows),
        vsStrict: { matrix: crossMatrix(vsStrict), quadrant: quadrantOf(vsStrict) },
        vsThreeWay: { matrix: crossMatrix(vsThree), quadrant: quadrantOf(vsThree) },
        combinationVsStrict: axisKpi(vsStrict.map((x) => ({ gt: x.gt, call: combine(x.ai, x.mi) }))),
        combinationVsThreeWay: axisKpi(vsThree.map((x) => ({ gt: x.gt, call: combine(x.ai, x.mi) }))),
        /* ── 지시서 §7 의 핵심 질문 넷 ─────────────────────────────────────── */
        Q1_AI_catches_MI_falseSame: vsStrict
          .filter((x) => x.gt === "DIFFERENT" && x.mi === "SAME")
          .map((x) => ({ ai: x.ai, caught: x.ai === "DIFFERENT" })),
        Q2_AI_finds_MI_missedSame: vsStrict
          .filter((x) => x.gt === "SAME" && x.mi !== "SAME")
          .map((x) => ({ ai: x.ai, found: x.ai === "SAME" })),
        Q3_AI_color_failure_S4: valid
          .filter((x) => x.r.searchId === "S4" && x.r.gt === "DIFFERENT")
          .map((x) => ({ title: (x.r.observedTitle ?? "").slice(0, 40), ai: x.e.verdict, mi: x.r.miRaw })),
      };
    }
    out.perModel = perModel;
    console.log(JSON.stringify(out, null, 2));
    writeFileSync(path.join(OUT_DIR, "mi-022-4-result.json"), JSON.stringify(out, null, 2), "utf8");
    expect(av.models.length).toBeGreaterThan(0);
  });
});
