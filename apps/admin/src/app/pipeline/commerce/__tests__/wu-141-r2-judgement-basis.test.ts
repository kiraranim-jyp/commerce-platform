// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TransientCandidateSections } from "../DomesticPriceIntelligencePanel";
import {
  DOMESTIC_REVIEW_HEADING,
  JUDGEMENT_BASIS_LABEL,
  type GeminiTransientRow,
} from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-141-R2 STEP 2 — **탐색 과정을 «하나의» 접힘 뒤로** (CPO NO-GO 수리)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 판정(2026-10-21): 「지금 화면은 셀러용 상품등록 화면이 아니라 **MI 조사 로그
 *    화면**」 · 「**탐색 과정이 결론보다 앞에 나와 있다**」 · 「후보 수를 KPI 로 삼지 않는다」.
 *
 * ── 🔴🔴 WU-136 의 「구역별 접힘」으로 부족했던 이유 (실측) ─────────────────
 * ```
 * ⒜ 구역 여섯 중 **둘이 접혀 있지 않았다** — 🔎 웹 후보(인라인) ·
 *    📚 이전에 확인한 후보(`ReviewHistorySection`).
 * ⒝ 🔴 그리고 WU-141-R1 STEP 4 가 `recordSeenCandidates` 를 **되살렸다**(그 전엔
 *    42P10 으로 한 행도 안 들어갔다) ⟹ 📚 가 **본 후보 전부로 채워진다**
 *    ⟹ 고치지 않으면 「조사 로그」가 **더 심해진다**. 그래서 이 WU 가 급했다.
 * ```
 *
 * 🔴 **삭제가 아니다** — DOM·데이터·저장 기능 전부 그대로다(React 는 닫힌 `details` 의
 *    자식도 렌더한다) ⟹ 기존 DOM 계약이 유지되는 것이 **이 설계의 전제** 다.
 * 🔴 네트워크 0 · DB 0.
 */

const PANEL = readFileSync(join(__dirname, "../DomesticPriceIntelligencePanel.tsx"), "utf8").replace(
  /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
  "",
);

