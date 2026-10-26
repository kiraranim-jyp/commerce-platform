/** @vitest-environment jsdom */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2AO-R1 — **CEO 가 볼 화면을 «마운트 DOM» 으로 찍는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 WU 는 **스크린샷을 추측해서 틀렸다** — CORE-2AO 가 `OVERSEAS_REFERENCE_TITLE`
 *    을 고치고 「해외 제목이 바뀌었다」고 보고했는데, 실제 화면의 주인은
 *    `PRICE_GUIDE_TITLE.OVERSEAS` 였다(같은 슬롯의 **다른 상태**). CEO 캡처가 그것을
 *    잡았다. 🔴 그래서 이번에는 **배포 전에 화면 글자를 직접 찍어** 확인한다.
 *
 * 🔴 **여기서 판정·집계·가격을 만들지 않는다** — 운영 컴포넌트를 B226AC009 모양의
 *    입력으로 마운트하고 **텍스트를 읽기만** 한다(네트워크 0 · DB 0).
 * 🔴 「Production UI PASS」로 쓰지 않는다 — 실제 따져 화면은 CTO 가 볼 수 없다(§12).
 *    이것은 **마운트 DOM 축** 이고 최종 확인은 CEO 1회다.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";
import type { OverseasPriceSummary } from "../overseas-reference";

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

/**
 * 🔴 B226AC009 실측 모양 — 해외 SAME 4(GBP 37 ×2 · USD 58 ×2) · 국내 SAME 0 + 참고가격.
 * 🔴🔴 **row 모양을 손으로 지어내지 않는다** — 1차에 그렇게 했다가 「후보 1곳」으로
 *    뭉쳐 **거짓 FAIL** 이 났다(`matchTruth`/`crossSellerVerdict` 누락 + 같은 URL).
 *    🟢 운영 계약(`wu-146`)이 쓰는 빌더를 **그대로** 베꼈다(이 트랙의 반복 함정).
 */
const row = (over: Partial<GeminiTransientRow>): GeminiTransientRow =>
  ({
    source: "OVERSEAS_AUTO",
    domain: "a.example",
    title: "Hug Hairy Monster T-Shirt",
    imageUrl: null,
    soldOut: null,
    discoveredUrl: "https://a.example/p/1",
    matchTruth: "EXACT_IDENTIFIER",
    priceTier: "EXACT",
    crossSellerVerdict: "SAME",
    confidence: 1,
    matchReasons: [],
    crossSellerBlockers: [],
    crossSellerConflicts: [],
    priceAmount: null,
    priceCurrency: null,
    priceStatus: "VERIFIED_CURRENT",
    market: "OVERSEAS",
    basis: "TLD",
    ...over,
  }) as GeminiTransientRow;

const ROWS: GeminiTransientRow[] = [
  row({ domain: "junioredition.com", discoveredUrl: "https://junioredition.com/p/1", soldOut: false, priceAmount: 37, priceCurrency: "GBP" }),
  row({ domain: "scoutandcokids.com", discoveredUrl: "https://scoutandcokids.com/p/2", soldOut: false, priceAmount: 37, priceCurrency: "GBP" }),
  row({ domain: "www.tinyapple.net", discoveredUrl: "https://www.tinyapple.net/p/3", priceAmount: 58, priceCurrency: "USD" }),
  row({ domain: "global.trenbe.com", discoveredUrl: "https://global.trenbe.com/p/4", priceAmount: 58, priceCurrency: "USD" }),
];

/** 🇰🇷 국내는 SAME 0 이고 **참고가격만** 있다(그 금액 owner 가 🇰🇷 블록 하나여야 한다). */
const KR_REF: OverseasPriceSummary = {
  count: 1,
  byCurrency: { KRW: { lowestAmount: 88000, highestAmount: 88000, count: 1 } },
  byMarket: { KR: 1 },
  byPriceTier: { COMPARISON: 1 },
} as unknown as OverseasPriceSummary;

function mount(): void {
  act(() => {
    root.render(
      createElement(MarketPriceComparison, {
        rows: ROWS,
        domesticReference: KR_REF,
      } as never),
    );
  });
}

/** 🔴 닫힌 `details` 를 지운다 = **셀러가 «펼치지 않고» 보는 것**(접힘은 1차가 아니다). */
function firstScreen(): string {
  const clone = container.cloneNode(true) as HTMLElement;
  for (const d of [...clone.querySelectorAll("details")]) if (!d.hasAttribute("open")) d.remove();
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
}

