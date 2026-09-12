import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GLOBAL_MARKET_HINT_LABEL, GLOBAL_MARKET_UNAVAILABLE_NOTE } from "../global-market";
import { buildMiVerdictExplanation } from "../mi-verdict-copy";
import { PRICE_MEANING_LABEL, PRICE_SECTION_TITLE } from "../price-hierarchy";
import {
  headingsInOrder,
  productTabElement,
  productionData,
  regionsOf,
  visibleText,
  withDomesticComparable,
  PROFIT,
  type TabOptions,
} from "./product-tab-composition";

/**
 * MI-FINAL-UX-3 REWORK(CEO 지시, 2026-09-12) — **상품정보 탭 전체**의 첫 화면.
 *
 * 이 파일이 보는 것은 MiPanelView 하나가 아니라 CommerceWorkspace가 상품정보
 * 탭에서 실제로 조립하는 트리다(product-tab-composition.ts). 그래야 "MI는
 * 짧은데 화면은 길다"를 구분해서 말할 수 있다 — 지난 세 번의 시도가 전부
 * 여기서 갈렸다. 실제로 이 파일을 처음 돌렸을 때 「국내 비교상품」·「🔎 판단
 * 근거」가 화면에 있다고 나왔는데, 둘 다 MI가 아니라 그 아래 단계 본문이
 * 그리던 글자였다 — 패널만 보던 검사로는 이 사실이 보이지 않는다.
 *
 * 규칙은 하나다: **아무것도 누르지 않은 상태의 렌더 결과**만 근거로 쓴다.
 * 소스 줄 수도, 잘라낸 구간도, 자식 하나만 떼어낸 렌더도 근거가 아니다.
 */

function render(options: TabOptions = {}): string {
  return renderToStaticMarkup(productTabElement(options));
}

/** ② 시장 판단이 현재 단계 — MI가 FULL로 서는 화면(CEO 스크린샷과 같은 상태). */
const MARKET_STAGE: TabOptions = { marketDone: false };
/** ③ 등록 준비에서 [가격 판단 상세보기]로 MI를 펼쳐 둔 화면. MI는 같은 FULL이다. */
const PREPARE_STAGE_MI_OPEN: TabOptions = { marketDetailOpen: true };

