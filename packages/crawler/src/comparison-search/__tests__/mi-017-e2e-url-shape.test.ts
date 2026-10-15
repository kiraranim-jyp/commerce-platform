/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-017-E2E — `toCrawlerUrl` **비-Shopify 식별 파라미터 보존** (HTTP 0 · 순수)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 AI 0 · 외부 API 0 · HTTP 0 · 비용 0. 순수 함수만 본다.
 *
 * 왜 생겼나 — 라이브 측정(WU-017-E2E)에서 **GT 가 진짜 동일상품인 국내 2건이
 * 전부 탈락** 했고 원인이 이 함수였다:
 * ```
 * foretforet.com/shop/shopdetail.html?branduid=10226592 → shopdetail.html → 89바이트  → NO_FACTS
 * deuxbebe.com/product/detail.html?product_no=8021&…    → detail.html     → 응답 없음  → UNREACHABLE
 * 🟢 두 URL 은 직접 열면 200 · og:title 정상(243,951B / 212,603B 실측)
 * ```
 * 🔴 국내 Cafe24·메이크샵 계열은 **상품 식별자가 쿼리스트링에 있다.**
 */
import { describe, expect, it } from "vitest";
import { classifyUrlShape, toCrawlerUrl } from "../url-shape";

const shapeOf = (u: string) => toCrawlerUrl(u, classifyUrlShape(u));

describe("WU-017-E2E ① 비-Shopify 는 식별 파라미터를 **보존** 한다", () => {
  it("🔴 메이크샵 `?branduid=` 가 남는다 — 떼면 상품 페이지가 아니게 된다", () => {
    const r = shapeOf("https://www.foretforet.com/shop/shopdetail.html?branduid=10226592");
    expect(r.crawlerUrl).toBe("https://www.foretforet.com/shop/shopdetail.html?branduid=10226592");
    expect(r.dedupeKey).toContain("branduid=10226592");
  });

  it("🔴 Cafe24 `?product_no=` 도 남는다", () => {
    const r = shapeOf("https://www.deuxbebe.com/product/detail.html?product_no=8021&cate_no=62&display_group=1");
    expect(r.crawlerUrl).toContain("product_no=8021");
  });

  it("🟢 추적 파라미터는 **여전히** 걷힌다 — dedupe 가 utm 으로 쪼개지지 않는다", () => {
    const a = shapeOf("https://www.foretforet.com/shop/shopdetail.html?branduid=10226592&utm_source=chatgpt.com");
    const b = shapeOf("https://www.foretforet.com/shop/shopdetail.html?branduid=10226592");
    expect(a.crawlerUrl).not.toContain("utm_source");
    /** 🔴 같은 상품이면 **같은 키** 여야 한다(그러지 않으면 중복 후보가 생긴다). */
    expect(a.dedupeKey).toBe(b.dedupeKey);
  });

  it("🟢 검색 문맥 파라미터(`_pos`·`_psq`)도 걷힌다 — WU-007A 와 같은 축이다", () => {
    const r = shapeOf("https://looxloo.com/product/detail.html?product_no=55&_pos=1&_psq=B226AC010");
    expect(r.crawlerUrl).not.toMatch(/_pos|_psq/);
    expect(r.crawlerUrl).toContain("product_no=55");
  });
});

describe("WU-017-E2E ② Shopify 분기는 **한 글자도** 바뀌지 않았다", () => {
  /**
   * 🔴 그쪽 로케일 제거는 「원산지 기준가」를 지키는 **명시적 계약** 이다
   *    (discovery-benchmark.test.ts:123-125 가 이유까지 적어 뒀다). 이 WU 가
   *    그 계약을 건드렸는지 **여기서 다시 확인** 한다.
   */
  it("🔴 로케일·목록 경로·쿼리가 전부 떨어진 origin+handle 이다", () => {
    const r = shapeOf(
      "https://www.junioredition.com/en-kr/collections/bobo-choses/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses?_pos=1",
    );
    expect(r.crawlerUrl).toBe(
      "https://www.junioredition.com/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses",
    );
    expect(r.localeNormalized).toBe(true);
    expect(r.dedupeKey).toBe("https://www.junioredition.com|booty-ghosts-long-sleeve-t-shirt-by-bobo-choses");
  });

  it("🔴 판매처는 합치지 않는다", () => {
    expect(shapeOf("https://a.com/products/x").dedupeKey).not.toBe(shapeOf("https://b.com/products/x").dedupeKey);
  });

  /**
   * 🔴🔴 **그 계약의 대가를 여기 적어 둔다 — 고치지 않았다(CPO 판정 사안).**
   *    Shopify 로케일이 떨어지므로 `/en-kr/` URL 을 넣어도 **Global 페이지** 를 읽는다.
   *    → 이 경로로는 **KR 시장 가격 증거를 얻을 수 없다**(WU-008 이 `.com/en-kr` 에서
   *      `KRW 258,000` 을 실측했는데 그 시장에 닿지 못한다).
   *    🟢 이 단언은 성질을 **고정** 할 뿐 「옳다」고 말하지 않는다. 정책이 바뀌면
   *       이 테스트가 FAIL 로 뒤집히고 **그것이 수정의 증거** 다.
   */
  it("🔴 로케일만 다른 두 Shopify URL 은 **같은 dedupeKey** 다 — KR 시장이 합쳐진다", () => {
    const global = shapeOf("https://bobochoses.com/products/b226ac117-b-c-embossed-tracksuit-jacket");
    const kr = shapeOf("https://bobochoses.com/en-kr/products/b226ac117-b-c-embossed-tracksuit-jacket");
    expect(kr.dedupeKey).toBe(global.dedupeKey);
    expect(kr.crawlerUrl).toBe(global.crawlerUrl);
  });
});

describe("WU-017-E2E ③ 상품이 아닌 모양에는 크롤러 URL 을 주지 않는다", () => {
  it("목록·루트는 null 이다", () => {
    for (const u of [
      "https://bobochoses.com/collections/new-arrivals-kid",
      "https://www.deuxbebe.com/product/list.html?cate_no=110",
      "https://bobochoses.com/",
    ]) {
      expect(toCrawlerUrl(u, classifyUrlShape(u)).crawlerUrl, u).toBeNull();
    }
  });
});
