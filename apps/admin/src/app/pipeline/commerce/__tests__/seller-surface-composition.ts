import { createElement, useMemo, useState, type ReactElement } from "react";
import { resolveListingPrice } from "@commerce/pricing";
import {
  DomesticPriceIntelligencePanel,
  PRICE_COMPARISON_ANCHOR_ID,
  resolveSellVerdictCopy,
  type MarketComparisonInput,
  type SellVerdictRepresentativeCode,
} from "../DomesticPriceIntelligencePanel";
import { ProductJudgementSummary } from "../ProductJudgementSummary";
import type { JudgementSummaryInput } from "../judgement-summary";
import { MarketPriceComparison } from "../MarketPriceComparison";
import { ActionCenter } from "../ActionCenter";
import { resolveStageFocus } from "../stage-focus";
import { resolveWorkflow } from "../workflow";
import type { RegistrationChannel } from "../registration-channels";
import { makeProduct, PROFIT, RATES, ROUNDING_UNIT } from "./product-tab-composition";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SELLER-SURFACE-RENDER-HARNESS-1 — **셀러가 실제로 보는 화면을 조립한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 왜 이 파일이 필요한가 ────────────────────────────────────────────────────
 * 배포를 **다섯 번**(`6140b237`·`217c4665`·`2cf58932`·`d0792f10`·`527c5495`) 했고
 * 코드/테스트/빌드가 전부 PASS 였는데 **CEO 실화면은 그대로였다.** 원인은 코드가
 * 아니라 **증명의 축** 이었다:
 *
 * ```
 * 「소스에 그 식이 있다」           → 코드 연결만 증명
 * 「컴포넌트를 따로 띄우니 나온다」  → 그 컴포넌트의 독립 동작만 증명
 * ⟹ 🔴 둘 다 **「셀러 화면이 그렇게 보인다」를 증명하지 않는다**
 * ```
 *
 * 실측(2026-11-08): 이 저장소에 `CommerceWorkspace` **격자 밖 결론 영역** 을
 * 마운트하는 하니스가 **하나도 없었다.** 이름이 그렇게 붙은 것들조차 아니었다 —
 * `core-2ao-r1-screen-dump`(「화면 실측」) → `MarketPriceComparison` 하나 ·
 * `core-e2e-close-01-seller-surface`(「셀러 표면」) → `GeminiTransientCandidates` 하나.
 *
 * ── 🔴🔴 왜 `product-tab-composition.ts` 를 «제자리에서» 넓히지 않았나 ──────────
 * 그 파일을 넓히라는 것이 지시였고, **fixture 는 실제로 그 파일에서 import 한다**
 * (아래 `makeProduct`·`PROFIT`·`RATES`·`ROUNDING_UNIT`). 그러나 그 파일의
 * `productTabElement` **트리에 노드를 더하면 안 된다**:
 *
 * ```
 * regionsOf(html)  →  const [mi, stage, aside] = Array.from(root.children)
 * ```
 *
 * 🔴 **위치로 분해한다.** 격자 밖 두 블록을 그 트리 앞에 더하면 `mi` 가 요약 블록을,
 *    `stage` 가 MI 를 가리키게 되어 그 함수를 쓰는 **테스트 15개가 조용히 다른 영역을
 *    단언** 한다(거짓 통과/거짓 실패). ⟹ 🟢 그래서 **조립만 새 파일** 이고 fixture·규약·
 *    읽기 도구는 그 파일을 재사용한다. 선례 트리는 **한 글자도 바뀌지 않았다.**
 *
 * ── 이 조립이 선례와 «다른» 단 두 가지 ───────────────────────────────────────
 * ```
 * ① 패널을 **outer** 로 마운트한다 — `DomesticPriceIntelligencePanel`
 *    (선례는 `MiPanelView` = inner 라 `presentation="HIDDEN"` 게이트를 **건너뛴다**)
 * ② 격자 **밖** 두 블록이 있다 — 요약 슬롯 · 결론 영역(= 운영에서 셀러가 보는 전부)
 * ```
 * 🔴🔴 ①이 이 파일의 핵심이다. 운영에서 그 패널은 **항상 `HIDDEN`** 이고
 *    (`CommerceWorkspace:3999`) `HIDDEN` 은 **훅을 전부 돌린 뒤** `return null` 이다
 *    (`DomesticPriceIntelligencePanel:2843`). ⟹ 🟢 **콜백은 그대로 발화하고** 격자 밖
 *    블록이 그 값으로 찬다. 그래서 여기서는 데이터를 prop 으로 **밀어넣지 않는다** —
 *    운영과 같이 **패널이 공급한다**(그것이 측정 대상이기 때문이다).
 *
 * ── fixture 규약(선례에서 그대로 상속) ──────────────────────────────────────
 * 🔴 숫자를 지어내지 않는다 · 🔴 수익성·권장가는 **제품 함수** 가 낸다
 *    (`computeProfitabilityNumbers` · `resolveListingPrice`) · 🔴 서버 응답 모양은
 *    `PriceHistoryResponse` 타입으로 못박는다(손으로 적은 모양이 유니온 밖 값을 갖고
 *    있어 화면이 죽고 경로 하나가 통째로 숨은 적이 있다).
 */

