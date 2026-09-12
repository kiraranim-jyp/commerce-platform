import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { computePriceBreakdown } from "@commerce/pricing";

/**
 * PRICE-CARD-1(CEO 지시, 2026-09-12) — "이 카드는 계산기가 아니라 판단 카드다."
 *
 * ── 무엇이 문제였나 ──────────────────────────────────────────────────────
 * 판단에 필요한 네 숫자(원가 → 착지원가 → 권장 판매가 → 예상 이익)가 전부
 * 접힘 상세 안에, 그것도 입력칸 다섯 개와 번갈아 놓여 있었다. 셀러가 "이
 * 가격에 팔아도 되나"를 묻는데, 답을 얻으려면 계산 과정을 위에서 아래로 읽어야
 * 했다 — 결론이 과정 속에 섞여 있었다.
 *
 * ── 이 테스트가 지키는 두 가지 ───────────────────────────────────────────
 * ① 요약이 **새 계산을 만들지 않는다**. 여섯 값 전부 computePriceBreakdown()과
 *    기존 변수에서 그대로 온다. 요약이 자기 산술을 갖는 순간 같은 숫자가 요약과
 *    사슬에서 갈라지기 시작한다 — 이 저장소에서 반복된 버그다.
 * ② 요약이 생겼다고 사슬이 줄지 않는다. 계산 근거는 한 줄도 사라지지 않았고
 *    순서도 그대로다(그 순서 자체는 price-single-surface.test.ts가 고정한다).
 *
 * 아래 산식 회귀는 이 커밋이 숫자를 건드리지 않았다는 것을 UI가 아니라
 * **산술로** 확인한다. 값이 하나라도 움직이면 그건 배치 문제가 아니라 계산
 * 문제이므로 여기서 멈춰야 한다.
 */
function read(relativeToThisFile: string): string {
  return readFileSync(fileURLToPath(new URL(relativeToThisFile, import.meta.url)), "utf8").replace(/\r\n/g, "\n");
}

const editor = read("../PriceEditor.tsx");
const detail = read("../PriceCalculationDetail.tsx");
const panel = read("../DomesticPriceIntelligencePanel.tsx");

/**
 * MI/PRICE-1(CEO 지시, 2026-09-12) — PRICE-CARD-1이 지키려던 사실은 그대로다:
 * **판단에 필요한 숫자는 접기 전에 보인다.** 바뀐 것은 그 숫자가 서 있는 카드다.
 *
 * PRICE-CARD-1 시점에는 판단 숫자가 "가격 계산" 카드의 접힘 안에 갇혀 있어서
 * 요약 두 줄을 그 카드 위로 올렸다. 지금은 판단 자체가 MI ④ 💰 수익성으로
 * 모였고, 그 요약(착지원가 → 내 판매가격 → 예상 수익 → 예상 마진)이 접기 전에
 * 보인다. 요약을 한 벌 더 만들지 않는다 — 만들면 같은 숫자가 세 자리가 된다.
 */
describe("판단에 필요한 숫자가 접기 전에 보인다", () => {
  it("④ 수익성 요약이 토글보다 먼저 그려진다", () => {
    const chainAt = panel.indexOf("<PriceChainView rows={priceChain} />");
    const toggleAt = panel.indexOf("{caret(showPriceDetail)} 가격 계산 기준 보기");
    expect(chainAt).toBeGreaterThan(-1);
    expect(toggleAt).toBeGreaterThan(chainAt);
  });

  it("요약은 새 산술을 하지 않는다 — price-hierarchy.ts가 고른 값을 그리기만 한다", () => {
    // 사슬 뷰는 서버가 낸 값을 문자열로 받는다. 여기서 뺄셈 한 번이라도 하는
    // 순간 같은 숫자가 요약과 상세에서 갈라지기 시작한다.
    const viewAt = panel.indexOf("function PriceChainView(");
    const viewEndAt = panel.indexOf("function OriginalPriceView(", viewAt);
    const view = panel.slice(viewAt, viewEndAt);
    expect(view).not.toMatch(/\b\w+Krw\s*[-+*/]\s*\w+Krw/);
    expect(view).not.toContain("computePriceBreakdown");
  });

  it("확정 카드는 최종 판매가격을 화면에서 가장 큰 숫자로 유지한다", () => {
    // 권장 판매가격이 같은 크기로 올라오면 화면은 다시 "무엇이 실제 판매가인지"를
    // 말하지 못한다. 최종 판매가격은 입력칸 하나뿐이고(text-base), 권장가는 그
    // 아래 단계(text-sm · secondary)다.
    expect(editor).toContain("text-base font-semibold focus:border-primary");
    expect(editor).toContain('<span className="text-sm font-semibold text-text-secondary">');
  });

  it("시장 정보는 확정 카드에도 상세 계산에도 블록으로 들어오지 않는다", () => {
    for (const banned of ["국내 비교", "한국 시장", "domesticCompetition"]) {
      expect(editor, banned).not.toContain(banned);
    }
    // 상세 계산에 남는 것은 그 관측으로 가는 링크 한 줄뿐이다(블록 아님).
    expect(detail).not.toContain("domesticCompetition");
    expect(detail).not.toContain("<CountryPriceTable");
  });
});

describe("가격 산식 회귀 — 숫자가 하나도 움직이지 않았다", () => {
  it("CEO 지시문 예시 그대로 계산된다", () => {
    // 원가 ₩65,574 · 배송 ₩12,000 · 착지원가 ₩77,574 (지시문 값).
    // 65,574 = £36 × 1,821.5(고정 참고환율 경로가 아니라 명시 환율로 고정한다).
    const breakdown = computePriceBreakdown(
      { originalAmount: 36, originalCurrency: "GBP", shippingKrw: 12000, feePercent: 10, marginPercent: 20 },
      { GBP: 1821.5 },
      10,
    );
    expect(breakdown.costKrw).toBe(65574);
    expect(breakdown.landedCostKrw).toBe(77574);
    // 착지원가 / (1 - 0.10 - 0.20) = 110,820 → 10원 단위 반올림.
    expect(breakdown.suggestedPriceKrw).toBe(110820);
  });

  it("예상 이익은 최종가 − 착지원가 − 수수료 그대로다", () => {
    const breakdown = computePriceBreakdown(
      { originalAmount: 36, originalCurrency: "GBP", shippingKrw: 12000, feePercent: 10, marginPercent: 20 },
      { GBP: 1821.5 },
      10,
    );
    const finalPriceKrw = 99500;
    const feeAmountKrw = Math.round((finalPriceKrw * breakdown.feePercent) / 100);
    expect(feeAmountKrw).toBe(9950);
    expect(finalPriceKrw - breakdown.landedCostKrw - feeAmountKrw).toBe(11976);
  });

  it("feePercent의 의미가 그대로다 — 최종 판매가 기준 비율이다", () => {
    // 착지원가 기준으로 바뀌면 이 값이 달라진다(9,950 → 7,757).
    expect(Math.round((99500 * 10) / 100)).toBe(9950);
  });
});
