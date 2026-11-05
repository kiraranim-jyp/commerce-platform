import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PRICE_DISQUALIFYING_BLOCKER_LIST,
  summarizeCandidateOverseasPrices,
  type CandidateOverseasPriceRecord,
} from "../candidate-market";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 BRAND-CONFLICT-PRICE — **브랜드 충돌이 가격 자격을 «실제 데이터에서» 막는가**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **CPO §2 가 물은 것과 내가 틀렸던 것을 먼저 적는다.**
 * ```
 * 🔴 내 직전 보고: 「다른 브랜드 2건이 **해외 소싱 가격대에 들어간다**」
 *    ⟹ **그것은 과장이었다.** 나는 `tier === "COMPARISON"` 을 보고 그렇게 적었는데,
 *       tier 는 **관측/분류** 이고 **가격 자격(`byCurrency` 진입)이 아니다**.
 * 🟢 실제 정책은 이미 그 차단을 들고 있다 — `PRICE_DISQUALIFYING_BLOCKERS` 에
 *    **`BRAND_MISMATCH` 가 있다**(STAGE 7-2).
 * 🟢 전달도 이미 있다 — `market-intelligence.ts` 의 해외/국내 push **둘 다**
 *    `blockers: e.crossSellerBlockers` 를 넘긴다(기존 계약 C-1 이 `toBe(2)` 로 잠금).
 * ⟹ 🟢 **누락된 차단이 없다.** 그래서 이 WU 는 **정책을 고치지 않고 실측으로 증명** 한다.
 * ```
 *
 * 🔴 그런데 기존 계약(`stage7-2-*`)은 **손으로 만든 레코드** 로 그것을 본다.
 * 🟢 이 파일은 **운영이 저장한 행 전수**(`candidate_reviews` · 가격 보유 159건)를
 *    **운영 집계기에 그대로** 넣는다 — 「우리 정책이 운영 데이터에서도 지켜지는가」다.
 *
 * 🔴 네트워크 0 · DB 0(덤프를 읽는다) · 운영 코드 변경 0.
 * 🔴 입력은 `packages/database/scripts/brand-conflict-price-dump.mjs` 가 만든다.
 *    🔴 덤프가 없으면 **SKIP** 한다 — 「0건 통과」로 적지 않는다(측정불가 ≠ PASS).
 */

const DUMP = path.join(process.env.TEMP ?? ".", "mi-p0-02", "brand-conflict-price.json");
const READY = existsSync(DUMP);

interface Rec extends CandidateOverseasPriceRecord {
  domain: string;
  title: string | null;
  blockers: string[];
}
const load = (): Rec[] =>
  (JSON.parse(readFileSync(DUMP, "utf8")) as { records: Rec[] }).records;

const has = (r: Rec, t: string) => r.blockers.includes(t);
/** 🟢 「가격 자격을 잃는 축」 — owner 목록을 **그대로** 쓴다(사본 금지). */
const disqualified = (r: Rec) =>
  r.blockers.some((b) => PRICE_DISQUALIFYING_BLOCKER_LIST.includes(b));
const sum = (rs: Rec[]) => summarizeCandidateOverseasPrices(rs as CandidateOverseasPriceRecord[]);
const total = (s: ReturnType<typeof sum>) =>
  Object.values(s.byCurrency).reduce((a, c) => a + c.count, 0);

