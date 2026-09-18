import { describe, expect, it } from "vitest";
import { classifyNetworkError } from "../connection-error";

/**
 * P0-C.1(CEO 실측, 2026-09-17) — 쿠팡·네이버 연결 확인이 둘 다
 * 「연결 확인 중 문제가 발생했습니다 · 잠시 후 다시 시도해 주세요」로 끝났다.
 * 그 문구는 classifyNetworkError의 UNKNOWN_ERROR 분기이고, 거기 떨어진 이유는
 * 정규식이 `ETIMEDOUT`(OS 소켓 타임아웃)만 알고 Node/undici가
 * AbortSignal.timeout으로 끊을 때 쓰는 문구를 몰랐기 때문이다.
 *
 * 🔴 이 테스트는 «실제로 관측된 문자열»을 쓴다. node에서 재현해 확인했다:
 *      AbortSignal.timeout → TimeoutError / "The operation was aborted due to timeout"
 *      ECONNREFUSED        → TypeError    / "fetch failed"
 *    지어낸 메시지로 테스트하면 다음에 또 같은 자리에서 샌다.
 */

describe("🔴 타임아웃은 «알 수 없는 오류»가 아니다", () => {
  it("AbortSignal.timeout 의 실제 예외 → TIMEOUT_ERROR", () => {
    // Node 실측: name="TimeoutError", message="The operation was aborted due to timeout"
    const error = Object.assign(new Error("The operation was aborted due to timeout"), {
      name: "TimeoutError",
    });
    const result = classifyNetworkError(error);
    expect(result.errorType, "20초 타임아웃이 또 UNKNOWN 으로 샜다").toBe("TIMEOUT_ERROR");
    expect(result.userMessage).toContain("시간이 초과");
  });

  it("네이버처럼 호출부가 원본 예외를 자체 메시지로 감싸도 잡는다", () => {
    // naver/_lib/client.ts 는 step=NETWORK_ERROR 일 때 error.message 를 그대로
    // 실어 보내고, auth-test 라우트가 new Error(message) 로 다시 감싼다 —
    // 그 과정에서 name 이 "Error" 로 바뀐다.
    const result = classifyNetworkError(new Error("The operation was aborted due to timeout"));
    expect(result.errorType).toBe("TIMEOUT_ERROR");
  });

  it("undici 커넥트 타임아웃 코드도 잡는다", () => {
    const result = classifyNetworkError(new Error("Connect Timeout Error (UND_ERR_CONNECT_TIMEOUT)"));
    expect(result.errorType).toBe("TIMEOUT_ERROR");
  });
});

describe("기존 분류는 그대로다 (회귀)", () => {
  it("ECONNREFUSED 의 실제 예외 → NETWORK_ERROR (TIMEOUT 이 아니다)", () => {
    // Node 실측: TypeError / "fetch failed"
    const result = classifyNetworkError(new TypeError("fetch failed"));
    expect(result.errorType).toBe("NETWORK_ERROR");
    expect(result.userMessage).toContain("연결할 수 없습니다");
  });

  it("ENOTFOUND → NETWORK_ERROR", () => {
    expect(classifyNetworkError(new Error("getaddrinfo ENOTFOUND api.example.com")).errorType).toBe(
      "NETWORK_ERROR",
    );
  });

  it("정말 모르는 것만 UNKNOWN_ERROR 로 남는다", () => {
    const result = classifyNetworkError(new Error("무언가 이상한 일"));
    expect(result.errorType).toBe("UNKNOWN_ERROR");
  });

  it("Error 가 아닌 값도 던져질 수 있다 — 터지지 않는다", () => {
    expect(classifyNetworkError("문자열 오류").errorType).toBe("UNKNOWN_ERROR");
    expect(classifyNetworkError(null).errorType).toBe("UNKNOWN_ERROR");
  });
});

describe("🔴 타임아웃과 연결 거부는 «다음에 할 일»이 다르다", () => {
  it("타임아웃 안내는 프록시/IP 허용목록을 가리킨다 — 키를 다시 보라고 하지 않는다", () => {
    const timeout = classifyNetworkError(new Error("The operation was aborted due to timeout"));
    expect(timeout.nextAction).toContain("허용목록");
    const refused = classifyNetworkError(new TypeError("fetch failed"));
    expect(refused.nextAction).not.toBe(timeout.nextAction);
  });
});
