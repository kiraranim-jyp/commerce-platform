import { describe, expect, it } from "vitest";
import {
  PREPARE_SURFACE_LABEL,
  prepareSurfaceOf,
  resolveStageFocus,
  stepInteraction,
  type StageFocusInput,
  type WorkSurface,
} from "../stage-focus";
import {
  BIG_STEP_ORDER,
  MARKET_SIGNAL_NOT_STARTED,
  resolveWorkflow,
  type BigStepKey,
  type CollectionSignal,
  type MarketSignal,
  type PrepareSignal,
  type RegisterSignal,
  type WorkflowInput,
} from "../workflow";

/**
 * UX 2.2(CEO 지시, 2026-09-11) — 상단 Flow의 현재 단계가 본문의 주인공을 정한다.
 *
 * ── 이 파일이 지키는 것 ──────────────────────────────────────────────────
 * 1. **끝난 단계는 본문을 차지하지 않는다.** UX 2.2 이전 화면의 핵심 문제가
 *    이것이었다 — 상단은 ③인데 ①②의 섹션이 원래 크기로 남아 있었다.
 * 2. **MI는 ② Full / ③ Summary / ④ Summary.** 데이터·계산은 그대로다.
 * 3. **본문이 가진 블록은 오른쪽에서 접는다.** 같은 목록이 화면에 두 번 있으면
 *    셀러는 둘이 다른 것인 줄 알고 두 번 읽는다.
 * 4. **끝난 단계를 눌러도 그 단계로 돌아가지 않는다(DETAIL_ONLY).** 돌아가게
 *    만드는 순간 상단 Flow가 탭 내비게이션이 되고, 흐름이 다시 여러 개가 된다.
 * 5. **데이터 없음은 어떤 단계도 실패로 만들지 않는다** — 무게만 정할 뿐,
 *    이 파일이 단계를 판정하지 않는다는 사실까지 값으로 확인한다.
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
  verdictLabel: "조건부 판매",
  loadFailed: false,
};

const PREPARED: PrepareSignal = {
  categoryVerified: true,
  productInfoOk: true,
  productInfoMissing: null,
  optionGroupCount: 2,
  imageCount: 8,
  detailReady: true,
  // UX 2.5 — resolveListingPrice()가 값을 낸 상태(SELLER_OVERRIDE 또는 SYSTEM_SUGGESTED).
  priceResolved: true,
  priceKrw: 143500,
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
  return { collection: COLLECTED, market: JUDGED, prepare: PREPARED, register: CHANNELS, ...overrides };
}

function focus(stage: BigStepKey, overrides: Partial<StageFocusInput> = {}) {
  return resolveStageFocus({ stage, surface: "PRODUCT", marketDetailOpen: false, ...overrides });
}

describe("본문의 주인공은 현재 단계 하나다", () => {
  it("네 단계가 각각 자기 본문을 갖는다 — 빈 단계가 없다", () => {
    expect(BIG_STEP_ORDER.map((stage) => focus(stage).main)).toEqual([
      "COLLECTION",
      "MARKET",
      "PREPARE",
      "REGISTER",
    ]);
  });

  it("끝난 단계의 섹션은 본문을 차지하지 않는다", () => {
    // ③ 등록 준비에서: ②의 근거(가격비교)와 ①의 산물(이미지)은 전부 접힌다.
    const prepare = focus("REGISTRATION_PREPARING");
    expect(prepare.main).toBe("PREPARE");
    expect(prepare.marketEvidence).toBe("COLLAPSED");
    expect(prepare.mi).toBe("SUMMARY");

    // ④ 커머스 등록도 마찬가지 — 앞 단계의 작업면이 하나도 펼쳐지지 않는다.
    const register = focus("COMMERCE_REGISTERING");
    expect(register.main).toBe("REGISTER");
    expect(register.marketEvidence).toBe("COLLAPSED");
    expect(register.mi).toBe("SUMMARY");
  });

  it("Source Data는 어느 단계에서도 펼쳐진 채로 시작하지 않는다", () => {
    // 원본이 무엇이었는지는 확인하고 싶을 때 여는 근거지, 매번 읽는 작업이 아니다.
    for (const stage of BIG_STEP_ORDER) {
      expect(focus(stage).sourceData).toBe("COLLAPSED");
    }
  });

  it("이미지는 단계마다 성격이 다르다 — ②에서는 참고 자료다", () => {
    expect(focus("COLLECTING").images).toBe("CORE");
    // ②에서 이미지가 판단 위로 올라오면 화면이 다시 "이미지 편집 도구"가 된다.
    expect(focus("MARKET_JUDGING").images).toBe("REFERENCE");
    expect(focus("REGISTRATION_PREPARING").images).toBe("EDIT");
    expect(focus("COMMERCE_REGISTERING").images).toBe("REFERENCE");
  });
});

describe("MI의 무게는 단계가 정한다 — 데이터가 아니라 표현만 바뀐다", () => {
  it("② Full / ③ Summary / ④ Summary", () => {
    expect(focus("MARKET_JUDGING").mi).toBe("FULL");
    expect(focus("REGISTRATION_PREPARING").mi).toBe("SUMMARY");
    expect(focus("COMMERCE_REGISTERING").mi).toBe("SUMMARY");
  });

  it("수집 중에는 판단할 근거 자체가 없다 — 빈 카드로 자리를 잡지 않는다", () => {
    expect(focus("COLLECTING").mi).toBe("HIDDEN");
    // 수집 중에는 [판단 상세보기]를 눌러도 펼칠 것이 없다.
    expect(focus("COLLECTING", { marketDetailOpen: true }).mi).toBe("HIDDEN");
  });

  it("[판단 상세보기]는 단계를 되돌리지 않고 MI만 펼친다", () => {
    const opened = focus("REGISTRATION_PREPARING", { marketDetailOpen: true });
    expect(opened.mi).toBe("FULL");
    // 현재 단계와 본문의 주인공은 그대로 ③이다 — 펼친 것은 판단뿐이다.
    expect(opened.main).toBe("PREPARE");
    expect(opened.stage).toBe("REGISTRATION_PREPARING");
  });

  it("채널 화면 위에 판단을 통째로 펼치지 않는다 — 결론만 남긴다", () => {
    // 등록하러 들어온 화면에서 판단 카드부터 스크롤해 내려가게 만들지 않는다.
    expect(focus("MARKET_JUDGING", { surface: "CHANNEL" }).mi).toBe("SUMMARY");
    // 다만 셀러가 직접 펼쳤다면 그 의사가 우선이다.
    expect(focus("MARKET_JUDGING", { surface: "CHANNEL", marketDetailOpen: true }).mi).toBe("FULL");
  });
});

describe("Action Center는 본문이 가진 블록을 반복하지 않는다", () => {
  it("③에서는 체크리스트가 본문에 있으므로 오른쪽은 한 줄이다", () => {
    const prepare = focus("REGISTRATION_PREPARING");
    expect(prepare.actionCenter.checklist).toBe("SUMMARY");
    // 등록 행동은 아직 본문에 없다 — 채널 버튼은 그대로 남는다.
    expect(prepare.actionCenter.channels).toBe("LIST");
  });

  it("④와 채널 화면에서는 등록 행동이 본문에 있으므로 오른쪽은 상태만 남는다", () => {
    expect(focus("COMMERCE_REGISTERING").actionCenter.channels).toBe("SUMMARY");
    for (const stage of BIG_STEP_ORDER) {
      expect(focus(stage, { surface: "CHANNEL" }).actionCenter.channels).toBe("SUMMARY");
    }
  });

  /**
   * MI-POLISH-2(CEO 지시, 2026-09-12) — **MI 판단 화면에서는 작업 진행상태를
   * 반복해서 보여주지 않는다.**
   *
   * ②에서 오른쪽이 목록 그대로였던 것이 이번에 뒤집힌 규칙이다. 그 화면에서
   * 오른쪽 기둥은 "등록 전 확인 0/7 · 지금 할 일: 카테고리 확정"과 채널 버튼
   * 셋을 띄우고 있었는데, 셀러는 아직 **팔지 말지도 정하지 않았다**. 진행상태는
   * 상단 workflow bar 하나의 것이고, 이 기둥이 그것을 한 번 더 적으면 판단
   * 화면에서 가장 큰 덩어리가 등록 준비 진척이 된다.
   */
  it("②에서는 오른쪽이 판단 하나만 말한다 — 진행상태를 반복하지 않는다", () => {
    const market = focus("MARKET_JUDGING");
    expect(market.mi).toBe("FULL");
    expect(market.actionCenter.checklist).toBe("DEFERRED");
    expect(market.actionCenter.channels).toBe("DEFERRED");
  });

  it("판단을 펼쳐 둔 ③에서도 같다 — 판단이 본문의 주인공인가가 기준이다", () => {
    // 단계가 아니라 mi 값을 보기 때문에, ③④에서 [판단 상세보기]로 펼친 경우도
    // 같은 화면이다(그때 셀러가 하는 일도 판단을 다시 읽는 것이다).
    const opened = focus("REGISTRATION_PREPARING", { marketDetailOpen: true });
    expect(opened.mi).toBe("FULL");
    // 체크리스트는 본문이 갖고 있으므로 진척 한 줄이 반복이 아니라 안내다.
    expect(opened.actionCenter.checklist).toBe("SUMMARY");
    expect(opened.actionCenter.channels).toBe("DEFERRED");
  });

  it("접힌 요약(SUMMARY)일 때는 오른쪽이 목록 그대로다 — 그때는 판단 화면이 아니다", () => {
    const channelSurface = focus("REGISTRATION_PREPARING", { surface: "CONTENT" });
    expect(channelSurface.mi).toBe("SUMMARY");
    expect(channelSurface.actionCenter.channels).toBe("LIST");
  });

  it("어떤 단계·작업면 조합에서도 같은 블록이 본문과 오른쪽에 동시에 펼쳐지지 않는다", () => {
    const surfaces: WorkSurface[] = ["PRODUCT", "CHANNEL", "CONTENT"];
    for (const stage of BIG_STEP_ORDER) {
      for (const surface of surfaces) {
        const f = focus(stage, { surface });
        const bodyHasChecklist = f.main === "PREPARE" && surface === "PRODUCT";
        const bodyHasChannels = f.main === "REGISTER" && surface === "PRODUCT";
        if (bodyHasChecklist) expect(f.actionCenter.checklist).toBe("SUMMARY");
        if (bodyHasChannels || surface === "CHANNEL") expect(f.actionCenter.channels).toBe("SUMMARY");
      }
    }
  });
});

