// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TransientCandidateSections } from "../DomesticPriceIntelligencePanel";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 QUERY-ARCH-01 §19 — **Production 이 실제로 낸 행이 화면에 서는가**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO: 「API 에 값이 있다는 것만으로 PASS 처리하지 않는다. Mounted DOM 에서 실제
 *       candidate row 를 확인한다.」
 *
 * 🟢 입력이 **손으로 만든 fixture 가 아니다** — §17 에서 Production 이 돌려준
 *    `query-arch-01-production.json` 의 **그 행들** 이다.
 *
 * ── 🔴 이 파일이 «하지 못한» 것 ───────────────────────────────────────────
 * ```
 * ⒜ 1회용 라우트의 응답은 **투영(projection)** 이라 `title`/`imageUrl` 을 싣지 않았다.
 *    ⟹ 아래 fixture 에서 그 둘은 **null** 이고, 그것은 **하니스 한계** 이지
 *       「Production 이 비워 보냈다」가 **아니다**. 그래서 그 둘을 단언하지 않는다.
 * ⒝ 🔴 **실제 Production 화면은 CTO 가 볼 수 없다**(로그인 뒤) — 여기까지가
 *    마운트 DOM 이고, 마지막 한 칸은 **CEO 확인 1회** 다.
 * ```
 */

const PROD = JSON.parse(
  readFileSync(
    join(__dirname, "../../../api/price-history/_lib/__tests__/fixtures/query-arch-01-production.json"),
    "utf8",
  ),
) as {
  runs: {
    label: string;
    rows: {
      source: string;
      domain: string;
      market: string;
      tier: string | null;
      verdict: string | null;
      price: number | null;
      currency: string | null;
      priceKrw: number | null;
      priceStatus: string | null;
      url: string;
    }[];
  }[];
};

/** 🔴 Production 투영 → 컴포넌트 입력. **없는 칸은 null 로 둔다**(지어내지 않는다). */
function toEvidence(r: (typeof PROD)["runs"][number]["rows"][number]) {
  return {
    source: r.source,
    domain: r.domain,
    title: null,
    imageUrl: null,
    soldOut: null,
    discoveredUrl: r.url,
    matchTruth: null,
    verified: false,
    priceTier: r.tier,
    matchType: null,
    crossSellerVerdict: r.verdict,
    confidence: null,
    matchReasons: [],
    crossSellerBlockers: [],
    crossSellerConflicts: [],
    priceAmount: r.price,
    priceCurrency: r.currency,
    priceKrw: r.priceKrw,
    priceStatus: r.priceStatus,
    market: r.market,
    basis: null,
  } as never;
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function mountRun(label: string) {
  const run = PROD.runs.find((r) => r.label === label);
  if (!run) throw new Error(`run 없음: ${label}`);
  const byProducer = (s: string) => run.rows.filter((r) => r.source === s).map(toEvidence);
  act(() => {
    root.render(
      createElement(TransientCandidateSections, {
        supplied: byProducer("SELLER_URL"),
        gemini: byProducer("GEMINI_DISCOVERY"),
        overseasAuto: byProducer("OVERSEAS_AUTO"),
        reviewedSame: byProducer("REVIEWED_SAME"),
        domesticListing: byProducer("DOMESTIC_LISTING"),
        webSearch: byProducer("WEB_SEARCH"),
        checkRan: true,
      } as never),
    );
  });
  return run;
}

describe("QUERY-ARCH-01 §19 — Production 행이 마운트 DOM 에 선다", () => {
  it("🟢 분모 — Production 10건이 그대로 들어 있다(손으로 만들지 않았다)", () => {
    expect(PROD.runs).toHaveLength(10);
    const total = PROD.runs.reduce((a, r) => a + r.rows.length, 0);
    expect(total, "Production 행 수가 바뀌었다").toBe(31);
  });

  /**
   * 🔴 이 상품이 이번 측정의 핵심이다 — **AI Search(WEB_SEARCH)가 국내 후보를 냈다**
   *    (`miniboutique.co.kr` · KR · KRW 117,000). 그 행이 화면에 서야 한다.
   */
  it("🔴🔴 Main Story — **AI 검색이 낸 국내 후보** 가 화면에 보인다", () => {
    mountRun("Main Story");
    const text = host.textContent ?? "";
    expect(text).toContain("miniboutique.co.kr");
    expect(text, "🇰🇷 구역이 서지 않았다").toContain("🇰🇷");
    /** 🔴 출처가 보존돼야 한다 — 셀러가 「내가 넣었나?」로 읽으면 안 된다. */
    expect(text).toContain("AI 검색");
    expect(text).toContain("국내 목록 탐색");
  });

  it("🟢 Bobo Choses — 해외 SAME 과 국내 후보가 **같이** 선다", () => {
    mountRun("Bobo Choses");
    const text = host.textContent ?? "";
    for (const d of ["junioredition.com", "tinyapple.net", "bobochoses.com", "donokids.com"]) {
      expect(text, `후보가 화면에서 사라졌다: ${d}`).toContain(d);
    }
  });

  /**
   * 🔴 **행이 조용히 사라지지 않는다** — Production 이 낸 도메인 전부가 DOM 에 있어야
   *    한다. 「API 엔 있는데 화면엔 없다」(CPO §13-C)가 바로 이 자리다.
   */
  it("🔴🔴 Production 이 낸 행이 **한 건도 사라지지 않는다**(10 상품 전수)", () => {
    const missing: string[] = [];
    for (const run of PROD.runs) {
      if (run.rows.length === 0) continue;
      act(() => root.unmount());
      host.remove();
      host = document.createElement("div");
      document.body.appendChild(host);
      root = createRoot(host);
      mountRun(run.label);
      const text = host.textContent ?? "";
      for (const r of run.rows) if (!text.includes(r.domain)) missing.push(`${run.label}/${r.domain}`);
    }
    expect(missing, `화면에서 사라진 후보: ${missing.join(", ")}`).toEqual([]);
  });

  /** 🔴 후보가 0 인 상품은 「못 찾았다」를 말해야 한다 — 빈 화면이 아니다. */
  it("🔴 후보 0 인 상품은 **빈 화면이 아니라 문장** 을 낸다", () => {
    mountRun("Fall Cericho T-Shirt");
    expect((host.textContent ?? "").trim().length, "아무것도 그리지 않았다").toBeGreaterThan(0);
  });
});
