/** @vitest-environment jsdom */
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import {
  CANDIDATE_GROUP_LABEL,
  selectCandidateList,
  selectMiSameCandidates,
  type CandidateListGroup,
} from "../mi-same-candidates";
import { MAX_SUPPLIED_CANDIDATE_URLS } from "../../../api/price-history/_lib/run-domestic-price-check";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CANDIDATE-CAP-AND-LABEL-01 — **상한 20 · 배지 셋**(CPO 판정 2026-10-31)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 가 고정한 것 **둘** 이고 그 둘만 바꿨다:
 * ```
 * ① MAX_SUPPLIED_CANDIDATE_URLS   10 → 20
 * ② 배지   SAME            → 🟢 동일상품 가능성 높음
 *          PRESUMED_SAME   → 🟡 동일상품 추정
 *          SIMILAR+Evidence→ 🟡 유사상품 · 참고
 *          DIFFERENT/CONFLICT → 표시 제외
 * ```
 * 🔴 **바뀌지 않은 것** — Identity threshold · 8축 · `matchTruth` · `priceTier` ·
 *    가격 집계(`selectMiSameCandidates`) · `SIMILAR` 표시 정책 · Search/Query/Apify/
 *    Registry/adapter. 🔴 그리고 **후보를 줄이지 않았다**(Recall 유지).
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

const groupOf = (row: GeminiTransientRow): CandidateListGroup | undefined =>
  selectCandidateList([row], "OVERSEAS")[0]?.group;

function mountLabels(rows: GeminiTransientRow[]): { labels: string[]; groups: string[]; cleanup: () => void } {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(createElement(MarketPriceComparison, { rows, snapshotId: "s" }));
  });
  const labels = Array.from(host.querySelectorAll('[data-testid="mi-candidate-group"]')).map((n) =>
    (n.textContent ?? "").trim(),
  );
  const groups = Array.from(host.querySelectorAll('[data-testid="mi-candidate-row"]')).map(
    (n) => n.getAttribute("data-group") ?? "",
  );
  return {
    labels,
    groups,
    cleanup: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}

describe("CCL-01 ① 공급 상한", () => {
  /**
   * 🔴🔴 **CCL-01-A — 상한은 20 이다.**
   *    🔴 「10 보다 크다」로 느슨하게 쓰지 않는다 — CPO 가 **20 을 지정** 했고
   *       무제한이 아니라는 것이 결정의 절반이다.
   */
  it("CCL-01-A 공급 상한이 20 이다(무제한이 아니다)", () => {
    expect(MAX_SUPPLIED_CANDIDATE_URLS).toBe(20);
  });

  /**
   * 🔴 **CCL-01-B — 실측 공급량(19)을 전부 통과시킨다.**
   *    그 19 는 CORE-E2E-CANDIDATE-02 의 S1(B226AC010) 공급량이고, 상한 10 에서
   *    **9건이 열리지도 않았다**(그 안에 human SAME 4건).
   */
  it("CCL-01-B 실측 S1 공급 19 가 상한에 잘리지 않는다", () => {
    const S1_SUPPLIED = 19;
    expect(MAX_SUPPLIED_CANDIDATE_URLS).toBeGreaterThanOrEqual(S1_SUPPLIED);
    expect(Math.max(0, S1_SUPPLIED - MAX_SUPPLIED_CANDIDATE_URLS)).toBe(0);
  });
});

describe("CCL-01 ② 배지 — verdict 별로 «다른 말»", () => {
  /** 🟢 CCL-01-C — 군 셋이 **서로 다른 글자** 를 쓴다. */
  it("CCL-01-C 세 군의 문구가 서로 다르다", () => {
    const vals = Object.values(CANDIDATE_GROUP_LABEL);
    expect(vals).toHaveLength(3);
    expect(new Set(vals).size, "두 군이 같은 말을 쓴다 — 셀러가 확정도를 구별할 수 없다").toBe(3);
  });

  /**
   * 🔴🔴 **CCL-01-D — CPO 가 고정한 글자 그대로.**
   *    🔴 상수를 import 해 비교하면 **동어반복** 이다(그 상수를 바꾸면 기대값도 바뀐다)
   *       ⟹ 글자를 **직접** 적는다(이 트랙이 그 함정을 두 번 밟았다).
   */
  it("CCL-01-D 문구가 CPO 가 고정한 글자다", () => {
    expect(CANDIDATE_GROUP_LABEL.LIKELY).toBe("🟢 동일상품 가능성 높음");
    expect(CANDIDATE_GROUP_LABEL.PRESUMED).toBe("🟡 동일상품 추정");
    expect(CANDIDATE_GROUP_LABEL.POSSIBLE).toBe("🟡 유사상품 · 참고");
  });

  /**
   * 🔴🔴🔵 **CCL-01-E — 이 WU 가 고친 그 모양.**
   *    `PRESUMED_SAME` 이 `SAME` 과 **같은 말을 쓰지 않는다.**
   */
  it("CCL-01-E SAME 과 PRESUMED_SAME 이 다른 군 · 다른 말이다", () => {
    const same = r({ domain: "a.com", matchTruth: "EXACT_IDENTIFIER" });
    const presumed = r({ domain: "b.com", crossSellerVerdict: "PRESUMED_SAME" });
    expect(groupOf(same)).toBe("LIKELY");
    expect(groupOf(presumed)).toBe("PRESUMED");
    expect(CANDIDATE_GROUP_LABEL[groupOf(same)!]).not.toBe(CANDIDATE_GROUP_LABEL[groupOf(presumed)!]);
    /** 🔴 그리고 **둘 다 리스트에 선다** — 말만 갈랐고 후보를 줄이지 않았다. */
    expect(selectCandidateList([same, presumed], "OVERSEAS")).toHaveLength(2);
  });

  /** 🟡 CCL-01-F — `SIMILAR` 은 「동일상품」이라는 말을 **쓰지 않는다**. */
  it("CCL-01-F 유사 군 문구에 「동일상품」이 없다", () => {
    expect(CANDIDATE_GROUP_LABEL.POSSIBLE).not.toContain("동일상품");
    expect(groupOf(r({ domain: "d.com", matchTruth: "SIMILAR" }))).toBe("POSSIBLE");
  });

  /** 🔴 CCL-01-G — 제외 집합은 **그대로** 다(이 WU 가 넓히지도 좁히지도 않았다). */
  it("CCL-01-G CONFLICT · 판정없음 · Evidence 없는 후보는 여전히 제외", () => {
    expect(groupOf(r({ domain: "e.com", crossSellerVerdict: "CONFLICT" }))).toBeUndefined();
    expect(groupOf(r({ domain: "f.com", matchTruth: "CONFLICT" }))).toBeUndefined();
    expect(groupOf(r({ domain: "g.com", matchTruth: null, crossSellerVerdict: null }))).toBeUndefined();
    expect(
      groupOf(r({ domain: "h.com", crossSellerVerdict: "SIMILAR", matchTruth: null, title: undefined })),
    ).toBeUndefined();
  });
});

