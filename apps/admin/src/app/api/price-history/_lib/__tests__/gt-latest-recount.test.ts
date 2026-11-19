/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 ① 최신 GT 기준 **재집계** — 기준 truth 의 «정합성» 을 바로잡는다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **MI 정확도를 개선하는 작업이 아니다**(CPO 명시). 새 HTTP 0 · 운영 verdict 재계산 0 ·
 *    운영 코드·DB·배선 0 · 새 WU 0.
 *
 * 🔴🔴 **과거 기록을 덮어쓰지 않는다** — `c-candidate-quality.json` ·
 *    `a-identity-axis.json` · `MI-KIDS-CODE-NAME-CAUSES.json` 은 **읽기만** 하고,
 *    결과는 **별도 산출물** 로 남긴다. 기존 집계와 최신 집계를 **나란히** 적는다.
 *
 * 🟢 적용하는 최신 truth(`core-2m-ceo-visual-gt` · 2026-10-24 · CPO 확정):
 * ```
 * bornyesterdaykids.com  SAME      → **UNCERTAIN**  (세트 구성 ⟹ 가격 비교 부적합)
 * m.luxboy.com           DIFFERENT → **SAME**       (브랜드 + 품번 동일)
 * ```
 * 🔴 그 둘은 **`gtSuperseded: true`** 로 표시된 행이고, 내가 고른 것이 아니다.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const HERE = path.join(process.cwd(), "src", "app", "api", "price-history", "_lib", "__tests__");
const ROOT = path.join(process.cwd(), "..", "..");
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));

const C = path.join(HERE, "preserved", "c-candidate-quality.json");
const A = path.join(HERE, "preserved", "a-identity-axis.json");
const CAUSES = path.join(ROOT, "docs", "MI-KIDS-CODE-NAME-CAUSES.json");
const OUT = path.join(HERE, "preserved", "gt-latest-recount.json");

type CauseRow = {
  originCode: string | null;
  candidateUrl: string;
  humanGt: string | null;
  humanGtPrior: string | null;
  humanGtSource: string | null;
  gtSuperseded?: boolean;
};
type CRow = { candidateUrl: string; candidateDomain: string; humanGt: string | null; bucket: string };
type ARow = {
  originCode: string | null;
  candidateUrl: string;
  candidateDomain: string;
  humanGt: string | null;
  axisModelCode: string | null;
  leverCodeOnlyInDescription: boolean;
};

const key = (o: string | null, u: string) => `${o}|${u}`;
const tally = (xs: (string | null)[]) =>
  xs.reduce<Record<string, number>>((a, x) => ({ ...a, [x ?? "ABSENT"]: (a[x ?? "ABSENT"] ?? 0) + 1 }), {});

const superseded = (): CauseRow[] =>
  (read(CAUSES) as { rows: CauseRow[] }).rows.filter((r) => r.gtSuperseded);

