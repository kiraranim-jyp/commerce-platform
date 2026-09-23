// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CanonicalProduct } from "@commerce/shared";
import { NOTICE_REFERENCE_ELIGIBLE_FIELDS } from "@commerce/listing";
import { StageBody } from "../StageBody";
import { MissingFieldsBulkPanel } from "../MissingFieldsBulkPanel";
import { resolveStageFocus } from "../stage-focus";
import { resolveWorkflow, type WorkflowInput } from "../workflow";
import type { RegistrationChannel } from "../registration-channels";

/**
 * REWORK-4 §1(CEO 지시, 2026-09-14) — **상세페이지 참조 일괄등록에 도달할 수
 * 있는가**를 렌더 결과로만 증명한다.
 *
 * ── 무엇이 고장나 있었나 ─────────────────────────────────────────────────
 * MissingFieldsBulkPanel은 StageBody의 `surfaces.required` 슬롯 하나에만 있고,
 * 그 슬롯을 그리던 곳은 PrepareWorkSurface(surface === "REQUIRED") 하나뿐이었다.
 * 즉 **③ 등록 준비에서 「필수 정보」 체크리스트 항목을 펼쳤을 때만** 존재했다.
 * price·images·source는 셋 다 아래 "언제든 열어볼 수 있는 것"에 자기 접힘을
 * 하나씩 갖고 있었는데 required만 그 자리가 없었다.
 *
 * 그 하나뿐인 길이 닫혔다: ③ 체크리스트에서 카테고리 항목이 빠지면서 ④로
 * 넘어가는 창이 넓어졌고, "카테고리 미확정 + 필수정보부족 0"인 상품은 곧바로
 * ④에 선다 — ③ 체크리스트 자체가 그려지지 않는다. 그런데 그 상태에서도 이
 * 패널이 다루는 항목(품명·모델명·중량…)은 그대로 남아 있다. 채널 readiness가
 * 세는 blockingCount와 이 패널이 세는 누락 항목은 애초에 다른 값이기 때문이다.
 *
 * ── BEFORE / AFTER (이 파일을 BEFORE 코드에 그대로 돌려서 실측) ───────────
 *   상태                                              BEFORE            AFTER
 *   S1 ① 상품 수집 중                                 ❌ 도달 불가   →  ✅
 *   S2 ② 시장 판단 중                                 ❌ 도달 불가   →  ✅
 *   S3 ③ 등록 준비 · 필수정보가 ⚠ (기본 펼침)          ✅ 기본 펼침   →  ✅
 *   S4 ③ 등록 준비 · 다른 항목이 ⚠                     ✅ 체크리스트  →  ✅
 *   S5 ④ 커머스 등록 · 카테고리 미확정 + 필수정보부족 0  ❌ 도달 불가   →  ✅ 🔴 신고된 상태
 *   S6 ④ 커머스 등록 · 한 채널 등록 완료                ❌ 도달 불가   →  ✅
 *
 * BEFORE에서 살아 있던 두 상태(S3·S4)는 둘 다 ③ 체크리스트를 거치는 같은 길
 * 하나다. 그 길이 그려지지 않는 나머지 네 상태에서 패널이 통째로 사라져 있었다.
 *
 * ── 왜 마운트해서 눌러보는가 ─────────────────────────────────────────────
 * CollapsibleSection은 펼치기 전에는 children을 마운트하지 않는다(그 파일의
 * `{(open || alwaysRenderChildren) && …}`). 그래서 서버 렌더만 보면 "제목은
 * 있는데 패널이 없다"가 되어, 접혀 있는 것과 아예 없는 것을 구분할 수 없다.
 * 셀러가 실제로 하는 일(그 줄을 누른다)을 그대로 해서 패널이 나오는지 본다.
 */

function field<T>(value: T, source = "ORIGINAL") {
  return { value, source, confidence: 1 } as never;
}
/** 원본에서 값을 확인하지 못한 필드 — MissingFieldsBulkPanel이 세는 그 상태다. */
function unresolved() {
  return { value: "", source: "REQUIRED", confidence: 0 } as never;
}

/**
 * 9개 참조 대상 필드가 전부 비어 있는 상품. 화이트리스트를 이 파일에서 다시
 * 적지 않는다 — NOTICE_REFERENCE_ELIGIBLE_FIELDS를 그대로 순회해서 비운다.
 * 목록이 늘거나 줄면 이 fixture가 따라간다(두 벌이 되지 않는다).
 */
