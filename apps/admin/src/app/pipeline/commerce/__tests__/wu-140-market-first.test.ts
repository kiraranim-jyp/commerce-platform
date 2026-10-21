// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import {
  MARKET_EMPTY_NO_CANDIDATE,
  MARKET_EMPTY_REVIEW_HINT,
  MARKET_JUDGEMENT_TITLE,
  MARKET_RESULT_HEADING,
  countMarketCandidates,
  countPendingCandidates,
  countUnresolvedMarketCandidates,
  marketEmptyNote,
  marketUnresolvedNote,
} from "../mi-same-candidates";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-140 — **결론이 «먼저» 오고, 시장이 빈 «이유» 를 말한다** (CPO NO-GO 수리)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 판정(2026-10-21): 현재 화면 **NO-GO** — 「기술이 없어서가 아니라 **셀러가
 *    원하는 답을 한눈에 얻을 수 없는 UX**」. 이 WU 는 **새 MI 기능이 아니다** —
 *    WU-139 가 이미 낸 결과를 셀러가 **먼저** 읽게 만드는 작업이다.
 *
 * 🔴🔴 **성공 기준이 「위로 올라갔다」가 아니다**(CPO 그대로):
 * > 페이지를 열었을 때 셀러가 **후보 목록을 읽지 않아도** 🇰🇷/🌎 의 동일상품 수 ·
 * > 판매중 수 · 확인 가격 · 가격 확인 필요 여부를 **먼저** 이해할 수 있는가.
 *
 * ── 🔴 그래서 이 파일은 «순서» 를 단언한다 ─────────────────────────────────
 * 지금까지 이 영역의 계약은 **전부 testid 존재/내용** 단언이라 **순서를 뒤집어도
 * 하나도 FAIL 하지 않았다**(실제로 WU-136 이 후보를 접었지만 순서를 안 바꿨고,
 * 그 상태가 CPO NO-GO 를 받았다). 🟢 그 구멍을 **DOM 순서** 로 메운다.
 *
 * 🔴 MI 완화 **0** — threshold · 8축 · SAME 기준 · confidence 전부 불변이다.
 *    이 파일에는 판정 어휘가 **입력으로도** 들어오지 않는다(운영 산출을 그대로 쓴다).
 * 🔴 네트워크 0 · DB 0.
 */

