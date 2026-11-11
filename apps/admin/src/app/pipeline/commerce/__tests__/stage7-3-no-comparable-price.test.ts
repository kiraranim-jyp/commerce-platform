import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MARKET_EMPTY_NO_COMPARABLE_PRICE,
  MARKET_EMPTY_NO_CANDIDATE,
  SAME_CONFIRMED_COUNT_LABEL,
  SAME_NOT_CONFIRMED_SHORT,
  marketEmptyNote,
  type PendingSummary,
} from "../mi-same-candidates";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 STAGE 7-3 — **「가격으로 비교할 수 있는 판매처가 0」 문구**(CPO 확정 2026-11-04)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 가 **글자까지** 확정했다:
 *    「동일상품 가격으로 비교할 수 있는 판매처가 아직 없습니다. 후보 상품의 가격과
 *      상품 정보를 확인해 주세요.」
 * 🔴 그리고 네 조건을 같이 확정했다 — 후보 계속 노출 · 확인되지 않은 가격을 동일상품
 *    가격으로 표시하지 않음 · **다른 상품이라고 단정하지 않음** · 셀러가 직접 확인.
 *
 * 🔴 **실측이 이 상태를 만들었다**(B226AC043 · 후보 5건 전부 판정됨 · 금액 자격 0):
 *    기존 문장은 「아직 **동일상품으로 판정된 곳이 없습니다**」였고 그것은 **거짓** 이다.
 * 🟢 `lines.length === 0 → null`(금액 블록 미렌더)은 **CPO 가 유지로 확정** 했다.
 */

/** 🔴 칸 모양을 **타입에서 읽어서** 쓴다 — `reasons` 는 `{text,n}[]` 다(추측 금지). */
const pending = (count: number): PendingSummary => ({ count, reasons: [] });

describe("STAGE 7-3 — A. 네 상태가 «서로 다른 말» 을 한다", () => {
  it("A-1 🔴 금액 자격 0 + 후보 있음 → **CPO 확정 문구 그대로**", () => {
    const note = marketEmptyNote(5, pending(5), false, 5);
    expect(note).toContain(MARKET_EMPTY_NO_COMPARABLE_PRICE);
    /** 🔴 글자를 직접 단언한다 — 상수를 바꿔도 통과하는 동어반복을 만들지 않는다. */
    expect(note).toContain("동일상품 가격으로 비교할 수 있는 판매처가 아직 없습니다.");
    expect(note).toContain("후보 상품의 가격과 상품 정보를 확인해 주세요.");
  });

  it("A-2 🔴🔴 그 상태에서 「판정된 곳이 없다」고 **적지 않는다**(기존 문장이 거짓이 되는 자리)", () => {
    const note = marketEmptyNote(5, pending(5), false, 5);
    expect(note).not.toContain("동일상품으로 판정된 곳이 없습니다");
    /** 🔴 「다른 상품」으로도 단정하지 않는다(CPO 조건 ⒞). */
    expect(note).not.toMatch(/다른 상품|아닙니다|제외했습니다|없습니다만/);
    /** 🔴 후보를 숨겼다는 말도 하지 않는다. */
    expect(note).not.toMatch(/숨겼|삭제|버렸/);
  });

  it("A-3 🟢 후보 0 은 **그대로** 「검색 결과 없음」이다(이 문구로 덮지 않는다)", () => {
    const note = marketEmptyNote(0, pending(0), false, 3);
    expect(note).toContain(MARKET_EMPTY_NO_CANDIDATE);
    expect(note).not.toContain(MARKET_EMPTY_NO_COMPARABLE_PRICE);
  });

  it("A-4 🟢 금액이 이미 섰으면 **짧은 상태 문장** 이다(기존 동작 불변)", () => {
    const note = marketEmptyNote(5, pending(2), true, 3);
    expect(note).toContain(SAME_NOT_CONFIRMED_SHORT);
    expect(note).not.toContain(MARKET_EMPTY_NO_COMPARABLE_PRICE);
  });

  it("A-5 🟢 자격 상실 0 이면 **기존 ⒝ 문장** 그대로다(판정 대기 상태)", () => {
    const note = marketEmptyNote(5, pending(5), false, 0);
    expect(note).toContain("후보 5곳을 찾았지만 아직 동일상품으로 판정된 곳이 없습니다.");
    expect(note).not.toContain(MARKET_EMPTY_NO_COMPARABLE_PRICE);
  });

  it("A-6 🟢 인자를 안 넘기면 **동작이 한 글자도 바뀌지 않는다**(기존 호출부 불변)", () => {
    expect(marketEmptyNote(5, pending(5), false)).toBe(marketEmptyNote(5, pending(5), false, 0));
  });

  it("A-7 🟢 「동일상품 확인 0곳」 머리는 **유지** 된다(두 블록이 같은 축을 같은 말로 쓴다)", () => {
    expect(marketEmptyNote(5, pending(5), false, 5)).toContain(`${SAME_CONFIRMED_COUNT_LABEL} 0건`);
  });
});

describe("STAGE 7-3 — B. 배선 — 화면이 그 수를 «실제로» 넘기는가", () => {
  /**
   * 🔴🔴 WU-110 교훈 — 순수 함수만 단언하면 **배선이 끊겨도 통과** 한다.
   *    🟢 그래서 호출부 소스를 같이 본다(집계가 센 두 수를 그대로 넘기는가).
   */
  const SRC = readFileSync(join(__dirname, "..", "MarketPriceComparison.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

  it("B-1 🔴 호출부가 **두 수를 더해** 넘긴다(7-1 미확인 + 7-2 상품 차이)", () => {
    expect(SRC).toContain("reference?.unverifiedCount ?? 0");
    expect(SRC).toContain("reference?.observedDifferenceCount ?? 0");
  });

  it("B-2 🔴 문구를 호출부에서 **다시 적지 않는다**(owner 는 상수 하나다)", () => {
    expect(SRC).not.toContain("비교할 수 있는 판매처가 아직");
  });

  it("B-3 🔴 집계가 그 두 수의 owner 다 — 화면이 가격 신뢰도·차이를 **재판정하지 않는다**", () => {
    expect(SRC).not.toContain("VERIFIED_CURRENT");
    expect(SRC).not.toContain("hasObservedDifference");
  });
});
