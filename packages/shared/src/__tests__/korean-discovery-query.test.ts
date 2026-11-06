/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MLS2 STEP 2 계약 — **한글 질의는 「거부」가 기본이다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 CPO: 「한글 상품명 생성 결과가 식별력이 낮으면 **검색하지 않는 것이 낫다**」.
 *    그래서 이 파일의 절반은 **만들지 않는다는 단언** 이다.
 */
import { describe, expect, it } from "vitest";
import { buildKoreanDiscoveryQueries } from "../korean-discovery-query";

describe("MLS2 STEP 2 — 식별력 있는 한글 검색어", () => {
  it("🟢 등록 alias + 품번이면 **가장 좁은** 질의를 만든다", () => {
    const r = buildKoreanDiscoveryQueries({ brandAlias: "보보쇼즈", brandModelCode: "B226AC009" });
    expect(r.queries).toEqual(["보보쇼즈 B226AC009"]);
    expect(r.rejected).toEqual([]);
  });

  /**
   * 🔴🔴 **이 단언이 이 모듈의 존재 이유다**(CPO 가 `titleKo` 직접 사용을 철회한 그 근거).
   *    실측: 운영 `titleKo` 의 한글 토큰이 전부 일반 카테고리 명사다(「키즈 티셔츠」).
   *    「보보쇼즈 티셔츠」는 브랜드 전체 카탈로그를 부르고, 사이트별 상위 5건 제한
   *    때문에 **목표 상품이 밀려나 못 찾는다**(저장소 골든케이스 · 「페페」 단독 100건).
   */
  it("🔴🔴 품번이 없으면 한글 질의를 **만들지 않는다** — 일반 명사 단독 금지", () => {
    const r = buildKoreanDiscoveryQueries({
      brandAlias: "보보쇼즈",
      brandModelCode: null,
      koreanTitle: { value: "Hug Hairy Monster T-shirt 키즈 티셔츠", source: "AI_GENERATED" },
    });
    expect(r.queries).toEqual([]);
    expect(r.rejected).toContain("NO_IDENTIFYING_TOKEN");
  });

  it("🔴 등록되지 않은 브랜드는 한글 질의를 만들지 않는다(CPO A 원칙)", () => {
    const r = buildKoreanDiscoveryQueries({ brandAlias: null, brandModelCode: "B226AC009" });
    expect(r.queries).toEqual([]);
    expect(r.rejected).toContain("NO_BRAND_ALIAS");
  });

  it("🔴 alias 단독 질의를 만들지 않는다 — 「페페」 단독이 100건이던 그 모양이다", () => {
    const r = buildKoreanDiscoveryQueries({ brandAlias: "페페", brandModelCode: null });
    expect(r.queries).toEqual([]);
    /** 🔴 alias 만 들어온 경우에도 **빈 배열** 이다. */
    expect(r.queries.some((q) => q === "페페")).toBe(false);
  });

  it("🟢 한글 상품명이 있으면 **품번과 함께** 두 번째 질의가 선다", () => {
    const r = buildKoreanDiscoveryQueries({
      brandAlias: "보보쇼즈",
      brandModelCode: "B226AC009",
      koreanTitle: { value: "귤 패턴 베이비 수영모", source: "AI_GENERATED" },
    });
    expect(r.queries).toEqual(["보보쇼즈 B226AC009", "보보쇼즈 귤 패턴 베이비 수영모 B226AC009"]);
    /** 🔴 **모든 한글 질의에 품번이 들어 있다** — 좁음을 구조적으로 보장한다. */
    for (const q of r.queries) expect(q).toContain("B226AC009");
  });

  it("🟢 번역어의 **출처를 보존** 한다(CPO 요구)", () => {
    const r = buildKoreanDiscoveryQueries({
      brandAlias: "보보쇼즈",
      brandModelCode: "B226AC009",
      koreanTitle: { value: "귤 패턴 수영모", source: "AI_GENERATED" },
    });
    const withKo = r.provenance.find((p) => p.query.includes("귤"));
    expect(withKo?.koreanTitleSource).toBe("AI_GENERATED");
    /** 🟢 품번만 쓴 질의는 번역 출처가 **없다** — 둘을 섞지 않는다. */
    expect(r.provenance[0].koreanTitleSource).toBeNull();
  });

  it("🔴 한글이 전혀 없는 상품명은 한글 질의로 쓰지 않는다", () => {
    const r = buildKoreanDiscoveryQueries({
      brandAlias: "보보쇼즈",
      brandModelCode: "B226AC009",
      koreanTitle: { value: "Hug Hairy Monster T-shirt", source: "ORIGINAL" },
    });
    expect(r.queries).toEqual(["보보쇼즈 B226AC009"]);
    expect(r.rejected).toContain("NO_KOREAN_TEXT");
  });

  it("🔴 영문 토큰과 품번 중복을 넣지 않는다", () => {
    const r = buildKoreanDiscoveryQueries({
      brandAlias: "보보쇼즈",
      brandModelCode: "B226AC009",
      koreanTitle: { value: "B226AC009 키즈 티셔츠", source: "AI_GENERATED" },
    });
    /** 🟢 한글 토큰만 남고 품번은 **한 번만** 붙는다. */
    expect(r.queries[1]).toBe("보보쇼즈 키즈 티셔츠 B226AC009");
    expect(r.queries[1].match(/B226AC009/g)).toHaveLength(1);
  });

  /**
   * 🔴🔴 **음성 대조(K4)가 이 구멍을 찾았다** — 한글 토큰 필터를 지워도 통과했다.
   *    기존 케이스의 영문 토큰이 하필 **품번** 이라 중복 제거에 걸려 사라졌기 때문이다
   *    (**동어반복**). 🟢 그래서 품번이 **아닌** 영문 토큰이 섞인 모양을 넣는다.
   */
  it("🔴 한글 상품명 안의 **영문 토큰은 빼고** 한글만 쓴다", () => {
    const r = buildKoreanDiscoveryQueries({
      brandAlias: "보보쇼즈",
      brandModelCode: "B226AC009",
      koreanTitle: { value: "Hug Hairy Monster 허그 몬스터 티셔츠", source: "AI_GENERATED" },
    });
    expect(r.queries[1]).toBe("보보쇼즈 허그 몬스터 티셔츠 B226AC009");
    /** 🔴 영문 디자인어가 한글 질의에 **섞이지 않는다**(원문 영문 검색은 별도 축이다). */
    expect(r.queries[1]).not.toContain("Hug");
    expect(r.queries[1]).not.toContain("Monster");
  });

  it("🔴 자모 단독은 한글로 세지 않는다", () => {
    const r = buildKoreanDiscoveryQueries({
      brandAlias: "보보쇼즈",
      brandModelCode: "B226AC009",
      koreanTitle: { value: "ㅋㅋ", source: "AI_GENERATED" },
    });
    expect(r.queries).toEqual(["보보쇼즈 B226AC009"]);
  });
});
