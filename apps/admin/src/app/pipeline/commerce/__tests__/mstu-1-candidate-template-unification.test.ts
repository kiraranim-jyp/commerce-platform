/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { sellerSurfaceElement, SNAPSHOT_ID } from "./seller-surface-composition";
import { productionData } from "./product-tab-composition";
import type { PriceHistoryResponse } from "../DomesticPriceIntelligencePanel";
import { stripComments } from "./source-text";
import { CANDIDATE_PRICE_USE_LABEL } from "../mi-same-candidates";
/** 🔴 **타입을 owner 에서 읽는다** — 이 트랙이 열두 번 틀린 그 자리다. */
import type { GeminiTransientRow } from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-SOURCING-CANDIDATE-TEMPLATE-UNIFICATION-1 — **시장이 카드 구조를 바꾸지 않는다**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🟢🟢 **조사 결론 — 카드는 «이미» 하나다.** `MarketColumn` 하나를 두 시장이 공유하고
 *    `mi-candidate-row` 마크업도 하나다(계약 `sourcing-candidate-unified-ux-1 U-1`).
 *    ⟹ 🔴 **다시 만들지 않았다**(CPO §6 「공통 구조를 우선 검토」 · 중복 금지).
 *
 * 🔴🔴 그런데 **U-1 이 보는 것은 「컴포넌트가 하나인가」뿐** 이다. 그것만으로는
 *    **그 하나 안에서 시장으로 분기하는 것** 을 막지 못한다 ⟹ 이 파일이 그 구멍을 닫는다:
 * ```
 * A-1  카드 블록 «안» 에 시장 분기가 **0** 이다(소스)
 * A-2  같은 후보를 🇰🇷/🌎 로 각각 렌더하면 **testid 시퀀스가 동일** 하다(마운트 DOM)
 * A-4  환산 줄은 **통화로만** 갈린다 — 시장으로 갈리지 않는다
 * ```
 * 🔴 이번에 운영에서 바꾼 것은 **testid 둘**(`mi-candidate-title` · `mi-candidate-link`)
 *    뿐이다 — 전까지 그 두 칸은 testid 가 없어 **기계로 단언할 수 없었다.**
 *    표시·순서·문구·조건·href **변경 0.**
 *
 * 🔴 **구현하지 않은 것(데이터가 없다 · 지어내지 않는다)**:
 * ```
 * CPO §4 ② 「브랜드」 별도 표시   `GeminiTransientRow` 에 brand 칸이 **없다**(상품명에만 섞임)
 * CPO §4 ⑧ 「기본 상품 옵션 정보」 그 타입에 옵션/사이즈 칸이 **없다** ⟹ 만들 수 없다
 * ⟹ 🔴 보고서에 **측정불가/정책 사안** 으로 적는다(없는 칸을 채우지 않는다).
 * ```
 */

/** 🔴 **운영 DB 실측 후보 행**(2026-11-11 읽기 전용 덤프) — 값을 지어내지 않았다. */
const REAL = [
  {
    domain: "bonbonverona.it",
    discoveredUrl: "https://bonbonverona.it/products/bobo-choses-pop-sweatshirt-b226ac033-401-bobo-choses",
    title: "Bobo Choses Pop Sweatshirt",
    matchTruth: "STRONG_IDENTIFIER",
    priceTier: "EXACT",
    crossSellerVerdict: "SAME",
    priceAmount: 62,
    priceCurrency: "EUR",
    priceStatus: "VERIFIED_CURRENT",
  },
  {
    domain: "junioredition.com",
    discoveredUrl: "https://junioredition.com/products/bobo-choses-pop-sweatshirt-by-bobo-choses",
    title: "Bobo Choses Pop Sweatshirt by Bobo Choses",
    matchTruth: "TEXT_CONFIRMED",
    priceTier: "COMPARISON",
    crossSellerVerdict: "PRESUMED_SAME",
    priceAmount: 58,
    priceCurrency: "GBP",
    priceStatus: "VERIFIED_CURRENT",
  },
  {
    domain: "kids-world.com",
    discoveredUrl:
      "https://www.kids-world.com/ko-kr/bobo-choses-sweatshirt-midnight-blue-print-p-450718.html",
    title: "Bobo Choses Sweatshirt Midnight Blue Print",
    matchTruth: "TEXT_CONFIRMED",
    priceTier: "COMPARISON",
    crossSellerVerdict: "PRESUMED_SAME",
    priceAmount: 106_000,
    priceCurrency: "KRW",
    priceStatus: "VERIFIED_CURRENT",
  },
  {
    domain: "designerkidswear.com",
    discoveredUrl: "https://designerkidswear.com/products/fendi-baby-boys-sweatshirt-blue-buh088-8ra-f19j4",
    title: "Fendi Baby Boys Sweatshirt Blue",
    matchTruth: "TEXT_CONFIRMED",
    priceTier: "COMPARISON",
    crossSellerVerdict: "PRESUMED_SAME",
    priceAmount: 530,
    priceCurrency: "CAD",
    /** 🔴 실측 그대로 — 가격은 있는데 **확인되지 않았다**(CPO §7 「가격 미확인 후보」). */
    priceStatus: "UNVERIFIED_SEARCH",
  },
  {
    domain: "coupleshot.com",
    discoveredUrl: "http://www.coupleshot.com/m/product.html?branduid=574657&special=1",
    title: "보보쇼즈 스웨트셔츠",
    matchTruth: "TEXT_CONFIRMED",
    priceTier: "COMPARISON",
    crossSellerVerdict: "PRESUMED_SAME",
    priceAmount: 135_000,
    priceCurrency: "KRW",
    priceStatus: "VERIFIED_CURRENT",
  },
] as const;

