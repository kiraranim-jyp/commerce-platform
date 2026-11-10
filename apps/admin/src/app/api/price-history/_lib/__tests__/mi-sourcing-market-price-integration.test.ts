import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { toSavedCandidateRows } from "../saved-candidate-rows";
import type { CandidateReviewRow } from "../candidate-review";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-SOURCING-MARKET-PRICE-INTEGRATION — 후보 가격이 «재진입에도» MI 에 닿는다
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **고친 결함** — POST `/check` 는 소싱 후보군의 국내 비교 상품 가격으로 국내
 *    축을 만들었는데, GET 재진입은 그 후보를 **표시 칸으로만** 되돌렸다
 *    ⟹ 같은 상품인데 새로고침하면 **국내 참고가격·참고 수익성이 사라졌다.**
 *
 * 🟢 **새 저장소를 만들지 않았다**(CPO 지시 3) — 값은 **이미 저장돼 있었다**:
 * ```
 * POST  recordSeenCandidates (check/route.ts)  → candidate_reviews
 *       price_amount · price_currency · market · price_tier …
 * GET   toSavedCandidateRows                   → 그 값을 되돌린다
 * 빠진 것  그 복원분이 «가격 집계 루프» 로 오는 길 하나뿐이었다
 * ```
 * 🔴 migration 0 · 새 테이블 0 · 환율 변환 0 · CASE 정책 0.
 *
 * ── 🔴 CPO 성공 조건(2026-11-10) ─────────────────────────────────────────────
 * ```
 * ① 후보 가격이 POST «그리고» GET 재진입 모두에서 국내 가격 근거로 유지된다
 * ② 참고가격·참고 수익성이 재진입 후에도 소멸하지 않는다
 * ③ 같은 입력에 POST/GET 결과가 일관된다
 * ④ COMPARISON 은 **계속 CASE D** 다        ← 정책 변경 금지
 * ⑤ 기존 EXACT 기반 CASE·판매 판정은 불변
 * ```
 */

const LIB = join(__dirname, "..");
/** 🔴 소스 축은 **주석을 벗기고** 본다 — 주석 문구로 통과하면 계약이 거짓이 된다. */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const INTEL = strip(readFileSync(join(LIB, "market-intelligence.ts"), "utf8"));
const SAVED = strip(readFileSync(join(LIB, "saved-candidate-rows.ts"), "utf8"));
const CHECK = strip(
  readFileSync(join(LIB, "..", "check", "route.ts"), "utf8"),
);

/** 🟢 저장분 한 행을 운영 모양 그대로 만든다(칸 이름은 `CandidateReviewRow` 를 따른다). */
function savedRow(over: Partial<CandidateReviewRow> = {}): CandidateReviewRow {
  return {
    candidateUrl: "https://donokids.com/product/a",
    candidateDomain: "donokids.com",
    candidateTitle: "허그 헤어리 몬스터 티셔츠",
    imageUrl: null,
    soldOut: null,
    priceStatus: "VERIFIED_CURRENT",
    priceAmount: 88_000,
    priceCurrency: "KRW",
    market: "KR",
    systemVerdict: "PRESUMED_SAME",
    matchTruth: "TEXT_CONFIRMED",
    priceTier: "COMPARISON",
    matchReasons: ["근거: 상품군 TOP↔TOP"],
    blockers: [],
    source: "DOMESTIC_LISTING",
    humanVerdict: null,
    ...over,
  } as CandidateReviewRow;
}

