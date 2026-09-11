import type { PlatformId } from "@commerce/shared";

/**
 * UX 2.1(CEO 지시, 2026-09-11) — 따져에는 작업 Flow가 **하나만** 존재한다.
 *
 * ── 무엇이 문제였나 ──────────────────────────────────────────────────────
 * 같은 화면에 진행 표시가 셋이었다.
 *
 *   ① 시스템 작업 Flow   상품분석 → 이미지 다운로드 → 이미지 처리 → 마무리
 *   ② 상품등록 Flow      상품수집 → 시장판단 → 등록준비 → 커머스등록
 *   ③ MI 내부 Flow       시장가격 → 국내비교 → 레이더 → 가격비교 …
 *
 * 셋은 서로를 전혀 모른 채 각자 돌았다. 그래서 셀러는 화면을 보고도
 * "상품 분석은 끝난 건가? MI는 별도 작업인가? 이미지는 왜 여기 있지?
 * 카테고리는 지금 해야 하나? 커머스 등록은 언제?"를 계속 물었다. 진행바
 * 디자인 문제가 아니라, 제품에 상태 모델이 세 개 있었던 것이다.
 *
 * ── 이 파일이 하는 일 ────────────────────────────────────────────────────
 * 그 셋을 하나로 합친 **유일한** 상태 모델이다.
 *
 *   COLLECTING → MARKET_JUDGING → REGISTRATION_PREPARING → COMMERCE_REGISTERING
 *
 * ②(시장 판단)는 이 흐름과 나란히 도는 별도 작업이 아니라 흐름의 **핵심
 * 판단 지점**이다. 나머지 둘은 그 판단의 앞(수집)과 뒤(등록)일 뿐이다.
 *
 * ── DB 컬럼을 만들지 않는 이유 ───────────────────────────────────────────
 * 이 상태는 저장되는 값이 아니라 지금 이미 존재하는 값들(파이프라인 진행률·
 * 스냅샷·시장 분석 응답·채널 준비 상태)을 읽어 만든 **뷰**다. 상태를 따로
 * 저장하기 시작하면 "저장된 상태"와 "실제 데이터"가 어긋나는 순간 화면이
 * 거짓말을 한다 — 마이그레이션도, 상태 컬럼도 만들지 않는다.
 *
 * ── 절대 만들지 않는 값 ──────────────────────────────────────────────────
 * FAILED가 없다. 타입에 아예 없다.
 *   · 국내 비교상품이 0건인 것은 "시장 판단 실패"가 아니라 "검색 데이터 없음"이다.
 *   · 이미지 한 장이 처리되지 않은 것은 "상품 수집 실패"가 아니라 "일부 확인 필요"다.
 * 데이터 없음(DONE_NO_DATA)과 확인 필요(ATTENTION)는 둘 다 단계를 끝낸 상태이고,
 * 흐름을 멈추지 않는다. 빨간 실패로 그릴 수 있는 값이 타입에 존재하지 않는 것이
 * 이 규칙을 지키는 방법이다.
 */
export type BigStepKey =
  "COLLECTING" | "MARKET_JUDGING" | "REGISTRATION_PREPARING" | "COMMERCE_REGISTERING";

export const BIG_STEP_ORDER: readonly BigStepKey[] = [
  "COLLECTING",
  "MARKET_JUDGING",
  "REGISTRATION_PREPARING",
  "COMMERCE_REGISTERING",
] as const;

export const BIG_STEP_LABELS: Record<BigStepKey, string> = {
  COLLECTING: "상품 수집",
  MARKET_JUDGING: "시장 판단",
  REGISTRATION_PREPARING: "등록 준비",
  COMMERCE_REGISTERING: "커머스 등록",
};

/**
 * 하위 단계의 상태.
 *
 *   DONE         ✓ 끝났고 결과도 있다.
 *   DONE_NO_DATA ✓ 끝났는데 결과가 비었다 — 실패가 아니다(mi-empty-state.ts 어휘 사용).
 *   RUNNING      ● 지금 이 항목이 돌고 있다. 한 번에 하나만 존재한다.
 *   UPCOMING     ○ 아직 차례가 아니다.
 *   ATTENTION    ⚠ 셀러가 손볼 것이 있다 — 흐름을 멈추지는 않는다.
 */
