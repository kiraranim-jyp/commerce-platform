/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **KIDS MI 통합 안정화 «진입 가능성» 판정**(평가 전용 · HTTP 0 · 운영 변경 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 같은 평가를 **반복하지 않는다**(CPO 명시) — ③ 흐름 검증과 로드맵 ② 식별 전략
 *    검증은 끝났다. 이 WU 는 그 산출물을 **읽어** 진입 여부만 판정한다.
 *
 * 🔴🔴 **진입 기준을 «먼저» 적고 그 다음에 채운다** — 결과를 보고 기준을 고르면
 *    그것은 사후 합리화다. 기준은 **새로 만든 것이 아니라** 이미 CPO 가 고정해 둔
 *    원칙에서 가져왔다(동결 유지 · 검증불가를 0 으로 쓰지 않음 · 거부 레버 유지 ·
 *    Production 확인은 별도 축 · 가격은 FROZEN).
 */
import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const HERE = path.join(process.cwd(), "src", "app", "api", "price-history", "_lib", "__tests__");
const P = (f: string) => path.join(HERE, "preserved", f);
const read = (f: string) => JSON.parse(readFileSync(P(f), "utf8"));
const OUT = P("kids-mi-stabilization-entry.json");

/**
 * 🔴 **여덟 기준** — 충족/미충족을 **같은 자리에서** 센다. 🔴 미충족을 「작다」로
 *    희석하거나 「대체로 충족」으로 뭉개지 않는다.
 */
type Gate = {
  id: string;
  requirement: string;
  met: boolean;
  evidence: string;
  /** 🔴 **누가 열 수 있는가** — CTO 범위 밖이면 「노력 부족」이 아니다. */
  owner: "CTO" | "CPO" | "CEO" | "FROZEN_BY_POLICY";
};

describe("KIDS MI 통합 안정화 — 진입 가능성 판정(기존 결과 재사용)", () => {
  it("E-0 🔴 판정에 쓰는 산출물 **다섯** 이 전부 실재한다", () => {
    for (const f of [
      "kids-flow-verification.json",
      "kids-identity-strategy-stabilization.json",
      "a-identity-axis.json",
      "gt-latest-recount.json",
      "a11-fulltext-axes-boosted.json",
    ]) {
      expect(() => read(f), `🔴 ${f} 가 없으면 그 축을 「검증됐다」고 적을 수 없다`).not.toThrow();
    }
  });

  it("E-1 🔵 여덟 기준으로 진입 여부를 판정하고 산출물을 남긴다", () => {
    const flow = read("kids-flow-verification.json") as {
      stages: { stage: string; status: string; verified: string; unverifiable: string }[];
      denominatorAxes: Record<string, unknown>;
      staleGtExposure: Record<string, unknown>;
      unconnectedEvidence: Record<string, unknown>;
    };
    const strat = read("kids-identity-strategy-stabilization.json") as {
      strategy: Record<string, unknown>;
      rejectedLeversStillClosed: { count: number; guardsPresent: boolean };
      stabilizable: string[];
      needsMoreEvidence: string[];
    };
    const a = read("a-identity-axis.json") as {
      denominator: { identityAxisPairs: number; humanGtLabeled: number };
      baselineVerdict: Record<string, number>;
      leverSafety: Record<string, { opensGtDifferent: number }>;
    };
    const recount = read("gt-latest-recount.json") as {
      a: { latest: { riskCodeMatchButHumanDifferent: number } };
    };
    const boosted = read("a11-fulltext-axes-boosted.json") as {
      denominator: { total: number };
      gtLatest: { labelSource: Record<string, number> };
    };

    const stageStatus = Object.fromEntries(flow.stages.map((s) => [s.stage, s.status]));
    const priceStage = flow.stages.find((s) => s.stage.startsWith("⑤"));
    const notReproduced = a.baselineVerdict.BASELINE_NOT_REPRODUCED ?? 0;
    const latestLabeled = boosted.gtLatest.labelSource.CEO_LATEST ?? 0;

    const gates: Gate[] = [
      {
        id: "G1 단계별 상태와 «검증불가» 가 빈칸이 아니다",
        requirement: "다섯 단계 전부 상태와 한계를 들고 있다",
        met: flow.stages.length === 5 && flow.stages.every((s) => s.unverifiable.length > 0),
        evidence: `단계 ${flow.stages.length} · 한계 기록 전건`,
        owner: "CTO",
      },
      {
        id: "G2 거부 레버가 닫혀 있다",
        requirement: "거부 레버마다 소유자 계약이 실재한다",
        met: strat.rejectedLeversStillClosed.count === 8 && strat.rejectedLeversStillClosed.guardsPresent,
        evidence: `레버 ${strat.rejectedLeversStillClosed.count}종 · 소유자 계약 실재`,
        owner: "CTO",
      },
      {
        id: "G3 식별 전략이 숫자로 고정됐다",
        requirement: "축·문턱·blocker 의미가 계약으로 잠겼다",
        met:
          strat.strategy.sameMinAxes === 5 &&
          strat.strategy.presumedSameMinAxes === 3 &&
          Array.isArray(strat.strategy.axes) &&
          (strat.strategy.axes as string[]).length === 9,
        evidence: "축 9 · 문턱 5/3 · 「모른다 ↔ 달랐다」 집합 분리",
        owner: "CTO",
      },
      {
        id: "G4 안전성 기준이 완화되지 않았다",
        requirement: "상세설명 품번 레버의 거부 근거가 최신 GT 에서도 살아 있다",
        met: a.leverSafety.leverCodeOnlyInDescription.opensGtDifferent > 0,
        evidence: `opensGtDifferent ${a.leverSafety.leverCodeOnlyInDescription.opensGtDifferent} · 거부 유지`,
        owner: "CTO",
      },
      {
        id: "G5 🔴 Production 에서 전략의 실제 verdict 분포가 확인됐다",
        requirement: "운영 경로가 내는 판정 분포를 관측했다",
        /** 🔴 **구조적으로 불가** 하다 — 운영 로그는 라이브 테일이고 화면은 로그인 뒤다. */
        met: false,
        evidence:
          "🔴 미검증 — `vercel logs` 는 라이브 테일이고 계측은 셀러가 재분석을 눌러야 찍힌다. " +
          "실제 따져 화면은 CTO 가 볼 수 없다",
        owner: "CEO",
      },
      {
        id: "G6 🔴 가격 비교 단계가 측정됐다",
        requirement: "⑤ 단계가 측정 상태다",
        /** 🔴 **의도적 동결** 이다 — 「노력 부족」이 아니다. */
        met: priceStage?.status !== "FROZEN_NOT_MEASURED",
        evidence: `⑤ 상태 = ${priceStage?.status} — 🔴 CPO 가 유지를 지시한 동결이다`,
        owner: "FROZEN_BY_POLICY",
      },
      {
        id: "G7 🔴 GT 라벨 분모가 안전성 판정을 지지한다",
        requirement: "식별축·양쪽원문 분모에서 최신 라벨이 충분하다",
        met: false,
        evidence:
          `식별축 ${a.denominator.identityAxisPairs} 중 라벨 ${a.denominator.humanGtLabeled} · ` +
          `양쪽원문 ${boosted.denominator.total} 중 **최신 라벨 ${latestLabeled}** ` +
          "⟹ 🔴 「작다」를 비율로 희석하지 않는다",
        owner: "CEO",
      },
      {
        id: "G8 🔴 baseline 재현이 전건이다",
        requirement: "식별축 분모에 재현 실패가 없다",
        met: notReproduced === 0,
        evidence: `BASELINE_NOT_REPRODUCED ${notReproduced}쌍 ⟹ 그 쌍의 축 수치는 「운영이 지금 그 값을 낸다」로 쓸 수 없다`,
        owner: "CTO",
      },
    ];

    const met = gates.filter((g) => g.met);
    const unmet = gates.filter((g) => !g.met);

    const out = {
      note:
        "🔴 평가 전용 — 운영 변경 0 · HTTP 0 · verdict 재계산 0 · 새 WU 0. " +
        "🔴 **진입 기준을 먼저 적고 채웠다**(사후 합리화 금지). " +
        "🔴 기준은 새로 만든 것이 아니라 CPO 가 고정한 원칙에서 가져왔다.",
      /* ① 검증된 경로 ↔ 미검증 경로 **최종 분리** */
      pathSeparation: {
        verified: flow.stages.filter((s) => s.status === "VERIFIED").map((s) => s.stage),
        partial: flow.stages.filter((s) => s.status === "PARTIAL").map((s) => s.stage),
        frozenNotMeasured: flow.stages.filter((s) => s.status === "FROZEN_NOT_MEASURED").map((s) => s.stage),
        stageStatus,
        note: "🔴 PARTIAL 을 「검증됨」으로 올리지 않는다 — 각 단계가 한계를 들고 있다",
      },
      /* ② Production 에서 확인되지 않은 것 — 🔴 명시한다 */
      notConfirmedInProduction: [
        "🔴 전략이 실제로 내는 verdict 분포(SAME/PRESUMED_SAME/SIMILAR/UNKNOWN/CONFLICT)",
        "🔴 수집 실패 사유(`failureReason`)의 **운영 발화** — 계약·대역으로만 증명됐다",
        "🔴 셀러 화면에 그 결과가 보이는 모양 — 실제 따져 화면은 CTO 가 볼 수 없다",
        "🔴 가격 비교 단계의 운영 산출 — ⑤ 가 FROZEN_NOT_MEASURED 다",
      ],
      /* ③ 가격 단계 상태 유지 확인 */
      priceStage: {
        status: priceStage?.status ?? null,
        maintained: priceStage?.status === "FROZEN_NOT_MEASURED",
        note: "🔴 이 WU 는 ⑤ 를 **열지 않았다** — 성공도 실패도 아닌 **미측정** 으로 유지한다",
      },
      /* ④ 판정 */
      entryGates: gates,
      entryVerdict: {
        met: met.length,
        unmet: unmet.length,
        decision: unmet.length === 0 ? "ENTER" : "CANNOT_ENTER_YET",
        unmetByOwner: Object.fromEntries(
          (["CTO", "CPO", "CEO", "FROZEN_BY_POLICY"] as const).map((o) => [
            o,
            unmet.filter((g) => g.owner === o).map((g) => g.id),
          ]),
        ),
        note:
          "🔴 **「대체로 충족」을 진입으로 읽지 않는다.** 미충족이 하나라도 있으면 진입하지 않는다 — " +
          "그것이 이 트랙이 여덟 축에서 배운 방식이다(완화하면 반드시 대가가 따라온다).",
      },
      /* ⑤ 부족한 증거와 선행 조건 */
      prerequisites: [
        {
          need: "운영 verdict 분포 관측",
          owner: "CEO",
          how: "🟡 CEO 가 실제 상품에서 「새 분석」을 **1회** 수행하고 그 화면/응답을 전달한다",
          ctoCanOpen: false,
        },
        {
          need: "수집 실패 사유의 운영 발화 확인",
          owner: "CEO",
          how: "🟡 위와 같은 1회 수행에서 같이 확인된다(추가 작업 없음)",
          ctoCanOpen: false,
        },
        {
          need: "GT 라벨 보강",
          owner: "CEO",
          how: "🟡 CEO 육안 판정 추가 — 🔴 CTO 가 라벨을 만들 수 없다(기준 truth 는 CEO 다)",
          ctoCanOpen: false,
        },
        {
          need: "baseline 재현 실패 5쌍의 원인 구분",
          owner: "CTO",
          how: "🟢 기존 하니스로 **재조사 없이** 가를 수 있다 — 🔴 단 CPO 가 범위를 지정해야 한다",
          ctoCanOpen: true,
        },
        {
          need: "가격 비교 단계",
          owner: "FROZEN_BY_POLICY",
          how: "🔴 **동결 유지** — 이 WU 가 열지 않는다(CPO 지시)",
          ctoCanOpen: false,
        },
      ],
      carriedOverFindings: {
        denominatorAxes: flow.denominatorAxes,
        staleGtExposure: flow.staleGtExposure,
        unconnectedEvidence: flow.unconnectedEvidence,
        riskCodeMatchButHumanDifferent_identityAxis26_latest: recount.a.latest.riskCodeMatchButHumanDifferent,
        stabilizable: strat.stabilizable.length,
        needsMoreEvidence: strat.needsMoreEvidence.length,
      },
    };
    writeFileSync(OUT, JSON.stringify(out, null, 2));

    /** 🔴 네 기준이 미충족이고 **그중 셋은 CTO 범위 밖** 이다 — 「노력 부족」이 아니다. */
    expect(out.entryVerdict.decision).toBe("CANNOT_ENTER_YET");
    expect(out.entryVerdict.met + out.entryVerdict.unmet).toBe(8);
    /** 🟢 가격 단계는 **열지 않았다**. */
    expect(out.priceStage.maintained).toBe(true);
    /** 🔴 선행 조건마다 **누가 열 수 있는지** 가 적혀 있다(빈칸 금지). */
    expect(out.prerequisites.every((p) => p.owner.length > 0 && p.how.length > 0)).toBe(true);
    /** 🟢 CTO 가 열 수 있는 선행 조건은 **하나** 다 — 과장하지 않는다. */
    expect(out.prerequisites.filter((p) => p.ctoCanOpen)).toHaveLength(1);
  });

  it("E-2 🔴🔴 진입 기준을 **사후에 느슨하게** 바꾸지 않는다", () => {
    const o = read("kids-mi-stabilization-entry.json") as { entryGates: Gate[] };
    expect(o.entryGates, "🔴 기준 수가 바뀌면 그것은 **정책 변경** 이다").toHaveLength(8);
    /** 🔴 미충족 기준이 「충족」으로 뒤집히는 날은 **증거가 생긴 날** 이어야 한다. */
    const unmetIds = o.entryGates.filter((g) => !g.met).map((g) => g.id);
    expect(unmetIds.some((id) => id.includes("Production"))).toBe(true);
    expect(unmetIds.some((id) => id.includes("가격"))).toBe(true);
  });

  it("E-3 🔴 이 WU 가 **운영·동결 경계를 넘지 않았다**", () => {
    const self = readFileSync(path.join(HERE, "kids-mi-stabilization-entry.test.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ");
    for (const token of [
      ["judgeDomestic", "Candidate"],
      ["fetchPlain", "Html"],
      ["DATABASE", "_URL"],
      ["brandModelCode", " ="],
      ["SAME", "_MIN_AXES ="],
    ].map(([a, b]) => `${a}${b}`)) {
      expect(self, `🔴 ${token} — 판정 WU 가 경계를 넘었다`).not.toContain(token);
    }
    /** 🟢 쓰기 대상이 **새 파일** 하나임을 못 박는다. */
    expect(self).toContain('P("kids-mi-stabilization-entry.json")');
  });
});
