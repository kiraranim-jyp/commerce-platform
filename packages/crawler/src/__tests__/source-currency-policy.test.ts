import { describe, expect, it } from "vitest";
import { expectedCurrencyFor, withSourceCurrency } from "../source-currency-policy";

/**
 * OVERSEAS-CURRENCY-POLICY-1(CPO 지시, 2026-09-10).
 *
 * 지키는 불변조건 세 가지:
 *  ① 해외 원본가격은 원본 사이트 국가 기준 통화로만 확보한다.
 *  ② 국가에서 통화를 추론하지 않는다 — 실측으로 확인해 등록한 source만 적용한다.
 *  ③ 모든 사이트에 `?currency=`를 붙이지 않는다.
 *
 * ②③이 특히 중요하다. 금액 데이터는 한 번 잘못 들어가면 착지원가·마진·판매판단까지
 * 조용히 오염된다. 실제로 이 작업 직전에 "KRW 98,784를 원본가격으로 쓰는" 변경이
 * Production에 11분간 올라간 적이 있다.
 */
describe("등록된 source만 원본 통화를 요청한다", () => {
  it("핵심 회귀: smallable은 EUR로 등록돼 있다", () => {
    expect(expectedCurrencyFor("https://www.smallable.com/en/product/x-123.html")).toBe("EUR");
  });

  it("URL에 currency 파라미터를 붙인다", () => {
    const u = withSourceCurrency("https://www.smallable.com/en/product/x-123.html");
    expect(new URL(u).searchParams.get("currency")).toBe("EUR");
  });

  it("이미 다른 통화가 붙어 있어도 정책이 이긴다", () => {
    const u = withSourceCurrency("https://www.smallable.com/en/product/x?currency=JPY");
    expect(new URL(u).searchParams.get("currency")).toBe("EUR");
  });

  it("www 없는 호스트와 하위 도메인도 같은 규칙을 받는다", () => {
    expect(expectedCurrencyFor("https://smallable.com/en/product/x")).toBe("EUR");
    expect(expectedCurrencyFor("https://shop.smallable.com/en/product/x")).toBe("EUR");
  });

  it("기존 쿼리는 보존한다", () => {
    const u = new URL(withSourceCurrency("https://www.smallable.com/en/product/x?size=4Y"));
    expect(u.searchParams.get("size")).toBe("4Y");
    expect(u.searchParams.get("currency")).toBe("EUR");
  });
});

describe("핵심 회귀 — 등록되지 않은 사이트는 건드리지 않는다", () => {
  it.each([
    "https://junioredition.com/products/catsuit-onesie-by-mini-rodini",
    "https://kidsatelier.com/products/tulleen-tco-142-white",
    "https://nickis.com/products/stella-mccartney-kids-sweatshirt-beige-7008914850",
    "https://www.childrensalon.com/some-product-633403.html",
  ])("%s → URL 그대로, 통화 추론 없음", (url) => {
    expect(withSourceCurrency(url)).toBe(url);
    expect(expectedCurrencyFor(url)).toBeNull();
  });

  it("Shopify 매장은 등록하지 않는다 — meta.json 권위가 더 강한 근거다", () => {
    // 실측: junioredition=GBP, kidsatelier=USD, nickis=EUR가 /meta.json에서 나온다.
    // 여기에 중복 등록하면 두 곳에서 통화를 정하게 돼 어긋날 수 있다.
    expect(expectedCurrencyFor("https://junioredition.com/products/x")).toBeNull();
  });

  it("국가만 보고 추론하지 않는다 — 영국 사이트라고 GBP를 붙이지 않는다", () => {
    expect(expectedCurrencyFor("https://www.childrensalon.com/x.html")).toBeNull();
  });
});

describe("잘못된 URL에도 예외를 던지지 않는다", () => {
  it.each(["", "not-a-url", "ftp://smallable.com/x"])("%s", (url) => {
    expect(() => withSourceCurrency(url)).not.toThrow();
    expect(() => expectedCurrencyFor(url)).not.toThrow();
  });
});

/**
 * universalExtract의 통화 검증 가드와 같은 판정. 컴포넌트/브라우저 없이 규칙만
 * 고정한다 — 규칙이 뒤집히면 즉시 실패한다.
 */
describe("통화 검증 가드 — 원본 국가 통화가 아니면 가격을 버린다", () => {
  const keep = (url: string, currency: string) => {
    const exp = expectedCurrencyFor(url);
    return !((exp !== null && currency !== exp) || currency === "KRW");
  };
  const SMALLABLE = "https://www.smallable.com/en/product/x";
  const SHOPIFY = "https://junioredition.com/products/x";

  it("핵심 회귀: 등록 source가 기대와 다른 통화를 주면 버린다", () => {
    // smallable은 인식 못 하는 파라미터를 받으면 조용히 지역 기본값으로 돌아간다.
    expect(keep(SMALLABLE, "KRW")).toBe(false);
    expect(keep(SMALLABLE, "USD")).toBe(false);
    expect(keep(SMALLABLE, "EUR")).toBe(true);
  });

  it("핵심 회귀: 미등록 source라도 KRW면 버린다 — Shopify fast path 이탈 방어", () => {
    // 이미지가 0장이면 fast path를 포기하고 JSON-LD(지역 통화)로 내려온다.
    // 실측: junioredition JSON-LD는 서울에서 KRW 52,400을 준다(정상 경로는 GBP 27.60).
    expect(keep(SHOPIFY, "KRW")).toBe(false);
    expect(keep(SHOPIFY, "GBP")).toBe(true);
    expect(keep(SHOPIFY, "USD")).toBe(true);
  });
});