describe("상단 Flow는 탭 내비게이션이 아니다", () => {
  it("끝난 단계는 결과만 보여준다 — 그 단계로 데려가지 않는다", () => {
    // ③이 현재 단계인 상황(①② 완료, ④ 미도달).
    const wf = resolveWorkflow(input({ prepare: { ...PREPARED, categoryVerified: false } }));
    expect(wf.currentStepKey).toBe("REGISTRATION_PREPARING");
    const interactions = wf.steps.map((step) => stepInteraction(step, wf.currentStepKey));
    expect(interactions).toEqual(["DETAIL_ONLY", "DETAIL_ONLY", "ACTIVE", "LOCKED"]);
  });

  it("활성 단계는 언제나 정확히 하나다", () => {
    const cases = [
      input({ market: { ...JUDGED, domesticProbeDone: false, verdictKnown: false, verdictLabel: null } }),
      input({ prepare: { ...PREPARED, categoryVerified: false } }),
      input(),
    ];
    for (const c of cases) {
      const wf = resolveWorkflow(c);
      const active = wf.steps.filter((s) => stepInteraction(s, wf.currentStepKey) === "ACTIVE");
      expect(active).toHaveLength(1);
    }
  });
});

describe("③ 체크리스트 항목 ↔ 작업면", () => {
  it("workflow가 만드는 ③ 항목이 전부 열 곳을 갖는다", () => {
    // 목록을 화면에서 다시 적지 않기 때문에, workflow가 항목을 하나 더 만들면
    // 여기서 잡힌다 — 조용히 "열 곳이 없는 항목"이 생기는 것을 막는다.
    const prepareStep = resolveWorkflow(input()).steps[2];
    expect(prepareStep.subSteps.map((s) => s.key)).toEqual([
      "category",
      // UX 2.5 — 판매가격이 카테고리 바로 뒤에 온다. 둘 다 등록 payload에 실제로
      // 들어가는 값이고, 비면 등록 API가 거부한다.
      "price",
      "product_info",
      "option",
      "image",
      "detail",
      "required_fields",
    ]);
    for (const sub of prepareStep.subSteps) {
      expect(PREPARE_SURFACE_LABEL[prepareSurfaceOf(sub.key)]).toBeTruthy();
    }
  });

  it("상품명·옵션·상세설명은 같은 편집기 하나에서 고친다", () => {
    expect(prepareSurfaceOf("product_info")).toBe("SOURCE");
    expect(prepareSurfaceOf("option")).toBe("SOURCE");
    expect(prepareSurfaceOf("detail")).toBe("SOURCE");
    expect(prepareSurfaceOf("image")).toBe("IMAGES");
    expect(prepareSurfaceOf("required_fields")).toBe("REQUIRED");
    // 카테고리는 등록 payload에 들어가는 값이라 채널 화면에서만 확정한다.
    expect(prepareSurfaceOf("category")).toBe("CATEGORY");
    // UX 2.5 — 가격은 정반대다: 채널이 고를 것이 없어서(값이 하나뿐) 편집기가
    // 상품정보 쪽에만 있다.
    expect(prepareSurfaceOf("price")).toBe("PRICE");
  });
});