describe("CCL-01 ③ 화면 — 마운트 DOM", () => {
  /**
   * 🔴🔴 **CCL-01-H — 배선 축.** 선택기가 군을 갈라도 컴포넌트가 **그 말을 그리지
   *    않으면** 셀러에게는 아무것도 바뀌지 않는다(WU-110 교훈).
   */
  it("CCL-01-H 화면이 세 군의 말을 각각 그린다", () => {
    const rows = [
      r({ domain: "a.com", matchTruth: "EXACT_IDENTIFIER", priceAmount: 37, priceCurrency: "GBP" }),
      r({ domain: "b.com", crossSellerVerdict: "PRESUMED_SAME", priceAmount: 58, priceCurrency: "USD" }),
      r({ domain: "d.com", matchTruth: "SIMILAR", priceAmount: 40, priceCurrency: "EUR" }),
    ];
    const { labels, groups, cleanup } = mountLabels(rows);
    try {
      expect(groups).toEqual(["LIKELY", "PRESUMED", "POSSIBLE"]);
      expect(labels).toEqual(["🟢 동일상품 가능성 높음", "🟡 동일상품 추정", "🟡 유사상품 · 참고"]);
      /** 🔴 세 줄이 **서로 다른 말** 이어야 한다(화면에서도). */
      expect(new Set(labels).size).toBe(3);
    } finally {
      cleanup();
    }
  });

  /**
   * 🔴🔴🔴 **CCL-01-I — `PRICE ⊆ DISPLAY` 가 군 분리 «뒤에도» 유지된다.**
   *    🔴 군을 셋으로 쪼개면서 어느 한 군을 리스트에서 빠뜨리면 가격 후보가
   *       사라진다 — CEO 모순의 재발이다.
   */
  it("CCL-01-I 가격 후보가 군 분리 뒤에도 리스트에 남는다", () => {
    const rows = [
      r({ domain: "a.com", matchTruth: "EXACT_IDENTIFIER", priceAmount: 37, priceCurrency: "GBP" }),
      r({ domain: "b.com", crossSellerVerdict: "PRESUMED_SAME", priceAmount: 58, priceCurrency: "USD" }),
      r({ domain: "d.com", matchTruth: "SIMILAR", priceAmount: 40, priceCurrency: "EUR" }),
      r({ domain: "g.com", market: "KR", matchTruth: "EXACT_IDENTIFIER", priceAmount: 88000, priceCurrency: "KRW" }),
    ];
    let checked = 0;
    for (const market of ["KR", "OVERSEAS"] as const) {
      const shown = new Set(selectCandidateList(rows, market).map((x) => x.row.discoveredUrl));
      for (const p of selectMiSameCandidates(rows, market).priced) {
        checked += 1;
        expect(shown.has(p.discoveredUrl), `🔴 PRICE ⊄ DISPLAY — ${p.domain}`).toBe(true);
      }
    }
    expect(checked, "가격 후보가 0 — 공집합 통과다").toBeGreaterThan(0);
  });

  /**
   * 🔴 **CCL-01-J — 가격 집계 정책은 «변경 0» 이다.**
   *    군이 셋이 됐어도 `priced` 에는 **`SAME` 만** 들어간다.
   */
  it("CCL-01-J 추정·유사는 가격 집계에 들어가지 않는다", () => {
    const presumed = r({ domain: "b.com", crossSellerVerdict: "PRESUMED_SAME", priceAmount: 58, priceCurrency: "USD" });
    const similar = r({ domain: "d.com", matchTruth: "SIMILAR", priceAmount: 40, priceCurrency: "EUR" });
    expect(selectMiSameCandidates([presumed, similar], "OVERSEAS").priced).toHaveLength(0);
    /** 🟢 그런데 **화면에는 둘 다 선다** — 그것이 이 설계의 요지다. */
    expect(selectCandidateList([presumed, similar], "OVERSEAS")).toHaveLength(2);
  });
});
