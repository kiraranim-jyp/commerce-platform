import { describe, expect, it } from "vitest";
import type { PlatformId } from "@commerce/shared";
import { buildRegistrationChannels, channelActionLabel } from "../registration-channels";

/**
 * MI-FLOW-2(CEO 지시, 2026-09-11) — Action Center의 등록 버튼 목록.
 *
 * 고정하려는 것 두 가지:
 *  ① 채널 목록은 PLATFORM_ORDER 하나에서만 나온다(버튼을 JSX에 손으로 적지
 *     않는다). 채널이 늘면 버튼도 자동으로 는다.
 *  ② 준비중 채널을 목록에서 빼지 않는다 — "없는 것"과 "아직인 것"은 셀러에게
 *     다른 사실이고, 숨기면 "따조는 쿠팡을 지원 안 하나?"가 된다.
 */
const ORDER = ["smartstore", "coupang", "elevenst"] as PlatformId[];
const LABELS: Record<string, string> = {
  smartstore: "스마트스토어",
  coupang: "쿠팡",
  elevenst: "11번가",
};

function build(readiness: Parameters<typeof buildRegistrationChannels>[0]["readiness"] = {}) {
  return buildRegistrationChannels({
    order: ORDER,
    labelOf: (id) => LABELS[id],
    isComingSoon: (id) => id === "smartstore" || id === "elevenst",
    isPreviewOnly: (id) => id === "smartstore",
    readiness,
  });
}

describe("buildRegistrationChannels()", () => {
  it("채널 목록은 주어진 순서 전체를 그대로 따른다", () => {
    expect(build().map((c) => c.id)).toEqual(ORDER);
  });

  it("준비중 채널도 목록에 남기되 상태를 구분한다", () => {
    const byId = Object.fromEntries(build().map((c) => [c.id, c]));
    expect(byId.coupang.availability).toBe("AVAILABLE");
    expect(byId.smartstore.availability).toBe("PREVIEW_ONLY");
    expect(byId.elevenst.availability).toBe("COMING_SOON");
  });

  it("준비 상태를 모르는 채널을 '준비됨'으로 읽히게 만들지 않는다", () => {
    const coupang = build().find((c) => c.id === "coupang")!;
    // 부족 항목 0건이지만 state가 null이다 — 호출부는 둘을 함께 봐야 한다.
    expect(coupang.state).toBeNull();
    expect(coupang.blockingCount).toBe(0);
  });

  it("이미 계산된 준비 상태와 부족 항목 수를 그대로 옮긴다", () => {
    const channels = build({
      coupang: {
        state: "NEEDS_REVIEW",
        priorityItems: [
          { key: "category", label: "카테고리 확인", sourceItems: [] },
          { key: "legal", label: "원산지", sourceItems: [] },
        ],
        provisional: true,
      },
    });
    const coupang = channels.find((c) => c.id === "coupang")!;
    expect(coupang.state).toBe("NEEDS_REVIEW");
    expect(coupang.blockingCount).toBe(2);
    expect(coupang.provisional).toBe(true);
  });
});

describe("channelActionLabel()", () => {
  it("내부 상태명을 버튼 문구에 쓰지 않는다", () => {
    const labels = build().map(channelActionLabel);
    expect(labels).toContain("쿠팡 등록");
    expect(labels).toContain("11번가 준비중");
    for (const label of labels) {
      expect(label).not.toContain("READY");
      expect(label).not.toContain("COMING_SOON");
    }
  });
});