describe("A. 🔵 ① 저장분 복원이 «국내 축 입장권»(priceKrw)을 들고 온다", () => {
  it("A-1 🔴🔴 KRW 저장분이 priceKrw 를 갖는다 — 이 칸이 없어서 집계에 못 들어갔다", () => {
    const [row] = toSavedCandidateRows([savedRow()]);
    expect(row, "🔴 복원 0 — 분모가 없다").toBeTruthy();
    expect(row!.priceKrw, "🔴 KRW 저장분인데 국내 축 입장권이 없다").toBe(88_000);
    /** 🟢 원본 칸은 그대로다 — 덮어쓰지 않았다. */
    expect(row!.priceAmount).toBe(88_000);
    expect(row!.priceCurrency).toBe("KRW");
    expect(row!.market).toBe("KR");
    expect(row!.priceTier).toBe("COMPARISON");
  });

  it("A-2 🔴🔴 **환산하지 않는다** — KRW 가 아니면 priceKrw 는 null 이다", () => {
    for (const cur of ["GBP", "USD", "EUR", "JPY", null]) {
      const [row] = toSavedCandidateRows([
        savedRow({ priceCurrency: cur, priceAmount: 37, market: "OVERSEAS" }),
      ]);
      expect(
        row!.priceKrw,
        `🔴 ${cur} 를 원화로 환산했다 — 저장 시점과 조회 시점 환율이 달라 같은 입력이 다른 값을 낸다`,
      ).toBeNull();
      /** 🟢 원본 금액은 **버리지 않는다** — 화면은 그 통화 그대로 보여준다. */
      expect(row!.priceAmount).toBe(37);
    }
  });

  it("A-3 🟢 통화 표기가 지저분해도 같게 읽는다(저장분에 공백·소문자가 섞인다)", () => {
    for (const cur of ["krw", " KRW", "Krw "]) {
      const [row] = toSavedCandidateRows([savedRow({ priceCurrency: cur })]);
      expect(row!.priceKrw, `🔴 ${JSON.stringify(cur)} 를 못 읽었다`).toBe(88_000);
    }
  });

  it("A-4 🔴 금액이 없거나 숫자가 아니면 **만들어 적지 않는다**", () => {
    for (const amount of [null, Number.NaN, Number.POSITIVE_INFINITY]) {
      const [row] = toSavedCandidateRows([savedRow({ priceAmount: amount as number | null })]);
      expect(row!.priceKrw, `🔴 ${String(amount)} 에 가격을 지어냈다`).toBeNull();
    }
  });
});

describe("B. 🔵 ② 집계 입력이 POST/GET 에서 «각각 하나» 다 (중복 0 · 소멸 0)", () => {
  it("B-1 🔴🔴 집계 루프가 **합류된 입력** 을 순회한다(geminiEvidence 를 직접 돌지 않는다)", () => {
    expect(INTEL, "🔴 합류 입력이 없다 — 복원분이 집계로 가는 길이 끊겼다").toContain(
      "for (const e of aggregationEvidence)",
    );
    expect(
      INTEL,
      "🔴 루프가 geminiEvidence 를 직접 돈다 — GET 복원분이 영원히 제외된다",
    ).not.toContain("for (const e of geminiEvidence ?? [])");
  });

  it("B-2 🔴🔴 **POST 는 geminiEvidence «만»** 쓴다 — 저장분을 섞지 않는다(중복 집계 금지)", () => {
    const at = INTEL.indexOf("const aggregationEvidence");
    expect(at, "🔴 합류 지점을 찾지 못했다").toBeGreaterThan(0);
    const decl = INTEL.slice(at, INTEL.indexOf("for (const e of aggregationEvidence)", at));
    /** 🔴 삼항의 참가지(= geminiEvidence 가 있을 때)에 복원분이 들어가면 두 번 세어진다. */
    expect(decl).toContain("geminiEvidence && geminiEvidence.length > 0");
    expect(decl).toContain("dedupeEvidenceByUrl(geminiEvidence)");
    expect(decl).toContain("savedCandidateRowsToEvidence(savedCandidateRows)");
    const [post, get] = decl.split("savedCandidateRowsToEvidence");
    expect(
      post,
      "🔴 POST 가지에 복원분이 섞였다 — 같은 후보가 두 번 집계된다",
    ).not.toContain("savedCandidateRows");
    expect(get, "🔴 GET 가지가 없다").toBeTruthy();
  });

  it("B-3 🔴 중복 제거는 **URL 단위** 다 — 판매처(도메인)로 접지 않는다", () => {
    const at = INTEL.indexOf("function dedupeEvidenceByUrl");
    expect(at, "🔴 중복 제거기가 없다").toBeGreaterThan(0);
    const body = INTEL.slice(at, INTEL.indexOf("\n}", at));
    expect(body, "🔴 URL 로 접지 않는다").toContain("discoveredUrl");
    /**
     * 🔴🔴 **도메인으로 접으면 같은 샵의 «다른 상품» 관측이 합쳐진다**(CPO 명시).
     *    그것은 이 WU 가 고치려는 오류보다 크다.
     */
    expect(body, "🔴 판매처 단위로 접었다 — 다른 상품이 합쳐진다").not.toContain("domain");
  });

  it("B-4 🔴 복원분은 **tier 를 지어내지 않는다** — 없으면 건너뛴다", () => {
    const at = INTEL.indexOf("function savedCandidateRowsToEvidence");
    expect(at).toBeGreaterThan(0);
    const body = INTEL.slice(at, INTEL.indexOf("\n}\n", at));
    expect(body, "🔴 tier 없는 저장분을 집계로 들여보낸다").toContain("if (!r.priceTier) continue");
    /** 🔴 기본값을 주면 **우리가** 그 후보에게 가격 버킷 자격을 준 것이 된다. */
    for (const banned of ['priceTier: "COMPARISON"', 'priceTier: "EXACT"', '?? "COMPARISON"']) {
      expect(body, `🔴 tier 를 지어냈다: ${banned}`).not.toContain(banned);
    }
  });

  it("B-5 🔴 복원분은 **해외 축에 들어가지 않는다**(basis 를 지어내지 않는다)", () => {
    /**
     * 🔴 `basis`(시장 판정 근거)는 저장되지 않는다 ⟹ 복원분은 null 이다.
     * 🟢 값을 만들지 않고 **해외 가지에서 제외** 한다 ⟹ 해외 집계 숫자 불변.
     */
    expect(INTEL).toContain("e.priceAmount != null && e.priceCurrency && e.basis != null");
    const at = INTEL.indexOf("function savedCandidateRowsToEvidence");
    const body = INTEL.slice(at, INTEL.indexOf("\n}\n", at));
    expect(body, "🔴 basis 를 지어냈다").toContain("basis: null");
  });
});

