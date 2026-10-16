import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { classifyCandidateMarket, summarizeCandidateOverseasPrices } from "../candidate-market";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-039 — **직접 공급한 SAME 후보가 가격비교에 진입한다** (Registry 무오염)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * WU-038 실측: 입력 5 → MI SAME 4 → 가격 VERIFIED 3 → **가격비교 진입 0**.
 * 원인은 저장 게이트가 아니라 **런타임 전달 누락** 이었다 —
 * `check/route.ts` 가 `geminiEvidence` 만 `computeMarketIntelligence` 에 넘기고
 * WU-024 가 가른 `urlCandidateEvidence` 를 **빠뜨렸다**.
 *
 * 🔴 이 파일이 같이 잠그는 CPO 금지 사항:
 * ```
 * Registry 확대 0 · source_id FK 훼손 0 · DB 쓰기 0 ·
 * 외화 자동 환산 0 · 미검증 가격의 판매판정 투입 0 ·
 * threshold 0 · PRESUMED→SAME 승격 0 · 색상사전 0
 * ```
 */

const repoRoot = (() => {
  let dir = __dirname;
  for (let i = 0; i < 12; i++) {
    if (existsSync(path.join(dir, "packages", "crawler", "package.json"))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error("repo 루트를 찾지 못했다");
})();
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const routeSrc = strip(
  readFileSync(path.join(repoRoot, "apps/admin/src/app/api/price-history/check/route.ts"), "utf8"),
);
const miSrc = strip(
  readFileSync(path.join(repoRoot, "apps/admin/src/app/api/price-history/_lib/market-intelligence.ts"), "utf8"),
);
const runnerSrc = strip(
  readFileSync(
    path.join(repoRoot, "apps/admin/src/app/api/price-history/_lib/run-domestic-price-check.ts"),
    "utf8",
  ),
);

/* ══════════════ A. 🔴 전달 — 두 싱크가 «둘 다» MI 로 간다 ══════════════ */

describe("A. transient 두 싱크가 전부 MI 입력이 된다", () => {
  it("route 가 geminiEvidence «와» urlCandidateEvidence 를 합쳐 넘긴다", () => {
    expect(routeSrc).toContain("domesticShop.geminiEvidence ?? []");
    expect(routeSrc).toContain("domesticShop.urlCandidateEvidence ?? []");
    /** 🔴 대입만 보면 속는다 — **그 값이 실제 인자로 쓰이는지** 를 단언한다. */
    const call = routeSrc.slice(routeSrc.indexOf("computeMarketIntelligence("));
    expect(call.slice(0, call.indexOf(")"))).toContain("transientEvidence");
  });

  /** 🔴 둘 다 없을 때 `[]` 가 아니라 `null` 이어야 한다 — 「후보 0」과 「안 돌았다」는 다르다. */
  it("둘 다 없으면 null 을 넘긴다", () => {
    expect(routeSrc).toContain("domesticShop.geminiEvidence || domesticShop.urlCandidateEvidence");
    expect(routeSrc).toMatch(/:\s*null;/);
  });

  /** 🔴🔴 **응답의 두 배열은 합치지 않는다** — 화면의 출처 구분(WU-028)이 깨진다. */
  it("응답에서는 두 배열이 여전히 갈라져 있다", () => {
    expect(runnerSrc).toContain("geminiEvidence: geminiMetrics === null ? null : geminiEvidence");
    expect(runnerSrc).toContain("urlCandidateEvidence: urlCandidateMetrics === null ? null : urlCandidateEvidence");
  });
});

/* ══════════════ B. 🔴 안전 게이트가 그대로 살아 있다 ══════════════ */

describe("B. 전달해도 정책이 느슨해지지 않는다", () => {
  /** 🔴 미검증 가격은 국내 축에 못 들어간다 — `priceKrw` 자체가 안 채워진다. */
  it("priceKrw 는 VERIFIED_CURRENT && KRW 일 때만 채워진다", () => {
    expect(runnerSrc).toContain('best.priceStatus === "VERIFIED_CURRENT" && best.price?.currency === "KRW"');
  });

  /** 🔴 국내 축 자격은 **둘** 이다 — KRW 금액 «그리고» market === "KR". */
  it("MI 국내 축은 market KR 과 priceKrw 를 둘 다 요구한다", () => {
    expect(miSrc).toContain('e.market !== "KR"');
    expect(miSrc).toContain("e.priceKrw == null");
  });

  /** 🔴 환산 금지 — 해외 축은 통화별로만 모인다(WU-020 §2). */
  it("해외 축은 환산하지 않고 통화별로 모은다", () => {
    const out = summarizeCandidateOverseasPrices([
      /** 🔴 칸을 또 추측했다 — 타입은 `market · currency · amount · priceTier` 넷뿐이다. */
      { market: "OVERSEAS", currency: "EUR", amount: 40, priceTier: "EXACT" },
      { market: "OVERSEAS", currency: "USD", amount: 58, priceTier: "EXACT" },
      { market: "OVERSEAS", currency: "EUR", amount: 75, priceTier: "EXACT" },
    ]);
    const json = JSON.stringify(out);
    expect(json).toContain("EUR");
    expect(json).toContain("USD");
    /** 🔴 합계 KRW 같은 «환산된» 칸이 생기면 안 된다. */
    expect(json).not.toMatch(/KRW/);
    expect(json).not.toMatch(/exchangeRate|convertedTo/i);
  });

  /** 🔴 등록부 소속은 시장 증거가 아니다 — 통화가 충돌하면 UNKNOWN(WU-020). */
  it("등록부 샵이라도 통화가 외화면 KR 로 단정하지 않는다", () => {
    /** 🔴 시그니처를 추측했다가 걸렸다 — `url` 이 아니라 `domain` 이다(타입에서 읽었다). */
    const m = classifyCandidateMarket({
      domain: "bobochoses.com",
      currency: "EUR",
      isRegisteredDomesticShop: true,
    });
    expect(m.market).toBe("UNKNOWN");
    expect(m.basis).toBe("CONFLICT_REGISTERED_SHOP_WITH_FOREIGN_CURRENCY");
  });
});

/* ══════════════ C. 🔴🔴 저장은 여전히 0 — Registry 를 건드리지 않는다 ══════════════ */

describe("C. Registry 무오염", () => {
  it("transient 는 여전히 upsert 앞에서 끊긴다", () => {
    expect(runnerSrc).toContain("if (isTransientShopId(shopId)) return;");
  });

  it("route 가 DB 쓰기를 추가하지 않는다", () => {
    expect(routeSrc).not.toMatch(/upsertDomesticProductLink|insertPriceObservation|source_id/);
  });

  /** 🔴 MI 가 만드는 transient 레코드는 메모리 전용 id 다(DB 행이 아니다). */
  it("MI 의 transient 레코드는 메모리 id 를 쓴다", () => {
    expect(miSrc).toContain("`gemini-transient:${e.domain}:${e.discoveredUrl}`");
  });
});