/** 운영과 같은 세 채널. 선례(`product-tab-composition`)의 그 목록과 같은 모양이다. */
const CHANNELS: RegistrationChannel[] = [
  {
    id: "smartstore",
    label: "스마트스토어",
    availability: "PREVIEW_ONLY",
    state: null,
    blockingCount: 0,
    provisional: false,
    requiredTotal: 0,
  },
  { id: "coupang", label: "쿠팡", availability: "COMING_SOON", state: null, blockingCount: 0, provisional: false, requiredTotal: 0 },
  { id: "elevenst", label: "11번가", availability: "COMING_SOON", state: null, blockingCount: 0, provisional: false, requiredTotal: 0 },
];

/** 하니스가 쓰는 스냅샷 id. fetch stub 이 이 값으로 경로를 가른다. */
export const SNAPSHOT_ID = "seller-surface-harness-1";

function noop() {}

export interface SellerSurfaceOptions {
  /**
   * 🔴 운영 게이트 `workSurface !== "CHANNEL"` 의 입력. 커머스 탭에서는 격자 밖
   *    두 블록이 **서지 않는다**(CEO 지시 · `wu-132 C-3b`). 기본은 상품정보 탭이다.
   */
  surface?: "PRODUCT" | "CHANNEL";
  /**
   * 🔴 자동 1회차 `POST /check` 가 아직 응답 전 — 패널이 「확인 중」으로 사는 구간.
   *    로딩 상태를 **따로** 검증하라는 CPO 안전장치가 이 옵션을 요구한다.
   */
  autoChecking?: boolean;
  /** ② 시장 판단이 끝났는가. `stage-focus` 가 이 값으로 ActionCenter 모드를 정한다. */
  marketDone?: boolean;
  /** 국내 비교상품이 확인됐는가 — workflow 의 `domesticDataFound` 입력. */
  domesticDataFound?: boolean;
}

/** `CommerceWorkspace` 가 셀러 화면에서 조립하는 그 트리. */
export function sellerSurfaceElement(options: SellerSurfaceOptions = {}): ReactElement {
  return createElement(SellerSurface, options);
}

