import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CANDIDATE_EVIDENCE_PREFIX,
  CANDIDATE_WARNING_PREFIX,
  HUMAN_NOTE_OPTIONS,
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

  /**
   * 🔵🔵 **migration 082 가 이 계약의 «전제» 를 바꿨다**(2026-11-06 · CPO 승인 안 ⓒ).
   *
   * 🔴 전까지 이 테스트는 「`WEB_SEARCH`·`DOMESTIC_LISTING` 을 **쓰지 말라**」였다 —
   *    079 의 `source` CHECK 가 그 둘을 담지 못했고, 기존 값으로 적으면 그 후보의
   *    **원래 출처가 영구히 거짓** 이 되기 때문이다.
   * 🟢 082 가 그 둘을 **승인했다** ⟹ 계약은 금지에서 **「자기 이름으로만 적어라」** 가 된다.
   *
   * 🔴 느슨해지지 않게 **두 축으로** 잠근다:
   *    ⒜ 승인 집합을 **SQL CHECK 에서 읽어** TS 와 **양방향** 대조한다 — 한쪽만 늘거나
   *       줄면 FAIL 이다(TS 가 앞서면 저장이 23514 로 터지고, SQL 이 앞서면 승인된
   *       출처가 조용히 버려진다).
   *       🔴 기대값을 구현 상수에서 import 하지 않는다 — 그러면 **동어반복** 이다.
   *    ⒝ **승인되지 않은 생산자**(`REVIEWED_SAME`)는 **여전히 금지** 다 — 082 는 둘만 더했다.
   */
  it("D3-4 🔴 `source` 어휘가 **승인 집합과 정확히 같다**(082 · 위장·무단 추가 금지)", () => {
    const W = strip(readFileSync(join(HERE, "..", "..", "api", "price-history", "_lib", "candidate-review.ts"), "utf8"));
    /** 🔴 리포 루트까지 **7단계** 다 — __tests__ · commerce · pipeline · app · src · admin · apps. */
    const sql = readFileSync(
      join(
        __dirname,
        "..", "..", "..", "..", "..", "..", "..",
        "packages", "database", "prisma", "migrations_manual",
        "082_candidate_reviews_domestic_sources.sql",
      ),
      "utf8",
    );

    /** 🟢 DB 가 **실제로 허용** 하는 집합 — ADD CONSTRAINT 블록에서만 읽는다(DROP 쪽이 아니다). */
    const addAt = sql.indexOf("ADD CONSTRAINT candidate_reviews_source_check");
    expect(addAt, "🔴 082 에서 ADD CONSTRAINT 를 찾지 못했다").toBeGreaterThan(0);
    const approved = [
      ...new Set(
        (sql.slice(addAt, sql.indexOf("COMMIT;", addAt)).match(/'([A-Z_]+)'::text/g) ?? []).map((m) =>
          m.replace(/'|::text/g, ""),
        ),
      ),
    ].sort();

    /** 🟢 TS writer 가 **선언** 하는 집합. */
    const unionAt = W.indexOf("export type ReviewSource");
    expect(unionAt, "🔴 ReviewSource 선언을 찾지 못했다").toBeGreaterThan(0);
    const declared = [
      ...new Set(
        (W.slice(unionAt, W.indexOf(";", unionAt)).match(/"([A-Z_]+)"/g) ?? []).map((m) => m.replace(/"/g, "")),
      ),
    ].sort();

    expect(approved.length, "🔴 082 의 승인 집합을 읽지 못했다").toBe(7);
    expect(declared, "🔴 TS `ReviewSource` 와 DB CHECK 가 갈라졌다").toEqual(approved);
    /** 🔴 승인된 둘이 실제로 그 집합에 있다 — 082 가 되돌려지면 여기서 잡힌다. */
    for (const added of ["WEB_SEARCH", "DOMESTIC_LISTING"]) {
      expect(approved, `🔴 082 가 승인한 출처가 사라졌다: ${added}`).toContain(added);
    }
    /** 🔴 그리고 승인되지 않은 것은 **어느 쪽에도** 없다. */
    for (const banned of ["REVIEWED_SAME"]) {
      expect(approved, `🔴 승인되지 않은 source 가 DB 에 들어왔다: ${banned}`).not.toContain(banned);
      expect(declared, `🔴 승인되지 않은 source 가 writer 에 들어왔다: ${banned}`).not.toContain(banned);
    }
  });
});

describe("STAGE2-R — D2 「내 판단」은 글쓰기가 아니라 선택이다", () => {
  it("D2-1 🟢 hook·POST·복원 경로가 `humanNote` 를 다룬다", () => {
    const H = strip(readFileSync(join(HERE, "use-candidate-review.ts"), "utf8"));
    expect(H).toContain("humanNote: extra?.humanNote");
    expect(H).toContain("r.humanNote");
    expect(H).toContain("note,");
  });

  /**
   * 🔴🔴 **자유 입력칸을 만들지 않는다** — `core-2s-seller-screen D-3`(「결론 영역에
   *    입력칸·요청이 없다」)이 1차 구현을 FAIL 로 잡았고 그 계약이 맞다.
   *    CPO: 「셀러에게 다시 조사·분석·장문의 글쓰기를 요구하는 UX 가 되어서는 안 된다.」
   */
  it("D2-2 🔴 이 화면에 입력칸이 **하나도 없다**", () => {
    expect(CARD, "🔴 셀러에게 글쓰기를 요구하는 입력칸이 생겼다").not.toMatch(/<input\b/);
    expect(CARD).not.toMatch(/<textarea\b/);
  });

  it("D2-3 🔴 「내 판단」은 **근거 확인 접힘 «안»** 에 있다(결론 영역 아님)", () => {
    const at = CARD.indexOf('data-testid="mi-candidate-evidence"');
    const end = CARD.indexOf("</details>", at);
    expect(at, "🔴 근거 접힘을 찾지 못했다").toBeGreaterThan(0);
    expect(CARD.slice(at, end), "🔴 내 판단이 근거 접힘 밖에 있다").toContain("<CandidateNoteChoices");
  });

  it("D2-4 🟢 사유는 **고정 선택지** 이고 내부 판정 토큰이 아니다", () => {
    expect(HUMAN_NOTE_OPTIONS).toContain("브랜드가 다름");
    expect(HUMAN_NOTE_OPTIONS).toContain("품번/모델코드가 다름");
    expect(HUMAN_NOTE_OPTIONS).toContain("기타");
    for (const banned of ["BRAND_MISMATCH", "MODEL_CODE", "NO_TITLE_OVERLAP", "PRESUMED_SAME"]) {
      expect(HUMAN_NOTE_OPTIONS.join(" "), `🔴 내부 토큰이 사람 어휘에 섞였다: ${banned}`).not.toContain(banned);
    }
  });

  /** 🔴 판정 없이 사유만 저장하면 `humanVerdict` 를 **지어내야** 한다 — 금지다. */
  it("D2-5 🔴 판정을 고르기 전에는 사유 선택이 서지 않는다", () => {
    /**
     * 🔴 **좌표를 함수 끝으로 잡지 않는다** — 1차에 `indexOf("\n}")` 로 잘랐더니
     *    **매개변수 블록의 `}`**(`}: {`)에서 끊겨 본문을 보지 못했다(내 단언이 FAIL 로 잡았다).
     * 🟢 다음 함수 선언까지로 자른다.
     */
    const at = CARD.indexOf("function CandidateNoteChoices");
    const body = CARD.slice(at, CARD.indexOf("function reviewContextOf", at));
    expect(body).toContain("if (!chosen) return null;");
    /** 🔴 같은 verdict 를 그대로 다시 보낸다 — 판정을 **바꾸지 않는다**. */
    expect(body).toContain("api.onReview(row.discoveredUrl, chosen,");
  });

  it("D2-6 🔴 사유 선택이 시스템 판정·threshold 를 건드리지 않는다", () => {
    /**
     * 🔴 **좌표를 함수 끝으로 잡지 않는다** — 1차에 `indexOf("\n}")` 로 잘랐더니
     *    **매개변수 블록의 `}`**(`}: {`)에서 끊겨 본문을 보지 못했다(내 단언이 FAIL 로 잡았다).
     * 🟢 다음 함수 선언까지로 자른다.
     */
    const at = CARD.indexOf("function CandidateNoteChoices");
    const body = CARD.slice(at, CARD.indexOf("function reviewContextOf", at));
    for (const banned of ["matchTruth", "priceTier", "crossSellerVerdict", "threshold", "SAME_MIN_AXES"]) {
      expect(body, `🔴 사유 UI 가 판정을 건드린다: ${banned}`).not.toContain(banned);
    }
  });
});
