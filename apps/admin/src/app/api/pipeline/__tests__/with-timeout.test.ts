import { describe, expect, it } from "vitest";
import { ExtractionTimeoutError, withTimeout } from "@commerce/crawler";

/**
 * P-14-1(CPO 지시, 2026-09-01) — universal-extractor.ts의 autoScroll()/
 * extractProductData() 호출을 감싸는 withTimeout()이 실제 사이트 호출 없이도
 * 검증되는지 확인한다. T-1(정상 완료)/T-2(timeout)/T-3(기존 navigationTimeoutMs
 * 값 그대로 재사용 가능한지)만 다룬다 — 새 테스트 환경 설치 없이 apps/admin의
 * 기존 vitest로 @commerce/crawler를 import해서 검증한다.
 */
describe("withTimeout", () => {
  it("T-1: 제한시간 안에 끝나면 정상 값을 그대로 반환한다", async () => {
    const fast = new Promise<string>((resolve) => setTimeout(() => resolve("done"), 10));
    await expect(withTimeout(fast, 1000, "fast-op")).resolves.toBe("done");
  });

  it("T-2: 제한시간을 넘기면 ExtractionTimeoutError로 실패한다(무한 대기 아님)", async () => {
    const hang = new Promise<string>(() => {
      // 의도적으로 절대 resolve하지 않음 — autoScroll()의 scrollHeight가
      // 안정되지 않는 상황을 재현한다.
    });
    await expect(withTimeout(hang, 50, "hanging-op")).rejects.toThrow(ExtractionTimeoutError);
    await expect(withTimeout(hang, 50, "hanging-op")).rejects.toThrow(/hanging-op timed out after 50ms/);
  });

  it("T-3: 원래 promise가 reject되면 timeout 여부와 무관하게 그 reject 사유를 그대로 전달한다", async () => {
    const failFast = Promise.reject(new Error("original failure"));
    await expect(withTimeout(failFast, 1000, "op")).rejects.toThrow("original failure");
  });
});
