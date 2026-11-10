import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { attachDerivedKrw } from "../market-intelligence";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-KRW-DERIVED-PIPELINE-WIRING-1 — **화면이 읽는 배열까지 환산값이 간다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 고친 결함: 후보 카드는 `domesticShop.overseasAutoEvidence` 등 **runner 가 만든 배열** 을
 * 읽는데 그 배열들이 `attachDerivedKrw` 를 거치지 않아 전건 `priceKrwDerived === undefined`
 * ⟹ 화면이 **「원화 환산 불가」만** 띄웠다. (MI 반환의 다른 두 배열에만 붙어 있었다)
 *
 * 🔴🔴 **이 파일이 막는 것은 «하나라도 빠지는 것»** 이다 — 배열이 늘거나 하나를 빠뜨리면
 *    그 생산자의 후보만 **조용히** 환산 없이 화면에 선다. 그것이 이번 실패의 본질이다.
 * 🔴 소스 단언은 **주석을 벗기고** 본다(이 저장소에서 아홉 번 걸린 함정).
 */
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const ROUTE = strip(
  readFileSync(path.join(__dirname, "..", "..", "check", "route.ts"), "utf8"),
);
const INTEL = strip(readFileSync(path.join(__dirname, "..", "market-intelligence.ts"), "utf8"));
const RUNNER = strip(readFileSync(path.join(__dirname, "..", "run-domestic-price-check.ts"), "utf8"));

/** 🔴 `PRODUCERS` 와 **같은 집합** 이다 — 둘이 갈리면 그 자체가 결함이다. */
const SIX = [
  "webSearchEvidence",
  "domesticListingEvidence",
  "overseasAutoEvidence",
  "urlCandidateEvidence",
  "geminiEvidence",
  "reviewedSameEvidence",
] as const;

describe("A 🔴🔴 6배열 «전부» 에 환산값이 붙는다 (하나라도 빠지면 FAIL)", () => {
  for (const key of SIX) {
    it(`A-${key} 🔴 \`${key}\` 가 attachDerivedKrw 를 거친다`, () => {
      expect(
        ROUTE,
        `🔴 ${key} 가 환산 부착에서 빠졌다 — 그 생산자의 후보만 조용히 「환산 불가」가 된다`,
      ).toContain(`${key}: attachDerivedKrw(domesticShop.${key}, krwByUrl)`);
    });
  }

  it("A-set 🔴 `PRODUCERS` 목록과 부착 대상이 **같은 집합** 이다", () => {
    /**
     * 🔴 배열이 하나 늘었을 때 **한쪽만** 고치는 것을 막는다. 관측 목록(`PRODUCERS`)에
     *    있는데 부착 대상에 없으면 화면에서 그 후보만 환산이 빈다.
     */
    for (const key of SIX) {
      expect(ROUTE, `🔴 ${key} 가 PRODUCERS 에 없다`).toContain(`domesticShop.${key}`);
    }
    /** 🔴 부착 호출 수가 6 이다 — 더도 덜도 아니다(중복 부착 금지 포함). */
    const calls = ROUTE.match(/attachDerivedKrw\(domesticShop\./g) ?? [];
    expect(calls.length, "🔴 부착 대상 수가 6이 아니다").toBe(SIX.length);
  });
});

describe("B 🔴 환산 owner 는 MI 하나 — route 는 «붙이기만» 한다", () => {
  it("B-1 🔴🔴 route 가 환율을 **새로 조회하지 않는다**", () => {
    expect(ROUTE, "🔴 route 가 환율을 직접 받으면 owner 가 둘이 된다").not.toContain(
      "fetchLiveExchangeRates",
    );
    expect(ROUTE, "🔴 route 가 직접 환산한다").not.toContain("convertToKrw");
  });

  it("B-2 🟢 MI 가 **파생 금액 지도** 를 내보낸다(환율표가 아니다)", () => {
    expect(INTEL).toContain("candidateKrwByUrl: Object.fromEntries(candidateKrwByUrl)");
    /** 🔴 내부 환율표(`candidateRates`)는 응답으로 나가지 않는다(CPO 제약 ①). */
    expect(INTEL).not.toMatch(/\n\s*candidateRates\s*[,:]/);
  });

  it("B-3 🔴 runner 는 **고치지 않았다** — 그 파일은 환율을 모른다", () => {
    expect(RUNNER).not.toContain("attachDerivedKrw");
    expect(RUNNER).not.toContain("fetchLiveExchangeRates");
  });
});

describe("C 🔵 부착 함수의 계약 — 값을 만들지 않는다", () => {
  /**
   * 🔴 `as never` 를 쓰지 않는다 — 그러면 반환 타입이 `never[]` 가 되어 속성 단언이
   *    **타입 오류** 가 난다(1차에 6건 났다). 필요한 칸만 가진 **실제 타입** 을 준다.
   */
  type Row = { discoveredUrl: string; priceAmount: number; priceCurrency: string };
  const row = (url: string): Row => ({
    discoveredUrl: url,
    priceAmount: 37,
    priceCurrency: "GBP",
  });

  it("C-1 🟢 지도에 있으면 숫자, 없으면 `null`(0 이 아니다)", () => {
    const out = attachDerivedKrw(
      [row("https://a/1"), row("https://b/2")],
      new Map([["https://a/1", 64_000]]),
    )!;
    expect(out[0].priceKrwDerived).toBe(64_000);
    expect(out[1].priceKrwDerived).toBeNull();
  });

  it("C-2 🔴 **원본 가격·통화를 덮지 않는다**", () => {
    const out = attachDerivedKrw([row("https://a/1")], new Map([["https://a/1", 64_000]]))!;
    expect(out[0].priceAmount).toBe(37);
    expect(out[0].priceCurrency).toBe("GBP");
  });

  it("C-3 🔴 `null` 입력은 `null` 이다 — 「안 돌았다」를 「후보 0」으로 바꾸지 않는다", () => {
    expect(attachDerivedKrw(null, new Map())).toBeNull();
    expect(attachDerivedKrw(undefined, new Map())).toBeNull();
    expect(attachDerivedKrw([], new Map())).toEqual([]);
  });

  it("C-4 🟢 **행마다 1회** — 같은 행을 두 번 환산하지 않는다", () => {
    /**
     * 🟢 지도를 **읽기만** 하므로 두 번 통과시켜도 값이 변하지 않는다(멱등).
     * 🔴 누적·가산 로직이 들어오면 이 단언이 깨진다.
     */
    const once = attachDerivedKrw([row("https://a/1")], new Map([["https://a/1", 64_000]]))!;
    const twice = attachDerivedKrw(once, new Map([["https://a/1", 64_000]]))!;
    expect(twice[0].priceKrwDerived).toBe(64_000);
  });

  it("C-5 🔴 URL 공백은 다듬어 맞춘다(키 불일치로 조용히 null 이 되지 않게)", () => {
    const out = attachDerivedKrw([row("  https://a/1  ")], new Map([["https://a/1", 64_000]]))!;
    expect(out[0].priceKrwDerived).toBe(64_000);
  });
});