function SellerSurface(options: SellerSurfaceOptions): ReactElement {
  const product = makeProduct();
  const workSurface = options.surface ?? "PRODUCT";
  const snapshotId = SNAPSHOT_ID;

  /**
   * 🔴 운영이 들고 있는 그 state 넷. **패널이 콜백으로 채운다** — 여기서 만들지 않는다
   *    (`CommerceWorkspace:865·876·755` 와 같은 자리·같은 규약).
   */
  const [marketComparison, setMarketComparison] = useState<MarketComparisonInput | null>(null);
  const [judgementSummary, setJudgementSummary] = useState<JudgementSummaryInput | null>(null);
  /**
   * 🔴 **snapshotId 로 범위를 묶는다** — 운영이 그렇게 한다(`:755`). 묶지 않으면 상품 A 의
   *    판정이 상품 B 화면에 남는다(메모 `sticky-state-must-be-scoped-to-entity`).
   */
  const [reportedSellVerdict, setReportedSellVerdict] = useState<{
    snapshotId: string | null;
    verdict: Parameters<NonNullable<Parameters<typeof DomesticPriceIntelligencePanel>[0]["onSellerVerdictChange"]>>[0];
  } | null>(null);
  const [reportedRepVerdict, setReportedRepVerdict] = useState<{
    snapshotId: string | null;
    code: SellVerdictRepresentativeCode | null;
  } | null>(null);

  const sellVerdict =
    reportedSellVerdict && reportedSellVerdict.snapshotId === snapshotId ? reportedSellVerdict.verdict : null;
  const representativeCode =
    reportedRepVerdict && reportedRepVerdict.snapshotId === snapshotId ? reportedRepVerdict.code : null;

  /**
   * 🔴🔴 **추천 판매가격 A** — 운영과 **같은 함수·같은 입력** 이다(`CommerceWorkspace:2047`).
   *    🔴 `recommendation.recommendedPrice`(= B)를 쓰지 않는다. 그 값은 화면의
   *       「추천 판매가」가 **아니다**(실측 확정 · `JudgementSummaryInput` 머리 주석).
   */
  const recommendedPriceKrw = useMemo(
    () =>
      resolveListingPrice(
        {
          priceOverrideKrw: null,
          originalAmount: product.price.value.amount,
          originalCurrency: product.price.value.currency,
          priceBreakdown: product.priceBreakdown,
          priceValidity: product.priceValidity,
        },
        RATES,
        ROUNDING_UNIT,
      ).priceKrw,
    [product],
  );

  const workflow = resolveWorkflow({
    collection: { running: false, percent: 100, productReady: true, imageCount: 6, failedImageCount: 0 },
    market: {
      notStarted: false,
      priceProbeDone: true,
      domesticProbeDone: options.marketDone !== false,
      domesticDataFound: options.domesticDataFound ?? false,
      demandProbeDone: true,
      demandDataFound: false,
      profitabilityDone: true,
      profitabilityFound: true,
      verdictKnown: true,
      verdictLabel: "조건부 판매",
      loadFailed: false,
    },
    prepare: {
      productInfoOk: true,
      productInfoMissing: null,
      optionGroupCount: 0,
      imageCount: 6,
      detailReady: true,
      priceResolved: true,
      priceKrw: PROFIT.recommendedPriceKrw,
      requiredFieldBlockingCount: 2,
    },
    register: {
      channels: CHANNELS.map((c) => ({
        id: c.id,
        label: c.label,
        availability: c.availability,
        registered: false,
      })),
    },
  });

  const stageFocus = resolveStageFocus({
    stage: workflow.currentStepKey,
    surface: workSurface,
    marketDetailOpen: false,
  });

  /**
   * 🔴🔴🔴 **운영에서 이 패널은 «렌더되지 않는다»**(`presentation="HIDDEN"`).
   *    그래도 여기 있어야 하는 이유가 이 파일의 존재 이유다 — **공급원** 이기 때문이다.
   *    훅/effect 는 `HIDDEN` 게이트 «위» 에서 전부 돌고, 그 결과가 위 state 넷으로
   *    올라와 **격자 밖 두 블록을 채운다**. 🔴 지우면 결론 영역이 빈다.
   */
  const panel = createElement(DomesticPriceIntelligencePanel, {
    snapshotId,
    snapshotOriginPrice:
      product.priceValidity === "VALID"
        ? { amount: product.price.value.amount, currency: product.price.value.currency }
        : null,
    onPriceLevelChange: noop,
    onSellerVerdictChange: (verdict) =>
      setReportedSellVerdict((prev) =>
        prev && prev.snapshotId === snapshotId && prev.verdict === verdict ? prev : { snapshotId, verdict },
      ),
    onRepresentativeVerdictChange: (code) =>
      setReportedRepVerdict((prev) =>
        prev && prev.snapshotId === snapshotId && prev.code === code ? prev : { snapshotId, code },
      ),
    onMarketSignalChange: noop,
    onRequestPriceReview: noop,
    profitability: PROFIT,
    autoChecking: options.autoChecking ?? false,
    /** 🔴 운영이 넘기는 그 값 그대로 — 셀러 화면에서는 **항상** 이것이다. */
    presentation: "HIDDEN",
    onOpenDetail: noop,
    priceCalculationDetail: null,
    overseasMarketEvidence: null,
    openPriceDetailRequest: 0,
    onMarketComparisonChange: setMarketComparison,
    onJudgementSummaryChange: setJudgementSummary,
    originImageUrl: null,
    originTitle: product.title.value,
  });

  const actionCenter = createElement(ActionCenter, {
    channelActionMode: workflow.currentStepKey === "COMMERCE_REGISTERING" ? ("REGISTER" as const) : ("CHECK" as const),
    /** 🔴 **세 화면이 이 함수 하나를 쓴다** — 하나만 바꾸면 화면끼리 다른 말을 한다. */
    verdict: resolveSellVerdictCopy(sellVerdict ?? null, representativeCode),
    verdictPending: sellVerdict == null,
    verdictMode: stageFocus.actionCenter.verdict,
    checklist: [
      { key: "category", label: "카테고리 확인", ok: false, onClick: noop },
      { key: "price", label: "판매가격", ok: true, onClick: noop },
    ],
    checklistMode: stageFocus.actionCenter.checklist,
    channels: CHANNELS,
    channelsMode: stageFocus.actionCenter.channels,
    currentStageLabel: workflow.current.label,
    currentTodo: workflow.currentSubStep?.label ?? null,
    onOpenVerdict: noop,
    onGoToChannel: noop,
  });

  /**
   * 🔴 **순서가 운영과 같아야 한다.** 격자 «밖» 요약 → 격자 «밖» 결론 영역 → 격자
   *    (왼쪽 패널 · 오른쪽 ActionCenter). WU-140-R1 이 측정한 그 사실 때문이다 —
   *    격자 `order` 유틸리티가 `lg` 미만에서 ActionCenter 를 기둥 전체보다 먼저 세우므로
   *    **「기둥 안 맨 위」는 「화면 맨 위」가 아니다**(메모 `container-top-is-not-screen-top`).
   */
  return createElement(
    "div",
    { "data-testid": "seller-surface-root" },
    workSurface !== "CHANNEL" && judgementSummary
      ? createElement(
          "div",
          { "data-testid": "seller-judgement-summary-slot", className: "mb-3", key: "summary" },
          createElement(ProductJudgementSummary, { ...judgementSummary, recommendedPriceKrw }),
        )
      : null,
    workSurface !== "CHANNEL"
      ? createElement(
          "div",
          { id: PRICE_COMPARISON_ANCHOR_ID, className: "scroll-mt-4", key: "conclusion" },
          createElement(MarketPriceComparison, {
            rows: marketComparison?.rows ?? null,
            snapshotId,
            onRecheck: marketComparison?.onRecheck ?? null,
            rechecking: marketComparison?.rechecking ?? false,
            domesticReference: marketComparison?.domesticReference ?? null,
            overseasReference: marketComparison?.overseasReference ?? null,
            costPriceKrw: marketComparison?.costPriceKrw ?? null,
            recommendedPriceKrw,
            marketPriceKrw: marketComparison?.marketPriceKrw ?? null,
            marketPriceMarginPercent: marketComparison?.marketPriceMarginPercent ?? null,
            onOpenPriceCalculation: noop,
            sellVerdictCopy: resolveSellVerdictCopy(sellVerdict ?? null, representativeCode),
            /**
             * 🔵 MI-INVESTIGATION-STATE-UX-2 ④ — 운영과 **같은 폴백** 이다
             *    (`marketComparison === null` = 패널이 아직 보고하지 않은 첫 프레임).
             */
            investigation: marketComparison?.investigation ?? "INVESTIGATING",
            onApplyRecommendedPrice: recommendedPriceKrw != null ? noop : undefined,
            finalPriceKrw: product.priceOverrideKrw?.value ?? null,
            onConfirmPriceKrw: noop,
            onOpenPriceEditor: noop,
          } as never),
        )
      : null,
    createElement(
      "div",
      { "data-testid": "seller-surface-grid", className: "grid lg:grid-cols-[minmax(0,1fr)_300px]", key: "grid" },
      /**
       * 🔴 두 기둥에 **식별자** 를 준다. 1차 구현은 `.grid` 선택자로 집었는데 그것이
       *    결론 영역 **안쪽** 의 내부 격자를 먼저 잡아 단언이 엉뚱한 노드를 봤다
       *    (이 트랙 함정 ①의 선택자 판 — 「위치/클래스로 집지 말고 식별자로 집는다」).
       */
      createElement("div", { "data-testid": "seller-surface-left", className: "order-2 lg:order-1", key: "left" }, panel),
      createElement(
        "div",
        { "data-testid": "seller-surface-right", className: "order-1 lg:order-2", key: "right" },
        actionCenter,
      ),
    ),
  );
}

