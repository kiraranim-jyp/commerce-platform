import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PRICE_DISQUALIFYING_BLOCKER_LIST,
  summarizeCandidateOverseasPrices,
  type CandidateOverseasPriceRecord,
} from "../candidate-market";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-DOMESTIC-CONTROL-01 — **「tier COMPARISON = 가격 비교 유입」을 정정한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **먼저 — 내가 정정하는 문장을 그대로 적는다.**
 * ```
 * 🔴 인수인계가 「핵심 수치」로 들고 있던 것:
 *      「GT DIFFERENT 13/13 이 저장 PRESUMED_SAME · 그중 **10건 tier COMPARISON**
 *        (= 가격 비교 **유입**)」
 * 🟢 운영 저장분 전수로 다시 재니 — tier COMPARISON 은 **11건** 이고,
 *    그 11건은 운영 금액 자격 퍼널에서 **전건 탈락** 한다.
 * ⟹ 🔴 **「tier COMPARISON」을 「가격 비교 유입」으로 읽은 것이 틀렸다.**
 *    tier 는 **관측/분류** 이고 자격이 아니다(같은 오독이 이 트랙에서 두 번째다).
 * ```
 *
 * 🟢 **그래서 이 파일은 정책을 한 글자도 바꾸지 않는다.** 하는 일은 둘이다 —
 *    ⒜ GT 라벨 축에서 **금액 오염이 0 임을 운영 집계기로** 고정한다
 *    ⒝ 🔴 그 차단이 **해외 축에만 있다** 는 사실(국내/해외 비대칭)을 **명시 잠금** 한다.
 *
 * 🔴🔴 **⒝ 를 「결함」으로 적지 않는다 — 측정된 교환이다**(A-5 가 그 값을 들고 있다).
 *    좁히면 **정답(human SAME)이 같이 사라진다** ⟹ 어느 쪽을 택할지는 **CPO 판단** 이다.
 *    🔴 이 파일은 **그 비대칭을 «고치지» 않는다.** 다음 사람이 `stage7-2`("관측된 차이가
 *       있으면 동일상품 금액으로 쓰지 않는다")를 읽고 **국내에도 당연히 적용된다고 오해해
 *       조용히 좁히는 것** 을 막는 것이 목적이다.
 *
 * 입력 — `preserved/mdc-01-price-eligibility-control.json`
 *    운영 DB `candidate_reviews` 의 `human_verdict IS NOT NULL` **전수 39행**(read-only).
 *    🔴 판정은 **운영이 저장한 값 그대로** 다 — 재계산하지 않았다.
 *    🔴 네트워크 0 · DB 0 · 운영 코드 0줄.
 *
 * 🔴 **측정 범위(미측정을 PASS 로 적지 않는다)**
 * ```
 * 자격 퍼널은 5단인데 ⑤ priceStatus 는 `candidate_reviews` 에 **칸이 없다**
 *   ⟹ 이 파일이 재는 것은 ①~④ 다. ⑤는 **더 좁히는** 방향이므로 여기서 센
 *      「통과」는 **상한** 이다(= 오염 0 결론은 ⑤를 더해도 뒤집히지 않는다).
 * 🔴 분모를 합산하지 않는다 — 109쌍 fixture · 16쌍 양쪽전문 · 이 **39행** 은 다른 집합이다.
 * ```
 */

const ARTIFACT = path.join(__dirname, "preserved", "mdc-01-price-eligibility-control.json");

interface Row {
  originCode: string | null;
  candidateDomain: string | null;
  candidateUrl: string;
  humanGt: "SAME" | "DIFFERENT" | "SIMILAR" | "UNDECIDED" | null;
  storedVerdict: string | null;
  storedPriceTier: string | null;
  storedBlockers: string[] | null;
  market: string | null;
  currency: string | null;
  amount: number | null;
}

const ALL: Row[] = JSON.parse(readFileSync(ARTIFACT, "utf8")).rows;
const gt = (label: string) => ALL.filter((r) => r.humanGt === label);

/**
 * 🟢 **운영 집계기에 그대로 넘긴다.** 자격 판정을 이 파일이 다시 구현하지 않는다 —
 *    재구현하면 「내 규칙이 통과시켰다」가 되어 측정이 무의미해진다(§5-B).
 */
const toRecord = (r: Row): CandidateOverseasPriceRecord =>
  ({
    market: r.market ?? "UNKNOWN",
    currency: r.currency ?? "USD",
    amount: r.amount,
    priceTier: r.storedPriceTier,
    verdict: r.storedVerdict,
    blockers: r.storedBlockers,
  }) as unknown as CandidateOverseasPriceRecord;

/** 🟢 금액 축에 실제로 들어간 건수 — `byCurrency` 가 **자격을 통과한 것만** 센다. */
const admitted = (rows: Row[]) => {
  const s = summarizeCandidateOverseasPrices(rows.map(toRecord));
  return Object.values(s.byCurrency).reduce((a, c) => a + c.count, 0);
};

/** 🟢 「가격 자격을 잃는 축」 — owner 목록을 **그대로** 쓴다(사본 금지). */
const disqualified = (r: Row) =>
  (r.storedBlockers ?? []).some((b) => PRICE_DISQUALIFYING_BLOCKER_LIST.includes(b));

/** 🔴 국내 버킷의 게이트를 **운영과 같은 모양으로** 재현한다 — tier «둘» 뿐이다. */
const domesticGateAdmits = (r: Row) =>
  (r.storedPriceTier === "EXACT" || r.storedPriceTier === "COMPARISON") && r.amount != null;

describe("MDC-01 A. 금액 오염 — GT 라벨 축(운영 저장분 39행)", () => {
  it("A-0 🟢 분모를 먼저 적는다 — GT 라벨 39 = DIFFERENT 15 · SAME 23 · SIMILAR 1", () => {
    expect(ALL).toHaveLength(39);
    expect(gt("DIFFERENT")).toHaveLength(15);
    expect(gt("SAME")).toHaveLength(23);
    expect(gt("SIMILAR")).toHaveLength(1);
  });

  it("A-1 🔴🔴 사람이 DIFFERENT 라 한 15건은 **금액 축에 한 건도 들어가지 않는다**", () => {
    expect(admitted(gt("DIFFERENT"))).toBe(0);
  });

  it("A-2 🔴🔴 그 11건을 막은 것은 **blocker 축이고 tier 가 아니다**(인수인계 수치 정정)", () => {
    const comparison = gt("DIFFERENT").filter((r) => r.storedPriceTier === "COMPARISON");
    // 🔴 인수인계는 「10건」이라 적었다 — 운영 저장분 전수는 **11** 이다.
    expect(comparison).toHaveLength(11);
    // 🟢 전건이 tier 로는 «통과» 한다 — 즉 tier 는 아무것도 막지 않았다.
    expect(comparison.every(domesticGateAdmits)).toBe(true);
    // 🔴 그런데 금액 축에는 0건이다 ⟹ 막은 것은 그 뒤의 축이다.
    expect(admitted(comparison)).toBe(0);
    // 🟢 그 축의 이름을 특정한다 — 전건이 「관측된 차이」 blocker 를 들고 있다.
    expect(comparison.every(disqualified)).toBe(true);
  });

  it("A-3 🔴 반사실 — `blockers` 만 비우면 **11건이 그대로 유입된다**(차단 owner 확정)", () => {
    const comparison = gt("DIFFERENT").filter((r) => r.storedPriceTier === "COMPARISON");
    const stripped = comparison.map((r) => ({ ...r, storedBlockers: null }));
    expect(admitted(stripped)).toBe(11);
  });

  it("A-4 🟢 반대쪽도 본다 — 자격을 통과한 집합에 **DIFFERENT 는 0건** 이다", () => {
    const passers = ALL.filter((r) => admitted([r]) === 1);
    expect(passers.length).toBeGreaterThan(0);
    expect(passers.filter((r) => r.humanGt === "DIFFERENT")).toHaveLength(0);
  });
});

describe("MDC-01 B. 🔴🔴 국내/해외 비대칭 — 그 차단은 «해외 축에만» 있다", () => {
  it("B-1 🔴 국내 버킷의 레코드 타입에는 `blockers` 칸이 **없다**(구조적 사실)", () => {
    const src = readFileSync(
      path.join(__dirname, "..", "..", "..", "..", "..", "..", "..", "..", "packages", "pricing", "src", "price-history.ts"),
      "utf8",
    );
    const start = src.indexOf("export interface PriceObservationRecord {");
    expect(start).toBeGreaterThan(-1);
    const body = src.slice(start, src.indexOf("\n}", start));
    // 🔴 주석을 벗기고 본다 — 주석의 단어를 「칸이 있다」로 읽지 않는다(이 트랙의 함정).
    const code = body
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//"))
      .join("\n");
    expect(code).not.toContain("blockers");
  });

  it("B-2 🔴 국내 버킷 분기는 **tier 둘만** 본다 — blocker 를 보지 않는다", () => {
    const src = readFileSync(path.join(__dirname, "..", "market-intelligence.ts"), "utf8");
    expect(src).toContain('if (tier === "EXACT") exactShopRecords.push(record);');
    expect(src).toContain('else if (tier === "COMPARISON") comparisonShopRecords.push(record);');
  });

  it("B-3 🔴🔴 그래서 같은 11건이 **국내 시장이었다면 전건 유입된다**(반사실)", () => {
    const comparison = gt("DIFFERENT").filter((r) => r.storedPriceTier === "COMPARISON");
    expect(comparison.filter(domesticGateAdmits)).toHaveLength(11);
  });

  it("B-4 🟢 단 **현재 실제 오염은 0** 이다 — GT 라벨 중 market KR 이 0건이다(측정불가 ≠ 안전)", () => {
    expect(ALL.filter((r) => r.market === "KR")).toHaveLength(0);
  });
});

describe("MDC-01 C. 🔴 좁히면 손실이 난다 — CPO 판단 입력(CTO 가 고르지 않는다)", () => {
  it("C-1 🔴🔴 human **SAME** 인데 그 차단축을 들고 있는 행이 **실재한다**", () => {
    const lost = gt("SAME").filter(disqualified);
    expect(lost).toHaveLength(2);
    // 🔴 즉 국내 축에 같은 필터를 넣으면 **정답 2건이 금액에서 사라진다**.
    expect(admitted(lost)).toBe(0);
  });

  it("C-2 🔴 그 손실은 「모르는 것」이 아니라 **관측된 차이** 로 난다 — 둘을 섞지 않는다", () => {
    const lost = gt("SAME").filter(disqualified);
    for (const r of lost) {
      expect((r.storedBlockers ?? []).some((b) => PRICE_DISQUALIFYING_BLOCKER_LIST.includes(b))).toBe(true);
      // 🟢 `BRAND_UNCONFIRMED`(모른다)는 그 목록에 **없다** — 이 손실의 원인이 아니다.
      expect(PRICE_DISQUALIFYING_BLOCKER_LIST).not.toContain("BRAND_UNCONFIRMED");
    }
  });

  it("C-3 🔴 차단축 목록은 **owner 하나** 에서 온다(사본 금지)", () => {
    expect([...PRICE_DISQUALIFYING_BLOCKER_LIST].sort()).toEqual([
      "BRAND_MISMATCH",
      "NO_TITLE_OVERLAP",
      "SAME_SELLER_DISTINCT_LISTING",
    ]);
  });
});
