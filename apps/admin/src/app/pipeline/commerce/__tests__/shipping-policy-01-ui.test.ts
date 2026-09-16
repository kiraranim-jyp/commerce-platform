import { describe, expect, it } from "vitest";
import { DEFAULT_PRICE_BREAKDOWN_INPUT, resolveOverseasShippingBasis } from "@commerce/pricing";
import { PRICE_LINE_LABEL } from "../price-hierarchy";
import { readSourceAt, stripComments } from "./source-text";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * SHIPPING-POLICY-01 ②(CEO 지시, 2026-09-16) — **화면이 기본값과 실제 배송비를
 * 구분해서 말한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO §7 그대로:
 *   실제 배송비를 «알 때»   그 값을 쓴다
 *   «모를 때»              기본값 12,000원을 쓰되 🔴 «실제 배송비라고 표시하면 안 된다»
 *                          화면이 「기본 해외물류비 적용」 처럼 구분할 수 있어야 한다
 *
 * ── 왜 소스 텍스트를 보는가 ──────────────────────────────────────────────
 * 이 폴더의 다른 배치 테스트(price-hierarchy-ui · price-display-layout)와 같은
 * 이유다. "국제배송비 줄 옆에 근거가 붙어 있는가"는 계산 규칙이 아니라 배치
 * 규칙이고, 깨지는 방식은 늘 같다 — 누군가 "줄이 길어 보인다"며 그 한 줄을
 * 지운다. 문구 자체의 내용은 packages/pricing 의 순수 함수 테스트
 * (shipping-policy-01.test.ts)가 따로 고정한다.
 */
const detail = stripComments(readSourceAt(new URL("../PriceCalculationDetail.tsx", import.meta.url)));
const marketIntelligence = stripComments(
  readSourceAt(new URL("../../../api/price-history/_lib/market-intelligence.ts", import.meta.url)),
);

describe("SHIPPING-POLICY-01 ②: 국제배송비 줄이 «무엇 위에 서 있는지»를 말한다", () => {
  it("국제배송비 줄 자체는 그대로 있다 — 구분을 붙이려고 줄을 바꾸지 않았다", () => {
    expect(detail).toContain(`<Row label={PRICE_LINE_LABEL.INTERNATIONAL_SHIPPING}>`);
    expect(detail).toContain("onCommit={(n) => commitBreakdown({ shippingKrw: n })}");
    expect(PRICE_LINE_LABEL.INTERNATIONAL_SHIPPING).toBe("국제배송비");
  });

  it("그 줄 바로 아래에서 기본값/판매자 입력을 구분한다", () => {
    const rowAt = detail.indexOf("<Row label={PRICE_LINE_LABEL.INTERNATIONAL_SHIPPING}>");
    const basisAt = detail.indexOf("resolveOverseasShippingBasis(draftInput.shippingKrw)");
    expect(rowAt, "국제배송비 줄을 찾지 못했다").toBeGreaterThan(-1);
    expect(basisAt, "기본값/실제 구분이 사라졌다").toBeGreaterThan(rowAt);
    // 착지원가 줄보다는 위에 있어야 «그 줄의 근거»로 읽힌다.
    expect(basisAt).toBeLessThan(detail.indexOf("PRICE_LINE_LABEL.LANDED_COST"));
  });

  it("🔴 문구를 화면이 직접 쓰지 않는다 — 판단은 packages/pricing 한 곳에만 있다", () => {
    // 같은 문장을 화면이 따로 적어 두면, 규칙이 바뀌었을 때 두 곳이 갈린다.
    expect(detail).not.toContain("기본 해외물류비");
    expect(detail).not.toContain("실제 배송비");
  });

  it("🔴 MI 경로도 같은 함수로 근거를 적는다 — \"seller_default\" 고정 문자열이 사라졌다", () => {
    expect(marketIntelligence).toContain("resolveOverseasShippingBasis(cost.shippingKrw)");
    // status 는 손대지 않았다. 올리면 dataCompleteness·verdict 가 따라 움직인다.
    expect(marketIntelligence).toContain(`status: "estimated"`);
  });
});

describe("SHIPPING-POLICY-01 ②: 두 상태가 실제로 다른 문장을 낸다", () => {
  it("기본값 ₩12,000 은 «실제 배송비»라고 말하지 않는다", () => {
    const label = resolveOverseasShippingBasis(DEFAULT_PRICE_BREAKDOWN_INPUT.shippingKrw).label;
    expect(label).toContain("기본 해외물류비");
    expect(label).toContain("아닙니다");
  });

  it("판매자가 넣은 값과 기본값의 문장이 서로 다르다", () => {
    const a = resolveOverseasShippingBasis(DEFAULT_PRICE_BREAKDOWN_INPUT.shippingKrw).label;
    const b = resolveOverseasShippingBasis(23000).label;
    expect(a).not.toBe(b);
  });
});
