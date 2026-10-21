import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  buildJudgementSummary,
  JUDGEMENT_SUMMARY_TITLE,
  type JudgementSummaryInput,
} from "../judgement-summary";
import { ProductJudgementSummary } from "../ProductJudgementSummary";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";
import type { MarketEvidenceSummary } from "../market-evidence";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-030 — **상품 판단 요약이 네 질문에 한 덩어리로 답한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 이 블록의 성질은 「새 판정을 만들지 않는다」 하나다. 그래서 이 파일은
 *    **값이 다른 owner 에서 그대로 왔는지** 를 본다 — 숫자를 다시 만들었는지가
 *    아니라 **같은 문자열인지** 를 단언한다.
 */

/** 🟢 실측값(WU-027 release tree LIVE E2E · donokids · GT SAME). */
const DONOKIDS: GeminiTransientRow = {
  source: "SELLER_URL",
  domain: "donokids.com",
  title: "[메인스토리] AW26MS185 - Bubble Sweatshirt - Grey Melange",
  discoveredUrl: "https://www.donokids.com/shop/shopdetail.html?branduid=3362908",
  matchTruth: "TEXT_CONFIRMED",
  crossSellerVerdict: "PRESUMED_SAME",
  priceTier: "COMPARISON",
  confidence: 0.46,
  priceAmount: 117000,
  priceCurrency: "KRW",
  priceStatus: "UNVERIFIED_SEARCH",
  market: "KR",
  basis: "KR_TLD",
  matchReasons: ["상품명 토큰 일치"],
};

const EMPTY: JudgementSummaryInput = { verdictLabel: null, domestic: null, overseas: null };

const domesticWith = (over: Partial<MarketEvidenceSummary>): MarketEvidenceSummary =>
  ({
    title: "🇰🇷 국내 시장",
    hint: "",
    figure: null,
    figureBasis: null,
    figureEmpty: null,
    scopeLabel: null,
    tiers: [],
    mixedNote: null,
    drillDownLabel: "국내 가격 보기",
    hasEvidence: false,
    ...over,
  }) as MarketEvidenceSummary;

const find = (rows: { label: string; value: string; note?: string | null }[], label: string) =>
  rows.find((r) => r.label === label) ?? null;

/* ══════════════ A. 🔴 네 질문에 한 덩어리로 답한다 ══════════════ */

describe("A. CPO 가 지정한 네 질문", () => {
  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴🔴 WU-141-R3 — **이 계약이 「A」로 분류돼 부정 계약으로 뒤집혔다**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 **과거 계약이 현재 전략과 충돌하는 지점** — 이 테스트는 요약 카드가
   *    「비교 가격 KRW 117,000」·「가격 상태 … 판매판정 미반영」을 **직접 만들** 것을
   *    요구했다. 그 값의 출처는 `firstPricedRow`(일시 후보의 **첫 가격**)였고,
   *    그 게이트는 ① 「📊 시장 판매 판단」과 **다르다** — SAME 여부·품절·가격검증을
   *    보지 않는다. ⟹ 같은 화면의 **위아래가 서로 다른 숫자** 를 말할 수 있었고,
   *    그 숫자가 패널의 **첫 번째 자식** 이라 셀러가 **가장 먼저** 읽었다.
   *
   * 🟢 전략 Gate(CPO 2026-10-21) ② 는 「시장 가격 참고 — **MI 가 SAME 으로 확정한
   *    상품만** · 국내/해외를 **하나의** 「📊 시장 판매 판단」에서」다.
   *    ⟹ 요약 카드는 ② 의 owner 가 **아니다.** 그래서 「가격 숫자를 만든다」는
   *    기대를 **「만들지 않는다」로 뒤집는다.**
   *
   * 🟢 **잃는 정보는 없다** — 가격은 ① 이 시장별로 말하고(동일상품 N곳 · 판매중
   *    N곳 · 가격 확인 N곳 · 🔗), 후보별 가격은 `▸ 판단 근거 보기` 안의 후보 행이
   *    그대로 보여준다. 🔴 사라진 것은 **두 번째 owner** 뿐이다.
   */
  it("직접 입력 후보만 있을 때 — 판단·동일상품·근거가 선다 · 🔴 가격 줄은 서지 않는다", () => {
    const rows = buildJudgementSummary({
      verdictLabel: "조건부 판매",
      domestic: null,
      overseas: null,
      transient: [{ sourceLabel: "직접 입력", rows: [DONOKIDS] }],
    });
    expect(find(rows, "시장 판단")?.value).toBe("조건부 판매");
    expect(find(rows, "동일상품")?.value).toContain("동일상품 추정");
    expect(find(rows, "비교 근거")?.value).toBe("직접 입력 1건");

    /** 🔴 D — 후보에 가격이 **있어도**(117,000 KRW) 요약은 가격 줄을 만들지 않는다. */
    expect(DONOKIDS.priceAmount).toBe(117000);
    expect(find(rows, "비교 가격")).toBeNull();
    expect(find(rows, "가격 상태")).toBeNull();
    expect(find(rows, "해외 시장")).toBeNull();
    /**
     * 🔴🔴 줄 이름만 막으면 다음 사람이 **다른 라벨** 로 같은 숫자를 올린다.
     *    그래서 **어느 줄에도 금액이 없다** 를 단언한다(라벨 독립).
     */
    for (const r of rows) {
      expect(r.value, `${r.label} 에 금액이 있다`).not.toMatch(/\d{1,3},\d{3}/);
      expect(`${r.value} ${r.note ?? ""}`, `${r.label} 에 통화가 있다`).not.toMatch(/₩|KRW|EUR|USD|GBP|€|\$|£/);
    }
  });

  it("출처를 요약에서도 잃지 않는다 — 웹 검색과 직접 입력을 갈라 센다", () => {
    const rows = buildJudgementSummary({
      ...EMPTY,
      transient: [
        { sourceLabel: "직접 입력", rows: [DONOKIDS] },
        { sourceLabel: "웹 검색", rows: [{ ...DONOKIDS, domain: "x.com", discoveredUrl: "https://x.com/products/1" }] },
      ],
    });
    expect(find(rows, "비교 근거")?.value).toBe("직접 입력 1건 · 웹 검색 1건");
  });
});

