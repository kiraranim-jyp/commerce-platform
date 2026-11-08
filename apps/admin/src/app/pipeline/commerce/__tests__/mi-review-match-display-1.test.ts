import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FINAL_VERDICT_COPY,
  NEEDS_MATCH_VERDICT_COPY,
  resolveSellVerdictCopy,
} from "../DomesticPriceIntelligencePanel";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-REVIEW-MATCH-DISPLAY-1 — **「판단 불가」를 「조건부 판매」로 말하지 않는다**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CEO 화면 FAIL 의 실체 — 「조건부 판매」와 「수익성을 판단할 수 없습니다」가 **같이** 떴다.
 *    그 「조건부 판매」는 정책 A(CASE B)가 아니라 **`REVIEW_MATCH`(동일상품 미검증)** 에서 온다.
 * 🟢 CPO 승인 ⑵ — **표시 전용 resolver**. 내부 코드(`CONDITIONAL`)는 한 글자도 바꾸지 않는다.
 *
 * 🔴 셋을 구분한다(CPO 확정):
 * ```
 * 판매 비추천        확인된 근거상 목표마진 달성 **불가**
 * 동일상품 확인 필요   근거가 부족해 **판단 자체가 불가**
 * 판매 추천          확인된 근거상 목표마진 달성 **가능**
 * ```
 */

const REPO = path.join(__dirname, "..", "..", "..", "..", "..", "..", "..");
const strip = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const read = (rel: string) => strip(readFileSync(path.join(REPO, rel), "utf8"));
const WS = read("apps/admin/src/app/pipeline/CommerceWorkspace.tsx");
const PANEL = read("apps/admin/src/app/pipeline/commerce/DomesticPriceIntelligencePanel.tsx");

