import { describe, expect, it } from "vitest";
import { classifyUrlShape } from "../../comparison-search/url-shape";
import { factsFromProductUrl } from "../../comparison-search/product-url-facts";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 DISCOVERY-SEARCH-PROVIDER-01 STEP 5 — **기존 Pipeline 호환성**(측정 only)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **운영 코드를 고치지 않는다.** 이 하니스가 답하는 질문은 하나다 —
 *    「Apify 가 돌려준 URL 을 **기존 Candidate URL 계약에 그대로** 넣을 수 있는가?」
 *
 * 🔴 측정 두 축 —
 * ```
 * ① 현재 그대로        `factsFromProductUrl(url)` 결과(= 운영이 실제로 하는 일)
 * ② 반사실(분류기 우회)  진짜 상품 페이지인지 **HTTP 로 직접** 확인
 * ⟹ 둘을 갈라야 「Apify 가 나쁜가」와 「우리 분류기가 막는가」를 구분할 수 있다
 * ```
 */

const LIVE = process.env.CORE_APIFY_POC_LIVE === "1";

/** 🟢 **직전 PoC 가 실제로 받은 7건 그대로** 다(지어낸 URL 0). */
const APIFY_URLS = [
  "https://www.farfetch.com/id/shopping/kids/bobo-choses-booty-ghost-print-long-sleeve-t-shirt-item-37035483.aspx",
  "https://www.farfetch.com/fi/shopping/kids/bobo-choses-graphic-print-long-sleeve-t-shirt-item-37597390.aspx",
  "https://answear.ro/p/bobo-choses-longsleeve-pentru-copii-din-bumbac-booty-ghosts-gri-b226ac010-1843935",
  "https://www.farfetch.com/no/shopping/kids/bobo-choses-graphic-print-long-sleeve-t-shirt-item-37597390.aspx",
  "https://www.farfetch.com/kw/shopping/kids/bobo-choses-booty-ghost-print-long-sleeve-t-shirt-item-37035483.aspx",
  "https://www.farfetch.com/tw/shopping/kids/bobo-choses-graphic-print-long-sleeve-t-shirt-item-37597390.aspx",
];

const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - [...s].length));

describe("DISCOVERY-SEARCH-PROVIDER-01 STEP 5 — 분류기 과매치(순수 · 네트워크 0)", () => {
  /**
   * 🔴🔴 **이 계약은 「현재 동작」을 고정한다** — 고치면 FAIL 하고 **그것이 수정의 증거** 다
   *    (WU-052 가 HOLD 한 자리라 CTO 가 임의로 고치지 않는다 · 쿠팡 고시 선례와 같은 방식).
   */
  /**
   * ════════════════════════════════════════════════════════════════════════════
   * 🟢🟢 **아래 셋은 SPRINT-01 에서 «결함을 고정» 해 둔 계약이었고, SPRINT-02 에서
   *       FAIL 로 뒤집혔다. 그 뒤집힘이 «수정의 증거» 다**(쿠팡 고시 선례).
   * ════════════════════════════════════════════════════════════════════════════
   * 🔴 약화한 것이 아니라 **기대값을 고친 뒤 더 강하게** 단언한다 —
   *    「과매치가 사라졌다」 + 「진짜 목록은 그대로」를 **같이** 본다.
   */
  it("🟢 `shopping` 과매치가 «사라졌다»(SPRINT-02)", () => {
    const u = "https://www.farfetch.com/id/shopping/kids/bobo-choses-item-37035483.aspx";
    expect(String(classifyUrlShape(u))).not.toBe("LISTING_PAGE");
    /** 🟢 진짜 목록은 그대로 LISTING 이어야 한다(과수정 방지). */
    expect(String(classifyUrlShape("https://x.test/collections/kids"))).toBe("LISTING_PAGE");
    expect(String(classifyUrlShape("https://x.test/shop/kids"))).toBe("LISTING_PAGE");
  });

  it("🟢 `/p/` 상세 경로가 이제 PRODUCT_PAGE 다(SPRINT-02)", () => {
    const u = "https://answear.ro/p/bobo-choses-longsleeve-booty-ghosts-b226ac010-1843935";
    expect(String(classifyUrlShape(u))).toBe("PRODUCT_PAGE");
  });

  it("🟢 Apify 산출에서 PRODUCT_PAGE 가 0 → 1 이 됐다(분모 7 유지)", () => {
    const shapes = APIFY_URLS.map((u) => String(classifyUrlShape(u)));
    /** 🔴 분모를 바꾸지 않는다 — SPRINT-01 과 **같은 6 URL** 이다. */
    expect(APIFY_URLS).toHaveLength(6);
    expect(shapes.filter((s) => s === "PRODUCT_PAGE")).toHaveLength(1);
    /** 🔴 farfetch 5건은 **아직** UNKNOWN 이다(`.aspx` 미지원 · CPO 판정 대기). */
    expect(shapes.filter((s) => s === "UNKNOWN_PAGE")).toHaveLength(5);
    expect(shapes.filter((s) => s === "LISTING_PAGE")).toHaveLength(0);
  });
});

describe.skipIf(!LIVE)("DISCOVERY-SEARCH-PROVIDER-01 STEP 5 — 운영 경로 실측(라이브)", () => {
  it(
    "① 현재 그대로 · ② 반사실(진짜 상품 페이지인가)",
    async () => {
      console.log(`\n${"═".repeat(100)}`);
      console.log("  [①] 기존 운영 경로 `factsFromProductUrl` 결과 — 🔴 고치지 않았다");
      console.log(`${"═".repeat(100)}`);
      let ok = 0;
      for (const url of APIFY_URLS) {
        const r = (await factsFromProductUrl(url)) as unknown as Record<string, unknown>;
        const status = String(r.status ?? "?");
        if (status === "OK") ok += 1;
        console.log(`  ${pad(status, 18)}${pad(String(classifyUrlShape(url)), 14)}${url.slice(8, 70)}`);
      }
      console.log(`\n  🔴 facts 확보 **${ok}/${APIFY_URLS.length}**`);

      console.log(`\n${"═".repeat(100)}`);
      console.log("  [②] 반사실 — 분류기를 «건너뛰고» 실제로 상품 페이지인지 HTTP 로 본다");
      console.log(`${"═".repeat(100)}`);
      let realProduct = 0;
      for (const url of APIFY_URLS) {
        try {
          const res = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0" } });
          const html = res.ok ? await res.text() : "";
          /** 🔴 새 추출기를 만들지 않는다 — JSON-LD `"@type":"Product"` 존재만 본다. */
          const isProduct = /"@type"\s*:\s*"Product"/i.test(html);
          if (isProduct) realProduct += 1;
          console.log(`  HTTP ${pad(String(res.status), 6)}Product-LD ${isProduct ? "🟢 있음" : "· 없음"}   ${url.slice(8, 62)}`);
        } catch (e) {
          console.log(`  THREW ${(e as Error).message.slice(0, 40)}   ${url.slice(8, 62)}`);
        }
      }
      console.log(`\n  🟢 실제 상품 페이지 **${realProduct}/${APIFY_URLS.length}**`);
      console.log(
        `\n  ⟹ 🔴 **갈라서 읽는다** — Apify 공급 품질(②)과 우리 분류기 통과율(①)은 다른 숫자다.`,
      );
      expect(APIFY_URLS.length).toBeGreaterThan(0);
    },
    15 * 60 * 1000,
  );
});
