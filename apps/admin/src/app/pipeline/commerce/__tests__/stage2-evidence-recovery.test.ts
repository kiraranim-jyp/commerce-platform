import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CANDIDATE_EVIDENCE_PREFIX,
  CANDIDATE_WARNING_PREFIX,
  candidateEvidenceLines,
  candidateWarningLines,
} from "../mi-same-candidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 STAGE 2 — **Evidence / Human Judgment 복구**(CPO 승인 D1·D3)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **새 정책이 아니다 — 복구다.** 운영은 긍정 근거를 **이미 계산해 저장하고** 있었는데
 *    화면이 **보류만** 그렸고, 사람 판정은 **맨몸 행** 으로 저장돼 재진입에서 맥락을 잃었다.
 * 🔴 판정·threshold·scoring·blocker 정의 **변경 0**.
 */

const HERE = join(__dirname, "..");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const CARD = strip(readFileSync(join(HERE, "MarketPriceComparison.tsx"), "utf8"));
const LEAF = strip(readFileSync(join(HERE, "mi-same-candidates.ts"), "utf8"));

/** 🟢 운영이 실제로 적는 모양 그대로(SPRINT 5 에서 DB 로 읽은 원문). */
const ROW = {
  domain: "kidbizkid.com",
  discoveredUrl: "https://kidbizkid.com/p/1",
  matchReasons: [
    "모델명 유사도 17%",
    "근거: 상품군 TOP↔TOP",
    "근거: 색상 BLUE",
    "근거: 대상 KIDS",
    "보류: 브랜드 Bobo Choses ↔ Hugo Boss",
    "판정방법: CROSS_SELLER_AXES — 품번을 비교할 수 없어 교차판매처 축과 텍스트 등급으로 판단",
    "판정근거: 입력 텍스트등급=low · 교차판매처=PRESUMED_SAME → TEXT_CONFIRMED(순위 3)",
  ],
  crossSellerBlockers: ["BRAND_MISMATCH"],
} as never;

describe("STAGE2 — D1 긍정 근거 복구", () => {
  it("D1-1 🟢 「근거:」 줄이 화면 문장으로 나온다", () => {
    const lines = candidateEvidenceLines(ROW);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("상품군 TOP↔TOP");
    expect(lines[0]).toContain("색상 BLUE");
    expect(lines[0]).toContain("대상 KIDS");
    expect(lines[0]!.startsWith(CANDIDATE_EVIDENCE_PREFIX)).toBe(true);
  });

  /** 🔴 CPO 가 **명시적으로 금지** 한 것들 — 이 영역에 들이면 카드가 판정처럼 읽힌다. */
  it("D1-2 🔴 내부 판정 문구·점수·threshold 가 들어가지 않는다", () => {
    const joined = candidateEvidenceLines(ROW).join(" ");
    for (const banned of ["판정방법", "판정근거", "CROSS_SELLER_AXES", "TEXT_CONFIRMED", "PRESUMED_SAME", "유사도"]) {
      expect(joined, `🔴 내부 어휘가 샜다: ${banned}`).not.toContain(banned);
    }
  });

  it("D1-3 🔴 보류(⚠)와 **다른 줄** 이다 — 섞으면 카드가 스스로 모순된다", () => {
    const ev = candidateEvidenceLines(ROW).join(" ");
    const warn = candidateWarningLines(ROW).join(" ");
    expect(ev).not.toContain(CANDIDATE_WARNING_PREFIX);
    expect(warn).toContain("브랜드");
    expect(warn).not.toContain(CANDIDATE_EVIDENCE_PREFIX);
  });

  it("D1-4 🔴 근거가 없으면 **만들지 않는다**(「모두 일치」 금지)", () => {
    expect(candidateEvidenceLines({ matchReasons: ["판정방법: X"] } as never)).toEqual([]);
    expect(candidateEvidenceLines({} as never)).toEqual([]);
  });

  it("D1-5 🔴 카드가 그 줄을 **실제로 그린다**(배선)", () => {
    expect(CARD).toContain("candidateEvidenceLines(row).map");
    expect(CARD).toContain('data-testid="mi-candidate-evidence-line"');
    /** 🔴 기존 ⚠ 줄을 **지우지 않았다**. */
    expect(CARD).toContain('data-testid="mi-candidate-warning"');
  });

  it("D1-6 🔴 재판정하지 않는다 — leaf 에 판정/점수 어휘가 없다", () => {
    const at = LEAF.indexOf("export function candidateEvidenceLines");
    const body = LEAF.slice(at, LEAF.indexOf("\n}", at));
    for (const banned of ["SAME_MIN_AXES", "totalPoints", "compareCrossSeller", "verdict", "threshold"]) {
      expect(body, `🔴 근거 추출기가 판정을 한다: ${banned}`).not.toContain(banned);
    }
  });
});

