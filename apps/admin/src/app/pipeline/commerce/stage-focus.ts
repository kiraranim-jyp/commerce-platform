import type { BigStep, BigStepKey } from "./workflow";

/**
 * UX 2.2(CEO 지시, 2026-09-11) — 상단 Flow의 현재 단계가 본문의 주인공을 정한다.
 *
 * ── 무엇이 문제였나 ──────────────────────────────────────────────────────
 * UX 2.1이 진행 표시 셋을 하나로 합쳤다. 그런데 상단은 "③ 등록 준비"라고
 * 말하는데 본문은 여전히 한 장짜리 긴 문서였다 — 카테고리 카드 · MI · 국내
 * 가격비교 · 해외 가격비교 · 이미지 · Source Data · 필수정보가 단계와 무관하게
 * 전부 같은 크기로 쌓여 있었다. 결과:
 *
 *   · 상단과 본문이 이어지지 않는다 → "상단은 ③이라는데 아래에서 뭘 하라는 거지?"
 *   · 끝난 단계가 현재 단계보다 더 넓은 자리를 차지한다(①②는 펼쳐진 채, ③이 할 일).
 *   · 오른쪽 Action 카드와 같은 말이 본문 여러 곳에서 반복된다.
 *   · MI 뒤로 전체 크기 섹션이 다섯 개 더 붙어서 MI가 다시 "섹션 중 하나"가 된다.
 *
 * ── 이 파일이 하는 일 ────────────────────────────────────────────────────
 * "지금 단계가 X이고 지금 보고 있는 작업면이 Y일 때, 화면의 각 덩어리를 어떤
 * 무게로 그릴 것인가"를 정하는 **단 하나의** 규칙표다. 화면 컴포넌트가 각자
 * `stage === "..." && tab === "..."`를 세면 같은 판단이 대여섯 벌로 흩어지고,
 * 그중 하나만 고쳐지는 순간 상단과 본문이 또 갈라진다 — 이 프로젝트에서 반복된
 * 버그 유형이라(중복 매핑의 표류) 판단을 여기 한 곳에 모은다.
 *
 * ── 이 파일이 하지 않는 일 ───────────────────────────────────────────────
 * 단계를 판정하지 않는다. 현재 단계는 workflow.ts의 resolveWorkflow()가 이미
 * 만든 값이고 여기서는 그 결과(BigStepKey)를 **받기만** 한다. 가격·MI 계산은
 * 물론 근처에도 가지 않는다 — 같은 데이터를 어느 무게로 보여줄지만 정한다.
 */

/** 지금 열려 있는 작업면. 탭 이름이 아니라 "무슨 일을 하는 화면인가"다. */
export type WorkSurface =
  /** 상품 정보 탭 — 단계별 본문이 사는 곳. */
  | "PRODUCT"
  /** 채널 탭(스마트스토어/쿠팡/11번가) — ④ 커머스 등록의 작업면. */
  | "CHANNEL"
  /** AI 콘텐츠 탭. */
  | "CONTENT";

/**
 * MI를 어느 무게로 그릴 것인가. **데이터와 계산은 전혀 바뀌지 않는다** —
 * 같은 서버 응답을 전체로 펼치느냐 한 줄 요약으로 접느냐의 차이뿐이다.
 *
 *   FULL    ② 시장 판단 — 화면의 주인공.
 *   SUMMARY ③④ — 🟡 조건부 판매 · 한국 시장 ₩… · 예상 마진 …% · [판단 상세보기]
 *   HIDDEN  ① 수집 중 — 아직 판단할 근거 자체가 없다. 빈 카드로 자리를 잡으면
 *           "분석이 실패했나"로 읽힌다.
 */
export type MiPresentation = "FULL" | "SUMMARY" | "HIDDEN";

/** 본문의 주인공. 큰 단계와 1:1이다 — 여기에 5번째 값이 생기면 단계가 늘어난 것이다. */
export type StageMain = "COLLECTION" | "MARKET" | "PREPARE" | "REGISTER";

/** 이미지가 이 단계에서 갖는 성격. 같은 컴포넌트를 다른 무게로 놓는다. */
export type ImageRole =
  /** ① 수집 — 지금 하고 있는 일 그 자체. */
  | "CORE"
  /** ②④ — 판단/등록의 참고 자료. 접어 둔다(MI 위로 절대 올라가지 않는다). */
  | "REFERENCE"
  /** ③ 등록 준비 — 등록용으로 다듬는 편집 대상. */
  | "EDIT";

/** 본문 덩어리의 무게. MAIN은 펼친 채, COLLAPSED는 제목 + ▾만. */
export type SectionWeight = "MAIN" | "COLLAPSED";

