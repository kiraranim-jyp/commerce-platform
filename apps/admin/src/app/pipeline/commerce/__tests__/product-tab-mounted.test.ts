// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOMESTIC_MARKET_DRILL_DOWN, OVERSEAS_MARKET_DRILL_DOWN } from "../market-evidence";
import { MI_VERDICT_EVIDENCE_TOGGLE_LABEL, buildMiVerdictExplanation } from "../mi-verdict-copy";
import {
  headingsInOrder,
  overseasResults,
  overseasResultsMixedTier,
  productTabElement,
  visibleLines,
  visibleText,
  type OverseasSearchResult,
  type TabOptions,
} from "./product-tab-composition";

/**
 * MI-MARKET-EVIDENCE-1(CEO 지시, 2026-09-12) — **마운트 이후**의 첫 화면.
 *
 * ── 왜 서버 렌더만으로는 부족한가 ────────────────────────────────────────
 * `renderToStaticMarkup`은 effect를 돌리지 않고 storage도 읽지 않는다. 그래서
 * "서버 렌더에서는 접혀 있었다"는 문장은 프로덕션에서 펼쳐져 있던 화면을
 * 반증하지 못한다. 이 파일이 그 구멍을 막는다:
 *
 *   ① 실제 DOM에 마운트하고 effect까지 flush한 뒤의 화면을 본다.
 *   ② 그 화면이 서버 렌더와 **같은 글자**임을 확인한다.
 *   ③ 접힘은 **클릭해야만** 열린다는 것을, 실제로 눌러서 확인한다.
 *
 * ── 이번 지시로 늘어난 것 ────────────────────────────────────────────────
 * 🌎 해외 시장 요약은 서버 응답이 아니라 **아래 가격비교 패널의 조회 결과**에서
 * 온다. 그 경로는 effect 없이는 존재하지 않으므로, 여기서만 증명할 수 있다:
 * 조회가 돌면 요약이 채워지고, [▸ 해외 가격 보기]를 누르면 그 요약이 세던 바로
 * 그 행들이 등급을 달고 나온다(요약과 원자료가 같은 집합이라는 뜻이다).
 */

const MARKET_STAGE: TabOptions = { marketDone: false };

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // @ts-expect-error — React가 act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // 기본은 네트워크 차단이다. 화면을 바꾸는 것이 아니라 막아 두는 것이다
  // (실패해도 패널은 그대로 서고, 요약은 빈 상태가 된다).
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("network disabled in test"))),
  );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

/**
 * 해외 가격비교 조회에만 답하는 fetch. 응답 모양은 라우트가 실제로 돌려주는
 * 그것이다(`{ ok, results, sourceVerification }`) — 손으로 다른 모양을 만들면
 * 화면이 그 응답을 어떻게 다루는지 검사하는 의미가 사라진다.
 */
function stubOverseasSearch(results: OverseasSearchResult[]): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: unknown) => {
      const url = String(input);
      if (url.includes("/api/comparison/search")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              results,
              sourceVerification: { status: "NOT_APPLICABLE", price: null, regularPrice: null },
            }),
        });
      }
      return Promise.reject(new Error("network disabled in test"));
    }),
  );
}

/**
 * 마운트하고 **effect와 그 effect가 띄운 promise까지** 전부 flush한다.
 * 단계 본문의 가격비교 패널들은 마운트되자마자 조회를 걸어 그 결과로 state를
 * 바꾸므로, act 밖에서 끝나면 "첫 화면"이 언제 찍힌 것인지 알 수 없어진다.
 */
async function mount(options: TabOptions = MARKET_STAGE): Promise<void> {
  await act(async () => {
    root.render(productTabElement(options));
  });
}

/** 판단 카드 하나. 렌더 트리의 첫 번째 노드가 MI다(productTabElement 참고). */
function miElement(): HTMLElement {
  const page = container.firstElementChild;
  const mi = page?.children[0];
  if (!(mi instanceof HTMLElement)) throw new Error("MI 카드를 찾지 못했다");
  return mi;
}

/** 단계 본문(가격비교 두 패널이 사는 곳). 요약과 원자료를 갈라서 보기 위한 구분이다. */
function stageElement(): HTMLElement {
  const stage = container.firstElementChild?.children[1];
  if (!(stage instanceof HTMLElement)) throw new Error("단계 본문을 찾지 못했다");
  return stage;
}

function miText(): string {
  return visibleText(miElement().outerHTML);
}

