import { describe, expect, it } from "vitest";
import { isE1VisionCandidate, pickE1Candidate } from "../vision-observation";

/**
 * P0-A.30.2(CEO 결정, 2026-09-20) — E1 게이트.
 *
 * 실측(2026-09-20, 상품 26개 · 국내 후보 108건):
 *   UNKNOWN 66 · SIMILAR 26 · CONFLICT 15 · PRESUMED_SAME 1 · SAME 0
 * LOOXLOO 혼자 후보 85건을 만들고 그중 63건이 UNKNOWN 이었다. 그 63건을 그대로
 * Vision 에 보내면 소음이 그대로 비용이 된다 — 그래서 UNKNOWN 을 막는다.
 */
describe("E1: 무엇을 눈으로 볼 것인가", () => {
  it("🔴 UNKNOWN 은 보지 않는다 — 축이 «하나도» 안 맞았다는 뜻이다", () => {
    expect(isE1VisionCandidate("UNKNOWN")).toBe(false);
  });

  it("🔴 CONFLICT 는 보지 않는다 — 반증이 있다", () => {
    expect(isE1VisionCandidate("CONFLICT")).toBe(false);
  });

  it("판정이 아예 없는 후보도 보지 않는다 — 없는 근거를 만들지 않는다", () => {
    expect(isE1VisionCandidate(undefined)).toBe(false);
    expect(isE1VisionCandidate(null)).toBe(false);
  });

  for (const v of ["SAME", "PRESUMED_SAME", "SIMILAR"] as const) {
    it(`${v} 는 관측 대상이다`, () => {
      expect(isE1VisionCandidate(v)).toBe(true);
    });
  }
});

const c = (crossSellerVerdict: string | undefined, confidence: number, imageUrl: string | null = "https://x/i.jpg") => ({
  crossSellerVerdict,
  confidence,
  imageUrl,
});

describe("(상품,샵)당 한 건만 본다 — 근거가 강한 쪽", () => {
  it("SAME > PRESUMED_SAME > SIMILAR 순으로 고른다", () => {
    const got = pickE1Candidate([c("SIMILAR", 0.9), c("SAME", 0.1), c("PRESUMED_SAME", 0.8)]);
    expect(got?.crossSellerVerdict).toBe("SAME");
  });

  it("같은 등급이면 confidence 가 높은 쪽", () => {
    const got = pickE1Candidate([c("SIMILAR", 0.3), c("SIMILAR", 0.7)]);
    expect(got?.confidence).toBe(0.7);
  });

  it("🔴 이미지가 없는 후보는 고르지 않는다 — 볼 그림이 없으면 관측이 성립하지 않는다", () => {
    expect(pickE1Candidate([c("SAME", 0.9, null)])).toBeNull();
  });

  it("E1 후보가 하나도 없으면 null — 억지로 하나 만들지 않는다", () => {
    expect(pickE1Candidate([c("UNKNOWN", 0.9), c("CONFLICT", 0.9)])).toBeNull();
  });

  it("🔴 UNKNOWN 이 섞여 있어도 그건 절대 뽑히지 않는다", () => {
    const got = pickE1Candidate([c("UNKNOWN", 0.99), c("SIMILAR", 0.2)]);
    expect(got?.crossSellerVerdict).toBe("SIMILAR");
  });
});