describe("상품정보 탭 — 아무것도 누르지 않았을 때의 첫 화면", () => {
  const html = render(MARKET_STAGE);
  const headings = headingsInOrder(html);
  /** 판단 카드 **안쪽**만. 아래 단계 본문의 글자가 섞이면 무엇이 MI인지 알 수 없다. */
  const miText = visibleText(regionsOf(html).mi);
  const miHtml = regionsOf(html).mi;

  /**
   * ── 이 테스트가 실제로 증명하는 것 ──────────────────────────────────────
   * 셀러가 읽는 제목이 **무엇이 몇 개 어떤 순서로** 서는가. 화면이 짧다는 것은
   * 코드 줄 수가 아니라 이 목록의 길이다.
   */
  it("첫 화면의 최상위 제목은 순서까지 고정된다", () => {
    expect(headings).toEqual([
      // ── 여기부터 MI(판단 카드) ──
      "Market Intelligence",
      "원본 상품",
      "ⓘ 글로벌 시장 가격",
      // "한국 시장 경쟁가격"은 비교상품 0건이라 DOM에 없다(아래 별도 검사).
      "수익성",
      "ⓘ 가격 계산 기준",
      "왜 이렇게 판단했나요?",
      // ── 여기부터는 MI가 아니다(StageBody) ──
      "지금 단계 · 2. 시장 판단",
      "🇰🇷 한국 시장 · 국내 비교상품 (베타)",
      "🌎 글로벌 시장 · 해외 판매처 가격 (베타)",
      "💰 판매가격 확정",
      "이미지",
      "Source Data",
      "Backlog",
      // ── 오른쪽 기둥(ActionCenter) ──
      "판매 판단",
      "등록 전 확인",
      "커머스 등록",
    ]);
  });

  /**
   * MI가 화면에서 차지하는 제목은 여섯이다. 이 숫자가 늘면 판단 카드가 다시
   * 설명 화면이 되어가는 중이라는 뜻이라, 숫자 자체를 못 박는다.
   */
  it("MI가 첫 화면에 세우는 제목은 여섯 개다", () => {
    expect(headingsInOrder(miHtml)).toEqual([
      "Market Intelligence",
      "원본 상품",
      "ⓘ 글로벌 시장 가격",
      "수익성",
      "ⓘ 가격 계산 기준",
      "왜 이렇게 판단했나요?",
    ]);
  });

  /** 첫 번째 접힘 토글 앞에 서는 것 — 판정과 원본 가격뿐이다. */
  it("첫 접힘 토글 앞에 서는 것은 판정 · 원본 상품뿐이다", () => {
    const miHeadings = headingsInOrder(miHtml);
    expect(miHeadings.slice(0, miHeadings.indexOf("ⓘ 글로벌 시장 가격"))).toEqual([
      "Market Intelligence",
      "원본 상품",
    ]);
    expect(miText).toContain("🇰🇷 대한민국 시장 기준");
    expect(miText).toContain("🟡 조건부 판매");
    expect(miText).toContain("€50.00");
  });

  /**
   * ── 지시 ① ──────────────────────────────────────────────────────────────
   * ⓘ는 관측이 0건이어도 사라지지 않는다. 지난 시도에서 이 자리가 관측이 없을 때
   * 문장으로 바뀌면서 화면 높이를 늘렸다 — 바뀌는 것은 팝오버의 **내용**이지
   * 어포던스가 아니다.
   */
  it("관측이 0건이어도 ⓘ 글로벌 시장 가격이 그대로 선다", () => {
    expect(productionData().sellerGlobalMarkets).toEqual([]);
    expect(miText).toContain(`ⓘ ${GLOBAL_MARKET_HINT_LABEL}`);
    // 팝오버가 닫혀 있으므로 그 안의 문장은 본문에 없다(툴팁은 태그 속성이라
    // visibleText에 잡히지 않는다 — 화면 높이를 차지하지 않는다는 뜻이다).
    expect(miText).not.toContain(GLOBAL_MARKET_UNAVAILABLE_NOTE);
    // 관측이 있는 상품에서도 같은 어포던스 하나다(문장으로 바뀌지 않는다).
    const withObservations = regionsOf(render({ ...MARKET_STAGE, data: withDomesticComparable() })).mi;
    expect(visibleText(withObservations)).toContain(`ⓘ ${GLOBAL_MARKET_HINT_LABEL}`);
  });

  /**
   * ── 지시 ② ──────────────────────────────────────────────────────────────
   * 비교상품이 0건이면 블록이 "빈 카드"가 아니라 **없다**. 원본 판매자 한국
   * 표시가(①의 작은 줄)와는 끝까지 다른 자리다.
   */
  it("국내 비교상품이 0건이면 한국 시장 경쟁가격 블록이 DOM에 없다", () => {
    expect(headingsInOrder(miHtml)).not.toContain(PRICE_SECTION_TITLE.DOMESTIC_COMPETITION);
    expect(miText).not.toContain(PRICE_SECTION_TITLE.DOMESTIC_COMPETITION);
    expect(miText).not.toContain(PRICE_MEANING_LABEL.DOMESTIC_COMPARABLE_PRICE);
  });

  it("비교상품이 있으면 같은 블록이 그때만 선다", () => {
    const withDomestic = regionsOf(render({ ...MARKET_STAGE, data: withDomesticComparable() })).mi;
    expect(headingsInOrder(withDomestic)).toContain(PRICE_SECTION_TITLE.DOMESTIC_COMPETITION);
    expect(visibleText(withDomestic)).toContain("₩116,600");
  });

  /**
   * ── 지시 ③ ──────────────────────────────────────────────────────────────
   * 수익성은 요약 셋과 판정 한 줄이다. 계산 입력은 접힘 안에만 있다.
   */
  it("수익성은 판정 한 줄 + 숫자 셋이고 계산 입력은 본문에 없다", () => {
    expect(miText).toContain(PRICE_SECTION_TITLE.PROFITABILITY);
    expect(miText).toContain("동일상품 가격 비교 근거 부족");
    for (const [label, value] of [
      [PRICE_MEANING_LABEL.LANDED_COST, PROFIT.landedCostKrw],
      [PRICE_MEANING_LABEL.RECOMMENDED_PRICE, PROFIT.recommendedPriceKrw],
      [PRICE_MEANING_LABEL.EXPECTED_PROFIT, PROFIT.expectedProfitKrw],
    ] as const) {
      expect(miText, `${label}이(가) 없다`).toContain(label);
      expect(miText, `${label} 값이 상세 계산과 다르다`).toContain(`₩${value.toLocaleString("ko-KR")}`);
    }
    // 계산의 **입력**은 한 글자도 판단 카드에 없다 — 전부 [ⓘ 가격 계산 기준] 안이다.
    for (const banned of ["환율", "국제배송비", "예상 수수료", "목표 마진", "원본 가격", "국내 배송원가"]) {
      expect(miText, `${banned}이(가) 첫 화면에 있다`).not.toContain(banned);
    }
    // 확정 전이라 값이 없는 두 줄은 애초에 자리를 얻지 않는다.
    expect(miText).not.toContain(PRICE_MEANING_LABEL.SELLER_PLANNED_PRICE);
    expect(miText).not.toContain(PRICE_MEANING_LABEL.EXPECTED_MARGIN);
    // 관부가세는 엔진에서 빠졌다(8ac100d). 화면에도 되살아나지 않는다.
    expect(miText).not.toContain("관세");
    expect(miText).not.toContain("부가세");
  });

  /**
   * ── 지시 ④ ──────────────────────────────────────────────────────────────
   * 되물음은 접혀 있고, Radar는 그 안에서 한 단계 더 들어가야 나온다.
   */
  it("되물음은 접혀 있고 Radar·시장 신호·장문 설명이 첫 화면에 없다", () => {
    expect(miText).toContain("왜 이렇게 판단했나요?");
    expect(miHtml).not.toContain("<svg");
    for (const banned of [
      PRICE_SECTION_TITLE.DECISION_EVIDENCE,
      "판단 근거",
      "시장 신호",
      "가격·판매 전략 가이드",
      "종합 시장 상태",
      "동일상품 근거",
      "아직 확인되지 않은 비용",
      "상표권",
      "참고용 판단입니다",
      "분석 기준 시장",
      "다시 확인",
      "👉",
    ]) {
      expect(miText, `${banned}이(가) 첫 화면에 있다`).not.toContain(banned);
    }
    // 판정을 설명하는 긴 문장은 되물음 안쪽 한 단계 더 아래다.
    expect(miText).not.toContain(productionData().representativeVerdict.description);
  });

  it("되물음이 답하는 것은 네 줄이고, 접혀 있는 동안 화면에 없다", () => {
    const lines = buildMiVerdictExplanation({
      marketCase: "D",
      hasComparable: false,
      evidenceBasis: "NONE",
    });
    expect(lines).toHaveLength(4);
    for (const line of lines) expect(miText).not.toContain(line);
  });

  /**
   * ── 지시 ⑤(STOP) ───────────────────────────────────────────────────────
   * 국내 배송원가는 LANDED_COST_PARTS에 들어 있어 판정을 움직인다. 지우지도
   * 숨기지도 않는다 — 첫 화면에 없는 것은 **접혀 있기 때문**이지 사라져서가
   * 아니라는 사실은 product-tab-mounted.test.ts가 실제로 열어서 확인한다.
   */
  it("판단 카드는 상세 계산 슬롯을 여는 토글을 그대로 갖고 있다", () => {
    expect(miText).toContain("ⓘ 가격 계산 기준");
  });
});

