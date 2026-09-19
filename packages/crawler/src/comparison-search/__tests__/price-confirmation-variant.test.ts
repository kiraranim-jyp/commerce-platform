import { describe, expect, it } from "vitest";
import {
  MAX_DETAIL_CONFIRMATIONS_PER_SHOP,
  selectCandidatesForDetailConfirmation,
} from "../price-confirmation";
import type { ComparisonCandidate, ComparisonQuery } from "../types";

/**
 * P0-A.29-D ㉯(CEO 승인, 2026-09-19) — **「동일 모델 · 옵션 다름」도 상세 가격을
 * 확인한다. 호출은 «늘리지 않고» 자리만 바꾼다.**
 *
 * 실사용(junioredition, Pèpè Lulu T Bar Shoes): 색상만 다른 후보가 화면에서
 * 「가격 확인 필요」로만 떴다. 가격이 없어서가 아니라 상세확인 슬롯에서
 * 탈락해서였다 — 색상이 다르면 상품명 유사도가 떨어지기 때문이다.
 */

const QUERY: ComparisonQuery = {
  title: "Lulu T Bar Shoes in Tobacco",
  brand: "Pèpè",
  /* 품번이 있어야 동일상품 후보가 «식별자 근거» 로 1순위가 된다. 품번이 없으면
     그 후보는 VERY_SIMILAR(텍스트만)이고, 그때는 모델명이 문자열째 일치하는
     변형 후보가 더 강한 근거를 갖는 것이 맞다 — 아래 별도 케이스로 고정한다. */
  sku: "LULU-TBAR-01",
};

const cand = (over: Partial<ComparisonCandidate> & { title: string }): ComparisonCandidate => ({
  url: over.url ?? `https://www.junioredition.com/products/${encodeURIComponent(over.title)}`,
  price: over.price ?? { amount: 100, currency: "GBP" },
  imageUrl: null,
  confidence: over.confidence ?? 0.5,
  matchLevel: over.matchLevel,
  ...over,
});

/** 색상만 다른 후보 — 모델명 문자열은 같고 색상 토큰만 다르다. */
const VARIANT = cand({ title: "Lulu T Bar Shoes in Black", confidence: 0.55, matchLevel: "low" });
/** 동일상품 — 원상품과 같은 색이고 품번까지 같다. */
const SAME = cand({
  title: "Lulu T Bar Shoes in Tobacco",
  confidence: 0.99,
  matchLevel: "very_high",
  sku: "LULU-TBAR-01",
});

describe("🔴 호출 상한은 한 건도 늘지 않는다", () => {
  it("상한은 여전히 2다", () => {
    expect(MAX_DETAIL_CONFIRMATIONS_PER_SHOP).toBe(2);
  });

  it("후보가 아무리 많아도 2건을 넘지 않는다 — query 를 줘도 같다", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      cand({ title: `Lulu T Bar Shoes in Color${i}`, matchLevel: "medium", confidence: 0.8 }),
    );
    expect(selectCandidatesForDetailConfirmation(many, QUERY).length).toBeLessThanOrEqual(2);
  });
});

describe("query 를 «주지 않으면» 예전과 한 글자도 다르지 않다", () => {
  const legacy = [
    cand({ title: "A", matchLevel: "medium", confidence: 0.75 }),
    cand({ title: "B", matchLevel: "very_high", confidence: 0.99 }),
    cand({ title: "C", matchLevel: "high", confidence: 0.9 }),
    cand({ title: "D", matchLevel: "low", confidence: 0.3 }),
  ];

  it("very_high → high 순으로 2건, low 는 제외", () => {
    expect(selectCandidatesForDetailConfirmation(legacy)).toEqual([1, 2]);
  });

  it("🔴 국내 경로는 이 인자를 주지 않는다 — 그래서 국내 동작은 불변이다", () => {
    expect(selectCandidatesForDetailConfirmation(legacy)).toEqual(
      selectCandidatesForDetailConfirmation(legacy, undefined),
    );
  });
});

describe("query 를 주면 「동일 모델 · 옵션 다름」이 슬롯에 들어온다", () => {
  it("🔴 matchLevel=low 라서 «예전엔 아예 탈락» 하던 변형 후보가 선택된다", () => {
    const rows = [SAME, VARIANT];
    expect(selectCandidatesForDetailConfirmation(rows)).toEqual([0]); // 예전: 변형 후보 탈락
    expect(selectCandidatesForDetailConfirmation(rows, QUERY)).toEqual([0, 1]); // 이제: 두 칸 다 씀
  });

  it("동일상품이 «항상» 첫 칸이다 — 순서가 뒤집혀 들어와도", () => {
    expect(selectCandidatesForDetailConfirmation([VARIANT, SAME], QUERY)).toEqual([1, 0]);
  });

  it("🔴 품번이 없으면 «모델명이 통째로 일치하는» 변형 후보가 텍스트 유사도보다 앞선다", () => {
    // 근거의 종류가 다르다. 변형 후보는 모델명 문자열이 완전히 일치해서 나온
    // 값이고, 텍스트 very_high 는 닮았다는 점수일 뿐이다. 점수가 근거를 이기면
    // 안 된다는 것이 match-display.ts 의 mayShowCandidate 와 같은 원칙이다.
    const 품번없음: ComparisonQuery = { title: QUERY.title, brand: QUERY.brand };
    const 텍스트만 = cand({ title: "Lulu T Bar Shoes in Tobacco", confidence: 0.99, matchLevel: "very_high" });
    expect(selectCandidatesForDetailConfirmation([텍스트만, VARIANT], 품번없음)).toEqual([1, 0]);
  });

  it("🔴 자리를 내주는 쪽이 생긴다 — 이 교환을 감추지 않는다", () => {
    // 오늘은 medium 후보 둘이 두 칸을 다 쓴다. 변형 후보가 들어오면 그중
    // «약한 쪽» 하나가 밀린다(= 그 후보 가격은 「가격 확인 필요」가 된다).
    const weak1 = cand({ title: "다른 신발 1", matchLevel: "medium", confidence: 0.8 });
    const weak2 = cand({ title: "다른 신발 2", matchLevel: "medium", confidence: 0.75 });
    const rows = [weak1, weak2, VARIANT];
    expect(selectCandidatesForDetailConfirmation(rows)).toEqual([0, 1]);
    const after = selectCandidatesForDetailConfirmation(rows, QUERY);
    expect(after).toContain(2); // 변형 후보가 들어왔고
    expect(after).toHaveLength(2); // 총량은 그대로이며
    expect(after).not.toContain(1); // 약한 쪽 하나가 밀렸다
  });
});