export type SubStepStatus = "DONE" | "DONE_NO_DATA" | "RUNNING" | "UPCOMING" | "ATTENTION";

/**
 * 큰 단계의 상태. LOCKED는 "앞 단계가 아직 안 끝났다"는 뜻이고,
 * ATTENTION은 "끝났거나 진행 중인데 확인할 것이 있다"는 뜻이다.
 * 다시 말하지만 실패 값은 없다.
 */
export type BigStepStatus = "LOCKED" | "IN_PROGRESS" | "ATTENTION" | "COMPLETED";

/**
 * 항목을 눌렀을 때 데려갈 곳. 화면(WorkflowPanel)이 탭 전환/스크롤로 해석한다.
 * "market"/"price"는 탭이 아니라 스크롤 의도다 — CommerceWorkspace가 이미
 * 갖고 있는 focusMarketVerdict()/handleRequestPriceReview()에 그대로 이어진다.
 */
export type WorkflowNavTarget = "source" | "content" | "market" | "price" | PlatformId;

export interface SubStep {
  key: string;
  /** ✓/○ 옆에 붙는 짧은 이름. 내부 작업명(probe/radar/matching)을 절대 쓰지 않는다. */
  label: string;
  status: SubStepStatus;
  /**
   * 사람이 읽는 한 문장. RUNNING이면 "지금 무엇을 하고 있는지",
   * DONE_NO_DATA면 왜 비었는지, ATTENTION이면 무엇을 해야 하는지.
   * 같은 말을 라벨과 두 번 하지 않을 때는 null이다.
   */
  message: string | null;
  target: WorkflowNavTarget | null;
}

export interface BigStep {
  key: BigStepKey;
  /** 화면에 찍히는 1~4. 내부 인덱스가 아니라 셀러가 읽는 번호다. */
  index: number;
  label: string;
  status: BigStepStatus;
  /**
   * 이 단계가 끝났는가 — **다음 단계로 넘어가는 유일한 기준**이다.
   * status와 분리한 이유: "① 상품 수집 ⚠ 일부 이미지 처리 필요"처럼
   * 확인할 것이 남아 있어도 흐름은 다음으로 넘어가야 하기 때문이다.
   */
  done: boolean;
  /** 이 단계가 현재 단계일 때 상단에 뜨는 한 문장. */
  headline: string;
  subSteps: SubStep[];
  /**
   * 끝난 단계의 한 줄 결과. 진행 목록을 그대로 남겨두지 않기 위해 쓴다 —
   * 일이 끝났는데 체크리스트가 계속 앉아 있으면 그것도 "아직 뭔가 돌고 있나"로 읽힌다.
   */
  summary: string | null;
}

export interface Workflow {
  steps: BigStep[];
  /** 지금 사용자가 서 있는 단계 — 아직 끝나지 않은 첫 단계. 항상 정확히 하나다. */
  current: BigStep;
  currentStepKey: BigStepKey;
  /** 현재 단계에서 지금 돌고 있는 항목. 전부 끝났으면 null이다. */
  currentSubStep: SubStep | null;
  /** 네 단계가 전부 끝났는가(COMPLETED). */
  completed: boolean;
}

/* ────────────────────────────── 입력 신호 ────────────────────────────── */

/**
 * ① 상품 수집 — /api/pipeline SSE가 흘려주는 진행률 하나로 충분하다.
 * 세부 단계 이름(analyze/extract/download/dedup/classify/model/…)은 올라오지 않는다.
 */
export interface CollectionSignal {
  /** 파이프라인이 아직 돌고 있는가. */
  running: boolean;
  /** 누적 진행률 0~100 — packages/image/src/pipeline/progress.ts의 STAGE_WEIGHTS 기준. */
  percent: number;
  /** 결과(canonicalProduct)가 도착했는가. */
  productReady: boolean;
  imageCount: number;
  /** 처리하지 못한 이미지 수. 0보다 커도 단계 실패가 아니다. */
  failedImageCount: number;
}

