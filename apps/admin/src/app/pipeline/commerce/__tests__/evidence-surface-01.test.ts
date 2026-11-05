/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  GeminiTransientCandidates,
  EVIDENCE_SUMMARY_LABEL,
  EVIDENCE_AGREE_LABEL,
  EVIDENCE_HOLD_LABEL,
  EVIDENCE_SOURCE_LABEL,
  type GeminiTransientRow,
} from "../GeminiTransientCandidates";
import { EVIDENCE_NONE_TEXT, splitEvidenceReasons } from "../blocker-text";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 EVIDENCE-SURFACE-01 — **셀러가 「왜 같은 상품인가」를 읽을 수 있다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **고친 것** — 카드는 **차단 사유만** 보여주고(`blockerText`) **일치 근거는
 *    `diagnostic` 구역에만** 있었다. 셀러는 「왜 아닌가」만 읽고 「왜 같은가」는
 *    읽을 수 없었다 ⟹ 소싱 판단의 절반이 화면에 없었다.
 *
 * 🟢 CPO 승인(2026-11-05) 경계를 그대로 구현한다:
 * ```
 * 후보 «카드»   판정 · 가격 · 판매처 · 핵심 상태        ← 🟢 간결함 유지(`-03` 정책)
 * 후보 «상세»   일치 근거 · 불일치 근거 · 관측값 · 출처 · 미확인  ← 🔵 이 영역
 * ```
 * 🔴 새 모듈/중복 화면 **0** · 기존 어휘 owner(`blocker-text.ts`) 재사용 · 기본 접힘.
 *
 * 🔴🔴 **축이 둘이다** — 순수 split(아래 A) «그리고» **마운트 DOM**(아래 R).
 *    메모 `render-pass-is-not-source-pass` 가 그 이유다(소스만 보면 배선을 못 본다).
 */

const SRC = readFileSync(join(__dirname, "..", "GeminiTransientCandidates.tsx"), "utf8");
/** 🔴 금지 검사는 **코드** 에만 — 주석이 금지를 설명한다(이 저장소가 아홉 번 걸린 함정). */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

/** 🟢 **운영 DB 실측 문자열** 이다 — 손으로 예쁘게 지어내지 않았다(2026-11-05 전수). */
const REAL_REASONS = [
  "판정방법: CROSS_SELLER_AXES — 품번을 비교할 수 없어 교차판매처 축과 텍스트 등급으로 판단",
  "근거: 대상 KIDS",
  "근거: 상품군 TOP↔TOP",
  "근거: 색상 BLUE",
  "모델명 유사도 0%",
  "보류: 연령 라인 CHILD ↔ BABY",
  "브랜드 불일치",
  "판정근거: 입력 텍스트등급=low · 품번증거=unavailable (해외 B226AC073 ↔ 국내 없음) · 교차판매처=PRESUMED_SAME → TEXT_CONFIRMED(순위 3)",
];

const row = (over: Partial<GeminiTransientRow>): GeminiTransientRow =>
  ({
    domain: "donokids.com",
    title: "허그 헤어리 몬스터 티셔츠",
    discoveredUrl: `https://donokids.com/${over.domain ?? "d"}-${JSON.stringify(over).length}`,
    market: "KR",
    soldOut: false,
    priceStatus: "VERIFIED_CURRENT",
    source: "DOMESTIC_LISTING",
    ...over,
  }) as GeminiTransientRow;

const mount = (rows: GeminiTransientRow[]): HTMLElement => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  act(() => {
    createRoot(host).render(createElement(GeminiTransientCandidates, { evidence: rows as never }));
  });
  return host;
};

