/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 A 과제 — **상품 식별 정확도 평가**(네트워크 0 · 운영 변경 0 · 판정 재계산 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 분모는 **C 가 가른 `IDENTITY_AXIS` 26쌍 · 9 호스트** 다(CPO 지정). 「후보 품질
 *    부족」과 구별되는 **식별 문제** 집합이고, 그 밖의 83쌍(품번 공백)은 **분모가 아니다**.
 *
 * 🔴🔴 **새 수집·새 조사 0** — 전부 기존 산출물을 **조인** 한다:
 * ```
 * preserved/c-candidate-quality.json       분모(bucket === IDENTITY_AXIS)
 * docs/MI-KIDS-CODE-NAME-CAUSES.json       축 상태 + **원인 코드**(code.cause · name.cause)
 * docs/MI-KIDS-TRIAGE-FEASIBILITY.json     axesAfter(brand · code · name)
 * docs/MI-B16-FULLTEXT-EXTRACTION.json     B군 전문 축(🔴 **다른 분모 16** · 합산 금지)
 * preserved/a07-both-fulltext-axes.json    A군 전문 축(🔴 **다른 분모 7** · 합산 금지)
 * ```
 *
 * 🔴 **UNKNOWN 을 오판으로 취급하지 않는다**(CPO 명시) — 「모른다」와 「틀렸다」는 다르다.
 * 🔴 **금지** — 품번 승격 재제안 · SAME 기준 완화 · 상세설명만으로 DIFFERENT→SAME ·
 *    verdict 재계산 · 접근 우회 · 사이트 전용 어댑터 · DB · 운영 배선.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const HERE = path.join(process.cwd(), "src", "app", "api", "price-history", "_lib", "__tests__");
const ROOT = path.join(process.cwd(), "..", "..");
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));

type CRow = { candidateUrl: string; candidateDomain: string; humanGt: string | null; bucket: string };
type CauseRow = {
  candidateUrl: string;
  humanGt: string | null;
  baselineSystemVerdict: string | null;
  axisModelCode: string | null;
  axisProductName: string | null;
  brandAxis: string | null;
  code: {
    cause: string;
    approvedInTitle: string[];
    approvedInDescription: string[];
    prefixlessObservedTitle: string[];
    prefixlessObservedDescription: string[];
    confirmedByOperationalOwner: string | null;
  } | null;
  name: { cause: string; originHasKo?: boolean; candidateHasKo?: boolean } | null;
};

const tally = (xs: (string | null)[]) =>
  xs.reduce<Record<string, number>>((a, x) => ({ ...a, [x ?? "ABSENT"]: (a[x ?? "ABSENT"] ?? 0) + 1 }), {});

const denom = (): CRow[] =>
  (read(path.join(HERE, "preserved", "c-candidate-quality.json")) as { rows: CRow[] }).rows.filter(
    (r) => r.bucket === "IDENTITY_AXIS",
  );

