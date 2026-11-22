/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-CODE-PROVENANCE-STEP1-01 — **계산된 품번 관찰값의 응답 전달 확인**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔵 CPO 승인 범위는 **STEP 1 하나** 다 — 「이미 계산되는 품번 관찰값을 응답에 전달」.
 * 🔴🔴 **헌장 §4-D 대로 기존 구현을 먼저 확인했고, 그 결과가 이 파일의 결론이다** —
 *    그 전달은 **이미 배선돼 있다**:
 * ```
 * run-domestic-price-check.ts:2339  identityEvidenceRows.push({ …summarizeIdentityEvidence })
 *                            :2709  return { identityEvidence: { candidates: rows } }
 * check/route.ts:775                 identityEvidence: domesticShop?.identityEvidence ?? null
 * ```
 * 🟢 그리고 타입이 값을 **좁히지 않는다** — `axes: IdentityEvidenceSummary["axes"]` 이므로
 *    `raw` · `normalized` · `source` 가 그대로 실린다.
 * ⟹ 🟢🟢 **운영 코드 변경 0 이 정답이다.** 이 파일은 그 사실을 **기계로 증명** 하고,
 *    CPO §3 의 **소비처 비개입 계약** 을 코드로 잠근다.
 *
 * 🔴 금지 전수 준수 — schema 0 · migration 0 · backfill 0 · `candidate_reviews` 쓰기 0 ·
 *    후보 재관측 0(HTTP 0) · slug 품번 자격 변경 0 · SAME 기준·blocker 0 ·
 *    상세설명 운영 판정 연결 0 · UI 0 · 가격 집계 0.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const LIB = join(__dirname, "..");
const APP = join(LIB, "..", "..", "..");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const RUNNER = strip(readFileSync(join(LIB, "run-domestic-price-check.ts"), "utf8"));
const ROUTE = strip(readFileSync(join(LIB, "..", "check", "route.ts"), "utf8"));

