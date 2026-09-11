import { describe, expect, it } from "vitest";
import {
  BIG_STEP_ORDER,
  MARKET_SIGNAL_NOT_STARTED,
  resolveWorkflow,
  type CollectionSignal,
  type MarketSignal,
  type PrepareSignal,
  type RegisterSignal,
  type WorkflowInput,
} from "../workflow";

/**
 * UX 2.1(CEO 지시, 2026-09-11) — 하나뿐인 작업 Flow가 지켜야 하는 규칙.
 *
 * ── 이 파일이 지키는 것 ──────────────────────────────────────────────────
 * 1. 큰 단계는 언제나 정확히 하나만 활성이다. 진행 표시가 셋이었던 시절로
 *    돌아가는 가장 흔한 방식이 "두 단계가 동시에 진행 중"이다.
 * 2. 하위 단계는 순서대로 하나씩 넘어간다. 사용자가 누르는 버튼은 없다.
 * 3. **데이터 없음은 단계 실패가 아니다.** 국내 비교상품이 0건이어도 ②는
 *    ✓ 분석 완료이고, 이미지 한 장을 처리하지 못해도 ①은 빨간 실패가 아니다.
 * 4. 카테고리가 확정되기 전에는 ④ 커머스 등록이 열리지 않는다. 카테고리는
 *    실제 등록 payload에 들어가는 값이고(smartstore leafCategoryId /
 *    coupang displayCategoryCode), 비어 있으면 register API가 CP001로
 *    거부한다 — 이 게이트가 사라지면 그 버그가 그대로 돌아온다.
 */

const COLLECTED: CollectionSignal = {
  running: false,
  percent: 100,
  productReady: true,
  imageCount: 8,
  failedImageCount: 0,
};

const JUDGED: MarketSignal = {
  notStarted: false,
  priceProbeDone: true,
  domesticProbeDone: true,
  domesticDataFound: true,
  demandProbeDone: true,
  demandDataFound: true,
  profitabilityDone: true,
  profitabilityFound: true,
  verdictKnown: true,
  verdictLabel: "판매 추천",
  loadFailed: false,
};

/**
 * 분석 화면은 열렸는데(=notStarted가 아니다) 응답을 못 받은 경우.
 * "아직 시작 안 함"과 "못 불러옴"은 다른 사건이라 신호도 서로 배타적이다.
 */
const MARKET_LOAD_FAILED: MarketSignal = { ...MARKET_SIGNAL_NOT_STARTED, notStarted: false, loadFailed: true };

const PREPARED: PrepareSignal = {
  categoryVerified: true,
  productInfoOk: true,
  productInfoMissing: null,
  optionGroupCount: 2,
  imageCount: 8,
  detailReady: true,
  requiredFieldBlockingCount: 0,
};

const CHANNELS: RegisterSignal = {
  channels: [
    { id: "smartstore", label: "스마트스토어", availability: "PREVIEW_ONLY", registered: false },
    { id: "coupang", label: "쿠팡", availability: "AVAILABLE", registered: false },
    { id: "elevenst", label: "11번가", availability: "COMING_SOON", registered: false },
  ],
};

function input(overrides: Partial<WorkflowInput> = {}): WorkflowInput {
  return {
    collection: COLLECTED,
    market: JUDGED,
    prepare: PREPARED,
    register: CHANNELS,
    ...overrides,
  };
}

