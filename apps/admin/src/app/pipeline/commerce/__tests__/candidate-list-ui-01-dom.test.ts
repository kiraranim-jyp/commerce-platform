/** @vitest-environment jsdom */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CANDIDATE-LIST-UI-01 DOM — **마운트 DOM 으로만 완료 선언한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 Render PASS ≠ 소스 PASS(헌장 §5). 그리고 「컴포넌트가 마운트됐다」만으로
 *    통과시키지 않는다(CPO PHASE 4) — **입력 데이터 ↔ DOM 표시값** 을 대조한다.
 * 🔴 「Production UI PASS」로 쓰지 않는다 — 실제 따져 화면은 CTO 가 볼 수 없다.
 *
 * 🔴🔴 이 파일이 지키는 것 셋:
 * ```
 * ⒜ 추가 근거 줄이 **기존 판정을 덮지 않는다**(`gt-verdict` 와 **다른 노드**)
 * ⒝ C19 · C20 → 「유사상품」 · C22 → 「검토 필요」 + **이미지 사유가 보인다**
 * ⒞ 사유가 **툴팁이 아니라 보이는 글자** 다(CPO: 이미지 부족을 숨기지 않는다)
 * ```
 * 🔴 `.test.ts` 다 — vitest `include` 가 `*.test.tsx` 를 **수집하지 않는다**(실측).
 *    그래서 JSX 없이 `createElement` 로 마운트한다(기존 마운트 DOM 계약과 같은 방식).
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GeminiTransientCandidates, type GeminiTransientRow } from "../GeminiTransientCandidates";

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const ORIGIN_IMG = "https://img.example/origin.jpg";

/**
 * 🔴 **row 모양을 손으로 지어내지 않는다** — 운영 계약이 쓰는 빌더를 그대로 베꼈다
 *    (이 트랙의 반복 함정 · `core-2ao-r1-screen-dump` 주석 참조).
 * 🟢 C19·C20 의 실제 모양 — 브랜드·품번 일치(식별자 확정) + 색상 충돌을 얹는다.
 */
const row = (over: Partial<GeminiTransientRow>): GeminiTransientRow =>
  ({
    source: "OVERSEAS_AUTO",
    domain: "junioredition.com",
    title: "Bubble Sweatshirt in Conker Stripe by Main Story",
    imageUrl: "https://img.example/cand.jpg",
    soldOut: null,
    discoveredUrl: "https://junioredition.com/products/bubble-conker",
    matchTruth: "EXACT_IDENTIFIER",
    priceTier: "COMPARISON",
    crossSellerVerdict: "PRESUMED_SAME",
    confidence: 1,
    matchReasons: ["근거: 핵심 상품명 bubble/sweatshirt"],
    crossSellerBlockers: [],
    crossSellerConflicts: [],
    priceAmount: null,
    priceCurrency: null,
    priceKrw: null,
    priceStatus: null,
    market: "OVERSEAS",
    basis: null,
    verified: false,
    matchType: null,
    ...over,
  }) as unknown as GeminiTransientRow;

function mount(rows: GeminiTransientRow[], originImageUrl: string | null = ORIGIN_IMG): void {
  act(() => {
    root.render(createElement(GeminiTransientCandidates, { evidence: rows, originImageUrl }));
  });
}
const all = (id: string) => [...container.querySelectorAll(`[data-testid="${id}"]`)];
const text = (id: string) => all(id).map((n) => n.textContent ?? "");

describe("CANDIDATE-LIST-UI-01 DOM — 골든 3건", () => {
  /** 🔴🔴 CPO ③ — C19·C20 은 「유사상품」으로 **안내** 된다(색상 차이). */
  it("D-1 🟢 C19/C20(색상 충돌) → 「유사상품」 · 사유에 색상", () => {
    mount([row({ crossSellerConflicts: ["COLOR"] })]);
    expect(text("gt-display-state")[0]).toContain("유사상품");
    const reason = text("gt-display-reason")[0];
    expect(reason).toContain("핵심 식별정보는 같고");
    expect(reason).toContain("색상");
  });

  /**
   * 🔴🔴 CPO ② — C22 는 SAME 도 SIMILAR 도 **확정하지 않는다**.
   *    실제 모양은 **원본 이미지 O · 후보 이미지 없음** 이다(원본 7장 · 후보 **0장**).
   */
  it("D-2 🔴 C22(후보 이미지 없음) → 「검토 필요」 · **이미지 사유가 보인다**", () => {
    mount([row({ imageUrl: null })]);
    expect(text("gt-display-state")[0]).toContain("검토 필요");
    /** 🔴 이것이 「숨기지 않는다」의 증거다 — 보이는 글자로 단언한다. */
    expect(text("gt-display-reason")[0]).toContain("이미지가 없어");
  });

  it("D-3 🟢 핵심 일치 + 양쪽 이미지 + 차이 없음 → 「동일상품 가능성 높음」", () => {
    mount([row({})]);
    expect(text("gt-display-state")[0]).toContain("동일상품 가능성 높음");
  });
});

