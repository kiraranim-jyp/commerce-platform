import { describe, expect, it } from "vitest";
import { jsonLdProductDescription } from "../jsonld-product-description";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-SAME-SPRINT-06 — **JSON-LD 공급원 행동 계약**(네트워크 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 파일이 왜 필요한가 — 음성 대조가 공백을 찾았다.**
 *    `@type === "Product"` 게이트를 **지워도** 기존 계약이 **하나도 FAIL 하지 않았다**.
 *    소스 문자열 계약은 **배선** 을 보고 **동작** 을 보지 않기 때문이다 ⟹ 그래서
 *    **행동 단언** 을 따로 둔다(WU-110 이 적어 둔 그 교훈과 같은 자리).
 */

const ld = (obj: unknown) => `<html><head><script type="application/ld+json">${JSON.stringify(obj)}</script></head></html>`;

describe("SPRINT-06 Contract 1 — `@type` 이 Product 가 «아니면» 읽지 않는다", () => {
  it("Product 의 description 은 읽는다", () => {
    expect(jsonLdProductDescription(ld({ "@type": "Product", description: "Organic cotton tee for kids" }))).toBe(
      "Organic cotton tee for kids",
    );
  });

  /**
   * 🔴🔴 **이 셋이 뚫리면 「페이지 일반 설명」이 Evidence 가 된다**(CPO §4 금지).
   *    변이(게이트 제거)를 걸면 이 단언들이 **FAIL 한다** — 그것이 이 파일의 목적이다.
   */
  it.each([
    ["WebPage", "이 쇼핑몰은 유아동 의류를 판매합니다"],
    ["Organization", "비스킷은 2015년 설립된 셀렉트샵입니다"],
    ["BreadcrumbList", "홈 > BRAND > KIDS"],
    ["CollectionPage", "신상품 모아보기"],
  ])("%s 의 description 은 **읽지 않는다**", (type, desc) => {
    expect(
      jsonLdProductDescription(ld({ "@type": type, description: desc })),
      `🔴 ${type} 의 설명을 읽으면 상품 Evidence 가 오염된다`,
    ).toBeNull();
  });

  it("같은 문서에 Product 와 WebPage 가 섞여 있으면 **Product 것만** 읽는다", () => {
    const html = ld([
      { "@type": "WebPage", description: "쇼핑몰 소개 문구입니다" },
      { "@type": "Product", description: "Hug Hairy Monster T-shirt B226AC009" },
    ]);
    expect(jsonLdProductDescription(html)).toBe("Hug Hairy Monster T-shirt B226AC009");
  });

  it("`@graph` 안쪽의 Product 도 찾는다(실제 사이트 모양)", () => {
    const html = ld({ "@context": "https://schema.org", "@graph": [{ "@type": "Product", description: "Wool blend coat" }] });
    expect(jsonLdProductDescription(html)).toBe("Wool blend coat");
  });

  it("`@type` 이 배열이어도 Product 가 들어 있으면 읽는다", () => {
    expect(jsonLdProductDescription(ld({ "@type": ["Product", "Offer"], description: "Linen shirt" }))).toBe("Linen shirt");
  });
});

describe("SPRINT-06 Contract 2 — 지어내지 않는다", () => {
  it("description 이 없으면 null 이고 다른 자리로 폴백하지 않는다", () => {
    expect(jsonLdProductDescription(ld({ "@type": "Product", name: "T-shirt" }))).toBeNull();
    /** 🔴 meta/og 가 있어도 **쓰지 않는다**(CPO HOLD). */
    const withMeta = `<html><head><meta name="description" content="메타 설명입니다 길이를 충분히 늘립니다"><script type="application/ld+json">${JSON.stringify({ "@type": "Product", name: "X" })}</script></head></html>`;
    expect(jsonLdProductDescription(withMeta), "🔴 meta 로 폴백하면 CPO HOLD 를 깬다").toBeNull();
  });

  it("JSON-LD 가 없거나 깨져 있으면 null 이다(추측해 고치지 않는다)", () => {
    expect(jsonLdProductDescription("<html><body>no ld</body></html>")).toBeNull();
    expect(jsonLdProductDescription(`<script type="application/ld+json">{ broken,, }</script>`)).toBeNull();
    expect(jsonLdProductDescription(null)).toBeNull();
    expect(jsonLdProductDescription("")).toBeNull();
  });

  it("빈 문자열/공백만 있으면 null 이다(「비었다」를 「있다」로 만들지 않는다)", () => {
    expect(jsonLdProductDescription(ld({ "@type": "Product", description: "   " }))).toBeNull();
  });

  it("description 이 숫자/객체면 읽지 않는다(타입을 강제 변환하지 않는다)", () => {
    expect(jsonLdProductDescription(ld({ "@type": "Product", description: 123 }))).toBeNull();
    expect(jsonLdProductDescription(ld({ "@type": "Product", description: { ko: "설명" } }))).toBeNull();
  });
});

describe("SPRINT-06 Contract 3 — 태그를 걷고 원문 의미는 바꾸지 않는다", () => {
  it("HTML 태그와 엔티티를 정리한다", () => {
    const out = jsonLdProductDescription(ld({ "@type": "Product", description: "<p>100%&nbsp;Organic <b>Cotton</b></p>" }));
    expect(out).toBe("100% Organic Cotton");
  });

  it("품번을 **원형 그대로** 남긴다(보강기가 읽을 수 있어야 한다)", () => {
    const out = jsonLdProductDescription(ld({ "@type": "Product", description: "<div>REF: B226AC141</div>" }));
    expect(out).toContain("B226AC141");
  });

  it("순환 참조가 있어도 멈춘다", () => {
    /** 🔴 JSON.stringify 가 순환을 막으므로 **중첩 깊이** 로 대신 본다. */
    let deep: Record<string, unknown> = { "@type": "Product", description: "Deep product" };
    for (let i = 0; i < 50; i += 1) deep = { nested: deep };
    expect(jsonLdProductDescription(ld(deep))).toBe("Deep product");
  });
});