describe("CORE-2AO-R1 — 배포 전 화면 실측(마운트 DOM)", () => {
  it("🟢🟢 CEO 가 FAIL 로 지목한 셋이 전부 사라졌다", () => {
    mount();
    const first = firstScreen();
    // eslint-disable-next-line no-console
    console.log("\n═══ 1차 화면(접힘 제외) ═══\n" + first + "\n═══════════════════════════\n");

    /** ① 🔴 해외 제목에서 「동일상품」 주장이 사라졌다. */
    expect(first, "🔴 해외 제목에 「동일상품」이 남아 있다").not.toContain("해외 동일상품");
    expect(first, "🔴 「해외 최저 소싱가」가 뜨지 않는다").toContain("해외 최저 소싱가");

    /** ② 🔴🔴 같은 금액이 두 군데 뜨지 않는다 — CEO 가 정한 FAIL 조건 그대로. */
    for (const amount of ["88,000", "GBP 37", "USD 58"]) {
      expect(
        first.split(amount).length - 1,
        `🔴 같은 금액이 1차 화면에 두 번 이상 떴다: ${amount}`,
      ).toBe(1);
    }
    /**
     * 🔴🔴 **문장도 두 번 뜨지 않는다.** 1차 구현에서 「통화가 여러 개라 …」가
     *    🌎 블록(`headlineLabel`)과 「💡 판매 판단」에 **두 번** 떴고 이 단언이 잡았다.
     *    🟢 금액만 보던 ②로는 못 잡는다 — 그래서 **문장 축을 따로** 둔다.
     */
    for (const sentence of [
      "통화가 여러 개라 하나의 최저가로 합치지 않습니다",
      "국내 참고가격이 확인됐습니다",
    ]) {
      expect(
        first.split(sentence).length - 1,
        `🔴 같은 문장이 1차 화면에 두 번 이상 떴다: ${sentence}`,
      ).toBeLessThanOrEqual(1);
    }

    /** ③ 🔴 근거 설명이 접혀 결론이 바로 읽힌다. */
    const basis = container.querySelector('[data-testid="price-basis"]') as HTMLElement;
    expect(basis.tagName.toLowerCase()).toBe("details");
    expect(basis.hasAttribute("open")).toBe(false);
  });

  it("🟢 그러면서 **잃은 것이 없다** — 금액·결론·근거가 전부 살아 있다", () => {
    mount();
    const first = firstScreen();
    /** 🟢 금액은 블록에 **그대로** 있다(결론에서 뺀 것이 「사라졌다」가 되면 안 된다). */
    expect(first).toContain("KRW 88,000");
    expect(first).toContain("GBP 37");
    expect(first).toContain("USD 58");
    /** 🟢 근거 문장들은 **접혔을 뿐** 이고 DOM 에 전부 남아 있다(삭제 0). */
    const all = (container.textContent ?? "").replace(/\s+/g, " ");
    for (const kept of [
      "국내 참고가격이 확인됐습니다",
      "판매처 상세 페이지에서 확인한",
      "동일상품으로 확정된 국내 판매처는 없습니다",
      "배송비·관부가세·수수료·목표마진은 별도로 반영해야",
      "수익성 판단 보류",
      "동일상품 판정은 그 판단을 위한 중간 단계입니다",
    ]) {
      expect(all, `🔴 상세로 «옮긴» 문장이 아예 사라졌다: ${kept}`).toContain(kept);
    }
    /**
     * 🔴 추천 판매가·환산은 **여전히 0** 이다(이 WU 가 연 축이 아니다).
     *
     * 🔵🔵 **CORE-NEXT STEP 4 — 「권장 판매가격」만 방향이 뒤집혔다**(CPO 2026-10-26):
     *    그 값(A = `breakdown.suggestedPriceKrw`)은 **prop 으로 넘어올 때만** 선다.
     *    이 마운트는 A 를 **넘기지 않으므로** 여기서는 여전히 **0 이어야 한다** —
     *    즉 이 단언은 「영역이 **스스로** 권장가를 만들지 않는다」를 계속 문다.
     *    🟢 A 가 있을 때의 모양은 `core-next-step4-recommended-price` 가 담당한다.
     */
    for (const bad of ["추천 판매가", "적정 판매가", "약 ₩"]) {
      expect(all, `🔴 금지 축이 열렸다: ${bad}`).not.toContain(bad);
    }
    expect(all, "🔴 영역이 스스로 권장 판매가격을 만들었다").not.toContain("권장 판매가");
    expect(all, "🔴 A 를 넘기지 않았는데 원화 금액이 생겼다").not.toMatch(/[₩€$£¥]/);
  });
});

/* ══════════ 🔴🔴🔴 CORE-2AO-R2 — **첫 화면 = 판단 / 상세 = 근거** ══════════ */