describe("① 최신 GT 기준 재집계(HTTP 0 · 덮어쓰기 0)", () => {
  /* ═══════ ① GT 키 대조 — 🔴 조인 실패를 «정상» 으로 처리하지 않는다 ═══════ */

  /**
   * 🔴🔴 **C 산출물에는 `originCode` 가 없다**(③ 흐름 검증이 잡은 결함). 그래서
   *    쌍 축 조인이 **일반적으로는 불가능** 하다. 🟢 그런데 이 재집계가 건드리는 두 행은
   *    **후보 URL 이 분모에서 유일** 하므로 URL 축 조인이 **증명 가능하게 유일** 하다.
   * 🔴 그것을 **단언으로 증명** 한 뒤에만 재집계한다 — 「아마 유일하겠지」로 넘기지 않는다.
   */
  it("G-1 🔴🔴 갱신 2행의 조인이 **유일** 하다(모호하면 재집계하지 않는다)", () => {
    const sup = superseded();
    expect(sup, "🔴 갱신 행이 둘이 아니다 — 범위가 바뀌었다").toHaveLength(2);
    expect(new Set(sup.map((r) => new URL(r.candidateUrl).hostname))).toEqual(
      new Set(["bornyesterdaykids.com", "m.luxboy.com"]),
    );
    /** 🟢 둘 다 최신 소스를 명시한다 — 내가 라벨을 고른 것이 아니다. */
    expect(sup.every((r) => (r.humanGtSource ?? "").includes("core-2m-ceo-visual-gt"))).toBe(true);

    const c = (read(C) as { rows: CRow[] }).rows;
    const a = (read(A) as { rows: ARow[] }).rows;
    for (const r of sup) {
      expect(c.filter((x) => x.candidateUrl === r.candidateUrl), "🔴 C 에서 URL 이 유일하지 않다").toHaveLength(1);
      expect(a.filter((x) => x.candidateUrl === r.candidateUrl).length).toBeLessThanOrEqual(1);
    }
    /** 🔴 A 는 `originCode` 를 들고 있다 ⟹ 쌍 축으로 **직접** 확인한다(undefined 금지). */
    const aHit = a.filter((x) => sup.some((s) => key(s.originCode, s.candidateUrl) === key(x.originCode, x.candidateUrl)));
    expect(aHit, "🔴 쌍 축 조인이 전건 실패하면 그것은 결함이다").toHaveLength(1);
    expect(aHit[0].candidateDomain).toBe("m.luxboy.com");
  });

  /* ═══════ ②③④⑤ 재집계 — 기존과 최신을 «나란히» ═══════ */

  it("G-2 🔵 기존 기준과 최신 GT 기준을 **나란히** 집계한다", () => {
    const sup = superseded();
    const latestByUrl = new Map(sup.map((r) => [r.candidateUrl, r.humanGt]));
    const priorByUrl = new Map(sup.map((r) => [r.candidateUrl, r.humanGtPrior]));

    const c = (read(C) as { rows: CRow[] }).rows;
    const a = (read(A) as { rows: ARow[] }).rows;
    /** 🟢 **원본을 바꾸지 않는다** — 읽어서 «새 배열» 을 만든다. */
    const cLatest = c.map((r) => ({ ...r, humanGtLatest: latestByUrl.get(r.candidateUrl) ?? r.humanGt }));
    const aLatest = a.map((r) => ({ ...r, humanGtLatest: latestByUrl.get(r.candidateUrl) ?? r.humanGt }));

    /** 🔴 갱신이 실제로 적용됐는지 확인한다 — 적용 실패를 통과로 읽지 않는다. */
    const applied = cLatest.filter((r) => r.humanGtLatest !== r.humanGt);
    expect(applied, "🔴 갱신이 적용되지 않았다").toHaveLength(2);

    /** C — GT 가 있는 행만(🔴 `UNCERTAIN` 은 SAME/DIFFERENT 분모에 넣지 않는다). */
    const cut = (rows: { humanGt: string | null; humanGtLatest?: string | null; bucket: string }[], latest: boolean) => {
      const g = (r: { humanGt: string | null; humanGtLatest?: string | null }) =>
        latest ? (r.humanGtLatest ?? null) : r.humanGt;
      const withGt = rows.filter((r) => g(r) === "SAME" || g(r) === "DIFFERENT");
      return {
        withGt: withGt.length,
        byGt: Object.fromEntries(
          ["SAME", "DIFFERENT"].map((x) => [
            x,
            {
              n: withGt.filter((r) => g(r) === x).length,
              buckets: tally(withGt.filter((r) => g(r) === x).map((r) => r.bucket)),
            },
          ]),
        ),
        /** 🔴 SAME/DIFFERENT 밖의 라벨은 **따로** 센다(사라지게 두지 않는다). */
        otherLabels: tally(rows.filter((r) => g(r) && g(r) !== "SAME" && g(r) !== "DIFFERENT").map((r) => g(r))),
      };
    };

    /** A — 축 × GT. 🔴 이 재집계의 핵심 관심은 **「GT DIFFERENT + modelCode MATCH」** 다. */
    const axisCut = (rows: (ARow & { humanGtLatest?: string | null })[], latest: boolean) => {
      const g = (r: ARow & { humanGtLatest?: string | null }) => (latest ? (r.humanGtLatest ?? null) : r.humanGt);
      const byGt = Object.fromEntries(
        ["SAME", "DIFFERENT", "SIMILAR", "UNCERTAIN"].map((x) => [
          x,
          {
            n: rows.filter((r) => g(r) === x).length,
            modelCode: tally(rows.filter((r) => g(r) === x).map((r) => r.axisModelCode)),
          },
        ]),
      );
      const lever = rows.filter((r) => r.leverCodeOnlyInDescription);
      return {
        byGt,
        /** 🔴🔴 품번이 일치하는데 사람이 DIFFERENT 라 한 쌍 — **위험 사례** 다. */
        riskCodeMatchButHumanDifferent: rows.filter((r) => g(r) === "DIFFERENT" && r.axisModelCode === "MATCH").length,
        lever: {
          pairs: lever.length,
          hosts: new Set(lever.map((r) => r.candidateDomain)).size,
          opensGtDifferent: lever.filter((r) => g(r) === "DIFFERENT").length,
          rejectionHosts: [...new Set(lever.filter((r) => g(r) === "DIFFERENT").map((r) => r.candidateDomain))].sort(),
        },
      };
    };

    const out = {
      note:
        "🔴 기준 truth 정합성 작업이다 — **정확도 개선이 아니다**. 새 HTTP 0 · verdict 재계산 0 · " +
        "기존 산출물 **덮어쓰기 0**(읽기만 했다).",
      latestTruthSource: "core-2m-ceo-visual-gt(2026-10-24 · CPO 확정 · `gtSuperseded: true` 로 표시된 행)",
      /** 🔴 ③ 요구 — 과거와 최신을 **구분해 보존** 한다. */
      supersededPairs: sup.map((r) => ({
        originCode: r.originCode,
        host: new URL(r.candidateUrl).hostname,
        prior: priorByUrl.get(r.candidateUrl) ?? null,
        latest: r.humanGt,
        source: r.humanGtSource,
        joinUniqueInDenominator: true,
      })),
      c: { prior: cut(c, false), latest: cut(cLatest, true) },
      a: { prior: axisCut(a, false), latest: axisCut(aLatest, true) },
      conclusionsUnchanged: {
        cPromotion: "승격 0 — 변경 없음(품질 ↔ 식별 버킷은 GT 와 무관하게 계산된다)",
        aPromotion: "승격 0 — 변경 없음(레버 ② 거부 근거가 **갱신 대상이 아니다**)",
        leverRejectionHostsIntersectSuperseded: 0,
      },
    };
    writeFileSync(OUT, JSON.stringify(out, null, 2));

    /** 🟢 버킷은 GT 와 무관하다 ⟹ **품질 ↔ 식별 분리는 한 건도 바뀌지 않는다.** */
    expect(tally(c.map((r) => r.bucket))).toEqual(tally(cLatest.map((r) => r.bucket)));
    /** 🔴 분모는 **바뀐다** — UNCERTAIN 이 SAME/DIFFERENT 분모에서 빠진다. */
    expect(out.c.prior.withGt).toBe(35);
    expect(out.c.latest.withGt).toBe(34);
  });

  /* ═══════ ⑥ 결론 유지 검증 ═══════ */

  /**
   * 🔴🔴🔴 **이 단언이 CPO 요구 ⑥ 이다** — 거부 근거와 갱신 2건의 **교집합 0**.
   * 🟢 그리고 최신 기준에서도 `opensGtDifferent > 0` 이어야 A 의 「승격 0」이 유지된다.
   */
  it("G-3 🔴🔴 최신 기준에서도 **레버 ② 거부 근거가 살아 있다**", () => {
    const o = read(OUT) as {
      a: { latest: { lever: { opensGtDifferent: number; rejectionHosts: string[] } } };
      supersededPairs: { host: string }[];
    };
    expect(o.a.latest.lever.opensGtDifferent, "🔴 0 이 되면 A 를 CPO 재판정으로 올린다").toBeGreaterThan(0);
    const supHosts = new Set(o.supersededPairs.map((r) => r.host));
    expect(o.a.latest.lever.rejectionHosts.filter((h) => supHosts.has(h))).toEqual([]);
  });

  /**
   * 🟢🟢 **최신 truth 가 «개선» 한 것 하나는 정직하게 적는다** —
   *    「품번이 MATCH 인데 사람이 DIFFERENT」 위험 사례가 **1 → 0** 이 된다
   *    (그 1건이 바로 `m.luxboy.com` 이고 최신 CEO 판정은 **SAME** 이다).
   * 🔴 그것을 「MI 정확도가 올라갔다」로 적지 않는다 — **기준이 바로잡힌 것** 이다.
   */
  it("G-4 🟢 품번 축 반례가 **1 → 0** 이 된다(기준 정정의 결과)", () => {
    const o = read(OUT) as {
      a: { prior: { riskCodeMatchButHumanDifferent: number }; latest: { riskCodeMatchButHumanDifferent: number } };
    };
    expect(o.a.prior.riskCodeMatchButHumanDifferent).toBe(1);
    expect(o.a.latest.riskCodeMatchButHumanDifferent).toBe(0);
  });

  it("G-5 🔴 기존 산출물을 **덮어쓰지 않았다**(쓰기 주체 1 · 대상은 새 파일)", () => {
    const files = readdirSync(HERE).filter((f) => f.endsWith(".ts"));
    let writers = 0;
    for (const f of files) {
      const bare = readFileSync(path.join(HERE, f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/\/\/[^\n]*/g, " ");
      /**
       * 🔴🔴 **1차 탐지가 틀렸고 FAIL 로 드러났다** — 리터럴 파일명을 찾았는데 이 하니스는
       *    경로를 **상수(`OUT`)** 로 들고 있어 **0** 이 나왔다. 🟢 「쓰기 주체 0」을
       *    「안전하다」로 읽지 않고 **탐지 실패** 로 보고 고쳤다.
       * 🟢 이제 「쓰기 호출이 있고 **그 파일명을 언급** 한다」로 센다(상수든 리터럴이든 잡힌다).
       */
      if (/writeFileSync\(/.test(bare) && bare.includes("gt-latest-recount.json")) writers += 1;
      /** 🔴 이 하니스가 **다른 산출물에 쓰면** 과거 기록이 사라진다. */
      if (f === "gt-latest-recount.test.ts") {
        for (const victim of ["c-candidate-quality", "a-identity-axis", "MI-KIDS", "fixtures"]) {
          expect(
            new RegExp(`writeFileSync\\([^)]*${victim}`).test(bare),
            `🔴 ${victim} 에 쓰려 했다 — 과거 기록 덮어쓰기 금지`,
          ).toBe(false);
        }
      }
    }
    expect(writers, "🔴 쓰기 주체가 하나가 아니다 — 정본이 흔들린다").toBe(1);
    /** 🟢 쓰기 «대상» 이 새 파일임을 상수 선언으로 직접 못 박는다. */
    const self = readFileSync(path.join(HERE, "gt-latest-recount.test.ts"), "utf8");
    expect(self).toContain('"preserved", "gt-latest-recount.json"');
  });
});
