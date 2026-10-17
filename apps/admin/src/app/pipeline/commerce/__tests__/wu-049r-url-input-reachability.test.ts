// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DomesticPriceIntelligencePanel } from "../DomesticPriceIntelligencePanel";
import { resolveStageFocus } from "../stage-focus";
import type { BigStepKey } from "../workflow";
/**
 * 🟢 **새 fixture 를 만들지 않는다** — 이 리포에는 실제 Production 응답을 옮겨 둔
 *    빌더가 이미 있다(`product-tab-composition.ts:158`). 손으로 지어낸 응답으로
 *    재면 「우리 화면」이 아니라 「내 상상」을 재게 된다.
 */
import { productionData } from "./product-tab-composition";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-049-R — **URL 입력칸에 «실제로» 도달할 수 있는가**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 왜 이 파일이 필요했나 — CPO 가 CEO 에게 WU-049 테스트를 안내하려다
 *    **Production UI 에서 직접 URL 입력칸을 찾지 못했다.** 그런데 WU-024~038 은
 *    「입력칸 → transient → MI → 가격」 경로를 전부 통과시켰다. 즉 **기능은
 *    있는데 가는 길이 보고서에 없었다.**
 *
 * 🔴 기존 테스트가 이것을 못 잡은 이유: WU-030 계약은 **소스 문자열** 로
 *    `candidateUrlsText` 존재만 봤고(`wu-030-abc-continuous-analysis.test.ts:115`),
 *    첫화면 계약들은 `renderToStaticMarkup` 이라 **effect 가 돌지 않아** `data`
 *    가 null → 「불러오지 못했습니다」 한 줄만 본다. 🔴 **둘 다 「접혀 있다」와
 *    「아예 없다」를 구분하지 못한다**(선례 `bulk-reference-reachability.test.ts`
 *    가 같은 이유로 마운트+클릭을 택했다).
 *
 * 🟢 그래서 이 파일은 **진짜 DOM 에 마운트하고 버튼을 누른다.**
 *
 * 🔴 **운영 코드를 바꾸지 않는다** — 이 WU 는 「있는 기능의 도달 경로 확정」이다.
 */

/** 🔴 입력칸의 DOM 좌표. 이 testid 가 바뀌면 CEO 안내문도 같이 틀린다. */
const URL_INPUT = '[data-testid="wu024-candidate-urls"]';
const DETAIL_TOGGLE = "왜 이렇게 판단했나요?";
const SUMMARY_OPEN = "가격 판단 상세보기";
const RECHECK = "다시 분석";

let container: HTMLDivElement;
let root: Root;

/**
 * 🔴 `loadPriceHistory` 가 `json.ok` 를 보고 `setData(json.ok ? json : null)` 한다
 *    (Panel:1896). 즉 **GET 이 성공해야** 입력칸이 사는 가지로 들어간다 —
 *    그 전제를 테스트가 직접 들고 있어야 「왜 안 보이나」를 설명할 수 있다.
 */
function stubFetch(priceHistoryOk: boolean) {
  /** 🔴 `init` 를 선언에서 빼면 `mock.calls[i][1]` 이 타입 오류다(실제로 걸렸다). */
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    void init;
    const url = String(input);
    const body = url.includes("/alerts")
      ? { ok: true, alerts: [] }
      : url.includes("/links")
        ? { ok: true, links: [] }
        : priceHistoryOk
          ? { ...productionData(), ok: true }
          : { ok: false };
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
  });
}

