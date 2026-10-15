import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  GeminiTransientCandidates,
  SUPPLIED_URL_HEADING,
  TRANSIENT_NOTICE,
  TRANSIENT_SCOPE_NOTICE,
  WEB_SEARCH_HEADING,
  priceConfidenceText,
  priceText,
  verdictDisplay,
  type GeminiTransientRow,
} from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-028 — **결과를 3초 안에 읽을 수 있는가** (마운트 DOM)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 가 Production 화면에서 확정한 병목은 기능이 아니라 **표현** 이었다:
 * ```
 * ② 내가 입력한 URL 의 결과라는 것을 바로 알 수 없다
 * ③ PRESUMED_SAME / COMPARISON 의 의미가 화면에서 즉시 이해되지 않는다
 * ④ 가격은 있는데 왜 판매판정에 안 들어가는지 직관적이지 않다
 * ```
 * 🔴 그래서 이 파일이 검사하는 것은 **판정값이 아니라 「사용자가 보는 글자」** 다.
 * 🔴 **소스 문자열이 아니라 렌더된 DOM 으로** 본다(헌장 §5 — Render PASS ≠ 소스 PASS).
 *
 * 🔴 **정책은 한 줄도 바꾸지 않았다** — 아래 단언이 그것을 같이 잠근다:
 *    저장 금지 문구 유지 · 「동일상품 확인」 버튼 없음 · 통화 환산 없음 ·
 *    `UNVERIFIED_SEARCH` 승격 없음 · UNKNOWN 시장을 국내로 적지 않음.
 */

/** 🟢 **실측값 그대로다** — WU-027 release tree 의 LIVE E2E 산출(donokids · GT SAME). */
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
  matchReasons: ["상품명 토큰 일치", "브랜드 일치"],
};

const render = (rows: GeminiTransientRow[], heading?: string, testId?: string) =>
  renderToStaticMarkup(
    GeminiTransientCandidates({ evidence: rows, heading, testId }) as never,
  );

/* ══════════════ A. 🔴 「내가 넣은 판매처」임이 결과에서 바로 읽힌다 ══════════════ */

describe("A. 출처가 결과 «행» 에서 보인다", () => {
  /**
   * 🔴🔴 **머리글이 아니라 «행 배지» 를 본다.** 처음엔 `toContain("직접 입력")` 으로
   *    썼는데, 구역 머리글(`🔗 직접 입력한 후보`)이 그 문자열을 포함하므로 **배지를
   *    통째로 지워도 통과** 했다(변이 M4 가 그것을 잡았다). 그래서 배지 «요소의 내용»
   *    을 집어서 단언한다.
   */
  const sourceBadgeText = (html: string): string | null =>
    /data-testid="gt-source"[^>]*>([^<]*)</.exec(html)?.[1]?.trim() ?? null;

  it("직접 입력 후보에 출처 배지가 붙는다", () => {
    const html = render([DONOKIDS], SUPPLIED_URL_HEADING, "url-candidate-transient");
    expect(sourceBadgeText(html)).toBe("직접 입력");
    expect(html).toContain(SUPPLIED_URL_HEADING);
  });

  /** 🔴 머리글만으로는 부족하다 — 행이 섞여 보일 때 구분이 사라진다(CPO ②). */
  it("웹 검색 후보와 직접 입력 후보의 «행 배지» 가 다르다", () => {
    const supplied = render([DONOKIDS], SUPPLIED_URL_HEADING, "url-candidate-transient");
    const web = render([{ ...DONOKIDS, source: "GEMINI_DISCOVERY" }]);
    expect(sourceBadgeText(supplied)).toBe("직접 입력");
    expect(sourceBadgeText(web)).toBe("웹 검색");
    expect(supplied).not.toContain(WEB_SEARCH_HEADING);
  });

  /**
   * 🔴 **행 배지와 구역 머리글을 섞어 단언하지 않는다.** 처음엔 「"웹 검색 후보"가
   *    없다」로 썼는데, 그것은 구역 **머리글의 기본값** 이라 당연히 있다 — 내 단언이
   *    틀린 것이었다(테스트를 고쳤고 코드는 그대로다).
   */
  it("출처를 모르면 «행 배지» 를 지어내지 않는다", () => {
    const html = render([{ ...DONOKIDS, source: null }]);
    expect(html).not.toContain('data-testid="gt-source"');
    expect(html).not.toContain("직접 입력");
  });
});

