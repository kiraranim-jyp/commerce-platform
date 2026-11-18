/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 UIRD-5 — **PLAIN_HTML 후보가 이미지를 «읽지 않고 있었다»**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 고친 결함 — `product-url-facts.ts` 의 PLAIN_HTML 분기가 `imageUrl: null` **하드코딩**
 *    이었다. 바로 위 `SHOPIFY_JSON` 분기는 `suppliedFacts.imageUrls[0]` 로 **채우는데**
 *    이 경로는 비웠다 ⟹ **국내 후보가 대부분 이 경로** 라서 셀러 화면에 이미지가 서지
 *    못했다(메모 `plain-html-asymmetry-is-data-availability` 가 가리킨 그 비대칭).
 *
 * 🟢 이 파일은 **그 읽기 규칙** 을 잠근다 — 추가 HTTP 0 · 네트워크 0 · 순수 함수.
 * 🔴 「화면 문구(NO IMAGE)」가 아니라 **실제 URL 회수** 를 본다.
 */
import { describe, expect, it } from "vitest";
import { imageFromHtmlMeta } from "../product-url-facts";

describe("UIRD-5 — 후보 대표 이미지는 이미 받은 HTML 에서 읽는다", () => {
  it("A-1 🟢 `og:image` 를 읽는다(가장 흔한 모양)", () => {
    expect(
      imageFromHtmlMeta('<meta property="og:image" content="https://cdn.shop.com/p/1.jpg">'),
    ).toBe("https://cdn.shop.com/p/1.jpg");
  });

  it("A-2 🟢 속성 **순서가 뒤집힌** 모양도 읽는다(content 가 먼저)", () => {
    expect(
      imageFromHtmlMeta(`<meta content='https://cdn.shop.com/p/2.jpg' property='og:image'>`),
    ).toBe("https://cdn.shop.com/p/2.jpg");
  });

  it("A-3 🟢 `og:image` 가 없으면 `twitter:image` 로 내려간다", () => {
    expect(
      imageFromHtmlMeta('<meta name="twitter:image" content="https://cdn.shop.com/p/3.jpg">'),
    ).toBe("https://cdn.shop.com/p/3.jpg");
  });

  it("A-4 🟢 프로토콜 상대 URL(`//cdn…`)은 https 로 올린다", () => {
    expect(imageFromHtmlMeta('<meta property="og:image" content="//cdn.shop.com/p/4.jpg">')).toBe(
      "https://cdn.shop.com/p/4.jpg",
    );
  });

  /**
   * 🔴🔴🔴 **이 단언이 가장 중요하다 — 상대경로를 «추측해서 합치지» 않는다.**
   *
   * base 를 붙여 절대 URL 을 만들면 틀릴 때 **다른 상품 사진** 이 뜬다. 이 저장소가
   * 반복해서 금지한 사고(「대체 사진으로 메우면 판단 자체가 거짓이 된다」)가 그것이다.
   * 🟢 그래서 상대경로는 **버리고 `null`** 이다 — 화면이 「NO IMAGE」를 적는다.
   */
  it("A-5 🔴🔴 상대경로는 **버린다**(base 와 합치지 않는다 · 대체 사진 금지)", () => {
    expect(imageFromHtmlMeta('<meta property="og:image" content="/img/p.jpg">')).toBeNull();
    expect(imageFromHtmlMeta('<meta property="og:image" content="img/p.jpg">')).toBeNull();
  });

  it("A-6 🔴 메타가 없으면 `null`(지어내지 않는다)", () => {
    expect(imageFromHtmlMeta("<html><body>no meta here</body></html>")).toBeNull();
    expect(imageFromHtmlMeta('<meta property="og:image" content="">')).toBeNull();
  });

  it("A-7 🔴 `javascript:`·`data:` 같은 비 HTTP 스킴은 받지 않는다", () => {
    expect(imageFromHtmlMeta('<meta property="og:image" content="data:image/png;base64,AAA">')).toBeNull();
    expect(imageFromHtmlMeta('<meta property="og:image" content="javascript:alert(1)">')).toBeNull();
  });

  /**
   * 🔵🔵 **운영 배선** 을 소스로 잠근다 — 순수 함수만 단언하면 **배선이 끊겨도 통과한다**
   *    (이 트랙이 WU-110 에서 밟은 함정). 🔴 그리고 옛 `imageUrl: null` 하드코딩이
   *    되살아나는 것도 같이 막는다.
   */
  it("A-8 🔴🔴 PLAIN_HTML 분기가 **이 함수를 실제로 쓴다**(하드코딩 null 부활 금지)", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const src = readFileSync(path.join(__dirname, "..", "product-url-facts.ts"), "utf8");
    /** 🔴 주석을 벗긴다 — 주석 속 예시가 「구현됐다」로 세어지는 함정. */
    const bare = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
    expect(bare).toContain("imageUrl: imageFromHtmlMeta(html)");
    /** 🔴 SHOPIFY_JSON 경로는 **그대로** 다(건드리지 않았다). */
    expect(bare).toContain("imageUrl: suppliedFacts.imageUrls[0] ?? null");
  });
});
