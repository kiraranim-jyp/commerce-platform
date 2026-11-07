import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expectedCurrencyFor, supportsMarketCountryProbe, withSourceMarketCountry } from "../source-currency-policy";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 **시장 관측의 통화는 «사이트 환산» 이 되어서는 안 된다** (PHASE 2 · 2026-11-07)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **운영 코드 변경 0.** 이 파일은 **이미 있는 설계가 올바르다는 것** 을 잠근다.
 * 🔴 네트워크 0 — `fetchHtmlDirect` 를 mock 한다(fixture 는 기존 것 재사용 · 신규 0).
 *
 * ── 왜 이 계약이 필요한가 ───────────────────────────────────────────────────
 * `docs/global-market-local-currency-probe.md`(a0b3c08)가 **완료 조건** 으로
 * 「JP 행이 실제 JPY 관측으로 표시된다」를 적어 뒀다. 그 문서를 읽은 다음 사람은
 * `withSourceMarketCountry` 가 `currency=EUR` 을 강제하는 것을 **고쳐야 할 결함**
 * 으로 읽는다. 🔴 **그 수정은 문서 자신이 절대 금지한 행위가 된다.**
 *
 * ── 라이브 실측이 그것을 증명했다(2026-11-07 · 상품 430753) ──────────────────
 * ```
 *            EUR      JPY        USD
 *   JP        54     10078        63
 *   KR        49      9145        57
 *   US        53      9892        62
 *   JPY/EUR   JP 186.630 · KR 186.633 · US 186.642   편차 **0.006%**
 *   USD/EUR   JP 1.167   · KR 1.163   · US 1.170     편차 0.563%
 *   🔴 단일 환율 구간이 **비어 있지 않다** — JPY [186.6321, 186.6389] · USD [1.1604, 1.1735]
 *      ⟹ **하나의 환율표가 격자 전부를 설명한다**(USD 편차는 정수 반올림 잡음이다)
 * ```
 * 🔴🔴 그러므로 Smallable 의 `?currency=JPY` 는 **일본 시장이 정한 엔화 가격이 아니라
 *    사이트가 자기 환율로 EUR 를 바꾼 값** 이다. 그것을 저장하면 그 문서의
 *    「❌ €81 → 환율 → ¥13,365 로 표시하거나 저장」과 **같은 산술** 이 된다 —
 *    환산 주체만 우리에서 사이트로 바뀐다.
 * 🟢 그리고 운영 코드가 **처음부터 그렇게 적어 뒀다**(`smallable-market-probe.ts:28-30`).
 *
 * 🟢 **현지통화가 되는 경로는 따로 있고 이미 작동한다** — 사이트가 시장별 통화를
 *    «선언» 하는 Shopify Markets 축이다(운영 DB 실측 · `MARKET_PROBE` 행):
 *    `louisemisha.com` en-jp **JPY** · en-au AUD · en-ca CAD · en-gb GBP · en-us USD(6통화) ·
 *    `bobochoses.com` en-us **USD**(2통화) ↔ `www.smallable.com` **1통화(EUR)**.
 *    ⟹ 🔴 「전부 EUR 이다」는 **Smallable 한 판매처의 성질** 이고 제품 전체의 결함이 아니다.
 */

const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf-8");

const URL_430651 =
  "https://www.smallable.com/en/product/b.c.-organic-cotton-zipped-sweatshirt-navy-blue-bobo-choses-430651";

vi.mock("../utils/direct-html-fetch", () => ({
  fetchHtmlDirect: vi.fn(),
}));

/** mock 을 세운 **뒤** 에 운영 모듈을 불러온다(hoisting 때문에 동적 import 다). */
async function probeWith(html: string, finalUrl: string) {
  const { fetchHtmlDirect } = await import("../utils/direct-html-fetch");
  vi.mocked(fetchHtmlDirect).mockResolvedValue({ status: 200, html, finalUrl });
  const { probeSmallableMarkets } = await import("../smallable-market-probe");
  return probeSmallableMarkets(URL_430651, ["FR", "US", "JP"]); // KR 하나만 찌른다
}

afterEach(() => vi.clearAllMocks());