describe("RMD §1 — 4상태 표시", () => {
  /** 🟢 CASE A — 목표마진 달성 가능. READY → RECOMMENDED. */
  it("①-a CASE A → **판매 추천**", () => {
    expect(resolveSellVerdictCopy("RECOMMENDED", "READY")?.title).toBe(FINAL_VERDICT_COPY.RECOMMENDED.title);
    expect(resolveSellVerdictCopy("RECOMMENDED", "READY")?.title).toBe("판매 추천");
  });

  /** 🔵 CASE B — 정책 A. 🔴 이 WU 가 그것을 **되돌리지 않는다**. */
  it("①-b CASE B → **판매 비추천**(정책 A 보존)", () => {
    expect(resolveSellVerdictCopy("NOT_RECOMMENDED", "HOLD")?.title).toBe("판매 비추천");
  });

  /** 🔵 CASE C — 손실. B 와 같은 코드지만 **근거 문장이 다르다**(pricing 쪽 계약이 본다). */
  it("①-c CASE C → **판매 비추천**", () => {
    expect(resolveSellVerdictCopy("NOT_RECOMMENDED", "HOLD")?.title).toBe("판매 비추천");
  });

  /** 🔵🔵 CASE D / REVIEW_MATCH — **이 WU 가 고치는 자리**. */
  it("①-d REVIEW_MATCH → **동일상품 확인 필요**(「조건부 판매」가 아니다)", () => {
    const copy = resolveSellVerdictCopy("CONDITIONAL", "REVIEW_MATCH");
    expect(copy?.title).toBe("동일상품 확인 필요");
    expect(copy?.title).not.toContain("조건부");
    /** 🔴 **판매 비추천으로 위장하지 않는다** — 판단 불가는 비추천이 아니다. */
    expect(copy?.title).not.toContain("비추천");
    expect(copy?.tone).toBe("CAUTION");
  });

  /**
   * ════════════════════════════════════════════════════════════════════════
   * 🟢🟢 **이 단언이 «뒤집혔다»** — `SELLER-UX-IMPLEMENTATION-1`(CPO 승인 2026-11-09)
   * ════════════════════════════════════════════════════════════════════════
   *
   * 🔴 이 WU(`MI-REVIEW-MATCH-DISPLAY-1`)는 **`REVIEW_MATCH` 하나만** 갈랐고 이 자리는
   *    「나머지 셋은 **기존 문구 그대로**」를 의도로 고정했다.
   * 🔴🔴 조사(`SELLER-UX-GAP-INVESTIGATION-1` §3·§4)가 **그것이 CEO FAIL 의 원인** 임을
   *    밝혔다 — 그 셋은 **요구 행동이 서로 다른데**(시세 직접 확인 / 가격 조정 / 원가 입력)
   *    같은 「조건부 판매」로 보였다 ⟹ CPO 가 **분리를 승인** 했다.
   * 🟢 그래서 **반대 방향** 을 잠근다. 🔴 그리고 **tone 은 전부 `CAUTION` 그대로** 다
   *    (색·위계 불변 · 내부 `SELLER_FACING_MAP` 은 **한 글자도 안 바뀌었다**).
   */
  it("①-e 🟢🟢 CONDITIONAL 세 코드가 **서로 다른 문구** 다(「조건부 판매」가 셋을 덮지 않는다)", () => {
    const codes = ["REVIEW_PRICE", "NEEDS_INFO", "MARKET_OPPORTUNITY"] as const;
    const titles = codes.map((code) => resolveSellVerdictCopy("CONDITIONAL", code)!.title);
    /** 🔴 하나라도 「조건부 판매」로 되돌아가면 FAIL. */
    for (const [i, title] of titles.entries()) {
      expect(title, codes[i]).not.toBe(FINAL_VERDICT_COPY.CONDITIONAL.title);
    }
    /** 🔴 셋이 서로 겹치지 않는다(둘이 같아지면 다시 덮는 것이다). */
    expect(new Set(titles).size, `🔴 문구가 겹친다: ${titles.join(" · ")}`).toBe(codes.length);
    /** 🔴 **다음 행동이 있다** — 그것이 이 분리의 목적이다(「다음에 무엇을 하는가」). */
    for (const code of codes) {
      expect(resolveSellVerdictCopy("CONDITIONAL", code)!.action, code).toBeTruthy();
    }
    /** 🔴 위계는 바뀌지 않았다 — tone 전부 `CAUTION`. */
    for (const code of codes) {
      expect(resolveSellVerdictCopy("CONDITIONAL", code)!.tone, code).toBe("CAUTION");
    }
  });

  it("①-f 🔴 판정이 없으면 **문구를 만들지 않는다**", () => {
    expect(resolveSellVerdictCopy(null, "REVIEW_MATCH")).toBeNull();
    /** 🟢 분기 재료가 없어도 기존 문구는 그대로 선다(배선 전 상태로 안전하게 떨어진다). */
    expect(resolveSellVerdictCopy("CONDITIONAL", null)?.title).toBe(FINAL_VERDICT_COPY.CONDITIONAL.title);
  });
});