describe("C. 🔵 ③ 저장·복원 경로가 «이미 있는 구조» 다 (새 저장소 0)", () => {
  it("C-1 🟢 POST 가 가격·통화·시장·tier 를 candidate_reviews 에 저장한다", () => {
    const at = CHECK.indexOf("recordSeenCandidates({");
    expect(at, "🔴 저장 호출이 없다 — 복원할 것이 없어진다").toBeGreaterThan(0);
    const call = CHECK.slice(at, CHECK.indexOf("});", at));
    for (const field of ["priceAmount", "priceCurrency", "market", "priceTier", "matchTruth"]) {
      expect(call, `🔴 ${field} 를 저장하지 않는다 — 재진입에서 되살릴 수 없다`).toContain(field);
    }
  });

  it("C-2 🟢 GET 이 그 저장분을 복원한다(restoreSavedCandidates)", () => {
    const route = strip(
      readFileSync(join(LIB, "..", "[snapshotId]", "route.ts"), "utf8"),
    );
    expect(route).toContain("restoreSavedCandidates: true");
    expect(INTEL).toContain("toSavedCandidateRows");
  });

  it("C-3 🔴🔴 **새 테이블·migration·환율 변환을 만들지 않았다**", () => {
    for (const banned of ["CREATE TABLE", "ALTER TABLE", "convertToKrw", "exchangeRate *"]) {
      expect(INTEL, `🔴 금지된 수단: ${banned}`).not.toContain(banned);
      expect(SAVED, `🔴 금지된 수단: ${banned}`).not.toContain(banned);
    }
  });
});

describe("D. 🔴 ④⑤ CASE 정책은 한 글자도 바뀌지 않았다", () => {
  it("D-1 🔴🔴 EXACT 가 아니면 CASE D — 이 게이트를 건드리지 않았다", () => {
    const REC = strip(
      readFileSync(
        join(LIB, "..", "..", "..", "..", "..", "..", "..", "packages", "pricing", "src", "price-recommendation.ts"),
        "utf8",
      ),
    );
    expect(
      REC,
      "🔴 EXACT 게이트가 사라졌다 — COMPARISON 가격이 CASE A/B/C 로 들어간다",
    ).toContain('input.domesticBasis !== "EXACT" || input.domesticLowestPriceKrw == null');
    expect(REC).toContain('marketCase: "D"');
  });

  it("D-2 🔴 집계 루프는 **EXACT|COMPARISON 만** 담는다 — 복원분도 같은 규칙이다", () => {
    const at = INTEL.indexOf("for (const e of aggregationEvidence)");
    const loop = INTEL.slice(at, INTEL.indexOf("const domesticMarketSplit", at));
    expect(loop).toContain('e.priceTier === "EXACT"');
    expect(loop).toContain('e.priceTier === "COMPARISON"');
    /** 🔴 REFERENCE/EXCLUDED 를 들여보내면 가격 축 정책이 바뀐다. */
    expect(loop, "🔴 REFERENCE 를 가격 버킷에 담았다").not.toContain('e.priceTier === "REFERENCE"');
  });

  it("D-3 🔴 국내 축 자격 두 조건이 그대로다 — market==='KR' 그리고 priceKrw", () => {
    const at = INTEL.indexOf("for (const e of aggregationEvidence)");
    const loop = INTEL.slice(at, INTEL.indexOf("const domesticMarketSplit", at));
    expect(loop).toContain('e.market !== "KR"');
    expect(loop).toContain("e.priceKrw == null");
  });
});