/**
 * ② 시장 판단 — DomesticPriceIntelligencePanel이 서버 응답에서 읽어 올려보내는 값.
 * 내부적으로는 시장가 조회 → 국내 검색 → 매칭 → 레이더 → CASE 계산 → 셀러 문구까지
 * 열 가지 가까이 돌지만, 셀러에게 보이는 건 아래 다섯 항목뿐이다.
 * 여기서 판정을 다시 만들지 않는다 — 서버가 이미 낸 사실만 옮긴다.
 */
export interface MarketSignal {
  /** 아직 시장 분석을 시작할 수 없는 상태(스냅샷 저장 전). */
  notStarted: boolean;
  /** 한국 시장 가격 조회가 끝났는가. */
  priceProbeDone: boolean;
  /** 국내 비교상품 조회가 끝났는가. */
  domesticProbeDone: boolean;
  /** 국내 비교상품이 실제로 있었는가. false는 "없다"는 사실이지 실패가 아니다. */
  domesticDataFound: boolean;
  /** 수요 신호(관심도·판매처·시즌)를 읽었는가. */
  demandProbeDone: boolean;
  demandDataFound: boolean;
  /** 수익성(추천가·예상 마진) 계산이 끝났는가. */
  profitabilityDone: boolean;
  profitabilityFound: boolean;
  /** 서버의 sellerDecision.finalVerdict가 나왔는가. */
  verdictKnown: boolean;
  /** 그 판정의 셀러용 문구(판매 추천 / 조건부 판매 / 판매 비추천). 서버 어휘 그대로. */
  verdictLabel: string | null;
  /** 분석 응답 자체를 못 받았는가(네트워크/서버 오류). 데이터 없음과 완전히 다른 사건이다. */
  loadFailed: boolean;
}

/** ③ 등록 준비 — 전부 product/categoryMappings/채널 준비 상태에서 읽어낸다. */
export interface PrepareSignal {
  /** isVerifiedCategorySelected로 확정된 카테고리가 있는가. state만 보면 CP001이 재발한다. */
  categoryVerified: boolean;
  /** 상품명·브랜드가 채워졌는가. */
  productInfoOk: boolean;
  productInfoMissing: string | null;
  optionGroupCount: number;
  imageCount: number;
  /** 상세 설명(원문 또는 한국어)이 있는가. */
  detailReady: boolean;
  /** 실제로 등록 가능한 채널에서 아직 비어 있는 필수 항목 수. */
  requiredFieldBlockingCount: number;
}

export type ChannelAvailability = "AVAILABLE" | "PREVIEW_ONLY" | "COMING_SOON";

export interface WorkflowChannel {
  id: PlatformId;
  label: string;
  availability: ChannelAvailability;
  /** 이 채널에 실제로 등록이 끝났는가(listingStates === "REGISTERED"). */
  registered: boolean;
}

/**
 * ④ 커머스 등록 — 네이버와 쿠팡은 각자의 Flow가 아니라 이 한 단계 **안의
 * 채널 행동**이다. 목록은 호출부가 PLATFORM_ORDER에서 그대로 만들어 넘긴다 —
 * 채널이 늘어도 이 파일은 고치지 않는다.
 */
export interface RegisterSignal {
  channels: WorkflowChannel[];
}

export interface WorkflowInput {
  collection: CollectionSignal;
  market: MarketSignal;
  prepare: PrepareSignal;
  register: RegisterSignal;
}