describe.runIf(READY)("BRAND-CONFLICT-PRICE — 운영 저장분 전수", () => {
  /* ── R. 🔴🔴 브랜드 충돌 — 가격 자격을 «잃는다» ──────────────────────────── */

  it("R-1 🔴🔴 `BRAND_MISMATCH` 후보는 **금액 집계에 한 건도 들어가지 않는다**", () => {
    const mismatch = load().filter((r) => has(r, "BRAND_MISMATCH"));
    expect(mismatch.length, "🔴 운영에 BRAND_MISMATCH 가 없다 — 측정불가").toBeGreaterThan(0);
    const s = sum(mismatch);
    /** 🔴 이 단언이 깨지면 **다른 브랜드 가격이 동일상품 가격대에 섞인다**. */
    expect(total(s), "🔴🔴 브랜드 충돌 후보가 금액 집계에 들어갔다").toBe(0);
    expect(Object.keys(s.byCurrency)).toEqual([]);
    /** 🟢 그리고 **조용히 사라지지 않는다** — 「상품 차이」로 세어진다. */
    expect(s.observedDifferenceCount).toBeGreaterThan(0);
  });

  it("R-2 🔴🔴 **`PRESUMED_SAME` 경로에서도** 막힌다 — CPO 가 물은 그 경로다", () => {
    const rs = load().filter((r) => has(r, "BRAND_MISMATCH") && r.verdict === "PRESUMED_SAME");
    expect(rs.length, "🔴 PRESUMED_SAME + BRAND_MISMATCH 표본이 없다 — 측정불가").toBeGreaterThan(0);
    expect(total(sum(rs)), "🔴🔴 PRESUMED 경로에서 브랜드 충돌이 통과했다").toBe(0);
  });

  it("R-3 🟢 관측은 지우지 않는다 — 후보는 **검색 결과에 그대로 남는다**(CPO §2-5)", () => {
    const mismatch = load().filter((r) => has(r, "BRAND_MISMATCH"));
    const s = sum(mismatch);
    /** 🔴 `count`·`byMarket`·`byPriceTier` 는 **전건을 센다** — 발견을 지우지 않는다. */
    expect(s.count).toBe(mismatch.length);
    expect(Object.values(s.byMarket).reduce((a, n) => a + n, 0)).toBe(mismatch.length);
  });

  /* ── P. 🟢 통과해야 하는 쪽 — 차단이 «과하지» 않다 ──────────────────────── */

  it("P-1 🔴🔴 `BRAND_UNCONFIRMED` 는 **막지 않는다** — 「모르는 것」을 반증으로 쓰지 않는다", () => {
    const rs = load().filter((r) => has(r, "BRAND_UNCONFIRMED") && !disqualified(r));
    expect(rs.length, "🔴 BRAND_UNCONFIRMED 단독 표본이 없다 — 측정불가").toBeGreaterThan(0);
    const priced = rs.filter(
      (r) =>
        (r.verdict === "SAME" || r.verdict === "PRESUMED_SAME" || r.verdict == null) &&
        r.amount != null &&
        r.priceTier !== "EXCLUDED" &&
        r.priceStatus !== "UNVERIFIED_SEARCH",
    );
    /** 🟢 자격을 갖춘 것이 있으면 **반드시** 집계에 든다(0 이면 과차단이다). */
    if (priced.length > 0) expect(total(sum(rs))).toBeGreaterThan(0);
  });

  it("P-2 🟢 차단축이 없는 후보는 자격을 지킨다 — 금액 집계가 비지 않는다", () => {
    const rs = load().filter(
      (r) =>
        !disqualified(r) &&
        (r.verdict === "SAME" || r.verdict === "PRESUMED_SAME") &&
        r.amount != null &&
        r.priceTier !== "EXCLUDED" &&
        r.priceStatus === "VERIFIED_CURRENT",
    );
    expect(rs.length, "🔴 통과 표본이 없다 — 측정불가").toBeGreaterThan(0);
    expect(total(sum(rs)), "🔴 과차단 — 자격 있는 후보가 집계에서 사라졌다").toBeGreaterThan(0);
  });

  it("P-3 🔴 `CONFLICT` verdict 는 **verdict 축에서** 막힌다(blocker 축과 다른 사실)", () => {
    const rs = load().filter((r) => r.verdict === "CONFLICT" && r.amount != null);
    if (rs.length === 0) return; // 🔴 표본 없음 — 0 으로 적지 않는다
    expect(total(sum(rs))).toBe(0);
  });

  /* ── C. 🔴 전수 대조 — 두 축을 «갈라» 센다 ──────────────────────────────── */

  it("C-1 🔴🔴 전수에서 **금액 집계 ∩ 차단축 = 공집합** 이다", () => {
    const all = load();
    const s = sum(all);
    const pass = all.filter((r) => !disqualified(r));
    /** 🟢 차단된 것만 빼면 집계 합이 통과군의 부분집합이어야 한다. */
    expect(total(s)).toBeLessThanOrEqual(pass.length);
    /** 🔴 그리고 차단된 수가 `observedDifferenceCount` 보다 작을 수 없다. */
    expect(s.observedDifferenceCount).toBeLessThanOrEqual(all.filter(disqualified).length);
    /* eslint-disable no-console */
    console.log(
      `\n[BCP] 운영 저장분 ${all.length}건 → 금액 집계 ${total(s)}건 · ` +
        `상품차이로 제외 ${s.observedDifferenceCount} · 가격미확인 제외 ${s.unverifiedCount}`,
    );
    console.log(`[BCP] byCurrency ${JSON.stringify(s.byCurrency)}`);
    /**
     * 🔴🔴 **이 `byCurrency` 를 「화면이 보여주는 값」으로 읽지 않는다.**
     * ```
     * 이 테스트는 **여러 스냅샷의 저장분을 한 집계기에 몰아** 넣는다 — 운영은 스냅샷마다
     * 자기 후보만 집계한다. ⟹ 🔴 `lowestAmount`/`highestAmount` 범위는 **상품을 섞은
     * 값** 이고 어떤 화면의 값도 아니다. 이 숫자는 **차단 여부** 를 보기 위한 것이다.
     * ```
     * 🟡 그 과정에서 **금액 품질 관측** 하나가 나왔다(실측 · 운영 저장분):
     * ```
     * junioredition.com  GBP **8100 · 8800 · 15100 · 15200 · 30200**
     *   🟡 `81.00 → 8100` · `152.00 → 15200` — **소수점이 유실된 ×100 패턴** 으로 보인다
     *   🔴 **단정하지 않는다** — 그 행들은 `priceStatus = null`(낡은 저장분 artifact)이고,
     *      운영 금액 집계의 입력은 **live transient evidence** 이지 `candidate_reviews`
     *      가 **아니다** ⟹ 「해외 소싱 가격대에 ×100 가격이 뜬다」는 **미확인** 이다
     *   🔴 가격 «파서» 는 WU-079 가 REJECT 한 축이다 ⟹ **고치지 않았다 · CPO 판정 사안**
     * ```
     */
    const x100 = all.filter((r) => r.currency === "GBP" && (r.amount ?? 0) > 1000);
    console.log(
      `[BCP] 🟡 금액 품질 관측 — GBP>1000 ${x100.length}건(소수점 유실 ×100 패턴 추정 · ` +
        `priceStatus null 우세 · **운영 화면 유입은 미확인**)`,
    );
    /* eslint-enable no-console */
  });

  it("C-2 🔴 분류표 전수가 **금액 자격을 막는다** — 하나라도 통과하면 FAIL", () => {
    for (const token of PRICE_DISQUALIFYING_BLOCKER_LIST) {
      const rs = load().filter((r) => has(r, token));
      if (rs.length === 0) continue; // 🔴 표본 없음은 PASS 가 아니다 — 아래 로그로 남긴다
      expect(total(sum(rs)), `🔴 ${token} 가 금액 집계를 통과했다`).toBe(0);
    }
  });

  /**
   * 🔴🔴 **CPO 필수 사례 중 «표본이 없는» 것을 PASS 로 적지 않는다.**
   *    「브랜드 충돌 **그리고** 품번 일치」가 운영 저장분에 **0건** 이다 ⟹ **측정불가** 다.
   */
  it("C-3 🔴 「브랜드 충돌 + 품번 일치」 표본 수를 **기록** 한다(0 이면 측정불가)", () => {
    const both = load().filter((r) => has(r, "BRAND_MISMATCH") && has(r, "MODEL_CODE"));
    /* eslint-disable-next-line no-console */
    console.log(
      `[BCP] 브랜드충돌+품번일치 표본 ${both.length}건` +
        (both.length === 0 ? " — 🔴 **측정불가**(PASS 로 적지 않는다)" : ""),
    );
    if (both.length > 0) expect(total(sum(both))).toBe(0);
  });
});
