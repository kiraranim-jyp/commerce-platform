/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { sellerSurfaceElement, SNAPSHOT_ID } from "./seller-surface-composition";
import { productionData } from "./product-tab-composition";
import type { PriceHistoryResponse } from "../DomesticPriceIntelligencePanel";
import { candidatePriceUse, CANDIDATE_PRICE_USE_LABEL } from "../mi-same-candidates";
import { PRICE_DISQUALIFYING_BLOCKER_LIST } from "@/lib/price-disqualifying-blockers";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SOURCING-CANDIDATE-UNIFIED-UX-1 ④⑧ — **같은 카드 · 포함/제외를 카드가 말한다**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 검수 3항 중 이번에 닫는 둘:
 * ```
 * ① 국내·해외 후보가 **동일한 카드 템플릿** 으로 표시될 것        ← U-1(이미 충족 · 잠근다)
 * ③ 참고가격에 **포함된 후보와 제외된 후보** 가 카드에서 구분될 것 ← U-3~U-6(이번 구현)
 * ```
 * 🔴 ②(카드 항목 5개 제한)와 ⑦(선택 UI 제거)은 **이 세션에서 하지 않았다** — 미완료
 *    범위로 보고한다(CPO: 「완결할 수 없다면 clean 으로 중단하고 미완료 범위를 보고」).
 *
 * 🔴 가격 공식·제외 조건 **변경 0** · 후보 데이터 **보존** · human_verdict **보존**.
 */

