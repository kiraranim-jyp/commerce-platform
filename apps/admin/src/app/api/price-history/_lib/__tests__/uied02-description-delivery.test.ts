/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-UNIFIED-IDENTITY-EVIDENCE-02 — **후보 상세설명 원문 응답 포함**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔵 CPO 승인 범위 — UIED-01 §H **① 하나** 다. ③(추출 실패 상태) · ②(후보 구조화 저장)는
 *    이번 작업에 **포함하지 않는다**.
 *
 * 🔴 금지 전수 준수 — DB schema 0 · migration/backfill 0 · `candidate_reviews` 저장 0 ·
 *    후보 재관측 0(이 파일 **HTTP 0**) · 새 크롤러 0 · SAME 기준·blocker 0 ·
 *    상세설명 **운영 판정 연결 0** · 가격·등록 0 · UI 0.
 *
 * 🔴🔴 **이 파일이 증명하는 것과 증명하지 못하는 것을 가른다**:
 * ```
 * 🟢 증명한다   ⒜ 네 영역이 **한 후보 줄** 에 선다(배선 · 소스 앵커)
 *               ⒝ `null` ↔ `""` ↔ 원문 셋을 **상태로 가른다**(순수 함수 재현)
 *               ⒞ 소비처(MI·가격·등록·seller 선택)가 그 칸을 **읽지 않는다**(전수 grep)
 *               ⒟ 운영 facts 에 상세설명 원문이 **실제로 있다**(기존 산출물 8/8)
 * 🔴 증명하지 못한다  실제 `/check` 응답 본문 — 로그인 뒤라 CTO 가 볼 수 없다
 *               (메모 `production-payload-is-unreachable`) ⟹ **배선 + 데이터 가용성** 축이다
 * ```
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const LIB = join(__dirname, "..");
const FIX = join(__dirname, "fixtures");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const src = (p: string) => strip(readFileSync(p, "utf8"));

/** 🔴 운영 push 자리만 잘라낸다 — 파일 전체를 보면 엉뚱한 구간이 통과한다(이 트랙 3회). */
const pushBlock = (): string => {
  const s = src(join(LIB, "run-domestic-price-check.ts"));
  const i = s.indexOf("const candidateDescription = best.facts.description;");
  expect(i, "🔴 운영 push 자리가 사라졌다").toBeGreaterThan(0);
  const j = s.indexOf("transientEvidenceSink.push({", i);
  expect(j, "🔴 push 자리 끝을 못 찾았다").toBeGreaterThan(i);
  return s.slice(i, j);
};

