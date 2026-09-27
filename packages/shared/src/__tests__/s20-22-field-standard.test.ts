import { describe, expect, it } from "vitest";
import {
  alreadyKnown,
  fieldBlocksRegistration,
  FIELD_SOURCE_PRIORITY,
  tallyFields,
  tallyOf,
  type ResolvedField,
} from "../field-requirement";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 장기 스프린트 S-20/21/22 — **Commerce 가 30개가 되어도 셀러 화면은 셋이다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 최종 기준: 새 채널이 「필드 40개 필요」라고 해도 셀러가 보는 것은
 *
 *     자동 34 · 확인 3 · 입력 3
 *
 * 이어야 한다. **입력칸 40개를 만드는 것은 실패다.**
 */

const f = (p: Partial<ResolvedField>): ResolvedField => ({
  kind: "REQUIRED",
  source: "MISSING",
  hasValue: false,
  ...p,
});

describe("S-20 ① 네 가지가 «서로 다른 일» 을 한다", () => {
  it("REQUIRED — 값이 없으면 막는다", () => {
    expect(fieldBlocksRegistration(f({ kind: "REQUIRED" }))).toBe(true);
    expect(fieldBlocksRegistration(f({ kind: "REQUIRED", hasValue: true, source: "COMMON_PRODUCT" }))).toBe(false);
  });

  /* 🔴 조건이 «성립하지 않으면» 막지 않는다. KC 대상이 아닌 상품에 인증번호를
     요구하면 팔 수 있는 물건이 등록되지 않는다. */
  it("CONDITIONAL_REQUIRED — 조건이 성립할 때만 막는다", () => {
    expect(fieldBlocksRegistration(f({ kind: "CONDITIONAL_REQUIRED", conditionMet: false }))).toBe(false);
    expect(fieldBlocksRegistration(f({ kind: "CONDITIONAL_REQUIRED", conditionMet: true }))).toBe(true);
  });

  it("OPTIONAL — 없어도 등록된다", () => {
    expect(fieldBlocksRegistration(f({ kind: "OPTIONAL" }))).toBe(false);
  });

  /* 🔴 이 표준의 핵심. 값이 «있어도» 판매자가 확인하기 전에는 확인 대상이다.
     시스템이 찾아낸 값이라도 판매자가 책임질 값이면 대신 확정하지 않는다 —
     KC 를 임의로 「대상 아님」으로 정해 버리는 사고가 이 축이 없을 때 난다. */
  it("USER_CONFIRMATION — 값이 있어도 «확인» 이다", () => {
    expect(tallyOf(f({ kind: "USER_CONFIRMATION", hasValue: true, source: "COMMON_PRODUCT" }))).toBe("confirm");
    expect(tallyOf(f({ kind: "USER_CONFIRMATION", hasValue: true, source: "USER_CONFIRMED" }))).toBe("auto");
  });
});

describe("S-21 ② 이미 아는 값을 «다시 묻지» 않는다", () => {
  it.each(["USER_CONFIRMED", "COMMON_PRODUCT", "CATEGORY", "SELLER_SETTINGS"] as const)(
    "%s 에서 나온 값은 셀러의 할 일이 아니다",
    (source) => {
      expect(alreadyKnown(f({ source, hasValue: true }))).toBe(true);
    },
  );

  /* 🔴 DEFAULT 는 «우리가 채운» 값이다. 판매자가 정한 적이 없으므로 「이미
     안다」에 넣지 않는다 — 넣으면 근거 없는 상수가 조용히 승인된다(C-2B 부류). */
  it("DEFAULT 는 «이미 안다» 가 아니다", () => {
    expect(alreadyKnown(f({ source: "DEFAULT", hasValue: true }))).toBe(false);
  });

  it("출처 우선순위가 Common 을 채널보다 «먼저» 본다", () => {
    expect(FIELD_SOURCE_PRIORITY[0]).toBe("USER_CONFIRMED");
    expect(FIELD_SOURCE_PRIORITY.indexOf("COMMON_PRODUCT")).toBeLessThan(
      FIELD_SOURCE_PRIORITY.indexOf("DEFAULT"),
    );
  });
});

describe("S-22 ③ 🔴 Commerce 가 30개가 되어도 «종류» 는 셋이다", () => {
  /** 새 채널이 40개를 요구하는 상황을 그대로 만든다. */
  function fortyFields(): ResolvedField[] {
    const auto = Array.from({ length: 34 }, () =>
      f({ kind: "REQUIRED", hasValue: true, source: "COMMON_PRODUCT" }),
    );
    const confirm = Array.from({ length: 3 }, () => f({ kind: "USER_CONFIRMATION", source: "CATEGORY" }));
    const input = Array.from({ length: 3 }, () => f({ kind: "REQUIRED", source: "MISSING" }));
    return [...auto, ...confirm, ...input];
  }

  it("필드 40개가 «자동 34 · 확인 3 · 입력 3» 으로 접힌다", () => {
    expect(tallyFields(fortyFields())).toEqual({ auto: 34, confirm: 3, input: 3 });
  });

  it("셀러가 보는 덩어리는 «셋» 뿐이다 — 채널이 늘어도 늘지 않는다", () => {
    expect(Object.keys(tallyFields(fortyFields())).sort()).toEqual(["auto", "confirm", "input"]);
  });

  /* 🔴 조건 미성립 항목은 «아무 덩어리에도» 들어가지 않는다. 지금 필요 없는
     값을 「확인 필요」로 세면 셀러는 할 일이 없는데 할 일이 있다고 읽는다. */
  it("조건이 성립하지 않은 항목은 세지 않는다", () => {
    const t = tallyFields([f({ kind: "CONDITIONAL_REQUIRED", conditionMet: false })]);
    expect(t).toEqual({ auto: 0, confirm: 0, input: 0 });
  });
});
