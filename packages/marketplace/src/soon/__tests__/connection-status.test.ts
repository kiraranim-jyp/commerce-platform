import { describe, expect, it } from "vitest";
import { resolveSoonConnectionStatus } from "../connection-status";

describe("resolveSoonConnectionStatus", () => {
  it("공식 API 스펙이 없으면 credential 유무와 무관하게 NOT_AVAILABLE", () => {
    expect(resolveSoonConnectionStatus(true, false)).toBe("NOT_AVAILABLE");
    expect(resolveSoonConnectionStatus(false, false)).toBe("NOT_AVAILABLE");
  });

  it("스펙은 있는데 credential이 없으면 NOT_CONFIGURED", () => {
    expect(resolveSoonConnectionStatus(false, true)).toBe("NOT_CONFIGURED");
  });

  it("스펙도 있고 credential도 있으면 READY_FOR_CONNECTION", () => {
    expect(resolveSoonConnectionStatus(true, true)).toBe("READY_FOR_CONNECTION");
  });
});