/** 오른쪽 Action Center의 각 블록을 목록으로 둘지 한 줄로 접을지. */
export type PanelMode = "LIST" | "SUMMARY";

/**
 * 상단 Flow에서 한 단계를 눌렀을 때 할 수 있는 일.
 *
 * **DETAIL_ONLY가 이 타입의 핵심이다.** 끝난 단계를 누르면 그 단계로 "돌아가는"
 * 것이 아니라 결과를 보여주기만 한다. 끝난 단계를 다시 작업 모드로 열어주면
 * 상단 Flow가 탭 내비게이션이 되고, 그 순간 "지금 어느 흐름에 서 있는지"가
 * 다시 여러 개가 된다 — UX 2.1이 없앤 바로 그 혼란이다.
 */
export type StepInteraction = "ACTIVE" | "DETAIL_ONLY" | "LOCKED";

/** ③ 등록 준비의 체크리스트 항목이 실제로 열어야 하는 작업면. */
export type PrepareSurface =
  /** 상품명·브랜드·옵션·상세설명 — Source Data 편집기. */
  | "SOURCE"
  /** 이미지 편집기. */
  | "IMAGES"
  /** 카테고리 — 실제 확정은 채널 화면에서만 가능하다(등록 payload에 들어가는 값). */
  | "CATEGORY"
  /**
   * UX 2.5(CEO 지시, 2026-09-11) — 가격 계산기(PriceEditor).
   *
   * 카테고리와 정반대다. 카테고리는 채널마다 코드가 달라서 채널 화면에서만
   * 확정할 수 있지만, 판매가는 resolveListingPrice()가 내는 **하나의 값**이라
   * 채널이 고를 것이 없다. 그래서 편집기는 여기 하나만 있고 채널 화면에는
   * 그 결과를 읽기전용으로 보여준다.
   */
  | "PRICE"
  /** 채널별 필수 정보. */
  | "REQUIRED";

export interface StageFocusInput {
  /** resolveWorkflow()가 이미 정한 현재 단계. 여기서 다시 판정하지 않는다. */
  stage: BigStepKey;
  surface: WorkSurface;
  /**
   * 요약 카드의 [판단 상세보기] 또는 끝난 ②를 눌러서 판단을 펼쳐 둔 상태인가.
   * 이건 "단계를 ②로 되돌린다"가 아니다 — 현재 단계는 그대로고 MI만 펼친다.
   */
  marketDetailOpen: boolean;
}

export interface StageFocus {
  stage: BigStepKey;
  surface: WorkSurface;
  /** 본문의 주인공. */
  main: StageMain;
  mi: MiPresentation;
  images: ImageRole;
  /** 국내/해외 가격비교 — ②에서만 본문이고 나머지 단계에서는 접힌 근거다. */
  marketEvidence: SectionWeight;
  /**
   * Source Data는 어느 단계에서도 주인공이 아니다 — 원본이 무엇이었는지는
   * 확인하고 싶을 때 여는 근거지, 매번 읽어야 하는 작업이 아니다.
   * (③에서 상품정보 항목을 고르면 그 항목의 작업 UI로 따로 펼쳐진다.)
   */
  sourceData: SectionWeight;
  actionCenter: {
    /** 등록 전 확인 목록. ③ 본문이 같은 목록을 이미 갖고 있으면 한 줄로 접는다. */
    checklist: PanelMode;
    /** 채널 버튼. ④ 본문이나 채널 화면이 이미 그 행동을 갖고 있으면 한 줄로 접는다. */
    channels: PanelMode;
  };
}

const MAIN_BY_STAGE: Record<BigStepKey, StageMain> = {
  COLLECTING: "COLLECTION",
  MARKET_JUDGING: "MARKET",
  REGISTRATION_PREPARING: "PREPARE",
  COMMERCE_REGISTERING: "REGISTER",
};

const IMAGE_ROLE_BY_STAGE: Record<BigStepKey, ImageRole> = {
  COLLECTING: "CORE",
  MARKET_JUDGING: "REFERENCE",
  REGISTRATION_PREPARING: "EDIT",
  COMMERCE_REGISTERING: "REFERENCE",
};

