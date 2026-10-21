// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PREPARE_SURFACE_LABEL } from "../stage-focus";
import { resetMarketCollectionsForTests } from "../market-collection";
import { buildMiVerdictExplanation } from "../mi-verdict-copy";
import { readSourceAt, stripComments } from "./source-text";
import {
  headingsInOrder,
  overseasResults,
  productTabElement,
  regionsOf,
  visibleLines,
  visibleText,
  withDomesticComparable,
  type TabOptions,
} from "./product-tab-composition";

/**
 * MI-UX-FINAL-4(CEO 지시, 2026-09-13) — 구조 정리 네 가지와 중복 사실 청소.
 *
 * 이 파일이 고정하는 것은 "무엇이 화면에 있는가"가 아니라 **같은 것이 두 번
 * 있지는 않은가**다. 그 질문은 순수 함수로 표현할 수 없고, 깨지는 방식은 늘
 * 같다 — 누군가 "여기도 있으면 편하겠다"고 한 줄을 더한다. 그래서 렌더 결과에서
 * 직접 센다.
 */
function read(relativeToThisFile: string): string {
  return readSourceAt(new URL(relativeToThisFile, import.meta.url));
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  resetMarketCollectionsForTests();
  // @ts-expect-error — React가 act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal(
    "fetch",
    vi.fn((input: unknown) =>
      String(input).includes("/api/exchange-rates")
        ? Promise.resolve({ ok: true, json: () => Promise.resolve({ rates: { EUR: 1556.56 }, source: "frankfurter" }) })
        : Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                ok: true,
                results: overseasResults(),
                sourceVerification: { status: "NOT_APPLICABLE", price: null, regularPrice: null },
              }),
          }),
    ),
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

async function mount(options: TabOptions): Promise<void> {
  await act(async () => {
    root.render(productTabElement(options));
  });
}

function page(): HTMLElement {
  const el = container.firstElementChild;
  if (!(el instanceof HTMLElement)) throw new Error("화면이 비어 있다");
  return el;
}

