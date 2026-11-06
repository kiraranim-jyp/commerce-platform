import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-FUNNEL-PERSIST-01 — **국내 축이 «측정될 수» 있어야 한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴🔴 **이 계약이 막는 것은 버그가 아니라 «거짓 결론» 이다.**
 * ```
 * `candidate_reviews` 는 **세 생산자만** 받는다(OVERSEAS_AUTO · GEMINI · SELLER_URL).
 * 국내 후보를 «실제로 만드는» 둘 — WEB_SEARCH · DOMESTIC_LISTING — 은 079 migration 의
 * `source` CHECK 가 금지해서 그 표에 **구조적으로 들어갈 수 없다**.
 * ⟹ 그 표를 전수로 세면 🇰🇷 는 **거의 항상 0** 으로 나온다.
 *
 * 🔴 실측으로 그 일이 났다 — 2026-11-05 전수가 「국내 후보 총 1행 / 64 스냅샷」을 냈고,
 *    그것이 **「국내 공급이 구조적으로 비어 있다」는 블로커 판정** 으로 올라갔다.
 *    🔴 같은 날 영속 관측값(`workspace.searchRun.producers`)은 최근 6 실행에서
 *       WEB_SEARCH **6건** · DOMESTIC_LISTING **3건** 을 기록하고 있었다.
 *    ⟹ 그 「0」은 제품 사실이 아니라 **계측의 맹점** 이었다(헌장 §5-B 「측정불가 ≠ 0」).
 * ```
 * 🟢 그래서 **migration 없이** 측정을 복구한다 — 이미 있는 jsonb 관측 칸
 *    `product_snapshots.workspace.searchRun` 에 **생산자 × 시장 단계표** 를 같이 남긴다.
 *
 * 🔴 네트워크 0 · DB 0 — **소스 앵커** 로 본다(이 경로는 service-role 키가 필요해서
 *    로컬에서 실행할 수 없다 · 메모 `production-secrets-are-write-only`).
 * 🔴 금지 검사는 **코드** 에만 한다 — 주석이 금지를 설명한다(이 저장소가 아홉 번 걸린 함정).
 */

const ROUTE_RAW = readFileSync(path.join(__dirname, "../../check/route.ts"), "utf8");
const CODE = ROUTE_RAW.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const SAVE_CALL = "saveSnapshotSearchRun(";
/** 🔴 저장 payload 전체 — try 블록의 `} catch` 까지다(일부만 잘라 보면 구멍이 난다). */
const saveBlock = (): string => {
  const at = CODE.indexOf(SAVE_CALL);
  expect(at, "🔴 저장 호출부가 없다").toBeGreaterThan(0);
  const end = CODE.indexOf("} catch", at);
  expect(end, "🔴 저장 호출이 try 로 감싸여 있지 않다").toBeGreaterThan(at);
  return CODE.slice(at, end);
};

