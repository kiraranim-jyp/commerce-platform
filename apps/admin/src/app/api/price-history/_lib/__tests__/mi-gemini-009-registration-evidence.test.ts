import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-GEMINI-REGISTRATION-DECISION-009 — transient evidence 가 «판정면» 에 닿는다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **먼저 이 WU 가 찾아낸 구조적 사실 둘을 테스트로 고정한다.**
 *
 *   ① 「등록 준비」와 「판매 판정」은 **서로에게 영향을 주지 않는다** —
 *      `registration-readiness-outcome.ts` 머리 주석(P-32, CPO 지시 2026-09-03)이
 *      「이 파일의 어떤 함수도 sellVerdict 를 읽고 등록 결과를 바꾸지 않는다」고
 *      명시한다. 🔴 그래서 Gemini 증거(동일상품/가격 축)를 **등록 준비에 연결하지
 *      않았다.** 연결한 곳은 **판매 판정면**(`computeMarketIntelligence`)이다.
 *
 *   ② `computeMarketIntelligence(snapshotId, workspaceId)` 는 **전부 DB 에서 읽는다.**
 *      Gemini 후보는 저장이 금지돼 있어(§5/§19) DB 에 없다 → **구조적으로 닿을 수
 *      없었다.** 그래서 지시서 §5 가 요구한 「영구 entity 없이 런타임 객체로」를
 *      optional 인자 하나로 구현했다.
 *
 * 🔴 **이 파일은 소스 계약을 본다.** 실제 Gemini/DB 호출은 LIVE 하니스
 *    (`mi-gemini-005-e2e.test.ts`)가 담당한다 — 여기서 네트워크를 타지 않는다.
 *    🔴 소스 문자열 검사는 **주석을 벗기고** 한다(헌장 §5 · 여덟 번 걸린 함정).
 */