/** 화면에서 그 글자가 적힌 버튼을 눌러본다 — 셀러가 하는 일 그대로다. */
function clickIn(scope: HTMLElement, label: string): void {
  const button = Array.from(scope.querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").includes(label),
  );
  if (!button) throw new Error(`"${label}" 버튼이 화면에 없다`);
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function click(label: string): void {
  clickIn(miElement(), label);
}

describe("마운트하고 effect가 전부 돈 뒤의 첫 화면", () => {
  it("서버 렌더와 같은 글자다 — 마운트 이후에 뒤집히는 접힘이 없다", async () => {
    await mount();
    const ssr = renderToStaticMarkup(productTabElement(MARKET_STAGE));
    const ssrMi = (() => {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = ssr;
      const page = wrapper.firstElementChild;
      return visibleText((page?.children[0] as HTMLElement).outerHTML);
    })();
    expect(miText()).toBe(ssrMi);
  });

  it("두 접힘은 닫힌 채로 있고 Radar도 계산 사슬도 그려지지 않는다", async () => {
    await mount();
    expect(headingsInOrder(miElement().outerHTML)).toEqual([
      "Market Intelligence",
      "원본 상품",
      "ⓘ 글로벌 시장 가격",
      "🇰🇷 국내 시장",
      "🌎 해외 시장",
      "수익성",
      "ⓘ 가격 계산 기준",
      "왜 이렇게 판단했나요?",
    ]);
    expect(miElement().querySelector("svg")).toBeNull();
    for (const banned of ["환율", "국제배송비", "예상 수수료", "목표 마진", "국내 배송원가", "시장 신호"]) {
      expect(miText(), `${banned}이(가) 첫 화면에 있다`).not.toContain(banned);
    }
  });

  /**
   * 지시 ④ — 되물음이 답하는 것은 네 줄이고, 레이더는 그 안에서 한 번 더
   * 물었을 때만 나온다.
   */
  it("「왜 이렇게 판단했나요?」가 더하는 것은 네 줄과 토글 하나뿐이다", async () => {
    await mount();
    /** 접힘의 caret(▸/▾)은 상태 표시라 내용 비교에서 뺀다. */
    const lines = (): string[] =>
      visibleLines(miElement().outerHTML).map((line) => line.replace(/[▸▾]/g, "").replace(/\s+/g, " ").trim());

    const before = lines();
    click("왜 이렇게 판단했나요?");
    const after = lines();

    // 누른 뒤에 **새로 생긴 글자**만 고른다. "네 줄"이라는 약속은 늘어난 줄이
    // 정확히 몇 줄인가로만 증명된다 — 포함 검사로는 스무 덩어리가 함께
    // 딸려 나와도 통과한다(지난 시도들이 놓친 자리가 정확히 이것이다).
    const added = after.filter((line) => !before.includes(line));
    const explanation = buildMiVerdictExplanation({
      marketCase: "D",
      hasComparable: false,
      evidenceBasis: "NONE",
      hasOverseasRange: false,
    });
    expect(explanation).toHaveLength(4);
    expect(added).toEqual([...explanation, MI_VERDICT_EVIDENCE_TOGGLE_LABEL]);

    // 레이더는 한 층 더 아래다 — 여기서 펼쳐지면 되물음이 두 번째 화면이 된다.
    expect(miElement().querySelector("svg")).toBeNull();
    // 계산 사슬은 이 토글과 무관하다(다른 접힘이다).
    expect(miText()).not.toContain("국제배송비");
  });

  it("한 번 더 눌러야 Radar와 나머지 근거가 나온다 — 지운 것은 하나도 없다", async () => {
    await mount();
    click("왜 이렇게 판단했나요?");
    click(MI_VERDICT_EVIDENCE_TOGGLE_LABEL);
    expect(miElement().querySelector("svg")).not.toBeNull();
  });

  /**
   * 지시 ⑤(STOP) — sellerDomesticShippingCostKrw는 LANDED_COST_PARTS에 들어
   * 있어 판정을 움직인다. 첫 화면에 없는 이유는 **접혀 있어서**이지 지워져서가
   * 아니고, 그 사실은 실제로 열어봐야만 증명된다.
   */
  it("「ⓘ 가격 계산 기준」을 누르면 계산 사슬 전체가 그 자리에서 나온다", async () => {
    await mount();
    click("ⓘ 가격 계산 기준");
    const text = miText();
    for (const row of [
      "원본 가격",
      "환율",
      "원화 환산",
      "국제배송비",
      "착지원가",
      "예상 수수료",
      "목표 마진",
      "권장 판매가",
      "예상 이익",
      // STOP — 판매자 국내 배송원가. 지우지도 숨기지도 않는다.
      "국내 배송원가",
    ]) {
      expect(text, `${row}이(가) 상세 계산에 없다`).toContain(row);
    }
    // 관부가세는 엔진에서 빠졌다(8ac100d) — 펼쳐도 돌아오지 않는다.
    expect(text).not.toContain("관세");
    expect(text).not.toContain("부가세");
  });

  it("상세 계산을 열어도 열리는 곳은 한 군데다 — 사슬이 두 벌 생기지 않는다", async () => {
    await mount();
    click("ⓘ 가격 계산 기준");
    const occurrences = miText().split("국제배송비").length - 1;
    expect(occurrences).toBe(1);
  });
});

/**
 * MI-MARKET-EVIDENCE-1 — 🌎 해외 시장 요약은 **아래 패널의 조회 결과**다.
 *
 * 이 경로는 effect가 돌아야만 존재한다. 여기서 증명하는 것은 셋이다:
 *   ① 조회가 돌면 요약이 채워진다(숫자도 개수도 등급도).
 *   ② 그 값은 아래 표가 세는 것과 같은 집합이다.
 *   ③ 원자료는 누르기 전에는 화면에 없다.
 */
describe("해외 시장 요약은 아래 가격비교 패널의 조회 결과에서 온다", () => {
  it("조회가 돌면 요약이 가격대 · 판매처 수 · 등급을 갖는다", async () => {
    stubOverseasSearch(overseasResults());
    await mount();
    const text = miText();
    // 평균이 아니라 **관측된 양끝** 두 개다(그 사이 숫자는 만들지 않는다).
    expect(text).toContain("€45.00 ~ €52.00");
    expect(text).toContain("판매처 3곳 · 3개 국가");
    expect(text).toContain("🟢 동일상품 기준");
  });

  it("등급이 섞이면 요약이 강한 등급 하나를 주장하지 않는다", async () => {
    stubOverseasSearch(overseasResultsMixedTier());
    await mount();
    const text = miText();
    expect(text).toContain("🟢 동일상품 1 · 🟡 동일상품 추정 2");
    expect(text).not.toContain("🟢 동일상품 기준");
    expect(text).toContain("등급이 섞여 있습니다");
  });

  /**
   * 드릴다운 — 누르기 전에는 원자료가 화면에 없고, 누르면 그 자리에서 나온다.
   * 그리고 나온 행은 **행마다 매칭 상태를 달고 있다**: 개수만 보여주고 근거를
   * 숨기는 것이 이 작업이 없애려는 신뢰 실패이기 때문이다.
   */
  it("[▸ 해외 가격 보기]를 눌러야 판매처 · 국가 · 상품 · 가격 · 매칭상태가 나온다", async () => {
    stubOverseasSearch(overseasResults());
    await mount();
    // 누르기 전 — 원자료 표가 한 개도 없다(같은 사실이 두 곳에 서지 않는다).
    // 접힘 요약 한 줄이 열 이름과 같은 낱말을 쓰므로 표 자체를 센다.
    expect(stageElement().querySelector("table")).toBeNull();

    click(`▸ ${OVERSEAS_MARKET_DRILL_DOWN}`);
    const table = stageElement().querySelector("table");
    expect(table, "드릴다운을 눌렀는데 표가 없다").not.toBeNull();
    const headers = Array.from(table!.querySelectorAll("th")).map((th) => th.textContent?.trim());
    expect(headers).toEqual(["판매처", "판매처 국가", "상품", "원본 통화 가격 · 원화 환산", "매칭상태"]);
    const stage = visibleText(stageElement().outerHTML);
    // 행마다 판매처·국가·가격이 실제로 있다(요약이 센 그 세 곳 그대로다).
    for (const cell of ["Smallable", "Childrensalon", "Kidsroom", "FR", "GB", "DE", "€45.00", "€52.00"]) {
      expect(stage, `${cell}이(가) 원자료에 없다`).toContain(cell);
    }
    // 그리고 행마다 매칭 등급 배지가 붙는다 — 개수의 근거가 행 단위로 보인다.
    expect((stage.match(/🟢 동일상품/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("등급이 섞인 조회에서는 드릴다운 행이 서로 다른 등급을 그대로 보여준다", async () => {
    stubOverseasSearch(overseasResultsMixedTier());
    await mount();
    click(`▸ ${OVERSEAS_MARKET_DRILL_DOWN}`);
    const stage = visibleText(stageElement().outerHTML);
    expect(stage).toContain("🟢 동일상품");
    expect(stage).toContain("🟡 동일상품 추정");
  });

  it("[▸ 국내 가격 보기]는 국내 표만 연다 — 해외 표는 그대로 접혀 있다", async () => {
    stubOverseasSearch(overseasResults());
    await mount();
    click(`▸ ${DOMESTIC_MARKET_DRILL_DOWN}`);
    const stage = visibleText(stageElement().outerHTML);
    // 국내 표는 조회가 막혀 있어 행이 없지만, 열린 것은 국내 쪽이다.
    expect(stage).toContain("검색 대상은 설정 > 국내 가격비교에서 관리합니다.");
    // 해외 원자료는 여전히 접혀 있다 — 한 번에 하나만 열린다.
    expect(stageElement().querySelector("table")).toBeNull();
  });
});