async function mount(opts: {
  presentation?: "FULL" | "SUMMARY" | "HIDDEN";
  priceHistoryOk?: boolean;
}) {
  const fetchMock = stubFetch(opts.priceHistoryOk ?? true);
  vi.stubGlobal("fetch", fetchMock);
  await act(async () => {
    root.render(
      createElement(DomesticPriceIntelligencePanel, {
        snapshotId: "wu049r-snapshot",
        presentation: opts.presentation ?? "FULL",
        /** 🔴 요약에서 펼치는 길이 «있다»는 것도 DOM 으로 봐야 한다. */
        onOpenDetail: () => {},
      }),
    );
  });
  /**
   * 🔴 「분석이 끝났습니다」(`justCompleted`)는 **800ms 뒤에 스스로 꺼지는** 전이
   *    상태다(Panel:1937). 그 전에 단언하면 전이 화면을 최종 화면으로 읽는다 —
   *    실제로 이 하니스의 첫 실행이 그 함정에 걸렸다(5 FAIL).
   */
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 900));
  });
  return fetchMock;
}

/** 🔴 라벨로 찾는다 — 셀러가 화면에서 읽는 그 글자가 테스트의 좌표다. */
function clickByText(text: string): boolean {
  const button = Array.from(container.querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").includes(text),
  );
  if (!button) return false;
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  return true;
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  // @ts-expect-error — React 가 act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

/* ══════════ A. 🟢 FULL 에서는 «한 번» 누르면 입력칸이 나온다 ══════════ */

describe("A. FULL — 되물음 한 번", () => {
  it("🔴 처음에는 입력칸이 DOM 에 없다 (접혀 있다)", async () => {
    await mount({ presentation: "FULL" });
    expect(container.querySelector(URL_INPUT)).toBeNull();
    /** 🟢 그러나 **들어가는 문** 은 화면에 있다 — 그래서 「없는 기능」이 아니다. */
    expect(container.textContent).toContain(DETAIL_TOGGLE);
  });

  it("🟢🟢 「왜 이렇게 판단했나요?」를 누르면 입력칸과 실행 버튼이 나타난다", async () => {
    await mount({ presentation: "FULL" });
    expect(clickByText(DETAIL_TOGGLE)).toBe(true);

    const input = container.querySelector(URL_INPUT);
    expect(input).not.toBeNull();
    /** 🔴 placeholder 까지 본다 — 「무엇을 넣어야 하는가」가 화면에 있어야 한다. */
    expect(input?.getAttribute("placeholder")).toContain("https://");
    expect(container.textContent).toContain(RECHECK);
  });

  /**
   * 🔴🔴 **입력이 서버까지 가는지** 를 본다 — 이것이 WU-049 가 의존하는 계약이다.
   *
   * 🔴 처음에 나는 `input.value` 를 넣고 **그대로 다시 읽는** 단언을 썼다. 그것은
   *    **헛단언** 이었다 — 내가 DOM 을 직접 바꿨으니 wiring 이 끊겨 있어도 통과한다.
   *    실제로 변이 M2(`onCandidateUrlsChange` 전달 제거)가 **9/9 통과** 했다.
   * 🟢 그래서 축을 바꿨다: **POST /check 의 body 에 그 URL 이 실리는가.**
   *    state 를 거치지 않으면 `candidateUrls` 칸이 아예 생기지 않는다(Panel:2049).
   * 🔴 그리고 React 의 controlled input 에는 값 추적기가 있어 `.value` 직접 대입은
   *    onChange 를 **건너뛸 수 있다** → prototype setter 로 넣어야 실제 타이핑과 같다.
   */
  it("🔴🔴 입력한 URL 이 POST /check 의 candidateUrls 로 실제로 간다", async () => {
    const fetchMock = await mount({ presentation: "FULL" });
    clickByText(DETAIL_TOGGLE);
    const input = container.querySelector(URL_INPUT) as HTMLTextAreaElement;

    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    await act(async () => {
      nativeSetter?.call(input, "https://example.com/products/x");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      clickByText(RECHECK);
    });

    const checkCall = fetchMock.mock.calls.find(
      ([url]) => String(url) === "/api/price-history/check",
    );
    expect(checkCall, "「🔄 다시 분석」이 POST /check 를 부르지 않았다").toBeDefined();
    const body = JSON.parse(String((checkCall?.[1] as RequestInit | undefined)?.body ?? "{}"));
    expect(body.candidateUrls).toEqual(["https://example.com/products/x"]);
  });
});

/* ══════════ B. 🔴 SUMMARY 에서는 입력칸이 «아예 없다» ══════════ */

describe("B. SUMMARY — 먼저 펼쳐야 한다", () => {
  it("🔴🔴 입력칸도 되물음도 DOM 에 없다 — 대신 펼치는 버튼이 있다", async () => {
    await mount({ presentation: "SUMMARY" });
    expect(container.querySelector(URL_INPUT)).toBeNull();
    expect(container.textContent).not.toContain(DETAIL_TOGGLE);
    /** 🟢 그래서 **2단** 이다: 먼저 이걸 눌러 FULL 로 바꾼 뒤에야 되물음이 생긴다. */
    expect(container.textContent).toContain(SUMMARY_OPEN);
  });

  it("🔴 HIDDEN 은 아무것도 렌더하지 않는다 (채널 탭 · 수집 중)", async () => {
    await mount({ presentation: "HIDDEN" });
    expect(container.textContent).toBe("");
  });
});

/* ══════════ C. 🔴 GET 이 실패하면 입력칸이 사라진다 (선행조건) ══════════ */

describe("C. 선행조건 — 시장 분석이 로드돼야 한다", () => {
  /**
   * 🔴🔴 이것이 「입력칸을 못 찾았다」의 **또 하나의 원인 후보** 다.
   *    `if (!data)` 가지(Panel:2163)는 한 줄짜리 안내만 렌더하고 **되물음 자체가
   *    없다** → 입력칸까지 영구히 닿지 못한다.
   */
  it("🔴 GET /price-history 가 ok=false 면 입력칸에 도달할 수 없다", async () => {
    await mount({ presentation: "FULL", priceHistoryOk: false });
    expect(container.textContent).toContain("불러오지 못했습니다");
    expect(container.textContent).not.toContain(DETAIL_TOGGLE);
    expect(container.querySelector(URL_INPUT)).toBeNull();
  });
});

/* ══════════ D. 🔴 어느 «단계» 에서 FULL 이 되는가 — 규칙표를 잠근다 ══════════ */

describe("D. 단계 → 표현 무게", () => {
  const STAGES: BigStepKey[] = [
    "COLLECTING",
    "MARKET_JUDGING",
    /** 🔴 WU-058 — `SOURCE_SELECTING`(소싱 선택)이 제거됐다. 단계가 **넷** 이다. */
    "REGISTRATION_PREPARING",
    "COMMERCE_REGISTERING",
  ];

  /** 🟢 ② 시장 판단에서만 **아무것도 누르지 않고** FULL 이다. */
  it("🟢 PRODUCT 탭 · 펼치지 않은 상태 — MARKET_JUDGING 만 FULL", () => {
    const full = STAGES.filter(
      (stage) => resolveStageFocus({ stage, surface: "PRODUCT", marketDetailOpen: false }).mi === "FULL",
    );
    expect(full).toEqual(["MARKET_JUDGING"]);
  });

  /** 🟢 다른 단계에서도 **펼치면** FULL 이 된다 — 길이 막힌 것이 아니다. */
  it("🟢 펼치면 COLLECTING 을 뺀 전 단계가 FULL", () => {
    const full = STAGES.filter(
      (stage) => resolveStageFocus({ stage, surface: "PRODUCT", marketDetailOpen: true }).mi === "FULL",
    );
    expect(full).toEqual(["MARKET_JUDGING", "REGISTRATION_PREPARING", "COMMERCE_REGISTERING"]);
  });

  /** 🔴🔴 채널 탭에서는 펼쳐도 HIDDEN — **거기서는 입력칸을 찾을 수 없다.** */
  it("🔴 채널 탭은 펼쳐도 전 단계 HIDDEN", () => {
    for (const stage of STAGES) {
      expect(resolveStageFocus({ stage, surface: "CHANNEL", marketDetailOpen: true }).mi).toBe("HIDDEN");
    }
  });
});