describe("MI-FUNNEL-PERSIST-01 — 국내 funnel 영속화", () => {
  /* ── F. 저장 내용 ─────────────────────────────────────────────────────── */

  it("F-1 🔴🔴 시장 셋의 단계표가 «저장» 된다 — 로그에만 두지 않는다", () => {
    const block = saveBlock();
    expect(block, "🔴 저장 payload 에 funnel 칸이 없다").toContain("funnel:");
    /** 🔴 「국내도 해외도 아님」을 **0 으로 뭉개지 않는다**. */
    for (const k of ['KR: cut("KR")', 'OVERSEAS: cut("OVERSEAS")', 'UNKNOWN_MARKET: cut("UNKNOWN")']) {
      expect(block, `🔴 저장 funnel 에 ${k} 가 없다`).toContain(k);
    }
  });

  it("F-2 🔴🔴 생산자 **여섯 전수** 가 저장된다 — 넷만 적으면 합이 맞지 않는다", () => {
    const block = saveBlock();
    for (const p of [
      "WEB_SEARCH:",
      "OVERSEAS_AUTO:",
      "DOMESTIC_LISTING:",
      "GEMINI:",
      /** 🔴 이 둘이 빠져 있던 때는 후보 합이 관측값과 달랐다. */
      "SELLER_URL:",
      "REVIEWED_SAME:",
    ]) {
      expect(block, `🔴 저장 producers 에 ${p} 가 없다`).toContain(p);
    }
    /** 🔴 「후보가 없었다」와 「만들었는데 버렸다」를 가른다. */
    expect(block, "🔴 weakDropped 가 저장되지 않는다").toContain("weakDropped:");
  });

  it("F-3 🔴🔴 생산자 × 시장 교차가 저장된다 — 국내 후보의 «출처» 가 거기서만 보인다", () => {
    const block = saveBlock();
    expect(block, "🔴 producerMarkets 가 없다").toContain("producerMarkets:");
    const fn = CODE.indexOf("const producerMarketCut");
    expect(fn, "🔴 교차 집계 함수가 없다").toBeGreaterThan(0);
    const body = CODE.slice(fn, CODE.indexOf("};", fn));
    for (const k of ["KR:", "OVERSEAS:", "UNKNOWN_MARKET:"]) {
      expect(body, `🔴 교차 집계에 ${k} 가 없다`).toContain(k);
    }
  });

  /* ── S. 🔴 한 산출을 공유한다(두 벌로 계산하지 않는다) ──────────────────── */

  it("S-1 🔴🔴 저장과 로그가 **같은** 산출을 쓴다 — `cut` 이 하나뿐이다", () => {
    /**
     * 🔴 두 벌로 계산하면 둘이 갈라지고 **어느 쪽이 사실인지** 알 수 없게 된다.
     *    (실제로 `[C06R-funnel]` 로그와 저장값이 따로 계산되던 모양에서 올라왔다.)
     */
    expect(CODE.split("const cut =").length - 1, "🔴 `cut` 정의가 둘 이상이다").toBe(1);
    expect(CODE.split("const PRODUCERS").length - 1, "🔴 `PRODUCERS` 정의가 둘 이상이다").toBe(1);
  });

  it("S-2 🔴 산출이 저장 호출 «앞» 에서 만들어진다 — 뒤에 있으면 저장할 값이 없다", () => {
    const decl = CODE.indexOf("const PRODUCERS");
    const cut = CODE.indexOf("const cut =");
    const save = CODE.indexOf(SAVE_CALL);
    expect(decl, "🔴 PRODUCERS 가 없다").toBeGreaterThan(0);
    expect(decl, "🔴 PRODUCERS 가 저장 호출보다 뒤에 있다").toBeLessThan(save);
    expect(cut, "🔴 cut 이 저장 호출보다 뒤에 있다").toBeLessThan(save);
  });

  it("S-3 🔴 시장 값은 운영 산출을 **그대로** 쓴다 — 하니스가 다시 분류하지 않는다", () => {
    const decl = CODE.indexOf("const cut =");
    const body = CODE.slice(decl, CODE.indexOf("};", decl));
    expect(body, "🔴 market 칸을 읽지 않는다").toContain("e.market ===");
    /** 🔴 이 자리에서 시장을 **다시 계산하면** 운영과 갈라진다. */
    for (const forbidden of ["classifyCandidateMarket", ".kr", "KRW"]) {
      expect(body, `🔴 단계표가 ${forbidden} 로 시장을 다시 만든다`).not.toContain(forbidden);
    }
  });

  /* ── O. 🔴🔴 관측 전용 ─────────────────────────────────────────────────── */

  it("O-1 🔴🔴 저장 payload 는 **숫자만** 담는다 — URL·제목을 싣지 않는다", () => {
    const block = saveBlock();
    for (const banned of ["discoveredUrl", "candidateUrl", "sourceUrl", "e.title", "e.domain"]) {
      expect(block, `🔴 관측값에 ${banned} 가 들어갔다`).not.toContain(banned);
    }
  });

  it("O-2 🔴🔴 산출 계산이 제품 동작을 바꾸지 않는다", () => {
    const from = CODE.indexOf("const PRODUCERS");
    const to = CODE.indexOf(SAVE_CALL);
    const block = CODE.slice(from, to);
    for (const forbidden of [
      "domesticShop =",
      "NextResponse",
      "computeMarketIntelligence",
      "insert",
      "update",
      "upsert",
      "fetch(",
    ]) {
      expect(block, `🔴 계측 산출이 ${forbidden} 를 쓴다 — 읽기 전용이 아니다`).not.toContain(
        forbidden,
      );
    }
  });

  it("O-3 🔴 저장은 fail-soft 다 — 관측 실패가 분석을 죽이지 않는다", () => {
    const at = CODE.indexOf(SAVE_CALL);
    const before = CODE.slice(Math.max(0, at - 400), at);
    expect(before, "🔴 저장 호출이 try 로 감싸여 있지 않다").toContain("try {");
  });

  /* ── B. 🔵 맹점이 «닫혔다» — 단 승인된 범위까지만 ───────────────────────── */

  /**
   * 🔵🔵 **migration 082 가 이 계약을 뒤집었다**(2026-11-06 · CPO 승인 안 ⓒ).
   *
   * 🔴 전까지는 「범위를 늘리지 않았다 — migration 0」이었다. 그 금지의 **이유** 는
   *    079 `source` CHECK 가 국내 둘을 담지 못한 것이었고, 그래서 국내 후보 **행이
   *    버려졌다**(생산은 되고 있었다 — 전수 9건에서 WEB_SEARCH 10 · DOMESTIC_LISTING 3).
   * 🟢 082 가 그 둘을 승인했으므로 이제 **담는 것이 계약** 이다.
   * 🔴 그러나 **승인된 다섯까지** 다 — `reviewedSameEvidence` 는 082 가 승인하지 않았고,
   *    기존 값으로 적으면 그 후보의 **원래 출처를 덮는다**(upsert).
   */
  it("B-1 🟢 `candidate_reviews` 가 승인된 다섯 생산자를 담는다(082 · 그 이상 금지)", () => {
    const seenAt = CODE.indexOf("const seen = [");
    expect(seenAt).toBeGreaterThan(0);
    const seenBlock = CODE.slice(seenAt, CODE.indexOf("];", seenAt));
    for (const k of [
      "overseasAutoEvidence",
      "geminiEvidence",
      "urlCandidateEvidence",
      "webSearchEvidence",
      "domesticListingEvidence",
    ]) {
      expect(seenBlock, `🔴 ${k} 가 빠졌다`).toContain(k);
    }
    expect(seenBlock, "🔴 REVIEWED_SAME 은 082 가 승인하지 않았다").not.toContain("reviewedSameEvidence");
  });

  it("B-2 🔴🔴 전수 census 스크립트가 자기 맹점을 **선언** 한다", () => {
    /**
     * 🔴 이 계약이 없으면 다음 사람이 그 표를 「화면이 받는 것」으로 읽고
     *    **같은 거짓 블로커** 를 다시 만든다(실제로 그렇게 났다).
     */
    const script = readFileSync(
      path.join(
        __dirname,
        "../../../../../../../../packages/database/scripts/mi-screen-readiness.mjs",
      ),
      "utf8",
    );
    expect(script, "🔴 맹점 선언이 없다").toContain("WEB_SEARCH");
    expect(script, "🔴 맹점 선언이 없다").toContain("DOMESTIC_LISTING");
    expect(script, "🔴 searchRun 관측값을 같이 읽지 않는다").toContain("searchRun");
  });
});