/* ───────────────────────────── 읽기 도구 ───────────────────────────── */

/**
 * 🔴🔴 **셀러가 «펼치지 않고» 보는 글자만** 남긴다.
 *
 * 닫힌 `<details>` 의 자식도 **DOM 에는 있다.** 그래서 `textContent` 에 어떤 글자가
 * 있다는 사실을 「표시 성공」으로 세면 **이번 실패가 그대로 재발한다**(CPO 안전장치).
 * 🟢 같은 방식이 이미 이 저장소에 있다(`core-next-step4-recommended-price:firstScreen`) —
 * 새 규칙을 만들지 않고 그것을 쓴다.
 */
export function firstScreenText(container: HTMLElement): string {
  const clone = container.cloneNode(true) as HTMLElement;
  for (const d of [...clone.querySelectorAll("details")]) if (!d.hasAttribute("open")) d.remove();
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** 접힘 안까지 포함한 전부. 🔴 「보인다」의 근거로 쓰지 않는다 — 분모 확인용이다. */
export function wholeText(container: HTMLElement): string {
  return (container.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * 격자 밖 두 블록과 격자를 **위치가 아니라 식별자** 로 집는다.
 * 🔴 선례 `regionsOf` 가 위치로 분해해서 생긴 취약성(이 파일 머리 주석)을 반복하지 않는다.
 */
export function surfaceRegions(container: HTMLElement): {
  summary: HTMLElement | null;
  conclusion: HTMLElement | null;
  grid: HTMLElement | null;
  /** 왼쪽 기둥 — 운영에서 패널이 `HIDDEN` 이라 **비어 있어야** 한다. */
  left: HTMLElement | null;
  /** 오른쪽 기둥 — ActionCenter. */
  right: HTMLElement | null;
} {
  return {
    summary: container.querySelector<HTMLElement>('[data-testid="seller-judgement-summary-slot"]'),
    conclusion: container.querySelector<HTMLElement>(`#${PRICE_COMPARISON_ANCHOR_ID}`),
    grid: container.querySelector<HTMLElement>('[data-testid="seller-surface-grid"]'),
    left: container.querySelector<HTMLElement>('[data-testid="seller-surface-left"]'),
    right: container.querySelector<HTMLElement>('[data-testid="seller-surface-right"]'),
  };
}

/**
 * 🔴 셀러 화면에서 **블록이 서는 순서**. 「요약이 결론보다 먼저」를 위치로 단언하려면
 *    이것이 필요하다(문자열 검색으로는 순서를 못 본다).
 */
export function blockOrder(container: HTMLElement): string[] {
  const root = container.querySelector('[data-testid="seller-surface-root"]');
  if (!root) return [];
  return [...root.children].map((el) =>
    el.getAttribute("data-testid") === "seller-judgement-summary-slot"
      ? "SUMMARY"
      : el.id === PRICE_COMPARISON_ANCHOR_ID
        ? "CONCLUSION"
        : el.getAttribute("data-testid") === "seller-surface-grid"
          ? "GRID"
          : "UNKNOWN",
  );
}
