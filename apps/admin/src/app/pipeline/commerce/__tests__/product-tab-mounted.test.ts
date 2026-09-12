// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MI_VERDICT_EVIDENCE_TOGGLE_LABEL, buildMiVerdictExplanation } from "../mi-verdict-copy";
import {
  headingsInOrder,
  productTabElement,
  visibleLines,
  visibleText,
  type TabOptions,
} from "./product-tab-composition";

/**
 * MI-FINAL-UX-3 REWORK(CEO 지시, 2026-09-12) — **마운트 이후**의 첫 화면.
 *
 * ── 왜 서버 렌더만으로는 부족한가 ────────────────────────────────────────
 * `renderToStaticMarkup`은 effect를 돌리지 않고 storage도 읽지 않는다. 그래서
 * "서버 렌더에서는 접혀 있었다"는 문장은 프로덕션에서 펼쳐져 있던 화면을
 * 반증하지 못한다 — 접힘을 여는 경로가 마운트 이후에 있다면 서버 렌더는 그
 * 경로를 볼 수 없기 때문이다. 이 파일이 그 구멍을 막는다:
 *
 *   ① 실제 DOM에 마운트하고 effect까지 flush한 뒤의 화면을 본다.
 *   ② 그 화면이 서버 렌더와 **같은 글자**임을 확인한다(마운트 후 뒤집히는
 *      상태가 없다는 뜻이다 — 있으면 두 문자열이 갈라진다).
 *   ③ 접힘은 **클릭해야만** 열린다는 것을, 실제로 눌러서 확인한다.
 *
 * 접힘 안의 내용이 지워진 것이 아니라 한 층 내려간 것뿐이라는 사실도 여기서만
 * 증명할 수 있다 — 눌렀을 때 실제로 나와야 하기 때문이다(특히 국내 배송원가:
 * MI-COST-POLICY STOP 대상이라 숨기는 것 자체가 금지다).
 */

const MARKET_STAGE: TabOptions = { marketDone: false };

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // @ts-expect-error — React가 act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // 단계 본문의 가격비교 패널들은 마운트되자마자 조회를 건다. 네트워크를
  // 막아 두는 것이지 화면을 바꾸는 것이 아니다(실패해도 패널은 그대로 선다).
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

function miText(): string {
  return visibleText(miElement().outerHTML);
}

/** 화면에서 그 글자가 적힌 버튼을 눌러본다 — 셀러가 하는 일 그대로다. */
function click(label: string): void {
  const button = Array.from(miElement().querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").includes(label),
  );
  if (!button) throw new Error(`"${label}" 버튼이 화면에 없다`);
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
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
