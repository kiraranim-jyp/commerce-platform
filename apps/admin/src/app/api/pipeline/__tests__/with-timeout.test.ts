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

  /**
   * P-14-2(CPO 지시, 2026-09-01) — timeout 이후 browser.close()로 인해 원래
   * page.evaluate()가 뒤늦게 reject되는 상황(코드 감사로 확인된 시나리오)을
   * unhandled rejection 없이 안전하게 흡수하는지 검증한다.
   */
  it("T-4: timeout 이후 원본 promise가 나중에 reject돼도 unhandled rejection이 발생하지 않는다", async () => {
    let rejectLate: (err: Error) => void = () => {};
    const lateRejecting = new Promise<string>((_, reject) => {
      rejectLate = reject;
    });

    const unhandled: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandledRejection);

    try {
      await expect(withTimeout(lateRejecting, 20, "late-op")).rejects.toThrow(ExtractionTimeoutError);
      rejectLate(new Error("Target page, context or browser has been closed"));
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(unhandled).toHaveLength(0);
    } finally {
      process.off("unhandledRejection", onUnhandledRejection);
    }
  });

  /**
   * universal-extractor.ts는 3개의 withTimeout() 호출을 순차 await 체인으로 배선한다
   * (autoScroll(1) → autoScroll(2) → extractProductData). 한 단계가 timeout되면
   * 그 즉시 함수 전체가 throw되어 다음 단계가 실행되지 않는다는 것을 순수 함수
   * 조합으로 재현해 검증한다.
   */
  it("T-5: 한 단계가 timeout되면 이후 단계는 실행되지 않는다(순차 await 체인)", async () => {
    let step2Called = false;
    const hang = new Promise<string>(() => {});

    async function simulateSequentialSteps() {
      await withTimeout(hang, 20, "step1");
      step2Called = true;
    }

    await expect(simulateSequentialSteps()).rejects.toThrow(ExtractionTimeoutError);
    expect(step2Called).toBe(false);
  });

  /**
   * universal-extractor.ts의 각 withTimeout() 호출은 자기 자신의 setTimeout/Promise.race를
   * 독립적으로 만든다(모듈 레벨 공유 상태 없음) — 상품 A 요청의 timeout이 동시에 진행 중인
   * 상품 B 요청의 결과나 타이머에 영향을 주지 않는지 검증한다.
   */
  it("T-6: 동시에 실행된 두 withTimeout()은 서로 독립적이다(A timeout, B 정상)", async () => {
    const hangA = new Promise<string>(() => {});
    const fastB = new Promise<string>((resolve) => setTimeout(() => resolve("B-result"), 10));

    const [resultA, resultB] = await Promise.allSettled([
      withTimeout(hangA, 20, "extraction-A"),
      withTimeout(fastB, 1000, "extraction-B"),
    ]);

    expect(resultA.status).toBe("rejected");
    if (resultA.status === "rejected") {
      expect(resultA.reason).toBeInstanceOf(ExtractionTimeoutError);
    }
    expect(resultB.status).toBe("fulfilled");
    if (resultB.status === "fulfilled") {
      expect(resultB.value).toBe("B-result");
    }
  });

  /**
   * T-4(늦은 reject)의 반대 케이스 — timeout 이후 원본 promise가 reject가 아니라
   * resolve로 뒤늦게 끝나는 경우(예: browser.close() 타이밍에 따라 evaluate가
   * close 직전에 정상 값을 반환하는 경쟁 상황)도 추가 오류 없이 조용히 무시되는지 확인한다.
   */
  it("T-7: timeout 이후 원본 promise가 나중에 resolve돼도 추가 오류가 발생하지 않는다", async () => {
    let resolveLate: (value: string) => void = () => {};
    const lateResolving = new Promise<string>((resolve) => {
      resolveLate = resolve;
    });

    await expect(withTimeout(lateResolving, 20, "late-resolve-op")).rejects.toThrow(ExtractionTimeoutError);
    expect(() => resolveLate("late-value")).not.toThrow();
  });
});