describe("EVIDENCE-SURFACE-01", () => {
  /* ── A. 🔴 어휘 owner 가 근거를 «가른다» ───────────────────────────────── */

  it("A-1 🟢 `근거:` 는 일치 · `보류:` 는 불일치로 간다", () => {
    const s = splitEvidenceReasons(REAL_REASONS);
    expect(s.agree).toEqual(["대상 KIDS", "상품군 TOP↔TOP", "색상 BLUE"]);
    expect(s.hold).toEqual(["연령 라인 CHILD ↔ BABY"]);
  });

  it("A-2 🔴🔴 **내부 진단 줄은 내보내지 않는다** — 그 넷이 셀러 화면에 가면 안 된다", () => {
    const s = splitEvidenceReasons(REAL_REASONS);
    const all = [...s.agree, ...s.hold].join(" | ");
    for (const banned of [
      "CROSS_SELLER_AXES",
      "판정방법",
      "판정근거",
      /** 🔴 WU-094 가 **자기모순** 을 실측한 줄이다 — 셀러 근거로 쓸 수 없다. */
      "모델명 유사도",
      "텍스트등급",
      "TEXT_CONFIRMED",
    ]) {
      expect(all, `🔴 내부 진단이 셀러 근거로 새어 나갔다: ${banned}`).not.toContain(banned);
    }
  });

  it("A-3 🔴 빈 입력·null 을 터뜨리지 않고 **빈 둘** 을 돌려준다", () => {
    for (const input of [null, undefined, [], ["아무 접두어 없는 줄"]]) {
      const s = splitEvidenceReasons(input as never);
      expect(s.agree).toEqual([]);
      expect(s.hold).toEqual([]);
    }
  });

  /* ── R. 🔴🔴 마운트 DOM — 화면이 실제로 그린다 ─────────────────────────── */

  it("R-1 🟢 상세 영역이 **존재하고 접혀 있다**", () => {
    const host = mount([row({ matchReasons: REAL_REASONS })]);
    const d = host.querySelector('[data-testid="gt-evidence"]') as HTMLDetailsElement | null;
    expect(d, "🔴 Evidence 상세 영역이 렌더되지 않았다").toBeTruthy();
    /** 🔴 펼쳐 두면 후보가 「유력」으로 읽힌다(2026-09-19 사고 기전 · WU-091). */
    expect(d!.open, "🔴 기본 접힘이 아니다").toBe(false);
    expect(d!.textContent).toContain(EVIDENCE_SUMMARY_LABEL);
  });

  it("R-2 🟢🟢 **일치 근거가 화면에 있다** — 이것이 이 WU 의 목적이다", () => {
    const host = mount([row({ matchReasons: REAL_REASONS })]);
    const el = host.querySelector('[data-testid="gt-evidence-agree"]');
    expect(el, "🔴 일치 근거 줄이 없다").toBeTruthy();
    const t = el!.textContent ?? "";
    expect(t).toContain(EVIDENCE_AGREE_LABEL);
    /** 🔴 **글자를 직접** 단언한다 — 상수만 보면 상수를 바꿔도 통과한다(WU-145 ⒜). */
    expect(t).toContain("대상 KIDS");
    expect(t).toContain("상품군 TOP↔TOP");
    expect(t).toContain("색상 BLUE");
  });

  it("R-3 🟢 불일치 근거 = `보류:` 줄 **그리고** blocker 전수", () => {
    const host = mount([
      row({ matchReasons: REAL_REASONS, crossSellerBlockers: ["BRAND_UNCONFIRMED", "MODEL_CODE"] }),
    ]);
    const t = host.querySelector('[data-testid="gt-evidence-hold"]')!.textContent ?? "";
    expect(t).toContain(EVIDENCE_HOLD_LABEL);
    expect(t).toContain("연령 라인 CHILD ↔ BABY");
    /** 🟢 blocker 는 owner 가 번역한 말로 — 원시 토큰이 아니다. */
    expect(t).toContain("브랜드 미확인");
    expect(t).toContain("품번 충돌");
    expect(t, "🔴 영문 내부 토큰이 노출됐다").not.toContain("BRAND_UNCONFIRMED");
    expect(t, "🔴 영문 내부 토큰이 노출됐다").not.toContain("MODEL_CODE");
  });

  it("R-4 🔴🔴 **카드 상한 2 를 상세가 넘는다** — 「2개만 보여서 나머지를 못 봤다」를 없앤다", () => {
    const host = mount([
      row({
        matchReasons: [],
        crossSellerBlockers: ["BRAND_MISMATCH", "COLOR", "MATERIAL", "SIZE_SYSTEM"],
      }),
    ]);
    /** 🟢 카드는 **간결함 유지** — 2개까지만. */
    const card = host.querySelector('[data-testid="gt-blockers"]')!.textContent ?? "";
    expect(card).toContain("브랜드 불일치");
    expect(card).toContain("색상 충돌");
    expect(card, "🔴 카드가 3번째 사유까지 적었다 — 간결함 정책 위반").not.toContain("소재 차이");
    /** 🟢 상세는 전수 — 네 축이 전부 있다. */
    const detail = host.querySelector('[data-testid="gt-evidence-hold"]')!.textContent ?? "";
    for (const must of ["브랜드 불일치", "색상 충돌", "소재 차이", "사이즈 체계 차이"]) {
      expect(detail, `🔴 상세에 ${must} 가 없다`).toContain(must);
    }
  });

  it("R-5 🔴🔴 근거가 **없으면 「없다」고 적는다** — 빈 칸으로 두지 않는다", () => {
    const host = mount([row({ matchReasons: [], crossSellerBlockers: [], crossSellerConflicts: [] })]);
    const agree = host.querySelector('[data-testid="gt-evidence-agree"]')!.textContent ?? "";
    const hold = host.querySelector('[data-testid="gt-evidence-hold"]')!.textContent ?? "";
    expect(agree).toContain(EVIDENCE_NONE_TEXT);
    expect(hold).toContain(EVIDENCE_NONE_TEXT);
    /** 🔴 영역 자체가 **사라지지 않는다** — 「확인했는데 없다」와 「안 봤다」는 다른 화면이다. */
    expect(host.querySelector('[data-testid="gt-evidence"]')).toBeTruthy();
  });

  it("R-6 🟢 출처가 상세에 적힌다(CPO §3)", () => {
    const host = mount([row({ matchReasons: REAL_REASONS })]);
    const t = host.querySelector('[data-testid="gt-evidence-source"]')!.textContent ?? "";
    expect(t).toContain(EVIDENCE_SOURCE_LABEL);
    /** 🔴 내부 enum(`DOMESTIC_LISTING`)이 아니라 **셀러의 말** 이다. */
    expect(t, "🔴 내부 출처 enum 이 노출됐다").not.toContain("DOMESTIC_LISTING");
  });

  /* ── G. 🔴 기존 경계를 깨지 않았다 ─────────────────────────────────────── */

  it("G-1 🔴🔴 `matchReasons` 를 **카드에** 그대로 찍지 않는다(`-03` 정책 유지)", () => {
    const host = mount([row({ matchReasons: REAL_REASONS })]);
    /** 🟢 진단 줄(`gt-reasons`)은 `diagnostic` 구역 전용이라 여기선 없다. */
    expect(
      host.querySelector('[data-testid="gt-reasons"]'),
      "🔴 셀러 카드에 진단 로그가 다시 나왔다",
    ).toBeNull();
  });

  it("G-2 🔴 어휘 owner 는 하나다 — 컴포넌트가 blocker 표를 복제하지 않는다", () => {
    /** 🔴 축 토큰 → 한국어 표를 이 파일에 또 만들면 두 화면이 다른 말을 한다. */
    for (const token of ["BRAND_UNCONFIRMED", "NO_TITLE_OVERLAP", "COLOR_VARIANT"]) {
      expect(CODE, `🔴 컴포넌트가 ${token} 라벨을 자체 보유한다`).not.toContain(token);
    }
    expect(CODE, "🔴 owner 를 쓰지 않는다").toContain("splitEvidenceReasons(row.matchReasons)");
  });

  it("G-3 🔴 상세 영역에 `open` 을 붙이지 않았다", () => {
    const at = CODE.indexOf('data-testid="gt-evidence"');
    expect(at).toBeGreaterThan(0);
    const tag = CODE.slice(CODE.lastIndexOf("<details", at), CODE.indexOf(">", at) + 1);
    expect(tag, "🔴 기본 펼침이 들어갔다").not.toContain("open");
  });
});
