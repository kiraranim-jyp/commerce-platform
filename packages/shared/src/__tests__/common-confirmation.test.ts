import { describe, expect, it } from "vitest";
import { toCommonConfirmation, type StoredComplianceConfirmation } from "../common-confirmation";
import type { CommonConfirmationScope } from "../common-field";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * Common Confirmation **읽기 계약**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일이 지키는 것은 두 가지다 —
 *
 *   ① 기존 스마트스토어 저장값을 «그대로» 읽는다 (값도 범위도 같다)
 *   ② 범위가 달라지면 «같은 확인이 아니다»
 *
 * 판정 규칙은 새로 만든 것이 아니다. 스마트스토어 등록 게이트가 이미 그렇게
 * 한다(`smartstore/register/route.ts:421`) — confirmed · policyVersion ·
 * categoryCode. 거기에 `platform` 이 하나 더 붙는데, 그 테이블을 한 채널만
 * 쓰고 있어서 지금까지 필요 없었을 뿐이다.
 */

/** 실제 저장 행의 모양 그대로. */
const STORED: StoredComplianceConfirmation = {
  confirmed: true,
  policyVersion: "2026-08-19",
  confirmedAt: "2026-09-28T00:00:00Z",
  platform: "smartstore",
  categoryCode: "50000167",
};

const SCOPE: CommonConfirmationScope = {
  platform: "smartstore",
  categoryCode: "50000167",
  policyVersion: "2026-08-19",
};

describe("① 기존 저장값을 «그대로» 읽는다 — 값도 범위도 같다", () => {
  it("네 칸이 저장된 것과 일치한다", () => {
    const common = toCommonConfirmation(STORED, SCOPE);
    expect(common).toEqual({
      confirmed: true,
      confirmedAt: STORED.confirmedAt,
      policyVersion: STORED.policyVersion,
      platform: STORED.platform,
      categoryCode: STORED.categoryCode,
    });
  });

  it("🔴 `kcStatus` 를 Common 상태로 «바꾸지 않는다»", () => {
    /* 저장 행에 kcStatus 가 있어도 결과에 들어오지 않는다 — 그것은
       스마트스토어 어휘이고 게이트도 보지 않는 감사 기록이다. */
    const withStatus = { ...STORED, kcStatus: "SELLER_REVIEW_REQUIRED" } as StoredComplianceConfirmation;
    expect(Object.keys(toCommonConfirmation(withStatus, SCOPE)!).sort()).toEqual([
      "categoryCode",
      "confirmed",
      "confirmedAt",
      "platform",
      "policyVersion",
    ]);
  });
});

describe("🔴 ② 「확인함」이 아니면 확인이 아니다", () => {
  it("confirmed=false 는 null", () => {
    expect(toCommonConfirmation({ ...STORED, confirmed: false }, SCOPE)).toBeNull();
  });

  it("기록이 없으면 null", () => {
    expect(toCommonConfirmation(null, SCOPE)).toBeNull();
    expect(toCommonConfirmation(undefined, SCOPE)).toBeNull();
  });

  it("🔴 확인 객체는 «항상» confirmed=true 다 — false 인 객체를 만들지 않는다", () => {
    /* `if (confirmation)` 만 보는 호출부가 미확인을 확인으로 읽지 않게 한다. */
    expect(toCommonConfirmation(STORED, SCOPE)?.confirmed).toBe(true);
  });
});

describe("🔴 ③ 범위가 달라지면 «같은 확인이 아니다»", () => {
  it("카테고리가 다르면 무효다 — A 에서 확인한 것이 B 를 통과시키지 않는다", () => {
    expect(toCommonConfirmation(STORED, { ...SCOPE, categoryCode: "50000168" })).toBeNull();
  });

  it("정책 버전이 다르면 무효다 — 과거 확인을 영구히 신뢰하지 않는다", () => {
    expect(toCommonConfirmation(STORED, { ...SCOPE, policyVersion: "2027-01-01" })).toBeNull();
  });

  it("🔴 채널이 다르면 무효다 — 스마트스토어 확인이 롯데ON 을 통과시키지 않는다", () => {
    expect(toCommonConfirmation(STORED, { ...SCOPE, platform: "lotteon" })).toBeNull();
  });

  it("세 축이 «모두» 맞을 때만 통과한다", () => {
    expect(toCommonConfirmation(STORED, SCOPE)).not.toBeNull();
    for (const broken of [
      { ...SCOPE, platform: "coupang" },
      { ...SCOPE, categoryCode: "99999999" },
      { ...SCOPE, policyVersion: "2020-01-01" },
    ]) {
      expect(toCommonConfirmation(STORED, broken)).toBeNull();
    }
  });
});

describe("🔴 ④ 범위가 «비어 있으면» 확인으로 치지 않는다", () => {
  it.each([
    ["정책 버전", { policyVersion: "  " }],
    ["확인 시각", { confirmedAt: "" }],
    ["채널", { platform: "" }],
    ["카테고리", { categoryCode: "   " }],
  ])("%s 가 비면 null", (_label, patch) => {
    expect(toCommonConfirmation({ ...STORED, ...patch }, SCOPE)).toBeNull();
  });
});

describe("⑤ 스마트스토어 게이트와 «같은 판정» 인가", () => {
  /** register/route.ts:421 의 조건을 그대로 옮긴 것. 바뀌면 안 되는 기준이다. */
  const legacyGate = (stored: StoredComplianceConfirmation, scope: CommonConfirmationScope) =>
    stored.confirmed === true &&
    stored.policyVersion === scope.policyVersion &&
    stored.categoryCode === scope.categoryCode;

  const cases: [string, Partial<StoredComplianceConfirmation>, Partial<CommonConfirmationScope>][] = [
    ["정상", {}, {}],
    ["미확인", { confirmed: false }, {}],
    ["정책 불일치", {}, { policyVersion: "2027-01-01" }],
    ["카테고리 불일치", {}, { categoryCode: "50000168" }],
  ];

  it.each(cases)("%s — 같은 결론을 낸다", (_label, storedPatch, scopePatch) => {
    const stored = { ...STORED, ...storedPatch };
    const scope = { ...SCOPE, ...scopePatch };
    expect(toCommonConfirmation(stored, scope) !== null).toBe(legacyGate(stored, scope));
  });
});
