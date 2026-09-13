// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOMESTIC_MARKET_DRILL_DOWN, OVERSEAS_MARKET_DRILL_DOWN } from "../market-evidence";
import { MARKET_EVIDENCE_EMPTY } from "../market-evidence-frame";
import { resetMarketCollectionsForTests } from "../market-collection";
import { MI_VERDICT_EVIDENCE_TOGGLE_LABEL, buildMiVerdictExplanation } from "../mi-verdict-copy";
import {
  headingsInOrder,
  overseasResults,
  overseasResultsMixedTier,
  productTabElement,
  visibleLines,
  visibleText,
  TAB_LABEL,
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
  // MI-COLLECTION-GUARD-1 — "이 상품은 이미 수집했다"는 사실은 모듈 스코프에
  // 살아 있어서 테스트 사이에도 남는다. 각 시나리오가 **첫 진입**에서 시작하도록
  // 명시적으로 비운다(이걸 빠뜨리면 두 번째 테스트부터 0건이 되어 위장 성공한다).
  resetMarketCollectionsForTests();
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

/* ───────────────── MI-COLLECTION-GUARD-1 — 수집을 **세는** 도구 ───────────────── */

/**
 * 수집을 실제로 일으키는 엔드포인트. 표시용 GET이 아니라 판매자가 켜 둔
 * 편집샵을 **크롤링하는** 두 라우트다 — 한 번 더 불리면 한 번 더 뒤진다.
 */
const COLLECT_ENDPOINTS = ["/api/domestic-price-sources/search", "/api/comparison/search"] as const;
/** 수집은 아니지만 수집과 한 묶음으로 나가는 값이라 같이 센다(새는 곳이 없는지). */
const FX_ENDPOINT = "/api/exchange-rates";

type CallCounts = Record<string, number>;

/**
 * 엔드포인트별 호출 횟수를 세는 fetch.
 *
 * 코드를 읽어서 "가드가 있다"고 말하지 않는다는 것이 이 도구의 존재 이유다.
 * 지난 가드(autoSearchedRef)도 코드만 보면 완벽했다 — 틀린 것은 그 가드의
 * **수명**이었고, 수명은 호출 수로만 드러난다.
 */
function countingFetch(): CallCounts {
  const counts: CallCounts = {};
  vi.stubGlobal(
    "fetch",
    vi.fn((input: unknown) => {
      const url = String(input);
      const key = [...COLLECT_ENDPOINTS, FX_ENDPOINT].find((e) => url.includes(e)) ?? url;
      counts[key] = (counts[key] ?? 0) + 1;
      if (url.includes(FX_ENDPOINT)) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ rates: { EUR: 1556.56 }, source: "frankfurter" }) });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            results: overseasResults(),
            sourceVerification: { status: "NOT_APPLICABLE", price: null, regularPrice: null },
          }),
      });
    }),
  );
  return counts;
}

/** 두 수집 엔드포인트의 호출 수만 뽑는다 — 표를 그대로 읽는 모양이다. */
function collectCounts(counts: CallCounts): Record<string, number> {
  return {
    "POST /api/domestic-price-sources/search": counts["/api/domestic-price-sources/search"] ?? 0,
    "POST /api/comparison/search": counts["/api/comparison/search"] ?? 0,
  };
}

/** 화면 어디서든 그 글자가 적힌 버튼을 누른다(탭 버튼 · 접힘 토글 공용). */
function clickAnywhere(label: string): void {
  const page = container.firstElementChild;
  if (!(page instanceof HTMLElement)) throw new Error("화면이 비어 있다");
  clickIn(page, label);
}

/**
 * MI-COLLECTION-GUARD-1(CEO 지시, 2026-09-13) — **수집은 상품 하나에 한 번이다.**
 *
 * ── 왜 이 describe가 코드 검사가 아니라 호출 계수인가 ────────────────────
 * 재수집을 만든 것은 "가드가 없어서"가 아니었다. 가드는 있었고(autoSearchedRef)
 * 코드만 읽으면 옳았다. 틀린 것은 그 가드가 **컴포넌트 인스턴스와 함께 죽는다**는
 * 사실이고, 그건 소스를 몇 번 읽어도 보이지 않는다 — 마운트 경계를 실제로
 * 넘어 다니면서 요청을 세야만 드러난다.
 *
 * 그래서 여기서는 셀러가 하는 동작을 그대로 한다: 탭을 옮기고, 돌아오고,
 * 접고, 펴고, 뒤로 갔다 다시 들어온다. 그리고 매번 **엔드포인트별 호출 수**를
 * 본다. 기대값은 전부 "더 늘지 않았다"이다.
 */