describe("STAGE2 — D3 사람 판정 맥락 보존", () => {
  it("D3-1 🔴 선택 UI 가 후보 **식별 맥락** 을 보낸다", () => {
    const at = CARD.indexOf("function reviewContextOf");
    expect(at, "🔴 맥락 함수가 없다 — 맨몸 행이 다시 생긴다").toBeGreaterThan(0);
    const body = CARD.slice(at, CARD.indexOf("\n}", at));
    for (const k of ["domain", "title", "market"]) expect(body).toContain(`${k}:`);
  });

  /** 🔴🔴 판정 어휘는 **보내지 않는다** — `D-4` · `wu-136 E-2` 가 그 경계를 지킨다. */
  it("D3-2 🔴 선택 UI 가 판정/가격등급 어휘를 보내지 않는다", () => {
    const at = CARD.indexOf("function reviewContextOf");
    const body = CARD.slice(at, CARD.indexOf("\n}", at));
    for (const banned of ["priceTier", "matchTruth", "crossSellerBlockers", "crossSellerVerdict", "matchReasons"]) {
      expect(body, `🔴 판정 어휘가 선택 경로로 샌다: ${banned}`).not.toContain(banned);
    }
  });

  it("D3-3 🔴 writer 는 **INSERT 에서만** 맥락을 심는다(기존 행을 덮지 않는다)", () => {
    const W = strip(readFileSync(join(HERE, "..", "..", "api", "price-history", "_lib", "candidate-review.ts"), "utf8"));
    const at = W.indexOf("export async function saveHumanVerdict");
    const body = W.slice(at, at + 2600);
    /** 🟢 insert 블록에만 있다. */
    expect(body).toContain("candidateContextColumns(input.candidate)");
    /** 🔴 update 는 여전히 `verdictFields` 뿐이다 — WU-131 양방향 계약. */
    const upd = body.slice(body.indexOf(".update("), body.indexOf(".update(") + 120);
    expect(upd).toContain("verdictFields");
    expect(upd).not.toContain("candidateContextColumns");
  });

  it("D3-4 🔴 `source` 를 위장하지 않는다(migration 0 · D4 는 CPO 사안)", () => {
    const W = strip(readFileSync(join(HERE, "..", "..", "api", "price-history", "_lib", "candidate-review.ts"), "utf8"));
    for (const banned of ["WEB_SEARCH", "DOMESTIC_LISTING", "REVIEWED_SAME"]) {
      expect(W, `🔴 금지된 source 값이 writer 에 들어왔다: ${banned}`).not.toContain(`"${banned}"`);
    }
  });
});

describe("STAGE2 — D2 사유 저장 경로는 살아 있다(UI 만 보류)", () => {
  it("D2-1 🟢 hook·POST·복원 경로가 `humanNote` 를 다룬다", () => {
    const H = strip(readFileSync(join(HERE, "use-candidate-review.ts"), "utf8"));
    expect(H).toContain("humanNote: extra?.humanNote");
    expect(H).toContain("r.humanNote");
    expect(H).toContain("note,");
  });

  /**
   * 🔴🔴 **이 영역에는 입력칸을 두지 않는다** — `core-2s-seller-screen D-3` 이
   *    「결론 영역에 입력칸·요청이 없다」로 막았고 그 계약이 맞다(1차 구현이 FAIL 했다).
   */
  it("D2-2 🔴 결론 카드에 입력칸을 만들지 않는다", () => {
    expect(CARD, "🔴 셀러에게 글쓰기를 요구하는 입력칸이 생겼다").not.toMatch(/<input\b/);
  });
});
