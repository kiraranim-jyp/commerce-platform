import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SPRINT 4 GATE C4 — **저장된 Search 공급량을 «분모와 함께» 고정한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **왜 필요한가** — 운영 실행 1건(B226AC038 · organic **3**)만 보고 「Search 가
 *    공급을 못 한다」로 적으면 **N=1 일반화** 다. 🟢 그런데 이 저장소에는 **같은
 *    질의 골격** 으로 상품 10개를 돌린 산출물이 **두 벌** 저장돼 있다 ⟹
 *    **새 검색 0 · 과금 0** 으로 분포를 말할 수 있다.
 *
 * 🔴 **이 파일은 숫자를 «고정» 한다** — 보고서에 쓴 수를 기계가 다시 계산한다.
 *    (「표본 기반 숫자에는 `sample N=x` 를 적는다」 · 헌장 §5)
 * 🔴 네트워크 **0** · 외부 호출 **0** — 로컬 fixture 만 읽는다.
 * 🔴🔴 **이 분포를 운영 전수로 쓰지 않는다** — 상품 10개 · 각 1회 관측이고,
 *    같은 질의의 **실행 간 URL 겹침이 3~30%** 로 측정된 바 있다(SP-10).
 */

const F = join(__dirname, "fixtures");
/** 🔴 지금 배포된 판매처 신호. **글자로** 쓴다(상수 import 는 동어반복이다). */
const SIGNAL = "국내해외 동일상품 판매처";

interface Run {
  label?: string;
  counts?: { kr?: number };
  search?: { query?: string; organicResults?: number; failed?: boolean };
  metrics?: { query?: string; organicResults?: number; failed?: boolean };
}

function runsOf(file: string): Run[] {
  const j = JSON.parse(readFileSync(join(F, file), "utf8")) as Run[] | { runs: Run[] };
  return Array.isArray(j) ? j : j.runs;
}
const m = (r: Run) => r.search ?? r.metrics ?? {};
/** 🔴 **배포된 질의 골격** 으로 돈 회차만 센다(다른 신호를 같은 표에 섞지 않는다). */
const deployed = (rs: Run[]) => rs.filter((r) => (m(r).query ?? "").includes(SIGNAL));

describe("SPRINT4-GATE-03 — 저장된 Search 공급량(sample N=10 × 2벌)", () => {
  /**
   * 🟢 A/B 채택 회차(2026-10-29) — **전건 성공** 이고 공급이 7~9 다.
   * 🔴 그때 페이지 상한은 **1** 이었다(2페이지는 2026-11-03 변경) ⟹
   *    이 수를 「2페이지 환경의 기대값」으로 쓰지 않는다.
   */
  it("S1 🟢 query-signal-ab — n=10 · 실패 0 · organic 7~9 · **0건 0개**", () => {
    const rs = deployed(runsOf("query-signal-ab-result.json"));
    expect(rs.length, "🔴 분모가 10 이 아니다").toBe(10);
    const organic = rs.map((r) => m(r).organicResults ?? -1);
    expect(organic.every((v) => v >= 7 && v <= 9), `🔴 분포가 바뀌었다: ${organic.join(",")}`).toBe(true);
    expect(rs.filter((r) => m(r).failed).length, "🔴 실패가 있었다").toBe(0);
    expect(organic.filter((v) => v === 0).length, "🔴 공급 0 상품이 있었다").toBe(0);
    expect(organic.reduce((a, b) => a + b, 0)).toBe(85);
  });

  /**
   * 🔴 같은 질의 골격의 **다른 회차** 는 같지 않다 — 실패 1 · 공급 0 이 1건이다.
   *    🟢 그래서 「Search 는 항상 9를 준다」로도 「항상 0이다」로도 적을 수 없다.
   */
  it("S2 🔴 query-adopt-01 — n=10 · **실패 1** · **공급 0 이 1건**", () => {
    const rs = deployed(runsOf("query-adopt-01-production.json"));
    expect(rs.length).toBe(10);
    expect(rs.filter((r) => m(r).failed).length, "🔴 실패 건수가 바뀌었다").toBe(1);
    const ok = rs.filter((r) => !m(r).failed).map((r) => m(r).organicResults ?? -1);
    expect(ok.length).toBe(9);
    expect(ok.filter((v) => v === 0).length, "🔴 공급 0 건수가 바뀌었다").toBe(1);
    expect(ok.reduce((a, b) => a + b, 0)).toBe(67);
  });

  /**
   * 🟢🟢 **국내 URL 이 Search 에서 실제로 나온다** — C3(Market neutrality)의 «결과» 쪽 증거다.
   * 🔴 단 「국내 후보 8」이 아니다 — URL 수이고 일부는 정책 차단/검색결과 페이지다.
   */
  it("S3 🟢 Market neutrality 결과 — 🇰🇷 URL 이 10 상품 중 **6 상품** 에서 나온다(합 8)", () => {
    const rs = deployed(runsOf("query-signal-ab-result.json"));
    const kr = rs.map((r) => r.counts?.kr ?? 0);
    expect(kr.reduce((a, b) => a + b, 0), "🔴 국내 URL 합이 바뀌었다").toBe(8);
    expect(kr.filter((v) => v > 0).length, "🔴 국내 URL 이 나온 상품 수가 바뀌었다").toBe(6);
    /** 🔴🔴 원상품은 **전부 해외 사이트** 다 — 그런데 국내 URL 이 나온다 ⟹
     *    「해외 입력이면 해외만 검색한다」가 **결과로도 반증** 된다. */
    expect(kr.some((v) => v > 0)).toBe(true);
  });

  /**
   * 🔴🔴 **Sprint 4 의 원래 질문은 아직 열려 있다** — 이 두 벌은 **2026-10-29 · 1페이지**
   *    환경이고, 운영 전환(**2페이지**) 뒤의 관측은 **1건**(B226AC038 · organic 3) 뿐이다.
   * 🟢 그 1건을 이 분포와 **같은 표에 넣지 않는다**(조건이 다르다).
   */
  it("S4 🔴 2페이지 전환 이후 관측은 이 분포에 **포함되지 않는다**(조건 분리)", () => {
    const all = [...runsOf("query-signal-ab-result.json"), ...runsOf("query-adopt-01-production.json")];
    /** 🔴 저장분에는 페이지별 칸이 **없다** — 그 칸은 2026-11-03 에 생겼다. */
    const anyPerPage = all.some((r) => "organicPerPage" in (m(r) as Record<string, unknown>));
    expect(anyPerPage, "🔴 저장분에 페이지 칸이 있다면 조건이 같다는 뜻이다 — 표를 다시 짜라").toBe(false);
  });
});
