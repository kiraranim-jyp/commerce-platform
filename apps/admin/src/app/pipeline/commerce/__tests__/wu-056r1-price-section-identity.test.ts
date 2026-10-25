// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DomesticPriceIntelligencePanel } from "../DomesticPriceIntelligencePanel";
/** 🔴 WU-132 ③ — 두 참고 구역이 **옮겨 간** 자리. 화면의 유일한 가격비교 영역이다. */
import { MarketPriceComparison } from "../MarketPriceComparison";
import { OVERSEAS_REFERENCE_TITLE, DOMESTIC_REFERENCE_TITLE } from "../overseas-reference";
import { PRICE_SECTION_TITLE } from "../price-hierarchy";
import { GLOBAL_MARKET_HINT_LABEL } from "../global-market";
import { productionData } from "./product-tab-composition";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-056-R1 — **한 화면의 가격 구역들이 서로 구분되는가** (Panel mount DOM)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 파일이 생긴 이유는 내가 놓친 공백이다.** WU-049/056 의 계약은 **블록
 *    «안»** 만 봤다 — 「환산하지 않는다」를 내 구역 안에서만 단언했다. 그런데 CEO 가
 *    본 화면에는 **같은 상품의 같은 `EUR 40`** 이 두 구역에 떴고, 위 구역이 환산값을
 *    달고 있어서 **아래 구역의 환산으로 읽혔다.**
 *    ⟹ 블록 단위 검증이 **화면 단위 혼동** 을 잡지 못했다. 이 파일이 그 자리다.
 *
 * ── 🔴 그리고 내 1차 owner 추적이 «틀렸다» — 기록해 둔다 ────────────────────
 * ```
 * 내가 적었던 것   「🌐 글로벌 시장 가격」 카드의 krwEquivalent 와 아이콘 충돌
 * 🔴 실제          그 카드는 **접힌 ⓘ 힌트** 이고 라벨에 **🌐 가 없다**
 *                  (`GLOBAL_MARKET_HINT_LABEL = "글로벌 시장 가격"`)
 * 🟢 진짜 owner    **「원본 상품」 헤드라인**(`OriginalPriceView` · 상시 노출)의
 *                  `headline.converted` — `price-hierarchy.ts:905`
 *                  `EUR 40.00` + **「약 ₩59,960」**
 * ```
 * 🟢 그래도 CPO 가 확정한 ⒜(제목 분리)는 **그대로 유효하다** — 비교 대상이
 *    「글로벌 시장 가격」이 아니라 **「원본 상품」** 이었을 뿐이다.
 * 🔴 `converted`·환율·`global-market.ts` 는 **한 줄도 건드리지 않았다**(⒝ 미채택).
 */

let container: HTMLDivElement;
let root: Root;

const OVERSEAS_SUMMARY = {
  count: 2,
  byCurrency: { EUR: { count: 1, lowestAmount: 40 }, USD: { count: 1, lowestAmount: 58 } },
  byMarket: { OVERSEAS: 2 },
  byPriceTier: { EXACT: 2 },
};
const DOMESTIC_SUMMARY = {
  count: 1,
  byCurrency: { KRW: { count: 1, lowestAmount: 88_000 } },
  byMarket: { KR: 1 },
  byPriceTier: { COMPARISON: 1 },
};

function stubFetch() {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    void init;
    const url = String(input);
    const body = url.includes("/alerts")
      ? { ok: true, alerts: [] }
      : url.includes("/links")
        ? { ok: true, links: [] }
        : url.includes("/check")
          ? /** 🔴 POST 응답이 두 참고 축을 싣는다(WU-049 · WU-056). */
            { status: "ok", overseasReference: OVERSEAS_SUMMARY, domesticReference: DOMESTIC_SUMMARY }
          : { ...productionData(), ok: true };
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
  });
}

