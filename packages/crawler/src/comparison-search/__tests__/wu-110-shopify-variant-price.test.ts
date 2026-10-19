import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { shopifyVariantPrice } from "../product-url-facts";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-110 — **이미 받은 Shopify JSON 의 `price` + `price_currency` 만 읽는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 고정 범위: 「`variants[0].price` **AND** `variants[0].price_currency` 가
 *    **둘 다** 있을 때만 가격 생성 · 하나라도 없으면 **기존처럼 null** · **추가 HTTP 0회**」
 *
 * 🔴 왜 필요했나 — MI 가 **SAME / tier EXACT** 로 판정한 동일상품
 *    (`global.trenbe.com` · B226AC009)의 가격이 `null` 이라 **해외 가격비교에서
 *    빠졌다**(WU-108 §6 · WU-109 §2). 🟢 그 JSON 에 `price "84.00"` +
 *    `price_currency "USD"` 가 **둘 다 있었다**.
 *
 * 🔴🔴 **판정 owner 를 «직접» 부른다** — `fetchWithDomainRateLimit` 은 전역 `fetch` 를
 *    쓰지 않아(SSRF 가드 경유) 주입 stub 으로는 잠글 수 없다. 1차에 그렇게 시도해
 *    **전건 `UNREACHABLE`** 이 났다. 🟢 **네트워크 0** 이고 그것이 이 WU 의 로직 전부다.
 *    🟢 통합 경로(추가 HTTP 0 · 해외 집계 진입)는 **Trenbe LIVE E2E** 가 따로 본다.
 */

const v = (price?: string, price_currency?: string) =>
  shopifyVariantPrice({ variants: [{ price, price_currency }] });

describe("WU-110 ① PASS — 둘 다 있으면 가격을 만든다", () => {
  it("🟢 price \"84.00\" · price_currency \"USD\" → 84 USD", () => {
    expect(v("84.00", "USD")).toEqual({ amount: 84, currency: "USD" });
  });

  it("🟢 소문자 통화는 **정규화** 한다(값을 지어내는 것이 아니다)", () => {
    expect(v("40", "eur")).toEqual({ amount: 40, currency: "EUR" });
    expect(v("88000", " krw ")).toEqual({ amount: 88000, currency: "KRW" });
  });
});

describe("WU-110 ② FAIL-SAFE — 하나라도 없으면 null (기존 동작 유지)", () => {
  it("🔴 price 있고 통화 없음 → null", () => {
    expect(v("84.00", undefined)).toBeNull();
  });

  it("🔴 통화 있고 price 없음 → null", () => {
    expect(v(undefined, "USD")).toBeNull();
  });

  it("🔴 variants 자체가 없는 기존 응답 → null (회귀 방지)", () => {
    expect(shopifyVariantPrice({})).toBeNull();
    expect(shopifyVariantPrice({ variants: [] })).toBeNull();
  });

  it("🔴 통화 «모양» 이 아니면 믿지 않는다", () => {
    for (const cur of ["US$", "", "   ", "USDD", "US"]) {
      expect(v("84.00", cur)).toBeNull();
    }
  });

  it("🔴 숫자가 아니거나 0 이하면 null — **0 으로 만들지 않는다**", () => {
    for (const price of ["", "   ", "abc", "0", "-5"]) {
      expect(v(price, "USD")).toBeNull();
    }
  });
});

describe("WU-110 ③ 범위 — `variants[0]` 고정", () => {
  it("🔴 둘째 variant 를 고르지 않는다(선택 규칙은 이 WU 의 범위가 아니다)", () => {
    expect(
      shopifyVariantPrice({
        variants: [{ price: "84.00", price_currency: "USD" }, { price: "99.00", price_currency: "USD" }],
      }),
    ).toEqual({ amount: 84, currency: "USD" });
  });

  it("🔴 첫 variant 가 불완전하면 둘째로 «넘어가지 않는다»", () => {
    expect(
      shopifyVariantPrice({ variants: [{ price: "84.00" }, { price: "99.00", price_currency: "USD" }] }),
    ).toBeNull();
  });
});

/**
 * 🔴🔴 **음성 대조가 두 구멍을 찾았다 — 그래서 이 구역을 더했다.**
 * ```
 * M5  `price: shopifyVariantPrice(body)` → `price: null` (배선 제거)  → **0 failed**
 *     🔴 위 단언들은 판정 함수를 «직접» 부르므로 **배선이 끊겨도 통과** 한다
 * M1  `if (!raw || !cur)` → `if (!raw)` (안전조건 절반 제거)        → **0 failed**
 *     🟢 결과는 안전했다(뒤의 통화 «모양» 검사가 `undefined` 를 막는다)
 *     🔴 그러나 「통화 없으면 가격 없음」이 **두 줄 중 하나에만** 의존하면 약하다
 * ```
 * 🔴🔴 **주석을 벗기지 «않았다» — 그 대신 벗길 필요가 없는 앵커를 골랐다.**
 *    헌장 §5 는 「소스 문자열 검사는 **주석을 벗기고** 한다」(여덟 번 걸린 함정)인데,
 *    여기서 쓰는 두 앵커(`price: shopifyVariantPrice(body),` ·
 *    `if (!raw || !cur) return null;`)는 **운영 파일 주석에 등장하지 않는다**(확인).
 * 🔴 그리고 정규식을 스크립트로 편집하다 **백슬래시가 소실된 사고가 또 났다**
 *    (WU-078 교훈 재발) — 그래서 **정규식을 아예 쓰지 않는다**.
 */
const SRC = readFileSync(path.join(__dirname, "../product-url-facts.ts"), "utf8");

describe("WU-110 ④ 배선과 안전조건을 «소스» 로 잠근다", () => {
  it("🔴 SHOPIFY_JSON 분기가 판정 함수를 **실제로 부른다**(M5)", () => {
    expect(SRC).toContain("price: shopifyVariantPrice(body),");
    /** 🔴 그 자리가 `price: null` 로 되돌아가면 이 단언이 **FAIL 로 뒤집힌다**. */
    /**
     * 🔴 **좌표를 확인한다** — `fetchPath: "SHOPIFY_JSON"` 의 **첫 등장은 타입 선언** 이다
     *    (`fetchPath: "SHOPIFY_JSON" | "PLAIN_HTML" | "NONE";`). 1차에 그 자리를 slice 해
     *    **엉뚱한 구간을 단언** 했다(헌장이 경고한 그 함정 · 이번엔 FAIL 로 드러났다).
     * 🟢 실제 사용처는 **쉼표가 붙은** 반환 리터럴이다.
     */
    const at = SRC.indexOf("fetchPath: \"SHOPIFY_JSON\",");
    expect(at).toBeGreaterThan(-1);
    expect(SRC.slice(Math.max(0, at - 1500), at)).toContain("shopifyVariantPrice(body)");
  });

  it("🔴 「price AND price_currency」가 **한 줄에서** 요구된다(M1)", () => {
    expect(SRC).toContain("if (!raw || !cur) return null;");
  });
});
