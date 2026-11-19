/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **G8 — `BASELINE_NOT_REPRODUCED` 5쌍 원인 구분**(평가 전용 · HTTP 0 · DB 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 운영 재분석 0 · GT 생성/변경 0 · verdict 재계산 0 · 운영 코드·DB·배선 0 ·
 *    동결 변경 0 · 기존 산출물 **덮어쓰기 0** · 새 WU 0.
 *
 * 🟢🟢 **착수 전 확인에서 이미 분류가 있었다**(§4-D) — 그래서 **새로 조사하지 않았다**:
 * ```
 * docs/MI-KIDS-BASELINE-REPRO-13.json      `INPUT_MISSING` 11 · `CONNECT_FAIL` 2
 * .../__tests__/kids-baseline-repro-contract.test.ts   그 산출물의 계약(분모 13)
 * ```
 * 🔴 그 집합의 정의는 **「GT SAME + baseline 미재현」** 이다 ⟹ GT 가 SAME 이 아닌 쌍은
 *    **그 분모 밖** 이고, 그것을 「원인 미조사」로 적지 않고 **분모 밖** 으로 적는다.
 *
 * 🔴🔴 **조인은 URL 축으로만 한다** — 도메인은 `www.` 접두가 달라(`junioredition.com` ↔
 *    `www.junioredition.com`) 도메인으로 조인하면 **조용히 틀린다**.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const HERE = path.join(process.cwd(), "src", "app", "api", "price-history", "_lib", "__tests__");
const ROOT = path.join(process.cwd(), "..", "..");
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const A = path.join(HERE, "preserved", "a-identity-axis.json");
const KW = path.join(HERE, "fixtures", "mi-reeval-03-keyword-input.json");
const REPRO13 = path.join(ROOT, "docs", "MI-KIDS-BASELINE-REPRO-13.json");
const RECOUNT = path.join(HERE, "preserved", "gt-latest-recount.json");
const OUT = path.join(HERE, "preserved", "g8-baseline-cause.json");

type ARow = {
  originCode: string | null;
  candidateUrl: string;
  candidateDomain: string | null;
  humanGt: string | null;
  baselineSystemVerdict: string | null;
};
type Case13 = {
  originCode: string;
  candidateUrl: string;
  causeClass: "INPUT_MISSING" | "CONNECT_FAIL";
  reproducible: boolean;
  rowsWithSystemVerdict: number;
  actualBaselineInOtherRow: string[] | null;
};

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname;
  } catch {
    return "(unparsed)";
  }
};

