// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MiPanelView } from "../DomesticPriceIntelligencePanel";
/** 🟢 응답 fixture 를 **지어내지 않는다** — 기존 공용 헬퍼를 쓴다(다른 패널 테스트와 같은 입력). */
import { withDomesticComparable } from "./product-tab-composition";
import {
  DOMESTIC_REVIEW_HEADING,
  DOMESTIC_REVIEW_EMPTY,
  type GeminiTransientRow,
} from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-081 — **국내 후보 Human Review UI** (마운트 DOM · 소스 검사 아님)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO §14: 「캐시만 읽는 테스트 금지」 · 헌장 §5: 「Render PASS ≠ 소스 PASS」.
 * 🟢 그래서 `MiPanelView` 를 **실제로 마운트** 하고 **버튼을 누른다**
 *    (선례: `bulk-reference-reachability.test.ts` 와 같은 규약).
 * 🔴 `.test.tsx` 는 **수집되지 않는다** — 확장자를 `.test.ts` 로 두고 `createElement` 를 쓴다
 *    (메모 `local-toolchain-silent-noops`).
 *
 * 🔴 행의 모양은 지어내지 않았다 — WU-077 이 실측한 국내 후보 그대로다:
 *    `biskuit.kr` KRW 88,000 · `VERIFIED_CURRENT` · `PRESUMED_SAME` · `BRAND_MISMATCH`.
 */

const KR_ROW: GeminiTransientRow = {
  domain: "biskuit.kr",
  title: "[보보쇼즈] 허그 헤어리 몬스터 티셔츠 B226AC009 - 비스킷",
  source: "SELLER_URL",
  priceStatus: "VERIFIED_CURRENT",
  discoveredUrl: "https://biskuit.kr/product/x/8891/category/367/display/1/",
  crossSellerVerdict: "PRESUMED_SAME",
  matchTruth: "TEXT_CONFIRMED",
  priceTier: "COMPARISON",
  confidence: 0.62,
  matchReasons: ["품번 일치", "상품군 일치"],
  crossSellerBlockers: ["BRAND_MISMATCH"],
  crossSellerConflicts: [],
  priceAmount: 88000,
  priceCurrency: "KRW",
  market: "KR",
  basis: "KR_TLD_AND_KRW",
};

const OVERSEAS_ROW: GeminiTransientRow = {
  domain: "kids21.com",
  title: "Bobo Choses Hug Hairy Monster T-shirt",
  source: "SELLER_URL",
  priceStatus: "VERIFIED_CURRENT",
  discoveredUrl: "https://kids21.com/products/700005621lbl",
  crossSellerVerdict: "SIMILAR",
  priceTier: "REFERENCE",
  priceAmount: 58,
  priceCurrency: "SGD",
  market: "OVERSEAS",
  basis: "FOREIGN_CURRENCY_AND_NO_KR_EVIDENCE",
};

/** 🔴 **운영 모양의 응답**. 내가 만든 최소 객체를 쓰면 패널 내부가 터진다(`signals` 부재로 실측). */
const DATA = withDomesticComparable();

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // @ts-expect-error — React 가 act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function mount(extra: Record<string, unknown> = {}): Promise<void> {
  await act(async () => {
    root.render(
      createElement(MiPanelView, {
        data: DATA,
        candidates: [],
        urlCandidateEvidence: [KR_ROW, OVERSEAS_ROW],
        ...extra,
      } as never),
    );
  });
}

const sec = (id: string) => container.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const inSec = (id: string, testId: string) =>
  sec(id)?.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;
