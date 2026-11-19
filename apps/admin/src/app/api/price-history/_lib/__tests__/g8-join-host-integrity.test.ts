/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **G8 보완 — 조인 경로 + 호스트 집계 정합성**(평가 전용 · HTTP 0 · DB 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 목적은 SAME 판정률·baseline 재현율 **상승이 아니다**(CPO 명시) — 원인을 **정확히
 *    분류** 하고 근거 없는 것은 **UNKNOWN 으로 보존** 하며 **추적 가능성** 을 확보한다.
 * 🔴 HTTP 0 · DB 0 · GT 변경 0 · verdict 재계산 0 · 운영 코드·배선·UI 0 · schema 0 ·
 *    기존 산출물 **덮어쓰기 0** · 새 WU 0 · 배포 승인 전 merge 0.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const HERE = path.join(process.cwd(), "src", "app", "api", "price-history", "_lib", "__tests__");
const ROOT = path.join(process.cwd(), "..", "..");
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const A = path.join(HERE, "preserved", "a-identity-axis.json");
const C = path.join(HERE, "preserved", "c-candidate-quality.json");
const G8 = path.join(HERE, "preserved", "g8-baseline-cause.json");
const KW = path.join(HERE, "fixtures", "mi-reeval-03-keyword-input.json");
const REPRO13 = path.join(ROOT, "docs", "MI-KIDS-BASELINE-REPRO-13.json");
const PRODUCER = path.join(HERE, "mi-url-evidence-live.test.ts");
/** 🔴 쓰기는 **새 파일 하나** — 기존 G8 산출물을 건드리지 않는다. */
const OUT = path.join(HERE, "preserved", "g8-join-host-integrity.json");

type Row = { originCode: string | null; candidateUrl: string; candidateDomain: string | null };

/** 🟢 **집계 전용** 정규화다 — 🔴 조인 키로 쓰지 않는다(아래 J-2 가 그 경계를 잠근다). */
const hostForTally = (u: string): string | null => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};
const hostRaw = (u: string): string | null => {
  try {
    return new URL(u).hostname;
  } catch {
    return null;
  }
};
/**
 * 🔴 **쌍 키는 「원상품 + 후보 URL」이다** — 호스트나 도메인이 아니다.
 *    🟢 아래 K-1 이 그 축에서 유일성을 단언한다(그 자리에서 인라인으로 만든다 —
 *       헬퍼가 다른 타입과 섞여 `as` 캐스트를 부르면 tsc 가 가린다 · 실제로 잡혔다).
 */

