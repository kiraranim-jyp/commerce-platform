// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOMESTIC_MARKET_DRILL_DOWN, OVERSEAS_MARKET_DRILL_DOWN } from "../market-evidence";
import { MARKET_EVIDENCE_EMPTY } from "../market-evidence-frame";
import { resetMarketCollectionsForTests } from "../market-collection";
import { MI_VERDICT_EVIDENCE_TOGGLE_LABEL, buildMiVerdictExplanation } from "../mi-verdict-copy";
/** 🟢 WU-024 — 화면 문구를 **소유자에서 읽는다**(테스트가 문구를 다시 적지 않는다). */
import { SUPPLIED_URL_INPUT_NOTICE, SUPPLIED_URL_INPUT_SUMMARY } from "../GeminiTransientCandidates";
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
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴🔴 WU-141-R3 — **원자료를 여는 길이 바뀌었다**(MI 드릴다운 → 패널 자신의 헤더)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 전에는 MI 카드 안의 `▸ 국내/해외 가격 보기`가 아래 패널을 열었다
 *    (`onOpenDomesticEvidence` → `openMarketEvidence` → `scrollIntoView`).
 *    R3 가 시장 두 블록을 결론 영역으로 올리면서 **그 버튼이 카드에서 사라졌다.**
 * 🟢 **원자료가 닫힌 것이 아니다** — 두 패널은 `MarketEvidenceFrame` 의
 *    `CollapsibleSection` 이고 **자기 제목이 곧 토글 버튼** 이다. 셀러는 그 제목을
 *    눌러 그대로 연다. 그래서 이 파일의 핵심 계약(「수집은 상품 하나에 한 번」 ·
 *    「원자료는 누르기 전에 화면에 없다」)은 **입력 경로만 바꿔 그대로 유지** 한다.
 * 🔴 제목 문자열은 그 두 컴포넌트의 `title` prop 그대로다
 *    (`DomesticShopSearch.tsx` · `ComparisonShopSearch.tsx`).
 * 🟡 **보고 대상** — `openMarketEvidence`(+`PRICE_COMPARISON_ANCHOR_ID` 스크롤)는
 *    이제 **호출자가 없다.** 지우지 않았다(앵커 보존 계약) · CPO 판정 사안이다.
 */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 **WU-149 STEP 1 — 그 두 패널이 셀러 화면에서 «사라졌다»**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 위 주석(WU-141-R3)은 「원자료를 여는 길이 **패널 자신의 헤더** 로 바뀌었다」
 *    까지였다. 🔴 그런데 **열 수 있다는 것 자체가 문제** 였다 — 셀러는 결론을 읽고도
 *    그 표를 열어 후보를 하나씩 다시 판단했다(CPO 가 지목한 「후보 조사 화면」).
 * 🟢 WU-149 는 그 두 표를 **셀러 화면에서 제거** 했다. 그래서 이 파일의 두 상수와
 *    여는 함수도 **같이 지웠다** — 남겨 두면 다음 사람이 그 표를 되살린다.
 * 🔴 아래 계약들은 그만큼 **더 세졌다**: 전에는 「수집이 한 번」이었고 이제는
 *    **「셀러 화면이 그 두 검색을 한 번도 부르지 않는다」**(0) 다.
 * 🟢 **엔진은 그대로다** — 두 컴포넌트 파일과 backend API 둘은 살아 있고
 *    (`wu-132 C-3c` 가 삭제를 FAIL 로 잠근다) 서버는 `/check` 에서 같은 수집을 돈다.
 */
