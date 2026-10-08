import { describe, expect, it } from "vitest";
import { resolveColorHueGroups } from "../product-facts";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.6(CPO 승인, 2026-10-09) — **MI Recall 결함은 «판정» 이 아니라 «어휘» 였다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 실측(JOB-005 · 네 색상이 운영 경로에서 갈리는 테스트):
 *   Grey Melange    색 읽힘 → match     → SAME       🟢
 *   Chocolate Brown 색 읽힘 → 불일치     → CONFLICT   🟢
 *   Graystone       🔴 colorText = null → PRESUMED_SAME 에서 정지
 *   Rose Shadow     🔴 colorText = null → 같은 이유로 정지
 *
 * 🔴 compareColor 는 읽히기만 하면 맞는 답을 낸다(Chocolate Brown 이 증거).
 *    그래서 고친 것은 «아는 색 이름» 하나이고, 판정 기준은 손대지 않았다.
 *
 * 🔴 반증된 두 가설은 이 파일이 다시 못 가게 막는다 —
 *    ① SAME_MIN_AXES 하향: Grey Melange 가 이미 통과하므로 불필요
 *    ② TITLE 부분일치를 SAME 정원에 포함: 실측에서 네 색이 «전부» SAME 이 됐다
 */
describe("🔴 ① 국내 음차 표기를 읽는다", () => {
  it.each([
    ["그레이스톤", "GREY"],
    ["그레이멜란지", "GREY"],
    ["로즈섀도우", "PINK"],
    ["로즈쉐도우", "PINK"],
    ["초콜릿", "BROWN"],
    ["차콜", "GREY"],
    ["카키", "GREEN"],
    ["라벤더", "PURPLE"],
  ])("%s → %s", (text, group) => {
    expect([...resolveColorHueGroups(text)]).toContain(group);
  });
});

describe("🔴 ② 해외 원문도 그대로 읽는다 (회귀)", () => {
  it.each([
    ["Graystone", "GREY"],
    ["Grey Melange", "GREY"],
    ["Rose Shadow", "PINK"],
    ["Chocolate Brown", "BROWN"],
    ["Blue Topaz", "BLUE"],
    ["Fern Green", "GREEN"],
  ])("%s → %s", (text, group) => {
    expect([...resolveColorHueGroups(text)]).toContain(group);
  });
});

describe("🔴🔴 ③ 다른 색이 같은 묶음으로 뭉개지지 않는다 — False SAME 방어", () => {
  /** 🔴 이 네 색은 «같은 품번»(AW26MS185)을 공유한다. 묶음이 겹치면
   *     품번+색 일치로 읽혀 네 색이 전부 SAME 이 된다. */
  const FOUR = ["그레이멜란지", "그레이스톤", "로즈섀도우", "초콜릿브라운"];
  it("Grey 계열과 Pink/Brown 계열이 교집합을 갖지 않는다", () => {
    const grey = resolveColorHueGroups("그레이멜란지");
    for (const other of ["로즈섀도우", "초콜릿브라운"]) {
      const g = resolveColorHueGroups(other);
      expect([...grey].some((x) => g.has(x)), `${other} 가 GREY 와 겹친다`).toBe(false);
    }
  });
  it("🔴 네 색이 «하나의» 묶음으로 수렴하지 않는다", () => {
    const sets = FOUR.map((c) => [...resolveColorHueGroups(c)].join(","));
    expect(new Set(sets).size).toBeGreaterThan(1);
  });
  it("🔴 모르는 색은 «지어내지 않는다» — 빈 집합", () => {
    for (const unknown of ["", "스톤", "멜란지만", "zzz"]) {
      expect([...resolveColorHueGroups(unknown)], unknown).toHaveLength(0);
    }
  });
});