const rowOf = (i: number, market: "KR" | "OVERSEAS", over: Record<string, unknown> = {}) =>
  ({
    source: "OVERSEAS_AUTO",
    imageUrl: "https://example.com/i.jpg",
    soldOut: null,
    confidence: 0.7,
    matchReasons: ["핵심 상품명 일치"],
    crossSellerBlockers: [],
    crossSellerConflicts: [],
    ...REAL[i],
    market,
    basis: "DOMAIN",
    ...over,
  }) as unknown as GeminiTransientRow;

const AREA_SRC = readFileSync(join(__dirname, "..", "MarketPriceComparison.tsx"), "utf8").replace(
  /\r\n/g,
  "\n",
);

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
  vi.unstubAllGlobals();
});

function stubFetch(data: PriceHistoryResponse): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: unknown) => {
      const url = String(input);
      if (url === `/api/price-history/${SNAPSHOT_ID}`) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
      }
      if (url.startsWith("/api/domestic-price-sources/links")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, links: [] }) });
      }
      if (url.includes("/alerts")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, alerts: [] }) });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }),
  );
}

/** 🔴 후보는 **POST 경로** 로 준다 — 운영이 그 통로다(GET 은 transient 를 안 싣는다). */
async function mount(rows: GeminiTransientRow[]): Promise<void> {
  stubFetch(productionData());
  await act(async () => {
    root.render(
      sellerSurfaceElement({
        marketDone: true,
        autoCheckResult: { domesticShop: { domesticListingEvidence: rows } },
      }),
    );
  });
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

/** 🟢 한 시장 칸의 카드들을 **testid 시퀀스** 로 바꾼다 — 그것이 「정보 구조」다. */
function cardShapes(market: "KR" | "OVERSEAS"): string[][] {
  const col = container.querySelector(`[data-testid="mi-same-${market === "KR" ? "domestic" : "overseas"}"]`);
  if (!col) return [];
  return Array.from(col.querySelectorAll('[data-testid="mi-candidate-row"]')).map((li) =>
    Array.from(li.querySelectorAll("[data-testid]")).map((n) => n.getAttribute("data-testid") ?? ""),
  );
}

/** 🔴 카드 블록만 자른다 — 헤딩(`CANDIDATE_LIST_HEADING[market]`)은 카드 밖이다. */
function cardBlock(): string {
  const src = stripComments(AREA_SRC);
  const at = src.indexOf('data-testid="mi-candidate-row"');
  expect(at, "🔴 카드 마크업을 찾지 못했다 — 구조가 바뀌었다").toBeGreaterThan(0);
  const end = src.indexOf("</li>", at);
  expect(end).toBeGreaterThan(at);
  return src.slice(at, end);
}

/* ════════════════════════════════ A. 통일 ════════════════════════════════ */

describe("MSTU-1 A — 🔴 시장이 카드 구조를 바꾸지 않는다", () => {
  it("A-1 🔴🔴 카드 블록 «안» 에 **시장 분기가 0** 이다(U-1 이 못 보던 구멍)", () => {
    const block = cardBlock();
    for (const needle of ['market ===', 'market !==', '"KR"', '"OVERSEAS"', "market ?"]) {
      expect(
        block,
        `🔴 카드가 시장으로 분기한다(${needle}) — 한 시장만 고쳐지는 날이 온다`,
      ).not.toContain(needle);
    }
    /** 🟢 통화 분기는 **있어야** 한다 — 그것이 CPO §5 의 「원본 통화 ↔ 원화 환산」 구분이다. */
    expect(block, "🔴 통화 기준 분기가 사라졌다 — KRW 후보에 환산이 중복된다").toContain(
      'row.priceCurrency !== "KRW"',
    );
  });

  it("A-2 🔴🔴 **같은 후보를 두 시장으로 렌더하면 구조가 동일** 하다(마운트 DOM)", async () => {
    await mount([rowOf(1, "KR"), rowOf(1, "OVERSEAS")]);
    const kr = cardShapes("KR");
    const os = cardShapes("OVERSEAS");
    expect(kr.length, "🔴 🇰🇷 카드가 서지 않았다 — 하니스가 측정을 못 한다").toBe(1);
    expect(os.length, "🔴 🌎 카드가 서지 않았다").toBe(1);
    expect(kr[0], `🔴🔴 시장마다 카드 구조가 다르다\n🇰🇷 ${kr[0]}\n🌎 ${os[0]}`).toEqual(os[0]);
  });

  it("A-3 🟢 CPO §4 의 요소가 **양 시장에서 같이** 선다(존재하는 것 전부)", async () => {
    await mount([rowOf(1, "KR"), rowOf(1, "OVERSEAS")]);
    for (const market of ["KR", "OVERSEAS"] as const) {
      const shape = cardShapes(market)[0] ?? [];
      for (const need of [
        "mi-candidate-image",
        "mi-candidate-title",
        "mi-candidate-group",
        "mi-candidate-seller",
        "mi-candidate-price",
        "mi-candidate-price-use",
        "mi-candidate-link",
      ]) {
        expect(shape, `🔴 ${market} 카드에 ${need} 가 없다`).toContain(need);
      }
    }
  });

  it("A-4 🔴 환산 줄은 **통화로만** 갈린다 — 시장으로 갈리지 않는다", async () => {
    /** 🔴 KRW 후보(실측 kids-world · coupleshot)와 비KRW 후보(junioredition)를 같이 세운다. */
    await mount([rowOf(2, "KR"), rowOf(4, "KR"), rowOf(1, "OVERSEAS"), rowOf(0, "OVERSEAS")]);
    const krw = [...cardShapes("KR")];
    for (const shape of krw) {
      expect(
        shape.some((t) => t.startsWith("mi-candidate-price-krw")),
        "🔴 KRW 후보에 원화 환산 줄이 섰다 — 같은 숫자를 두 번 적는다",
      ).toBe(false);
    }
    for (const shape of cardShapes("OVERSEAS")) {
      expect(
        shape.some((t) => t.startsWith("mi-candidate-price-krw")),
        "🔴 비KRW 후보에 환산 줄(또는 「환산 불가」)이 없다",
      ).toBe(true);
    }
  });

  it("A-5 🔴 링크는 **후보 URL 그대로** 다(양 시장 · CPO §7 「링크 정상 작동」)", async () => {
    await mount([rowOf(1, "KR"), rowOf(1, "OVERSEAS")]);
    const links = Array.from(container.querySelectorAll('[data-testid="mi-candidate-link"]'));
    expect(links.length, "🔴 링크가 양 시장에 서지 않았다").toBe(2);
    for (const a of links) {
      expect(a.getAttribute("href")).toBe(REAL[1].discoveredUrl);
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toBe("noreferrer");
    }
  });

  it("A-6 🟢 **실제 상품 5개 행** — 카드 구조가 전부 같은 모양이다", async () => {
    await mount(REAL.map((_, i) => rowOf(i, i % 2 === 0 ? "KR" : "OVERSEAS")));
    const all = [...cardShapes("KR"), ...cardShapes("OVERSEAS")];
    expect(all.length, "🔴 실측 5행이 전부 서지 않았다").toBe(REAL.length);
    /**
     * 🔴 **통화·가격 상태로만** 달라진다 ⟹ 그 둘을 뺀 골격은 **전부 같아야** 한다.
     *
     * 🔴🔴 **1차에 내 필터가 좁았고 그래서 FAIL 했다.** 가격에서 파생되는 칸이 둘 더
     *    있었다 — `mi-candidate-confirm-price`(확정 버튼) ↔ `mi-candidate-confirm-unavailable`.
     *    🟢 그 둘은 **가격 축** 이고 시장 축이 아니다(같은 행을 두 시장에 세우면 같은 값이
     *    나온다 — A-2 가 전수로 단언한다). 🔴 그래서 **접두 둘** 을 뺀다.
     */
    const skeleton = (s: string[]) =>
      s.filter((t) => !t.startsWith("mi-candidate-price") && !t.startsWith("mi-candidate-confirm")).join(">");
    const shapes = new Set(all.map(skeleton));
    expect(
      [...shapes],
      `🔴🔴 골격이 여러 가지다(시장/상품에 따라 구조가 갈린다):\n${[...shapes].join("\n")}`,
    ).toHaveLength(1);
  });

  it("A-7 🔴 가격이 **미확인** 이면 그 사실을 적고, 반영 상태를 **지어내지 않는다**", async () => {
    await mount([rowOf(3, "OVERSEAS")]);
    const shape = cardShapes("OVERSEAS")[0] ?? [];
    expect(shape, "🔴 실측 UNVERIFIED 후보에 「가격 미확인」 줄이 없다").toContain(
      "mi-candidate-price-unverified",
    );
    /** 🔴 미확인은 **분모가 아니다** ⟹ 「참고가격에 반영/제외」를 적지 않는다(`NOT_PRICED`). */
    const use = container.querySelector('[data-testid="mi-candidate-price-use"]');
    expect(use, "🔴 가격 미확인인데 반영 상태를 적었다").toBeNull();
  });
});

/* ════════════════════════════════ B. 보존 ════════════════════════════════ */

describe("MSTU-1 B — 🟢 **삭제·축소 0**(CPO §9)", () => {
  it("B-1 🟢 카드 마크업은 여전히 **하나** 다(두 벌을 만들지 않았다)", () => {
    expect(stripComments(AREA_SRC).split('data-testid="mi-candidate-row"').length - 1).toBe(1);
    expect(AREA_SRC.split("<MarketColumn").length - 1).toBeGreaterThanOrEqual(2);
  });

  it("B-2 🟢 가격·판정 어휘 owner 가 그대로다 — 이 WU 는 **문구를 만들지 않았다**", () => {
    expect(CANDIDATE_PRICE_USE_LABEL.USED).toBe("참고가격에 반영");
    expect(CANDIDATE_PRICE_USE_LABEL.EXCLUDED_OBSERVED_DIFFERENCE).toBe("참고가격 제외 — 상품 차이가 확인됨");
    expect(CANDIDATE_PRICE_USE_LABEL.SAME_AXIS_ONLY).toBe("위 가격에는 미반영 — 동일상품 확정 후보만 집계");
    expect(CANDIDATE_PRICE_USE_LABEL.NOT_PRICED).toBeNull();
  });

  it("B-3 🔴 카드 안에서 **내부 토큰·판정 근거를 노출하지 않는다**(CPO §5)", async () => {
    await mount([rowOf(1, "KR"), rowOf(1, "OVERSEAS")]);
    const text = container.textContent ?? "";
    for (const banned of [
      "PRESUMED_SAME",
      "TEXT_CONFIRMED",
      "COMPARISON",
      "BRAND_MISMATCH",
      "NO_TITLE_OVERLAP",
      "MATERIAL",
      "matchTruth",
    ]) {
      expect(text, `🔴 내부 토큰 '${banned}' 가 셀러 화면에 노출됐다`).not.toContain(banned);
    }
  });

  it("B-4 🔴 **가격 차액을 만들지 않는다**(전략 금지 · §5)", async () => {
    await mount([rowOf(1, "KR"), rowOf(0, "OVERSEAS")]);
    const text = container.textContent ?? "";
    for (const banned of ["차액", "더 비싸", "더 싸", "절감", "이익 폭"]) {
      expect(text, `🔴 차액 어휘 '${banned}' 가 생겼다`).not.toContain(banned);
    }
  });
});