describe("A 과제 — 식별 축 평가(기존 실측 재사용 · HTTP 0)", () => {
  it("A-0 🔴 분모가 **C 산출물 그대로** 다(26쌍 · 9 호스트 · 임의 합산 0)", () => {
    const d = denom();
    expect(d).toHaveLength(26);
    expect(new Set(d.map((r) => r.candidateDomain)).size).toBe(9);
    /** 🔴 다른 분모를 **합치지 않는다** — 존재만 확인하고 숫자를 섞지 않는다. */
    const b16 = read(path.join(ROOT, "docs", "MI-B16-FULLTEXT-EXTRACTION.json")) as {
      denominator: Record<string, number>;
    };
    const a07 = read(path.join(HERE, "preserved", "a07-both-fulltext-axes.json")) as {
      denominator: Record<string, number>;
    };
    expect(b16.denominator.gtAndBothFullText).toBe(16);
    expect(a07.denominator.bothFullText).toBe(7);
  });

  it("A-1 🔵 축별 MATCH / MISMATCH / UNKNOWN 을 **분리** 하고 산출물을 남긴다", () => {
    const d = denom();
    const causes = read(path.join(ROOT, "docs", "MI-KIDS-CODE-NAME-CAUSES.json")) as { rows: CauseRow[] };
    const feas = read(path.join(ROOT, "docs", "MI-KIDS-TRIAGE-FEASIBILITY.json")) as {
      rows: { candidateUrl: string; axesAfter: Record<string, string> | null }[];
    };
    const byCause = new Map(causes.rows.map((r) => [r.candidateUrl, r]));
    const byFeas = new Map(feas.rows.map((r) => [r.candidateUrl, r]));

    const rows = d.map((r) => {
      const c = byCause.get(r.candidateUrl);
      const f = byFeas.get(r.candidateUrl);
      /**
       * 🟡 **레버 후보 둘** — 둘 다 **기존 금지축** 이고 여기서 «구현하지 않는다».
       *    재는 이유는 하나다 — 「반복되는가」와 「GT DIFFERENT 를 같이 여는가」.
       */
      const codeOnlyInDescription =
        (c?.code?.approvedInDescription?.length ?? 0) > 0 &&
        (c?.code?.approvedInTitle?.length ?? 0) === 0;
      const prefixlessOnly =
        (c?.code?.prefixlessObservedTitle?.length ?? 0) +
          (c?.code?.prefixlessObservedDescription?.length ?? 0) >
          0 &&
        (c?.code?.approvedInTitle?.length ?? 0) + (c?.code?.approvedInDescription?.length ?? 0) === 0;
      return {
        candidateDomain: r.candidateDomain,
        candidateUrl: r.candidateUrl,
        humanGt: r.humanGt ?? null,
        baselineSystemVerdict: c?.baselineSystemVerdict ?? null,
        axisModelCode: c?.axisModelCode ?? null,
        axisProductName: c?.axisProductName ?? null,
        brandAxis: c?.brandAxis ?? null,
        axesAfter: f?.axesAfter ?? null,
        codeCause: c?.code?.cause ?? null,
        nameCause: c?.name?.cause ?? null,
        /** 🟢 운영 확인 축이 실제로 품번을 잡았는가(지어내지 않는다). */
        confirmedByOperationalOwner: Boolean(c?.code?.confirmedByOperationalOwner),
        scriptDifference: Boolean(c?.name?.originHasKo) !== Boolean(c?.name?.candidateHasKo),
        leverCodeOnlyInDescription: codeOnlyInDescription,
        leverPrefixlessCode: prefixlessOnly,
      };
    });

    const gt = (g: string) => rows.filter((r) => r.humanGt === g);
    const axisByGt = Object.fromEntries(
      ["SAME", "DIFFERENT", "SIMILAR"].map((g) => [
        g,
        {
          n: gt(g).length,
          modelCode: tally(gt(g).map((r) => r.axisModelCode)),
          productName: tally(gt(g).map((r) => r.axisProductName)),
          brand: tally(gt(g).map((r) => r.brandAxis)),
          codeCause: tally(gt(g).map((r) => r.codeCause)),
          nameCause: tally(gt(g).map((r) => r.nameCause)),
        },
      ]),
    );

    /**
     * 🔴🔴 **레버 안전성은 「GT DIFFERENT 를 같이 여는가」로만 판정한다.**
     *    여는 쌍이 하나라도 있으면 그 레버는 **SAME 안전 기준을 훼손** 한다.
     */
    const leverSafety = Object.fromEntries(
      (["leverCodeOnlyInDescription", "leverPrefixlessCode"] as const).map((k) => {
        const hit = rows.filter((r) => r[k]);
        return [
          k,
          {
            pairs: hit.length,
            hosts: new Set(hit.map((r) => r.candidateDomain)).size,
            gt: tally(hit.map((r) => r.humanGt)),
            opensGtDifferent: hit.filter((r) => r.humanGt === "DIFFERENT").length,
          },
        ];
      }),
    );

    const out = {
      note:
        "🔴 평가 전용 · 운영 변경 0 · HTTP 0 · verdict 재계산 0. " +
        "🔴 분모는 C 가 가른 IDENTITY_AXIS 26쌍이며 109·16·7 과 **합산하지 않는다**. " +
        "🔴 UNKNOWN 은 「모른다」이고 오판이 아니다.",
      denominator: {
        identityAxisPairs: rows.length,
        hosts: new Set(rows.map((r) => r.candidateDomain)).size,
        humanGtLabeled: rows.filter((r) => r.humanGt).length,
        unlabeled: rows.filter((r) => !r.humanGt).length,
        otherDenominatorsNotMerged: { bGroupPairs: 109, b16FullText: 16, aGroupFullText: 7 },
      },
      axisTally: {
        modelCode: tally(rows.map((r) => r.axisModelCode)),
        productName: tally(rows.map((r) => r.axisProductName)),
        brand: tally(rows.map((r) => r.brandAxis)),
      },
      causeTally: {
        code: tally(rows.map((r) => r.codeCause)),
        name: tally(rows.map((r) => r.nameCause)),
      },
      baselineVerdict: tally(rows.map((r) => r.baselineSystemVerdict)),
      axisByGt,
      leverSafety,
      /**
       * 🔴🔴 **닫힌 레버를 산출물이 «들고» 있게 한다** — 다음 세션이 같은 것을 다시
       *    제안하지 않도록. 🟢 숫자는 **이미 측정된 것** 이고 여기서 재측정하지 않는다.
       */
      closedLevers: {
        titleTokenPromotion:
          "REJECT(기존) — 제목 토큰을 후보 brandModelCode 로 승격하면 판매처 SKU 가 같이 " +
          "올라가 false SAME. 되돌린 커밋 32a0f374 · 재시도 방지 계약 11건",
        codeOnlyInDescription:
          "REJECT(이번 측정) — 20쌍 · 4 호스트인데 GT DIFFERENT **2건을 같이 연다**",
        prefixlessCode: "해당 없음 — 이 분모에 **0쌍**(관측값 0 · 측정불가가 아니다)",
        originSideRecovery: (() => {
          const f = read(path.join(ROOT, "docs", "MI-KIDS-TRIAGE-FEASIBILITY.json")) as {
            answer: Record<string, number>;
            originRecoveryEffect: Record<string, unknown>;
            tallyBefore: Record<string, number>;
            tallyAfter: Record<string, number>;
          };
          return {
            verdict: "효과 0 — **이미 측정됐다**(재조사 금지)",
            gainedByExistingDetailRecovery: f.answer.gainedByExistingDetailRecovery,
            titleFilledFromDb: f.originRecoveryEffect.titleFilledFromDb,
            unchanged: JSON.stringify(f.tallyBefore) === JSON.stringify(f.tallyAfter),
            note:
              "🔴 그래서 `ORIGIN_TITLE_ABSENT` 를 **제품 결함으로 적지 않는다** — " +
              "그 공백은 **하니스 입력** 기준이고 운영 DB 에는 27/27 있다",
          };
        })(),
      },
      confirmedByOperationalOwner: rows.filter((r) => r.confirmedByOperationalOwner).length,
      scriptDifferencePairs: rows.filter((r) => r.scriptDifference).length,
      rows,
    };
    writeFileSync(path.join(HERE, "preserved", "a-identity-axis.json"), JSON.stringify(out, null, 2));

    /** 🟢 한 쌍도 사라지지 않는다. */
    expect(rows).toHaveLength(26);
    expect(
      Object.values(out.axisTally.modelCode).reduce((a, n) => a + n, 0),
      "🔴 축 집계가 분모와 다르다",
    ).toBe(26);
  });

  /**
   * 🔴🔴🔴 **이 단언이 A 의 결론을 «기계로» 잠근다.**
   *    상세설명 품번 레버가 **GT DIFFERENT 를 하나라도 열면** 그 레버는 SAME 안전
   *    기준을 훼손한다 ⟹ 승격 금지. 🟢 나중에 분모가 커져 0 이 되면 이 단언이
   *    **FAIL 로 뒤집히고** 그때 CPO 가 다시 판정한다(조용히 바뀌지 않는다).
   */
  it("A-5 🔴🔴 상세설명 품번 레버는 **GT DIFFERENT 를 같이 연다** ⟹ 승격 금지", () => {
    const out = read(path.join(HERE, "preserved", "a-identity-axis.json")) as {
      leverSafety: Record<string, { pairs: number; hosts: number; opensGtDifferent: number }>;
    };
    const lever = out.leverSafety.leverCodeOnlyInDescription;
    expect(lever.pairs, "🟡 반복은 확정이다(여러 호스트)").toBeGreaterThan(1);
    expect(lever.hosts).toBeGreaterThan(1);
    expect(
      lever.opensGtDifferent,
      "🔴 이 값이 0 이 되면 **승격 재검토 사안** 이다 — 조용히 넘기지 않는다",
    ).toBeGreaterThan(0);
    /** 🟢 선행문자 없는 품번 레버는 이 분모에 **없다**(0 은 관측값이다). */
    expect(out.leverSafety.leverPrefixlessCode.pairs).toBe(0);
  });

  it("A-2 🔴🔴 쓰기 주체가 **하나** 이고 `fixtures/` 를 건드리지 않는다", () => {
    const files = readdirSync(HERE).filter((f) => f.endsWith(".ts"));
    let writers = 0;
    let fixtureWrites = 0;
    for (const f of files) {
      const bare = readFileSync(path.join(HERE, f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/\/\/[^\n]*/g, " ");
      if (/writeFileSync\([^)]*a-identity-axis/.test(bare)) writers += 1;
      if (/writeFileSync\([^)]*"fixtures"/.test(bare)) fixtureWrites += 1;
    }
    expect(writers).toBe(1);
    expect(fixtureWrites, "🔴 fixtures/ 에 쓰면 GT 분모가 흔들린다").toBe(0);
  });

  it("A-3 🔴 산출물에 **원문·인증정보가 없다**(원인 코드와 개수만 적는다)", () => {
    const raw = readFileSync(path.join(HERE, "preserved", "a-identity-axis.json"), "utf8");
    for (const banned of ['"originTitle"', '"candidateTitle"', '"description"', "Authorization", "cookie", "token"]) {
      expect(raw, `🔴 ${banned} 가 산출물에 섞였다`).not.toContain(banned);
    }
  });

  it("A-4 🔴🔴 평가가 **판정·수집·배선·DB 로 넘어가지 않았다**", () => {
    const bare = readFileSync(path.join(HERE, "a-identity-axis.test.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ");
    /** 🔴 자기참조 함정 — 토큰을 **런타임에 조립** 한다(다섯 번 밟은 자리). */
    for (const token of [
      ["SAME", "_MIN_AXES"],
      ["withConf", "idence"],
      ["judgeDomestic", "Candidate"],
      ["fetchPlain", "Html"],
      ["DATABASE", "_URL"],
      ["brandModelCode", " ="],
      ["brandModelCode", ":"],
      ["compareModelCode", "("],
    ].map(([a, b]) => `${a}${b}`)) {
      expect(bare, `🔴 ${token} — 평가 WU 가 경계를 넘었다`).not.toContain(token);
    }
  });
});