describe("단계 전환 — 셀러가 누르는 '다음' 버튼은 없다", () => {
  it("① 상품수집 → ② 시장판단이 자동으로 넘어간다", () => {
    const collecting = resolveWorkflow(
      input({
        collection: { running: true, percent: 40, productReady: false, imageCount: 0, failedImageCount: 0 },
        market: MARKET_SIGNAL_NOT_STARTED,
      }),
    );
    expect(collecting.currentStepKey).toBe("COLLECTING");
    expect(focus(collecting.currentStepKey).main).toBe("COLLECTION");

    const collected = resolveWorkflow(
      input({ market: { ...JUDGED, priceProbeDone: false, verdictKnown: false, verdictLabel: null } }),
    );
    expect(collected.currentStepKey).toBe("MARKET_JUDGING");
    expect(focus(collected.currentStepKey).main).toBe("MARKET");
    expect(focus(collected.currentStepKey).mi).toBe("FULL");
  });

  it("② 시장판단 → ③ 등록준비가 자동으로 넘어간다", () => {
    const wf = resolveWorkflow(input({ prepare: { ...PREPARED, categoryVerified: false } }));
    expect(wf.currentStepKey).toBe("REGISTRATION_PREPARING");
    const f = focus(wf.currentStepKey);
    expect(f.main).toBe("PREPARE");
    // 판단은 끝났으므로 요약으로 접힌다 — 같은 크기로 남아 있으면 ③이 밀린다.
    expect(f.mi).toBe("SUMMARY");
  });

  it("③ 등록준비 → ④ 커머스등록이 자동으로 넘어간다", () => {
    const wf = resolveWorkflow(input());
    expect(wf.currentStepKey).toBe("COMMERCE_REGISTERING");
    expect(focus(wf.currentStepKey).main).toBe("REGISTER");
  });

  it("카테고리가 확정되기 전에는 ④가 본문을 가져가지 않는다", () => {
    // 등록 payload에 들어가는 값이라 비면 register API가 거부한다 — 열어주는
    // 것 자체가 거짓말이 된다(UX 2.1이 세운 게이트를 UX 2.2가 흔들지 않는다).
    const wf = resolveWorkflow(input({ prepare: { ...PREPARED, categoryVerified: false } }));
    expect(focus(wf.currentStepKey).main).toBe("PREPARE");
    expect(wf.steps[3].status).toBe("LOCKED");
  });
});