describe("CANDIDATE-LIST-UI-01 DOM — 기존 판정을 덮지 않는다", () => {
  /** 🔴🔴 CPO ⒜ 의 핵심 — 두 줄이 **서로 다른 노드** 여야 한다. */
  it("D-4 🔴 `gt-verdict` 와 `gt-display-state` 가 **둘 다** 있고 다른 노드다", () => {
    mount([row({ crossSellerConflicts: ["COLOR"] })]);
    const v = all("gt-verdict");
    const d = all("gt-display-state");
    expect(v).toHaveLength(1);
    expect(d).toHaveLength(1);
    expect(v[0], "🔴 추가 근거 줄이 기존 판정 노드를 덮었다").not.toBe(d[0]);
    expect(v[0].textContent, "🔴 기존 판정 노드가 비었다").toBeTruthy();
  });

  /**
   * 🔴 **CEO GT 를 덮지 않는다** — 이 줄은 시스템 표시이고 사람 판정 칸이 아니다.
   *    `onReview` 를 넘기지 않았으므로 판정 버튼이 **렌더되지 않아야** 한다.
   */
  it("D-5 🔴 사람 판정 입력과 **다른 계층** 이다(onReview 없으면 버튼 0)", () => {
    mount([row({})]);
    expect(all("gt-display-state")).toHaveLength(1);
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  /** 🟢 행마다 독립 계산 — 8 인스턴스가 같은 함수를 쓰므로 한 번 보면 충분하다. */
  it("D-6 🟢 행마다 독립적으로 계산된다(섞이지 않는다)", () => {
    mount([
      row({ discoveredUrl: "https://a.example/1", crossSellerConflicts: ["COLOR"] }),
      row({ discoveredUrl: "https://b.example/2", imageUrl: null }),
    ]);
    const s = text("gt-display-state");
    expect(s).toHaveLength(2);
    expect(s[0]).toContain("유사상품");
    expect(s[1]).toContain("검토 필요");
  });

  /** 🔴 `COLOR_VARIANT`(색조 같고 표기만 다름)는 **차이가 아니다** — WU-044 계약. */
  it("D-7 🔴 색상 «표기» 차이는 유사상품으로 강등하지 않는다", () => {
    mount([row({ crossSellerConflicts: ["COLOR_VARIANT"] })]);
    expect(text("gt-display-state")[0]).toContain("동일상품 가능성 높음");
  });

  it("D-8 🔴 브랜드 확정 불일치 → 「다른 상품일 수 있음」", () => {
    mount([row({ crossSellerBlockers: ["BRAND_MISMATCH"] })]);
    expect(text("gt-display-state")[0]).toContain("다른 상품일 수 있음");
  });
});

describe("CANDIDATE-LIST-UI-01 DOM — 내부 토큰을 노출하지 않는다", () => {
  it("D-9 🔴 추가 근거 두 노드에 영문 내부 토큰이 **없다**", () => {
    mount([row({ crossSellerConflicts: ["COLOR"], crossSellerBlockers: ["BRAND_UNCONFIRMED"] })]);
    const shown = [...text("gt-display-state"), ...text("gt-display-reason")].join(" ");
    for (const banned of [
      "COLOR",
      "BRAND_UNCONFIRMED",
      "PRESUMED_SAME",
      "LIKELY_SIMILAR",
      "NEEDS_REVIEW",
      "EXACT_IDENTIFIER",
    ]) {
      expect(shown, `🔴 내부 토큰 노출: ${banned}`).not.toContain(banned);
    }
  });
});
