import { describe, expect, it } from "vitest";
import { candidateLabel, candidateProvenanceNote } from "../DomesticPriceIntelligencePanel";
import { readSourceAt, stripComments } from "./source-text";

/**
 * MATCHING-FIX-01-A(CEO 조건, 2026-09-16) — **stale 판단을 되돌린 것을 잰다.**
 *
 * ── 왜 되돌렸나 ─────────────────────────────────────────────────────────────
 * 직전 커밋은 match_reasons 안에 «판정기 버전 문자열»을 적고, 화면이 그 값을 현재
 * 코드 상수와 비교해 "판정이 낡음"이라고 말했다. 컬럼은 만들지 않았지만 사실상
 * 판정 버전 필드였고, CEO 가 푸시 조건으로 못박은 "stale 은 updated_at 기반으로
 * 만"을 글자로만 피한 것이었다. 두 방식은 실제로 다른 답을 낸다 — 판정 로직을
 * 안 바꾼 배포에서 버전만 올리면 멀쩡한 행이 낡은 것이 되고, 판정을 바꿨는데
 * 버전을 안 올리면 낡은 행이 멀쩡한 것이 된다.
 *
 * ── 이 파일이 재는 것 ───────────────────────────────────────────────────────
 * ① 화면은 «마지막 판정 YYYY-MM-DD» 라는 **사실**까지만 말한다.
 * ② 화면도 서버도 «낡음»이라는 **판단**을 하지 않는다(판단은 사람이 한다).
 * ③ 그 판단을 되살릴 필드(judgmentStale · judgeVersion)가 응답에도 화면에도 없다.
 */

function candidate(overrides: Partial<Parameters<typeof candidateLabel>[0]> = {}) {
  return {
    id: "c1",
    matchType: "EXACT" as const,
    matchConfidence: 0.95,
    matchedTitle: "Bobo Choses T-shirt",
    matchedBrand: "Bobo Choses",
    matchReasons: [] as string[],
    matchTruth: "STRONG_IDENTIFIER" as const,
    verified: true,
    externalUrl: "https://example.com",
    ...overrides,
  };
}

describe("MATCHING-FIX-01-A ①: 화면은 «마지막 판정일»이라는 사실까지만 말한다", () => {
  it("판정 시각(updated_at)을 날짜로 적는다", () => {
    const note = candidateProvenanceNote(
      candidate({ updatedAt: "2026-09-10T04:05:06.000Z", verificationLabel: "엔진 자동 판정(품번 근거) · 사람 확인 없음" }),
    );
    expect(note).toContain("마지막 판정 2026-09-10");
  });

  it("같은 날짜가 후보 배지 문구에도 실려 나간다 — 셀러가 실제로 보는 자리다", () => {
    const label = candidateLabel(candidate({ updatedAt: "2026-09-10T04:05:06.000Z" }));
    expect(label.note).toContain("마지막 판정 2026-09-10");
  });

  it("판정 시각을 모르면 아무 말도 하지 않는다 — 없는 날짜를 지어내지 않는다", () => {
    const note = candidateProvenanceNote(candidate({ verificationLabel: "엔진 자동 판정(품번 근거) · 사람 확인 없음" }));
    expect(note).toBe("엔진 자동 판정(품번 근거) · 사람 확인 없음");
  });
});

describe("MATCHING-FIX-01-A ②: 시스템이 «낡음»을 판단하지 않는다", () => {
  it("아무리 오래된 판정이어도 «낡음»이라고 말하지 않는다", () => {
    // 2년 전에 판정된 행. 낡았는지는 이 화면이 아니라 사람이 판단한다.
    const label = candidateLabel(candidate({ updatedAt: "2024-01-01T00:00:00.000Z" }));
    expect(label.note).toContain("마지막 판정 2024-01-01");
    expect(label.note).not.toContain("낡");
    expect(label.note).not.toContain("판정기가 바뀜");
  });

  it("근거 줄이 없는 레거시 행도 «낡음»이 아니라 «사람 확인 여부 기록 없음»으로만 말한다", () => {
    const note = candidateProvenanceNote(
      candidate({
        matchTruth: null,
        matchReasons: ["상품명 유사도 92%"],
        verificationLabel: "엔진 자동 판정(품번 없이 여러 축 일치) · 사람 확인 여부 기록 없음",
        updatedAt: "2026-09-10T00:00:00.000Z",
      }),
    );
    expect(note).toContain("사람 확인 여부 기록 없음");
    expect(note).toContain("마지막 판정 2026-09-10");
    expect(note).not.toContain("낡");
  });
});

describe("MATCHING-FIX-01-A ③: stale 판단을 되살릴 필드가 응답에도 화면에도 없다", () => {
  const routeSource = stripComments(
    readSourceAt(new URL("../../../api/domestic-price-sources/links/route.ts", import.meta.url)),
  );
  const panelSource = stripComments(readSourceAt(new URL("../DomesticPriceIntelligencePanel.tsx", import.meta.url)));
  const provenanceSource = stripComments(
    readSourceAt(new URL("../../../api/domestic-price-sources/_lib/match-provenance.ts", import.meta.url)),
  );

  it("links 응답이 judgmentStale · judgeVersion 을 내보내지 않는다", () => {
    expect(routeSource).not.toContain("judgmentStale");
    expect(routeSource).not.toContain("judgeVersion");
    // 마지막 판정 시각은 그대로 나간다.
    expect(routeSource).toContain("updatedAt: l.updatedAt");
  });

  it("화면이 그 필드를 읽지 않는다", () => {
    expect(panelSource).not.toContain("judgmentStale");
    expect(panelSource).not.toContain("judgeVersion");
  });

  it("판정기 버전 상수와 그 비교가 남아 있지 않다", () => {
    expect(provenanceSource).not.toContain("MATCH_JUDGE_VERSION");
    expect(provenanceSource).not.toContain("stale");
  });
});
