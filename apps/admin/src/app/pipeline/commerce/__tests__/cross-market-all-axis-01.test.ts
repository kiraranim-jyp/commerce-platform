import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { GeminiTransientRow } from "../GeminiTransientCandidates";
import {
  CANDIDATE_LIST_EMPTY,
  CANDIDATE_LIST_HEADING,
  rowInScope,
  selectCandidateList,
} from "../mi-same-candidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-P0-CROSS-MARKET-COMPLETION-01 D — **「전체」 축**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **고친 문제** — 후보 리스트가 시장을 **둘**(`KR` · `OVERSEAS`)로만 갈랐다.
 *    그런데 후보의 시장은 **셋** 이다 — `classifyCandidateMarket` 은 증거가 일치할
 *    때만 KR/OVERSEAS 를 단정하고 그 밖은 **`UNKNOWN`** 으로 둔다(통화 단독 결정 금지).
 *    ⟹ **시장을 확정하지 못한 후보는 두 리스트 «어디에도» 서지 않았다.**
 *    실측 선례(WU-140 ④) — `beaumonde.co.kr` 은 human SAME 인 `.kr` 인데 **가격이
 *    없어 market UNKNOWN** 이라 🇰🇷 칸이 「후보를 찾지 못했습니다」라고 **거짓** 을 말했다.
 *
 * 🔴 **정책 변경 0** — 등급(`transientDisplayTier`) · 제외 규칙 · SAME 기준 ·
 *    가격 적격성 · 환산 · 금액 집계 **전부 그대로** 다. 넓힌 것은 **표시 범위** 뿐이다.
 * 🔴 **가격을 만들지 않는다** — 「전체」에 금액을 붙이면 통화가 섞인다(환산 금지).
 * 🔴 **승격 0** — `UNKNOWN` 을 국내/해외로 바꿔 적지 않는다.
 */

const r = (over: Partial<GeminiTransientRow>): GeminiTransientRow =>
  ({
    domain: "x.com",
    title: "Hug Hairy Monster T-shirt",
    discoveredUrl: `https://x.com/${Math.abs(JSON.stringify(over).length)}-${over.domain ?? "d"}`,
    market: "OVERSEAS",
    soldOut: false,
    priceStatus: "VERIFIED_CURRENT",
    ...over,
  }) as GeminiTransientRow;

/** 🟢 리스트에 서는 모양 하나 — `EXACT_IDENTIFIER` 는 `LIKELY` 군이다(기존 계약과 같다). */
const same = (over: Partial<GeminiTransientRow>) => r({ matchTruth: "EXACT_IDENTIFIER", ...over });

const domains = (rows: GeminiTransientRow[], scope: "ALL" | "KR" | "OVERSEAS") =>
  selectCandidateList(rows, scope).map((x) => x.row.domain);

const SRC = readFileSync(join(__dirname, "..", "MarketPriceComparison.tsx"), "utf8");
/** 🔴 소스 문자열 검사는 **주석을 벗기고** 한다(헌장 §5 · 여덟 번 걸린 함정). */
const BARE = SRC.replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/[^\n]*$/gm, " ");