/* ══════════════ B. 🔴🔴 새 판정값을 만들지 않는다 ══════════════ */

describe("B. 값은 전부 다른 owner 에서 그대로 온다", () => {
  /**
   * 🔴 WU-141-R3 — **「값을 그대로 옮긴다」는 성질은 살아 있다. 옮기는 «칸» 이 줄었다.**
   *
   * 🟢 등급(`tiers`)과 근거 두께(`scopeLabel`)는 그대로 온다 — 둘은 **판정/근거** 이고
   *    전략 Gate ① 「MI 판단」에 속한다.
   * 🔴 `figure`(금액)만 오지 않는다 — 그것이 ② 이고 owner 는 ① 하나다.
   *    ⟹ **저장된 국내 근거가 있어도** 요약은 금액을 올리지 않는다(여기가 핵심이다 —
   *       「정식 경로면 괜찮다」로 예외를 두면 owner 가 조건부로 둘이 된다).
   */
  it("국내 요약이 있어도 figure 는 쓰지 않는다 — tier·scope 만 그대로 온다", () => {
    const rows = buildJudgementSummary({
      verdictLabel: "판매 추천",
      domestic: domesticWith({
        figure: "₩150,000",
        figureBasis: "동일상품 최저가",
        scopeLabel: "비교상품 3곳",
        tiers: [{ tier: "SAME", icon: "🟢", label: "동일상품", count: 3 }],
        hasEvidence: true,
      }),
      overseas: null,
      transient: [{ sourceLabel: "직접 입력", rows: [DONOKIDS] }],
    });
    /** 🟢 그대로 오는 것 — 새로 매기지 않는다. */
    expect(find(rows, "동일상품")?.value).toBe("🟢 동일상품");
    expect(find(rows, "비교 근거")?.value).toBe("비교상품 3곳");
    /** 🔴 오지 않는 것 — 금액과 그 기준 문장 둘 다. */
    expect(find(rows, "비교 가격")).toBeNull();
    expect(find(rows, "가격 상태")).toBeNull();
    expect(rows.some((r) => `${r.value} ${r.note ?? ""}`.includes("150,000"))).toBe(false);
    expect(rows.some((r) => `${r.value} ${r.note ?? ""}`.includes("동일상품 최저가"))).toBe(false);
  });

  it("해외 요약의 figure 도 요약 카드에 서지 않는다", () => {
    const rows = buildJudgementSummary({
      ...EMPTY,
      overseas: domesticWith({ title: "🌎 해외 시장", figure: "EUR 75 ~ 120", figureBasis: "판매처 4곳" }),
    });
    expect(find(rows, "해외 시장")).toBeNull();
    expect(rows.some((r) => `${r.value} ${r.note ?? ""}`.includes("EUR 75 ~ 120"))).toBe(false);
    /**
     * 🔴🔴 **그리고 해외 입력만으로는 줄이 하나도 늘지 않는다** — 「시장 판단: 확인 중」
     *    한 줄뿐이다. 이것이 「요약 카드는 ② 의 owner 가 아니다」의 가장 강한 형태다.
     */
    expect(rows.map((r) => r.label)).toEqual(["시장 판단"]);
  });
});