/**
 * 한 단계 안에서 ●(진행 중)는 **항상 하나**가 되도록 뒤따르는 것들을 ○로 내린다.
 *
 * ── 왜 이렇게까지 하나 ───────────────────────────────────────────────────
 * ② 시장 판단의 조회 세 건은 실제로는 병렬로 동시에 돈다. 그걸 사실 그대로
 * ● 세 개로 그렸더니(MI-LOADING-1 시절 화면) 셀러는 그걸 "동시에 돌아가는
 * 서로 다른 작업 세 개"로 읽었다 — "MI는 별도 작업인가?"라는 질문이 거기서
 * 나왔다. 지금 중요한 건 어떤 요청이 몇 개 떠 있는지가 아니라 "시장을 판단하는
 * 중"이라는 사실 하나다.
 *
 * 끝난 항목의 ✓는 절대 건드리지 않는다 — 그건 없는 일을 지어내는 것이 된다.
 * 아직 안 끝난 항목들 사이의 표시만 하나로 모은다.
 */
function keepSingleRunning(subSteps: SubStep[], demotedMessage: string | null = null): SubStep[] {
  let seenRunning = false;
  return subSteps.map((sub) => {
    if (sub.status !== "RUNNING") return sub;
    if (!seenRunning) {
      seenRunning = true;
      return sub;
    }
    return { ...sub, status: "UPCOMING", message: demotedMessage };
  });
}

/* ──────────────────────── ① 상품 수집 하위 단계 ──────────────────────── */

/**
 * ProgressPanel이 갖고 있던 4구간을 그대로 옮겨온다(경계값 동일).
 * packages/image/src/pipeline/progress.ts의 STAGE_WEIGHTS 누적 퍼센트 기준이고,
 * 이 값이 두 벌로 존재하면 같은 순간에 상단과 하단이 다른 단계를 가리키게 된다 —
 * 그래서 진행바 쪽 사본은 지우고 이 상수 하나만 남긴다.
 */
const COLLECT_SUB_STEPS = [
  {
    key: "product_analysis",
    label: "상품 정보 읽기",
    upTo: 7,
    running: "상품 정보를 읽고 있습니다...",
  },
  {
    key: "image_download",
    label: "이미지 가져오기",
    upTo: 21,
    running: "상품 이미지를 가져오고 있습니다...",
  },
  {
    key: "image_processing",
    label: "이미지 다듬기",
    upTo: 96,
    running: "이미지를 등록용으로 다듬고 있습니다...",
  },
  {
    key: "collection_finalize",
    label: "수집 마무리",
    upTo: 100,
    running: "수집한 내용을 정리하고 있습니다...",
  },
] as const;

function buildCollecting(signal: CollectionSignal): BigStep {
  const done = signal.productReady;
  const hasImageIssue = done && signal.failedImageCount > 0;

  // 진행 중일 때만 퍼센트로 현재 항목을 고른다. 끝난 뒤에는 퍼센트를 보지 않는다 —
  // 100%에 도달하지 않은 채 complete 이벤트가 오는 경우에도 ✓로 보여야 한다.
  const runningIndex = COLLECT_SUB_STEPS.findIndex((s) => signal.percent <= s.upTo);
  const activeIndex = runningIndex === -1 ? COLLECT_SUB_STEPS.length - 1 : runningIndex;

  const subSteps: SubStep[] = COLLECT_SUB_STEPS.map((step, index) => {
    if (done) {
      // 이미지 처리에 실패한 장이 있으면 그 항목만 ⚠로 남긴다 — 수집 자체는 끝났다.
      if (step.key === "image_processing" && hasImageIssue) {
        return {
          key: step.key,
          label: step.label,
          status: "ATTENTION",
          message: `${signal.failedImageCount}장을 처리하지 못했습니다 — 다시 시도하거나 직접 올릴 수 있습니다`,
          target: "source",
        };
      }
      return { key: step.key, label: step.label, status: "DONE", message: null, target: null };
    }
    if (index < activeIndex) {
      return { key: step.key, label: step.label, status: "DONE", message: null, target: null };
    }
    if (index === activeIndex) {
      return {
        key: step.key,
        label: step.label,
        status: "RUNNING",
        message: step.running,
        target: null,
      };
    }
    return { key: step.key, label: step.label, status: "UPCOMING", message: null, target: null };
  });

  const summary = done
    ? hasImageIssue
      ? `이미지 ${signal.imageCount}장 · ${signal.failedImageCount}장 확인 필요`
      : `이미지 ${signal.imageCount}장 · 상품 정보 수집 완료`
    : null;

  return {
    key: "COLLECTING",
    index: 1,
    label: BIG_STEP_LABELS.COLLECTING,
    status: hasImageIssue ? "ATTENTION" : done ? "COMPLETED" : "IN_PROGRESS",
    done,
    headline: done
      ? hasImageIssue
        ? "일부 이미지 처리가 필요합니다"
        : "상품 수집이 끝났습니다"
      : (subSteps[activeIndex]?.message ?? "상품을 수집하고 있습니다..."),
    subSteps,
    summary,
  };
}