/** 🔴 실측 모양 그대로다(WU-139 E2E 의 해외 SAME 행). 지어낸 칸 0. */
const sameRow = (over: Partial<GeminiTransientRow> = {}): GeminiTransientRow => ({
  source: "OVERSEAS_AUTO",
  domain: "a.example",
  title: "Hug Hairy Monster T-shirt",
  imageUrl: null,
  soldOut: false,
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

/** 🔴 보류 후보(가격은 확인됐고 SAME 이 아니다) — WU-133 의 tinyapple 행 모양. */
const pendingRow = (over: Partial<GeminiTransientRow> = {}): GeminiTransientRow =>
  sameRow({
    domain: "tinyapple.net",
    discoveredUrl: "https://www.tinyapple.net/products/x",
    matchTruth: "TEXT_CONFIRMED",
    priceTier: "COMPARISON",
    crossSellerVerdict: "PRESUMED_SAME",
    crossSellerBlockers: ["BRAND_UNCONFIRMED"],
    soldOut: null,
    ...over,
  });

/* ═════════════ A. 🔴 시장별 상태 — ⒜ 와 ⒝ 가 «다른 문장» 이다 (순수) ═════════════ */

describe("A. 🔴🔴 countPendingCandidates 의 market 인자 (CPO: 상태 의미의 핵심 수정)", () => {
  const rows = [
    pendingRow({ domain: "kr-pending.kr", discoveredUrl: "https://kr-pending.kr/1", market: "KR" }),
    pendingRow({ domain: "os-pending.com", discoveredUrl: "https://os-pending.com/2", market: "OVERSEAS" }),
  ];

  it("🔴🔴 A-1 시장을 주면 **그 시장만** 센다 — 두 시장이 섞이지 않는다", () => {
    expect(countPendingCandidates(rows, "KR").count).toBe(1);
    expect(countPendingCandidates(rows, "OVERSEAS").count).toBe(1);
    /** 🟢 인자를 **주지 않으면 전과 똑같다**(전역 집계 · 기존 호출부 불변). */
    expect(countPendingCandidates(rows).count).toBe(2);
  });

  it("🔴 A-2 시장이 확정되지 않은 후보는 **어느 시장에도** 들어가지 않는다", () => {
    /** 🔴 WU-020 §4 — `UNKNOWN` 을 국내로도 해외로도 세지 않는다(시장을 추측하지 않는다). */
    const mixed = [...rows, pendingRow({ domain: "u.com", discoveredUrl: "https://u.com/3", market: "UNKNOWN" } as never)];
    expect(countPendingCandidates(mixed, "KR").count).toBe(1);
    expect(countPendingCandidates(mixed, "OVERSEAS").count).toBe(1);
    /** 🟢 그래서 전역 합(3)이 두 시장의 합(2)보다 **클 수 있다** — 그것이 정확한 상태다. */
    expect(countPendingCandidates(mixed).count).toBe(3);
  });

  it("🔴 A-3 사유도 시장별로 갈린다 — 내부 토큰은 노출하지 않는다", () => {
    const kr = countPendingCandidates(rows, "KR");
    expect(kr.reasons.map((r) => r.text).join()).not.toContain("BRAND_UNCONFIRMED");
    expect(kr.reasons.map((r) => r.n)).toEqual([1]);
  });

  it("🔴🔴 A-4 `countMarketCandidates` 는 **판정·가격과 무관하게** 센다", () => {
    /**
     * 🔴 이 함수가 왜 필요한가 — `countPendingCandidates` 는 **가격까지 확인된** 후보만
     *    센다. 가격 없는 보류 후보가 있어도 **0** 이고, 그 0 을 「후보 없음」으로 적으면
     *    **거짓** 이다. ⒜ 와 ⒝ 는 그 거짓 위에서 갈릴 수 없다.
     */
    const noPrice = [
      pendingRow({ market: "KR", discoveredUrl: "https://k1.kr/1", priceAmount: null, priceCurrency: null, priceStatus: null }),
      pendingRow({ market: "KR", discoveredUrl: "https://k2.kr/2", priceAmount: null, priceCurrency: null, priceStatus: null }),
    ];
    expect(countPendingCandidates(noPrice, "KR").count).toBe(0);
    expect(countMarketCandidates(noPrice, "KR")).toBe(2);
    expect(countMarketCandidates(noPrice, "OVERSEAS")).toBe(0);
  });

  it("🔴 A-5 URL 중복은 접는다 — 네 생산자가 같은 판매처를 낼 수 있다", () => {
    const dup = [pendingRow({ market: "KR" }), pendingRow({ market: "KR", source: "REVIEWED_SAME" })];
    expect(countMarketCandidates(dup, "KR")).toBe(1);
  });
});

describe("B. 🔴🔴 marketEmptyNote — ⒜ 검색 실패 ↔ ⒝ 판정 보류", () => {
  const none = { count: 0, reasons: [] };

  it("🔴 B-1 후보가 0 이면 ⒜ 다 — 「동일상품이 없다」로 **적지 않는다**", () => {
    const note = marketEmptyNote(0, none);
    expect(note).toBe(MARKET_EMPTY_NO_CANDIDATE);
    /** 🔴 부재와 미발견은 다르다(WU-091 어휘 계약). */
    expect(note).toContain("찾지 못했습니다");
    expect(note).not.toMatch(/없습니다|없다/);
  });

  it("🔴🔴 B-2 후보가 있으면 ⒝ 이고 **문장이 완전히 다르다**", () => {
    const note = marketEmptyNote(3, { count: 2, reasons: [{ text: "브랜드 미확인", n: 2 }] });
    expect(note).toContain("후보 3곳");
    expect(note).toContain("브랜드 미확인 2");
    /** 🟢 셀러가 할 **행동** 을 말한다 — ⒜ 는 기다리는 것, ⒝ 는 사진으로 판단하는 것. */
    expect(note).toContain(MARKET_EMPTY_REVIEW_HINT);
    /** 🔴🔴 둘이 **같은 빈 칸** 이 되면 이 WU 가 고친 것이 되돌아간다. */
    expect(note).not.toBe(MARKET_EMPTY_NO_CANDIDATE);
  });

  it("🔴 B-3 사유를 **지어내지 않는다** — 없으면 사유 절이 아예 없다", () => {
    const note = marketEmptyNote(2, none);
    expect(note).toContain("후보 2곳");
    expect(note).not.toContain("주요 사유");
  });
});

/* ═════════════ C. 🔴🔴 화면 순서 (마운트 DOM — 셀러가 실제로 보는 것) ═════════════ */

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
/** 🔴 「먼저 온다」를 **문서 순서** 로 본다 — 존재 단언만으로는 순서를 못 지킨다. */
const pos = (id: string): number => {
  const el = q(id);
  if (!el) return -1;
  const all = Array.from(container.querySelectorAll("*"));
  return all.indexOf(el);
};

describe("C. 🔴🔴🔴 CPO 확정 순서 — 🇰🇷 → 🌎 → 판단 결과 → 상세 근거", () => {
  const twoMarkets = [
    sameRow({ domain: "k.example", discoveredUrl: "https://k.example/1", market: "KR", priceCurrency: "KRW", priceAmount: 88000 }),
    sameRow({ domain: "o.example", discoveredUrl: "https://o.example/2" }),
  ];

  it("🔴🔴🔴 C-1 시장 블록이 **판매처 표보다 먼저** 온다(전에는 뒤였다)", async () => {
    await mount({ rows: twoMarkets });
    const blocks = pos("market-blocks");
    expect(blocks).toBeGreaterThan(-1);
    /** 🔴 이 네 줄이 이 WU 의 핵심이다 — 뒤집으면 CPO NO-GO 화면으로 돌아간다. */
    expect(blocks).toBeLessThan(pos("market-seller-table"));
    expect(blocks).toBeLessThan(pos("market-judgement"));
    expect(blocks).toBeLessThan(pos("market-verdict"));
    expect(blocks).toBeLessThan(pos("mi-detail-fold"));
  });

  it("🔴 C-2 🇰🇷 국내가 🌎 해외보다 먼저 온다(셀러의 질문 순서)", async () => {
    await mount({ rows: twoMarkets });
    expect(pos("market-block-domestic")).toBeLessThan(pos("market-block-overseas"));
    /** 🟢 가격 가이드는 그 블록 **안** 에 있다 — 영역이 둘로 갈라지지 않는다. */
    expect(q("market-block-domestic")!.querySelector('[data-testid="price-guide-domestic"]')).toBeTruthy();
    expect(q("market-block-overseas")!.querySelector('[data-testid="price-guide-overseas"]')).toBeTruthy();
  });

  it("🔴 C-3 제목이 맨 위이고 상세 근거가 **맨 아래** 다", async () => {
    await mount({ rows: twoMarkets });
    expect(container.textContent).toContain(MARKET_JUDGEMENT_TITLE);
    expect(container.textContent).toContain(MARKET_RESULT_HEADING);
    /** 🔴 기술 데이터는 **접혀** 있다(삭제 0 · WU-136 R-7 과 같은 축). */
    expect((q("mi-detail-fold") as HTMLDetailsElement).open).toBe(false);
    expect(pos("mi-detail-fold")).toBeGreaterThan(pos("market-judgement"));
  });

  it("🔴🔴 C-4 셀러가 **후보 목록을 읽지 않고도** 네 수치를 읽는다(CPO 성공 기준)", async () => {
    await mount({ rows: twoMarkets });
    const kr = q("market-block-domestic")!.textContent ?? "";
    /** 동일상품 수 · 판매중 수 · 확인 가격 · (필요하면) 가격 확인 필요 수. */
    expect(kr).toContain("동일상품 확인 1곳");
    expect(kr).toContain("판매중 확인 1곳");
    expect(kr).toContain("가격 확인 1곳");
    expect(kr).toContain("KRW 88000");
    /** 🔴 환산 0 — 한쪽 통화가 다른 블록에 나타나지 않는다. */
    expect(kr).not.toContain("USD");
    expect(q("market-block-overseas")!.textContent).not.toContain("KRW");
  });
});

describe("D. 🔴🔴 시장이 비었을 때 — 네 상태가 화면에서 갈린다", () => {
  it("🔴🔴 D-1 ⒜ 후보 0 인 시장은 「찾지 못했습니다」라고 적는다", async () => {
    /** 🔴 국내 실측이 이 모양이다 — tier SAME **0**(WU-138 에서 원인 확정 · 완화 REJECT). */
    await mount({ rows: [sameRow()] });
    expect(q("market-empty-domestic")?.textContent).toBe(MARKET_EMPTY_NO_CANDIDATE);
    /** 🔴 빈 틀을 만들지 않는다 — 기준가 블록은 **렌더되지 않는다**(wu-139 C-4). */
    expect(q("price-guide-domestic")).toBeNull();
    expect(q("price-guide-overseas")).toBeTruthy();
  });

  it("🔴🔴🔴 D-2 ⒝ 후보는 있는데 SAME 0 이면 **다른 문장** 을 적는다", async () => {
    await mount({
      rows: [
        sameRow(),
        pendingRow({ domain: "biskuit.kr", discoveredUrl: "https://biskuit.kr/p/1", market: "KR" }),
      ],
    });
    const kr = q("market-empty-domestic")!.textContent ?? "";
    /** 🔴🔴 **이것이 CPO STEP 6-4 가 지적한 그 자리다** — ⒜ 와 ⒝ 가 같은 빈 칸이었다. */
    expect(kr).not.toBe(MARKET_EMPTY_NO_CANDIDATE);
    expect(kr).toContain("후보 1곳");
    expect(kr).toContain(MARKET_EMPTY_REVIEW_HINT);
    /** 🔴 내부 토큰을 셀러에게 보여주지 않는다. */
    expect(container.textContent).not.toContain("BRAND_UNCONFIRMED");
    expect(container.textContent).not.toContain("PRESUMED_SAME");
  });

  it("🔴 D-3 ⒞ SAME 인데 가격이 없으면 기준가를 **지어내지 않는다**", async () => {
    await mount({
      rows: [sameRow({ market: "KR", priceAmount: null, priceCurrency: null, priceStatus: null })],
    });
    const kr = q("market-block-domestic")!.textContent ?? "";
    expect(kr).toContain("동일상품 확인 1곳");
    expect(kr).toContain("가격 확인 필요 1곳");
    expect(q("price-guide-headline")).toBeNull();
    expect(q("price-guide-empty")).toBeTruthy();
    /** 🟢 그 후보는 **버려지지 않는다** — 판매처 표에 🔗 링크로 선다(WU-139 계약). */
    expect(q("market-seller-price-link")?.getAttribute("href")).toBe("https://a.example/products/x");
  });

  it("🟢 D-4 두 시장이 다 비어도 **영역은 선다** — 「조회했다」와 「후보 없음」은 다르다", async () => {
    await mount({ rows: [] });
    expect(q("market-price-comparison")).toBeTruthy();
    expect(q("market-empty-domestic")?.textContent).toBe(MARKET_EMPTY_NO_CANDIDATE);
    expect(q("market-empty-overseas")?.textContent).toBe(MARKET_EMPTY_NO_CANDIDATE);
  });

  it("🔴 D-5 조회가 돌지 않았으면 아무것도 그리지 않는다(기존 계약 유지)", async () => {
    await mount({ rows: null });
    expect(container.textContent).toBe("");
  });
});

/* ═════ E. 🔴🔴 시장 미확정 후보 — 「없다」와 「모른다」를 같은 말로 적지 않는다 ═════ */

describe("E. 🔴🔴🔴 시장을 확인하지 못한 후보를 «조용히 없애지 않는다»", () => {
  /**
   * 🔴🔴 **실측 근거(가정 아님)** — WU-138 하니스 · 2026-10-21:
   * `B226AC010` 의 `www.beaumonde.co.kr` 은 **사람이 SAME 이라 한 `.kr` 후보** 인데
   * **가격이 없어서** 시장 축이 `UNKNOWN` 으로 남는다(WU-077 ⒞).
   * ⟹ 🔴 그러면 🇰🇷 블록이 「후보를 찾지 못했습니다」라고 말한다 — **한국 도메인
   *    후보가 실재하는데** 말이다. 그것이 화면이 거짓말하는 모양이다.
   */
  const unresolved = () =>
    pendingRow({
      domain: "www.beaumonde.co.kr",
      discoveredUrl: "https://www.beaumonde.co.kr/goods/x",
      market: "UNKNOWN",
      priceAmount: null,
      priceCurrency: null,
      priceStatus: null,
    } as never);

  it("🔴🔴 E-1 두 블록에 **세지 않는다** — 시장을 지어내지 않는다(WU-020 §4)", () => {
    expect(countMarketCandidates([unresolved()], "KR")).toBe(0);
    expect(countMarketCandidates([unresolved()], "OVERSEAS")).toBe(0);
    expect(countUnresolvedMarketCandidates([unresolved()])).toBe(1);
  });

  it("🔴 E-2 `market` 칸이 **없는** 후보도 미확정으로 센다", () => {
    const noMarket = pendingRow({ discoveredUrl: "https://n.example/1", market: null } as never);
    expect(countUnresolvedMarketCandidates([noMarket])).toBe(1);
    /** 🟢 확정된 시장은 **세지 않는다** — 두 숫자가 겹치면 분모가 두 번 세어진다. */
    expect(countUnresolvedMarketCandidates([sameRow()])).toBe(0);
  });

  it("🔴🔴🔴 E-3 화면이 그 사실을 **말한다** — 「찾지 못했다」로 끝내지 않는다", async () => {
    await mount({ rows: [unresolved()] });
    /** 🔴 이 줄이 없으면 🇰🇷 블록의 「찾지 못했습니다」가 **거짓** 이 된다. */
    const note = q("market-unresolved");
    expect(note).toBeTruthy();
    expect(note!.textContent).toContain("1곳");
    expect(note!.textContent).toContain("확인하지 못한");
    /** 🟢 어디서 볼 수 있는지까지 말한다 — 「사라졌다」가 아니다. */
    expect(note!.textContent).toMatch(/상세 근거|검토 구역/);
    /** 🔴 시장을 승격하지 않았다 — 두 블록은 여전히 「찾지 못했습니다」다. */
    expect(q("market-empty-domestic")?.textContent).toBe(MARKET_EMPTY_NO_CANDIDATE);
    expect(q("market-empty-overseas")?.textContent).toBe(MARKET_EMPTY_NO_CANDIDATE);
  });

  it("🔴 E-4 미확정이 0 이면 **그 줄을 만들지 않는다**(없는 말을 적지 않는다)", async () => {
    await mount({ rows: [sameRow()] });
    expect(q("market-unresolved")).toBeNull();
    expect(marketUnresolvedNote(0)).toBeNull();
  });
});