/* ══════════════ C. 🔴 모르는 것은 줄을 만들지 않는다 ══════════════ */

describe("C. 빈 값을 지어내지 않는다", () => {
  it("근거가 하나도 없으면 「시장 판단: 확인 중」 한 줄뿐이다", () => {
    const rows = buildJudgementSummary(EMPTY);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ label: "시장 판단", value: "확인 중" });
    expect(rows[0].note).toContain("아직");
  });

  it("가격이 없는 후보는 「비교 가격」 줄을 만들지 않는다", () => {
    const rows = buildJudgementSummary({
      ...EMPTY,
      transient: [{ sourceLabel: "직접 입력", rows: [{ ...DONOKIDS, priceAmount: null, priceCurrency: null }] }],
    });
    expect(find(rows, "비교 가격")).toBeNull();
    expect(find(rows, "가격 상태")).toBeNull();
    /** 🟢 그래도 판정과 근거 건수는 말한다 — 아는 것까지 숨기지 않는다. */
    expect(find(rows, "동일상품")?.value).toContain("동일상품 추정");
    expect(find(rows, "비교 근거")?.value).toBe("직접 입력 1건");
  });

  it("🔴 0원·「-」 같은 가짜 값이 들어가지 않는다", () => {
    const rows = buildJudgementSummary({ ...EMPTY, transient: [{ sourceLabel: "직접 입력", rows: [] }] });
    for (const r of rows) {
      expect(r.value).not.toBe("-");
      expect(r.value).not.toContain("0원");
      expect(r.value).not.toContain("NaN");
    }
  });
});

/* ══════════════ D. 🔴 렌더 — 상세를 대체하지 않는다 ══════════════ */

describe("D. 블록 렌더", () => {
  const render = (input: JudgementSummaryInput) =>
    renderToStaticMarkup(ProductJudgementSummary(input) as never);

  /**
   * 🔴 WU-141-R3 — **마운트 DOM 축에서도 같이 뒤집는다.**
   *    순수 함수만 막으면 뷰가 `input.domestic.figure` 를 **직접 읽어** 찍는 길이 남는다
   *    (WU-110 이 기록한 그 함정 — 「판정 함수를 직접 부르는 테스트는 배선을 못 본다」).
   */
  it("요약 제목과 줄들이 실제 DOM 에 선다 · 🔴 금액은 DOM 에도 없다", () => {
    const html = render({
      verdictLabel: "조건부 판매",
      domestic: domesticWith({ figure: "₩150,000", figureBasis: "동일상품 최저가", hasEvidence: true }),
      overseas: domesticWith({ title: "🌎 해외 시장", figure: "EUR 75 ~ 120" }),
      transient: [{ sourceLabel: "직접 입력", rows: [DONOKIDS] }],
    });
    expect(html).toContain(JUDGEMENT_SUMMARY_TITLE);
    expect(html).toContain("조건부 판매");
    expect(html).toContain('data-testid="judgement-summary"');
    /** 🔴 세 출처(일시 후보 · 국내 요약 · 해외 요약)의 금액이 **전부** 없다. */
    expect(html).not.toContain("117,000");
    expect(html).not.toContain("150,000");
    expect(html).not.toContain("EUR 75 ~ 120");
    expect(html).not.toContain("판매판정 미반영");
  });

  /** 🔴 줄이 하나도 없을 수는 없지만(시장 판단은 항상 선다) 빈 입력 방어는 둔다. */
  it("줄이 없으면 빈 상자를 세우지 않는다", () => {
    expect(renderToStaticMarkup(ProductJudgementSummary({ ...EMPTY, verdictLabel: "" }) as never)).not.toContain(
      "judgement-summary",
    );
  });

  /** 🔴🔴 요약은 **결론만** 이다 — 근거 문장을 여기로 옮겨 오지 않는다(상세가 owner). */
  it("요약이 근거 문장을 복제하지 않는다", () => {
    const html = render({
      ...EMPTY,
      transient: [{ sourceLabel: "직접 입력", rows: [DONOKIDS] }],
    });
    expect(html).not.toContain("상품명 토큰 일치");
    expect(html).not.toContain(DONOKIDS.discoveredUrl);
  });
});
