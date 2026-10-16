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
  it("직접 입력 후보만 있을 때 — 판단·동일상품·가격·근거·가격상태가 한 번에 선다", () => {
    const rows = buildJudgementSummary({
      verdictLabel: "조건부 판매",
      domestic: null,
      overseas: null,
      transient: [{ sourceLabel: "직접 입력", rows: [DONOKIDS] }],
    });
    expect(find(rows, "시장 판단")?.value).toBe("조건부 판매");
    expect(find(rows, "동일상품")?.value).toContain("동일상품 추정");
    expect(find(rows, "비교 가격")?.value).toBe("KRW 117,000");
    expect(find(rows, "비교 근거")?.value).toBe("직접 입력 1건");
    /** 🔴🔴 ④ — 가격이 있는데 판매판정에 안 들어가는 이유를 **요약에서** 말한다. */
    expect(find(rows, "가격 상태")?.value).toContain("판매판정 미반영");
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
  /** 🔴 저장된 국내 근거가 있으면 **그 owner 의 숫자/등급** 이 이긴다(일시 후보가 아니라). */
  it("국내 요약이 있으면 그 figure·tier 를 그대로 쓴다", () => {
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
    expect(find(rows, "비교 가격")?.value).toBe("₩150,000");
    expect(find(rows, "비교 가격")?.note).toBe("동일상품 최저가");
    expect(find(rows, "동일상품")?.value).toBe("🟢 동일상품");
    expect(find(rows, "비교 근거")?.value).toBe("비교상품 3곳");
    /** 🔴 정식 국내 근거가 있으면 「가격 상태」 줄은 서지 않는다 — 오해가 없는 상황이다. */
    expect(find(rows, "가격 상태")).toBeNull();
  });

  it("해외 요약도 그 owner 의 문자열 그대로다", () => {
    const rows = buildJudgementSummary({
      ...EMPTY,
      overseas: domesticWith({ title: "🌎 해외 시장", figure: "EUR 75 ~ 120", figureBasis: "판매처 4곳" }),
    });
    expect(find(rows, "해외 시장")?.value).toBe("EUR 75 ~ 120");
    expect(find(rows, "해외 시장")?.note).toBe("판매처 4곳");
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

  it("요약 제목과 줄들이 실제 DOM 에 선다", () => {
    const html = render({
      verdictLabel: "조건부 판매",
      domestic: null,
      overseas: null,
      transient: [{ sourceLabel: "직접 입력", rows: [DONOKIDS] }],
    });
    expect(html).toContain(JUDGEMENT_SUMMARY_TITLE);
    expect(html).toContain("조건부 판매");
    expect(html).toContain("KRW 117,000");
    expect(html).toContain("판매판정 미반영");
    expect(html).toContain('data-testid="judgement-summary"');
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