describe("A. 시장 probe 는 «국가별 통화» 를 요청하지 않는다 — §F 하드코딩 금지", () => {
  it("A-1 네 후보 국가 전부에서 통화가 등록된 원본 통화 하나다", () => {
    const expected = expectedCurrencyFor(URL_430651);
    expect(expected).toBe("EUR");
    for (const country of ["FR", "KR", "US", "JP"]) {
      const u = new URL(withSourceMarketCountry(URL_430651, country)!);
      expect(u.searchParams.get("country")).toBe(country);
      // 🔴 국가가 바뀌어도 통화는 **한 값** 이다. 국가별 통화를 만들면 그 값은
      //    사이트 환산이 되고, 그것은 a0b3c08 이 금지한 저장이 된다.
      expect(u.searchParams.get("currency")).toBe(expected);
    }
  });

  it("A-2 통화는 «한 출처» 에서 온다 — probe URL 과 expectedCurrencyFor 가 갈라질 수 없다", () => {
    // 🔴 두 벌이 되면 관문 ③(응답 통화 재확인)이 자기 자신을 검사하지 못한다.
    const fromUrl = new URL(withSourceMarketCountry(URL_430651, "JP")!).searchParams.get("currency");
    expect(fromUrl).toBe(expectedCurrencyFor(URL_430651));
  });

  it("A-3 🔴 등록부에 «국가 → 통화» 대응표가 없다 — §F 하드코딩 금지의 기계 검증", () => {
    /**
     * 🔴 이 단언은 **소스 앵커** 다 — A-1 의 행동 불변식이 못 잡는 것을 잡는다.
     *    A-1 은 「네 국가에서 통화가 같다」를 보므로, 네 국가를 **전부 EUR 로**
     *    적은 대응표가 생기면 통과한다. 그 칸이 생기는 순간이 §F 가 열리는 순간이다.
     * 🔴 **주석을 먼저 벗긴다**(이 저장소에서 여덟 번 걸린 함정) — 주석에 적힌
     *    「currencyByCountry 를 두지 않는다」 같은 문장이 검사를 통과시킨다.
     */
    const src = readFileSync(
      fileURLToPath(new URL("../source-currency-policy.ts", import.meta.url)),
      "utf-8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");

    // 통화를 국가/시장별로 담는 칸이 **없다**.
    expect(src).not.toMatch(/currency(?:By|Per|For)[A-Za-z]*\s*[?:]/);
    expect(src).not.toMatch(/\bcurrencies\s*[?:]/);
    // 규칙 타입이 선언하는 `currency` 칸은 **하나** 다.
    expect([...src.matchAll(/^\s*currency\s*[?:]\s*string/gm)]).toHaveLength(1);
    // 국가 규칙의 값도 목록이 아니라 **한 값** 이다(`value: string`).
    expect(src).toMatch(/country\?\s*:\s*\{\s*queryParam:\s*string;\s*value:\s*string\s*\}/);
    expect(src).not.toMatch(/value\s*:\s*string\[\]/);
  });

  it("A-4 🔴 통화 불변은 «등록된 모든» source 에서 지켜진다 — smallable 하나만 보지 않는다", () => {
    /**
     * 🔴 등록부를 export 하지 않으므로(운영 파일 변경 0) 호스트를 열거할 수 없다.
     *    대신 **등록 여부를 술어로 물어** 등록된 것에만 불변식을 적용한다 —
     *    새 source 가 등록되면 이 목록에 한 줄을 더하는 것이 그 WU 의 일이다.
     */
    const HOSTS = [
      URL_430651,
      "https://smallable.com/en/product/x-123456",
      // 🔴 미등록 대조군 — 아무 파라미터도 붙지 않아야 한다.
      "https://junioredition.com/products/x",
      "https://bobochoses.com/products/x",
    ];
    let registered = 0;
    for (const url of HOSTS) {
      if (!supportsMarketCountryProbe(url)) {
        expect(withSourceMarketCountry(url, "JP")).toBeNull();
        continue;
      }
      registered += 1;
      const currencies = new Set(
        ["FR", "KR", "US", "JP"].map((c) => new URL(withSourceMarketCountry(url, c)!).searchParams.get("currency")),
      );
      expect(currencies.size).toBe(1);
      expect([...currencies][0]).toBe(expectedCurrencyFor(url));
    }
    expect(registered).toBeGreaterThan(0); // 🔴 전건 미등록이면 이 계약이 공회전한다
  });
});