const click = async (el: HTMLElement | null) => {
  expect(el).toBeTruthy();
  await act(async () => {
    el!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

describe("WU-081 — 국내 후보 검토 UI", () => {
  it("🟢 H1 국내 후보가 **전용 구역** 에 선다", async () => {
    await mount();
    expect(sec("domestic-review-transient")?.textContent).toContain(DOMESTIC_REVIEW_HEADING);
    expect(inSec("domestic-review-transient", "gt-title")?.textContent).toContain("허그 헤어리 몬스터");
  });

  it("🟢 H2 가격과 **가격 신뢰도** 가 같이 보인다", async () => {
    await mount();
    const p = inSec("domestic-review-transient", "gt-price")?.textContent ?? "";
    expect(p).toMatch(/88,?000/);
    expect(p).toContain("KRW");
    expect(inSec("domestic-review-transient", "gt-price-confidence")).toBeTruthy();
  });

  it("🟢 H3 후보 URL 이 **실제 링크** 로 간다(검증한 URL 그대로)", async () => {
    await mount();
    expect(inSec("domestic-review-transient", "gt-url")?.getAttribute("href")).toBe(KR_ROW.discoveredUrl);
  });

  it("🔴 H4 시스템 판정과 사람 검토가 **다른 칸** 이다", async () => {
    await mount();
    const sys = inSec("domestic-review-transient", "gt-verdict")?.textContent ?? "";
    expect(sys.length).toBeGreaterThan(0);
    expect(sys).not.toContain("CEO 검토");
    expect(inSec("domestic-review-transient", "gt-blockers")?.textContent).toContain("BRAND_MISMATCH");
    /** 🔴 아직 누르지 않았으므로 검토 «결과» 는 없다. */
    expect(inSec("domestic-review-transient", "gt-review-result")).toBeNull();
  });

  it("🟢 H5 SAME 을 눌러도 **시스템 판정·가격이 불변** 이고 결과만 추가된다", async () => {
    await mount();
    const before = {
      verdict: inSec("domestic-review-transient", "gt-verdict")?.textContent,
      price: inSec("domestic-review-transient", "gt-price")?.textContent,
      blockers: inSec("domestic-review-transient", "gt-blockers")?.textContent,
    };
    await click(inSec("domestic-review-transient", "gt-review-same"));
    /** 🔴 **「검토 결과」라는 말이 있어야 한다** — 값만 찍으면 시스템 판정과 구분이 안 된다
     *    (M2 변이가 1차에서 통과해 잡은 자리다). */
    const result = inSec("domestic-review-transient", "gt-review-result")?.textContent ?? "";
    expect(result).toContain("검토 결과");
    expect(result).toContain("동일상품");
    /** 🔴🔴 **시스템 판정이 덮이지 않았다** — 공존한다. */
    expect(inSec("domestic-review-transient", "gt-verdict")?.textContent).toBe(before.verdict);
    expect(inSec("domestic-review-transient", "gt-price")?.textContent).toBe(before.price);
    expect(inSec("domestic-review-transient", "gt-blockers")?.textContent).toBe(before.blockers);
  });

  it("🟢 H5-b DIFFERENT 로 바꿔도 같은 성질", async () => {
    await mount();
    await click(inSec("domestic-review-transient", "gt-review-same"));
    await click(inSec("domestic-review-transient", "gt-review-different"));
    expect(inSec("domestic-review-transient", "gt-review-result")?.textContent).toContain("다른 상품");
  });

  it("🔴 H5-c 검토는 **서버로 가지 않는다** — 클릭이 fetch 를 일으키지 않는다", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    await mount();
    spy.mockClear();
    await click(inSec("domestic-review-transient", "gt-review-same"));
    expect(spy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("🔴 H6 기존 「직접 입력한 후보」 구역에는 **검토 버튼이 없다**(화면 불변)", async () => {
    await mount();
    expect(inSec("url-candidate-transient", "gt-human-review")).toBeNull();
    expect(inSec("url-candidate-transient", "gt-title")?.textContent).toContain("Bobo Choses Hug Hairy Monster");
  });

  it("🔴 H6-b 국내 행을 **옮겼을 뿐 복제하지 않았다** — 총 행 수 불변", async () => {
    await mount();
    const kr = sec("domestic-review-transient")?.querySelectorAll("li").length ?? 0;
    const legacy = sec("url-candidate-transient")?.querySelectorAll("li").length ?? 0;
    expect(kr).toBe(1);
    expect(legacy).toBe(1);
    expect(sec("url-candidate-transient")?.innerHTML).not.toContain("biskuit.kr");
  });

  it("🟢 국내 후보가 0 이어도 **판정 의미를 부여하지 않는다**", async () => {
    await mount({
      urlCandidateEvidence: [OVERSEAS_ROW],
      /**
       * 🔴 **칸 이름을 추측하지 않는다** — `lowest` 로 썼다가 터졌다(이 트랙 17번째).
       *    owner 는 `candidate-market.ts` 의 `CandidateOverseasPriceSummary` 이고
       *    칸은 **`lowestAmount`** · `byMarket` · `byPriceTier` 다.
       */
      domesticReference: {
        count: 1,
        byCurrency: { KRW: { count: 1, lowestAmount: 88000 } },
        byMarket: { KR: 1 },
        byPriceTier: { COMPARISON: 1 },
      },
    });
    const empty = sec("domestic-review-empty");
    expect(empty?.textContent).toContain(DOMESTIC_REVIEW_EMPTY);
    /** 🔴 「국내 동일상품이 없습니다」로 적지 않는다. */
    expect(empty?.textContent).not.toContain("동일상품이 없");
  });
});