describe("resolveWorkflow() — 단 하나의 작업 Flow", () => {
  it("큰 단계는 수집 → 시장 판단 → 등록 준비 → 커머스 등록 넷뿐이다", () => {
    expect(BIG_STEP_ORDER).toEqual([
      "COLLECTING",
      "MARKET_JUDGING",
      "REGISTRATION_PREPARING",
      "COMMERCE_REGISTERING",
    ]);
    expect(resolveWorkflow(input()).steps.map((s) => s.key)).toEqual([...BIG_STEP_ORDER]);
  });

  it("어느 시점에도 활성 단계는 정확히 하나다", () => {
    const cases: WorkflowInput[] = [
      // 수집 중
      input({
        collection: { running: true, percent: 12, productReady: false, imageCount: 0, failedImageCount: 0 },
        market: MARKET_SIGNAL_NOT_STARTED,
      }),
      // 시장 분석 중
      input({ market: { ...JUDGED, domesticProbeDone: false, verdictKnown: false, verdictLabel: null } }),
      // 등록 준비 중
      input({ prepare: { ...PREPARED, categoryVerified: false } }),
      // 등록 차례
      input(),
      // 전부 끝남
      input({
        register: { channels: CHANNELS.channels.map((c) => ({ ...c, registered: c.id === "coupang" })) },
      }),
    ];
    for (const c of cases) {
      const wf = resolveWorkflow(c);
      // "활성"은 current 하나로만 정의된다 — steps 어디에도 활성 플래그가 없다.
      expect(wf.steps.filter((s) => s.key === wf.current.key)).toHaveLength(1);
      // 현재 단계는 아직 끝나지 않은 첫 단계이고, 그 앞은 전부 끝나 있다.
      const index = wf.steps.findIndex((s) => s.key === wf.current.key);
      expect(wf.steps.slice(0, index).every((s) => s.done)).toBe(true);
      if (!wf.completed) expect(wf.current.done).toBe(false);
      // 진행 중(●)으로 그려지는 하위 항목도 한 번에 하나뿐이다.
      expect(wf.current.subSteps.filter((s) => s.status === "RUNNING").length).toBeLessThanOrEqual(1);
    }
  });

  it("하위 단계는 순서대로 하나씩 넘어간다 — 클릭이 필요 없다", () => {
    const at = (percent: number) =>
      resolveWorkflow(
        input({
          collection: { running: true, percent, productReady: false, imageCount: 0, failedImageCount: 0 },
          market: MARKET_SIGNAL_NOT_STARTED,
        }),
      );

    expect(at(3).currentSubStep?.key).toBe("product_analysis");
    expect(at(15).currentSubStep?.key).toBe("image_download");
    expect(at(60).currentSubStep?.key).toBe("image_processing");
    expect(at(99).currentSubStep?.key).toBe("collection_finalize");

    // 앞선 항목은 ✓, 뒤 항목은 ○ — 여러 개가 동시에 ●가 되지 않는다.
    const mid = at(60).steps[0];
    expect(mid.subSteps.map((s) => s.status)).toEqual(["DONE", "DONE", "RUNNING", "UPCOMING"]);
  });

  it("하위 단계가 전부 끝나면 다음 큰 단계로 자동으로 넘어간다", () => {
    // 수집만 끝난 상태 → 현재 단계는 ② 시장 판단
    const afterCollect = resolveWorkflow(input({ market: MARKET_SIGNAL_NOT_STARTED }));
    expect(afterCollect.currentStepKey).toBe("MARKET_JUDGING");
    // 시장 판단까지 끝나면 → ③ 등록 준비
    const afterMarket = resolveWorkflow(input({ prepare: { ...PREPARED, categoryVerified: false } }));
    expect(afterMarket.currentStepKey).toBe("REGISTRATION_PREPARING");
    // 등록 준비까지 끝나면 → ④ 커머스 등록
    expect(resolveWorkflow(input()).currentStepKey).toBe("COMMERCE_REGISTERING");
  });

  it("수집이 끝나기 전에는 ②③④가 전부 잠겨 있다", () => {
    const wf = resolveWorkflow(
      input({
        collection: { running: true, percent: 40, productReady: false, imageCount: 0, failedImageCount: 0 },
        market: MARKET_SIGNAL_NOT_STARTED,
      }),
    );
    expect(wf.steps.slice(1).map((s) => s.status)).toEqual(["LOCKED", "LOCKED", "LOCKED"]);
  });

  it("판단 화면을 한 번도 열지 않아도 흐름이 ②에 갇히지 않는다", () => {
    // 실제로 일어나는 상황: 쿠팡 탭을 보던 중 다른 화면에 갔다 돌아오면 그 탭이
    // 복원되고 판단 패널은 마운트되지 않는다 — 그러면 분석은 시작조차 안 된다.
    const wf = resolveWorkflow(
      input({ market: MARKET_SIGNAL_NOT_STARTED, prepare: { ...PREPARED, categoryVerified: false } }),
    );
    // 시작도 안 한 작업을 진행 중으로 표시하지 않는다.
    expect(wf.steps[1].subSteps.every((s) => s.status === "UPCOMING")).toBe(true);
    expect(wf.steps[1].headline).toContain("아직 확인하지 않았습니다");
    // ③은 ②가 아니라 ①에 매달려 있어서, 지금 바로 카테고리를 고칠 수 있다.
    expect(wf.steps[2].status).toBe("ATTENTION");
    expect(wf.steps[2].subSteps.find((s) => s.key === "category")?.target).toBe("smartstore");
  });
});