export function resolveStageFocus(input: StageFocusInput): StageFocus {
  const { stage, surface, marketDetailOpen } = input;

  const mi: MiPresentation =
    // 수집 중에는 판단의 근거가 아직 하나도 없다. 접힌 요약조차 지어낼 값이 없다.
    stage === "COLLECTING"
      ? "HIDDEN"
      : marketDetailOpen
        ? "FULL"
        : // 채널 화면은 ④의 작업면이다. 그 위에 MI를 통째로 펼치면 등록하러 온
          // 셀러가 판단 카드부터 다시 스크롤해 내려가야 한다 — 결론만 남긴다.
          surface === "PRODUCT" && stage === "MARKET_JUDGING"
          ? "FULL"
          : "SUMMARY";

  // 본문이 이미 갖고 있는 블록은 오른쪽에서 한 줄로 접는다. 같은 목록을 본문과
  // 오른쪽에 두 번 두면 셀러는 둘이 다른 것인 줄 알고 두 번 읽는다 — CEO가
  // 지적한 "우측 Action 카드가 여러 곳에서 반복된다"가 정확히 이것이다.
  const bodyOwnsChecklist = surface === "PRODUCT" && stage === "REGISTRATION_PREPARING";
  const bodyOwnsChannels =
    surface === "CHANNEL" || (surface === "PRODUCT" && stage === "COMMERCE_REGISTERING");

  return {
    stage,
    surface,
    main: MAIN_BY_STAGE[stage],
    mi,
    images: IMAGE_ROLE_BY_STAGE[stage],
    marketEvidence: stage === "MARKET_JUDGING" ? "MAIN" : "COLLAPSED",
    sourceData: "COLLAPSED",
    actionCenter: {
      checklist: bodyOwnsChecklist ? "SUMMARY" : "LIST",
      channels: bodyOwnsChannels ? "SUMMARY" : "LIST",
    },
  };
}

/**
 * 상단 Flow의 한 칸을 눌렀을 때 무엇을 할 수 있는가.
 *
 * 끝난 단계는 DETAIL_ONLY다 — 결과를 보여줄 뿐 그 단계로 데려가지 않는다.
 * 아직 오지 않은 단계는 LOCKED다 — 누르면 아무 일도 일어나지 않는다("열려는
 * 있는데 아무것도 없는 화면"이 제일 나쁘다).
 */
export function stepInteraction(step: BigStep, currentStageKey: BigStepKey): StepInteraction {
  if (step.key === currentStageKey) return "ACTIVE";
  if (step.done) return "DETAIL_ONLY";
  return "LOCKED";
}

/**
 * ③ 등록 준비 체크리스트 항목 → 실제로 펼칠 작업면.
 *
 * 키는 workflow.ts의 buildRegistrationPreparing()이 만든 하위 항목 키 그대로다.
 * 항목 목록을 화면에서 다시 적지 않기 위해서다 — 목록이 두 벌이 되면 workflow가
 * 항목을 하나 더 만들었을 때 본문에서만 조용히 사라진다.
 */
const PREPARE_SURFACE_BY_KEY: Record<string, PrepareSurface> = {
  // 카테고리 확정 UI는 채널 화면에만 있다(등록 payload의 leafCategoryId /
  // displayCategoryCode를 만드는 값이라 채널별 후보 목록이 필요하다).
  category: "CATEGORY",
  // 가격은 채널별 후보가 없다 — 값이 하나뿐이라 편집기도 하나뿐이다(PRICE 주석 참고).
  price: "PRICE",
  product_info: "SOURCE",
  option: "SOURCE",
  detail: "SOURCE",
  image: "IMAGES",
  required_fields: "REQUIRED",
};

export function prepareSurfaceOf(subStepKey: string): PrepareSurface {
  // 모르는 키는 Source Data로 보낸다 — 원본 값 편집기는 어떤 항목에서도
  // 최소한 "무엇이 들어 있는지"는 보여준다(빈 화면보다 낫다).
  return PREPARE_SURFACE_BY_KEY[subStepKey] ?? "SOURCE";
}

/**
 * 작업면(편집기) 이름 — 펼쳐서 작업할 때와 접어둘 때가 같은 이름을 쓰게 한
 * 곳에서만 정한다. 체크리스트 **항목** 이름(상품 정보 / 옵션 / 상세 설명)과는
 * 다르다: 그 셋은 전부 같은 편집기 하나(Source Data)에서 고친다.
 */
export const PREPARE_SURFACE_LABEL: Record<PrepareSurface, string> = {
  SOURCE: "Source Data",
  IMAGES: "이미지",
  CATEGORY: "카테고리",
  // PriceEditor가 자기 제목으로 쓰는 문구와 같은 말이다 — 접었을 때와 펼쳤을 때
  // 이름이 달라지면 셀러는 둘을 다른 화면으로 읽는다.
  //
  // MI/PRICE-1(CEO 지시, 2026-09-12) — "가격 계산" → "💰 판매가격 확정".
  // 이 작업면에서 계산이 사라졌기 때문이다(상세 계산은 MI ③ 💰 수익성 한
  // 곳으로 올라갔다). 이름이 "가격 계산"으로 남아 있으면 셀러는 계산하러
  // 왔다가 확정만 있는 화면을 보고, 계산은 또 어디 있나를 다시 찾는다.
  PRICE: "💰 판매가격 확정",
  REQUIRED: "필수 정보",
};
