import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { keywordDedupeKey, mergeKeywords } from "@commerce/content";

/**
 * P5.6 Phase 4(CPO 승인, 2026-10-09) — **기존 태그를 덮지 않는다.**
 *
 * 🔴 지금까지 generateKeywords 는 기존 태그를 «인자로 받지 않아» 생성 버튼을
 *    누르면 셀러가 손으로 넣은 태그가 사라졌다. 이 파일이 그 회귀를 막는다.
 */
describe("🔴🔴 ① 기존 태그는 한 개도 잃지 않는다", () => {
  it("AI 태그를 더해도 기존이 전부 남는다", () => {
    const r = mergeKeywords(["수입원피스", "프랑스브랜드"], ["Louise Misha", "원피스"]);
    expect(r.merged.slice(0, 2)).toEqual(["수입원피스", "프랑스브랜드"]);
    expect(r.merged).toContain("Louise Misha");
  });

  it("🔴 기존이 «앞» 이다 — 셀러 순서를 AI 가 밀어내지 않는다", () => {
    const r = mergeKeywords(["A", "B"], ["C"]);
    expect(r.merged).toEqual(["A", "B", "C"]);
  });

  it("생성이 비어도 기존은 그대로다", () => {
    expect(mergeKeywords(["A", "B"], []).merged).toEqual(["A", "B"]);
  });
});

describe("🔴🔴 ② 중복 제거 — 표기가 흔들려도 한 번만", () => {
  it.each([
    [["Bobo Choses"], ["bobo choses"]],
    [["Bobo Choses"], ["Bobo  Choses"]],
    [["  태그  "], ["태그"]],
  ])("%s ↔ %s 는 같은 태그다", (a, b) => {
    const r = mergeKeywords(a, b);
    expect(r.merged).toHaveLength(1);
    expect(r.added).toHaveLength(0);
    expect(r.skipped).toEqual(b.map((x) => x.trim()));
  });

  it("기존 목록 «안» 의 중복도 걷어낸다", () => {
    expect(mergeKeywords(["A", "a", "A "], []).merged).toEqual(["A"]);
  });

  it("🔴 한글과 영문은 «합치지 않는다» — 번역 동치를 판단하지 않는다", () => {
    const r = mergeKeywords(["원피스"], ["dress"]);
    expect(r.merged).toEqual(["원피스", "dress"]);
  });
});

describe("🔴🔴 ③ 반복 실행해도 태그가 늘지 않는다 (멱등)", () => {
  it("같은 생성 결과를 두 번 합쳐도 같다", () => {
    const gen = ["Louise Misha", "원피스"];
    const once = mergeKeywords(["수입"], gen).merged;
    const twice = mergeKeywords(once, gen).merged;
    expect(twice).toEqual(once);
  });

  it("세 번째도 늘지 않는다", () => {
    const gen = ["A", "B"];
    let cur = mergeKeywords([], gen).merged;
    for (let i = 0; i < 3; i += 1) cur = mergeKeywords(cur, gen).merged;
    expect(cur).toEqual(["A", "B"]);
  });
});

describe("🔴 ④ 빈 값은 태그가 아니다 · 버린 것은 보고된다", () => {
  it("공백만 있는 값은 양쪽 모두에서 버린다", () => {
    expect(mergeKeywords(["", "  "], ["\t", "A"]).merged).toEqual(["A"]);
  });

  it("🔴 중복이라 버린 AI 후보가 «조용히» 사라지지 않는다", () => {
    const r = mergeKeywords(["A"], ["a", "B"]);
    expect(r.skipped).toEqual(["a"]);
    expect(r.added).toEqual(["B"]);
  });

  it("dedupe 키는 «표시값» 을 바꾸지 않는다", () => {
    expect(keywordDedupeKey("  Bobo  Choses ")).toBe("bobo choses");
    expect(mergeKeywords(["  Bobo  Choses "], []).merged).toEqual(["Bobo  Choses"]);
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   🔴 호출부 배선 — 생성 버튼이 기존 태그를 덮지 않는지.
   🔴 CommerceWorkspace 는 4,300줄에 fetch·DB·sessionStorage 를 끼고 있어 이
      한 줄을 위해 마운트할 수 없다(새 harness 는 금지). 소스로 잠그고 그
      강도 한계를 적는다 — 동작 보장은 위 ①~④ 의 순수 테스트가 한다.
   ───────────────────────────────────────────────────────────────────────── */
describe("🔴🔴 ⑤ 생성 버튼이 mergeKeywords 를 거친다", () => {
  const src = readFileSync(
    new URL("../../CommerceWorkspace.tsx", import.meta.url),
    "utf8",
  )
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("keywords 를 «그대로» 덮어쓰지 않는다", () => {
    expect(src, "generateKeywords 결과를 바로 대입한다 — 기존 태그가 사라진다").not.toMatch(
      /keywords:\s*mockProductContentProvider\.generateKeywords\(prev\)\s*,/,
    );
  });

  it("mergeKeywords 에 «기존 태그» 를 넘긴다", () => {
    expect(src).toContain("mergeKeywords(prev.keywords.value");
  });

  it("🔴 더해진 것이 없으면 출처를 바꾸지 않는다 — 셀러 값이 AI 것으로 변하지 않게", () => {
    expect(src).toMatch(/added\.length > 0 \? generated\.source : prev\.keywords\.source/);
  });
});
