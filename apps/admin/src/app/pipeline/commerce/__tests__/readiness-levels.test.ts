import { describe, expect, it } from "vitest";
import { readinessStateToLevel } from "../readiness-state";

/**
 * N-4.08 STEP6-9 — 예전 deriveReadinessLevels()/overallReadinessLevel()
 * (N-4.02 Part E)는 dead code로 확인되어 제거했다(readiness.ts 참고). 이
 * 테스트는 그 자리를 대신하는 readinessStateToLevel()이 실제 화면에서 쓰는
 * 유일한 소스(RegistrationReadinessState)를 정확히 3단계로 매핑하는지만
 * 확인한다 — 새 판정 로직이 아니라 이름표만 다시 붙이는 순수 함수다.
 */
describe("readinessStateToLevel()", () => {
  it("READY → GREEN", () => {
    expect(readinessStateToLevel("READY")).toBe("GREEN");
  });

  it("NEEDS_REVIEW → YELLOW", () => {
    expect(readinessStateToLevel("NEEDS_REVIEW")).toBe("YELLOW");
  });

  it("SELLER_REVIEW → YELLOW(판매자 확인 대기 — 데이터 누락과는 다른 성격이라 RED로 묶지 않는다)", () => {
    expect(readinessStateToLevel("SELLER_REVIEW")).toBe("YELLOW");
  });

  it("BLOCKED → RED", () => {
    expect(readinessStateToLevel("BLOCKED")).toBe("RED");
  });
});