describe("CORE-2AO-R2 — 첫 화면에 «긴 설명» 이 남아 있지 않다", () => {
  /**
   * 🔴 CPO(2026-10-26): 「셀러가 첫 화면에서 알아야 할 건 **3개뿐** 이다.
   *    나머지는 전부 `＋ 상세정보 보기` 안으로」. 🔴 그 목록을 **글자로** 문다 —
   *    「짧아졌다」 같은 주관적 기준을 쓰면 다음 사람이 다시 늘린다.
   */
  const MUST_NOT_BE_ON_FIRST_SCREEN = [
    /** ① 동일상품 여부에 대한 긴 설명 */
    "동일상품 확인 0곳",
    "동일상품으로 확정된 국내 판매처는 없습니다",
    /** ② 가격 판단 기준 설명 */
    "판매처 상세 페이지에서 확인한",
    /** ③ 통화가 여러 개라는 설명 */
    "통화가 여러 개라",
    /** ④ 배송비/관부가세/수수료/마진 */
    "배송비·관부가세·수수료·목표마진",
    "수익성 판단 보류",
    /** ⑤ MI 분석 문장 */
    "동일상품 판정은 그 판단을 위한 중간 단계입니다",
    "이 목록은 동일상품으로",
    /** ⑥ 저장 범위·출처 설명 */
    "이번 확인에만 쓰이고 저장되지 않습니다",
    /** ⑦ 표본 설명 */
    "시장 평균가가 아닙니다",
  ];

  it("🔴🔴 R2-1 CPO 가 지목한 긴 설명이 **1차에 하나도 없다**", () => {
    mount();
    const first = firstScreen();
    for (const bad of MUST_NOT_BE_ON_FIRST_SCREEN) {
      expect(first, `🔴 첫 화면에 긴 설명이 남았다: ${bad}`).not.toContain(bad);
    }
  });

  it("🟢🟢 R2-2 1차는 **세 블록** 이다 — 국내 · 해외 · 판매가격 가이드", () => {
    mount();
    for (const id of ["market-block-domestic", "market-block-overseas", "market-next-step"]) {
      expect(container.querySelector(`[data-testid="${id}"]`), `🔴 1차 블록이 없다: ${id}`).not.toBeNull();
    }
    /** 🔴 **설명문은 최대 1줄** 이다(CPO 명시). */
    expect(container.querySelectorAll('[data-testid="market-next-step-line"]').length).toBe(1);
  });

  it("🔴🔴 R2-3 **첫 화면 글자 수가 상세보다 훨씬 적다** — 「판단 화면」의 정의다", () => {
    mount();
    const first = firstScreen().length;
    const whole = (container.textContent ?? "").replace(/\s+/g, " ").trim().length;
    /**
     * 🔴 절대값으로 재지 않는다(상품마다 다르다) — **비율** 로 잠근다.
     *    🟢 실측 기준 1차는 전체의 **10% 대** 다. 25% 를 넘으면 1차가 다시 설명을
     *       끌어안기 시작한 것이고, 그것이 이 WU 가 되돌리려는 상태다.
     */
    expect(first / whole, `🔴 첫 화면이 다시 길어졌다(${first}/${whole})`).toBeLessThan(0.25);
  });

  it("🟢 R2-4 상세는 **접혀 있다**(`open` 금지) 그리고 근거를 전부 들고 있다", () => {
    mount();
    const fold = container.querySelector('[data-testid="price-detail-fold"]') as HTMLElement;
    expect(fold, "🔴 `＋ 상세정보 보기` 가 없다").not.toBeNull();
    expect(fold.tagName.toLowerCase()).toBe("details");
    expect(fold.hasAttribute("open"), "🔴 상세가 펼쳐져 있다").toBe(false);
    const inside = (fold.textContent ?? "").replace(/\s+/g, " ");
    for (const kept of MUST_NOT_BE_ON_FIRST_SCREEN) {
      expect(inside, `🔴 1차에서 뺐는데 상세에도 없다(= 삭제됐다): ${kept}`).toContain(kept);
    }
  });

  /**
   * 🔴🔴 **1차 단언이 틀렸고 CPO 스펙이 맞았다. 적는다.**
   *    처음엔 「상세에 금액이 **하나도** 없어야 한다」로 썼는데, CPO 가 상세에
   *    요구한 목록이 **「판매처 · 원통화 가격 · 통화별 최저가」** 다 ⟹ 상세는
   *    금액을 **가져야** 한다(그것이 「근거」다).
   * 🟢 그래서 진짜 지켜야 할 성질로 바꾼다 — **집계 금액을 두 층에서 그리지 않는다**
   *    (1차 요약 블록 ↔ 상세 «근거 블록»). 판매처별 가격 표는 그 축이 아니다.
   */
  it("🔴 R2-5 **집계 금액** 은 1차에만 있다 — 상세 근거 블록이 또 그리지 않는다", () => {
    mount();
    const detail = container.querySelector('[data-testid="market-detail-blocks"]') as HTMLElement;
    const inside = (detail.textContent ?? "").replace(/\s+/g, " ");
    for (const amount of ["KRW 88,000", "GBP 37 · USD 58"]) {
      expect(inside, `🔴 상세 근거 블록이 집계 금액을 또 그린다: ${amount}`).not.toContain(amount);
    }
    /** 🟢 반대로 **판매처별 근거** 는 상세에 있어야 한다(CPO 가 요구한 목록). */
    const fold = container.querySelector('[data-testid="price-detail-fold"]') as HTMLElement;
    expect((fold.textContent ?? "").replace(/\s+/g, " ")).toContain("GBP 37");
  });
});