/* ──────────────────────── ② 시장 판단 하위 단계 ──────────────────────── */

/**
 * 셀러가 보는 다섯 항목. 내부에서 실제로 도는 작업은 이보다 훨씬 많지만
 * (시장가 조회 → 국내 검색 → 매칭 → 레이더 → CASE 계산 → 셀러 문구),
 * 그 이름을 화면에 올리면 읽을 수는 있어도 할 일은 여전히 모른다.
 */
function buildMarketJudging(signal: MarketSignal, previousDone: boolean): BigStep {
  // 아직 수집이 안 끝났거나, 판단 화면이 한 번도 열린 적이 없어 분석 자체가
  // 시작되지 않은 경우. 후자는 실제로 일어난다 — 셀러가 쿠팡 탭을 보던 중
  // 다른 화면에 갔다 돌아오면 그 탭이 복원되고, 판단 패널은 마운트되지 않는다.
  // 그때 ●를 돌려두면 돌고 있지도 않은 작업을 진행 중이라고 말하는 것이 된다.
  const notReached = !previousDone || signal.notStarted;

  // 분석을 못 불러온 경우: 판단은 못 세웠지만 흐름을 여기서 멈추지 않는다.
  // 등록은 시장 판단과 무관하게 가능하고, 셀러는 다시 시도할 수 있다.
  const done =
    !notReached &&
    (signal.loadFailed ||
      (signal.priceProbeDone &&
        signal.domesticProbeDone &&
        signal.demandProbeDone &&
        signal.profitabilityDone));

  const probe = (
    key: string,
    label: string,
    running: string,
    probeDone: boolean,
    dataFound: boolean,
    emptyChip: string,
  ): SubStep => {
    if (notReached) return { key, label, status: "UPCOMING", message: null, target: null };
    if (signal.loadFailed) {
      return {
        key,
        label,
        status: "ATTENTION",
        message: "시장 분석을 다시 불러와야 합니다",
        target: "market",
      };
    }
    if (!probeDone) return { key, label, status: "RUNNING", message: running, target: null };
    // 조회는 정상적으로 끝났는데 결과가 없는 경우 — "없다"는 사실이지 실패가 아니다.
    if (!dataFound)
      return { key, label, status: "DONE_NO_DATA", message: emptyChip, target: "market" };
    return { key, label, status: "DONE", message: null, target: "market" };
  };

  const subSteps: SubStep[] = keepSingleRunning([
    probe(
      "market_price",
      "시장 가격 조회",
      "한국 시장 가격을 조회하고 있습니다...",
      signal.priceProbeDone,
      signal.priceProbeDone,
      "⚪ 확인 불가",
    ),
    probe(
      "domestic_comparison",
      "국내 비교상품",
      "국내 시장 데이터를 분석하고 있습니다...",
      signal.domesticProbeDone,
      signal.domesticDataFound,
      // mi-empty-state.ts의 어휘 그대로 — 조회는 했는데 시장에 흔적이 없었다.
      "⚪ 검색 데이터 없음",
    ),
    probe(
      "demand_signal",
      "수요 신호",
      "얼마나 찾는 상품인지 살펴보고 있습니다...",
      signal.demandProbeDone,
      signal.demandDataFound,
      "⚪ 확인 불가",
    ),
    probe(
      "profitability",
      "수익성 계산",
      "남는 이익을 계산하고 있습니다...",
      signal.profitabilityDone,
      signal.profitabilityFound,
      "⚪ 확인 불가",
    ),
    (() => {
      const key = "final_verdict";
      const label = "판매 판단";
      if (notReached)
        return { key, label, status: "UPCOMING" as const, message: null, target: null };
      if (signal.loadFailed) {
        return {
          key,
          label,
          status: "ATTENTION" as const,
          message: "시장 분석을 다시 불러와야 합니다",
          target: "market" as const,
        };
      }
      if (!done) {
        return {
          key,
          label,
          status: "RUNNING" as const,
          message: "판매 가능성을 판단하고 있습니다...",
          target: null,
        };
      }
      if (!signal.verdictKnown) {
        // 근거가 하나도 없어 판단을 세우지 못한 경우. "나쁘다"가 아니다.
        return {
          key,
          label,
          status: "DONE_NO_DATA" as const,
          message: "⚪ 판단 불가",
          target: "market" as const,
        };
      }
      return {
        key,
        label,
        status: "DONE" as const,
        message: signal.verdictLabel,
        target: "market" as const,
      };
    })(),
  ]);

  const runningStep = subSteps.find((s) => s.status === "RUNNING");
  const summary = !done
    ? null
    : signal.loadFailed
      ? "시장 분석을 불러오지 못했습니다"
      : signal.verdictKnown
        ? `분석 완료 · ${signal.verdictLabel}`
        : "분석 완료 · ⚪ 판단 불가";

  return {
    key: "MARKET_JUDGING",
    index: 2,
    label: BIG_STEP_LABELS.MARKET_JUDGING,
    // 데이터가 비어 있다고 ⚠를 붙이지 않는다 — ⚠는 셀러가 할 일이 있을 때만이다.
    status: !previousDone
      ? "LOCKED"
      : signal.loadFailed
        ? "ATTENTION"
        : done
          ? "COMPLETED"
          : "IN_PROGRESS",
    done,
    headline: !previousDone
      ? "상품 수집이 끝나면 시장을 판단합니다"
      : signal.notStarted
        ? "이 상품을 팔아도 되는지 아직 확인하지 않았습니다"
        : signal.loadFailed
          ? "시장 분석을 다시 불러와야 합니다"
          : done
            ? (summary ?? "시장 판단이 준비됐습니다")
            : (runningStep?.message ?? "한국 시장 기준으로 판단하고 있습니다..."),
    subSteps,
    summary,
  };
}