const AREA_SRC = readFileSync(join(__dirname, "..", "MarketPriceComparison.tsx"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ");

let container: HTMLDivElement;
let root: Root;

/** 🟢 CEO 화면과 같은 모양 — 국내 둘(반영 1 + 제외 1) · 해외 하나(반영). */
const ROWS = [
  {
    domain: "donokids.com",
    discoveredUrl: "https://donokids.com/product/a",
    title: "허그 헤어리 몬스터 티셔츠",
    market: "KR",
    priceAmount: 88_000,
    priceCurrency: "KRW",
    priceStatus: "VERIFIED_CURRENT",
    crossSellerVerdict: "PRESUMED_SAME",
    matchTruth: "TEXT_CONFIRMED",
    priceTier: "COMPARISON",
    crossSellerBlockers: ["BRAND_UNCONFIRMED"],
    source: "DOMESTIC_LISTING",
  },
  {
    domain: "otherkids.kr",
    discoveredUrl: "https://otherkids.kr/product/b",
    title: "몬스터 반팔 티셔츠",
    market: "KR",
    priceAmount: 79_000,
    priceCurrency: "KRW",
    priceStatus: "VERIFIED_CURRENT",
    crossSellerVerdict: "PRESUMED_SAME",
    matchTruth: "TEXT_CONFIRMED",
    priceTier: "COMPARISON",
    crossSellerBlockers: ["BRAND_MISMATCH"],
    source: "DOMESTIC_LISTING",
  },
  {
    domain: "junioredition.com",
    discoveredUrl: "https://junioredition.com/products/x",
    title: "Hug Hairy Monster T-Shirt",
    market: "OVERSEAS",
    priceAmount: 37,
    priceCurrency: "GBP",
    priceStatus: "VERIFIED_CURRENT",
    crossSellerVerdict: "PRESUMED_SAME",
    matchTruth: "TEXT_CONFIRMED",
    priceTier: "COMPARISON",
    crossSellerBlockers: [],
    source: "OVERSEAS_AUTO",
  },
];

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

/** 🔴 후보는 **POST 경로** 로 준다 — 운영이 그 통로다(GET 은 transient 를 안 싣는다). */
async function mount(): Promise<void> {
  stubFetch(productionData());
  await act(async () => {
    root.render(
      sellerSurfaceElement({
        marketDone: true,
        autoCheckResult: { domesticShop: { domesticListingEvidence: ROWS } },
      }),
    );
  });
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe("U. 🔵 후보 카드 — 같은 템플릿 · 참고가격 포함/제외", () => {
  it("U-1 🟢 국내·해외가 **같은 카드 컴포넌트** 를 쓴다(CPO 검수 ①)", () => {
    /**
     * 🟢 **이미 충족돼 있었다** — `MarketColumn` 하나를 두 시장이 공유하고 행도
     *    `mi-candidate-row` 하나다. 🔴 그래서 이번에 **다시 만들지 않았다**(중복 금지).
     * 🔴 이 계약은 그 사실을 **잠근다** — 시장별 분기 카드가 생기면 FAIL 한다.
     */
    const rows = AREA_SRC.split('data-testid="mi-candidate-row"').length - 1;
    expect(rows, "🔴 카드 마크업이 둘이 되면 한쪽만 고치는 날이 온다").toBe(1);
    /** 🔴 `MarketColumn` 호출이 둘(KR·OVERSEAS)이고 **같은 컴포넌트** 다. */
    expect(AREA_SRC.split("<MarketColumn").length - 1).toBeGreaterThanOrEqual(2);
    expect(AREA_SRC).toContain('market="KR"');
    expect(AREA_SRC).toContain('market="OVERSEAS"');
  });

  it("U-2 🔴 자격 술어는 **집계기와 같은 owner** 다 — 화면에 사본 0", () => {
    /** 🔴 화면 파일에 blocker 문자열이 박히면 두 집합이 갈린다. */
    for (const b of PRICE_DISQUALIFYING_BLOCKER_LIST) {
      expect(AREA_SRC, `🔴 '${b}' 가 화면 파일에 박혔다 — 사본이다`).not.toContain(b);
    }
    /**
     * 🔵 MI-OVERSEAS-PRICE-CANDIDATE-CONSISTENCY-1 — 인자가 하나 늘었다(화면 분기).
     * 🔴 **약화가 아니다** — 「술어를 부른다」 «그리고» 「분기 값을 같은 함수에서 받는다」를
     *    같이 단언한다(그 값을 손으로 세면 화면 숫자와 갈라진다).
     */
    expect(AREA_SRC).toContain("candidatePriceUse(row, { sameOnlyPriceAxis })");
    expect(AREA_SRC, "🔴 분기 값을 화면이 자기 식으로 만들었다").toContain(
      "sameOnlyPriceAxis={buildPriceGuide(judgement,",
    );
  });

  it("U-3 🟢🟢 **반영된 후보가 「참고가격에 반영」을 말한다**(CPO 검수 ③)", async () => {
    await mount();
    const used = container.querySelectorAll('[data-testid="mi-candidate-price-use"][data-use="USED"]');
    expect(used.length, "🔴 0 이면 셀러는 여전히 어느 후보인지 모른다").toBeGreaterThan(0);
    expect(used[0].textContent).toContain("참고가격에 반영");
  });

  it("U-4 🟢🟢 **제외된 후보가 그 사실과 이유를 말한다**", async () => {
    await mount();
    const excluded = container.querySelectorAll(
      '[data-testid="mi-candidate-price-use"][data-use="EXCLUDED_OBSERVED_DIFFERENCE"]',
    );
    expect(excluded.length, "🔴 제외 사유가 후보 옆에 없으면 CEO 불만이 그대로다").toBe(1);
    expect(excluded[0].textContent).toContain("상품 차이가 확인됨");
    /** 🔴 **내부 토큰을 노출하지 않는다** — 사람의 말만 적는다. */
    for (const b of PRICE_DISQUALIFYING_BLOCKER_LIST) {
      expect(excluded[0].textContent ?? "").not.toContain(b);
    }
  });

  it("U-5 🔴 두 줄이 **접힘 밖** 에 있다 — 접으면 안 적는 것과 같다", async () => {
    await mount();
    const node = container.querySelector('[data-testid="mi-candidate-price-use"]');
    expect(node).not.toBeNull();
    /** 🔴 조상에 **닫힌** `details` 가 카드 목록(`mi-candidate-list`) 하나를 넘지 않는다. */
    let folds = 0;
    for (let el = node!.parentElement; el; el = el.parentElement) {
      if (el.tagName === "DETAILS" && !(el as HTMLDetailsElement).open) folds += 1;
    }
    expect(folds, "🔴 근거 접힘 «안» 으로 들어가면 셀러가 또 못 본다").toBeLessThanOrEqual(1);
  });

  it("U-6 🔴 「모른다」는 **줄을 만들지 않는다** — 제외로 적지 않는다", () => {
    /** 🟢 순수 함수 축 — 가격이 없거나 미확인이면 애초에 분모가 아니다. */
    expect(candidatePriceUse({ priceAmount: null })).toBe("NOT_PRICED");
    expect(candidatePriceUse({ priceAmount: 1000, priceStatus: "UNVERIFIED_SEARCH" })).toBe("NOT_PRICED");
    expect(CANDIDATE_PRICE_USE_LABEL.NOT_PRICED).toBeNull();
    /** 🔴 blocker 를 모르면(`undefined`) **반영** 이다(「모른다」를 제외로 적지 않는다). */
    expect(candidatePriceUse({ priceAmount: 1000, priceStatus: "VERIFIED_CURRENT" })).toBe("USED");
  });

  it("U-7 🔴 **후보는 숨기지 않는다** — 제외돼도 카드가 선다(CPO 문장)", async () => {
    await mount();
    const rows = container.querySelectorAll('[data-testid="mi-candidate-row"]');
    const text = Array.from(rows)
      .map((r) => r.textContent ?? "")
      .join("|");
    expect(text).toContain("donokids.com");
    expect(text, "🔴 제외된 후보가 사라지면 셀러가 분모를 못 센다").toContain("otherkids.kr");
  });
});

describe("V. 🔵 ②⑤⑦ — 기본 5칸 · 등급 이동 · 선택 UI 제거", () => {
  it("V-1 🟢🟢 **동일상품 선택 UI 가 사라졌다**(⑦ · CPO 승인 ⒝)", async () => {
    await mount();
    expect(
      container.querySelector('[data-testid="mi-candidate-select"]'),
      "🔴 선택 버튼이 남아 있으면 셀러에게 또 고르라고 하는 화면이다",
    ).toBeNull();
    expect(container.querySelector('[data-testid="mi-candidate-note"]')).toBeNull();
    expect(container.querySelectorAll('[data-testid^="mi-select-"]')).toHaveLength(0);
  });

  it("V-2 🔴 선택 UI 는 **마크업에서도** 호출되지 않는다(소스 축)", () => {
    /** 🔴 컴포넌트 정의는 남겨도 된다 — **렌더 호출** 이 0 이어야 한다. */
    expect(AREA_SRC).not.toContain("<CandidateSelect");
    expect(AREA_SRC).not.toContain("<CandidateNoteChoices");
  });

  /**
   * 🔵🔵🔵 **SOURCING-CARD-MINIMAL-1 — V-3/V-4 의 방향이 CPO 결정 C 로 «반전» 됐다.**
   *
   * 🔴 전: 「등급이 **「우리 판단」 영역 안** 으로 옮겨졌다」 + 「기본 칸에 등급이 **없다**」
   * 🟢 후: **영역이 제거** 되고 **등급 배지가 기본 정보 안** 에 선다.
   * 🟢🟢 **두 계약이 원래 지키던 것은 「등급이 사라지지 않는다」** 이고 그것은 **불변** 이다
   *    (WU-091 「행마다 판정 라벨」 · 사라지면 후보가 「유력」으로 읽힌다).
   * 🔴 **약화 0** — 영역이 되살아나면 FAIL · 접두사가 붙으면 FAIL 을 **둘 다** 둔다.
   */
  it("V-3 🟢🟢 **등급 배지가 기본 정보 안에 선다**(결정 C · 삭제 아님)", async () => {
    await mount();
    expect(
      container.querySelector('[data-testid="mi-candidate-judgement"]'),
      "🔴 「우리 판단」 영역이 되살아났다",
    ).toBeNull();
    const row = container.querySelector('[data-testid="mi-candidate-row"]')!;
    const grade = row.querySelector('[data-testid="mi-candidate-group"]');
    expect(grade, "🔴 등급이 사라지면 CPO 결정 A(유지)를 어긴 것이다").not.toBeNull();
    /** 🔴 접두사 `우리 판단:` 은 §3 금지어다 — 어휘 자체는 결정 A 로 불변. */
    expect(grade!.textContent ?? "", "🔴 금지 어휘가 배지에 붙었다").not.toContain("우리 판단");
    expect(
      ["🟢 동일상품 가능성 높음", "🟡 동일상품 추정", "🟡 품번 충돌 · 참고"],
      "🔴 등급 어휘가 바뀌었다 — 결정 A 는 3그룹·현행 문구 유지다",
    ).toContain((grade!.textContent ?? "").trim());
  });

  it("V-4 🔴 **기본 칸이 상품·가격·판매처·배지·참고가격 뿐이다**(결정 C 의 핵심)", async () => {
    await mount();
    const row = container.querySelector('[data-testid="mi-candidate-row"]')!;
    /** 🟢 셀러가 봐야 하는 것 — 전부 **있다**. */
    for (const id of [
      "mi-candidate-image",
      "mi-candidate-price",
      "mi-candidate-seller",
      "mi-candidate-group",
    ]) {
      expect(row.querySelector(`[data-testid="${id}"]`), `🔴 ${id} 가 없다`).not.toBeNull();
    }
    expect(row.querySelector("a[href]"), "🔴 사이트 링크").not.toBeNull();
    /** 🔴 내부 판단 영역·근거·사람 판정 — 전부 **없다**. */
    for (const id of [
      "mi-candidate-judgement",
      "mi-candidate-judgement-basis",
      "mi-candidate-warning",
      "mi-candidate-evidence",
      "mi-candidate-evidence-line",
      "mi-candidate-human-verdict",
    ]) {
      expect(
        row.querySelectorAll(`[data-testid="${id}"]`),
        `🔴 ${id} 가 셀러 카드에 섰다`,
      ).toHaveLength(0);
    }
    /** 🔴 「펼쳐보기」 UI 자체가 **0** 이다(§8 계약). */
    expect(row.querySelectorAll("details"), "🔴 카드 안에 접힘이 생겼다").toHaveLength(0);
  });

  it("V-5 🔴 **내부 토큰이 카드 어디에도 없다**(CPO 검수 항목)", async () => {
    await mount();
    const text = Array.from(container.querySelectorAll('[data-testid="mi-candidate-row"]'))
      .map((r) => r.textContent ?? "")
      .join("|");
    for (const token of [
      ...PRICE_DISQUALIFYING_BLOCKER_LIST,
      "BRAND_UNCONFIRMED",
      "PRESUMED_SAME",
      "TEXT_CONFIRMED",
      "COMPARISON",
    ]) {
      expect(text, `🔴 '${token}' 가 셀러 화면에 노출됐다`).not.toContain(token);
    }
  });

  it("V-6 🟢 국내·해외가 **같은 구조** 로 선다(CPO 검수 ①의 런타임 축)", async () => {
    await mount();
    const rows = Array.from(container.querySelectorAll('[data-testid="mi-candidate-row"]'));
    expect(rows.length).toBeGreaterThanOrEqual(2);
    /** 🔴 모든 행이 **같은 칸 집합** 을 갖는다 — 시장별로 다르면 템플릿이 갈린 것이다. */
    const shape = (r: Element) =>
      ["mi-candidate-seller", "mi-candidate-price", "mi-candidate-judgement"]
        .map((t) => (r.querySelector(`[data-testid="${t}"]`) ? "1" : "0"))
        .join("");
    expect(new Set(rows.map(shape)).size, "🔴 행마다 구조가 다르면 통일이 깨진 것이다").toBe(1);
  });
});

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SOURCING-**CARD-MINIMAL-1** — 셀러 카드는 «결과만» 말한다 (CPO 2026-11-09)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 블록은 `JUDGEMENT-DEDUP-1` 의 W-1~W-4 를 «대체» 한다.** 그 넷은
 *    「판단 근거가 접힘 안팎에 **중복되지 않는다**」를 지켰다. CPO 결정 C 로 그 줄이
 *    **두 자리에서 모두** 사라졌으므로 **중복은 구조적으로 불가능** 해졌다
 *    ⟹ 그 보장은 아래 W-4 가 **더 센 형태**(어디에도 없다)로 이어받는다.
 *
 * ── 🔵 CPO 결정 네 건 ────────────────────────────────────────────────────────
 * ```
 * A  동일성 3그룹 유지 — LIKELY / PRESUMED / POSSIBLE · 현행 문구 그대로
 *    🔴 「동일상품 확정」·새 EXACT tier 를 만들지 않는다 · 승격/축소 0
 * B  POSSIBLE 유지 — 화면에서 제거 금지(가격 관측 있는 CEO SAME 2건이 사라진다)
 *    🔴 동일성 그룹과 참고가격 포함 여부를 **서로 종속시키지 않는다**
 * C  「우리 판단」 영역·판단 근거·근거 접힘 제거 · 등급 배지는 기본 정보로 이동
 * D  사람 판정 표시 제거(내부 검증 데이터) — 🔴 데이터·API·DB 는 변경 0
 * ```
 * 🔴 **셀러가 보는 것은 넷이다** — 상품(이미지·상품명) · 판매처 · 가격 · 상태 둘
 *    (동일성 배지 · 참고가격 반영/제외).
 */
describe("W. 🔵 SOURCING-CARD-MINIMAL-1 — 결과만 보여준다", () => {
  /**
   * 🔴 **3그룹 × 가격 3상태를 한 표본에** 담는다 — §8 이 그 둘을 **독립** 으로
   *    검증하라고 요구한다. 🔴 국내·해외를 **대칭** 으로 둬서 템플릿 동일성도 같이 본다.
   *
   * 🟢 그룹 입구는 **운영 선택기 규칙** 그대로다(복제 계산 0):
   *    LIKELY ← `SAME` · PRESUMED ← `PRESUMED_SAME` ·
   *    POSSIBLE ← `CONFLICT` + `MODEL_CODE` 단독 + Evidence 있음.
   * 🟢 가격 상태도 **운영 술어** 그대로다 — `NOT_PRICED`(금액 없음 또는 미검증) ·
   *    `EXCLUDED_OBSERVED_DIFFERENCE`(`BRAND_MISMATCH`·`NO_TITLE_OVERLAP` 등) ·
   *    그 외 `USED`.
   */
  const MATRIX = [
    /** 🇰🇷 LIKELY · USED */
    {
      domain: "biskuit.kr",
      discoveredUrl: "https://biskuit.kr/product/likely",
      title: "허그 헤어리 몬스터 티셔츠",
      market: "KR",
      priceAmount: 88_000,
      priceCurrency: "KRW",
      priceStatus: "VERIFIED_CURRENT",
      crossSellerVerdict: "SAME",
      matchTruth: "EXACT_IDENTIFIER",
      priceTier: "EXACT",
      crossSellerBlockers: [],
      matchReasons: ["근거: 핵심 상품명 monster"],
      source: "DOMESTIC_LISTING",
    },
    /** 🇰🇷 PRESUMED · EXCLUDED(상품 차이 확인됨) */
    {
      domain: "donokids.com",
      discoveredUrl: "https://donokids.com/product/presumed",
      title: "몬스터 반팔 티셔츠",
      market: "KR",
      priceAmount: 79_000,
      priceCurrency: "KRW",
      priceStatus: "VERIFIED_CURRENT",
      crossSellerVerdict: "PRESUMED_SAME",
      matchTruth: "TEXT_CONFIRMED",
      priceTier: "COMPARISON",
      crossSellerBlockers: ["BRAND_MISMATCH"],
      matchReasons: ["근거: 상품군 TOP↔TOP"],
      source: "DOMESTIC_LISTING",
    },
    /** 🇰🇷 POSSIBLE · NOT_PRICED(금액 없음) */
    {
      domain: "beaumonde.co.kr",
      discoveredUrl: "https://beaumonde.co.kr/goods/possible",
      title: "부티 고스트 티셔츠",
      market: "KR",
      priceAmount: null,
      priceCurrency: null,
      crossSellerVerdict: "CONFLICT",
      crossSellerConflicts: ["MODEL_CODE"],
      crossSellerBlockers: [],
      matchReasons: ["근거: 브랜드 일치"],
      source: "DOMESTIC_LISTING",
    },
    /** 🌎 LIKELY · USED (원본 통화) */
    {
      domain: "junioredition.com",
      discoveredUrl: "https://junioredition.com/products/likely",
      title: "Hug Hairy Monster T-Shirt",
      market: "OVERSEAS",
      priceAmount: 37,
      priceCurrency: "GBP",
      priceStatus: "VERIFIED_CURRENT",
      crossSellerVerdict: "SAME",
      matchTruth: "EXACT_IDENTIFIER",
      priceTier: "EXACT",
      crossSellerBlockers: [],
      matchReasons: ["근거: 핵심 상품명 monster"],
      source: "OVERSEAS_AUTO",
    },
    /** 🌎 PRESUMED · EXCLUDED */
    {
      domain: "tinyapple.net",
      discoveredUrl: "https://tinyapple.net/products/presumed",
      title: "Monster Short Sleeve Tee",
      market: "OVERSEAS",
      priceAmount: 58,
      priceCurrency: "USD",
      priceStatus: "VERIFIED_CURRENT",
      crossSellerVerdict: "PRESUMED_SAME",
      matchTruth: "TEXT_CONFIRMED",
      priceTier: "COMPARISON",
      crossSellerBlockers: ["NO_TITLE_OVERLAP"],
      matchReasons: ["근거: 색상 GREY"],
      source: "OVERSEAS_AUTO",
    },
    /** 🌎 POSSIBLE · NOT_PRICED(가격 미검증) */
    {
      domain: "bobochoses.com",
      discoveredUrl: "https://bobochoses.com/products/possible",
      title: "Booty Ghosts T-shirt",
      market: "OVERSEAS",
      priceAmount: 35,
      priceCurrency: "EUR",
      priceStatus: "UNVERIFIED_SEARCH",
      crossSellerVerdict: "CONFLICT",
      crossSellerConflicts: ["MODEL_CODE"],
      crossSellerBlockers: [],
      matchReasons: ["근거: 브랜드 일치"],
      source: "OVERSEAS_AUTO",
    },
  ];

  async function mountMatrix(): Promise<void> {
    stubFetch(productionData());
    await act(async () => {
      root.render(
        sellerSurfaceElement({
          marketDone: true,
          autoCheckResult: { domesticShop: { domesticListingEvidence: MATRIX } },
        }),
      );
    });
    for (let i = 0; i < 5; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  }

  const rowsOf = (): HTMLElement[] =>
    Array.from(container.querySelectorAll('[data-testid="mi-candidate-row"]'));

  /** 🟢 한 행의 **구조 척추** — testid 출현 순서(값이 아니라 «모양» 이다). */
  const spineOf = (row: Element): string[] =>
    Array.from(row.querySelectorAll("[data-testid]"))
      .map((n) => n.getAttribute("data-testid") ?? "")
      /** 🔴 데이터에 따라 서거나 마는 줄은 **구조 비교에서 뺀다**(없으면 거짓 불일치). */
      .filter(
        (id) =>
          ![
            "mi-candidate-price-use",
            "mi-candidate-price-unverified",
            "mi-candidate-price-krw",
            "mi-candidate-price-krw-unavailable",
            "mi-candidate-confirm-price",
            "mi-candidate-confirm-unavailable",
          ].includes(id),
      );

  it("W-1 🔴🔴 **국내·해외 카드가 같은 구조로 그려진다**(별도 템플릿 금지)", async () => {
    await mountMatrix();
    const rows = rowsOf();
    expect(rows.length, "🔴 분모 0 — 아무것도 못 본다").toBeGreaterThanOrEqual(4);
    /** 🔴 시장은 **운영이 붙인 속성** 으로 가른다 — 글자 추측으로 가르지 않는다. */
    const marketOf = (r: Element): string =>
      MATRIX.find((m) => (r.textContent ?? "").includes(m.domain))?.market ?? "?";
    const kr = rows.filter((r) => marketOf(r) === "KR");
    const os = rows.filter((r) => marketOf(r) === "OVERSEAS");
    expect(kr.length, "🔴 국내 행 0 — 분모 미달").toBeGreaterThan(0);
    expect(os.length, "🔴 해외 행 0 — 분모 미달").toBeGreaterThan(0);
    /** 🔴 **구조 척추가 한 종류** 여야 한다 — 국내/해외로 갈라지면 FAIL. */
    const shapes = new Set(rows.map((r) => spineOf(r).join(">")));
    expect(
      shapes.size,
      `🔴 카드 구조가 ${shapes.size} 종류다 — 국내·해외가 같은 템플릿이 아니다`,
    ).toBe(1);
    /** 🔴 그리고 그 척추에 **셀러가 봐야 하는 칸** 이 전부 있다. */
    const spine = spineOf(rows[0]!);
    for (const id of [
      "mi-candidate-image",
      "mi-candidate-group",
      "mi-candidate-price",
      "mi-candidate-seller",
    ]) {
      expect(spine, `🔴 ${id} 가 척추에 없다`).toContain(id);
    }
  });

  it("W-2 🟢 **동일성 3그룹이 각각 현행 문구로 선다**(결정 A·B)", async () => {
    await mountMatrix();
    const byGroup = new Map<string, string>();
    for (const r of rowsOf()) {
      const g = r.getAttribute("data-group") ?? "";
      const badge = (
        r.querySelector('[data-testid="mi-candidate-group"]')?.textContent ?? ""
      ).trim();
      expect(badge, `🔴 ${g} 행에 배지가 없다`).not.toBe("");
      byGroup.set(g, badge);
    }
    /** 🔴🔴 **세 군이 전부 화면에 선다** — POSSIBLE 이 빠지면 결정 B 위반이다. */
    expect([...byGroup.keys()].sort(), "🔴 세 군이 모두 서야 한다").toEqual([
      "LIKELY",
      "POSSIBLE",
      "PRESUMED",
    ]);
    /** 🟢 어휘는 **결정 A 로 불변** — 글자를 직접 적는다(상수 import 는 동어반복). */
    expect(byGroup.get("LIKELY")).toBe("🟢 동일상품 가능성 높음");
    expect(byGroup.get("PRESUMED")).toBe("🟡 동일상품 추정");
    expect(byGroup.get("POSSIBLE")).toBe("🟡 품번 충돌 · 참고");
    /** 🔴 「동일상품 확정」 같은 새 문구를 만들지 않았다. */
    const all = [...byGroup.values()].join("|");
    for (const banned of ["동일상품 확정", "확정됨", "EXACT", "우리 판단"]) {
      expect(all, `🔴 새 어휘/금지 어휘: ${banned}`).not.toContain(banned);
    }
  });

  it("W-3 🔴 **참고가격 상태는 동일성과 «독립» 이다**(결정 B)", async () => {
    await mountMatrix();
    const seen = new Map<string, string | null>();
    for (const r of rowsOf()) {
      const node = r.querySelector('[data-testid="mi-candidate-price-use"]');
      seen.set(r.getAttribute("data-group") ?? "", node ? (node.textContent ?? "").trim() : null);
      /** 🟢 상태 줄이 서면 **「반영」 또는 「제외」** 둘 중 하나다(제3의 문구 금지). */
      if (node) {
        const t = (node.textContent ?? "").trim();
        expect(
          t === "참고가격에 반영" || t === "참고가격 제외 — 상품 차이가 확인됨",
          `🔴 참고가격 상태 문구가 바뀌었다: ${t}`,
        ).toBe(true);
        /** 🔴 내부 사유를 노출하지 않는다 — 「상품 차이가 확인됨」까지가 셀러의 말이다. */
        expect(t, "🔴 내부 토큰이 참고가격 줄에 노출됐다").not.toMatch(/[A-Z]{2,}_[A-Z_]+/);
      }
    }
    /**
     * 🔴🔴 **독립성의 증거** — 같은 `PRESUMED` 군이 가격에서는 **제외** 되고,
     *    `LIKELY` 는 **반영** 되고, `POSSIBLE` 은 금액을 몰라 **줄이 없다**.
     *    ⟹ 등급이 가격 상태를 결정하지 않는다(종속되면 이 셋이 같아진다).
     */
    expect(seen.get("LIKELY"), "🔴 LIKELY 가 반영이 아니다").toBe("참고가격에 반영");
    expect(seen.get("PRESUMED"), "🔴 PRESUMED 가 제외가 아니다").toBe(
      "참고가격 제외 — 상품 차이가 확인됨",
    );
    /** 🔴 「모른다」면 **줄을 만들지 않는다**(없는 상태를 적지 않는다). */
    expect(seen.get("POSSIBLE"), "🔴 가격을 모르는데 상태 문구를 적었다").toBeNull();
    /** 🔴🔴 그리고 **제외된 후보도 목록에서 빠지지 않는다**(결정 B). */
    expect(rowsOf().length, "🔴 제외 후보가 목록에서 사라졌다").toBeGreaterThanOrEqual(4);
  });

  it("W-4 🔴🔴 **내부 판단 정보가 셀러 화면에 하나도 없다**(결정 C·D)", async () => {
    await mountMatrix();
    const rows = rowsOf();
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      /** 🔴 좌표 — 여섯 전부 0. */
      for (const id of [
        "mi-candidate-judgement",
        "mi-candidate-judgement-basis",
        "mi-candidate-warning",
        "mi-candidate-evidence",
        "mi-candidate-evidence-line",
        "mi-candidate-human-verdict",
      ]) {
        expect(r.querySelectorAll(`[data-testid="${id}"]`), `🔴 ${id} 가 섰다`).toHaveLength(0);
      }
      /** 🔴 **펼쳐보기 UI 자체가 0** 이다 — 접으면 「나중에 보여주는 것」이 된다. */
      expect(r.querySelectorAll("details"), "🔴 카드 안에 접힘이 생겼다").toHaveLength(0);
      /**
       * 🔴 글자로도 새지 않는다. 🟢 **중복 금지는 여기서 «더 센 형태» 로 이어받는다** —
       *    DEDUP-1 은 「두 번 적지 않는다」였고 지금은 **「한 번도 적지 않는다」** 다.
       */
      const t = r.textContent ?? "";
      expect(t, "🔴 내부 토큰이 노출됐다").not.toMatch(/[A-Z]{2,}_[A-Z_]+/);
      for (const banned of [
        "우리 판단",
        "판단 근거",
        "확인 필요:",
        "브랜드 미확인",
        "브랜드 불일치",
        "근거 확인",
        "이전에 사람이 확인함",
        "상품명 일치",
      ]) {
        expect(t, `🔴 셀러 화면에 내부 판단 어휘: ${banned}`).not.toContain(banned);
      }
    }
  });

  it("W-5 🟢 **내부 데이터와 저장 경로는 보존된다**(결정 C·D 의 조건 · 소스 축)", () => {
    /**
     * 🔴🔴 UI 제거가 **데이터 제거로 번지면** 내부 분석·GT 가 같이 죽는다(CPO §4).
     * 🟢 그래서 **배선이 살아 있다** 는 것을 소스에서 단언한다
     *    (🔴 `AREA_SRC` 는 파일 머리에서 **주석을 벗긴** 값이다).
     */
    expect(AREA_SRC, "🔴 사람 판정 조회/저장 배선이 끊겼다").toContain("useCandidateReview");
    expect(AREA_SRC, "🔴 reviewApi prop 배선이 끊겼다").toContain("reviewApi");
    /** 🔴 그러나 **렌더 호출은 0** 이다 — 데이터는 흐르고 화면에는 안 선다. */
    expect(AREA_SRC, "🔴 경고 줄을 카드가 다시 그린다").not.toContain("candidateWarningLines(row)");
    expect(AREA_SRC, "🔴 근거 줄을 카드가 다시 그린다").not.toContain(
      "candidateEvidenceLines(row)",
    );
  });
});
