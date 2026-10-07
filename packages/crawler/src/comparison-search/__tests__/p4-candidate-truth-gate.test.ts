import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compareCrossSellerProducts } from "../cross-seller";
import type { CrossSellerConflict } from "../cross-seller";
import { deriveMatchTruth } from "../match-truth";
import { compareModelCode } from "../model-code";
import {
  productFactsFromShopifyProduct,
  productFactsFromSmallableHtml,
  type ShopifyProductLike,
} from "../seller-facts";

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../__tests__/fixtures");

/** 🔴 2026-10-07 main-story.com 실응답을 그대로 저장한 fixture. 값을 손보지 않았다. */
function mainStory(file: string) {
  return productFactsFromShopifyProduct(
    JSON.parse(readFileSync(path.join(FIX, file), "utf8")) as ShopifyProductLike,
    "main-story.com",
  );
}
function bobo(code: string) {
  return productFactsFromShopifyProduct(
    JSON.parse(readFileSync(path.join(FIX, `bobochoses-${code.toLowerCase()}.json`), "utf8")) as ShopifyProductLike,
    "bobochoses.com",
  );
}
function smallable(file: string, id: string) {
  const f = productFactsFromSmallableHtml(readFileSync(path.join(FIX, file), "utf8"), id);
  if (!f) throw new Error(file);
  return f;
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-DISCOVERY-P4 — Candidate Truth Gate Consolidation (변경 A · B · C)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 상품 입력은 **2026-10-07 실측값** 이다 — main-story.com · bobochoses.com ·
 *    Smallable · Misha&Puff 실제 품번과 실응답 fixture.
 *
 * 변경 A  cross-seller.ts   식별 증거(TITLE·MODEL_CODE)가 없고 «같은 판매처의 다른
 *                           진열» 이면 PRESUMED_SAME 으로 올리지 않는다
 * 변경 B  match-truth.ts    브랜드 품번이 exact 이고 반증이 «정확히 COLOR 하나» 면
 *                           CONFLICT 가 아니라 SIMILAR(→ REFERENCE)다
 * 변경 C  model-code.ts     LCS partial 은 공유 부분이 «숫자 코어» 일 때만 인정한다
 *
 * 🔴 셋 다 새 enum 0 · threshold 변경 0 · DB 변경 0 이다.
 */

/* ═════════════ 변경 C — LCS partial 은 숫자 코어일 때만 ═════════════ */

describe("P4 변경 C: 공유 부분이 숫자 코어가 아니면 partial 이 아니다", () => {
  /**
   * 🔴 **이번 수정의 과녁.** main-story.com 실측(2026-10-07):
   *    원상품 Bubble Sweatshirt(AW26MS185) ↔ 후보 Polo Sweatshirt(SS26MS252).
   *    공유는 `26MS` — 「26」은 시즌연도, 「MS」는 브랜드 약자다. 둘 다 상품을
   *    식별하지 않고, 식별하는 말미 숫자(185 ↔ 252)는 서로 다르다.
   *
   *    이 partial 이 run-domestic-price-check 의 식별자 우회로(exact || partial)에
   *    걸려 전혀 다른 상품이 가격 참고 후보로 살아남았다(P2.5.2 실측).
   */
  it("🔴 시즌연도+브랜드 약자만 겹친 코드는 conflict 다", () => {
    expect(compareModelCode("AW26MS185", "SS26MS252")).toBe("conflict");
  });

  /** 🟢 LCS 분기의 «원래 목적» 은 그대로 산다 — 표기법이 다른 같은 상품에서
   *  공통 숫자 코어가 유일한 단서인 경우(PèPè 골든케이스, 공유 `1195`). */
  it("숫자 코어를 공유하면 partial 이다 — PèPè 골든케이스 보존", () => {
    expect(compareModelCode("01195-VERNICE-NERO", "PP24KASHE1195NER")).toBe("partial");
  });

  /** 🟢 Misha & Puff 두 쌍 — 공유에 4~5자리 숫자가 들어 있어 보존된다.
   *  🔴 처음 설계한 「말미 숫자군이 다르면 conflict」 안은 아래 둘째 줄을 깨뜨렸다.
   *     그래서 폐기하고 숫자 코어 조건을 골랐다 — 측정이 설계를 골랐다. */
  it("Misha & Puff 기존 partial 두 쌍이 유지된다", () => {
    expect(compareModelCode("B1408F26-670", "B1453F26-670")).toBe("partial"); // 공유 F26670
    expect(compareModelCode("B1408F26-670", "K1408F26-1A8")).toBe("partial"); // 공유 1408F26
  });

  /** 🟢 다른 분기는 손대지 않았다 — 영향 0 을 값으로 고정한다. */
  it("startsWith · prefix 분기는 영향이 없다", () => {
    expect(compareModelCode("B126AI018", "B126AI01831152")).toBe("partial"); // startsWith
    expect(compareModelCode("B226AC043", "B226AC04341101")).toBe("partial"); // startsWith
    expect(compareModelCode("B226AC042", "B226AC043")).toBe("conflict"); // prefix 8 — P-10-F 보호
    expect(compareModelCode("B126AC050", "B126AC999")).toBe("conflict"); // prefix 6 — known limitation
    expect(compareModelCode("AW26MS185", "AW26MS185")).toBe("exact");
    expect(compareModelCode("AW26MS185", null)).toBe("unavailable");
  });

  /** 🔴 대조군 — 숫자런이 «정확히 3자» 면 코어로 인정한다(경계값을 값으로 못박는다). */
  it("숫자런 경계: 3자는 코어 · 2자는 아니다", () => {
    // 공유 `X670`(숫자런 3) → partial
    expect(compareModelCode("AA1X670ZZ", "BB2X670YY")).toBe("partial");
    // 공유 `X67Z`(숫자런 2) → conflict
    expect(compareModelCode("AA1X67ZQQ", "BB2X67ZPP")).toBe("conflict");
  });
});

/* ═════════════ 변경 A — 식별 증거 없는 «같은 판매처» 쌍은 추정하지 않는다 ═════════════ */

describe("P4 변경 A: 부수 증거만으로 동일상품을 추정하지 않는다", () => {
  /**
   * 🔴 **이번 수정의 과녁.** main-story.com 실측 fixture:
   *
   *   Bubble Sweatshirt - Grey Melange  ↔  Polo Sweatshirt - Gray Lilac
   *   같은 판매처 · 전혀 다른 상품
   *   axes = CATEGORY+1 COLOR+1 MATERIAL+1 SIZE+1 = 4 ≥ 문턱 3
   *   TITLE = 겹치는 핵심어 0 → NO_TITLE_OVERLAP blocker
   *
   * 고치기 전: PRESUMED_SAME → TEXT_CONFIRMED → COMPARISON(가격 참고)
   */
  it("🔴 같은 판매처 + 제목 0겹침 + 식별자 없음 → PRESUMED_SAME 이 아니다", () => {
    const m = compareCrossSellerProducts(
      mainStory("main-story-bubble-sweatshirt-grey-melange-1.json"),
      mainStory("main-story-polo-sweatshirt-gray-lilac.json"),
    );
    // 전제가 실제로 성립하는지 먼저 확인한다 — 전제가 깨지면 이 테스트는 무의미하다
    expect(m.blockers.map((b) => b.blocker)).toContain("NO_TITLE_OVERLAP");
    expect(m.blockers.map((b) => b.blocker)).toContain("SAME_SELLER_DISTINCT_LISTING");
    expect(m.axes.some((a) => a.axis === "TITLE" || a.axis === "MODEL_CODE")).toBe(false);
    expect(m.axes.reduce((s, a) => s + a.points, 0)).toBeGreaterThanOrEqual(3);
    // 🔴 그런데도 추정하지 않는다
    expect(m.verdict).not.toBe("PRESUMED_SAME");
    expect(m.verdict).not.toBe("SAME");
  });

  /**
   * 🔴 **과잉 차단 대조군.** 이 저장소의 출발점은 「판매처마다 상품명이 다르다」 이므로
   *    **다른 판매처** 의 제목 불일치는 정상이다. 구현 중 「식별 증거만 요구」로 넣었다가
   *    아래 둘째 쌍이 함께 죽었고, 그래서 «같은 판매처» 조건을 더했다.
   */
  it("다른 판매처 쌍은 영향이 없다 — 진짜 SAME 과 기존 PRESUMED_SAME 둘 다 (A)", () => {
    // 진짜 동일상품(TITLE 축이 있다) — SAME 유지
    expect(
      compareCrossSellerProducts(smallable("smallable-430701-product.html", "430701"), bobo("B226AC114")).verdict,
    ).toBe("SAME");
    // 제목이 0겹침이지만 «다른 판매처» 다 — 기존 PRESUMED_SAME 유지
    expect(
      compareCrossSellerProducts(smallable("smallable-430700-product.html", "430700"), bobo("B226AC112")).verdict,
    ).toBe("PRESUMED_SAME");
  });
});

/* ═════════════ 변경 B — COLOR 단독충돌 + 코드 exact → SIMILAR ═════════════ */

describe("P4 변경 B: 「같은 모델·색상만 다름」은 「다른 상품」이 아니다", () => {
  const c = (...xs: CrossSellerConflict[]) => xs.map((conflict) => ({ conflict }));
  /** 🔴 tier 는 admin 의 priceTierFromLink 가 정한다. 그 함수를 여기서 복제하지
   *  않는다 — 대신 matchTruth 를 단언하고, tier 매핑은 admin 쪽 테스트가 이미
   *  전수로 고정하고 있다(SIMILAR → REFERENCE · CONFLICT → EXCLUDED). */

  /* ── Positive ── */
  it("🟢 exact code + COLOR 단독충돌 → SIMILAR (→ REFERENCE)", () => {
    expect(deriveMatchTruth("very_high", "exact", "CONFLICT", [], c("COLOR"))).toBe("SIMILAR");
    // 텍스트 등급이 무엇이든 같다 — 식별자와 반증 종류만 본다.
    expect(deriveMatchTruth("low", "exact", "CONFLICT", [], c("COLOR"))).toBe("SIMILAR");
  });

  /* ── Negative ── */
  /** 🔴 MATERIAL·FIT 등은 conflict 가 아니라 blocker 다 — 여기서는 «실제 conflict
   *  어휘» 만 쓴다(CrossSellerConflict 6값). 타입을 우회해 가짜 값을 넣지 않는다. */
  it("🔴 COLOR + 다른 축이 함께 충돌하면 CONFLICT 그대로", () => {
    expect(deriveMatchTruth("very_high", "exact", "CONFLICT", [], c("COLOR", "GENDER"))).toBe("CONFLICT");
    expect(deriveMatchTruth("very_high", "exact", "CONFLICT", [], c("COLOR", "CATEGORY"))).toBe("CONFLICT");
    expect(deriveMatchTruth("very_high", "exact", "CONFLICT", [], c("COLOR", "AUDIENCE"))).toBe("CONFLICT");
    expect(deriveMatchTruth("very_high", "exact", "CONFLICT", [], c("COLOR", "COMPOSITION"))).toBe("CONFLICT");
  });

  it("🔴 코드가 exact 가 아니면 CONFLICT 그대로", () => {
    for (const code of ["partial", "conflict", "unavailable"] as const) {
      expect(deriveMatchTruth("very_high", code, "CONFLICT", [], c("COLOR"))).toBe("CONFLICT");
    }
  });

  it("🔴 COLOR 가 아닌 단독충돌은 CONFLICT 그대로", () => {
    for (const only of ["CATEGORY", "AUDIENCE", "GENDER", "MODEL_CODE", "COMPOSITION"] as CrossSellerConflict[]) {
      expect(deriveMatchTruth("very_high", "exact", "CONFLICT", [], c(only))).toBe("CONFLICT");
    }
  });

  /** 🔴 모르는 것으로 바꾸지 않는다 — conflicts 를 «받지 못하면» 예전 그대로 CONFLICT. */
  it("🔴 conflicts 를 넘기지 않으면 예전과 똑같다 — 옛 호출부 보호", () => {
    expect(deriveMatchTruth("very_high", "exact", "CONFLICT")).toBe("CONFLICT");
    expect(deriveMatchTruth("very_high", "exact", "CONFLICT", [])).toBe("CONFLICT");
    expect(deriveMatchTruth("very_high", "exact", "CONFLICT", [], null)).toBe("CONFLICT");
    expect(deriveMatchTruth("very_high", "exact", "CONFLICT", [], [])).toBe("CONFLICT");
  });

  /** 🔴 CONFLICT 가 «아닌» 경로는 한 글자도 바뀌지 않는다 — 6568fb2 가드 포함. */
  it("🔴 CONFLICT 아닌 경로 보존 — 6568fb2 가드와 정상 EXACT", () => {
    // 6568fb2 — PRESUMED_SAME 은 품번이 exact 여도 EXACT 가 아니다
    expect(deriveMatchTruth("very_high", "exact", "PRESUMED_SAME", [], c("COLOR"))).toBe("TEXT_CONFIRMED");
    // 정상 동일상품 경로
    expect(deriveMatchTruth("very_high", "exact", "SAME", [], [])).toBe("EXACT_IDENTIFIER");
    expect(deriveMatchTruth("low", "exact", undefined, undefined, undefined)).toBe("STRONG_IDENTIFIER");
  });
});