describe("CROSS-MARKET-ALL-01 — 「전체」 축", () => {
  /* ── A. 범위 술어 ──────────────────────────────────────────────────────── */

  it("A-1 🟢 `rowInScope` — ALL 은 걸러내지 않고 KR/OVERSEAS 는 정확히 그 시장만", () => {
    const kr = r({ market: "KR" });
    const os = r({ market: "OVERSEAS" });
    const unknown = r({ market: "UNKNOWN" as GeminiTransientRow["market"] });
    for (const row of [kr, os, unknown]) expect(rowInScope(row, "ALL"), "🔴 ALL 은 전부 포함").toBe(true);
    expect(rowInScope(kr, "KR")).toBe(true);
    expect(rowInScope(os, "KR"), "🔴 해외가 국내 칸에 서면 화면이 거짓말한다").toBe(false);
    expect(rowInScope(unknown, "KR"), "🔴🔴 UNKNOWN 을 국내로 승격하지 않는다").toBe(false);
    expect(rowInScope(unknown, "OVERSEAS"), "🔴🔴 UNKNOWN 을 해외로 승격하지 않는다").toBe(false);
  });

  /* ── B. 🔴🔴 고친 결함 — 시장 미확정 후보가 «보인다» ────────────────────── */

  it("B-1 🔴🔴 시장 미확정 후보가 전에는 «어디에도» 없었고 이제 전체에만 선다", () => {
    const rows = [
      same({ domain: "kr.example.kr", market: "KR" }),
      same({ domain: "os.example.com", market: "OVERSEAS" }),
      /** 🟢 WU-140 ④ 의 그 모양 — human SAME 인데 가격이 없어 시장이 확정되지 않았다. */
      same({
        domain: "beaumonde.co.kr",
        market: "UNKNOWN" as GeminiTransientRow["market"],
        priceAmount: undefined,
        priceStatus: undefined,
      }),
    ];
    /** 🔴 전에는 이 후보가 두 리스트 어디에도 없었다 — 그 사실을 그대로 고정한다. */
    expect(domains(rows, "KR"), "🟢 국내 칸은 불변").toEqual(["kr.example.kr"]);
    expect(domains(rows, "OVERSEAS"), "🟢 해외 칸도 불변").toEqual(["os.example.com"]);
    /** 🟢🟢 전체에는 선다 — 그것이 이 축의 목적이다. */
    expect(domains(rows, "ALL"), "🟢 전체는 상위 집합이다").toEqual([
      "kr.example.kr",
      "os.example.com",
      "beaumonde.co.kr",
    ]);
    /** 🔴 화면이 세는 그 숫자 — 전체 − 국내 − 해외 = 시장 미확정. */
    const unresolved = domains(rows, "ALL").length - domains(rows, "KR").length - domains(rows, "OVERSEAS").length;
    expect(unresolved, "🔴 시장 미확정 1곳").toBe(1);
  });

  it("B-2 🔴 「전체 = 국내 + 해외」가 «아니다» — 합으로 만들면 그 후보가 사라진다", () => {
    const rows = [
      same({ domain: "a.kr", market: "KR" }),
      same({ domain: "b.com", market: "OVERSEAS" }),
      same({ domain: "c.io", market: "UNKNOWN" as GeminiTransientRow["market"] }),
      same({ domain: "d.io", market: "UNKNOWN" as GeminiTransientRow["market"] }),
    ];
    expect(domains(rows, "ALL").length, "🔴 전체 4").toBe(4);
    expect(domains(rows, "KR").length + domains(rows, "OVERSEAS").length, "🔴 합은 2뿐이다").toBe(2);
  });

  /* ── C. 🔴 정책 불변 — 범위만 넓혔다 ───────────────────────────────────── */

  it("C-1 🔴 전체 축이 «제외 규칙» 을 완화하지 않는다 — CONFLICT·Evidence 없는 UNKNOWN 은 그대로 제외", () => {
    const rows = [
      same({ domain: "ok.com", market: "UNKNOWN" as GeminiTransientRow["market"] }),
      /** 🔴 `CONFLICT` 는 전체에서도 서지 않는다(품번만 충돌한 참고 후보가 아니면). */
      r({ domain: "conflict.com", market: "UNKNOWN" as GeminiTransientRow["market"], matchTruth: "CONFLICT" }),
      /** 🔴 등급을 못 낸 행(판정·근거 없음)도 그대로 제외된다. */
      r({ domain: "nothing.com", market: "UNKNOWN" as GeminiTransientRow["market"], title: null }),
    ];
    const got = domains(rows, "ALL");
    expect(got, "🔴 전체는 «필터 해제» 가 아니라 «시장 범위» 다").toEqual(["ok.com"]);
  });

  it("C-2 🟢 기존 두 칸의 산출이 «한 글자도» 바뀌지 않는다(UNKNOWN 이 섞여도)", () => {
    const base = [same({ domain: "a.kr", market: "KR" }), same({ domain: "b.com", market: "OVERSEAS" })];
    const withUnknown = [...base, same({ domain: "c.io", market: "UNKNOWN" as GeminiTransientRow["market"] })];
    expect(domains(withUnknown, "KR")).toEqual(domains(base, "KR"));
    expect(domains(withUnknown, "OVERSEAS")).toEqual(domains(base, "OVERSEAS"));
  });

  it("C-3 🔴 말(헤딩·빈 문장)의 기존 두 글자가 그대로다", () => {
    expect(CANDIDATE_LIST_HEADING.KR, "🔴 계약이 이 글자를 본다").toBe("국내 소싱 후보");
    expect(CANDIDATE_LIST_HEADING.OVERSEAS).toBe("해외 소싱 후보");
    expect(CANDIDATE_LIST_EMPTY.KR).toBe("국내 소싱 후보가 없습니다");
    expect(CANDIDATE_LIST_EMPTY.OVERSEAS).toBe("해외 소싱 후보가 없습니다");
    /** 🟢 새 글자는 전체 축의 둘뿐이다. */
    expect(CANDIDATE_LIST_HEADING.ALL).toBe("전체 소싱 후보");
    expect(CANDIDATE_LIST_EMPTY.ALL).toBe("소싱 후보가 없습니다");
  });

  /* ── D. 🔴 화면 배선 — 그 축이 실제로 그려지는가 ────────────────────────── */

  it("D-1 🟢 화면이 «같은 선택기» 로 전체를 뽑고 차이를 센다(복제 계산 0)", () => {
    expect(BARE, "🔴 전체 리스트를 같은 선택기로 뽑는다").toContain('selectCandidateList(rows, "ALL")');
    expect(BARE, "🔴 시장 미확정 수는 «차이» 로 센다").toContain(
      "allList.length - domesticList.length - overseasList.length",
    );
    /** 🔴 합으로 만들면 그 후보가 사라진다 — 그 모양을 금지한다. */
    expect(BARE, "🔴 전체를 합으로 만들지 않는다").not.toContain(
      "domesticList.length + overseasList.length",
    );
  });

  it("D-2 🟢 전체 요약 줄이 그려지고 네 숫자를 같이 적는다", () => {
    expect(BARE).toContain('data-testid="mi-candidate-scope-summary"');
    expect(BARE).toContain('data-testid="mi-candidate-scope-unresolved"');
    expect(BARE, "🟢 전체").toContain("CANDIDATE_LIST_HEADING.ALL");
    expect(BARE, "🟢 국내").toContain("CANDIDATE_LIST_HEADING.KR");
    expect(BARE, "🟢 해외").toContain("CANDIDATE_LIST_HEADING.OVERSEAS");
    expect(BARE, "🟢 시장 미확정").toContain("시장 미확정");
  });

  it("D-3 🔴🔴 전체 축에 «가격» 을 붙이지 않았다 — 통화가 섞인다", () => {
    /**
     * 🔴 그 줄은 **후보 가시성** 축이다. 금액·통화·환산 어휘가 그 구간에 들어오면
     *    서로 다른 통화가 한 숫자로 합쳐진다(환산 금지 · `overseas-reference` 계약).
     */
    const i = BARE.indexOf('data-testid="mi-candidate-scope-summary"');
    const j = BARE.indexOf('data-testid="mi-candidate-scope-unresolved"');
    expect(i, "🔴 요약 줄을 찾지 못했다").toBeGreaterThan(0);
    const block = BARE.slice(i, BARE.indexOf("</p>", j > 0 ? j : i));
    for (const banned of ["₩", "KRW", "priceKrw", "lowest", "krwEquivalent", "환산", "평균"]) {
      expect(block, `🔴 전체 요약 줄에 «${banned}» 가 들어왔다`).not.toContain(banned);
    }
  });
});
