// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import { MI_SAME_EMPTY } from "../mi-same-candidates";
/** 🔴 WU-145 — 사유 어휘의 owner 는 `blocker-text.ts` 다. 테스트가 그 표를 **전수로** 돈다. */
import { KNOWN_BLOCKER_TOKENS, blockerText } from "../blocker-text";
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
  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴🔴 WU-145 ① 에서 **갱신·강화됨** — 「사유를 1차에 적는다」가 뒤집혔다
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 CPO STEP 3(2026-10-22): 「MI blocker 는 **기본 노출 없음** · 후보 조사는
   *    **2차 근거로 격리**」. ⟹ 1차의 사유 어휘(「브랜드 미확인 5 · 품번 충돌 2」)는
   *    `▸ MI 상세 분석` 안으로 **옮겨졌다**.
   * 🔴🔴 **그래서 이 계약을 느슨하게 하지 않는다 — «양방향» 으로 강화한다**:
   * ```
   * ① 1차는 **건수를 말한다**(WU-133 이 고친 거짓말이 되돌아오지 않는다)
   * ② 1차에 **사유 어휘가 하나도 없다**  ← 새로 잠근 축(전에는 검사하지 않았다)
   * ③ 2차에 **그 사유가 그대로 있다**    ← 「지우지 않았다」를 기계가 확인한다
   * ④ 2차는 **접혀 있다**(`open` 없음)   ← 2차로 내렸다는 말이 참이어야 한다
   * ```
   * 🔴 ②③ 이 **같이** 있어야 의미가 있다 — ② 만 있으면 「지워도 통과」하고
   *    ③ 만 있으면 「1차에도 있어도 통과」한다.
   */
  it("🔴🔴 1차는 **건수만** · 사유는 **2차에 그대로** 있다 (이동 · 삭제 아님)", async () => {
    await mount({ rows: [pendingRow()] });
    const el = container.querySelector('[data-testid="mi-same-pending"]');
    expect(el).not.toBeNull();
    /** ① 건수는 1차에 남는다. */
    expect(el!.textContent).toContain("1건");
    /** ② 🔴 1차에 **사유 어휘가 없다** — 셀러의 첫 화면이 MI 내부 축 이름으로 채워지지 않는다. */
    for (const token of KNOWN_BLOCKER_TOKENS) {
      expect(el!.textContent, `1차에 사유 토큰이 남았다: ${token}`).not.toContain(blockerText(token));
    }
    /** 🔴 내부 토큰을 **그대로 노출하지 않는다**(WU-056 의 `EXCLUDED` 누출 재발 방지). */
    expect(el!.textContent).not.toContain("BRAND_UNCONFIRMED");
    /** ③ 🟢 **2차에는 그 사유가 있다** — CPO 지시는 「옮긴다」이고 「지운다」가 아니다. */
    const reasons = container.querySelector('[data-testid="mi-same-pending-reasons"]');
    expect(reasons).not.toBeNull();
    expect(reasons!.textContent).toContain("브랜드 미확인");
    expect(reasons!.textContent).not.toContain("BRAND_UNCONFIRMED");
    /** ④ 🔴 그 2차가 **접혀 있다** — 안 접혀 있으면 「2차로 내렸다」가 거짓이다. */
    const fold = container.querySelector('[data-testid="mi-detail-fold"]');
    expect(fold).not.toBeNull();
    expect(fold!.contains(reasons!)).toBe(true);
    expect(fold!.hasAttribute("open")).toBe(false);
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