describe("UIED02 — 후보 상세설명 원문 응답 포함", () => {
  /* ═══ §7-A/D. 전달 경로 + 세 축 연결 ═══════════════════════════════════════ */

  it("A-1 🟢🟢 **네 영역이 한 후보 줄에 선다** — 상세설명이 그 줄의 칸이다", () => {
    const b = pushBlock();
    /** ① 연결 키 — 후보 하나당 한 줄. */
    expect(b, "🔴 후보 연결 키가 없다").toContain("candidateUrl: best.url");
    /** ②③ 구조화 세 칸 — **원상품과 후보 양쪽**. */
    for (const f of ["brand: query.facts?.brand", "modelCode: query.facts?.brandModelCode", "title: query.facts?.title"]) {
      expect(b, `🔴 원상품 구조화 칸이 없다: ${f}`).toContain(f);
    }
    for (const f of ["brand: best.facts.brand", "modelCode: best.facts.brandModelCode", "title: best.facts.title"]) {
      expect(b, `🔴 후보 구조화 칸이 없다: ${f}`).toContain(f);
    }
    /** ④ 상세설명 **원문** — 같은 줄에 있다. */
    expect(b, "🔴 상세설명 원문이 실리지 않는다").toContain("best.facts.description");
    expect(b, "🔴 원문 칸이 없다").toContain("raw: candidateDescription ?? null");
    /** ⑤ 기존 TITLE/DESCRIPTION 관찰값 — **그대로 유지**(재구현 0). */
    expect(b, "🔴 기존 축 요약이 빠졌다").toContain("summarizeIdentityEvidence(query.facts, best.facts)");
  });

  it("A-2 🔴 **새 수집·새 추출기를 만들지 않았다** — 같은 facts 객체를 읽는다", () => {
    const b = pushBlock();
    /** 🔴 push 자리에서 네트워크/추출을 부르지 않는다. */
    for (const banned of [
      ["facts", "FromProductUrl"].join(""),
      ["fetch", "PlainHtml"].join(""),
      ["enrich", "CandidatePrices"].join(""),
      "globalThis." + "fetch",
      "await ",
    ]) {
      expect(b, `🔴 push 자리에서 수집을 했다: ${banned}`).not.toContain(banned);
    }
    /** 🟢 그리고 바로 아래 sink 가 **같은 객체** 를 쓴다(FINAL-03 선례 · 중복 수집 0). */
    const s = src(join(LIB, "run-domestic-price-check.ts"));
    expect(s).toContain("brand: best.facts?.brand ?? null");
  });

  it("A-3 🟢 **관측 시각은 응답 하나** 다 — 값별 시각을 지어내지 않았다", () => {
    const s = src(join(LIB, "run-domestic-price-check.ts"));
    expect(s, "🔴 관측 시각이 없다").toContain(
      "identityEvidence: { candidates: identityEvidenceRows, observedAt: new Date().toISOString() }",
    );
    /** 🔴🔴 **값별 시각을 만들지 않았다** — `ProductFacts` 에 시각 칸이 **없다**(전수 확인). */
    const facts = src(join(LIB, "..", "..", "..", "..", "..", "..", "..", "packages", "shared", "src", "product-facts.ts"));
    for (const t of ["observedAt", "fetchedAt", "capturedAt"]) {
      expect(facts, `🔴 facts 에 시각 칸이 생겼다: ${t}`).not.toContain(t);
    }
    /** 🔴 그래서 축 값에 시각을 붙이지 않았다. */
    expect(pushBlock(), "🔴 값별 시각을 지어냈다").not.toContain("observedAt");
  });

  /* ═══ §7-C. 원문 보존 — `null` ↔ `""` ↔ 원문 ═══════════════════════════════ */

  it("C-1 🔴🔴 **빈 문자열을 「정보 부재」로 해석하지 않는다**(CPO 명시)", () => {
    /** 🟢 운영과 **같은 식** 을 재현한다(소스에서 그 모양을 같이 단언한다). */
    const stateOf = (d: string | null | undefined) =>
      d == null ? "NOT_MEASURED" : d.length === 0 ? "MISSING" : "PRESENT";
    expect(stateOf(undefined)).toBe("NOT_MEASURED");
    expect(stateOf(null)).toBe("NOT_MEASURED");
    expect(stateOf(""), "🔴 「읽었는데 비었다」와 「잴 기회가 없었다」가 섞였다").toBe("MISSING");
    expect(stateOf("Bobo Choses Pop sweatshirt …")).toBe("PRESENT");
    /** 🔴 운영이 그 셋을 **그 순서로** 가른다. */
    const b = pushBlock();
    expect(b).toContain('candidateDescription == null');
    expect(b).toContain('? "NOT_MEASURED"');
    expect(b).toContain('candidateDescription.length === 0');
    expect(b).toContain('? "MISSING"');
    expect(b).toContain(': "PRESENT"');
    /** 🔴 `raw` 가 `?? ""` 로 뭉개지지 않는다 — `null` 이 보존된다. */
    expect(b, "🔴 null 을 빈 문자열로 뭉갰다").not.toContain('raw: candidateDescription ?? ""');
  });

  it("C-2 🔴 원문을 **번역·보정·요약·절단하지 않는다**", () => {
    const b = pushBlock();
    for (const banned of ["slice(", "substring(", "trim()", "translate", "toLowerCase()", "normalize"]) {
      expect(b, `🔴 원문을 가공했다: ${banned}`).not.toContain(banned);
    }
    /** 🟢 길이는 **원문 그대로** 센다. */
    expect(b).toContain("length: candidateDescription?.length ?? 0");
  });

  it("C-3 🟢🟢 운영 facts 에 상세설명 원문이 **실제로 있다**(기존 산출물 · 새 수집 0)", () => {
    const m = JSON.parse(readFileSync(join(FIX, "mier01-reassessment.json"), "utf8")) as {
      rows: { domain: string; candidate: { descriptionRaw: string | null; descriptionLength: number } }[];
    };
    const withRaw = m.rows.filter((r) => (r.candidate.descriptionRaw ?? "").length > 0);
    /** 🔴 분모를 적는다 — 후보 **8건** 이고 전수 환산하지 않는다. */
    expect(m.rows).toHaveLength(8);
    expect(withRaw.length, "🔴 상세설명 원문이 운영 경로에서 비었다").toBe(8);
    /** 🟢 길이가 서로 다르다 = **같은 문자열을 복제한 것이 아니다**. */
    expect(new Set(withRaw.map((r) => r.candidate.descriptionLength)).size).toBeGreaterThanOrEqual(7);
    /** 🔴 그리고 그 길이가 `descriptionRaw` 와 **일치** 한다(지어낸 숫자가 아니다). */
    for (const r of withRaw) {
      expect(r.candidate.descriptionRaw!.length, `🔴 ${r.domain} 길이 불일치`).toBe(r.candidate.descriptionLength);
    }
  });

  /* ═══ §4·§7-E. 소비처 비개입 ═══════════════════════════════════════════════ */

  it("E-1 🔴🔴 **소비처가 새 칸을 읽지 않는다** — MI · 가격 · 등록 · seller 선택", () => {
    const consumers: [string, string][] = [
      ["MI 집계", join(LIB, "market-intelligence.ts")],
      ["가격 tier", join(LIB, "..", "..", "..", "..", "lib", "price-truth.ts")],
      ["시장 분류", join(LIB, "candidate-market.ts")],
    ];
    for (const [label, p] of consumers) {
      const s = src(p);
      for (const banned of ["identityEvidenceRows", "identityEvidence"]) {
        expect(s, `🔴 ${label} 가 증거 칸을 읽는다: ${banned}`).not.toContain(banned);
      }
    }
    /**
     * 🔴🔴 **`/check` 라우트가 그 배열을 MI 인자에 넣지 않는다** — 그것이 경계의 핵심이다.
     * 🟢 라우트는 응답에 **그대로 싣기만** 한다(`domesticShop?.identityEvidence ?? null`).
     */
    const route = src(join(LIB, "..", "check", "route.ts"));
    expect(route).toContain("identityEvidence: domesticShop?.identityEvidence ?? null");
    const mi = route.indexOf(["compute", "MarketIntelligence("].join(""));
    expect(mi, "🔴 MI 호출부가 사라졌다").toBeGreaterThan(0);
    const miArgs = route.slice(mi, route.indexOf(")", route.indexOf("}", mi)) + 1);
    expect(miArgs, "🔴🔴 증거 칸이 MI 인자로 들어갔다").not.toContain("identityEvidence");
  });

  it("E-2 🔴 **상세설명이 판정·가격·등록 어휘와 같은 줄에 서지 않는다**", () => {
    const b = pushBlock();
    for (const banned of [
      "verdict",
      "blocker",
      "eligib",
      "priceTier",
      "recommended",
      "payload",
      ["SAME", "_MIN_AXES"].join(""),
    ]) {
      expect(b, `🔴 증거 줄에 판정/가격 어휘가 들어왔다: ${banned}`).not.toContain(banned);
    }
    /** 🔴 등록 payload 빌더가 상세설명 증거 칸을 모른다. */
    const naver = src(join(LIB, "..", "..", "..", "..", "..", "..", "..", "packages", "shared", "src", "product-facts.ts"));
    expect(naver, "🔴 facts 타입에 증거 전달 칸이 생겼다").not.toContain("identityEvidence");
  });

  it("E-3 🔴 Matcher 는 여전히 `evidence` 를 읽지 않는다(계약 P2 유지)", () => {
    const CS = join(LIB, "..", "..", "..", "..", "..", "..", "..", "packages", "crawler", "src", "comparison-search");
    const cross = src(join(CS, "cross-seller.ts"));
    /** 🔴 비교 함수가 상세설명 원문을 보지 않는다 — 그것이 「판정 연결 금지」의 코드 자리다. */
    expect(cross, "🔴🔴 Matcher 가 상세설명 원문을 읽는다").not.toContain(".description");
    expect(cross, "🔴 Matcher 가 증거 칸을 읽는다").not.toContain("identityEvidence");
  });
});
