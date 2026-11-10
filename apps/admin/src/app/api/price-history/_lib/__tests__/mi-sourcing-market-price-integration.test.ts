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

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔵🔵 **B-2 를 둘로 쪼갰다 — 변이 독립성 때문이다**(CPO 승인 2026-11-10)
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴🔴 **CPO 지적이 맞았다.** 합쳤을 때는 한 케이스가 **세 동작을 함께** 봐서
   *    ⒜ GET 복원 배선을 끊어도 ⒝ URL 중복 제거를 없애도 **같은 계약이 실패** 했다
   *    ⟹ 두 보장 각각의 **독립 증거가 되지 못했다**(변이 N1 · N3 이 구별되지 않았다).
   * 🟢 그래서 **보장 단위로** 가른다 — 운영 코드 변경 **0**(테스트만).
   * ```
   * B-2a  GET 복원 배선        ← 끊으면 N1 «만» 실패한다
   * B-2b  URL 단위 중복 제거    ← 없애면 N3 «만» 실패한다
   * ```
   * 🔴 **약화 0** — 합본이 보던 단언을 **하나도 버리지 않고** 두 곳에 나눠 담았다.
   */
  it("B-2a 🔴🔴 **GET 가지가 복원분을 집계 입력으로** 쓴다(POST 는 섞지 않는다)", () => {
    const at = INTEL.indexOf("const aggregationEvidence");
    expect(at, "🔴 합류 지점을 찾지 못했다").toBeGreaterThan(0);
    const decl = INTEL.slice(at, INTEL.indexOf("for (const e of aggregationEvidence)", at));
    /** 🔴 분기 자체가 있어야 POST/GET 이 갈린다. */
    expect(decl).toContain("geminiEvidence && geminiEvidence.length > 0");
    /** 🔴 GET 가지 — 이것이 없으면 재진입에서 국내 참고가격이 **다시 사라진다**. */
    expect(
      decl,
      "🔴 GET 복원 배선이 끊겼다 — 재진입에서 국내 가격 근거가 소멸한다",
    ).toContain("savedCandidateRowsToEvidence(savedCandidateRows)");
    /** 🔴 POST 가지 — 저장분이 섞이면 같은 후보가 **두 번** 집계된다. */
    const [post] = decl.split("savedCandidateRowsToEvidence");
    expect(post, "🔴 POST 가지에 복원분이 섞였다 — 중복 집계").not.toContain("savedCandidateRows");
    expect(post, "🔴 POST 가지가 geminiEvidence 를 쓰지 않는다").toContain("geminiEvidence");
  });

  it("B-2b 🔴 **쓰이는 가지마다 URL 단위 중복 제거** 를 통과한다", () => {
    const at = INTEL.indexOf("const aggregationEvidence");
    const decl = INTEL.slice(at, INTEL.indexOf("for (const e of aggregationEvidence)", at));
    /**
     * 🔴🔴 **1차 분리가 덜 갈렸고 변이가 그것을 잡았다**(이 기록을 남긴다).
     *    처음엔 「`dedupeEvidenceByUrl(` 가 **정확히 2개**」로 썼다. 그런데 N1(GET 배선
     *    제거)이 그 호출 **하나를 같이 지우므로** B-2b 도 함께 실패했다
     *    ⟹ 「중복 제거」 축이 **「GET 가지 존재」에 간접 의존** 하고 있었다.
     * 🟢 그래서 개수를 세지 않고 **각 가지 안에서** 확인한다 —
     *    GET 가지의 **존재** 는 B-2a 의 책임이고 여기서 다시 묻지 않는다.
     */
    /**
     * 🔴🔴 **두 번째 교정 — 내 단언이 또 동어반복이었고 변이가 잡았다.**
     *    `decl.split("savedCandidateRowsToEvidence")[0]` 을 「POST 가지」로 썼는데,
     *    GET 줄이 `: dedupeEvidenceByUrl(savedCandidateRowsToEvidence(…` 이라
     *    그 **접두 `dedupeEvidenceByUrl(` 가 앞 조각 끝에 붙어 있었다**
     *    ⟹ POST 가지에서 중복 제거를 없애도(N3) **통과** 했다.
     * 🟢 그래서 **삼항 가지를 좌표로** 자른다 — `?` 와 `:` 사이가 POST 가지다.
     */
    const q = decl.indexOf("?");
    const colon = decl.indexOf(":", q);
    expect(q, "🔴 삼항 분기를 찾지 못했다").toBeGreaterThan(0);
    expect(colon, "🔴 GET 가지 구분자를 찾지 못했다").toBeGreaterThan(q);
    const postBranch = decl.slice(q + 1, colon);
    const getBranch = decl.slice(colon + 1);
    expect(postBranch, "🔴 POST 가지에 URL 중복 제거가 없다").toContain("dedupeEvidenceByUrl(");
    /**
     * 🔴 복원분을 **쓰는 가지가 있으면** 그것도 중복 제거를 통과해야 한다.
     * 🟢 조건부지만 **공집합이 되지 않는다** — 그 가지의 존재는 B-2a 가 보장한다
     *    ⟹ 정상 코드에서 이 분기는 **항상** 실행된다(둘이 합쳐 공백이 없다).
     */
    if (getBranch.includes("savedCandidateRowsToEvidence")) {
      expect(
        getBranch,
        "🔴 복원분이 중복 제거를 거치지 않는다 — GET 경로에서 같은 URL 이 두 번 센다",
      ).toContain("dedupeEvidenceByUrl(savedCandidateRowsToEvidence(");
    }
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

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔵🔵🔵 **B-5 의 방향이 뒤집혔다 — 해외도 같은 길로 온다**(UNIFIED-PIPELINE-1)
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 전: 「복원분은 **해외 축에 들어가지 않는다**」 — `&& e.basis != null` 가드.
   *    근거는 「`basis` 를 지어내지 않는다」였고 **그 원칙 자체는 지금도 유효** 하다.
   * 🟢 후: 전수 확인 결과 그 칸은 **아무도 읽지 않는다** ⟹ null 을 실어도 숫자가
   *    바뀌지 않는다 ⟹ **값을 만들지 않고 가드만 걷었다**(지어내기 0 · 새 저장소 0).
   *
   * 🔴 **약화가 아니다** — 이 케이스가 지키던 **「지어내지 않는다」** 를 그대로 단언하고
   *    (`basis: null` 유지), **「아무도 안 읽는다」** 는 전제를 **새로** 잠근다.
   *    ⟹ 누가 그 칸을 읽기 시작하면 이 계약이 **FAIL 로 알려 준다.**
   */
  it("B-5 🔴 basis 를 지어내지 않는다 — 그리고 그 칸은 «아무도 읽지 않는다»", () => {
    /** 🔴 복원분은 여전히 `null` 이다(값 생성 0). */
    const at = INTEL.indexOf("function savedCandidateRowsToEvidence");
    const body = INTEL.slice(at, INTEL.indexOf("\n}\n", at));
    expect(body, "🔴 basis 를 지어냈다").toContain("basis: null");
    /** 🟢 가드가 걷혔다 — 해외도 국내와 같은 길로 온다(비대칭 해소). */
    expect(
      INTEL,
      "🔴 해외 가지가 복원분을 다시 막는다 — 재진입 비대칭이 돌아온다",
    ).not.toContain("e.priceCurrency && e.basis != null");
    /**
     * 🔴🔴 **전제 잠금** — 그 칸을 «읽는» 코드가 생기면 null 분기를 먼저 설계해야 한다.
     * 🟢 집계 레코드 타입에 `basis` 가 **없다** 는 사실로 그것을 본다.
     */
    const CM = strip(readFileSync(join(LIB, "candidate-market.ts"), "utf8"));
    const recAt = CM.indexOf("CandidateOverseasPriceRecord");
    const recBody = CM.slice(recAt, CM.indexOf("}", recAt));
    expect(
      recBody,
      "🔴 집계 레코드가 basis 를 읽기 시작했다 — null 분기를 먼저 설계해야 한다",
    ).not.toContain("basis");
  });

  it("B-6 🟢🟢 **국내·해외가 같은 입력·같은 루프를 쓴다**(시장별 분기 0)", () => {
    const at = INTEL.indexOf("for (const e of aggregationEvidence)");
    const loop = INTEL.slice(at, INTEL.indexOf("const domesticMarketSplit", at));
    /** 🔴 루프는 **하나** 다 — 시장별 전용 루프를 만들면 구조가 다시 갈라진다. */
    expect(
      INTEL.split("for (const e of aggregationEvidence)").length - 1,
      "🔴 집계 루프가 둘 이상이다 — 국내/해외가 갈라졌다",
    ).toBe(1);
    /** 🔴 시장은 **분기 조건** 일 뿐 별도 수집 경로가 아니다. */
    expect(loop).toContain('e.market !== "KR"');
    expect(loop, "🔴 해외 전용 복원 경로가 생겼다").not.toContain("savedOverseasRows");
    /** 🟢 복원분은 **시장을 가리지 않고** 같은 변환기를 통과한다. */
    const conv = INTEL.slice(
      INTEL.indexOf("function savedCandidateRowsToEvidence"),
      INTEL.indexOf("\n}\n", INTEL.indexOf("function savedCandidateRowsToEvidence")),
    );
    expect(conv, "🔴 복원기가 시장으로 걸러낸다 — 한쪽만 복원된다").not.toContain('=== "KR"');
    expect(conv, "🔴 복원기가 시장으로 걸러낸다 — 한쪽만 복원된다").not.toContain('!== "KR"');
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

  it("C-3 🔴🔴 **새 테이블·migration 을 만들지 않았다**", () => {
    /**
     * 🔴 schema 축은 **한 글자도 바뀌지 않는다** — 두 파일 모두에서 금지 유지.
     * 🔴 `exchangeRate *`(환율을 손으로 곱하는 모양)도 **그대로 금지** 다.
     */
    for (const banned of ["CREATE TABLE", "ALTER TABLE", "exchangeRate *"]) {
      expect(INTEL, `🔴 금지된 수단: ${banned}`).not.toContain(banned);
      expect(SAVED, `🔴 금지된 수단: ${banned}`).not.toContain(banned);
    }
    /**
     * ════════════════════════════════════════════════════════════════════════
     * 🔵🔵🔵 MI-UNIFIED-MARKET-PRICE-COMPARISON-1 — **환산 금지 재지정**(CPO 승인)
     * ════════════════════════════════════════════════════════════════════════
     *
     * 🔴 전 계약은 두 파일 **모두** 에서 `convertToKrw` 를 금지했다. 그때는 환산 owner 가
     *    UI 였고 서버는 환산하지 않는 것이 맞았다. 이제 **서버가 환산 owner** 다
     *    (UI 가 환율 없이 환산해 **표시값 ≠ 확정값** 이 될 수 있었던 결함을 고치려면
     *     환산이 서버로 와야 한다).
     * 🟢 그래서 **딱 한 파일에서만** 허용하고 나머지는 **그대로 금지** 한다:
     * ```
     * market-intelligence.ts   🟢 허용 — 승인된 유일한 환산 지점(라이브 환율을 받는다)
     * saved-candidate-rows.ts  🔴 금지 — 저장분 복원기는 값을 «만들지» 않는다
     * ```
     */
    expect(SAVED, "🔴 복원기가 환산하면 저장분이 값을 만들어낸다").not.toContain("convertToKrw");
    /**
     * 🔴🔴 **허용은 「아무렇게나 환산해도 된다」가 아니다.** 서버 환산이 지켜야 할 둘을
     *    여기서 직접 단언한다 — 그래서 이 재지정은 **약화가 아니다**:
     *    ⒜ **라이브 환율을 넘긴다**(인자 없이 부르면 내장 고정표라 이 WU 의 결함 재발)
     *    ⒝ **`byCurrency` 집계 계약 불변** — 통화별 버킷에 환산을 섞지 않는다
     */
    expect(INTEL, "🔴 라이브 환율을 넘기지 않는다 — 내장 고정표로 환산하면 결함 재발이다").toContain(
      "convertToKrwStrict(e.priceAmount, e.priceCurrency, candidateRates)",
    );
    expect(INTEL, "🔴 통화별 집계에 환산을 섞었다").not.toMatch(/byCurrency[^\n]*[Kk]rw/);
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
