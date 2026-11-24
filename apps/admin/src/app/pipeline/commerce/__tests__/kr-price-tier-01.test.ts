import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isCeoConfirmedSame,
  isConfirmedSameForPrice,
  isPresumedSameForPrice,
  passesPriceEligibility,
  buildMarketJudgement,
  buildPriceGuide,
  presumedPriceLine,
  transientDisplayTier,
} from "../mi-same-candidates";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-KR-PRICE-TIER-01 — **CEO 확정 SAME 이 가격 화면까지 간다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 고친 결함 — CEO 확정은 **가격 «자격»**(`priceTier = EXACT`)까지만 연결돼 있었고
 *    화면 분류 게이트는 `matchTruth` 만 봐서, `TEXT_CONFIRMED` 인 CEO 확정 후보가
 *    **형성대에서 탈락** 했다.
 * 🔴 이 파일은 **완화를 막는 쪽** 으로도 잠근다 — 추정은 **추정 그룹에만** 선다.
 */
const FIX = join(__dirname, "..", "..", "..", "api", "price-history", "_lib", "__tests__", "fixtures");

const row = (o: Partial<GeminiTransientRow>): GeminiTransientRow =>
  ({
    domain: "x.example",
    discoveredUrl: "https://x.example/p/1",
    priceAmount: 10_000,
    priceCurrency: "KRW",
    priceStatus: "VERIFIED_CURRENT",
    priceTier: "COMPARISON",
    matchTruth: "TEXT_CONFIRMED",
    market: "KR",
    ...o,
  }) as GeminiTransientRow;