describe("G8 — baseline 미재현 5쌍 원인 구분(기존 분류 재사용)", () => {
  it("G8-1 🔴 5쌍을 **(원상품, 후보 URL)** 로 특정한다", () => {
    const five = (read(A) as { rows: ARow[] }).rows.filter(
      (r) => r.baselineSystemVerdict === "BASELINE_NOT_REPRODUCED",
    );
    expect(five).toHaveLength(5);
    /** 🟢 **다섯이 전부 같은 원상품** 이다 — 산발이 아니라 한 상품에 몰려 있다. */
    expect(new Set(five.map((r) => r.originCode))).toEqual(new Set(["B226AC009"]));
    /** 🔴 URL 은 전건 유일해야 조인이 성립한다. */
    expect(new Set(five.map((r) => r.candidateUrl)).size).toBe(5);
  });

  it("G8-2 🔵 기존 분류와 대조해 **확정 / 미확정** 을 가르고 산출물을 남긴다", () => {
    const five = (read(A) as { rows: ARow[] }).rows.filter(
      (r) => r.baselineSystemVerdict === "BASELINE_NOT_REPRODUCED",
    );
    const art = read(REPRO13) as {
      causeTally: Record<string, number>;
      structuralRootCause: string;
      cases: Case13[];
    };
    const recount = read(RECOUNT) as { supersededPairs: { host: string; prior: string | null; latest: string | null }[] };
    const byUrl = new Map(art.cases.map((c) => [c.candidateUrl, c]));
    const supHosts = new Map(recount.supersededPairs.map((p) => [p.host, p]));

    const rows = five.map((r) => {
      const hit = byUrl.get(r.candidateUrl);
      const host = hostOf(r.candidateUrl);
      const sup = supHosts.get(host);
      if (hit) {
        return {
          originCode: r.originCode,
          host,
          candidateUrl: r.candidateUrl,
          gtUsedInA: r.humanGt,
          cause: hit.causeClass,
          confirmed: true,
          evidenceUsed: "docs/MI-KIDS-BASELINE-REPRO-13.json (URL 축 조인) + kids-baseline-repro-contract",
          detail:
            hit.causeClass === "INPUT_MISSING"
              ? `그 행에 시스템 판정이 **없다**(rowsWithSystemVerdict ${hit.rowsWithSystemVerdict}) — 실행 실패가 아니라 **입력 부재** 다`
              : `다른 행에 baseline 이 **있다**(${JSON.stringify(hit.actualBaselineInOtherRow)} · rows ${hit.rowsWithSystemVerdict}) — 재현 **가능** 하다(연결 실패)`,
          reproducible: hit.reproducible,
          resolvableBy: hit.causeClass === "CONNECT_FAIL" ? "CTO" : "CPO",
          resolution:
            hit.causeClass === "CONNECT_FAIL"
              ? "🟢 같은 후보의 **다른 행** 에 baseline 이 있다 ⟹ 조인 경로를 잇는 것으로 해결 가능(🔴 범위는 CPO 지정)"
              : "🔴 그 행에는 baseline 이 **애초에 저장되지 않는다** ⟹ 설계·정책 사안(아래 구조적 근본원인)",
        };
      }
      /**
       * 🔴🔴 **분모 밖이다 — 「미조사」가 아니다.** 13 집합은 「GT **SAME** + 미재현」이고
       *    이 쌍은 그 산출물이 만들어진 시점에 GT **DIFFERENT** 였다.
       * 🔴 그리고 ① 재집계에서 **최신 CEO 판정이 SAME 으로 갱신** 됐다 ⟹ 최신 기준이면
       *    그 집합의 조건을 만족하지만 **그 산출물은 갱신 전 분모** 다.
       * 🔴 원인 확정에는 그 산출물의 방법(**DB 실측**)이 필요하고 그것은 **금지·불가** 다
       *    ⟹ **UNKNOWN** 으로 남긴다(「원인 없음」이 아니다).
       */
      return {
        originCode: r.originCode,
        host,
        candidateUrl: r.candidateUrl,
        gtUsedInA: r.humanGt,
        cause: "UNKNOWN",
        confirmed: false,
        evidenceUsed: "13 집합 정의(GT SAME + 미재현) · ① 재집계 산출물(gt-latest-recount)",
        detail:
          `13 집합의 **분모 밖** 이다 — 그 산출물 기준 GT 가 \`${sup?.prior ?? r.humanGt}\` 였다. ` +
          `🔴 ① 에서 최신 CEO 판정이 \`${sup?.latest ?? "?"}\` 로 **갱신** 됐으나 그 산출물은 **갱신 전** 분모다.`,
        reproducible: null,
        resolvableBy: "CPO",
        resolution:
          "🔴 원인 확정에는 **DB 실측**(candidate_reviews 의 system_* 보유 여부)이 필요하다 — " +
          "CTO 는 service-role 이 없고 DB 는 금지다 ⟹ **UNKNOWN 유지**. 🟡 정황은 있다(같은 원상품의 " +
          "다른 11건이 전부 INPUT_MISSING)이고 🔴 **정황을 확정으로 쓰지 않는다**",
      };
    });

    /** 🔴 부수 발견 — `candidateDomain` 공백이 **호스트 집계에 섞인다**. */
    const kw = (read(KW) as { pairs: { candidateDomain: string | null }[] }).pairs;
    const nullDomainRows = kw.filter((r) => !r.candidateDomain).length;
    const aRows = (read(A) as { rows: ARow[] }).rows;
    const hostsFromDomain = new Set(aRows.map((r) => r.candidateDomain)).size;
    const hostsFromUrl = new Set(aRows.map((r) => hostOf(r.candidateUrl))).size;

    const confirmed = rows.filter((r) => r.confirmed);
    const out = {
      note:
        "🔴 평가 전용 — HTTP 0 · DB 0 · 운영 변경 0 · GT 변경 0 · 덮어쓰기 0. " +
        "🟢 **기존 분류를 재사용** 했다(새 조사 0). 🔴 확정과 미확정을 **분리** 한다.",
      denominator: { pairs: rows.length, originCode: "B226AC009", note: "🔴 5쌍 전부 **같은 원상품** 이다" },
      causeTally: rows.reduce<Record<string, number>>((a, r) => ({ ...a, [r.cause]: (a[r.cause] ?? 0) + 1 }), {}),
      confirmedCount: confirmed.length,
      unknownCount: rows.length - confirmed.length,
      /** 🔴🔴 이것이 G8 의 **성질** 을 바꾼다 — 「측정 실패」가 아니다. */
      structuralRootCause: art.structuralRootCause,
      structuralMeaning:
        "🔴🔴 `BASELINE_NOT_REPRODUCED` 의 지배 원인은 **실행 실패가 아니라 입력 부재** 다 — " +
        "`candidate_reviews` 는 설계상 `system_*` 와 `human_verdict` 가 **서로 덮지 않는다**(WU-131 보호 계약) " +
        "⟹ CEO GT 가 시딩된 행에는 운영 baseline 이 **구조적으로** 없다. " +
        "🔴 그러므로 G8 을 「재현이 전건」으로 두면 **구조적으로 충족 불가** 일 수 있다 ⟹ " +
        "🔴 **기준 재정의는 CPO 판정 사안** 이고 CTO 가 바꾸지 않았다.",
      rows,
      sideFinding: {
        what: "🔴 `candidateDomain` 공백이 호스트 집계에 섞인다",
        kwNullDomainRows: nullDomainRows,
        aRowsWithNullDomain: aRows.filter((r) => !r.candidateDomain).length,
        hostsFromDomainField: hostsFromDomain,
        hostsFromUrl: hostsFromUrl,
        impact:
          "🟢 **호스트 «수» 는 바뀌지 않는다**(둘 다 9) — 🔴 그러나 구성에 `null` 자리가 하나 있었고 " +
          "`www.` 유무를 **다른 호스트로 센다**. ⟹ 「9 호스트」는 유효하고 **호스트 이름 목록은 URL 로 다시 뽑아야** 한다",
        resolvableBy: "CTO",
        note: "🔴 기존 산출물을 **덮어쓰지 않았다** — 다음 산출 때 URL 에서 뽑으면 된다(범위는 CPO 지정)",
      },
      g8Impact: {
        met: false,
        why:
          `확정 ${confirmed.length}/5 · UNKNOWN ${rows.length - confirmed.length}/5 ⟹ ` +
          "🔴 **전건 확정이 아니므로 G8 을 충족으로 올리지 않는다**(일부 확인으로 VERIFIED 금지 · CPO 명시)",
        changed:
          "🟢 **바뀐 것은 원인의 «성질» 이다** — 「하니스가 못 쟀다」가 아니라 " +
          "**「그 행에 baseline 이 설계상 없다」** 가 지배 원인이다(확정 3/5 가 그것이다)",
      },
    };
    writeFileSync(OUT, JSON.stringify(out, null, 2));

    /** 🔴 확정 4 · UNKNOWN 1 — 일부 확인으로 전체를 올리지 않는다. */
    expect(out.confirmedCount).toBe(4);
    expect(out.unknownCount).toBe(1);
    expect(out.causeTally).toEqual({ INPUT_MISSING: 3, CONNECT_FAIL: 1, UNKNOWN: 1 });
    expect(out.g8Impact.met, "🔴 전건 확정이 아니면 G8 은 미충족이다").toBe(false);
    /** 🟢 다섯 행 전부 **원인·근거·확정여부·해결주체** 를 들고 있다(빈칸 금지). */
    expect(
      rows.every((r) => r.cause && r.evidenceUsed.length > 0 && r.resolvableBy.length > 0 && r.resolution.length > 0),
    ).toBe(true);
  });

  it("G8-3 🔴🔴 도메인 축으로 조인하면 **틀린다**(www 접두)", () => {
    const art = read(REPRO13) as { cases: Case13[] };
    const five = (read(A) as { rows: ARow[] }).rows.filter(
      (r) => r.baselineSystemVerdict === "BASELINE_NOT_REPRODUCED",
    );
    const domains = new Set(art.cases.map((c) => hostOf(c.candidateUrl)));
    /** 🔴 `junioredition.com`(A 기록) ↔ `www.junioredition.com`(13 기록) — 같은 판매처인데 글자가 다르다. */
    const mismatched = five.filter((r) => r.candidateDomain && !domains.has(r.candidateDomain));
    expect(mismatched.length, "🔴 도메인 축 조인은 실제로 어긋난다 — URL 축을 쓴다").toBeGreaterThan(0);
  });

  it("G8-4 🔴 이 WU 가 **경계를 넘지 않았다**(덮어쓰기 0 · 금지 0)", () => {
    const self = readFileSync(path.join(HERE, "g8-baseline-not-reproduced-cause.test.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ");
    for (const victim of ["a-identity-axis", "MI-KIDS", "fixtures", "gt-latest-recount", "c-candidate"]) {
      expect(
        new RegExp(`writeFileSync\\([^)]*${victim}`).test(self),
        `🔴 ${victim} 에 쓰려 했다 — 덮어쓰기 금지`,
      ).toBe(false);
    }
    for (const token of [
      ["judgeDomestic", "Candidate"],
      ["fetchPlain", "Html"],
      ["DATABASE", "_URL"],
      ["getSupabase", "Admin"],
      ["brandModelCode", " ="],
    ].map(([a, b]) => `${a}${b}`)) {
      expect(self, `🔴 ${token} — 평가 WU 가 DB/운영으로 넘어갔다`).not.toContain(token);
    }
    expect(self).toContain('"preserved", "g8-baseline-cause.json"');
  });
});
