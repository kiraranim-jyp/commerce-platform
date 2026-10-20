// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import { MI_SAME_EMPTY } from "../mi-same-candidates";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-133 — **「비었다」로 끝내지 않는다** (마운트 DOM)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **왜 «별» 파일인가 — 환경이 다르면 측정이 거짓이 된다.**
 *    처음에는 라이브 추적 하니스(`wu-133-same-trace`)에 이 테스트를 같이 두려고
 *    그 파일에 `@vitest-environment jsdom` 을 붙였다. 그 순간 crawler 의 fetch
 *    경로가 **전건 UNREACHABLE** 이 되고(같은 URL 을 curl 은 200 으로 받는다)
 *    funnel 이 **전부 0** 으로 나왔다 — 🔴 그대로 보고했으면 「Discovery 가 완전히
 *    죽었다」는 거짓 결론이었다. 🟢 그래서 **라이브 fetch 축과 마운트 DOM 축을
 *    파일로 가른다**(헌장 §5 「Render PASS ≠ 소스 PASS」의 환경 버전).
 *
 * ── 🔴 이 파일이 잠그는 사실 ───────────────────────────────────────────────
 * WU-133 전수 추적: human SAME 13건 중 **판정까지 간 7건이 전부 보류/충돌** 이고
 * 그중 6건은 **가격까지 확보** 돼 있다. 🔴 그런데 WU-132 의 화면은 「동일상품으로
 * 판정되고 가격까지 확인된 후보가 아직 없습니다」만 말했다 — 그 아래에 그 6건이
 * 서 있는데 말이다. 그건 **거짓** 이고, 이 파일이 그 거짓의 재발을 막는다.
 */

/** 🔴 실측 모양 그대로다(WU-133 B 의 tinyapple 행). 지어낸 값 0. */
const pendingRow = (over: Partial<GeminiTransientRow> = {}): GeminiTransientRow => ({
  source: "REVIEWED_SAME",
  domain: "tinyapple.net",
  title: "Bobo Choses Hug Hairy Monster T-shirt",
  imageUrl: null,
  soldOut: null,
  discoveredUrl: "https://www.tinyapple.net/products/x",
  matchTruth: "TEXT_CONFIRMED",
  priceTier: "COMPARISON",
  crossSellerVerdict: "PRESUMED_SAME",
  confidence: 0.6,
  matchReasons: [],
  crossSellerBlockers: ["BRAND_UNCONFIRMED"],
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

describe("WU-133 — 보류 사유가 화면에 선다 (마운트 DOM)", () => {
  it("🔴🔴 가격까지 있는데 보류된 후보가 있으면 **그 사실과 사유를 적는다**", async () => {
    await mount({ rows: [pendingRow()] });
    const el = container.querySelector('[data-testid="mi-same-pending"]');
    expect(el).not.toBeNull();
    expect(el!.textContent).toContain("1건");
    expect(el!.textContent).toContain("브랜드 미확인");
    /** 🔴 내부 토큰을 **그대로 노출하지 않는다**(WU-056 의 `EXCLUDED` 누출 재발 방지). */
    expect(el!.textContent).not.toContain("BRAND_UNCONFIRMED");
    /** 🟢 「동일상품 0건」 문장도 **같이** 선다 — 둘 다 사실이다. */
    expect(container.textContent).toContain(MI_SAME_EMPTY);
  });

  it("🔴 보류가 0 이면 **그 줄을 만들지 않는다**(없는 말을 적지 않는다)", async () => {
    await mount({ rows: [] });
    expect(container.querySelector('[data-testid="mi-same-pending"]')).toBeNull();
    /** 🟢 영역 자체는 선다 — 「조회했다」와 「후보 없음」은 다른 사실이다(WU-130 ②). */
    expect(container.querySelector('[data-testid="market-price-comparison"]')).not.toBeNull();
  });

  it("🔴 SAME 후보가 있으면 그 행이 서고, 보류 줄은 그 행을 **중복해서 세지 않는다**", async () => {
    await mount({
      rows: [
        pendingRow({ matchTruth: "EXACT_IDENTIFIER", discoveredUrl: "https://a.com/1", domain: "a.com" }),
        pendingRow(),
      ],
    });
    expect(container.querySelectorAll('[data-testid="mi-same-row"]')).toHaveLength(1);
    expect(container.querySelector('[data-testid="mi-same-pending"]')!.textContent).toContain("1건");
  });
});
