import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-HJP-02 — **CEO 22건을 «회귀 기준» 으로 고정한다**(CPO §5)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 복원 근거를 두 종류로 **갈라서** 기록한다 — 둘을 섞으면 「전부 직접 근거」로 읽힌다:
 * ```
 * DIRECT      11건  계약 `CEO_CASES` 에 key + 판정이 적혀 있다
 * COMPLEMENT  11건  CEO 가 명시한 총계(SAME 4 / DIFFERENT 18)와 후보 전수 22 의 여집합
 * ```
 * 🔴 **추측이 아니다** — SAME 4 가 직접 근거로 확정되면 나머지는 **전부 DIFFERENT** 다
 *    (완전 분할). 🔴 그러나 「DIRECT」와 동일한 강도로 적지 않는다.
 * 🔴 **CEO 에게 다시 묻지 않았다**(CPO §2·§8).
 */
/**
 * 🔴 **`fixtures/` 에 두지 않았다** — 그 디렉터리는 `core-same06` 의 **전수 분류 가드** 가
 *    훑고, 그 파일에는 **사용자 미커밋 변경 49줄** 이 있다. 🟢 기준 데이터를 계약 옆
 *    `baselines/` 에 두면 가드를 **느슨하게 하지 않고** 사용자 파일을 건드리지 않는다.
 * 🔴 이 파일은 **GT 분모가 아니다** — CEO 22건의 **회귀 기준** 이다(이중 집계 금지).
 */
const FIX = join(__dirname, "baselines");

interface Restored {
  total: number;
  same: number;
  different: number;
  direct: number;
  complement: number;
  rows: {
    snapshotId: string;
    originCode: string | null;
    url: string;
    ceoVerdict: "SAME" | "DIFFERENT";
    basis: "DIRECT" | "COMPLEMENT";
    systemVerdict: string | null;
    matchTruth: string | null;
    blockers: string[];
  }[];
}

const load = (): Restored =>
  JSON.parse(readFileSync(join(FIX, "ceo22-restored.json"), "utf8")) as Restored;