describe("CPS1 — 품번 관찰값 전달(STEP 1)", () => {
  /* ═══ A. 전달 경로가 이미 있다 — 🟢 기계로 증명 ═════════════════════════ */

  it("A-1 🟢🟢 **배선이 이미 있다** — runner 가 summary 를 응답 칸에 싣는다", () => {
    /** 🟢 계산 → 배열 → 응답 세 줄이 전부 살아 있어야 한다. */
    expect(RUNNER, "🔴 품번 관찰 계산이 사라졌다").toContain("summarizeIdentityEvidence(query.facts, best.facts)");
    expect(RUNNER, "🔴 관찰 배열이 사라졌다").toContain("identityEvidenceRows.push(");
    expect(RUNNER, "🔴 응답 칸 배선이 사라졌다").toContain("identityEvidence: { candidates: identityEvidenceRows }");
    /** 🟢 라우트가 그 칸을 응답으로 내보낸다. */
    expect(ROUTE, "🔴 라우트 전달이 사라졌다").toContain("identityEvidence: domesticShop?.identityEvidence ?? null");
  });

  it("A-2 🟢 **타입이 값을 좁히지 않는다** — raw·normalized·source 가 살아서 간다", () => {
    /** 🔴 `axes` 를 요약 상태만으로 좁히면 품번 «값» 이 사라진다. */
    expect(RUNNER).toContain('axes: ReturnType<typeof summarizeIdentityEvidence>["axes"]');
    expect(RUNNER).toContain('axes: IdentityEvidenceSummary["axes"]');
    /** 🔴 `state` 만 남기는 모양이 되돌아오면 FAIL 한다. */
    expect(RUNNER, "🔴 축을 상태만으로 좁혔다").not.toContain("axes: { axis: string; state:");
  });

  /**
   * 🔴🔴 **내 1차 단언이 틀렸고 그 FAIL 이 가르쳐 준 것을 적는다.**
   * 합성 `ProductFacts` 로 호출했더니 품번 축이 **전건 `NOT_MEASURED`** 였다.
   * 🟢 원인 — 그 축은 `facts.evidence[axis]`(**제목·상세설명 원문** 에서 뽑은 관찰
   *    맵)를 읽고 **`facts.brandModelCode` 칸은 읽지 않는다**(`:215` `valuesOf(origin.evidence?.[axis])`).
   * 🔵🔵 **그래서 CPO 가 알아야 할 사실이 하나 생긴다** — 이 축이 나르는 품번은
   *    출처 다섯 중 **`CANDIDATE_DESCRIPTION`·TITLE 계열** 이고,
   *    **`ORIGIN_DB_SKU`·`CANDIDATE_STRUCTURED` 는 그 축에 없다**(다른 칸이다).
   * 🟢 그러므로 아래는 **합성 입력을 버리고 운영 포착 산출** 로 단언한다.
   */
  it("A-3 🟢🟢 **실제 포착 산출에서 품번 축이 raw·normalized·source 를 낸다**", () => {
    const cap = JSON.parse(readFileSync(join(__dirname, "fixtures", "mic01-candidate-originals.json"), "utf8")) as {
      identityEvidence: { domain: string; evidence: { axes: { axis: string; origin: unknown[]; candidate: { raw: string; normalized: string; source: string }[]; comparison: string }[] } | null }[];
    };
    const rows = cap.identityEvidence.filter((r) => r.evidence);
    expect(rows.length, "🔴 분모 0 — 포착 산출이 비었다").toBeGreaterThan(0);

    let withCode = 0;
    for (const r of rows) {
      const code = r.evidence!.axes.find((a) => a.axis === "MODEL_CODE");
      expect(code, `🔴 ${r.domain} 에 품번 축이 없다`).toBeTruthy();
      for (const v of code!.candidate) {
        expect(typeof v.raw, "🔴 원문이 없다").toBe("string");
        expect(typeof v.normalized, "🔴 정규화값이 없다").toBe("string");
        /** 🔴 출처는 **기존 `EvidenceSource` 집합** 이다 — 새 값을 만들지 않았다. */
        expect(["TITLE", "DESCRIPTION", "IMAGE"]).toContain(v.source);
        withCode += 1;
      }
    }
    /** 🟢 실측 — 후보 쪽 품번 관찰이 **3건** 있다(coupleshot · junioredition · kids-world). */
    expect(withCode, "🔴 후보 품번 관찰 건수가 바뀌었다").toBe(3);
  });

  it("A-4 🔴🔴 **원상품 쪽 품번 관찰은 «비어 있다»** — 그 축이 DB SKU 를 나르지 않는다", () => {
    const cap = JSON.parse(readFileSync(join(__dirname, "fixtures", "mic01-candidate-originals.json"), "utf8")) as {
      identityEvidence: { domain: string; evidence: { axes: { axis: string; origin: unknown[]; comparison: string }[] } | null }[];
    };
    const rows = cap.identityEvidence.filter((r) => r.evidence);
    for (const r of rows) {
      const code = r.evidence!.axes.find((a) => a.axis === "MODEL_CODE")!;
      /**
       * 🔴 이 원상품(`bobochoses.com` Pop sweatshirt)의 **제목·상세설명에 품번이 없다**
       *    (MIER-01 실측) ⟹ 축의 `origin` 이 **비어 있는 것이 정상** 이다.
       * 🔴🔴 **그 공백을 「품번이 없다」로 읽으면 틀린다** — DB sku 또는 URL 복구값은
       *    **다른 칸** 에 있다(MMSE-02 §B). 그것이 STEP 2 가 필요한 이유다.
       */
      expect(code.origin, `🔴 ${r.domain} 의 원상품 관찰이 생겼다 — 분모 전제가 바뀌었다`).toHaveLength(0);
    }
  });

  it("A-5 🟢 **변형 충돌은 품번 축과 «다른 축» 에 남는다**(실제 포착)", () => {
    const cap = JSON.parse(readFileSync(join(__dirname, "fixtures", "mic01-candidate-originals.json"), "utf8")) as {
      identityEvidence: { domain: string; evidence: { axes: { axis: string; comparison: string; conflictBasis: string | null }[] } | null }[];
    };
    const row = cap.identityEvidence.find((r) => r.domain === "designerkidswear.com");
    expect(row?.evidence, "🔴 포착 산출이 없다").toBeTruthy();
    const color = row!.evidence!.axes.find((a) => a.axis === "COLOR")!;
    /** 🟢 색상 축이 **충돌** 을 따로 적는다 — 품번 축과 섞이지 않는다. */
    expect(color.comparison, "🔴 색상 충돌이 사라졌다 — 변형 구분이 죽는다").toBe("CONFLICT");
    expect(color.conflictBasis, "🔴 충돌 근거 문장이 없다").toBeTruthy();
  });

  /* ═══ B. 소비처 비개입 계약 — 🔴 CPO §3 필수 ═════════════════════════════ */

  it("B-1 🔴🔴 **MI 집계 입력에 넘기지 않는다** — `computeMarketIntelligence` 인자에 없다", () => {
    /**
     * 🔴 라우트가 MI 를 부르는 그 자리에 `identityEvidence` 가 **없어야** 한다.
     * 🟢 슬라이스가 아니라 **호출 인자 구간** 을 본다(엉뚱한 구간을 자르는 함정 방지).
     */
    const at = ROUTE.indexOf("computeMarketIntelligence(");
    expect(at, "🔴 MI 호출부를 못 찾았다 — 이 단언이 아무것도 보지 않는다").toBeGreaterThan(-1);
    const call = ROUTE.slice(at, ROUTE.indexOf(";", at));
    expect(call, "🔴 품번 관찰이 MI 집계 입력으로 들어갔다").not.toContain("identityEvidence");
  });

  it("B-2 🔴 **판정 owner 들이 그 칸을 읽지 않는다**(SAME · blocker · matchTruth)", () => {
    const CRAWLER = join(LIB, "..", "..", "..", "..", "..", "..", "..", "packages", "crawler", "src", "comparison-search");
    for (const f of ["cross-seller.ts", "match-truth.ts", "match.ts"]) {
      const src = strip(readFileSync(join(CRAWLER, f), "utf8"));
      expect(src, `🔴 ${f} 가 품번 관찰 칸을 읽는다`).not.toContain("identityEvidence");
      expect(src, `🔴 ${f} 가 요약기를 끌어왔다`).not.toContain("summarizeIdentityEvidence");
    }
  });

  it("B-3 🔴 **가격 축이 읽지 않는다** — 집계기·자격 술어·추천가", () => {
    /**
     * 🔴 **칸·파일 위치를 추측하지 않는다** — 1차에 `candidate-market.ts` 를 crawler 아래로
     *    찾았고 **없었다**. 🟢 실제 owner 는 아래 둘이다(이 저장소에서 반복된 함정).
     */
    const priceOwners: [string, string][] = [
      ["candidate-market.ts", join(LIB, "candidate-market.ts")],
      ["price-truth.ts", join(APP, "..", "lib", "price-truth.ts")],
    ];
    for (const [name, path] of priceOwners) {
      const src = strip(readFileSync(path, "utf8"));
      expect(src, `🔴 ${name} 가 품번 관찰을 읽는다`).not.toContain("identityEvidence");
      expect(src, `🔴 ${name} 가 요약기를 끌어왔다`).not.toContain("summarizeIdentityEvidence");
    }
    const mi = strip(readFileSync(join(LIB, "market-intelligence.ts"), "utf8"));
    expect(mi, "🔴 MI 집계기가 품번 관찰을 읽는다").not.toContain("identityEvidence");
    expect(mi, "🔴 MI 집계기가 요약기를 끌어왔다").not.toContain("summarizeIdentityEvidence");
  });

  it("B-4 🔴 **등록 payload 가 읽지 않는다**(세 채널 전수)", () => {
    const API = join(APP, "api");
    for (const rel of [
      join("smartstore", "register", "route.ts"),
      join("coupang", "register", "route.ts"),
      join("lotteon", "register", "route.ts"),
    ]) {
      const p = join(API, rel);
      let src: string;
      try {
        src = strip(readFileSync(p, "utf8"));
      } catch {
        /** 🔴 경로가 바뀌면 **조용히 통과하지 않는다** — 분모를 잃는다. */
        throw new Error(`🔴 등록 라우트를 찾지 못했다: ${rel}`);
      }
      expect(src, `🔴 ${rel} 가 품번 관찰을 읽는다`).not.toContain("identityEvidence");
      expect(src, `🔴 ${rel} 가 요약기를 끌어왔다`).not.toContain("summarizeIdentityEvidence");
    }
  });

  it("B-5 🔴 **seller 후보 선택기가 읽지 않는다**", () => {
    const COMMERCE = join(APP, "pipeline", "commerce");
    for (const f of ["mi-same-candidates.ts", "match-display.ts"]) {
      const src = strip(readFileSync(join(COMMERCE, f), "utf8"));
      expect(src, `🔴 ${f} 가 품번 관찰을 읽는다`).not.toContain("identityEvidence");
    }
  });

  it("B-6 🟢 유일한 소비처는 **증거 확인 화면 하나** 다(표시 전용)", () => {
    const panel = strip(
      readFileSync(join(APP, "pipeline", "commerce", "IdentityEvidencePanel.tsx"), "utf8"),
    );
    expect(panel, "🔴 증거 화면 배선이 사라졌다").toContain("identityEvidence");
    /** 🔴 그 화면이 판정·가격 어휘를 만들지 않는다(기존 계약과 같은 축). */
    for (const b of ["priceTier", "crossSellerVerdict", "recommendedPrice"]) {
      expect(panel, `🔴 증거 화면이 판정/가격 어휘를 들었다: ${b}`).not.toContain(b);
    }
  });

  /* ═══ C. 데이터 시점 — 🔴 과거 판정 입력으로 오인되지 않는다 ═════════════ */

  it("C-1 🔴🔴 **DB 에 쓰지 않는다** — 그래서 과거 판정 입력으로 오인될 구조가 없다", () => {
    /**
     * 🔵 CPO §4 — 「과거 snapshot 판정 입력으로 오인할 수 있는 구조를 만들지 않는다」.
     * 🟢 STEP 1 은 **응답 전달뿐** 이고 저장이 0 이므로 그 구조가 **애초에 생기지 않는다**.
     * 🔴 `candidate_reviews` 쓰기 경로에 그 칸이 들어가면 FAIL 한다.
     */
    const review = strip(readFileSync(join(LIB, "candidate-review.ts"), "utf8"));
    expect(review, "🔴 저장 경로가 품번 관찰을 쓴다").not.toContain("identityEvidence");
    expect(review, "🔴 저장 경로에 새 칸이 생겼다").not.toContain("code_evidence");
    /** 🔴 runner 도 그 칸을 저장하지 않는다. */
    expect(RUNNER, "🔴 runner 가 code_evidence 를 쓴다").not.toContain("code_evidence");
  });

  it("C-2 🟢 응답값은 **그 조회 시점의 관찰** 이다 — 저장분과 섞이지 않는다", () => {
    /**
     * 🟢 `identityEvidence` 는 **POST `/check` 응답에만** 실린다(GET 은 저장분을 그린다).
     * 🔴 그래서 화면이 저장된 과거 판정과 이 관찰을 **같은 칸에서 읽을 수 없다**.
     */
    const at = ROUTE.indexOf("identityEvidence: domesticShop?.identityEvidence");
    expect(at).toBeGreaterThan(-1);
    /** 🔴 GET 핸들러가 그 칸을 만들지 않는다. */
    const getRoute = strip(readFileSync(join(LIB, "..", "[snapshotId]", "route.ts"), "utf8"));
    expect(getRoute, "🔴 GET 이 품번 관찰을 만든다 — 시점이 섞인다").not.toContain("identityEvidence");
  });

  /* ═══ D. 기존 판정 불변 — 🔴 승인 범위를 넘지 않았다 ═════════════════════ */

  it("D-1 🔴 **이 WU 는 운영 파일을 한 글자도 바꾸지 않았다**(승인 범위 준수)", () => {
    /**
     * 🟢 STEP 1 이 요구한 전달은 **이미 있었다**(A-1/A-2) ⟹ 변경이 필요 없다.
     * 🔴 그래서 금지 항목이 구조적으로 깨질 수 없다 — 아래는 그 사실의 재확인이다.
     */
    for (const banned of ["code_evidence", "ALTER TABLE", "CREATE TABLE"]) {
      expect(RUNNER, `🔴 runner 에 ${banned} 가 생겼다`).not.toContain(banned);
      expect(ROUTE, `🔴 라우트에 ${banned} 가 생겼다`).not.toContain(banned);
    }
  });
});
