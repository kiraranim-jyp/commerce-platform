import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mergeKeywords } from "@commerce/content";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.6 P1-6(CEO 실측, 2026-10-09) — **태그가 화면에 «있어야» 한다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 실측: SmartStore 등록 화면에서 태그가 보이지 않는다.
 *
 * 원인 둘:
 *   ① keywords 를 보여 주는 «유일한» 자리가 disabled 인 「AI 콘텐츠」 탭이었다.
 *      그 탭을 여는 것은 답이 아니다 — URGENT ④(CPO, 2026-10-03)가 「이것은
 *      LLM 이 아니라 결정론적 템플릿이라 「AI」 라벨이 셀러를 오해시킨다」는
 *      이유로 준비중을 결정했고 그 판단은 유효하다. 그래서 상품정보에 칸을 냈다.
 *   ② 쿠팡 searchTags 에 «태그가 아니라 옵션 축 이름»(listing.options)이 갔다.
 */
const WS = readFileSync(new URL("../../CommerceWorkspace.tsx", import.meta.url), "utf8");
const SDV = readFileSync(new URL("../SourceDataView.tsx", import.meta.url), "utf8");

describe("🔴🔴 ① 상품정보에 태그 칸이 있다", () => {
  it("SourceDataView 가 keywords 를 그린다", () => {
    expect(SDV).toContain("product.keywords.value.join");
  });

  it("라벨이 「태그」라고 말한다 — 셀러가 찾을 수 있는 이름", () => {
    expect(SDV).toContain("태그(검색 키워드)");
  });

  it("🔴 넘기지 않으면 칸을 그리지 않는다 — 기존 호출부 호환", () => {
    expect(SDV).toContain("onUpdateKeywords ? (");
  });

  it("워크스페이스가 그 칸을 «실제로» 배선한다", () => {
    /* 🔴 배선이 두 곳이다 — SourceDataView(상품정보, 이번에 추가)와
       AIContentPanel(원래 있던 자리, 탭이 열리면 쓴다). 하나만 세면 상품정보
       쪽이 빠져도 통과한다(mutation B2 가 실제로 그렇게 통과했다). */
    const at = WS.indexOf("<SourceDataView");
    expect(at).toBeGreaterThan(-1);
    expect(WS.slice(at, at + 1200), "상품정보에 태그 배선이 없다").toContain(
      "onUpdateKeywords={updateKeywords}",
    );
  });
});

describe("🔴🔴 ② AI 콘텐츠 탭은 «여전히» 준비중이다", () => {
  it("탭을 열어서 푼 것이 아니다 — URGENT ④ 판단을 지킨다", () => {
    expect(WS).toContain('<TabButton active={tab === "content"} disabled');
  });
});

describe("🔴 ③ 손으로 적은 태그도 AI 와 «같은» 규칙으로 중복을 거른다", () => {
  it("updateKeywords 가 mergeKeywords 를 쓴다 — 규칙이 두 벌이 되지 않게", () => {
    const at = WS.indexOf("function updateKeywords");
    expect(at).toBeGreaterThan(-1);
    expect(WS.slice(at, at + 600)).toContain("mergeKeywords(typed, [])");
  });

  it("표기가 흔들린 중복이 한 번만 남는다", () => {
    expect(mergeKeywords(["Bobo Choses", "bobo  choses", "아동"], []).merged).toEqual([
      "Bobo Choses",
      "아동",
    ]);
  });

  it("🔴 빈 값은 태그가 아니다", () => {
    expect(mergeKeywords(["", "  ", "유효"], []).merged).toEqual(["유효"]);
  });
});

describe("🔴🔴 ④ 쿠팡 검색태그가 «태그» 를 보낸다", () => {
  const COUPANG = readFileSync(
    new URL("../../../../../../../packages/listing/src/coupang/build-payload.ts", import.meta.url),
    "utf8",
  );

  it("옵션 축 이름을 더는 보내지 않는다", () => {
    expect(COUPANG).not.toContain("searchTags: listing.options");
  });

  it("product.keywords 를 보낸다", () => {
    /* 🔴 P5.6 P2 실측 — trim 을 공용 함수(dedupeSellerTagTexts)로 올렸다.
       운영 빌더 probe 에서 중복이 그대로 나가는 것이 드러났고, 네이버
       sellerTags 도 같은 결함이었다. 읽는 값은 여전히 product.keywords 다. */
    expect(COUPANG).toContain("dedupeSellerTagTexts(product.keywords.value)");
  });
});
