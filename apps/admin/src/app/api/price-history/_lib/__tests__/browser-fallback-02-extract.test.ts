import { describe, expect, it } from "vitest";
import { extractFromJsonLd, extractMicrodataFromHtml } from "@commerce/crawler";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵 BROWSER-FALLBACK-02 — **브라우저 HTML 을 기존 추출기에 넣으면 무엇이 나오는가**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 검증만 한다 — 새 endpoint **0** · 북마클릿 변경 **0** · Identity/MI **0** ·
 *    추가 Search **0** · proxy/UA 우회 **0**.
 * 🔴 **브라우저가 필드를 파싱하지 않는다** — 원본을 그대로 서버 추출기에 넣는 구조를
 *    가정하고, 그 추출기가 실제로 무엇을 뽑는지만 잰다(추출기 owner 는 서버 하나).
 *
 * ── 🔴 입력의 출처를 갈라 적는다 ──────────────────────────────────────────
 * ```
 * A Farfetch        🔴 **전체 HTML 이 아니다.** 서버는 403 이라 받을 수 없고,
 *                      CPO 가 **자기 브라우저에서 읽어 전달한 JSON-LD 블록** 이다.
 *                      ⟹ microdata·DOM 전용 값(`Brand style ID`)은 **이 입력에 없다**.
 * B Junior Edition  🟢 **우리 서버가 실제로 받은 전체 HTML**(차단 사이트가 아니다).
 * ```
 */

const LIVE = process.env.BF02_LIVE === "1";

/**
 * 🔴 CPO 가 브라우저에서 읽어 전달한 구조 그대로다. **없는 필드를 지어내지 않았다** —
 *    전달받지 않은 칸은 넣지 않았다(image 등).
 */
const FARFETCH_JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "ProductGroup",
  name: "Hug Hairy Monster long-sleeve T-shirt",
  productGroupID: "37620037",
  color: "Blue",
  brand: { "@type": "Brand", name: "Bobo Choses" },
  description: "Hug Hairy Monster long-sleeve T-shirt from Bobo Choses.",
  hasVariant: [
    {
      "@type": "Product",
      sku: "37620037-6",
      offers: { "@type": "Offer", price: 46, priceCurrency: "USD" },
    },
  ],
});
const FARFETCH_HTML = `<!doctype html><html><head><script type="application/ld+json">${FARFETCH_JSONLD}</script></head><body></body></html>`;

/** 🟢 E2E 에서 실제 후보로 섰던 그 URL 이다(새로 만들지 않았다). */
const JUNIOREDITION_URL =
  "https://www.junioredition.com/en-kr/collections/bobo-choses/products/hug-hairy-monster-t-shirt-by-bobo-choses";

function report(label: string, html: string) {
  const jsonLd = extractFromJsonLd(html);
  const micro = extractMicrodataFromHtml(html);
  /* eslint-disable no-console */
  /**
   * 🔴🔴 **칸 이름을 타입에서 읽어 쓴다.** 1차에 `name`·`currency`·`images` 를 썼다가
   *    **그 타입에 없는 칸** 이라 전부 `undefined` 가 나왔고, 그걸 「추출 실패」로
   *    보고할 뻔했다(이 트랙에서 반복된 그 실수 · typecheck 가 잡았다).
   *    실제 칸 = title · brand · siteBrandName · price{amount,currency} · sku ·
   *    description · material · manufacturer · available · breadcrumbPath · …
   */
  console.log(
    `[BF02-${label}] jsonLd=${
      jsonLd
        ? JSON.stringify({
            title: jsonLd.title ?? null,
            brand: jsonLd.brand ?? null,
            siteBrandName: jsonLd.siteBrandName ?? null,
            sku: jsonLd.sku ?? null,
            price: jsonLd.price ?? null,
            material: jsonLd.material ?? null,
            description: jsonLd.description ? `${jsonLd.description.length}자` : null,
          })
        : "null"
    }`,
  );
  console.log(
    `[BF02-${label}] microdata=${micro ? JSON.stringify({ title: micro.title ?? null, price: micro.price ?? null, sku: micro.sku ?? null }) : "null"}`,
  );
  /** 🔴 모델코드는 **추출기가 주는 칸이 아니다** — 원문에 글자가 있는지만 센다. */
  console.log(`[BF02-${label}] "B226AC009" 원문 등장: ${(html.match(/B226AC009/gi) ?? []).length}회`);
  return { jsonLd, micro };
}

describe("BROWSER-FALLBACK-02 — 기존 추출기가 브라우저 HTML 에서 무엇을 뽑는가", () => {
  it("A 🔴 Farfetch — **CPO 가 브라우저에서 읽은 JSON-LD 블록** 으로만 돌린다", () => {
    const { jsonLd } = report("farfetch", FARFETCH_HTML);
    /**
     * 🟢 `ProductGroup → hasVariant` 는 기존 추출기가 **이미** 안다(N-3.54 · Smallable).
     *    🔴 그래서 이 PoC 는 「새 추출기가 필요하다」가 아니라
     *       「**입구만 있으면 된다**」를 확인하는 것이다.
     */
    expect(jsonLd, "ProductGroup 을 못 읽었다").not.toBeNull();
    /** 🔴 수치를 미리 고정하지 않는다 — 어떤 칸이 살아남는지는 **측정 대상** 이다. */
  });

  it.runIf(LIVE)(
    "B 🟢 Junior Edition — **우리 서버가 받은 실제 HTML**(차단 사이트 아님)",
    async () => {
      const res = await fetch(JUNIOREDITION_URL, { signal: AbortSignal.timeout(25_000) });
      console.log(`[BF02-junioredition] HTTP ${res.status}`);
      const html = await res.text();
      console.log(`[BF02-junioredition] bytes=${html.length}`);
      const types = [...html.matchAll(/"@type"\s*:\s*"([A-Za-z]+)"/g)].map((m) => m[1]!);
      console.log(`[BF02-junioredition] JSON-LD @type 전수: ${[...new Set(types)].join(" · ") || "(없음)"}`);
      report("junioredition", html);
      expect(res.status).toBe(200);
    },
    120_000,
  );
});
