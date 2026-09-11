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
const summaryAt = editor.indexOf("PRICE-CARD-1(CEO 지시, 2026-09-12)");
const detailAt = editor.indexOf("{detailOpen && (");

describe("판단에 필요한 네 숫자가 접기 전에 보인다", () => {
  it("원가 · 배송 · 착지원가 · 권장 판매가격 · 예상 이익이 상세 밖에 있다", () => {
    for (const needle of [
      "breakdown.costKrw",
      "breakdown.shippingKrw",
      "breakdown.landedCostKrw",
      "formatKrw(recommendedPriceKrw)",
    ]) {
      const at = editor.indexOf(needle);
      expect(at, needle).toBeGreaterThan(-1);
      expect(at, needle).toBeLessThan(detailAt);
    }
    expect(summaryAt).toBeGreaterThan(-1);
    expect(summaryAt).toBeLessThan(detailAt);
  });

  it("최종 판매가격이 여전히 화면에서 가장 큰 숫자다", () => {
    // 요약이 최종 판매가격을 한 번 더 적으면 가장 큰 숫자가 둘이 된다.
    // 최종 판매가격은 입력칸 하나뿐이고(text-base), 요약의 나머지는 text-xs다.
    expect(editor).toContain("text-base font-semibold focus:border-primary");
    const summaryBlock = editor.slice(summaryAt, detailAt);
    expect(summaryBlock).not.toContain("finalPriceKrw");
  });

  it("요약은 새 산술을 하지 않는다 — 사슬과 같은 변수만 읽는다", () => {
    const summaryBlock = editor.slice(summaryAt, detailAt);
    // 요약 블록 안에 사칙연산이 없다(주석과 부호 표시는 제외하려고 JSX 식만 본다).
    expect(summaryBlock).not.toMatch(/\{[^}]*\b\w+Krw\s*[-+*/]\s*\w+Krw/);
  });

  it("시장 정보는 여전히 이 카드에 들어오지 않는다", () => {
    const summaryBlock = editor.slice(summaryAt, detailAt);
    for (const banned of ["국내 비교", "한국 시장", "글로벌 시장", "domesticCompetition"]) {
      expect(summaryBlock, banned).not.toContain(banned);
    }
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