const DOMESTIC_RAW_PANEL = "🇰🇷 한국 시장 · 국내 비교상품 (베타)";
const OVERSEAS_RAW_PANEL = "🌎 글로벌 시장 · 해외 판매처 가격 (베타)";

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
describe("🔴🔴 WU-149 — 셀러 화면은 후보 검색을 **한 번도** 부르지 않는다", () => {
  /**
   * 🔴 전 계약은 「최초 진입 1회 · 탭 왕복 0 · 재진입 0」이었다. 그 **1회** 는
   *    제거된 두 패널이 `useCollectOnce` 로 돌린 **클라이언트 자기 검색** 이었다.
   * 🟢 이제 그 1회도 **0** 이다 — 더 센 단언이다(0 은 1 보다 세다).
   * 🔴🔴 **이것이 「셀러가 데이터를 잃었다」는 뜻이 아니다**: 같은 수집을 서버가
   *    `/check` 에서 돌리고(WU-130 해외 자동풀 · 국내 등록부) 그 결과가 MI →
   *    「📊 시장 판매 판단」으로 온다. 🟢 WU-130 이 「지금 해외 검색이 **두 번**
   *    돈다」고 적어 둔 그 중복이 이 제거로 **하나가 됐다.**
   */
  it("🔴 진입 · MI 이동 · 탭 왕복 · 재진입 — 두 검색 API 호출이 전부 **0** 이다", async () => {
    const counts = countingFetch();

    // ① 상품 최초 진입 — 전에는 여기서 국내/해외 각 1회가 나갔다.
    await mount();
    expect(collectCounts(counts)).toEqual({
      "POST /api/domestic-price-sources/search": 0,
      "POST /api/comparison/search": 0,
    });
    const afterEntry = { ...counts };

    // ② MI 안에서의 이동 — 되물음을 펴고 근거까지 한 단계 더 들어간다.
    click("왜 이렇게 판단했나요?");
    click(MI_VERDICT_EVIDENCE_TOGGLE_LABEL);
    click("ⓘ 가격 계산 기준");
    expect(counts).toEqual(afterEntry);

    // ③ 다른 탭으로 — 단계 본문이 통째로 언마운트되는 그 경계다.
    await act(async () => clickAnywhere(TAB_LABEL.smartstore));
    expect(counts).toEqual(afterEntry);

    // ④ 상품정보로 재진입 — 마운트 경계를 넘어도 그대로 0 이다.
    await act(async () => clickAnywhere(TAB_LABEL.source));
    expect(collectCounts(counts)).toEqual({
      "POST /api/domestic-price-sources/search": 0,
      "POST /api/comparison/search": 0,
    });

    // ⑤ 탭을 여러 번 왕복해도 같다 — 한 번의 예외가 아니라 성질이라는 뜻이다.
    for (let i = 0; i < 3; i += 1) {
      await act(async () => clickAnywhere(TAB_LABEL.smartstore));
      await act(async () => clickAnywhere(TAB_LABEL.source));
    }
    expect(counts).toEqual(afterEntry);
  });

  it("🔴 뒤로가기 후 재진입 — 트리가 통째로 새로 태어나도 0이다", async () => {
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
    expect(collectCounts(counts)["POST /api/comparison/search"]).toBe(0);
  });

  /**
   * 🔴🔴 **제거의 «범위» 를 단언한다** — 두 표와 그 재검색 버튼이 셀러 화면의
   *    어디에도 없다. 🔴 ③④ 단계(등록 준비/커머스 등록)까지 본다: 전에는 그 둘이
   *    「📊 시장 가격 비교」 접힘 **안쪽** 에 있어 거기서만 열렸다.
   */
  it("🔴🔴 두 후보 표 · 「📊 시장 가격 비교」 접힘 · [가격비교 다시 검색] 이 **없다**", async () => {
    countingFetch();
    for (const options of [{}, { marketDone: true }]) {
      await mount(options);
      const text = visibleText(container.innerHTML);
      expect(text, "🔴 국내 후보 표가 되살아났다").not.toContain(DOMESTIC_RAW_PANEL);
      expect(text, "🔴 해외 후보 표가 되살아났다").not.toContain(OVERSEAS_RAW_PANEL);
      expect(text, "🔴 중복 가격 영역이 되살아났다").not.toContain("📊 시장 가격 비교");
      expect(text, "🔴 셀러에게 재검색 버튼이 되살아났다").not.toContain("가격비교 다시 검색");
      /** 🔴 표 자체도 없다 — 제목만 지우고 표를 남기는 길을 막는다. */
      expect(stageElement().querySelector("table"), "🔴 후보 표가 남아 있다").toBeNull();
    }
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
    /**
     * 🔴 WU-141-R3 — 「🇰🇷 국내 시장」·「🌎 해외 시장」은 **결론 영역으로 올라갔다**
     *    (`MarketPriceComparison` · 격자 밖 최상단). 🟢 이 테스트의 성질
     *    (「마운트 뒤에도 접힘이 닫힌 채고 SVG·계산 사슬이 없다」)은 **그대로** 다.
     */
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
    /**
     * 레이더 축 라벨 넷 → 네 줄 → 토글 → **URL 입력 두 줄** → 다시 분석. 그 밖에는 없다.
     *
     * 🔴🔴 WU-024 — 줄 둘이 **의도적으로** 늘었다. 「🔄 다시 분석」 바로 위에 Registry
     *    밖 후보 URL 을 넣는 칸이 생겼다(병목 A 의 생산자). 🔴 자리를 여기로 둔 이유:
     *    그 칸이 바꾸는 것이 **바로 이 버튼의 동작** 이고, 패널 상단에 두면 접힘 밖
     *    기본 화면이 길어진다 — 이 파일이 지키려는 바로 그 성질을 깨뜨린다.
     * 🟢 **판정 문구는 한 줄도 늘지 않았다** — 늘어난 둘은 라벨과 안내문이다.
     */
    expect(added).toEqual([
      "⚪ 수익성",
      "⚪ 국내 가격 경쟁력",
      "⚪ 시장 수요",
      "상품 판단 신뢰도",
      ...explanation,
      MI_VERDICT_EVIDENCE_TOGGLE_LABEL,
      /**
       * 🔴🔴 WU-091 §5(CPO 지시 2026-10-19) — 라벨이 바뀌었다.
       *    「🔗 비교할 판매처 상품 URL (선택)」을 **보조 기능** 으로 내리고
       *    접힌 구역의 제목으로 바꿨다. CEO 육안 테스트에서 그 칸이 **주된 후보
       *    탐색 방법처럼** 보였고 **같은 원상품 URL 을 다시 넣어야 하는 것처럼** 읽혔다.
       *
       * 🔴🔴🔴 **WU-130 ③(CPO 확정 2026-10-20) — 그 두 줄이 «사라졌다».**
       *    국내(`searchDomesticShops`)와 해외(`collectOverseasAutoPool`)가 **둘 다
       *    자동으로** 돌게 됐으므로, 셀러가 판매처를 찾아 붙여넣는 칸은 제품 경로에
       *    있을 이유가 없다(제품 한 문장: 「URL 하나 넣으면 **우리가** 찾아준다」).
       * 🟢 **기능을 지운 것이 아니다** — 파서·풀·API 경계·배선은 그대로이고
       *    `NEXT_PUBLIC_MI_SUPPLIED_URL_INPUT=true` 면 그대로 돌아온다(그 성질은
       *    `wu-049r-url-input-reachability` 가 **켠 상태로** 증명한다).
       * 🟢 이 계약의 «성질» 은 그대로다 — 「이 화면이 더하는 것은 이 목록뿐이다」.
       */
      "🔄 다시 분석",
    ]);
    /** 🔴 **강화** — 기본 화면에 그 두 문구가 **없어야** 한다(숨김을 직접 단언한다). */
    expect(after.join(" ")).not.toContain(SUPPLIED_URL_INPUT_SUMMARY);
    expect(after.join(" ")).not.toContain(SUPPLIED_URL_INPUT_NOTICE);

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
describe("해외 조회 결과는 원자료에만 서고 판정 카드로 올라오지 않는다", () => {
  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴🔴 WU-141-R3 — **이 구역의 전제였던 「③ → MI 요약」 경로가 제거됐다**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 전에는 이 패널의 **자기 조회 결과** 가 `onEvidenceChange` 로 위로 올라가
   *    MI 카드의 🌎 요약(가격대 · 판매처 수 · 등급)을 만들었다. 그 경로가
   *    **두 번째 가격 owner** 였다 — `/check` 의 MI verdict 를 **한 번도 보지 않고**
   *    (`mayShowCandidate` 로 자기 기준으로 거른다) 숫자를 만들어 판정 옆에 세웠다.
   *    ⟹ 「📊 시장 판매 판단」(MI 기준)과 **다른 수를 말할 수 있었다.**
   * 🟢 R3 가 그 발행을 끊었다(C-5). 이제 이 패널은 전략 Gate 기준 **검색 UI** 이고,
   *    결과는 **원자료 표** 로만 선다.
   *
   * 🔴🔴 그래서 이 구역의 명제가 **뒤집힌다** — 「조회가 돌면 요약이 채워진다」가
   *    **「조회가 돌아도 판정 카드로 올라오지 않는다」** 가 된다.
   * 🟢 **잃지 않은 것** — ⒜ 표는 그대로 있고 ⒝ 누르기 전에는 화면에 없고
   *    ⒞ 행마다 등급이 붙는다. 그 셋은 아래 테스트가 계속 본다.
   */
  it("조회가 돌아도 판정 카드에 가격대·판매처 수·등급이 서지 않는다", async () => {
    stubOverseasSearch(overseasResults());
    await mount();
    const text = miText();
    expect(text).not.toContain("€45.00 ~ €52.00");
    expect(text).not.toContain("판매처 3곳 · 3개 국가");
    expect(text).not.toContain("🟢 동일상품 기준");
  });

  it("등급이 섞인 조회도 판정 카드에 분포를 적지 않는다", async () => {
    stubOverseasSearch(overseasResultsMixedTier());
    await mount();
    const text = miText();
    expect(text).not.toContain("🟢 동일상품 1 · 🟡 동일상품 추정 2");
    expect(text).not.toContain("🟢 동일상품 기준");
    expect(text).not.toContain("등급이 섞여 있습니다");
  });

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴🔴 **WU-149 — 「누르면 나온다」가 「누를 것이 없다」로 뒤집혔다**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 전 세 테스트는 드릴다운을 **열어서** ⒜ 표의 열 이름 ⒝ 행마다 등급 배지
   *    ⒞ 한 번에 하나만 열림 을 단언했다. 그 「열 수 있음」이 WU-149 가 없앤 것이다.
   * 🟢 **잃지 않은 것** — 이 구역의 핵심 명제(「조회 결과가 **판정 카드로 올라오지
   *    않는다**」)는 위 두 테스트가 그대로 지킨다(WU-141-R3 C-5 · 가격 owner 하나).
   * 🔴 그리고 아래 한 줄이 **더 센 형태** 로 그것을 잠근다 — 조회가 돌아도 셀러
   *    화면 **어디에도** 후보 표가 서지 않는다(판정 카드든 원자료든).
   */
  it("🔴🔴 WU-149 — 조회가 돌아도 셀러 화면에 **후보 표가 서지 않는다**", async () => {
    stubOverseasSearch(overseasResults());
    await mount();
    /** 표가 **한 개도** 없다 — 열 드릴다운도, 올라올 판정 카드 표도 없다. */
    expect(stageElement().querySelector("table"), "🔴 후보 표가 되살아났다").toBeNull();
    const stage = visibleText(stageElement().outerHTML);
    /** 🔴 후보 표의 열 이름·판매처 이름이 화면에 **없다**(제목만 지우는 길 차단). */
    for (const cell of ["판매처 국가", "매칭상태", "Smallable", "Childrensalon", "Kidsroom"]) {
      expect(stage, `🔴 "${cell}" 이(가) 셀러 화면에 남아 있다`).not.toContain(cell);
    }
    /** 🔴 등급 배지(🟢 동일상품 / 🟡 동일상품 추정)도 이 단계 본문에 없다. */
    expect(stage).not.toContain("🟡 동일상품 추정");
  });

  it("🔴 등급이 섞인 조회에서도 같다 — 단계 본문에 등급 행이 없다", async () => {
    stubOverseasSearch(overseasResultsMixedTier());
    await mount();
    const stage = visibleText(stageElement().outerHTML);
    expect(stage).not.toContain("🟡 동일상품 추정");
    expect(stageElement().querySelector("table")).toBeNull();
  });

  /**
   * 🟢🟢 **엔진 보존의 마운트 축** — 국내 검색 설정 안내문은 그 패널의 글자다.
   * 🔴 셀러 화면에서 사라졌다는 것이 「설정 화면이 사라졌다」가 아니다 —
   *    `설정 > 국내 가격비교` 화면은 이 WU 가 **건드리지 않았다**.
   */
  it("🔴 국내 후보 표의 안내문도 셀러 화면에 없다", async () => {
    stubOverseasSearch(overseasResults());
    await mount();
    const stage = visibleText(stageElement().outerHTML);
    expect(stage).not.toContain("검색 대상은 설정 > 국내 가격비교에서 관리합니다.");
  });
});
