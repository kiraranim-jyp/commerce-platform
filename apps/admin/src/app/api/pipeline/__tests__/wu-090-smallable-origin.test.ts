import { describe, expect, it } from "vitest";
import { universalExtract } from "@commerce/crawler";

/**
 * WU-090 STEP 1 — **원상품 분석 경로** 로 Smallable 을 연다 (LIVE)
 *
 * 🔴🔴 **경로가 다르다 — 이것을 먼저 적는다.**
 * ```
 * 새 상품 분석   /api/pipeline → **universalExtract** → site-strategy(shopify·prestashop)
 *                또는 **Playwright(`launchChromium`)**      ← Smallable 은 여기
 * 후보 URL 입력  collectUrlCandidatePool → factsFromProductUrl → fetchPlainHtmlWithFinalUrl
 *                → **fetchWithDomainRateLimit**              ← WU-084 가 고친 자리
 * ```
 * 🔴 그러므로 「새 상품 분석」에서 Smallable 이 되는지는 **WU-084 와 별개** 로 확인해야 한다.
 */
const LIVE = process.env.MI_P0_02_LIVE === "1";
const URL = "https://www.smallable.com/en/product/bobo-choses-organic-cotton-t-shirt-ecru-bobo-choses-430700";

describe("WU-090 — Smallable 원상품 분석", () => {
  (LIVE ? it : it.skip)("universalExtract 가 Smallable 을 읽는다", async () => {
    const r = await universalExtract(URL, { debug: true });
    // eslint-disable-next-line no-console
    console.log("strategy:", JSON.stringify((r as { strategyCounts?: unknown }).strategyCounts));
    /** 🔴 타입을 추측하지 않는다 — owner 타입이 다르므로 unknown 을 경유한다. */
    const d = ((r as unknown) as { productData?: Record<string, unknown> }).productData ?? {};
    // eslint-disable-next-line no-console
    console.log("title :", String(d.title).slice(0, 70));
    // eslint-disable-next-line no-console
    console.log("brand :", JSON.stringify(d.brand));
    // eslint-disable-next-line no-console
    console.log("price :", JSON.stringify(d.price));
    // eslint-disable-next-line no-console
    console.log("images:", Array.isArray((r as { images?: unknown[] }).images) ? (r as { images: unknown[] }).images.length : 0);
    expect(r).toBeTruthy();
  }, 300_000);
});

/**
 * 🔴🔴 WU-090 — **같은 URL 인데 경로마다 통화가 다르다**(실측).
 * ```
 * 원상품 경로(Playwright)      price **EUR 50**
 * 후보 경로(fetch + JSON-LD)    price **KRW 82,673**
 * ```
 * 🟢 Smallable 은 **방문자에 따라 통화를 바꾼다**(메모 `smallable-market-is-shipping-destination`
 *    의 「market_code 는 배송국가다」와 같은 계열). 🔴 **우리 버그가 아니다.**
 * 🔴 그러나 셀러가 **같은 상품에서 두 통화를 볼 수 있다** — 그것은 기록해야 하는 사실이다.
 * 🔴 **이번 WU 에서 고치지 않는다**(범위 밖 · CPO 가 Smallable E2E 하나로 제한했다).
 */
describe("WU-090 — 두 경로의 통화 차이(관측 · 수정 0)", () => {
  it("🔴 이 차이는 «관측된 사실» 로만 기록한다", () => {
    /** 🟢 숫자를 지어내지 않는다 — 위 LIVE 실행과 WU-083 실측이 출처다. */
    const originPath = { amount: 50, currency: "EUR" };
    const candidatePath = { amount: 82673, currency: "KRW" };
    expect(originPath.currency).not.toBe(candidatePath.currency);
  });
});