/* ──────────────────────── ③ 등록 준비 하위 단계 ──────────────────────── */

/**
 * ③은 ②가 아니라 **①**이 끝났는지만 본다.
 *
 * 순서상 ③은 ② 다음이지만(현재 단계는 여전히 ②를 먼저 가리킨다), 시장 판단이
 * 끝나야만 카테고리를 고를 수 있는 것은 아니다. ②에 매달아두면 판단 화면을
 * 한 번도 열지 않은 세션에서 ③④가 통째로 잠긴 채 아무것도 할 수 없게 된다 —
 * 흐름이 하나라는 건 "앞 단계가 끝날 때까지 손도 못 댄다"는 뜻이 아니라
 * "지금 어디에 서 있는지가 하나로 보인다"는 뜻이다.
 */
function buildRegistrationPreparing(signal: PrepareSignal, collectionDone: boolean): BigStep {
  const notReached = !collectionDone;

  const item = (
    key: string,
    label: string,
    ok: boolean,
    okMessage: string | null,
    todoMessage: string,
    target: WorkflowNavTarget,
  ): SubStep => {
    if (notReached) return { key, label, status: "UPCOMING", message: null, target: null };
    return ok
      ? { key, label, status: "DONE", message: okMessage, target }
      : { key, label, status: "ATTENTION", message: todoMessage, target };
  };

  const subSteps: SubStep[] = [
    // 카테고리가 맨 앞인 이유: 실제 등록 payload에 들어가는 값이고
    // (smartstore leafCategoryId / coupang displayCategoryCode), 이게 비면
    // 아래 항목을 아무리 채워도 register API가 CP001로 거부한다.
    item(
      "category",
      "카테고리 확인",
      signal.categoryVerified,
      "확정됨",
      "등록할 카테고리를 확정해주세요",
      "smartstore",
    ),
    item(
      "product_info",
      "상품 정보",
      signal.productInfoOk,
      null,
      signal.productInfoMissing ?? "상품명·브랜드를 확인해주세요",
      "source",
    ),
    // 옵션이 없는 것은 결함이 아니다 — 단일 상품으로 등록된다.
    // 고칠 것이 없는데 ⚠를 띄우면 셀러는 고칠 방법을 찾다가 시간을 버린다.
    {
      key: "option",
      label: "옵션",
      status: notReached ? "UPCOMING" : "DONE",
      message: notReached
        ? null
        : signal.optionGroupCount > 0
          ? `옵션그룹 ${signal.optionGroupCount}개`
          : "단일 상품",
      target: notReached ? null : "source",
    },
    item(
      "image",
      "이미지",
      signal.imageCount > 0,
      `${signal.imageCount}장`,
      "등록할 이미지가 없습니다",
      "source",
    ),
    item("detail", "상세 설명", signal.detailReady, null, "상세 설명을 채워주세요", "source"),
    item(
      "required_fields",
      "필수 정보",
      signal.requiredFieldBlockingCount === 0,
      null,
      `${signal.requiredFieldBlockingCount}건 확인 필요`,
      "coupang",
    ),
  ];

  const pending = subSteps.filter((s) => s.status === "ATTENTION");
  const done = !notReached && pending.length === 0;

  return {
    key: "REGISTRATION_PREPARING",
    index: 3,
    label: BIG_STEP_LABELS.REGISTRATION_PREPARING,
    status: notReached ? "LOCKED" : done ? "COMPLETED" : "ATTENTION",
    done,
    headline: notReached
      ? "상품 수집이 끝나면 등록을 준비합니다"
      : done
        ? "등록 준비가 끝났습니다"
        : (pending[0]?.message ?? "등록 준비를 마무리해주세요"),
    subSteps,
    summary: done ? "등록에 필요한 정보가 모두 준비됐습니다" : null,
  };
}

