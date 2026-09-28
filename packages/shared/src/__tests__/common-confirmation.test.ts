import { describe, expect, it } from "vitest";
import { toCommonConfirmation } from "../common-confirmation";

/**
 * 🔴 「행이 있다」와 「확인했다」는 다른 사실이다. 섞으면 확인하지 않은 것을
 * 확인했다고 말하게 된다 — 이 저장소가 KC 에서 이미 한 번 겪은 실수다.
 */
describe("기존 확인 기록 → Common 확인", () => {
  const row = { confirmed: true, policyVersion: "2026-08-19", confirmedAt: "2026-09-28T00:00:00Z" };

  it("확인된 기록을 그대로 읽는다", () => {
    expect(toCommonConfirmation(row)?.policyVersion).toBe("2026-08-19");
  });

  it("🔴 confirmed=false 는 «확인이 아니다»", () => {
    expect(toCommonConfirmation({ ...row, confirmed: false })).toBeNull();
  });

  it("기록이 없으면 null", () => {
    expect(toCommonConfirmation(null)).toBeNull();
    expect(toCommonConfirmation(undefined)).toBeNull();
  });

  it("🔴 정책이 바뀌면 과거의 확인을 신뢰하지 않는다", () => {
    expect(toCommonConfirmation(row, "2026-08-19")).not.toBeNull();
    expect(toCommonConfirmation(row, "2027-01-01")).toBeNull();
  });

  it("버전이나 시각이 비어 있으면 확인으로 치지 않는다", () => {
    expect(toCommonConfirmation({ ...row, policyVersion: "  " })).toBeNull();
    expect(toCommonConfirmation({ ...row, confirmedAt: "" })).toBeNull();
  });
});
