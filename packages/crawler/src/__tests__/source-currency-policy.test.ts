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

/**
 * SMALLABLE-PRICE-1(CPO 지시, 2026-09-12) — "Smallable 원본 상품가격 기준 = FR".
 *
 * 통화만 고정해서는 금액이 하나로 정해지지 않았다. smallable은 같은 상품·같은 EUR
 * 인데도 배송국가별로 다른 금액을 준다(430651 기준 KR 73 / FR 75 / US 79 / JP 81).
 * 파라미터가 없으면 접속 지역이 국가를 정하는데, Production 크롤러 egress는 JP로
 * 지오로케이션돼 있어서 여태 JP 가격이 원본가격으로 들어가고 있었다 — 아무도
 * 고르지 않았는데 인프라 위치가 대신 골라준 값이다.
 *
 * FR인 근거는 판매자가 공시한 판매조건이다: 표시가는 프랑스 부가세가 포함된 EUR이고,
 * EU 밖으로 배송하면 프랑스 부가세를 빼고 도착국가 세금·관세를 따로 물린다. 배송비도
 * 도착지별로 따로 계산한다. 그래서 FR 값이 도착지 비용이 아직 섞이지 않은 원본
 * 상품가격이고, KR 73은 "한국까지 배송된 값"이라 국제배송비·수입비용 정책과 경계가
 * 뭉개진다 — 원본가격으로 쓰면 안 된다.
 */
describe("smallable은 배송국가도 FR로 고정한다", () => {
  it("핵심 회귀: currency=EUR과 country=FR이 함께 붙는다", () => {
    const u = new URL(withSourceCurrency("https://www.smallable.com/en/product/x-430651"));
    expect(u.searchParams.get("currency")).toBe("EUR");
    expect(u.searchParams.get("country")).toBe("FR");
  });

  it("핵심 회귀: 이미 쿼리가 있는 URL에서도 둘 다 붙는다", () => {
    // 실제로 사용자가 붙여넣는 형태다 — 검색 결과에서 복사하면 algsearch가 딸려온다.
    const u = new URL(
      withSourceCurrency("https://www.smallable.com/en/product/x-430651?algsearch=8a468cb59a6e85f2fdb1b9ee8aa9eae8"),
    );
    expect(u.searchParams.get("algsearch")).toBe("8a468cb59a6e85f2fdb1b9ee8aa9eae8");
    expect(u.searchParams.get("currency")).toBe("EUR");
    expect(u.searchParams.get("country")).toBe("FR");
  });

  it("붙여넣은 URL에 다른 국가가 들어 있어도 정책이 이긴다", () => {
    const u = new URL(withSourceCurrency("https://www.smallable.com/en/product/x?country=KR&currency=KRW"));
    expect(u.searchParams.get("country")).toBe("FR");
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
    // SMALLABLE-PRICE-1 — country는 smallable 한 줄짜리 등록이다. "글로벌 사이트는
    // 본국 기준"처럼 일반 규칙으로 번지면 안 된다(다른 사이트는 실측하지 않았다).
    expect(new URL(withSourceCurrency(url)).searchParams.get("country")).toBeNull();
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
