// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CategoryRecommendationPanel } from "../CategoryRecommendationPanel";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COMMERCE-UI-PARITY-02 P1-3(CEO 지시, 2026-09-22)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 「SmartStore category recommendation — 실제 추천 API/데이터 흐름 확인 →
 *   정상 결과 / 없음 / error 를 명확히 표시」
 *
 * ── 고치기 «전» 에 무슨 일이 있었나 ────────────────────────────────────────
 * CommerceWorkspace 의 /api/naver/category-search 효과는 두 갈래에서 실패를
 * **빈 배열**로 바꿔 담았다:
 *
 *     data.status !== "OK"  →  naverApiCandidates = []
 *     catch                 →  naverApiCandidates = []
 *
 * 그러면 화면은 그 빈 배열을 보고 「⚠️ 카테고리를 자동으로 결정하지
 * 못했습니다」라고 말한다 — 추천기가 상품을 보고 «못 고른 것» 과 조회가
 * «닿지도 못한 것» 이 한 문장이 된다. 셀러는 다시 시도하면 풀릴 일인지를
 * 그 문장에서 알 수 없고, 스마트스토어에는 [다시 확인] 버튼도 없었다
 * (쿠팡에만 있었다 — CategoryRecommendationPanel 의 `isCoupang` 분기).
 *
 * 🔴 로딩 자체는 «원래 정상» 이었다. try/catch/finally 가 전부 있고 finally 가
 *    naverCategoryLoading 을 내린다 — 영구 로딩 경로는 없었다. 고친 것은
 *    「실패를 결과 없음으로 바꿔 말하던 것」 하나다.
 */

const BASE = {
  candidates: [],
  selection: { status: "PENDING" } as never,
  onSelect: () => {},
};

const draw = (props: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(CategoryRecommendationPanel, { ...BASE, ...props } as never));

const NO_RESULT = "카테고리를 자동으로 결정하지 못했습니다";
const FAILED = "카테고리 조회 실패";

describe("P1-3 스마트스토어 카테고리 — 네 상태가 서로 다른 말을 쓴다", () => {
  it("CHECKING — 조회 중에는 실패도 결과없음도 말하지 않는다", () => {
    const html = draw({ candidatesLoading: true });
    expect(html).toContain("AI 추천을 불러오는 중…");
    expect(html).not.toContain(FAILED);
    expect(html).not.toContain(NO_RESULT);
  });

  it("🔴 ERROR — 조회가 실패하면 «실패»라고 말하고 사유를 그대로 싣는다", () => {
    const html = draw({ candidatesError: "스마트스토어 카테고리를 조회하지 못했습니다." });
    expect(html).toContain(FAILED);
    expect(html).toContain("스마트스토어 카테고리를 조회하지 못했습니다.");
    // 🔴 이것이 이 작업의 핵심이다 — 실패가 「못 고름」으로 새지 않는다.
    expect(html).not.toContain(NO_RESULT);
  });

  it("🔴 ERROR — 다시 시도할 길을 함께 준다(쿠팡에만 있던 [다시 확인])", () => {
    const html = draw({ candidatesError: "조회 실패", onRetryCandidates: () => {} });
    expect(html).toContain("다시 확인");
  });

  it("NO_RESULT — 조회는 «됐는데» 고를 후보가 없을 때만 그렇게 말한다(무회귀)", () => {
    const html = draw({});
    expect(html).toContain(NO_RESULT);
    expect(html).not.toContain(FAILED);
  });

  it("🔴 조회 중에 남아 있던 직전 실패가 앞으로 나오지 않는다 — 로딩이 이긴다", () => {
    const html = draw({ candidatesLoading: true, candidatesError: "조회 실패" });
    expect(html).toContain("AI 추천을 불러오는 중…");
    expect(html).not.toContain(FAILED);
  });

  it("후보를 실제로 찾았으면 실패도 결과없음도 서지 않는다", () => {
    const html = draw({
      candidates: [
        {
          id: "50000000",
          name: "반바지",
          path: ["패션의류", "유아동의류", "반바지"],
          platform: "smartstore",
          confidence: 0.9,
          reason: ["상품유형 일치"],
          source: "rule",
          isVerifiedPlatformCode: true,
        },
      ],
      candidatesError: "조회 실패",
    });
    expect(html).not.toContain(FAILED);
    expect(html).not.toContain(NO_RESULT);
    expect(html).toContain("반바지");
  });
});

describe("P1-3 쿠팡은 건드리지 않았다", () => {
  it("🔴 쿠팡 탭(onFetchCoupangCategory 있음)은 예전 문구 그대로다", () => {
    const html = draw({ onFetchCoupangCategory: () => {}, recommendAttempted: true });
    expect(html).toContain("추천 결과가 없습니다");
    expect(html).not.toContain(FAILED);
  });

  it("쿠팡의 [다시 확인]은 그대로 있다", () => {
    const html = draw({ onFetchCoupangCategory: () => {}, recommendAttempted: true });
    expect(html).toContain("다시 확인");
  });
});