describe("G8 보완 ① 조인 경로 정합성", () => {
  /**
   * 🔴🔴 **REPRO-13 의 조인 키는 호스트가 아니다** — 그 산출물의 `method` 가 직접 말한다:
   *    「`candidate_url` 로 조회하고 **`origin_code` 일치 행만** 취함」.
   * 🟢 그래서 **서로 다른 상품 URL 이 호스트로 합쳐지지 않는다**(A §주의 1 충족).
   */
  it("J-1 🟢 기존 분류의 조인 키가 **(후보 URL, 원상품 코드)** 임을 근거로 고정한다", () => {
    const art = read(REPRO13) as { method: Record<string, string>; cases: { candidateUrl: string }[] };
    expect(art.method.step2).toContain("candidate_url");
    expect(art.method.step2).toContain("origin_code");
    expect(art.method.step2, "🔴 호스트로 조회하면 다른 상품이 섞인다").not.toContain("host");
    /** 🟢 같은 호스트의 **다른 상품 URL 이 별도 행** 으로 남아 있다(합쳐지지 않았다는 증거). */
    const junior = art.cases.filter((c) => hostRaw(c.candidateUrl) === "www.junioredition.com");
    expect(junior.length).toBe(2);
    expect(new Set(junior.map((c) => c.candidateUrl)).size, "🔴 호스트로 합쳐졌다면 1이 된다").toBe(2);
  });

  /**
   * 🔴🔴 **도메인 축과 URL 축을 섞지 않는다.** 실측 — A 산출물은 `junioredition.com`,
   *    REPRO-13 은 `www.junioredition.com` 이다. 도메인으로 조인하면 **조용히 어긋난다**.
   */
  it("J-2 🔴🔴 도메인 축 조인은 **어긋난다** · 집계 정규화는 조인에 쓰지 않는다", () => {
    const a = (read(A) as { rows: Row[] }).rows;
    const art = read(REPRO13) as { cases: { candidateUrl: string }[] };
    /** 🔴 **타입을 느슨하게 하지 않는다**(tsc 가 잡았다) — 그 산출물 행에 `candidateDomain` 칸은 없다. */
    const repro13Domains = new Set(art.cases.map((c) => hostRaw(c.candidateUrl)));
    const mismatch = a.filter((r) => r.candidateDomain && !repro13Domains.has(r.candidateDomain));
    expect(mismatch.length, "🔴 도메인 축은 실제로 어긋난다").toBeGreaterThan(0);

    /** 🔴 이 파일의 조인은 **URL 축** 이고, 정규화 함수는 **집계에만** 쓴다. */
    const self = readFileSync(path.join(HERE, "g8-join-host-integrity.test.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ");
    expect(self, "🔴 정규화 호스트를 조인 키로 쓰면 다른 상품이 합쳐진다").not.toMatch(
      /new Map\([^)]*hostForTally/,
    );
  });

  /**
   * 🔴🔴🔴 **CONNECT_FAIL 의 「조인」은 「URL ↔ 도메인」 문제가 아니었다.**
   *
   * `BASELINE_NOT_REPRODUCED` 의 생산지는 `mi-url-evidence-live.test.ts:202` 이고 그
   * 입력은 **`os.tmpdir()/mi-url-evidence/step1-targets.json`** 이다 — **리포 밖** 이고
   * 지금 **존재하지 않는다**. ⟹ 🔴 그 라벨이 왜 비었는지 **코드로 재현할 수 없다**.
   * 🟢 대신 REPRO-13 이 **DB 로 이미 확인했다** — 그 쌍에는 system_verdict 보유 행이
   *    **11개** 있고 값은 `["SAME"]` 이다 ⟹ **재현 가능(연결 실패)** 로 분류된 근거다.
   * 🔴 「올바른 baseline 행과 연결됨」을 **이 자리에서 증명할 수 없다** — DB 가 필요하고
   *    금지다. ⟹ **연결 가능성은 REPRO-13 의 DB 실측 기록으로만** 성립한다(그대로 적는다).
   */
  it("J-3 🔴🔴 추적이 끊긴 자리는 **생산지 입력이 임시 디렉터리** 라는 사실이다", () => {
    const producer = readFileSync(PRODUCER, "utf8");
    expect(producer).toContain('t.baseline.systemVerdict ?? "BASELINE_NOT_REPRODUCED"');
    expect(producer, "🔴 입력이 tmp 가 아니게 되면 이 기록을 갱신한다").toContain("os.tmpdir()");
    expect(producer).toContain('"step1-targets.json"');
    const tmpInput = path.join(os.tmpdir(), "mi-url-evidence", "step1-targets.json");
    /** 🔴 **없음을 기록한다** — 「있을 것이다」로 가정하지 않는다. */
    expect(
      existsSync(tmpInput),
      "🟡 그 입력이 존재하면 원인 재현이 가능해진다 — 그때 CPO 에게 올린다",
    ).toBe(false);

    const art = read(REPRO13) as { cases: { candidateUrl: string; causeClass: string; rowsWithSystemVerdict: number; actualBaselineInOtherRow: string[] | null }[] };
    const connect = art.cases.filter((c) => c.causeClass === "CONNECT_FAIL");
    expect(connect).toHaveLength(2);
    /** 🟢 그 분류의 근거가 **숫자로** 남아 있다. */
    expect(connect.every((c) => c.rowsWithSystemVerdict > 0 && (c.actualBaselineInOtherRow ?? []).length > 0)).toBe(true);
  });
});

describe("G8 보완 ② 호스트 집계 정합성", () => {
  /**
   * 🔴🔴 **내 ③ 보고를 정정한다** — 「도메인 축 9 = URL 축 9 이므로 영향 0」은 **불완전** 했다.
   *    `www.` 를 정규화하면 **8** 이다(`www.junioredition.com` ↔ `junioredition.com` 을
   *    둘로 세고 있었고, 그 자리에 `null` 이 하나 끼어 **숫자가 우연히 같았다**).
   */
  it("H-1 🔴🔴 `candidateDomain` 공백 행은 **전건 URL 에서 호스트가 나온다**", () => {
    const kw = (read(KW) as { pairs: Row[] }).pairs;
    const nulls = kw.filter((r) => !r.candidateDomain);
    expect(nulls).toHaveLength(5);
    /** 🔴 임의의 호스트로 **대체하지 않는다** — URL 에서만 뽑는다. */
    expect(nulls.every((r) => hostRaw(r.candidateUrl) !== null), "🔴 추출 불가 행이 있으면 세어 남긴다").toBe(true);
    /** 🟢 그러므로 **누락 0** 이다(null 행을 버리지 않았다). */
    expect(nulls.filter((r) => hostForTally(r.candidateUrl) === null)).toHaveLength(0);
  });

  it("H-2 🔴 정규화 집계가 기존 숫자를 **정정** 한다(A 9 → 8 · C 재산출)", () => {
    const a = (read(A) as { rows: Row[] }).rows;
    const c = (read(C) as { rows: Row[] }).rows;
    const n = (rows: Row[]) => ({
      byDomainField: new Set(rows.map((r) => r.candidateDomain)).size,
      byUrlHost: new Set(rows.map((r) => hostRaw(r.candidateUrl))).size,
      normalized: new Set(rows.map((r) => hostForTally(r.candidateUrl))).size,
      unextractable: rows.filter((r) => hostForTally(r.candidateUrl) === null).length,
      nullDomainRows: rows.filter((r) => !r.candidateDomain).length,
    });
    const A26 = n(a);
    const C109 = n(c);
    expect(A26).toEqual({ byDomainField: 9, byUrlHost: 9, normalized: 8, unextractable: 0, nullDomainRows: 1 });
    expect(C109).toEqual({ byDomainField: 24, byUrlHost: 26, normalized: 25, unextractable: 0, nullDomainRows: 5 });
    /** 🔴🔴 **세 축이 전부 다르다** — 「호스트 수」를 쓸 때 **어느 축인지 적어야 한다**. */
    expect(new Set([C109.byDomainField, C109.byUrlHost, C109.normalized]).size).toBe(3);
  });
});

describe("G8 보완 ③ 계약 — 분류·분모·UNKNOWN 보존", () => {
  it("K-1 🟢 5쌍 전체가 **추적 가능** 하다(식별자·URL·원인·근거)", () => {
    const g8 = read(G8) as {
      rows: { originCode: string | null; candidateUrl: string; cause: string; evidenceUsed: string; confirmed: boolean }[];
    };
    expect(g8.rows).toHaveLength(5);
    expect(g8.rows.every((r) => r.originCode && r.candidateUrl.startsWith("http") && r.cause && r.evidenceUsed)).toBe(true);
    /** 🔴 (원상품, 후보) 축에서 **유일** 해야 한다. */
    expect(new Set(g8.rows.map((r) => `${r.originCode}|${r.candidateUrl}`)).size).toBe(5);
  });

  it("K-2 🔴 **구조적 부재** 와 **수집·연결 실패** 가 갈려 있다", () => {
    const g8 = read(G8) as { causeTally: Record<string, number>; structuralRootCause: string };
    expect(g8.causeTally.INPUT_MISSING).toBe(3);
    expect(g8.causeTally.CONNECT_FAIL).toBe(1);
    expect(
      g8.structuralRootCause,
      "🔴 구조적 근본원인 기록이 사라지면 **「실행 실패」로 오독** 된다",
    ).toContain("서로 덮지 않는다");
  });

  it("K-3 🔴🔴 **UNKNOWN 이 보존** 되고 GT 갱신이 분류를 **소급 변경하지 않는다**", () => {
    const g8 = read(G8) as { causeTally: Record<string, number>; rows: { host: string; cause: string }[] };
    expect(g8.causeTally.UNKNOWN).toBe(1);
    const unknown = g8.rows.find((r) => r.cause === "UNKNOWN");
    expect(unknown?.host).toBe("m.luxboy.com");
    /**
     * 🔴 ① 에서 그 쌍의 최신 CEO 판정이 **SAME** 으로 갱신됐다. 🔴 그래도 **분류는
     *    UNKNOWN 그대로** 다 — REPRO-13 분모가 **갱신 전** 이고 원인 확정에는 DB 가 필요하다.
     * 🟢 「GT 가 바뀌었으니 원인도 정해졌다」로 **추정 확정하지 않는다**(CPO 명시).
     */
    const art = read(REPRO13) as { cases: { candidateUrl: string }[] };
    expect(
      art.cases.some((c) => hostRaw(c.candidateUrl) === "m.luxboy.com"),
      "🔴 그 쌍이 REPRO-13 분모에 들어오면 그때 분류를 다시 한다(지금은 분모 밖)",
    ).toBe(false);
  });

  it("K-4 🔴 **두 분모를 혼동하지 않는다** — REPRO-13 **13** ↔ G8 **5**", () => {
    const art = read(REPRO13) as { cases: { candidateUrl: string }[]; causeTally: Record<string, number> };
    const g8 = read(G8) as { rows: { candidateUrl: string }[] };
    expect(art.cases).toHaveLength(13);
    expect(Object.values(art.causeTally).reduce((a, b) => a + b, 0)).toBe(13);
    expect(g8.rows).toHaveLength(5);
    const urls13 = new Set(art.cases.map((c) => c.candidateUrl));
    const overlap = g8.rows.filter((r) => urls13.has(r.candidateUrl)).length;
    /** 🟢 겹침 **4** — 🔴 13 과 5 를 **합산하거나 한쪽으로 대체하지 않는다**. */
    expect(overlap).toBe(4);
  });

  it("K-5 🔵 보완 산출물을 남긴다(기존 산출물 **덮어쓰기 0**)", () => {
    const a = (read(A) as { rows: Row[] }).rows;
    const c = (read(C) as { rows: Row[] }).rows;
    const kw = (read(KW) as { pairs: Row[] }).pairs;
    const art = read(REPRO13) as {
      method: Record<string, string>;
      cases: { candidateUrl: string; causeClass: string; rowsWithSystemVerdict: number; actualBaselineInOtherRow: string[] | null }[];
    };
    const g8 = read(G8) as { rows: { originCode: string | null; candidateUrl: string; host: string; cause: string; confirmed: boolean; reproducible: boolean | null }[] };
    const byUrl = new Map(art.cases.map((x) => [x.candidateUrl, x]));

    const out = {
      note:
        "🔴 G8 **보완** 전용 — HTTP 0 · DB 0 · GT 변경 0 · verdict 0 · 운영 변경 0 · " +
        "기존 산출물 **덮어쓰기 0**. 🔴 baseline 재현 자체를 목표로 하지 않는다(CPO 기준 재정의).",
      joinIntegrity: {
        repro13Key: "(candidate_url, origin_code) — 🟢 호스트가 아니다(method.step2 원문)",
        hostMergeRisk: "🟢 없다 — 같은 호스트의 **다른 상품 URL 이 별도 행** 으로 남아 있다(junioredition ×2)",
        myJoinAxis: "URL 축(G8·이 파일) — 🔴 정규화 호스트는 **집계 전용** 이고 조인 키가 아니다",
        domainAxisDrift: "🔴 실측 — A 산출물 `junioredition.com` ↔ REPRO-13 `www.junioredition.com`",
        tracedBreak:
          "🔴🔴 `BASELINE_NOT_REPRODUCED` **생산지 입력이 `os.tmpdir()/mi-url-evidence/step1-targets.json`** 이고 " +
          "**리포 밖 · 현재 부재** 다 ⟹ 그 라벨이 왜 비었는지 **코드로 재현할 수 없다**. " +
          "🟢 연결 가능성은 **REPRO-13 의 DB 실측 기록으로만** 성립한다(rows 11 · `[\"SAME\"]`)",
        connectFailRows: art.cases
          .filter((x) => x.causeClass === "CONNECT_FAIL")
          .map((x) => ({
            host: hostRaw(x.candidateUrl),
            rowsWithSystemVerdict: x.rowsWithSystemVerdict,
            actualBaselineInOtherRow: x.actualBaselineInOtherRow,
            verifiedHere: false,
            verifiedBy: "REPRO-13 (DB 읽기 전용 · 이 WU 는 DB 0)",
          })),
      },
      hostTally: {
        kwNullDomainRows: kw.filter((r) => !r.candidateDomain).length,
        kwNullRowsHostsFromUrl: kw.filter((r) => !r.candidateDomain).map((r) => hostRaw(r.candidateUrl)),
        unextractableRows: [...a, ...c, ...kw].filter((r) => hostForTally(r.candidateUrl) === null).length,
        identityAxis26: {
          byDomainField: new Set(a.map((r) => r.candidateDomain)).size,
          byUrlHost: new Set(a.map((r) => hostRaw(r.candidateUrl))).size,
          normalized: new Set(a.map((r) => hostForTally(r.candidateUrl))).size,
          normalizedList: [...new Set(a.map((r) => hostForTally(r.candidateUrl)))].sort(),
        },
        bGroup109: {
          byDomainField: new Set(c.map((r) => r.candidateDomain)).size,
          byUrlHost: new Set(c.map((r) => hostRaw(r.candidateUrl))).size,
          normalized: new Set(c.map((r) => hostForTally(r.candidateUrl))).size,
        },
        correction:
          "🔴🔴 **③ 보고의 「도메인 축 9 = URL 축 9 ⟹ 영향 0」을 정정한다** — 정규화하면 " +
          "**8** 이다(`www.junioredition.com` ↔ `junioredition.com` 을 둘로 셌고 그 자리에 " +
          "`null` 이 하나 끼어 **숫자가 우연히 같았다**). 🟢 **누락은 0** 이다(null 행도 URL 에서 나온다)",
        rule: "🔴 「호스트 수」를 적을 때 **어느 축인지 같이 적는다** — 세 축이 전부 다르다",
      },
      g8Rows: g8.rows.map((r) => ({
        originCode: r.originCode,
        host: r.host,
        candidateUrl: r.candidateUrl,
        priorClass: byUrl.get(r.candidateUrl)?.causeClass ?? "NOT_IN_REPRO13",
        finalClass: r.cause,
        confirmed: r.confirmed,
        reproducible: r.reproducible,
        unchangedByThisWu: true,
      })),
      denominators: { repro13: 13, g8: 5, overlap: 4, note: "🔴 합산하거나 한쪽으로 대체하지 않는다" },
      ctoVerdict:
        "🔴 **G8 기준 부분 충족** — 추적 가능성·분류·구조적 구분·UNKNOWN 보존은 충족되나 " +
        "`m.luxboy.com` 원인은 **UNKNOWN** 이고 그 해소에는 DB(금지)가 필요하다. " +
        "🔴 전체 충족 선언은 **CPO 판정 사안** 이다(CTO 가 선언하지 않는다).",
    };
    writeFileSync(OUT, JSON.stringify(out, null, 2));

    /** 🟢 이 WU 는 분류를 **한 건도 바꾸지 않았다**. */
    expect(out.g8Rows.every((r) => r.unchangedByThisWu)).toBe(true);
    expect(out.g8Rows.filter((r) => r.finalClass === "UNKNOWN")).toHaveLength(1);
    /** 🔴 기존 산출물에 쓰지 않았다. */
    const self = readFileSync(path.join(HERE, "g8-join-host-integrity.test.ts"), "utf8");
    for (const victim of ["g8-baseline-cause", "a-identity-axis", "c-candidate-quality", "MI-KIDS", "fixtures"]) {
      expect(new RegExp(`writeFileSync\\([^)]*${victim}`).test(self), `🔴 ${victim} 덮어쓰기 금지`).toBe(false);
    }
  });

  it("K-6 🔴 금지 경계를 넘지 않았다(DB · 운영 · 우회 0)", () => {
    const self = readFileSync(path.join(HERE, "g8-join-host-integrity.test.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ");
    for (const token of [
      ["DATABASE", "_URL"],
      ["getSupabase", "Admin"],
      ["judgeDomestic", "Candidate"],
      ["fetchPlain", "Html"],
      ["brandModelCode", " ="],
      ["SAME", "_MIN_AXES ="],
      ["UA_", "POOL"],
    ].map(([x, y]) => `${x}${y}`)) {
      expect(self, `🔴 ${token} — 보완 WU 가 경계를 넘었다`).not.toContain(token);
    }
  });
});