function makeProduct(): CanonicalProduct {
  const base = {
    sourceUrl: "https://example.com/products/a",
    title: field("Terry Bermuda Shorts"),
    brand: field("Bobo Choses"),
    price: field({ amount: 50, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field("B226AC043"),
    description: field("Terry bermuda shorts."),
    options: field([]),
    optionGroups: [],
    variants: [],
    images: [],
    titleKo: field(""),
    descriptionKo: field(""),
    keywords: field([]),
    seoTitle: field(""),
    seoDescription: field(""),
    countryOfOrigin: field("스페인"),
    returnPolicy: field("반품 가능"),
    shippingFee: field(0),
    stockQuantity: field(999),
    certification: field(""),
    childCertification: field(null),
    certificationType: field(""),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
  } as Record<string, unknown>;
  for (const key of NOTICE_REFERENCE_ELIGIBLE_FIELDS) base[key] = unresolved();
  return base as unknown as CanonicalProduct;
}

const CHANNELS: RegistrationChannel[] = [
  {
    id: "smartstore",
    label: "스마트스토어",
    availability: "AVAILABLE",
    state: null,
    blockingCount: 0,
    provisional: false,
    requiredTotal: 0,
  },
  {
    id: "coupang",
    label: "쿠팡",
    availability: "AVAILABLE",
    state: null,
    blockingCount: 0,
    provisional: false,
    requiredTotal: 0,
  },
];

const MARKET_DONE = {
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

const PREPARE_OK = {
  productInfoOk: true,
  productInfoMissing: null,
  optionGroupCount: 0,
  imageCount: 6,
  detailReady: true,
  priceResolved: true,
  priceKrw: 128000,
  requiredFieldBlockingCount: 0,
};

function signals(overrides: Partial<WorkflowInput>): WorkflowInput {
  return {
    collection: { running: false, percent: 100, productReady: true, imageCount: 6, failedImageCount: 0 },
    market: MARKET_DONE,
    prepare: PREPARE_OK,
    register: {
      channels: CHANNELS.map((c) => ({
        id: c.id,
        label: c.label,
        availability: c.availability,
        registered: false,
      })),
    },
    ...overrides,
  } as WorkflowInput;
}

/**
 * CEO가 지목한 6개 상태. 단계를 손으로 정하지 않는다 — 신호를 넣고
 * resolveWorkflow()가 내는 단계를 그대로 쓴다(화면과 같은 판정 하나).
 */
const STATES: { name: string; stage: string; input: WorkflowInput }[] = [
  {
    name: "S1 ① 상품 수집 중",
    stage: "COLLECTING",
    input: signals({
      collection: { running: true, percent: 40, productReady: false, imageCount: 0, failedImageCount: 0 },
    }),
  },
  {
    name: "S2 ② 시장 판단 중",
    stage: "MARKET_JUDGING",
    input: signals({ market: { ...MARKET_DONE, profitabilityDone: false } }),
  },
  {
    name: "S3 ③ 등록 준비 · 필수정보가 ⚠ (체크리스트에서 기본 펼침)",
    stage: "REGISTRATION_PREPARING",
    input: signals({ prepare: { ...PREPARE_OK, requiredFieldBlockingCount: 2 } }),
  },
  {
    name: "S4 ③ 등록 준비 · 다른 항목이 ⚠ (필수 정보는 펼쳐지지 않음)",
    stage: "REGISTRATION_PREPARING",
    input: signals({
      prepare: { ...PREPARE_OK, productInfoOk: false, productInfoMissing: "상품명·브랜드를 확인해주세요" },
    }),
  },
  {
    // 🔴 이번 결함이 실제로 신고된 상태.
    name: "S5 ④ 커머스 등록 · 카테고리 미확정 + 필수정보부족 0",
    stage: "COMMERCE_REGISTERING",
    input: signals({}),
  },
  {
    name: "S6 ④ 커머스 등록 · 한 채널 등록 완료",
    stage: "COMMERCE_REGISTERING",
    input: signals({
      register: {
        channels: [
          { id: "smartstore", label: "스마트스토어", availability: "AVAILABLE", registered: true },
          { id: "coupang", label: "쿠팡", availability: "AVAILABLE", registered: false },
        ],
      },
    }),
  },
];

/**
 * CommerceWorkspace가 상품정보 탭에서 StageBody에 넘기는 그 조립 그대로다 —
 * 다만 이 파일이 묻는 것은 `surfaces.required` 하나의 도달 가능성이므로,
 * 나머지 슬롯은 자리만 차지하는 표식 노드로 둔다(무엇이 열렸는지 구분하려고).
 */
function stageBodyElement(input: WorkflowInput) {
  const workflow = resolveWorkflow(input);
  const focus = resolveStageFocus({
    stage: workflow.currentStepKey,
    surface: "PRODUCT",
    marketDetailOpen: false,
  });
  return createElement(StageBody, {
    focus,
    workflow,
    channels: CHANNELS,
    onGoToChannel: () => {},
    marketEvidence: createElement("div", null, "시장 근거 노드"),
    archive: createElement("div", null, "기록 노드"),
    surfaces: {
      source: createElement("div", null, "SOURCE 편집기"),
      images: createElement("div", null, "IMAGES 편집기"),
      price: createElement("div", null, "PRICE 편집기"),
      required: createElement(MissingFieldsBulkPanel, { product: makeProduct(), onBulkApply: () => {} }),
    },
  });
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // @ts-expect-error — React가 act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

/** 패널이 지금 화면에 서 있는가. 제목 한 줄로 본다(패널이 스스로 그리는 글자). */
function panelVisible(): boolean {
  return (container.textContent ?? "").includes("불러오지 못한 항목");
}

/** 그 글자가 적힌 버튼을 누른다 — 셀러가 하는 일 그대로다. */
function clickButtonContaining(label: string): boolean {
  const button = Array.from(container.querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").includes(label),
  );
  if (!button) return false;
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  return true;
}

describe("REWORK-4 §1 — 상세페이지 참조 일괄등록은 6개 상태 전부에서 도달할 수 있다", () => {
  for (const state of STATES) {
    it(`${state.name} — 한 번의 클릭으로 패널이 열린다`, async () => {
      await act(async () => root.render(stageBodyElement(state.input)));

      // 단계 판정이 의도한 상태인지 먼저 못 박는다 — 단계가 밀리면 이 검사는
      // 다른 화면을 보고 통과할 수 있다(BEFORE 측정에서 실제로 겪었다).
      expect(resolveWorkflow(state.input).currentStepKey).toBe(state.stage);

      // ③에서 체크리스트가 이미 펼쳐 둔 경우(S3)는 클릭 없이 이미 서 있다.
      if (!panelVisible()) {
        expect(clickButtonContaining("필수 정보"), `"필수 정보"를 열 길이 화면에 없다`).toBe(true);
      }
      expect(panelVisible(), `${state.name}: 패널에 도달하지 못했다`).toBe(true);
    });
  }

  it("어느 상태에서도 같은 패널 하나다 — 한 화면에 두 벌이 뜨지 않는다", async () => {
    for (const state of STATES) {
      await act(async () => root.render(stageBodyElement(state.input)));
      if (!panelVisible()) clickButtonContaining("필수 정보");
      const occurrences = (container.textContent ?? "").split("불러오지 못한 항목").length - 1;
      expect(occurrences, `${state.name}: 같은 패널이 ${occurrences}벌 떠 있다`).toBe(1);
    }
  });
});

describe("REWORK-4 §1 — 대상 필드를 한 건도 줄이지 않았다", () => {
  const LABELS = [
    "품명",
    "모델명",
    "중량",
    "소재",
    "색상",
    "제조사",
    "세탁방법/취급주의",
    "사용연령",
    "수입사명",
  ];

  it(`9개 화이트리스트 필드가 전부 나온다 (${NOTICE_REFERENCE_ELIGIBLE_FIELDS.length}개)`, async () => {
    // S5(④) — BEFORE에서 도달조차 못 하던 상태에서 전수를 확인한다.
    await act(async () => root.render(stageBodyElement(STATES[4].input)));
    clickButtonContaining("필수 정보");
    const text = container.textContent ?? "";
    expect(text).toContain(`불러오지 못한 항목 (${NOTICE_REFERENCE_ELIGIBLE_FIELDS.length}개)`);
    for (const label of LABELS) {
      expect(text, `대상 필드가 빠졌다: ${label}`).toContain(label);
    }
    // 체크박스도 필드 수만큼 실제로 서 있다(전체 선택 1개 + 9개).
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(NOTICE_REFERENCE_ELIGIBLE_FIELDS.length + 1);
  });

  it("🔴 KC/인증은 여기에 절대 나오지 않는다 — 상세페이지 참조 대체가 영구 금지다", async () => {
    await act(async () => root.render(stageBodyElement(STATES[4].input)));
    clickButtonContaining("필수 정보");
    const text = container.textContent ?? "";
    for (const forbidden of ["KC", "인증구분", "어린이제품", "인증번호"]) {
      expect(text, `KC/인증이 일괄 참조 대상으로 새어 들어왔다: ${forbidden}`).not.toContain(forbidden);
    }
    // 화이트리스트 자체에도 없다는 사실을 같이 고정한다(N-3.45 STEP10 가드).
    expect(NOTICE_REFERENCE_ELIGIBLE_FIELDS as readonly string[]).not.toContain("certificationType");
    expect(NOTICE_REFERENCE_ELIGIBLE_FIELDS as readonly string[]).not.toContain("childCertification");
  });
});