describe("B. 관문 ③ — 응답 통화가 기대 통화와 다르면 그 관측을 «버린다»", () => {
  it("B-1 대조군: EUR 응답은 관측으로 선다", async () => {
    const out = await probeWith(fixture("smallable-430651-kr.html"), `${URL_430651}?currency=EUR&country=KR`);
    expect(out).toHaveLength(1);
    expect(out[0]!.marketCode).toBe("kr");
    expect(out[0]!.currency).toBe("EUR");
    // 🟢 핵심 회귀 — KR 은 €73 이다(fixture 실측값).
    expect(out[0]!.amount).toBe(73);
  });

  it("B-2 🔴🔴 사이트가 JPY 로 응답하면 관측이 «0건» 이다 — 사이트 환산을 저장하지 않는다", async () => {
    // 같은 응답에서 **통화만** JPY 로 바꾼다(금액은 그대로). 관문 ①(국가 되싣기)과
    // ②(상품 동일성)는 그대로 통과하므로 **관문 ③ 만** 시험한다.
    const jpy = fixture("smallable-430651-kr.html").replaceAll('"EUR"', '"JPY"');
    expect(jpy).toContain('"JPY"'); // 🔴 치환이 실제로 적용됐는지 먼저 확인한다
    const out = await probeWith(jpy, `${URL_430651}?currency=EUR&country=KR`);
    expect(out).toHaveLength(0);
  });

  it("B-3 🔴 응답 통화는 «요청한 통화» 로 간주하지 않는다 — 그 가정이 사이트 환산을 들여보낸다", async () => {
    // Smallable 은 인식 못 한 파라미터를 조용히 무시하고 기본값으로 돌아간다(실측).
    // 그래서 "내가 EUR 를 요청했으니 응답도 EUR 이다" 로 두면 안 된다.
    const krw = fixture("smallable-430651-kr.html").replaceAll('"EUR"', '"KRW"');
    const out = await probeWith(krw, `${URL_430651}?currency=EUR&country=KR`);
    expect(out).toHaveLength(0);
  });
});

describe("C. 라이브 실측을 기록으로 잠근다 — 다음 사람이 다시 재지 않도록", () => {
  /** 🔴 2026-11-07 라이브 격자(상품 430753). 🔴 **코드가 쓰는 값이 아니다** — 기록이다. */
  const GRID: Record<string, Record<string, number>> = {
    JP: { EUR: 54, JPY: 10078, USD: 63 },
    KR: { EUR: 49, JPY: 9145, USD: 57 },
    US: { EUR: 53, JPY: 9892, USD: 62 },
  };

  it("C-1 🔴 하나의 환율이 격자 전부를 설명한다 ⟹ `?currency=` 는 표시 계층이다", () => {
    for (const [a, b] of [
      ["JPY", "EUR"],
      ["USD", "EUR"],
    ] as [string, string][]) {
      let lo = -Infinity;
      let hi = Infinity;
      for (const country of Object.keys(GRID)) {
        const x = GRID[country]![a]!;
        const y = GRID[country]![b]!;
        const unit = Number.isInteger(x) ? 1 : 0.01;
        lo = Math.max(lo, (x - unit / 2) / y);
        hi = Math.min(hi, (x + unit / 2) / y);
      }
      // 🔴 구간이 비어 있지 않다 = 단일 환율로 설명된다 = 시장별 독립 가격이 아니다.
      expect(lo).toBeLessThan(hi);
    }
  });

  it("C-2 🔴 편차 임계값으로 판정하면 틀린다 — USD 를 「시장별 독립」으로 오판했다", () => {
    // 내 1차 하니스가 `편차 < 0.5%` 를 썼고 USD/EUR 0.563% 를 🟢 로 찍었다.
    // 정수 반올림 통화는 그 자체로 ±0.5 단위 잡음이 있다(USD 57 → 약 0.9%).
    const ratios = Object.keys(GRID).map((c) => GRID[c]!.USD! / GRID[c]!.EUR!);
    const spread = ((Math.max(...ratios) - Math.min(...ratios)) / Math.min(...ratios)) * 100;
    expect(spread).toBeGreaterThan(0.5); // 🔴 임계값을 넘는다(그래서 오판했다)
    // 🟢 그런데 단일 환율 구간은 비어 있지 않다 — 올바른 검사는 C-1 이다.
    const unitLo = Math.max(...Object.keys(GRID).map((c) => (GRID[c]!.USD! - 0.5) / GRID[c]!.EUR!));
    const unitHi = Math.min(...Object.keys(GRID).map((c) => (GRID[c]!.USD! + 0.5) / GRID[c]!.EUR!));
    expect(unitLo).toBeLessThan(unitHi);
  });

  it("C-3 🔴 통화 미지정 경로는 egress 가 통화를 정한다 — 그 경로를 쓰지 않는다", () => {
    // 라이브 실측: `?country=JP`(통화 미지정) → **KRW 91,108**(한국에서 요청했기 때문).
    // 🔴 그래서 「사이트가 알아서 현지 통화를 주게 두기」는 선택지가 아니다.
    const UNSPECIFIED_CURRENCY_RESULT = { country: "JP", currency: "KRW", amount: 91108 };
    expect(UNSPECIFIED_CURRENCY_RESULT.currency).not.toBe("JPY");
    // 그리고 운영 URL 빌더는 통화를 **언제나** 적는다(미지정 경로를 만들지 않는다).
    expect(new URL(withSourceMarketCountry(URL_430651, "JP")!).searchParams.has("currency")).toBe(true);
  });
});