describe("데이터 없음은 단계 실패가 아니다", () => {
  it("국내 비교상품이 0건이어도 ② 시장 판단은 ✓ 분석 완료다", () => {
    const wf = resolveWorkflow(
      input({ market: { ...JUDGED, domesticDataFound: false }, prepare: { ...PREPARED, categoryVerified: false } }),
    );
    const market = wf.steps[1];
    expect(market.done).toBe(true);
    expect(market.status).toBe("COMPLETED");
    expect(market.summary).toBe("분석 완료 · 판매 추천");

    const domestic = market.subSteps.find((s) => s.key === "domestic_comparison");
    // 검색은 정상적으로 했고 결과가 없었을 뿐이다 — 이미 쓰고 있는 어휘 그대로.
    expect(domestic?.status).toBe("DONE_NO_DATA");
    expect(domestic?.message).toBe("⚪ 검색 데이터 없음");
  });

  it("판단 근거가 하나도 없어도 '판단 불가'이지 '판단 실패'가 아니다", () => {
    const wf = resolveWorkflow(
      input({
        market: {
          ...JUDGED,
          domesticDataFound: false,
          demandDataFound: false,
          profitabilityFound: false,
          verdictKnown: false,
          verdictLabel: null,
        },
      }),
    );
    const market = wf.steps[1];
    expect(market.done).toBe(true);
    expect(market.status).toBe("COMPLETED");
    expect(market.summary).toBe("분석 완료 · ⚪ 판단 불가");
    expect(market.subSteps.find((s) => s.key === "final_verdict")?.message).toBe("⚪ 판단 불가");
  });

  it("이미지 일부가 처리되지 않아도 ① 상품 수집은 흐름을 멈추지 않는다", () => {
    const wf = resolveWorkflow(
      input({ collection: { ...COLLECTED, failedImageCount: 1 }, market: MARKET_SIGNAL_NOT_STARTED }),
    );
    const collect = wf.steps[0];
    // 확인할 것이 있다는 표시는 하되, 단계는 끝났고 흐름은 ②로 넘어간다.
    expect(collect.status).toBe("ATTENTION");
    expect(collect.done).toBe(true);
    expect(wf.currentStepKey).toBe("MARKET_JUDGING");
    const failed = collect.subSteps.find((s) => s.key === "image_processing");
    expect(failed?.status).toBe("ATTENTION");
    // 고칠 수 있는 자리로 데려간다 — 경고만 띄우고 끝내지 않는다.
    expect(failed?.target).toBe("source");
  });

  it("시장 분석을 못 불러와도 흐름이 거기서 멈추지 않는다", () => {
    const wf = resolveWorkflow(
      input({
        market: MARKET_LOAD_FAILED,
        prepare: { ...PREPARED, categoryVerified: false },
      }),
    );
    expect(wf.steps[1].status).toBe("ATTENTION");
    expect(wf.steps[1].done).toBe(true);
    expect(wf.currentStepKey).toBe("REGISTRATION_PREPARING");
  });

  it("어떤 입력으로도 실패 상태를 만들 수 없다", () => {
    // 상태 타입에 실패 값이 없다는 사실을 실제 값으로 한 번 더 못박는다.
    const worst = resolveWorkflow(
      input({
        collection: { ...COLLECTED, failedImageCount: 8 },
        market: MARKET_LOAD_FAILED,
        prepare: {
          categoryVerified: false,
          productInfoOk: false,
          productInfoMissing: "상품명을 확인해주세요",
          optionGroupCount: 0,
          imageCount: 0,
          detailReady: false,
          requiredFieldBlockingCount: 4,
        },
      }),
    );
    // 상태 타입에 실패 값이 아예 없다는 건 tsc가 이미 보장한다("FAILED"와
    // 비교하는 코드 자체가 컴파일되지 않는다). 여기서는 실제로 나온 값이
    // 전부 알려진 다섯 가지 안에 있는지만 확인한다 — 제일 나쁜 입력에서도
    // 빨간 실패로 그릴 만한 값이 나오지 않는다는 뜻이다.
    const allowed = ["DONE", "DONE_NO_DATA", "RUNNING", "UPCOMING", "ATTENTION", "LOCKED", "IN_PROGRESS", "COMPLETED"];
    const allStatuses: string[] = [
      ...worst.steps.map((s) => s.status),
      ...worst.steps.flatMap((s) => s.subSteps.map((sub) => sub.status)),
    ];
    expect(allStatuses.every((s) => allowed.includes(s))).toBe(true);
    // 흐름은 어디서도 멈추지 않는다 — 셀러가 할 일이 남아 있을 뿐이다.
    expect(worst.currentStepKey).toBe("REGISTRATION_PREPARING");
  });
});