describe("MI-KR-PRICE-TIER-01", () => {
  it("A-1 🔵🔵 **CEO 확정 SAME 이 시스템 PRESUMED_SAME 을 이긴다**(1순위)", () => {
    const r = row({ ceoConfirmedSame: true });
    /** 🔴 시스템 판정은 **그대로** PRESUMED_SAME 이다 — 승격하지 않았다. */
    expect(transientDisplayTier(r)).toBe("PRESUMED_SAME");
    expect(isCeoConfirmedSame(r)).toBe(true);
    expect(isConfirmedSameForPrice(r), "🔴🔴 CEO 확정이 확정 형성대에 못 들어간다").toBe(true);
    /** 🔴 **중복 금지** — 추정 그룹에는 오지 않는다. */
    expect(isPresumedSameForPrice(r), "🔴🔴 CEO 확정이 추정 그룹에 중복 집계된다").toBe(false);
  });

  it("A-2 🔴 **`priceTier === EXACT` 나 `verified` 로 CEO 확정을 추정하지 않는다**", () => {
    /** 🔴 관리자 승인(`verified`)이 CEO 확정으로 읽히면 안 된다(헌장 명시). */
    const admin = row({ priceTier: "EXACT", matchTruth: null, ceoConfirmedSame: false });
    expect(isCeoConfirmedSame(admin), "🔴🔴 관리자 승인을 CEO 확정으로 읽었다").toBe(false);
    const SRC = readFileSync(join(__dirname, "..", "mi-same-candidates.ts"), "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      " ",
    );
    const fn = SRC.slice(SRC.indexOf("export function isCeoConfirmedSame"));
    const fnBody = fn.slice(0, fn.indexOf("}"));
    expect(fnBody, "🔴 priceTier 로 추정한다").not.toContain("priceTier");
    expect(fnBody, "🔴 verified 로 추정한다").not.toContain("verified");
  });

  it("A-3 🟢 CEO 확정이 없는 **시스템 SAME 은 기존대로** 확정이다", () => {
    const r = row({ matchTruth: "STRONG_IDENTIFIER", priceTier: "EXACT" });
    expect(transientDisplayTier(r)).toBe("SAME");
    expect(isConfirmedSameForPrice(r)).toBe(true);
    expect(isPresumedSameForPrice(r)).toBe(false);
  });

  it("A-4 🟢 CEO 확정이 없는 **PRESUMED_SAME 은 추정 그룹** 이다", () => {
    const r = row({});
    expect(isConfirmedSameForPrice(r)).toBe(false);
    expect(isPresumedSameForPrice(r)).toBe(true);
  });

  it("A-5 🔴 **DIFFERENT / UNKNOWN 과 자격 미통과는 제외** 된다", () => {
    for (const mt of ["CONFLICT", "INSUFFICIENT_EVIDENCE", null]) {
      const r = row({ matchTruth: mt as string | null, crossSellerVerdict: null });
      expect(isConfirmedSameForPrice(r), `🔴 ${mt} 가 확정에 들어갔다`).toBe(false);
      expect(isPresumedSameForPrice(r), `🔴 ${mt} 가 추정에 들어갔다`).toBe(false);
    }
    /** §5.2 다섯 조건을 **하나씩** 깨뜨린다 — 전부 탈락해야 한다. */
    const breaks: Partial<GeminiTransientRow>[] = [
      { priceTier: "EXCLUDED" },
      { priceAmount: null },
      { priceAmount: 0 },
      { priceCurrency: null },
      { priceStatus: "UNVERIFIED_SEARCH" },
      { crossSellerBlockers: ["BRAND_MISMATCH"] },
      { crossSellerConflicts: ["NO_TITLE_OVERLAP"] },
      { crossSellerBlockers: ["SAME_SELLER_DISTINCT_LISTING"] },
    ];
    for (const b of breaks) {
      const r = row(b);
      expect(passesPriceEligibility(r), `🔴 자격 미통과가 통과했다: ${JSON.stringify(b)}`).toBe(false);
      expect(isPresumedSameForPrice(r), `🔴 자격 미통과가 추정에 들어갔다: ${JSON.stringify(b)}`).toBe(
        false,
      );
    }
  });

  it("B-1 🔵🔵 **두 형성대가 배타이고 합산되지 않는다**", () => {
    const rows = [
      row({ discoveredUrl: "https://a/1", ceoConfirmedSame: true, priceAmount: 50_000 }),
      row({ discoveredUrl: "https://b/2", priceAmount: 70_000 }),
      row({ discoveredUrl: "https://c/3", matchTruth: "STRONG_IDENTIFIER", priceAmount: 60_000 }),
    ];
    const confirmed = buildPriceGuide(buildMarketJudgement(rows), "KR");
    const presumed = buildPriceGuide(buildMarketJudgement(rows, isPresumedSameForPrice), "KR");
    /** 🔴 같은 후보가 두 집계에 **동시에** 들어가지 않는다(합 == 전체). */
    expect(confirmed.sameCount + presumed.sameCount, "🔴🔴 중복 또는 누락이 있다").toBe(3);
    expect(presumed.sameCount, "🔴 추정 그룹 수가 틀렸다").toBe(1);
    /** 🔴 **합치지 않는다** — 추정 줄이 「추정」을 글자로 말한다. */
    expect(presumedPriceLine(presumed)).toContain("추정");
  });

  it("B-2 🔴 근거가 없으면 **추정 줄을 만들지 않는다**", () => {
    const empty = buildPriceGuide(buildMarketJudgement([], isPresumedSameForPrice), "KR");
    expect(presumedPriceLine(empty)).toBeNull();
  });

  it("C-1 🔵🔵 **국내 41건 실측** — 확정 / 추정 / 제외가 설명된다", () => {
    const base = JSON.parse(readFileSync(join(FIX, "mmse01-baseline.json"), "utf8")) as {
      rows: Record<string, unknown>[];
    };
    const kr = base.rows.filter((r) => r.snapshot_id != null && r.market === "KR");
    expect(kr, "🔴 국내 분모가 41 이 아니다").toHaveLength(41);
    const asRow = (r: Record<string, unknown>): GeminiTransientRow =>
      ({
        domain: String(r.candidate_domain ?? ""),
        discoveredUrl: String(r.candidate_url),
        title: r.candidate_title as string | null,
        /**
         * 🔴🔴 **운영 매퍼와 «같게» 변환한다** — fixture 는 DB numeric 을 **문자열**
         *    로 들고 있고(`"88000"`) 운영 owner `candidateReviewRowFromDb` 가
         *    `Number(...)` 로 바꾼다. 🔴 그 변환을 빼먹으면 자격이 **전건 탈락** 해
         *    「국내 가격대가 설 수 없다」는 **거짓 결론** 이 난다(1차에 실제로 났다).
         */
        priceAmount: r.price_amount == null ? null : Number(r.price_amount),
        priceCurrency: r.price_currency as string | null,
        priceStatus: r.price_status as string | null,
        priceTier: r.price_tier as string | null,
        matchTruth: r.match_truth as string | null,
        crossSellerVerdict: r.system_verdict as string | null,
        crossSellerConflicts: Array.isArray(r.blockers) ? (r.blockers as string[]) : [],
        market: "KR",
        /** 🔵 **DB 사실 그대로** — `human_verdict === "SAME"` 만 CEO 확정이다. */
        ceoConfirmedSame: r.human_verdict === "SAME",
      }) as GeminiTransientRow;
    const rows = kr.map(asRow);
    const ceo = rows.filter(isCeoConfirmedSame).length;
    const confirmed = rows.filter(isConfirmedSameForPrice).length;
    const presumed = rows.filter(isPresumedSameForPrice).length;
    const eligible = rows.filter(passesPriceEligibility).length;
    const g = buildPriceGuide(buildMarketJudgement(rows, isPresumedSameForPrice), "KR");
    /* eslint-disable no-console */
    console.log(
      `\nKR41 | CEO확정 ${ceo} | 확정형성대 ${confirmed} | 추정형성대 ${presumed} | ` +
        `자격통과 ${eligible} | 제외 ${41 - confirmed - presumed}`,
    );
    console.log(`KR추정줄 | ${presumedPriceLine(g)}`);
    /* eslint-enable no-console */
    /** 🔴 **분모 부재를 0% 로 적지 않는다** — 국내에는 CEO 확정이 아직 **없다**(실측). */
    expect(ceo, "🔴 국내 CEO 확정 건수가 바뀌었다 — 보고 수치의 전제다").toBe(0);
    /**
     * 🟢 **자격 통과분은 «어느 한쪽에» 들어간다**(사라지지 않는다).
     * 🔴 「확정 형성대」는 자격과 **독립** 이다(판정 축) ⟹ 자격 통과분만으로 합을 본다.
     */
    const eligibleConfirmed = rows.filter((r) => passesPriceEligibility(r) && isConfirmedSameForPrice(r))
      .length;
    expect(eligibleConfirmed + presumed, "🔴🔴 자격 통과분이 형성대에서 사라졌다").toBe(eligible);
    expect(eligible, "🔴 자격 통과 수가 바뀌었다").toBe(35);
    /** 🔴 중복 0. */
    expect(rows.filter((r) => isConfirmedSameForPrice(r) && isPresumedSameForPrice(r))).toHaveLength(0);
    /** 🟢 국내 추정 형성대가 **실제 KRW 로** 선다. */
    expect(presumedPriceLine(g), "🔴 국내 추정 형성대가 서지 않는다").toContain("KRW");

    /**
     * 🔴🔴🔴 **분모를 정직하게 적는다 — 「35건」을 「35곳」으로 읽으면 거짓이다.**
     *
     * 🟢 실측 — 자격 통과 **35행** 의 **고유 URL 은 4개** 다(같은 판매처가 34개 원상품에
     *    걸쳐 반복된다). 그리고 **원상품 단위** 로 보면 자격 후보가
     *    **1곳인 원상품 33 · 2곳인 원상품 1** 이다.
     * ⟹ 🔴 「국내 **가격대**(2곳 이상)」가 성립하는 원상품은 **1개** 다. 나머지 33개는
     *    기존 규칙대로 **SINGLE**(「가격대 확정 불가」)로 표시된다 — 그것이 **정상** 이다.
     * 🔴 이 수치가 바뀌면 FAIL 해야 한다 — 보고서의 「국내 가격대」 주장이 이 분모 위에 있다.
     */
    const bySnapshot = new Map<string, Set<string>>();
    for (const r of kr) {
      if (!passesPriceEligibility(asRow(r))) continue;
      const k = String(r.snapshot_id);
      if (!bySnapshot.has(k)) bySnapshot.set(k, new Set());
      bySnapshot.get(k)!.add(String(r.candidate_url));
    }
    const uniqueUrls = new Set(
      kr.filter((r) => passesPriceEligibility(asRow(r))).map((r) => String(r.candidate_url)),
    );
    const bandable = [...bySnapshot.values()].filter((s) => s.size >= 2).length;
    /* eslint-disable no-console */
    console.log(
      `KR분모 | 자격행 ${eligible} | 고유URL ${uniqueUrls.size} | 원상품 ${bySnapshot.size} | ` +
        `가격대가능(2곳+) ${bandable}`,
    );
    /* eslint-enable no-console */
    expect(uniqueUrls.size, "🔴 고유 URL 수가 바뀌었다 — 「35곳」으로 읽히면 안 된다").toBe(4);
    expect(bySnapshot.size, "🔴 자격 후보를 가진 원상품 수가 바뀌었다").toBe(34);
    expect(bandable, "🔴 가격대(2곳 이상) 가능한 원상품 수가 바뀌었다").toBe(1);
  });

  it("D-1 🔴 **해외 축 · recommendedPrice · MI 집계 입력은 건드리지 않았다**", () => {
    const strip = (f: string) =>
      readFileSync(f, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/^\s*\/\/.*$/gm, "");
    const ROUTE = strip(join(__dirname, "..", "..", "..", "api", "price-history", "check", "route.ts"));
    /** 🔴 MI 집계 입력 조립부에 이번 술어가 **하나도** 없다. */
    const miStart = ROUTE.indexOf("const transientEvidence =");
    expect(miStart, "🔴 MI 입력 조립부가 사라졌다 — 이 단언의 전제가 깨졌다").toBeGreaterThan(0);
    const miEnd = ROUTE.indexOf(["compute", "MarketIntelligence("].join(""), miStart);
    const miBlock = ROUTE.slice(miStart, miEnd);
    for (const token of ["ceoConfirmedSame", "isPresumedSameForPrice", "presumedGuide"]) {
      expect(miBlock, `🔴🔴 MI 집계 입력에 ${token} 가 들어갔다`).not.toContain(token);
    }
    /** 🔴 `recommendedPrice` 를 이 트랙에서 계산하지 않는다. */
    const MI = strip(join(__dirname, "..", "mi-same-candidates.ts"));
    expect(MI, "🔴 recommendedPrice 를 이 파일에서 계산한다").not.toContain("recommendedPrice =");
  });

  it("D-2 🔵 **공급원이 둘이고 둘 다 기존 술어를 재사용한다**(새 질의 0)", () => {
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, "");
    const RUNNER = strip(
      readFileSync(
        join(__dirname, "..", "..", "..", "api", "price-history", "_lib", "run-domestic-price-check.ts"),
        "utf8",
      ),
    );
    /** 🟢 라이브 — `verifiedSameUrlKeys` + `reviewKey`(= 가격 자격과 **같은 술어**). */
    expect(RUNNER).toContain("ceoConfirmedSame:");
    expect(RUNNER).toContain("input.verifiedSameUrlKeys.includes(reviewKey(best.url))");
    /** 🟢 저장분 — DB `human_verdict === "SAME"` 직접. 🔴 다른 판단은 쓰지 않는다. */
    const SAVED = strip(
      readFileSync(
        join(__dirname, "..", "..", "..", "api", "price-history", "_lib", "saved-candidate-rows.ts"),
        "utf8",
      ),
    );
    expect(SAVED).toContain('ceoConfirmedSame: r.humanVerdict === "SAME"');
    expect(SAVED, "🔴 DIFFERENT/SIMILAR 를 재사용했다").not.toContain('humanVerdict === "DIFFERENT"');
  });
});
