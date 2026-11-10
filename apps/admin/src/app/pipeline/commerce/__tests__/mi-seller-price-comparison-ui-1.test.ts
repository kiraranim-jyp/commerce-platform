import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  priceText,
  priceKrwText,
  PRICE_KRW_UNAVAILABLE_TEXT,
  type GeminiTransientRow,
} from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-SELLER-PRICE-COMPARISON-UI-1 B-1 — **후보 행의 원화 환산이 «화면에» 뜬다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 고친 결함: 서버는 후보마다 원화 파생값을 실어 보냈고 이 파일의 타입에도 칸이
 * **있었는데**, 그리는 코드가 **없어서** 화면에는 `GBP 37` 만 떴다.
 * 🔴 같은 UI 를 그리는 표면이 둘(`gt-price` ↔ `mi-candidate-price`)인데 다른 쪽만
 *    고쳤던 것이 원인이다 ⟹ **표면을 둘 다 본다.**
 *
 * 🔴 소스 단언은 **주석을 벗기고** 본다(이 저장소에서 아홉 번 걸린 함정).
 */
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const CARD = strip(
  readFileSync(path.join(__dirname, "..", "GeminiTransientCandidates.tsx"), "utf8"),
);
const PANEL = strip(
  readFileSync(path.join(__dirname, "..", "MarketPriceComparison.tsx"), "utf8"),
);

const row = (over: Partial<GeminiTransientRow>): GeminiTransientRow =>
  ({ domain: "d.example", discoveredUrl: "https://d.example/1", ...over }) as GeminiTransientRow;

describe("A 🔵 원화 줄은 «서버값» 으로만 선다", () => {
  it("A-1 🟢 외화 후보 — 원본은 그대로, 원화는 «추가»", () => {
    const r = row({ priceAmount: 37, priceCurrency: "GBP", priceKrwDerived: 64_000 });
    /** 🔴 원본 줄이 한 글자도 바뀌지 않는다(통화 ISO 그대로). */
    expect(priceText(r)).toBe("GBP 37");
    expect(priceKrwText(r)).toBe("약 ₩64,000");
  });

  it("A-2 🔴🔴 서버가 환산하지 못했으면 **금액을 만들지 않는다**", () => {
    const r = row({ priceAmount: 2980, priceCurrency: "TWD", priceKrwDerived: null });
    expect(priceKrwText(r)).toBe(PRICE_KRW_UNAVAILABLE_TEXT);
    /** 🔴 0 원·추정 금액이 들어올 자리가 없다. */
    expect(priceKrwText(r)).not.toMatch(/\d/);
  });

  it("A-3 🔴 KRW 후보는 **중복 표시하지 않는다**", () => {
    const r = row({ priceAmount: 88_000, priceCurrency: "KRW", priceKrwDerived: 88_000 });
    expect(priceKrwText(r)).toBeNull();
  });

  it("A-4 🔴 가격이 없으면 환산을 말하지 않는다", () => {
    expect(priceKrwText(row({ priceAmount: null, priceCurrency: "GBP" }))).toBeNull();
    expect(priceKrwText(row({ priceAmount: 37, priceCurrency: null }))).toBeNull();
  });

  it("A-5 🔴 서버값을 **그대로** 쓴다 — 자체 환율 계산이 없다", () => {
    /**
     * 🔴 같은 입력에 서버값만 바꾸면 결과가 **그 값만큼** 바뀐다 ⟹ UI 가 스스로
     *    계산하면(예: amount × 상수) 이 단언이 깨진다.
     */
    const a = priceKrwText(row({ priceAmount: 37, priceCurrency: "GBP", priceKrwDerived: 1 }));
    const b = priceKrwText(row({ priceAmount: 37, priceCurrency: "GBP", priceKrwDerived: 2 }));
    expect(a).toBe("약 ₩1");
    expect(b).toBe("약 ₩2");
  });
});

describe("B 🔴🔴 UI 는 환산하지 않는다 — owner 는 서버 하나다", () => {
  it("B-1 🔴 후보 카드 파일에 환산 함수 이름이 **없다**(mi-022 계약과 같은 축)", () => {
    expect(CARD).not.toContain("convertToKrw");
    expect(CARD).not.toContain("exchangeRate");
    /** 🔴 환율표를 직접 들거나 숫자에 곱하지 않는다. */
    expect(CARD).not.toContain("FIXED_RATES_TO_KRW");
    expect(CARD).not.toMatch(/priceAmount\s*\*\s*\d/);
  });

  it("B-2 🟢 서버 파생 칸을 **실제로 읽는다**(타입 선언만 있으면 FAIL)", () => {
    /**
     * 🔴🔴 이것이 이 WU 가 고친 바로 그 구멍이다 — 전엔 `priceKrwDerived` 가
     *    **타입에만** 있었고 읽는 코드가 0 이라 화면에 뜨지 않았다.
     */
    expect(CARD, "🔴 서버 파생값을 읽지 않는다").toContain("row.priceKrwDerived");
    expect(CARD, "🔴 화면에 그리는 자리가 없다").toContain('data-testid="gt-price-krw"');
  });
});

describe("C 🔴 표면이 «둘» 이다 — 한 장만 고치지 않는다", () => {
  it("C-1 🟢 다른 표면도 서버 파생값을 읽는다(이미 연결돼 있다)", () => {
    expect(PANEL).toContain("derivedKrwOf(row)");
    expect(PANEL).toContain("row.priceKrwDerived ?? null");
  });

  it("C-2 🔴 두 표면 **모두** 자체 환산 호출이 0건이다", () => {
    expect(CARD).not.toContain("convertToKrwStrict(");
    expect(PANEL).not.toContain("convertToKrwStrict(");
  });
});