describe("MI-HJP-02 — CEO 22건 영구 연결 회귀 기준", () => {
  it("A-1 🔵🔵 **CEO 최종 판단 4 SAME / 18 DIFFERENT 가 그대로다**", () => {
    const d = load();
    expect(d.total, "🔴 전수가 22 가 아니다").toBe(22);
    expect(d.same, "🔴🔴 CEO SAME 이 4 가 아니다").toBe(4);
    expect(d.different, "🔴🔴 CEO DIFFERENT 가 18 이 아니다").toBe(18);
    expect(d.rows).toHaveLength(22);
    /** 🔴 같은 후보가 두 번 들어가 있지 않다(합이 22 인 것만으로는 부족하다). */
    expect(new Set(d.rows.map((r) => r.url)).size, "🔴 후보 URL 중복이 있다").toBe(22);
  });

  it("A-2 🔴 **복원 근거를 등급으로 가른다** — DIRECT 11 · COMPLEMENT 11", () => {
    const d = load();
    expect(d.direct, "🔴 직접 근거 수가 바뀌었다").toBe(11);
    expect(d.complement, "🔴 여집합 복원 수가 바뀌었다").toBe(11);
    expect(d.direct + d.complement).toBe(22);
    /** 🔴 **SAME 은 전부 직접 근거여야 한다** — 여집합으로 SAME 을 만들지 않는다. */
    for (const r of d.rows.filter((x) => x.ceoVerdict === "SAME")) {
      expect(r.basis, `🔴🔴 SAME 을 여집합으로 만들었다: ${r.url}`).toBe("DIRECT");
    }
  });

  it("A-3 🔵 **계약 `CEO_CASES` 와 한 건도 어긋나지 않는다**", () => {
    const src = readFileSync(join(__dirname, "mce01-candidate-eligibility.test.ts"), "utf8");
    const cases = [...src.matchAll(/\{ key: "([^"]+)", ceo: "([A-Z]+)"/g)].map((m) => ({
      key: m[1],
      ceo: m[2],
    }));
    expect(cases.length, "🔴 CEO_CASES 수가 바뀌었다").toBe(11);
    const d = load();
    for (const c of cases) {
      const hit = d.rows.filter((r) => r.url.includes(c.key));
      expect(hit, `🔴 key 가 1건으로 해석되지 않는다: ${c.key}`).toHaveLength(1);
      expect(hit[0].ceoVerdict, `🔴🔴 복원표가 CEO 판정과 다르다: ${c.key}`).toBe(c.ceo);
    }
  });

  it("A-4 🔴 **원상품 식별 범위가 보존된다** — snapshot 과 origin_code 가 같이 남는다", () => {
    const d = load();
    /** 🔴 URL 단독 전역 매칭을 막는 근거가 행마다 있어야 한다. */
    for (const r of d.rows) {
      expect(r.snapshotId, `🔴 스냅샷이 없다: ${r.url}`).toBeTruthy();
    }
    /** 🟢 원상품 식별자(운영 품번)는 **있는 것만** 센다 — 없으면 null 이 정상이다. */
    const withCode = d.rows.filter((r) => r.originCode != null).length;
    expect(withCode, "🔴 운영 품번 보유 건수가 바뀌었다").toBe(19);
  });

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔵🔵🔵 B — **CEO 판단 ↔ MI 자동 판정 불일치 분석**(CPO §5)
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 이 블록은 **개선안을 «구현» 하지 않는다** — 분모와 방향을 **고정** 한다.
   *    자동 판정 규칙 변경은 회귀로 안전성이 확인된 뒤에만 한다(CPO §5 명시).
   */
  describe("B — 불일치 유형", () => {
    it("B-1 🔴🔴 **지배적 오판 유형은 하나다** — PRESUMED_SAME 이 CEO DIFFERENT 를 통과시킨다", () => {
      const d = load();
      const presumed = d.rows.filter((r) => r.systemVerdict === "PRESUMED_SAME");
      const diff = presumed.filter((r) => r.ceoVerdict === "DIFFERENT").length;
      const same = presumed.filter((r) => r.ceoVerdict === "SAME").length;
      /* eslint-disable no-console */
      console.log(`\nPRESUMED_SAME 22건 중 — CEO DIFFERENT ${diff} · CEO SAME ${same}`);
      /* eslint-enable no-console */
      expect(presumed.length, "🔴 PRESUMED_SAME 분모가 바뀌었다").toBe(21);
      expect(diff, "🔴 그 안의 CEO DIFFERENT 수가 바뀌었다").toBe(18);
      expect(same, "🔴 그 안의 CEO SAME 수가 바뀌었다").toBe(3);
      /**
       * 🔴🔴 **그래서 「보류를 확정 가격대에 넣지 않는다」가 데이터로 정당하다**
       *    (계약 `wu-141-r3-price-owner` C-1-d). 🔴 그 범위를 완화하려면 이 비율이
       *    먼저 바뀌어야 한다 — 지금은 **다른 상품이 다수** 다.
       */
      expect(diff, "🔴 보류 집합에서 CEO DIFFERENT 가 다수가 아니다").toBeGreaterThan(same);
    });

    it("B-2 🔵🔵 **blocker 종류가 CEO 판정을 가른다** — 개선안의 근거", () => {
      const d = load();
      const count = (b: string, v: "SAME" | "DIFFERENT") =>
        d.rows.filter((r) => r.ceoVerdict === v && (r.blockers ?? []).includes(b)).length;
      const table = ["BRAND_MISMATCH", "NO_TITLE_OVERLAP", "AUDIENCE_LINE", "COLOR_VARIANT", "MATERIAL"]
        .map((b) => ({ b, diff: count(b, "DIFFERENT"), same: count(b, "SAME") }));
      /* eslint-disable no-console */
      for (const t of table) console.log(`  ${t.b.padEnd(20)} DIFFERENT ${t.diff} : SAME ${t.same}`);
      /* eslint-enable no-console */
      /**
       * 🟢🟢 **`BRAND_MISMATCH` 는 이 표본에서 CEO SAME 이 «0» 이다** ⟹ 가장 강한
       *    DIFFERENT 지표다. 🟢 그것은 **이미** `PRICE_DISQUALIFYING_BLOCKERS` 에 있다.
       * 🔴 `AUDIENCE_LINE`·`COLOR_VARIANT` 는 그 집합에 **없어서 가격 자격을 통과한다** —
       *    개선 후보이고 **이번에 바꾸지 않았다**(가격 정책 · CPO 판정 사안).
       */
      const brand = table.find((t) => t.b === "BRAND_MISMATCH")!;
      expect(brand.same, "🔴 BRAND_MISMATCH 에 CEO SAME 이 생겼다 — 개선안의 전제가 깨졌다").toBe(0);
      expect(brand.diff, "🔴 BRAND_MISMATCH 의 DIFFERENT 수가 바뀌었다").toBeGreaterThanOrEqual(5);
      /** 🔴 분모가 작다 — 「X% 정확도」로 적지 않는다(22건 표본). */
      expect(d.total).toBe(22);
    });
  });
});