/** 🔴 라벨로 찾아 누른다 — 셀러가 읽는 글자가 좌표다. */
function clickByText(text: string): boolean {
  const button = Array.from(container.querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").includes(text),
  );
  if (!button) return false;
  act(() => button.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  return true;
}

/**
 * 🔴🔴 WU-132 ③ — **두 참고 구역이 서는 «자리» 가 바뀌었다(성질은 그대로).**
 *
 * 가격 비교 영역을 **둘 두지 않기** 위해 MI 패널의 `unified-price-comparison` 을
 * 제거했고, 그 안의 두 블록은 「📊 동일상품 가격 비교」(`MarketPriceComparison`)로
 * **옮겼다**. 🟢 이 파일이 잠그는 것(**구역 식별** · 환산 금지 · 아이콘 충돌 금지)은
 * 한 글자도 약해지지 않는다 — **같은 단언을 새 owner 에 적용** 한다.
 *
 * 🔴 그리고 **원본 카드의 환산이 살아 있는지** 는 여전히 패널을 마운트해서 본다
 *    (그 테스트가 이 파일의 ⒝ 미채택 증거다).
 */
async function mountComparisonArea() {
  await act(async () => {
    root.render(
      createElement(MarketPriceComparison, {
        domesticReference: DOMESTIC_SUMMARY,
        overseasReference: OVERSEAS_SUMMARY,
      } as never),
    );
  });
}

async function mountAndRecheck() {
  vi.stubGlobal("fetch", stubFetch());
  await act(async () => {
    root.render(
      createElement(DomesticPriceIntelligencePanel, { snapshotId: "wu056r1", presentation: "FULL" }),
    );
  });
  /** 🔴 「분석이 끝났습니다」는 800ms 뒤 꺼지는 전이 상태다(Panel:1937). */
  await act(async () => {
    await new Promise((r) => setTimeout(r, 900));
  });
  /** 입력칸·실행 버튼은 되물음 «안» 에 있다(WU-049-R). */
  clickByText("왜 이렇게 판단했나요?");
  await act(async () => {
    clickByText("다시 분석");
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  // @ts-expect-error — act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("WU-056-R1 — 화면 단위 구역 식별", () => {
  it("🟢 두 참고 구역이 «각자» 렌더된다", async () => {
    await mountComparisonArea();
    expect(container.querySelector('[data-testid="overseas-reference"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="domestic-reference"]')).not.toBeNull();
  });

  /**
   * 🔴🔴 WU-132 ③ — **가격 비교 영역은 화면에 «하나» 다.** MI 패널을 통째로 마운트해
   *    그 영역이 **없다** 는 것을 확인한다 — 둘이 되면 WU-128 이 지목한 중복이 되돌아온다.
   */
  it("🔴🔴 MI 패널 안에는 가격 비교 영역이 **없다**(영역은 하나다)", async () => {
    await mountAndRecheck();
    expect(container.querySelector('[data-testid="unified-price-comparison"]')).toBeNull();
    expect(container.querySelector('[data-testid="overseas-reference"]')).toBeNull();
    expect(container.querySelector('[data-testid="domestic-reference"]')).toBeNull();
  });

  /**
   * 🔴🔴 **이것이 이번 FAIL 을 막는 단언이다.**
   *    환산값(`약 ₩…`)은 「원본 상품」 헤드라인의 것이고, **해외 참고가격 구역 «안» 에는
   *    들어가서는 안 된다.** 구역을 **부분트리로 잘라** 본다 — 화면 전체에서 `₩` 를
   *    금지하면 정상인 원본 카드까지 잡아 거짓 FAIL 이 난다.
   */
  it("🔴🔴 해외 참고가격 구역 «안» 에 환산값이 없다", async () => {
    await mountComparisonArea();
    const section = container.querySelector('[data-testid="overseas-reference"]')!;
    const text = section.textContent ?? "";
    expect(text).toContain("EUR 40");
    expect(text).toContain("USD 58");
    /** 🔴 원화 · 환산 · 「약」 · ≈ 가 **이 구역 안에** 없어야 한다. */
    expect(text).not.toMatch(/₩|원화|환산된|≈/);
    expect(text).not.toMatch(/약\s*[0-9]/);
    /** 🔴 통화를 기호로 바꾸지도 않는다. */
    expect(text).not.toMatch(/[€$£¥]/);
  });

  /**
   * 🔴 제목이 **다른 가격 구역들과 겹치지 않는다.** 겹치면 셀러가 한 구역으로 읽고,
   *    옆 구역의 환산값을 이 구역의 것으로 읽는다(이번 FAIL 의 기전).
   */
  it("🔴 가격 구역 제목이 서로 구별된다", async () => {
    await mountAndRecheck();
    /**
     * 🔴 **구역 단위로 묶는다.** 1차 단언은 너무 넓어서 `"🌐 글로벌 시장 가격"` ⊃
     *    `"글로벌 시장 가격"` 을 충돌로 잡았다 — 그 둘은 **같은 구역의 두 이름**
     *    (상수와 힌트 라벨)이고 충돌이 아니다. **다른 구역끼리만** 비교한다.
     */
    const sections: { id: string; names: string[] }[] = [
      { id: "원본", names: [PRICE_SECTION_TITLE.ORIGINAL] },
      {
        id: "글로벌시장",
        names: [PRICE_SECTION_TITLE.SELLER_GLOBAL_MARKET, GLOBAL_MARKET_HINT_LABEL],
      },
      { id: "국내시장", names: [PRICE_SECTION_TITLE.DOMESTIC_COMPETITION] },
      { id: "해외참고", names: [OVERSEAS_REFERENCE_TITLE] },
      { id: "국내참고", names: [DOMESTIC_REFERENCE_TITLE] },
    ];
    /** 🔴 **다른 구역** 의 이름이 서로를 포함하면 화면에서 구별이 흐려진다. */
    for (const x of sections) {
      for (const y of sections) {
        if (x.id === y.id) continue;
        for (const a of x.names) {
          for (const b of y.names) {
            expect(a.includes(b), `구역 충돌: ${x.id}"${a}" ⊃ ${y.id}"${b}"`).toBe(false);
          }
        }
      }
    }
    /**
     * ══════════════════════════════════════════════════════════════════════════
     * 🔴🔴 CORE-2AO ⒝ — 제목이 **「해외 최저 소싱가」** 로 바뀌었다(CPO 확정 2026-10-25)
     * ══════════════════════════════════════════════════════════════════════════
     *
     * 🔴 전 제목은 「해외 **동일상품** 참고가격」이었다. 그런데 이 집계의 분모는
     *    `EXCLUDED` 만 뺀 것이고 **`COMPARISON`(유사상품)이 들어간다** ⟹ 제목이
     *    분모보다 **센 주장** 을 하고 있었다. 🟢 그 주장을 뺀 것이 이 변경이다.
     * 🟢 그래서 앵커 를 **갱신하고 강화** 한다 — 이제 두 제목 모두
     *    「동일상품」을 **주장하지 않아야** 한다(분모가 그렇지 않으므로).
     */
    expect(OVERSEAS_REFERENCE_TITLE).toBe("해외 최저 소싱가");
    for (const title of [OVERSEAS_REFERENCE_TITLE, DOMESTIC_REFERENCE_TITLE]) {
      expect(title, `🔴 「${title}」가 동일상품을 주장한다 — 분모에 COMPARISON 이 있다`).not.toContain(
        "동일상품",
      );
    }
  });

  /** 🔴 아이콘도 겹치지 않는다 — WU-049 가 `🌐` 를 썼던 자리다. */
  it("🔴 해외 참고가격 아이콘이 🌐 가 아니다", async () => {
    await mountComparisonArea();
    const section = container.querySelector('[data-testid="overseas-reference"]')!;
    expect(section.textContent).toContain("🧾");
    expect(section.textContent).not.toContain("🌐");
  });

  /**
   * 🟢 **환산 owner 를 건드리지 않았다** — 원본 카드의 환산은 그대로 살아 있어야 한다.
   *    🔴 이 단언이 깨지면 내가 ⒝(제거안)를 잘못 수행한 것이다.
   */
  it("🟢 「원본 상품」 헤드라인의 환산은 그대로 살아 있다", async () => {
    await mountAndRecheck();
    const whole = container.textContent ?? "";
    expect(whole).toContain(PRICE_SECTION_TITLE.ORIGINAL);
    /** 🔴 구역 «밖» 에서는 환산값이 **있어야** 정상이다(제거하지 않았다). */
    const outside = whole.replace(
      container.querySelector('[data-testid="overseas-reference"]')?.textContent ?? "",
      "",
    );
    expect(outside).toMatch(/₩/);
  });
});