describe("데이터 없음은 어떤 단계도 실패로 만들지 않는다", () => {
  it("국내 비교상품 0건이어도 흐름은 ③으로 넘어가고 본문도 ③이다", () => {
    const wf = resolveWorkflow(
      input({
        market: { ...JUDGED, domesticDataFound: false },
        prepare: { ...PREPARED, categoryVerified: false },
      }),
    );
    expect(wf.steps[1].done).toBe(true);
    expect(wf.steps[1].status).toBe("COMPLETED");
    expect(wf.currentStepKey).toBe("REGISTRATION_PREPARING");

    const f = focus(wf.currentStepKey);
    expect(f.main).toBe("PREPARE");
    // 판단 결과가 비어 있다고 MI를 숨기지 않는다 — "왜 비었는지"도 결과다.
    expect(f.mi).toBe("SUMMARY");
  });

  it("근거가 하나도 없어 판단을 못 세워도 ②가 본문을 붙잡고 있지 않는다", () => {
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
        prepare: { ...PREPARED, categoryVerified: false },
      }),
    );
    expect(wf.currentStepKey).toBe("REGISTRATION_PREPARING");
    expect(focus(wf.currentStepKey).main).toBe("PREPARE");
  });
});

describe("쿠팡 탭 왕복 — 탭을 옮겨도 현재 단계는 그대로다", () => {
  it("같은 데이터라면 작업면이 바뀌어도 단계와 본문 주인공이 바뀌지 않는다", () => {
    // 단계는 데이터에서만 나온다(resolveWorkflow). 작업면(탭)은 무게만 바꾼다 —
    // 그래서 쿠팡 탭에 갔다 돌아와도 ③은 여전히 ③이다.
    const wf = resolveWorkflow(input({ prepare: { ...PREPARED, categoryVerified: false } }));
    const onProduct = focus(wf.currentStepKey, { surface: "PRODUCT" });
    const onChannel = focus(wf.currentStepKey, { surface: "CHANNEL" });
    const backOnProduct = focus(wf.currentStepKey, { surface: "PRODUCT" });

    expect(onChannel.stage).toBe(onProduct.stage);
    expect(onChannel.main).toBe(onProduct.main);
    expect(backOnProduct).toEqual(onProduct);
  });

  it("판단 패널이 한 번도 보고하지 않은 세션에서도 ③④가 잠기지 않는다", () => {
    // 쿠팡 탭이 sessionStorage로 복원된 세션에서 실제로 일어나던 상황이다.
    // ③은 ②가 아니라 ①에 매달려 있으므로(workflow.ts) 지금 바로 손볼 수 있다.
    const wf = resolveWorkflow(
      input({ market: MARKET_SIGNAL_NOT_STARTED, prepare: { ...PREPARED, categoryVerified: false } }),
    );
    expect(wf.steps[2].status).toBe("ATTENTION");
    expect(wf.steps[2].subSteps.find((s) => s.key === "category")?.status).toBe("ATTENTION");
  });
});