describe("수집은 상품 하나에 한 번 — 화면 이동은 크롤링을 부르지 않는다", () => {
  it("최초 진입 1회 · 탭 왕복 0 · 접기/펼치기 0 · 재진입 0", async () => {
    const counts = countingFetch();

    // ① 상품 최초 진입 — 국내/해외 각 1회씩. 이게 "분석할 때의 1회"다.
    await mount();
    expect(collectCounts(counts)).toEqual({
      "POST /api/domestic-price-sources/search": 1,
      "POST /api/comparison/search": 1,
    });
    const afterEntry = { ...counts };

    // ② MI 안에서의 이동 — 되물음을 펴고 근거까지 한 단계 더 들어간다.
    click("왜 이렇게 판단했나요?");
    click(MI_VERDICT_EVIDENCE_TOGGLE_LABEL);
    click("ⓘ 가격 계산 기준");
    expect(counts).toEqual(afterEntry);

    // ③ 드릴다운 — MI 요약에서 아래 표를 여닫는다(접기/펼치기).
    click(`▸ ${DOMESTIC_MARKET_DRILL_DOWN}`);
    click(`▸ ${OVERSEAS_MARKET_DRILL_DOWN}`);
    expect(counts).toEqual(afterEntry);

    // ④ 다른 탭으로 — 단계 본문이 통째로 언마운트되는 그 경계다.
    await act(async () => clickAnywhere(TAB_LABEL.smartstore));
    expect(counts).toEqual(afterEntry);

    // ⑤ 상품정보로 재진입 — 두 패널이 새로 마운트된다. 예전에는 여기서 두 번
    //    더 크롤링이 나갔다.
    await act(async () => clickAnywhere(TAB_LABEL.source));
    expect(collectCounts(counts)).toEqual({
      "POST /api/domestic-price-sources/search": 1,
      "POST /api/comparison/search": 1,
    });

    // ⑥ 탭을 여러 번 왕복해도 같다 — 한 번의 예외가 아니라 성질이라는 뜻이다.
    for (let i = 0; i < 3; i += 1) {
      await act(async () => clickAnywhere(TAB_LABEL.smartstore));
      await act(async () => clickAnywhere(TAB_LABEL.source));
    }
    expect(counts).toEqual(afterEntry);
  });

  /**
   * 뒤로가기 후 재진입 — 트리를 통째로 버리고 새 root에 다시 그린다. 컴포넌트
   * 인스턴스는 하나도 살아남지 않는다. 그래도 0이어야 한다: "이 상품은 이미
   * 수집했다"는 사실의 수명은 컴포넌트가 아니라 **상품**이기 때문이다.
   */
  it("뒤로가기 후 재진입 — 트리가 통째로 새로 태어나도 0이다", async () => {
    const counts = countingFetch();
    await mount();
    const afterEntry = { ...counts };

    await act(async () => root.unmount());
    container.remove();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await mount();

    expect(counts).toEqual(afterEntry);
    // 돌아온 화면이 비어 있지도 않다 — 결과가 그 자리에 남아 있다. 예전에는
    // 언마운트가 results까지 지워서 "빈 표 → 재조회 → 다시 채워짐"을 반복했다.
    click(`▸ ${DOMESTIC_MARKET_DRILL_DOWN}`);
    expect(visibleText(stageElement().outerHTML)).toContain("🕒");
    expect(counts).toEqual(afterEntry);
  });

  /**
   * ③④의 「📊 시장 가격 비교」 접힘. 여기가 CollapsibleSection이 children을
   * 통째로 언마운트하는 자리라, 접었다 펴는 것만으로 두 패널이 다시 태어난다.
   */
  it("「📊 시장 가격 비교」를 접었다 펴도 추가 수집이 없다", async () => {
    const counts = countingFetch();
    // marketDone: true → ③ 등록 준비. 두 패널은 이 접힘 **안쪽**에 있다.
    await mount({ marketDone: true });
    // 접혀 있는 동안에는 패널이 마운트되지 않으므로 아직 0이다.
    expect(collectCounts(counts)).toEqual({
      "POST /api/domestic-price-sources/search": 0,
      "POST /api/comparison/search": 0,
    });

    await act(async () => clickAnywhere("📊 시장 가격 비교"));
    expect(collectCounts(counts)).toEqual({
      "POST /api/domestic-price-sources/search": 1,
      "POST /api/comparison/search": 1,
    });
    const afterOpen = { ...counts };

    for (let i = 0; i < 3; i += 1) {
      await act(async () => clickAnywhere("📊 시장 가격 비교")); // 접기
      await act(async () => clickAnywhere("📊 시장 가격 비교")); // 펼치기
    }
    expect(counts).toEqual(afterOpen);
  });

  /**
   * 다시 수집하는 길은 셀러가 직접 누르는 것뿐이다. 이 줄이 없으면 위 여섯
   * 개의 0은 "수집이 아예 안 된다"와 구분되지 않는다.
   */
  it("[가격비교 다시 검색]을 누르면 — 그때만 — 다시 나간다", async () => {
    const counts = countingFetch();
    await mount();
    expect(collectCounts(counts)["POST /api/comparison/search"]).toBe(1);

    // 버튼은 두 패널 **안**에 있으므로 먼저 연다(여는 것은 수집이 아니다).
    click(`▸ ${DOMESTIC_MARKET_DRILL_DOWN}`);
    click(`▸ ${OVERSEAS_MARKET_DRILL_DOWN}`);
    expect(collectCounts(counts)["POST /api/comparison/search"]).toBe(1);

    const buttons = Array.from(stageElement().querySelectorAll("button")).filter((b) =>
      (b.textContent ?? "").includes("가격비교 다시 검색"),
    );
    // 국내 · 해외 두 패널이 각자 자기 버튼을 갖는다.
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      await act(async () => {
        button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
    }
    expect(collectCounts(counts)).toEqual({
      "POST /api/domestic-price-sources/search": 2,
      "POST /api/comparison/search": 2,
    });
  });
});

/**
 * MI-UX-FINAL-4 지시 ② — 「📊 시장 가격 비교」에 들어가면 바로 내용이 보인다.
 */
describe("「📊 시장 가격 비교」는 두 번째 클릭을 요구하지 않는다", () => {
  it("펼치면 국내·해외가 둘 다 펼쳐진 채로 서고 안쪽 접힘이 없다", async () => {
    countingFetch();
    await mount({ marketDone: true });
    await act(async () => clickAnywhere("📊 시장 가격 비교"));

    // 「📊 시장 가격 비교」 섹션 **안쪽**만 본다 — 단계 본문의 다른 접힘
    // (판매가격 확정 · 이미지 · Source Data)이 섞이면 무엇을 센 것인지 알 수 없다.
    const section = Array.from(stageElement().querySelectorAll("section")).find((s) =>
      (s.textContent ?? "").includes("📊 시장 가격 비교"),
    );
    if (!section) throw new Error("「📊 시장 가격 비교」 섹션을 찾지 못했다");
    const text = visibleText(section.outerHTML);
    // 두 블록의 제목이 둘 다 있고 —
    expect(text).toContain("🇰🇷 한국 시장 · 국내 비교상품 (베타)");
    expect(text).toContain("🌎 글로벌 시장 · 해외 판매처 가격 (베타)");
    // 안쪽에 열고 닫을 것이 남아 있지 않다. 바깥 하나만 "접기 ▲"를 갖는다.
    expect((text.match(/펼치기 ▼/g) ?? []).length).toBe(0);
    expect((text.match(/접기 ▲/g) ?? []).length).toBe(1);
    // 그리고 내용이 실제로 그 자리에 있다(조회 결과 표).
    expect(section.querySelector("table")).not.toBeNull();
  });

  it("관측이 0건인 시장은 빈 상태 한 줄로 말한다 — 숫자를 지어내지 않는다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: unknown) =>
        String(input).includes("/api/exchange-rates")
          ? Promise.resolve({ ok: true, json: () => Promise.resolve({ rates: {}, source: "fallback" }) })
          : Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, results: [] }) }),
      ),
    );
    await mount({ marketDone: true });
    await act(async () => clickAnywhere("📊 시장 가격 비교"));
    const text = visibleText(stageElement().outerHTML);
    expect((text.match(new RegExp(MARKET_EVIDENCE_EMPTY, "g")) ?? []).length).toBe(2);
  });
});

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
   * MI-UX-FINAL-4(CEO 지시, 2026-09-13) — 되물음은 **GO/STOP 보조**다.
   *
   *   ┌──────────┬────────────────────────┐
   *   │  RADAR   │ 🟡 조건부 판매          │
   *   │          │ ⚪ 설정 마진을 …        │
   *   │          │ 🇰🇷 국내 동일상품 …      │
   *   │          │ 🌎 해외 판매처 …        │
   *   │          │ → 국내 동일상품을 …     │
   *   └──────────┴────────────────────────┘
   *   ▸ 판단 근거 자세히 보기
   *
   * 늘어난 줄을 **정확히** 세는 방식은 그대로다. 포함 검사로는 스무 덩어리가
   * 함께 딸려 나와도 통과하기 때문이고, 지난 시도들이 놓친 자리가 정확히
   * 이것이다. 바뀐 것은 기대 목록이다 — 레이더가 이 층으로 올라왔고, 수집을
   * 다시 돌리는 명시적 행동 하나가 함께 선다.
   *
   * 판정 한 줄(🟡 조건부 판매)이 이 목록에 없는 것은 빠져서가 아니라 **이미 화면
   * 위에 있어서**다(판정 카드의 헤드라인과 같은 글자라 "새로 생긴 줄"이 아니다).
   * 같은 사실이 두 번 세어지지 않는다는 뜻이고, 그게 이 측정 방식의 핵심이다.
   */
  it("「왜 이렇게 판단했나요?」가 더하는 것은 레이더 · 네 줄 · 토글 · 다시 분석뿐이다", async () => {
    await mount();
    /** 접힘의 caret(▸/▾)은 상태 표시라 내용 비교에서 뺀다. */
    const lines = (): string[] =>
      visibleLines(miElement().outerHTML).map((line) => line.replace(/[▸▾]/g, "").replace(/\s+/g, " ").trim());

    const before = lines();
    click("왜 이렇게 판단했나요?");
    const after = lines();

    const added = after.filter((line) => !before.includes(line));
    const explanation = buildMiVerdictExplanation({
      marketCase: "D",
      hasComparable: false,
      evidenceBasis: "NONE",
      hasOverseasRange: false,
    });
    expect(explanation).toHaveLength(4);
    // 레이더 그림의 축 라벨 넷 → 네 줄 → 토글 → 다시 분석. 그 밖에는 없다.
    expect(added).toEqual([
      "⚪ 수익성",
      "⚪ 국내 가격 경쟁력",
      "⚪ 시장 수요",
      "상품 판단 신뢰도",
      ...explanation,
      MI_VERDICT_EVIDENCE_TOGGLE_LABEL,
      "🔄 다시 분석",
    ]);

    // 레이더는 **그림**으로만 온다 — 별점 목록이 그 아래 한 벌 더 붙지 않는다.
    expect(miElement().querySelector("svg")).not.toBeNull();
    expect(miText()).not.toContain("★");
    // 계산 사슬은 이 토글과 무관하다(다른 접힘이다).
    expect(miText()).not.toContain("국제배송비");
  });

  /**
   * 한 단계 더 들어가면 네 축의 **낱말**이 나온다 — CEO가 지정한 이름과 순서로
   * 정확히 넷이다. 다섯 번째 줄이 서려 하면 여기서 먼저 걸린다.
   */
  it("「판단 근거 자세히 보기」가 더하는 것은 네 축 한 줄씩뿐이다", async () => {
    await mount();
    click("왜 이렇게 판단했나요?");
    const lines = (): string[] =>
      visibleLines(miElement().outerHTML).map((line) => line.replace(/[▸▾]/g, "").replace(/\s+/g, " ").trim());
    const before = lines();
    click(MI_VERDICT_EVIDENCE_TOGGLE_LABEL);
    const added = lines().filter((line) => !before.includes(line));

    // 왼쪽 이름 넷. 오른쪽 값은 축 상태(등급어 또는 빈 상태 칩)이고, 그 값은
    // 레이더가 그린 것과 같은 축에서 온다 — 여기서 다시 판정하지 않는다.
    expect(added.filter((line) => line.startsWith("💰") || line.startsWith("🇰🇷") || line.startsWith("🔎") || line.startsWith("📊"))).toEqual([
      "💰 수익성",
      "🇰🇷 가격 경쟁력",
      "🔎 상품 동일성",
      "📊 시장 신호",
    ]);
    // 금지 목록 — 되물음이 다시 두 번째 화면이 되는 경로들.
    const text = miText();
    for (const banned of ["📶 시장 신호", "가격·판매 전략 가이드", "종합 시장 상태", "상표권", "참고용 판단입니다", "동일상품 근거"]) {
      expect(text, `${banned}이(가) 되물음에 다시 들어왔다`).not.toContain(banned);
    }
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
    ]) {
      expect(text, `${row}이(가) 상세 계산에 없다`).toContain(row);
    }
    // 관부가세는 엔진에서 빠졌다(8ac100d) — 펼쳐도 돌아오지 않는다.
    expect(text).not.toContain("관세");
    expect(text).not.toContain("부가세");
    // MI-UX-FINAL-4(대표님 결정, 2026-09-13) — 국내 배송원가도 같은 순서로
    // 빠졌다(엔진 먼저, 그 다음 화면). 펼쳐도 돌아오지 않는다.
    expect(text).not.toContain("국내 배송원가");
    expect(text).not.toContain("판매자 부담 비용");
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