/**
 * ── 어느 블록이 MI이고 어느 블록이 아닌가 ───────────────────────────────────
 * 이 구분이 지난 세 번의 실패에서 한 번도 측정되지 않은 것이다. 첫 화면이
 * 길다는 관찰은 MI가 길다는 뜻이 아닐 수 있다 — 아래 목록이 그 답이다.
 */
describe("첫 화면의 길이는 MI가 아니라 그 아래가 정한다", () => {
  it("② 시장 판단 단계에서 MI 아래에 펼쳐진 채로 서는 것은 가격비교 두 패널이다", () => {
    const { stage } = regionsOf(render(MARKET_STAGE));
    expect(headingsInOrder(stage)).toEqual([
      "지금 단계 · 2. 시장 판단",
      // 이 둘은 MI가 아니다 — 각자 자기 CollapsibleSection을 defaultOpen으로 연다.
      "🇰🇷 한국 시장 · 국내 비교상품 (베타)",
      "🌎 글로벌 시장 · 해외 판매처 가격 (베타)",
      "💰 판매가격 확정",
      "이미지",
      "Source Data",
      "Backlog",
    ]);
  });

  it("③ 등록 준비에서 MI를 펼쳐도 MI 자신의 제목 수는 변하지 않는다", () => {
    const { mi } = regionsOf(render(PREPARE_STAGE_MI_OPEN));
    expect(headingsInOrder(mi)).toEqual([
      "Market Intelligence",
      "원본 상품",
      "ⓘ 글로벌 시장 가격",
      "수익성",
      "ⓘ 가격 계산 기준",
      "왜 이렇게 판단했나요?",
    ]);
  });

  it("③ 등록 준비에서 MI가 접히면 제목 없는 한 줄 요약이다", () => {
    const { mi } = regionsOf(render());
    expect(headingsInOrder(mi)).toEqual([]);
    expect(visibleText(mi)).toContain("이 단계에서는 결론만 보여줍니다");
  });

  /**
   * 오른쪽 기둥은 판단 화면에서 **누를 수 있는 것 하나**만 갖는다(MI-POLISH-2).
   * 채널마다 카드가 하나씩 생기던 화면이 되살아나면 여기서 걸린다.
   */
  it("오른쪽 기둥은 판단 화면에서 카드 셋이고 채널 버튼을 반복하지 않는다", () => {
    const { aside } = regionsOf(render(MARKET_STAGE));
    expect(headingsInOrder(aside)).toEqual(["판매 판단", "등록 전 확인", "커머스 등록"]);
    const text = visibleText(aside);
    expect(text).toContain("스마트스토어 · 쿠팡 · 11번가 — 판단 뒤에 등록합니다.");
    expect(text).not.toContain("화면 열기");
    expect(text).not.toContain("준비중");
  });
});
