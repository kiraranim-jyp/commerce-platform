// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import { MARKET_JUDGEMENT_TITLE, MARKET_VERDICT_TEXT } from "../mi-same-candidates";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-136 — **셀러가 보는 것**은 마운트한 DOM 으로만 선언한다 (헌장 §5)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 소스 문자열 검사는 「그 줄이 있다」까지만 말한다. 「셀러가 그것을 본다」는
 *    **마운트해서** 봐야 한다 — 이 저장소가 여러 번 당한 그 함정이다.
 * 🔴 라이브 fetch 축과 **파일을 가른다**(jsdom 이 crawler fetch 를 죽인 WU-133 사례).
 * 🔴 네트워크 0 · DB 0.
 */

/** 🔴 실측 모양 그대로다(WU-134 E2E 의 해외 SAME 행). 지어낸 칸 0. */
const sameRow = (over: Partial<GeminiTransientRow> = {}): GeminiTransientRow => ({
  source: "OVERSEAS_AUTO",
  domain: "a.example",
  title: "Hug Hairy Monster T-shirt",
  imageUrl: null,
  soldOut: null,
  discoveredUrl: "https://a.example/products/x",
  matchTruth: "EXACT_IDENTIFIER",
  priceTier: "EXACT",
  crossSellerVerdict: "SAME",
  confidence: 1,
  matchReasons: [],
  crossSellerBlockers: [],
  crossSellerConflicts: [],
  priceAmount: 58,
  priceCurrency: "USD",
  priceStatus: "VERIFIED_CURRENT",
  market: "OVERSEAS",
  basis: "FOREIGN_CURRENCY_AND_NO_KR_EVIDENCE",
  ...over,
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // @ts-expect-error — act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const mount = async (props: Record<string, unknown>) => {
  await act(async () => {
    root.render(createElement(MarketPriceComparison, props as never));
  });
};

const q = (id: string) => container.querySelector(`[data-testid="${id}"]`);
const txt = (id: string) => q(id)?.textContent ?? "";

describe("WU-136 — 시장 판매 판단 (마운트 DOM)", () => {
  it("🔴🔴 R-1 최상단이 「팔아도 되는가」 이고 제목이 판매 판단이다", async () => {
    await mount({ rows: [sameRow({ soldOut: false })] });
    expect(container.textContent).toContain(MARKET_JUDGEMENT_TITLE);
    expect(txt("market-verdict")).toBe(MARKET_VERDICT_TEXT.ON_SALE);
  });

  it("🔴🔴 R-2 판매처 네 칸이 실제로 그려진다", async () => {
    await mount({ rows: [sameRow({ soldOut: false })] });
    const cells = container.querySelector('[data-testid="market-seller-row"]')?.textContent ?? "";
    expect(cells).toContain("🌎 해외");
    expect(cells).toContain("a.example");
    expect(cells).toContain("판매중");
    expect(cells).toContain("USD 58");
  });

  it("🔴🔴 R-3 판매여부 미확인이 「판매중」으로 «보이지 않는다»", async () => {
    await mount({ rows: [sameRow({ soldOut: null })] });
    expect(txt("market-seller-sale")).toContain("확인불가");
    expect(txt("market-verdict")).toBe(MARKET_VERDICT_TEXT.SAME_BUT_NONE_ON_SALE);
    /** 🔴 판매처 수가 0 이다 — 모르는 것을 세지 않는다. */
    expect(txt("market-sale-counts")).toContain("판매중 확인 0곳");
    /** 🔴 그래도 시장가는 보이고, **그 줄이 분모를 직접 말한다**. */
    expect(txt("market-price-range")).toContain("판매중 확인 0곳");
  });

  it("🔴 R-4 품절은 판매중에 안 들어가고 가격 축에서도 빠진다", async () => {
    await mount({ rows: [sameRow({ soldOut: true })] });
    expect(txt("market-sale-counts")).toContain("품절 1곳");
    expect(q("market-price-range")).toBeNull();
  });

  it("🔴 R-5 동일상품 판정이 없으면 표를 만들지 않고 그 사실을 말한다", async () => {
    await mount({
      rows: [sameRow({ matchTruth: undefined, crossSellerVerdict: "PRESUMED_SAME", priceTier: "COMPARISON" })],
    });
    expect(txt("market-verdict")).toBe(MARKET_VERDICT_TEXT.NO_SAME);
    expect(q("market-seller-table")).toBeNull();
  });

  it("🔴 R-6 가격을 확인하지 못하면 숫자를 지어내지 않는다", async () => {
    await mount({ rows: [sameRow({ soldOut: false, priceStatus: "UNVERIFIED_SEARCH" })] });
    /**
     * 🔴🔴 WU-139 — **앵커를 갱신하고 «강화» 했다.** 그 칸이 「가격 확인 필요」라는
     *    **글자** 였는데, 이제 **판매처로 가는 링크** 다(CPO: 「가격을 못 가져오는
     *    판매처는 버리지 않는다 — 링크를 보여주고 셀러가 직접 확인하게 한다」).
     * 🟢 지키는 성질은 그대로다 — **가격을 지어내지 않는다.**
     * 🔴 **강화** — 「숫자가 없다」에 더해 **「그 자리가 실제 링크이고 href 가 그
     *    후보 URL 이다」** 까지 단언한다. 글자로 되돌리면 FAIL 한다.
     */
    const priceCell = q("market-seller-price");
    expect(priceCell?.textContent).not.toMatch(/\d/);
    const link = q("market-seller-price-link") as HTMLAnchorElement | null;
    expect(link?.tagName).toBe("A");
    expect(link?.getAttribute("href")).toBe("https://a.example/products/x");
    expect(txt("market-verdict")).toBe(MARKET_VERDICT_TEXT.ON_SALE_NO_PRICE);
  });

  it("🔴🔴 R-7 기술/참고 정보는 «접혀» 있다 — 그래도 DOM 에 남아 있다(삭제 0)", async () => {
    await mount({ rows: [sameRow({ soldOut: false })] });
    const fold = q("mi-detail-fold") as HTMLDetailsElement | null;
    expect(fold).toBeTruthy();
    expect(fold?.open).toBe(false);
    /** 🟢 「치웠다」이고 「지웠다」가 아니다 — 기존 블록이 그대로 있다. */
    expect(q("mi-same-domestic")).toBeTruthy();
    expect(q("mi-same-overseas")).toBeTruthy();
    expect(container.querySelectorAll('[data-testid="mi-same-row"]').length).toBeGreaterThan(0);
  });

  it("🔴 R-8 내부 토큰이 화면 글자에 노출되지 않는다", async () => {
    await mount({ rows: [sameRow({ soldOut: false, crossSellerBlockers: ["BRAND_UNCONFIRMED"] })] });
    const text = container.textContent ?? "";
    for (const token of ["VERIFIED_CURRENT", "EXACT_IDENTIFIER", "BRAND_UNCONFIRMED", "PRESUMED_SAME"]) {
      expect(text, token).not.toContain(token);
    }
  });

  it("🟢 R-9 조회가 돌지 않았으면 영역이 서지 않는다 (기존 계약 유지)", async () => {
    await mount({ rows: null });
    expect(container.textContent).toBe("");
  });

  it("🔴🔴 R-10 국내·해외 판매중이 갈려 보인다", async () => {
    await mount({
      rows: [
        sameRow({ soldOut: false, domain: "k.example", discoveredUrl: "https://k.example/1", market: "KR", priceCurrency: "KRW", priceAmount: 88000 }),
        sameRow({ soldOut: false, domain: "o.example", discoveredUrl: "https://o.example/2" }),
      ],
    });
    expect(txt("market-split")).toContain("국내 1곳");
    expect(txt("market-split")).toContain("해외 1곳");
    /**
     * 🔴🔴 CPO §3 — **「시장 전체 판매처」로 읽히게 두지 않는다.**
     *    판매여부는 현재 Shopify 경로에서만 확정되므로(실측 2/9) 이 숫자는 시장을
     *    대표하지 않는다. 🔴 수식어를 떼면 「🇰🇷 1곳 · 🌎 1곳」이 시장 전체 집계로
     *    읽히고, 그것이 「모르는 것을 판매중으로 세는 것」과 같은 종류의 거짓이다.
     */
    expect(txt("market-split")).toContain("판매중 확인");
    expect(txt("market-split")).not.toMatch(/시장\s*(전체|판매처)/);
    /** 🔴 환산하지 않는다 — 두 통화가 각각 선다. */
    expect(txt("market-price-range")).toContain("KRW");
    expect(txt("market-price-range")).toContain("USD");
    expect(txt("market-price-range")).not.toContain("약");
  });
});