/* ─────────────────────── ④ 커머스 등록 하위 단계 ─────────────────────── */

function buildCommerceRegistering(signal: RegisterSignal, previousDone: boolean): BigStep {
  const notReached = !previousDone;

  // 채널은 서로 순서가 없다(쿠팡 먼저든 네이버 먼저든 상관없다). 그래도 ●는
  // 하나만 둔다 — 나머지는 ○로 내리되 문구로 "지금 눌러도 된다"를 남기고
  // 이동 경로(target)도 그대로 살려둔다. 표시만 정리할 뿐 막지 않는다.
  const subSteps: SubStep[] = keepSingleRunning(
    signal.channels.map((channel) => {
      if (channel.registered) {
        return {
          key: channel.id,
          label: channel.label,
          status: "DONE" as const,
          message: "등록 완료",
          target: channel.id,
        };
      }
      if (channel.availability === "COMING_SOON") {
        // 없는 것과 준비중인 것은 다르다 — 목록에서 빼지 않고 ○로 남긴다.
        return {
          key: channel.id,
          label: channel.label,
          status: "UPCOMING" as const,
          message: "준비중",
          target: null,
        };
      }
      if (notReached) {
        return {
          key: channel.id,
          label: channel.label,
          status: "UPCOMING" as const,
          message: "등록 준비가 끝나면 열립니다",
          target: null,
        };
      }
      if (channel.availability === "PREVIEW_ONLY") {
        return {
          key: channel.id,
          label: channel.label,
          status: "UPCOMING" as const,
          message: "미리보기만 가능합니다",
          target: channel.id,
        };
      }
      return {
        key: channel.id,
        label: channel.label,
        status: "RUNNING" as const,
        message: `${channel.label}에 등록할 차례입니다`,
        target: channel.id,
      };
    }),
    "등록할 수 있습니다",
  );

  // "끝났다"의 기준은 실제로 등록할 수 있는 채널뿐이다 — 준비중 채널이
  // 흐름을 영원히 미완으로 붙잡아두면 안 된다.
  const registerable = signal.channels.filter((c) => c.availability === "AVAILABLE");
  const done = !notReached && registerable.length > 0 && registerable.every((c) => c.registered);
  const registeredLabels = signal.channels.filter((c) => c.registered).map((c) => c.label);

  return {
    key: "COMMERCE_REGISTERING",
    index: 4,
    label: BIG_STEP_LABELS.COMMERCE_REGISTERING,
    status: notReached ? "LOCKED" : done ? "COMPLETED" : "IN_PROGRESS",
    done,
    headline: notReached
      ? "등록 준비를 먼저 마무리해주세요"
      : done
        ? "커머스 등록이 끝났습니다"
        : "커머스에 등록할 수 있습니다",
    subSteps,
    summary: registeredLabels.length > 0 ? `${registeredLabels.join(" · ")} 등록 완료` : null,
  };
}