function clickText(label: string): void {
  const button = Array.from(page().querySelectorAll("button")).find((b) => (b.textContent ?? "").includes(label));
  if (!button) throw new Error(`"${label}" 버튼이 화면에 없다`);
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** 국내·해외가 전부 확인된 상품. 중복이 생길 수 있는 최대치의 화면이다. */
const BOTH_MARKETS: TabOptions = { marketDone: false, data: withDomesticComparable() };

/* ─────────── 지시 ① — 한 기능 = 한 제목 = 한 진입점 ─────────── */

describe("판매가격 확정이 두 층으로 겹치지 않는다", () => {
  /**
   * 「판매가격 확정 › 판매가격 확정」이 뜨던 이유는 제목을 두 곳이 각자 갖고
   * 있었기 때문이다: 이 카드를 담는 자리(접힘/하위 항목 버튼)와 카드 자신.
   * 제목은 담는 자리가 갖는다 — 접었을 때도 보여야 하므로 거기여야 한다.
   */
  it("카드 자신은 제목을 갖지 않는다 — 제목은 그 카드를 담는 자리가 갖는다", () => {
    const editor = stripComments(read("../PriceEditor.tsx"));
    expect(editor).not.toContain(PREPARE_SURFACE_LABEL.PRICE);
    expect(editor).not.toContain("<h3");
    // 담는 자리의 이름은 그대로다 — 없앤 것은 이름이 아니라 중복이다.
    expect(PREPARE_SURFACE_LABEL.PRICE).toBe("💰 판매가격 확정");
    expect(read("../StageBody.tsx")).toContain("title={PREPARE_SURFACE_LABEL.PRICE}");
  });

  it("펼쳐도 그 이름은 화면에 한 번뿐이다", async () => {
    await mount(BOTH_MARKETS);
    clickText(PREPARE_SURFACE_LABEL.PRICE);
    const text = visibleText(regionsOf(page().outerHTML).stage);
    expect(text).toContain("권장 판매가격");
    expect((text.match(/💰 판매가격 확정/g) ?? []).length).toBe(1);
  });
});

/* ─────────── 지시 ③ — [설정]이 줄을 밀지 않는다 ─────────── */

describe("목표 마진 옆 [설정]은 값을 밀어내지 않는다", () => {
  it("값은 주인공이고 링크는 곁가지다 — 줄바꿈도 축소도 일어나지 않는다", () => {
    const detail = read("../PriceCalculationDetail.tsx");
    const marginRow = detail.slice(
      detail.indexOf('<Row label="목표 마진">'),
      detail.indexOf("</Row>", detail.indexOf('<Row label="목표 마진">')),
    );
    // 링크가 입력칸의 자리를 빼앗지 않고(shrink-0), 글자 안에서 끊기지 않는다.
    expect(marginRow).toContain("shrink-0 whitespace-nowrap");
    // 층이 눈으로도 갈린다 — 값은 기본 크기, 링크는 한 단계 아래.
    expect(marginRow).toContain("text-[11px] text-text-tertiary");
    // 입력칸도 밀리지 않는다.
    expect(marginRow).toContain("w-14 shrink-0");
    // 링크가 가는 곳은 그대로다.
    expect(marginRow).toContain('href="/settings"');
    expect(marginRow).toContain("[설정]");
  });
});

/* ─────────── 지시 ⑤ — 건너뛰는 번호가 없다 ─────────── */

describe("블록 번호가 ①→③으로 건너뛰지 않는다", () => {
  /**
   * 번호를 다시 매기는 대신 아예 떼는 쪽을 골랐다(MI-FINAL-UX-3). 이유는
   * 동적 번호도 같은 함정을 갖기 때문이다 — 블록이 사라지면 같은 상품의 "③
   * 수익성"이 어제와 오늘 다른 번호로 불린다. 이 테스트는 그 결정이 되돌아오지
   * 않게 막는다: 데이터가 있든 없든 제목에 번호가 붙지 않는다.
   */
  it("국내 시장이 비어도 채워져도 제목에 동그라미 숫자가 없다", async () => {
    for (const options of [{ marketDone: false }, BOTH_MARKETS]) {
      await act(async () => root.render(productTabElement(options)));
      const mi = regionsOf(page().outerHTML).mi;
      expect(visibleText(mi)).not.toMatch(/[①②③④⑤]/);
      // 그리고 읽는 순서의 칸은 데이터 유무와 무관하게 같은 개수로 선다 —
      // 블록이 조건부로 사라지면 번호가 없어도 "한 칸이 비었다"가 남는다.
      /**
       * 🔴 WU-141-R3 — 「🇰🇷 국내 시장」·「🌎 해외 시장」이 **결론 영역으로 올라갔다**
       *    (`MarketPriceComparison` · 격자 밖 최상단 · WU-140-R1). 🟢 이 계약이 지키는
       *    성질은 **「데이터 유무와 무관하게 같은 개수로 선다」** 이고 그것은 그대로다.
       */
      expect(headingsInOrder(mi)).toEqual([
        "Market Intelligence",
        "원본 상품",
        "ⓘ 글로벌 시장 가격",
        "수익성",
        "ⓘ 가격 계산 기준",
        "왜 이렇게 판단했나요?",
      ]);
    }
  });
});

/* ─────────── PART 4 — 같은 사실이 두 번 있지 않다 ─────────── */

describe("같은 사실이 한 화면에 두 번 서지 않는다", () => {
  /**
   * CEO가 지목한 세 후보를 그대로 센다. 렌더된 글자에서 직접 세는 이유는,
   * "지웠다"는 보고가 소스 한 구간만 보고 나온 적이 여러 번 있었기 때문이다.
   */
  it("예상 이익 · 국내 가격 · 축 등급은 각각 한 곳에만 있다", async () => {
    await mount(BOTH_MARKETS);
    // 되물음과 그 아래 근거까지 전부 펼친 상태 — 중복이 생길 수 있는 최대치다.
    clickText("왜 이렇게 판단했나요?");
    clickText("판단 근거 자세히 보기");
    const mi = visibleText(regionsOf(page().outerHTML).mi);

    // ① 예상 이익 — 수익성 사슬 한 줄뿐이다(되물음이 같은 숫자를 다시 적지 않는다).
    expect((mi.match(/예상 이익/g) ?? []).length).toBe(1);
    /**
     * ② 국내 대표 가격 — 🔴🔴 **WU-141-R3 에서 `2 → 0` 이 됐다**(이 파일 기준).
     *
     * 이 계약의 숫자가 세 번째로 바뀌는 자리라 **이유를 전부 적는다**:
     * ```
     * WU-030 이전  1  — 🇰🇷 국내 시장 요약(근거) 하나
     * WU-030       2  — + 상품 판단 요약(결론)            ← CPO 승인
     * WU-141-R3    0  — 🔴 **둘 다 판정 카드에서 나갔다**
     * ```
     * 🔴 요약 카드의 금액은 **제거** 됐고(owner 가 아니다 · `wu-030-judgement-summary`),
     *    🇰🇷/🌎 시장 요약은 **격자 밖 결론 영역으로 이동** 했다(`MarketPriceComparison`).
     * 🟢 그래서 **전체 화면 기준으로는 여전히 「한 곳」** 이고, 규칙은 1 → 2 → **1** 로
     *    돌아온 것이다 — 이 파일이 보는 구간(판정 카드)에 그 하나가 **없을** 뿐이다.
     * 🔴🔴 **「0 이니까 아무것도 검사하지 않는다」가 되지 않게** 그 하나를 세는 계약을
     *    `wu-141-r3-price-owner.test.ts` 가 **owner 를 직접 렌더해서** 가진다
     *    (거기서 `toBe(1)`). 두 파일을 같이 읽어야 「정확히 한 번」이 증명된다.
     */
    expect((mi.match(/₩116,600/g) ?? []).length).toBe(0);
    // ③ 축 등급 — 레이더 그림(축 라벨)과 네 줄의 낱말이 서로 다른 층에 있고,
    //    별점 목록이 그림 아래 한 벌 더 붙지 않는다.
    expect(mi).not.toContain("★");
    expect((mi.match(/매우 좋음|보통|낮음/g) ?? []).length).toBeLessThanOrEqual(4);
  });

  it("되물음이 본문의 숫자를 한 번도 다시 적지 않는다", async () => {
    await mount(BOTH_MARKETS);
    const before = visibleLines(regionsOf(page().outerHTML).mi);
    clickText("왜 이렇게 판단했나요?");
    clickText("판단 근거 자세히 보기");
    const added = visibleLines(regionsOf(page().outerHTML).mi).filter((line) => !before.includes(line));
    // 늘어난 줄 어디에도 금액/퍼센트가 없다. 되물음이 답하는 것은 "그 숫자들이
    // 어느 쪽으로 읽혔는가"이지 숫자 자체가 아니다.
    for (const line of added) {
      expect(line, `되물음이 숫자를 다시 적는다: ${line}`).not.toMatch(/₩[\d,]|\d+(\.\d+)?%/);
    }
  });

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴🔴 WU-141-R3 §9 — **`hasOverseasRange` 의 owner 가 ③ 에서 ① 로 바뀌었다**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 전에는 「아래 패널의 자기 집계」(`overseasMarketEvidence.figure != null`)가
   *    그 입력이었다. R3 가 그 집계를 제거했으므로, 그대로 두면 문구가 **항상**
   *    「🌎 해외 판매처 가격대는 확인되지 않았습니다」가 된다 —
   *    🔴 「📊 시장 판매 판단」이 GBP 37 을 보여주는 화면에서도 그렇게 말한다.
   *    **그것이 R3 가 만들 수 있었던 가장 위험한 거짓말이다.**
   * 🟢 그래서 이제 입력은 **① 의 산출**(`buildPriceGuide(...,"OVERSEAS").pricedCount`)
   *    이고, 아래 두 테스트가 **양방향으로** 잠근다:
   * ```
   * 후보 행 없음        → hasOverseasRange **false** → 「확인되지 않았습니다」  (정직)
   * 가격 확인된 SAME 행 → hasOverseasRange **true**  → 「확인됐습니다」        (정직)
   * ```
   * 🔴 두 번째 테스트가 없으면 「언제나 false」인 구현도 통과한다 — 그래서 둘을 같이 둔다.
   */
  it("되물음의 네 줄은 판정과 같은 입력에서 나온다 — 두 번째 판정이 아니다", async () => {
    await mount(BOTH_MARKETS);
    clickText("왜 이렇게 판단했나요?");
    const mi = visibleText(regionsOf(page().outerHTML).mi);
    /**
     * 🔴 `withDomesticComparable` 은 **국내 서버 집계** fixture 이고 **해외 후보 행이
     *    없다** ⟹ ① 기준으로 해외 가격대는 **확인되지 않은 것이 맞다**(정직한 false).
     */
    for (const line of buildMiVerdictExplanation({
      marketCase: "A",
      hasComparable: true,
      evidenceBasis: "EXACT",
      hasOverseasRange: false,
    })) {
      expect(mi, `${line}이(가) 없다`).toContain(line);
    }
  });

  it("🔴 가격이 확인된 해외 SAME 후보가 있으면 되물음이 「확인됐다」로 바뀐다", async () => {
    await mount({
      ...BOTH_MARKETS,
      /** 🟢 ① 의 게이트를 그대로 통과하는 행 — tier SAME · 판매중 · `VERIFIED_CURRENT`. */
      transientRows: [
        {
          source: "SELLER_URL",
          domain: "junioredition.com",
          title: "Bobo Choses Terry Bermuda Shorts",
          imageUrl: null,
          soldOut: false,
          discoveredUrl: "https://junioredition.com/products/b226ac043",
          matchTruth: "EXACT_IDENTIFIER",
          priceTier: "EXACT",
          crossSellerVerdict: "SAME",
          confidence: 1,
          matchReasons: [],
          crossSellerBlockers: [],
          crossSellerConflicts: [],
          priceAmount: 37,
          priceCurrency: "GBP",
          priceStatus: "VERIFIED_CURRENT",
          market: "OVERSEAS",
          basis: "TLD",
        } as never,
      ],
    });
    clickText("왜 이렇게 판단했나요?");
    const mi = visibleText(regionsOf(page().outerHTML).mi);
    for (const line of buildMiVerdictExplanation({
      marketCase: "A",
      hasComparable: true,
      evidenceBasis: "EXACT",
      hasOverseasRange: true,
    })) {
      expect(mi, `${line}이(가) 없다`).toContain(line);
    }
  });
});