describe("RMD §2 — 세 화면이 같은 resolver 를 쓴다(표시 불일치 0)", () => {
  /**
   * 🔴🔴 **CPO 요구 4** — 요약 헤드라인 · MarketPriceComparison · ActionCenter 의 표시가
   *    일치해야 한다. 하나만 바꾸면 화면끼리 다른 판단을 말한다.
   */
  it("②-a 🔴 MarketPriceComparison 과 ActionCenter 가 **resolver 로** 받는다", () => {
    expect(WS).toContain("sellVerdictCopy={resolveSellVerdictCopy(sellVerdict, representativeCode)}");
    expect(WS).toContain("verdict={resolveSellVerdictCopy(sellVerdict, representativeCode)}");
    /** 🔴 옛 직통 경로가 남아 있으면 그 화면만 「조건부 판매」로 되돌아간다. */
    expect(WS).not.toContain("FINAL_VERDICT_COPY[sellVerdict]");
  });

  it("②-b 🔴 요약 헤드라인도 **같은 함수** 를 쓴다", () => {
    expect(PANEL).toContain("resolveSellVerdictCopy(sellerDecision.finalVerdict, representativeVerdict?.code ?? null)");
    /**
     * 🔴🔴 **단언을 «살아 있는 경로» 로 좁힌다 — 내 1차 단언이 너무 넓어 FAIL 했다.**
     *    `FINAL_VERDICT_COPY[sellerDecision.finalVerdict]` 는 `MiPanelView` 안에도 **셋** 있는데
     *    그 컴포넌트는 **운영에서 마운트되지 않는다**(`presentation="HIDDEN"` · 죽은 렌더).
     *    ⟹ 🔴 그것까지 금지하면 **화면과 무관한 코드** 를 고치게 된다.
     * 🟢 그래서 **조립 함수 구간만** 본다 — 그 자리가 셀러 화면으로 가는 유일한 경로다.
     */
    const at = PANEL.indexOf("export function buildJudgementSummaryInput");
    const body = PANEL.slice(at, PANEL.indexOf("\n}", PANEL.indexOf("transient: [", at)));
    expect(body).toContain("resolveSellVerdictCopy(");
    expect(body, "🔴 요약이 FINAL_VERDICT_COPY 를 직접 쓰면 세 화면이 갈린다").not.toContain(
      "FINAL_VERDICT_COPY[",
    );
  });

  it("②-c 🔴 어휘 owner 는 **하나** 다(사본 0)", () => {
    expect((PANEL.match(/동일상품 확인 필요/g) ?? []).length).toBe(1);
    expect(WS).not.toContain("동일상품 확인 필요");
  });

  it("②-d 🔵 배선 1개 — 패널이 `representativeVerdict.code` 를 그대로 보고한다", () => {
    expect(PANEL).toContain("onRepresentativeVerdictChange?.(data?.representativeVerdict?.code ?? null)");
    expect(WS).toContain("onRepresentativeVerdictChange={handleRepresentativeVerdictChange}");
    /** 🔴 `MarketComparisonInput` 에 **합치지 않았다**(채널 분리 · CPO ⒜). */
    const at = PANEL.indexOf("export interface MarketComparisonInput");
    expect(PANEL.slice(at, PANEL.indexOf("\n}", at))).not.toContain("representativeVerdict");
  });

  it("②-e 🔴 상품이 바뀌면 **이전 상품의 분기값을 쓰지 않는다**(잔상 0)", () => {
    expect(WS).toContain("reportedRepVerdict.snapshotId === (snapshotId ?? null)");
  });
});

describe("RMD §3 — 내부 판정값과 동결 축 보존", () => {
  it("③-a 🔴 `SELLER_FACING_MAP` · `CONDITIONAL` 내부 코드를 바꾸지 않았다", () => {
    const pricing = read("packages/pricing/src/representative-seller-decision.ts");
    expect(pricing).toContain('REVIEW_MATCH: "CONDITIONAL"');
    expect(pricing).toContain('READY: "RECOMMENDED"');
    expect(pricing).toContain('HOLD: "NOT_RECOMMENDED"');
  });

  it("③-b 🔴 정책 A(CASE B → HOLD)가 그대로다", () => {
    const pricing = read("packages/pricing/src/representative-seller-decision.ts");
    expect(pricing).toContain("MARGIN_SHORTFALL_DESCRIPTION");
    expect(pricing).not.toContain('code: "REVIEW_PRICE",\n    reasons: [...verdict.reasons, gapReason]');
  });

  it("③-c 🔴 resolver 는 **표시만** 한다 — 판정·가격 어휘가 없다", () => {
    const at = PANEL.indexOf("export function resolveSellVerdictCopy");
    const body = PANEL.slice(at, PANEL.indexOf("\n}", at));
    for (const banned of ["priceTierFromLink", "threshold", "SAME_MIN_AXES", "recommendedPriceKrw", "marketCase"]) {
      expect(body, `🔴 resolver 에 ${banned} 가 있다`).not.toContain(banned);
    }
  });
});