/* ──────────────────────────── 상태 조립 ──────────────────────────── */

/**
 * 네 단계를 순서대로 만든다. 각 단계는 **바로 앞 단계가 끝났는지**만 보고
 * 잠금 여부를 정한다 — 이것이 자동 진행의 전부다. 사용자가 "다음"을 누르는
 * 개념 자체가 없다: 하위 항목이 끝나면 다음 항목이 ●가 되고, 한 단계의 항목이
 * 전부 끝나면 그 다음 단계가 현재 단계가 된다.
 */
export function resolveWorkflow(input: WorkflowInput): Workflow {
  const collecting = buildCollecting(input.collection);
  const market = buildMarketJudging(input.market, collecting.done);
  // ③은 ①에 매달린다(위 buildRegistrationPreparing 주석 참고). ④만은 ③에
  // 매달려 있어야 한다 — 카테고리가 확정되지 않으면 register API가 CP001로
  // 거부하므로, 열어주는 것 자체가 거짓말이 된다.
  const prepare = buildRegistrationPreparing(input.prepare, collecting.done);
  const register = buildCommerceRegistering(input.register, prepare.done);

  const steps = [collecting, market, prepare, register];
  // 현재 단계는 "아직 끝나지 않은 첫 단계" 하나뿐이다. 전부 끝났으면 마지막 단계에
  // 머문다(④가 끝나도 화면이 빈 곳을 가리키면 안 된다).
  const current = steps.find((step) => !step.done) ?? steps[steps.length - 1];
  const currentSubStep =
    current.subSteps.find((s) => s.status === "RUNNING") ??
    current.subSteps.find((s) => s.status === "ATTENTION") ??
    null;

  return {
    steps,
    current,
    currentStepKey: current.key,
    currentSubStep,
    completed: steps.every((step) => step.done),
  };
}

/**
 * 시장 분석이 아직 시작조차 못한 상태(스냅샷 저장 전 / 수집 중)의 기본값.
 * "시작도 안 한 작업을 진행 중으로 표시하지 않는다"는 기존 MI-LOADING-1
 * 원칙을 그대로 따른다 — 전부 false다.
 */
export const MARKET_SIGNAL_NOT_STARTED: MarketSignal = {
  notStarted: true,
  priceProbeDone: false,
  domesticProbeDone: false,
  domesticDataFound: false,
  demandProbeDone: false,
  demandDataFound: false,
  profitabilityDone: false,
  profitabilityFound: false,
  verdictKnown: false,
  verdictLabel: null,
  loadFailed: false,
};

/** 하위 항목 아이콘 — 화면 세 곳이 각자 기호를 고르지 않게 한 곳에서만 정한다. */
export const SUB_STEP_ICON: Record<SubStepStatus, string> = {
  DONE: "✓",
  DONE_NO_DATA: "✓",
  RUNNING: "●",
  UPCOMING: "○",
  ATTENTION: "⚠",
};