describe("④ 커머스 등록", () => {
  it("카테고리가 확정되기 전에는 잠겨 있다", () => {
    const wf = resolveWorkflow(input({ prepare: { ...PREPARED, categoryVerified: false } }));
    expect(wf.steps[2].subSteps.find((s) => s.key === "category")?.status).toBe("ATTENTION");
    expect(wf.steps[2].done).toBe(false);
    expect(wf.steps[3].status).toBe("LOCKED");
    expect(wf.steps[3].done).toBe(false);
    // 채널 항목도 전부 "아직 차례가 아님"이다 — 눌러 들어갈 자리를 주지 않는다.
    expect(wf.steps[3].subSteps.filter((s) => s.status === "RUNNING")).toHaveLength(0);
  });

  it("카테고리가 확정되면 열린다", () => {
    const wf = resolveWorkflow(input());
    expect(wf.steps[3].status).toBe("IN_PROGRESS");
    expect(wf.currentStepKey).toBe("COMMERCE_REGISTERING");
  });

  it("네이버·쿠팡은 각자의 Flow가 아니라 ④ 안의 채널 항목이다", () => {
    const wf = resolveWorkflow(input());
    // 채널이 늘어도 큰 단계 수는 그대로 넷이다.
    expect(wf.steps).toHaveLength(4);
    expect(wf.steps[3].subSteps.map((s) => s.key)).toEqual(["smartstore", "coupang", "elevenst"]);
    // 아직 등록 기능이 없는 채널은 목록에서 빼지 않는다 — 없는 것과 준비중은 다르다.
    expect(wf.steps[3].subSteps.find((s) => s.key === "elevenst")?.message).toBe("준비중");
  });

  it("실제로 등록 가능한 채널이 전부 끝나야 흐름이 완료된다", () => {
    const registered = resolveWorkflow(
      input({ register: { channels: CHANNELS.channels.map((c) => ({ ...c, registered: c.id === "coupang" })) } }),
    );
    // 준비중(11번가)이 남아 있다고 해서 흐름이 영원히 미완으로 남지 않는다.
    expect(registered.completed).toBe(true);
    expect(registered.steps[3].summary).toBe("쿠팡 등록 완료");
    expect(resolveWorkflow(input()).completed).toBe(false);
  });
});