const LIB = path.join(__dirname, "..");
const strip = (f: string) =>
  readFileSync(path.join(LIB, f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

const RUNNER = strip("run-domestic-price-check.ts");
const INTEL = strip("market-intelligence.ts");
const ROUTE = strip(path.join("..", "check", "route.ts"));

/* ══════════════ A. 저장 0 — 이 WU 의 가장 강한 제약 ══════════════ */

describe("A. 🔴🔴 Gemini 후보는 저장되지 않는다 (§14 = 0 이어야 한다)", () => {
  it("upsertDomesticProductLink «앞» 에서 가상 샵이 걸러진다", () => {
    const upsert = RUNNER.indexOf("const upsertResult = await upsertDomesticProductLink(");
    expect(upsert).toBeGreaterThan(-1);
    /** 🟢 WU-024 — 가드가 술어 하나(`isTransientShopId`)로 모였다. 성질 동일 · 범위 확대. */
    const guard = RUNNER.lastIndexOf("isTransientShopId(result.shopId)", upsert);
    expect(guard).toBeGreaterThan(-1);
    /** 🔴 가드가 upsert «뒤» 면 이미 저장된 뒤다 — 인덱스 순서로 본다. */
    expect(guard).toBeLessThan(upsert);
    expect(RUNNER.slice(guard, upsert)).toContain("continue");
  });

  it("🔴 evidence 를 담는 코드가 그 가드 «안» 에 있다 — 저장 경로로 새지 않는다", () => {
    const guard = RUNNER.indexOf("isTransientShopId(result.shopId)");
    const upsert = RUNNER.indexOf("const upsertResult = await upsertDomesticProductLink(");
    const push = RUNNER.indexOf("transientEvidenceSink.push(");
    expect(push).toBeGreaterThan(guard);
    expect(push).toBeLessThan(upsert);
  });

  it("🔴 evidence 타입에 DB/저장 어휘가 없다", () => {
    const decl = RUNNER.slice(RUNNER.indexOf("interface GeminiTransientEvidence"));
    const body = decl.slice(0, decl.indexOf("}") + 1);
    for (const forbidden of ["insert", "upsert", "supabase", "prisma", "cache"]) {
      expect(body.toLowerCase()).not.toContain(forbidden);
    }
  });
});

/* ══════════════ B. 기존 MI 재사용 — Gemini 전용 판정기 금지 ══════════════ */

describe("B. 🔴 새 판정 알고리즘을 만들지 않았다 (§3)", () => {
  it("🟢 tier 는 priceTierFromLink 를 «호출» 한다 — 복제 계산이 아니다", () => {
    const push = RUNNER.slice(RUNNER.indexOf("transientEvidenceSink.push("));
    const block = push.slice(0, push.indexOf("});"));
    expect(block).toContain("priceTierFromLink({ matchTruth: finalMatchTruth, verified: finalVerified })");
    /** 🔴 tier 문자열을 직접 쓰지 않는다 — 그러면 두 값이 갈라진다. */
    for (const literal of ['"EXACT"', '"COMPARISON"', '"REFERENCE"', '"EXCLUDED"']) {
      expect(block).not.toContain(literal);
    }
  });

  it("🔴🔴 Gemini 전용 분기(`if (geminiSame) STOP`)가 «없다» (§3/§4)", () => {
    for (const src of [RUNNER, INTEL]) {
      /** 🔴 Gemini 와 STOP/BLOCK 을 같은 조건에 묶는 코드가 없어야 한다. */
      expect(src).not.toMatch(/gemini[A-Za-z]*\s*(===|!==)?\s*[^;\n]*\b(STOP|BLOCKED|BLOCK)\b/i);
    }
  });

  it("🔴 threshold 어휘를 새로 만들지 않았다", () => {
    const decl = RUNNER.slice(RUNNER.indexOf("interface GeminiTransientEvidence"));
    expect(decl.slice(0, 900)).not.toMatch(/THRESHOLD|MIN_AXES|SAME_MIN/i);
  });
});

/* ══════════════ C. 판정면 연결 — 그러나 «계산에는» 들어가지 않는다 ══════════════ */

describe("C. 🟢 판정면에 닿지만 기존 판정을 바꾸지 않는다", () => {
  it("computeMarketIntelligence 가 transient evidence 를 인자로 받는다", () => {
    expect(INTEL).toContain("geminiEvidence?: GeminiTransientEvidence[] | null");
  });

  it("🟢 반환 객체의 «별도 칸» 으로만 나간다", () => {
    expect(INTEL).toContain("geminiEvidence: geminiEvidence ?? null");
  });

  /**
   * 🔴🔴 **이 단언이 이 파일의 핵심이다.** 인자를 받은 뒤 그 값을 다른 계산에
   *    쓰면 Gemini 가 기존 판정을 바꿀 수 있다. 그래서 `geminiEvidence` 가
   *    등장하는 곳이 **시그니처와 반환 두 곳뿐** 임을 숫자로 잠근다.
   */
  /**
   * 🔴🔴 **이 단언은 WU-010R(CPO 승인)으로 «대체» 됐다.**
   *
   * 009 에서는 「evidence 를 읽는 계산이 0」이었다 — 그때는 Gemini 후보에 **가격이
   * 없어서** 기존 계약(전부 가격 보유 의미)에 넣으면 화면이 거짓을 말했기 때문이다.
   * 🟢 010R 이 `enrichCandidatePrices` 를 배선해 **가격이 확인된 후보만** 넣게
   *    했으므로, 이제 evidence 를 읽는 것이 **올바른 동작** 이다.
   *
   * 🔴 그래서 잠그는 대상이 바뀐다 — 「읽지 않는다」가 아니라
   *    **「읽되 기존 규칙을 바꾸지 않는다」** 다. 아래 세 개가 그 불변식이다.
   */
  it("🔴🔴 010R — evidence 는 «가격이 있는 것만» 버킷에 들어간다", () => {
    expect(INTEL).toContain("if (e.priceKrw == null)");
    const loop = INTEL.slice(INTEL.indexOf("for (const e of geminiEvidence ?? [])"));
    const body = loop.slice(0, loop.indexOf("const domesticMarketSplit"));
    /** 🔴 가격 없는 후보가 sellerCount 를 늘리면 안 된다 — continue 로 빠진다. */
    expect(body).toContain("droppedNoPrice += 1");
    expect(body).toContain("continue");
  });

  it("🔴🔴 010R — marketCode/currency 를 기존 값에 맞춘다(기존 증거 파괴 방지)", () => {
    const loop = INTEL.slice(INTEL.indexOf("for (const e of geminiEvidence ?? [])"));
    const body = loop.slice(0, loop.indexOf("const domesticMarketSplit"));
    /** 🔴 운영 전수: DOMESTIC_SHOP 279행 전부 market_code=null · KRW.
     *     다르면 resolvePriceMarketKey 가 null 을 내고 sellerCount 가 0 이 된다. */
    expect(body).toContain("marketCode: null");
    expect(body).toContain('currency: "KRW"');
    /** 🔴 등록부 샵이 아니므로 sourceRefId 는 null 이어야 한다. */
    expect(body).toContain("sourceRefId: null");
  });

  it("🔴🔴 010R — 기존 집계/판정 함수를 호출만 하고 규칙을 바꾸지 않았다", () => {
    /** 🟢 append 한 뒤 **기존 함수** 를 그대로 부른다. */
    expect(INTEL).toContain("summarizeDomesticMarketSplit(exactShopRecords, [");
    /** 🔴 tier 는 evidence 가 들고 온 값을 쓴다 — 여기서 다시 계산하지 않는다. */
    const loop = INTEL.slice(INTEL.indexOf("for (const e of geminiEvidence ?? [])"));
    const body = loop.slice(0, loop.indexOf("const domesticMarketSplit"));
    expect(body).toContain('e.priceTier === "EXACT"');
    expect(body).not.toContain("priceTierFromLink(");
    /** 🔴 REFERENCE/EXCLUDED 를 가격 버킷에 넣지 않는다(기존 루프와 같은 규칙). */
    expect(body).not.toContain('"REFERENCE"');
    expect(body).not.toContain('"EXCLUDED"');
  });

  it("🔴 sellerAction 계산이 geminiEvidence 를 보지 않는다", () => {
    const i = INTEL.indexOf("computeSellerAction");
    if (i > -1) {
      /** sellerAction 호출 인자 안에 gemini 가 없어야 한다. */
      const call = INTEL.slice(i, INTEL.indexOf(")", i) + 1);
      expect(call.toLowerCase()).not.toContain("gemini");
    }
  });
});

/* ══════════════ D. route 배선 ══════════════ */

describe("D. 운영 route 가 런타임으로 넘긴다", () => {
  it("check route 가 domesticShop.geminiEvidence 를 전달한다", () => {
    expect(ROUTE).toContain("domesticShop.geminiEvidence");
    const call = ROUTE.indexOf("computeMarketIntelligence(");
    expect(call).toBeGreaterThan(-1);
    expect(ROUTE.indexOf("domesticShop.geminiEvidence")).toBeGreaterThan(call);
  });

  it("🔴 DB 에서 다시 읽어 오려는 시도가 없다", () => {
    expect(ROUTE).not.toMatch(/listGemini|getGemini|fromGemini|selectGemini/i);
  });
});

/* ══════════════ E. flag OFF — 기존 동작 100% 유지 (§11-A · §12) ══════════════ */

describe("E. 🔴🔴 flag OFF 면 기존 동작이 한 글자도 바뀌지 않는다", () => {
  it("evidence 수집이 flag 분기 «안» 의 결과에만 의존한다", () => {
    /** OFF 면 geminiMetrics 가 null 이고, 그때 evidence 는 `null` 로 나간다. */
    expect(RUNNER).toContain("geminiEvidence: geminiMetrics === null ? null : geminiEvidence");
  });

  it("🔴 null(안 돌았다) 과 [](후보 0) 을 섞지 않는다 — §7 의 0 ≠ 부재", () => {
    expect(RUNNER).toContain("geminiMetrics === null ? null : geminiEvidence");
    expect(INTEL).toContain("geminiEvidence ?? null");
  });

  it("flag 는 여전히 \"true\" 만 ON 이다", () => {
    const pool = strip("gemini-candidate-pool.ts");
    expect(pool).toContain('process.env[GEMINI_DISCOVERY_FLAG] === "true"');
  });
});

/* ══════════════ F. 등록 준비 축은 «건드리지 않았다» ══════════════ */

describe("F. 🔴🔴 P-32 불변식을 지켰다 — 등록 준비에 연결하지 않았다", () => {
  const READINESS = path.join(
    __dirname, "..", "..", "..", "..", "pipeline", "commerce", "registration-readiness-outcome.ts",
  );

  it("registration-readiness-outcome.ts 에 gemini 어휘가 «없다»", () => {
    const src = readFileSync(READINESS, "utf8");
    expect(src.toLowerCase()).not.toContain("gemini");
  });

  it("🟢 그 파일의 불변식 문장이 그대로 살아 있다(지워졌으면 전제가 바뀐 것이다)", () => {
    const src = readFileSync(READINESS, "utf8");
    expect(src).toContain("판매 판정과 등록 준비는 서로에게 영향을 주지 않는다");
  });
});

/* ══════════════ G. Self-reference / scope 정책 무변경 (§9 · §10) ══════════════ */

describe("G. 🔴 008A 정책과 scope 정책을 건드리지 않았다", () => {
  it("scope 는 기존 isBatchSurveyTarget 결과를 그대로 쓴다", () => {
    expect(RUNNER).toContain("isBatchSurveyTarget(s, input.categoryScopes ?? null)");
    expect(RUNNER).toContain("scopedDomains: allSources.map((s) => s.domain)");
  });

  it("🔴 Gemini 경로에 자기참조 판정을 새로 만들지 않았다 — 기존 함수가 돈다", () => {
    /** judgeDomesticCandidate 안의 isSelfReferenceCandidate 가 Gemini 후보에도 적용된다. */
    expect(RUNNER).toContain("isSelfReferenceCandidate(input.sourceUrl, c.url)");
    const push = RUNNER.slice(RUNNER.indexOf("transientEvidenceSink.push("));
    expect(push.slice(0, 700)).not.toContain("isSelfReference");
  });
});
