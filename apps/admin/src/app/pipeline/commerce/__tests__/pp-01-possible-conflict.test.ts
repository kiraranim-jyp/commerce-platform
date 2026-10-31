/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import { CANDIDATE_GROUP_LABEL, selectCandidateList, selectMiSameCandidates } from "../mi-same-candidates";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CANDIDATE-POSSIBLE-CONFLICT-01 — PP-01 ~ PP-08 (CPO §8)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 입력은 **실측** 이다 — `ab046-evidence.json` 은 운영 경로가 실제 HTTP 로 낸
 *    `B226AB046` 판정 산출이다(손으로 만든 행이 아니다).
 * 🔴 Identity verdict · threshold · 8축 · 가격 집계 **변경 0**.
 */

const FIXTURE = join(
  __dirname,
  "..",
  "..",
  "..",
  "api",
  "price-history",
  "_lib",
  "__tests__",
  "fixtures",
  "ab046-evidence.json",
);

/** 🟢 실측 산출 → 운영 행. 🔴 칸을 지어내지 않고 이름 그대로 옮긴다. */
function ab046Row(over: Partial<GeminiTransientRow> = {}): GeminiTransientRow {
  const j = JSON.parse(readFileSync(FIXTURE, "utf8")) as {
    candidate: {
      url: string;
      judged: {
        title: string;
        price: { amount: number; currency: string } | null;
        confidence: number;
        matchReasons: string[];
        crossSellerVerdict: string;
        crossSellerConflicts: { conflict: string; detail?: string }[] | string[];
        crossSellerBlockers: unknown[];
        priceStatus: string;
      };
    };
  };
  const c = j.candidate.judged;
  const conflicts = (c.crossSellerConflicts ?? []).map((x) =>
    typeof x === "string" ? x : (x as { conflict: string }).conflict,
  );
  return {
    domain: "bobochoses.com",
    discoveredUrl: j.candidate.url,
    title: c.title,
    market: "OVERSEAS",
    soldOut: null,
    crossSellerVerdict: c.crossSellerVerdict,
    matchTruth: null,
    confidence: c.confidence,
    matchReasons: c.matchReasons,
    crossSellerBlockers: conflicts.length ? [] : [],
    crossSellerConflicts: conflicts,
    priceAmount: c.price?.amount ?? null,
    priceCurrency: c.price?.currency ?? null,
    priceStatus: c.priceStatus,
    source: "WEB_SEARCH",
    ...over,
  } as GeminiTransientRow;
}

const pick = (rows: GeminiTransientRow[], url: string) =>
  selectCandidateList(rows, "OVERSEAS").find((x) => x.row.discoveredUrl === url);