/* ══════════════ B. 🔴 한 행에서 판매처·상품·판정·가격·신뢰도가 같이 보인다 ══════════════ */

describe("B. 한 행이 여섯 가지를 같이 말한다", () => {
  it("판매처 · 상품명 · 판정 · 가격 · 가격신뢰도 · 출처", () => {
    const html = render([DONOKIDS], SUPPLIED_URL_HEADING, "url-candidate-transient");
    expect(html).toContain("donokids.com"); // 판매처
    expect(html).toContain("Bubble Sweatshirt"); // 상품
    expect(html).toContain("동일상품 추정"); // 판정(라벨 owner)
    expect(html).toContain("KRW 117,000"); // 가격(통화 그대로)
    expect(html).toContain("판매판정 미반영"); // 가격 신뢰도/반영 여부
    expect(html).toContain("직접 입력"); // 출처
  });

  /** 🔴 상품명이 없으면 **빈 칸을 만들지 않는다** — 없는 것을 있는 척하지 않는다. */
  it("상품명이 없으면 그 줄이 아예 없다", () => {
    const html = render([{ ...DONOKIDS, title: null }]);
    expect(html).not.toContain('data-testid="gt-title"');
    expect(html).toContain("donokids.com");
  });

  /**
   * 🔴🔴 **서버가 실제로 상품명을 싣는가** — UI 만 보면 fixture 가 대신 채워 준다.
   *    변이 M5(`title: ""`)가 UI 테스트를 **전부 통과** 해서 이 단언을 추가했다.
   *    🟢 판정이 고른 바로 그 후보의 제목이어야 한다(다른 값으로 바꿔치기 금지).
   */
  it("🔴 서버가 판정 후보의 제목을 evidence 에 싣는다", () => {
    const runner = readFileSync(
      path.join(__dirname, "..", "..", "..", "api", "price-history", "_lib", "run-domestic-price-check.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const push = runner.slice(runner.indexOf("transientEvidenceSink.push({"));
    expect(push.slice(0, push.indexOf("});"))).toContain("title: best.title,");
  });
});

/* ══════════════ C. 🔴🔴 내부 enum 을 사용자에게 보여주지 않는다 ══════════════ */

describe("C. 내부 어휘가 화면으로 새지 않는다", () => {
  it.each(["PRESUMED_SAME", "TEXT_CONFIRMED", "UNVERIFIED_SEARCH", "COMPARISON", "SELLER_URL", "KR_TLD"])(
    "%s 가 화면에 그대로 나오지 않는다",
    (token) => {
      const html = render([DONOKIDS], SUPPLIED_URL_HEADING, "url-candidate-transient");
      expect(html).not.toContain(token);
    },
  );

  /** 🟢 대신 **라벨 owner(`domesticMatchDisplay`)가 정한 말** 이 나온다 — 사본 0. */
  it("판정 라벨과 한 줄 근거가 owner 값과 «같다»", () => {
    const d = verdictDisplay(DONOKIDS);
    expect(d).not.toBeNull();
    const html = render([DONOKIDS]);
    expect(html).toContain(d!.label);
    expect(html).toContain(d!.note);
  });

  /**
   * 🟢 `matchTruth` 가 없어도 **정보를 잃지 않는다** — 교차판매처 판정값은
   *    `MatchDisplayTier` 와 같은 어휘라 같은 owner 가 말로 바꿔 준다.
   * 🔴 둘 다 없을 때만 「판정 미확인」이다(지어내지 않는다).
   */
  it("matchTruth 가 없으면 교차판매처 판정을 같은 owner 로 말한다", () => {
    const html = render([{ ...DONOKIDS, matchTruth: null }]);
    expect(html).toContain("동일상품 추정");
    expect(html).not.toContain("PRESUMED_SAME");
  });

  it("판정이 둘 다 없으면 라벨을 지어내지 않는다", () => {
    const html = render([{ ...DONOKIDS, matchTruth: null, crossSellerVerdict: null }]);
    expect(html).toContain("판정 미확인");
  });
});

/* ══════════════ D. 🔴🔴 「가격은 있는데 판매판정엔 없다」를 그 자리에서 설명한다 ══════════════ */

describe("D. 가격 신뢰도 — 정책은 그대로, 말만 더한다", () => {
  it.each([
    ["UNVERIFIED_SEARCH", "판매처 표시가 · 상세 검증 전 · 판매판정 미반영"],
    ["VERIFIED_CURRENT", "상세 페이지에서 확인한 가격 · 판매판정 미반영"],
    ["PRICE_UNAVAILABLE", "가격을 확인하지 못했습니다"],
  ])("%s → %s", (status, expected) => {
    expect(priceConfidenceText({ ...DONOKIDS, priceStatus: status })).toBe(expected);
  });

  /** 🔴🔴 **어떤 상태에서도 「판매판정에 반영된다」고 말하지 않는다** — transient 구역의
   *  불변식이다(WU-022). 승격 문구가 생기면 화면이 거짓말을 한다. */
  it("가격이 있는 모든 상태에서 «미반영» 사실이 붙는다", () => {
    for (const status of ["UNVERIFIED_SEARCH", "VERIFIED_CURRENT", null, undefined]) {
      const text = priceConfidenceText({ ...DONOKIDS, priceStatus: status as string });
      expect(text, String(status)).toContain("미반영");
    }
  });

  /** CASE D — 가격이 없으면 **0원을 만들지 않는다**. */
  it("가격이 없으면 「가격 미확인」이고 0 이 나오지 않는다", () => {
    const noPrice: GeminiTransientRow = { ...DONOKIDS, priceAmount: null, priceCurrency: null };
    expect(priceText(noPrice)).toBe("가격 미확인");
    expect(priceConfidenceText(noPrice)).toBeNull();
    const html = render([noPrice]);
    expect(html).toContain("가격 미확인");
    expect(html).not.toContain("0원");
    expect(html).not.toContain("KRW 0");
  });

  /** 🔴 통화를 환산하지 않는다(기존 불변식). */
  it("외화는 그 통화 그대로 적는다", () => {
    expect(priceText({ ...DONOKIDS, priceAmount: 75, priceCurrency: "EUR" })).toBe("EUR 75");
  });
});

/* ══════════════ E. 🔴 기존 보장이 하나도 사라지지 않았다 ══════════════ */

describe("E. 저장 금지·승격 금지·시장 추측 금지가 그대로다", () => {
  it("두 고정 안내문이 그대로 있다", () => {
    const html = render([DONOKIDS], SUPPLIED_URL_HEADING, "url-candidate-transient");
    expect(html).toContain(TRANSIENT_NOTICE);
    expect(html).toContain(TRANSIENT_SCOPE_NOTICE);
  });

  it("🔴 「동일상품 확인」 승격 버튼이 없다(DB 저장 금지)", () => {
    const html = render([DONOKIDS], SUPPLIED_URL_HEADING, "url-candidate-transient");
    expect(html).not.toContain("동일상품 확인");
    expect(html).not.toContain("<button");
  });

  it("🔴 UNKNOWN 시장을 «국내» 로 적지 않는다", () => {
    const html = render([{ ...DONOKIDS, market: "UNKNOWN" }]);
    expect(html).not.toContain('data-testid="gt-market"');
  });

  it("비어 있으면 구역 자체가 렌더되지 않는다", () => {
    expect(render([])).toBe("");
  });
});