/** 🔴 실측 모양 그대로다(WU-139 E2E 의 해외 SAME 행). 지어낸 칸 0. */
const row = (over: Partial<GeminiTransientRow> = {}): GeminiTransientRow => ({
  source: "OVERSEAS_AUTO",
  domain: "a.example",
  title: "Hug Hairy Monster T-shirt",
  imageUrl: null,
  soldOut: false,
  discoveredUrl: "https://a.example/products/x",
  matchTruth: "EXACT_IDENTIFIER",
  priceTier: "EXACT",
  crossSellerVerdict: "SAME",
  confidence: 1,
  matchReasons: [],
  crossSellerBlockers: [],
  crossSellerConflicts: [],
  priceAmount: 58,
  priceCurrency: "USD",
  priceStatus: "VERIFIED_CURRENT",
  market: "OVERSEAS",
  basis: "FOREIGN_CURRENCY_AND_NO_KR_EVIDENCE",
  ...over,
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // @ts-expect-error — act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const mount = async (props: Record<string, unknown>) => {
  await act(async () => {
    root.render(createElement(TransientCandidateSections as never, props as never));
  });
};
const q = (id: string) => container.querySelector(`[data-testid="${id}"]`);

/* ═══════════════ A. 🔴🔴 접힘 하나가 탐색 과정 «전부» 를 덮는다 ═══════════════ */

describe("A. 🔴🔴🔴 탐색 과정은 «하나의» 접힘 뒤에 있다", () => {
  const base = {
    web: [row({ domain: "web.example", discoveredUrl: "https://web.example/1" })],
    supplied: null,
    overseasAuto: [row()],
    reviewedSame: null,
    notice: null,
    domesticReview: {},
    reviewSaveState: {},
    reviewHistory: [
      {
        candidateUrl: "https://old.example/1",
        candidateDomain: "old.example",
        candidateTitle: "예전 후보",
        imageUrl: null,
        priceAmount: null,
        priceCurrency: null,
        market: null,
        systemVerdict: null,
        matchTruth: null,
        priceTier: null,
        blockers: [],
        humanVerdict: "SAME" as const,
        source: "SELLER_URL" as const,
        firstSeenAt: "2026-10-01T00:00:00Z",
        lastSeenAt: "2026-10-01T00:00:00Z",
        reviewedAt: "2026-10-01T00:00:00Z",
      },
    ],
    originImageUrl: null,
    originTitle: "원상품",
  };

  it("A-1 🔴🔴🔴 `▸ 판단 근거 보기` 접힘이 있고 **닫혀 있다**", async () => {
    await mount(base);
    const fold = q("judgement-basis") as HTMLDetailsElement | null;
    expect(fold).toBeTruthy();
    expect(fold!.tagName).toBe("DETAILS");
    /** 🔴 `open` 이 붙으면 다시 1차 화면이 된다 — 2026-09-19 사고의 기전이다. */
    expect(fold!.open).toBe(false);
    expect(fold!.querySelector("summary")?.textContent).toContain(JUDGEMENT_BASIS_LABEL);
  });

  it("A-2 🔴🔴 **전에 접혀 있지 않던 둘** 도 그 안에 있다(🔎 웹 · 📚 이력)", async () => {
    await mount(base);
    const fold = q("judgement-basis")!;
    /**
     * 🔴 이 두 줄이 이 WU 의 핵심이다 — WU-136 은 구역별로만 접었고 이 둘은
     *    인라인이라 **화면을 채우고 있었다**(CEO 가 본 「조사 로그」).
     */
    expect(fold.textContent).toContain("예전 후보");
    expect(fold.textContent).toContain("web.example");
  });

  it("A-3 🔴🔴 후보 구역이 **접힘 «밖»** 에 하나도 없다", async () => {
    await mount(base);
    const fold = q("judgement-basis")!;
    for (const id of [
      "domestic-review-transient",
      "domestic-review-empty",
      "overseas-auto-transient",
      "reviewed-same-transient",
      "url-candidate-transient",
    ]) {
      const el = q(id);
      if (!el) continue;
      /** 🔴 하나라도 밖에 있으면 「탐색이 결론보다 앞」이 그대로 남는다. */
      expect(fold.contains(el), `${id} 가 접힘 밖에 있다`).toBe(true);
    }
  });

  it("A-4 🟢 **삭제가 아니다** — 출처별 머리 문구가 그대로 살아 있다", async () => {
    await mount(base);
    const fold = q("judgement-basis")!;
    /**
     * 🔴 넷을 「추가 검토 후보」 하나로 합치면 **출처 축이 사라진다** —
     *    WU-130 이 「생산자가 늘 때 조용히 엉뚱한 배열에 담긴다」를 막기 위해 세운 축이다.
     */
    expect(fold.textContent).toContain(DOMESTIC_REVIEW_HEADING);
    /** 🟢 후보 «행» 이 실제로 DOM 에 남아 있다 — 닫혀 있을 뿐 지워지지 않았다. */
    expect(container.querySelectorAll('[data-testid="gt-verdict"]').length).toBeGreaterThan(0);
  });

  it("A-5 🔴 조회가 돌지 않았으면 접힘조차 만들지 않는다(빈 테두리 금지)", async () => {
    await mount({ ...base, web: null, supplied: null, overseasAuto: null, reviewedSame: null, notice: null, reviewHistory: null });
    expect(q("judgement-basis")).toBeNull();
  });
});

/* ═══════════════ B. 🔴 소스 앵커 — 마운트 DOM 과 «같이» 둔다 ═══════════════ */

describe("B. 🔴 소스 앵커 (배선 + 금지)", () => {
  it("B-1 🔴 `open` 을 붙이지 않았다", () => {
    const start = PANEL.indexOf('data-testid="judgement-basis"');
    expect(start).toBeGreaterThan(-1);
    /** 🔴 여는 태그 안에 `open` 이 있으면 FAIL — 좌표를 추측하지 않고 그 태그만 자른다. */
    const tag = PANEL.slice(start, PANEL.indexOf(">", start));
    expect(tag).not.toContain("open");
  });

  it("B-2 🔴🔴 접힘이 **하나** 다 — 두 개가 되면 어느 것을 열지 셀러가 모른다", () => {
    expect(PANEL.match(/data-testid="judgement-basis"/g)?.length).toBe(1);
  });

  it("B-3 🟢 라벨 owner 가 하나다(문구를 두 벌로 적지 않는다)", () => {
    expect(PANEL).toContain("JUDGEMENT_BASIS_LABEL");
    /** 🔴 라벨 문자열을 패널에 **직접** 적으면 두 곳이 갈라진다. */
    expect(PANEL).not.toContain("판단 근거 보기");
  });
});