describe("PP — AB046 참고 후보(품번만 충돌)", () => {
  /** 🟢 PP-01 — AB046 이 POSSIBLE 로 표시된다. */
  it("PP-01 AB046 이 POSSIBLE 로 표시된다", () => {
    const row = ab046Row();
    /** 🔴 실측 전제를 먼저 단언한다 — 전제가 바뀌면 이 계약의 의미가 사라진다. */
    expect(row.crossSellerVerdict).toBe("CONFLICT");
    expect(row.crossSellerConflicts).toEqual(["MODEL_CODE"]);
    expect(row.crossSellerBlockers).toEqual([]);
    const hit = pick([row], row.discoveredUrl);
    expect(hit?.group).toBe("POSSIBLE");
    expect(CANDIDATE_GROUP_LABEL[hit!.group]).toBe("🟡 유사상품 · 참고");
  });

  /** 🔴 PP-02 — SAME/PRESUMED 로 **표시되지 않는다**(승격 금지 · CPO §3). */
  it("PP-02 AB046 은 SAME/PRESUMED 로 표시되지 않는다", () => {
    const row = ab046Row();
    const hit = pick([row], row.discoveredUrl);
    expect(hit?.group).not.toBe("LIKELY");
    expect(hit?.group).not.toBe("PRESUMED");
    /** 🔴 Identity verdict 자체도 **보존** 된다 — 화면이 등급을 덮지 않는다. */
    expect(row.crossSellerVerdict).toBe("CONFLICT");
  });

  /** 🔴🔴 PP-03 — 실측 가격 **EUR 35** 가 가격 집계에 들어가지 않는다(CPO §4). */
  it("PP-03 AB046 의 EUR 35 가 가격 집계에 들어가지 않는다", () => {
    const row = ab046Row();
    expect(row.priceAmount).toBe(35);
    expect(row.priceCurrency).toBe("EUR");
    /** 🔴 가격이 **확인된** 값이어도(VERIFIED_CURRENT) 집계에는 못 들어간다. */
    expect(row.priceStatus).toBe("VERIFIED_CURRENT");
    const sel = selectMiSameCandidates([row], "OVERSEAS");
    expect(sel.priced).toHaveLength(0);
    expect(sel.sameButExcluded).toHaveLength(0);
  });

  /** 🔴 PP-04 — **같은 브랜드라는 이유만으로** 다른 CONFLICT 후보가 풀리지 않는다. */
  it("PP-04 브랜드만 같은 CONFLICT 후보는 POSSIBLE 로 풀리지 않는다", () => {
    const bare = ab046Row({
      discoveredUrl: "https://x.com/brand-only",
      /** 🔴 판정 이유가 없다 = 「추가 상품 Evidence」가 없다. */
      matchReasons: [],
    });
    expect(pick([bare], bare.discoveredUrl)).toBeUndefined();
    /** 🔴 제목조차 없으면 더욱 아니다. */
    const noTitle = ab046Row({ discoveredUrl: "https://x.com/no-title", title: null });
    expect(pick([noTitle], noTitle.discoveredUrl)).toBeUndefined();
  });

  /** 🔴 PP-05 — `BRAND_MISMATCH` 후보는 풀리지 않는다(CPO §6). */
  it("PP-05 BRAND_MISMATCH 후보는 POSSIBLE 로 풀리지 않는다", () => {
    for (const blocker of ["BRAND_MISMATCH", "BRAND_UNCONFIRMED", "NO_TITLE_OVERLAP"]) {
      const row = ab046Row({ discoveredUrl: `https://x.com/${blocker}`, crossSellerBlockers: [blocker] });
      expect(pick([row], row.discoveredUrl), `${blocker} 가 풀렸다`).toBeUndefined();
    }
  });

  /** 🔴 PP-06 — **복수 conflict** 후보는 풀리지 않는다(CPO §6). */
  it("PP-06 복수 conflict 후보는 POSSIBLE 로 풀리지 않는다", () => {
    for (const conflicts of [
      ["MODEL_CODE", "COLOR"],
      ["MODEL_CODE", "CATEGORY"],
      ["MODEL_CODE", "COMPOSITION"],
      ["COLOR"],
      ["CATEGORY"],
    ]) {
      const row = ab046Row({ discoveredUrl: `https://x.com/${conflicts.join("-")}`, crossSellerConflicts: conflicts });
      expect(pick([row], row.discoveredUrl), `${conflicts.join("+")} 가 풀렸다`).toBeUndefined();
    }
  });

  /** 🔴 PP-07 — Evidence 없는 `CONFLICT` 는 풀리지 않는다. */
  it("PP-07 Evidence 없는 CONFLICT 는 POSSIBLE 로 풀리지 않는다", () => {
    const row = ab046Row({ discoveredUrl: "https://x.com/no-ev", matchReasons: [], title: null });
    expect(pick([row], row.discoveredUrl)).toBeUndefined();
    /** 🔴 conflict 가 **아예 없는** CONFLICT(matchTruth 경로)도 풀리지 않는다. */
    const truthConflict = ab046Row({
      discoveredUrl: "https://x.com/truth-conflict",
      matchTruth: "CONFLICT",
      crossSellerConflicts: [],
    });
    expect(pick([truthConflict], truthConflict.discoveredUrl)).toBeUndefined();
  });

  /** 🔴 PP-08 — 기존 SAME/PRESUMED/SIMILAR 동작에 회귀가 없다. */
  it("PP-08 기존 세 군의 동작이 그대로다", () => {
    const base = (over: Partial<GeminiTransientRow>): GeminiTransientRow =>
      ({
        domain: "y.com",
        discoveredUrl: `https://y.com/${over.domain ?? Math.abs(JSON.stringify(over).length)}`,
        title: "Booty Ghosts T-shirt",
        market: "OVERSEAS",
        soldOut: false,
        priceStatus: "VERIFIED_CURRENT",
        ...over,
      }) as GeminiTransientRow;
    const same = base({ matchTruth: "EXACT_IDENTIFIER", priceAmount: 37, priceCurrency: "GBP" });
    const presumed = base({ crossSellerVerdict: "PRESUMED_SAME", priceAmount: 58, priceCurrency: "USD" });
    const similar = base({ matchTruth: "SIMILAR", priceAmount: 40, priceCurrency: "EUR" });
    expect(pick([same], same.discoveredUrl)?.group).toBe("LIKELY");
    expect(pick([presumed], presumed.discoveredUrl)?.group).toBe("PRESUMED");
    expect(pick([similar], similar.discoveredUrl)?.group).toBe("POSSIBLE");
    /** 🟢 가격 축도 그대로 — SAME 만 들어간다. */
    expect(selectMiSameCandidates([same, presumed, similar], "OVERSEAS").priced.map((r) => r.discoveredUrl)).toEqual([
      same.discoveredUrl,
    ]);
  });

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴🔵 **PP-10 — 내 변이(Q5)가 찾은 «두 번째» 가격 경로를 잠근다.**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 PP-03 은 `selectMiSameCandidates` 하나만 봤다. 그런데 `buildMarketJudgement`
   *    **도** `transientDisplayTier(row) !== "SAME"` 로 자체 게이트를 갖고 있고,
   *    그 게이트를 풀어 AB046 을 들여보내도 **9/9 가 통과했다**.
   * 🔴 그 함수 산출(`judgement.sellers`)이 `buildPriceGuide` → 「동일상품 확인 가격」·
   *    판매처 수·가격 범위를 만든다 ⟹ CPO §4(「MI price aggregation 불가」)가
   *    **지켜지지 않는 경로가 하나 더 있었다.**
   * 🟢 그래서 가격 축을 **두 owner 모두** 단언한다.
   */
  it("PP-10 AB046 이 판매처 집계(buildMarketJudgement)에도 들어가지 않는다", async () => {
    const { buildMarketJudgement, buildPriceGuide } = await import("../mi-same-candidates");
    const row = ab046Row();
    const j = buildMarketJudgement([row]);
    expect(j.sellers.map((s) => s.row.discoveredUrl)).toEqual([]);
    expect(j.onSaleCount).toBe(0);
    /** 🔴 그러므로 EUR 35 가 어느 시장의 기준가도 만들지 못한다. */
    for (const market of ["KR", "OVERSEAS"] as const) {
      const g = buildPriceGuide(j, market);
      expect(g.pricedCount).toBe(0);
      expect(g.sameCount).toBe(0);
      expect(g.basis).toBe("NONE");
    }
    /** 🟢 그런데 **후보 리스트에는 선다** — 그것이 이 WU 의 요지다. */
    expect(pick([row], row.discoveredUrl)?.group).toBe("POSSIBLE");
  });

  /** 🟢 PP-09 — 화면 배선. 선택기가 갈라도 컴포넌트가 그 말을 그려야 셀러에게 보인다. */
  it("PP-09 화면이 AB046 을 「🟡 유사상품 · 참고」로 그린다", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => {
      root.render(createElement(MarketPriceComparison, { rows: [ab046Row()], snapshotId: "s" }));
    });
    try {
      const rows = Array.from(host.querySelectorAll('[data-testid="mi-candidate-row"]'));
      expect(rows).toHaveLength(1);
      expect(rows[0]!.getAttribute("data-group")).toBe("POSSIBLE");
      expect((rows[0]!.querySelector('[data-testid="mi-candidate-group"]')?.textContent ?? "").trim()).toBe(
        "🟡 유사상품 · 참고",
      );
      /** 🔴 가격 영역(`mi-same-row`)에는 **서지 않는다**. */
      expect(host.querySelector('[data-testid="mi-same-row"]')).toBeNull();
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });
});
