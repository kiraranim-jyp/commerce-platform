/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
/**
 * 🔴 `selectCandidateList` 를 **쓰지 않는다** — 기대값을 그 함수로 세우면 그것을
 *    좁히는 변이가 기대값도 같이 좁혀 통과한다(M2 가 실제로 그렇게 통과했다).
 *    🟢 리스트 기대값은 **실측에 얼어 있는 `display` 칸** 이다.
 */
import { CANDIDATE_LIST_HEADING, selectMiSameCandidates } from "../mi-same-candidates";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-E2E-CANDIDATE-02 — **화면 축: 다상품 마운트 DOM**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 이 파일이 답하는 질문은 **하나** 다 —
 * > 「이미 찾아낸 후보가 **화면에** 후보군으로 서고, **가격이 있는 후보가 그 안에**
 * >  함께 서는가」 — 다섯 상품에서.
 *
 * ── 🔴 왜 선택기 단언만으로는 부족한가 ─────────────────────────────────────
 * WU-110 이 적어 둔 그 함정이다 — **판정 함수를 직접 부르는 테스트는 배선을 못 본다.**
 * `selectCandidateList` 가 올바른 배열을 돌려줘도 컴포넌트가 그 배열을 **그리지
 * 않으면** 셀러에게는 후보가 없다(그것이 CEO 가 본 FAIL 의 실제 모양이었다).
 * 🟢 그래서 축이 **둘** 이다 — 선택기 축(`_lib/__tests__/cand-02-multi-product`) ·
 *    **화면 축(이 파일)**.
 *
 * ── 🔴 입력은 «실측» 이다 ────────────────────────────────────────────────────
 * `fixtures/cand-02-rows.json` 은 운영 `runDomesticPriceCheck` 가 **실제 HTTP 로**
 * 낸 행이다(재투입 생산자 · 새 Search 0). 🔴 손으로 만든 행이 아니다.
 * 🔴 그 파일이 **없으면 FAIL** 이다 — 측정 증거가 사라진 채로 초록이 되면
 *    「화면이 후보를 보여준다」가 **분모 0 에서 참** 이 된다(§5-B 가 금지한 그 모양).
 */

const FIX = join(
  __dirname,
  "..",
  "..",
  "..",
  "api",
  "price-history",
  "_lib",
  "__tests__",
  "fixtures",
  "cand-02-rows.json",
);

interface MeasuredRow {
  url: string;
  domain: string;
  /** 🔴 **typecheck 가 이 칸의 누락을 잡았다** — `toRow` 가 읽는데 선언이 없었다. */
  title: string | null;
  human: string | null;
  market: string | null;
  tier: string | null;
  verdict: string | null;
  price: number | null;
  currency: string | null;
  priceStatus: string | null;
  soldOut: boolean | null;
  display: "LIKELY" | "POSSIBLE" | null;
  priced: boolean;
}
interface MeasuredProduct {
  sid: string;
  code: string;
  title: string;
  originUrl: string;
  suppliedUrls: string[];
  notFetched: string[];
  rows: MeasuredRow[];
  lost: { url: string; human: string | null }[];
}

const products = (): MeasuredProduct[] =>
  (JSON.parse(readFileSync(FIX, "utf8")) as { products: MeasuredProduct[] }).products;

/**
 * 🔴 측정 행 → `GeminiTransientRow`. **칸을 지어내지 않는다** — 측정에 없는 값은
 *    넣지 않고, 있는 값은 이름 그대로 옮긴다(가공 0).
 */
const toRow = (m: MeasuredRow): GeminiTransientRow =>
  ({
    domain: m.domain,
    discoveredUrl: m.url,
    title: m.title ?? undefined,
    market: m.market,
    matchTruth: m.tier,
    crossSellerVerdict: m.verdict,
    priceAmount: m.price,
    priceCurrency: m.currency,
    priceStatus: m.priceStatus,
    soldOut: m.soldOut,
    source: "REVIEWED_SAME",
  }) as unknown as GeminiTransientRow;

/** 🔴 href 는 절대 URL 이라 비교 키를 맞춘다(trailing slash·대소문자). */
const loose = (u: string) => String(u).trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");

function mount(rows: GeminiTransientRow[]): { html: string; doc: Document; cleanup: () => void } {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(
      createElement(MarketPriceComparison, {
        rows,
        /** 🔴 선택 저장의 식별자 — 없으면 선택 UI 가 「저장했다」고 말하지 않는다(CLOSE-04). */
        snapshotId: "c88d2ca4-bfe1-4851-9c1d-92f69222a3f2",
      }),
    );
  });
  return {
    html: host.innerHTML,
    doc: document,
    cleanup: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}

/** 🟢 화면에 실제로 선 후보의 URL 집합(href 로 읽는다 — 배열이 아니라 DOM 이다). */
function shownUrls(doc: Document, testId: string): Set<string> {
  const out = new Set<string>();
  for (const li of Array.from(doc.querySelectorAll(`[data-testid="${testId}"]`))) {
    const a = li.querySelector("a[href]");
    if (a) out.add(loose(a.getAttribute("href") ?? ""));
  }
  return out;
}

describe("CAND-02 화면 축 — 다상품 마운트 DOM", () => {
  /** 🔴 CAND-02-E — 측정 증거가 **있어야** 이 파일의 단언이 의미를 갖는다. */
  it("CAND-02-E 실측 fixture 가 존재하고 5개 상품을 담고 있다", () => {
    const ps = products();
    expect(ps).toHaveLength(5);
    expect(ps.map((p) => p.code)).not.toContain("B226AC009");
    for (const p of ps) expect(p.originUrl).toMatch(/^https?:\/\//);
  });

  /**
   * 🔴🔴🔵 **CAND-02-F — 이 파일의 핵심. `PRICE ⊆ DISPLAY` 를 «DOM 에서» 단언한다.**
   *
   * 🔴 CEO 모순이 바로 이 모양이었다 — 「가격은 뜨는데 후보 리스트가 없다」.
   *    그래서 **가격 축에 선 행이 후보 리스트에도 서 있는지** 를 둘 다 DOM 으로 읽는다.
   * 🔴 분모가 0 인 상품은 **PASS 로 세지 않는다**(측정불가 · §5-B).
   */
  it("CAND-02-F 가격이 있는 후보는 후보 리스트에도 «화면에» 선다", () => {
    let measuredProducts = 0;
    let measuredRows = 0;
    const unmeasured: string[] = [];

    for (const p of products()) {
      const rows = p.rows.map(toRow);
      if (rows.length === 0) {
        unmeasured.push(`${p.sid}(행 0)`);
        continue;
      }
      const { doc, cleanup } = mount(rows);
      try {
        const inList = shownUrls(doc, "mi-candidate-row");
        const inPrice = shownUrls(doc, "mi-same-row");
        /** 🟢 가격 축 분모는 **운영 선택기** 가 정한다 — 측정 파일의 플래그를 믿지 않는다. */
        const priced = [
          ...selectMiSameCandidates(rows, "KR").priced,
          ...selectMiSameCandidates(rows, "OVERSEAS").priced,
        ];
        if (priced.length === 0) {
          unmeasured.push(`${p.sid}(가격 후보 0)`);
          continue;
        }
        measuredProducts += 1;
        for (const row of priced) {
          measuredRows += 1;
          const key = loose(row.discoveredUrl);
          expect(
            inPrice.has(key),
            `🔴 ${p.sid} ${row.domain} 가격 축에 있는데 가격 영역이 그리지 않았다\n   ${row.discoveredUrl}`,
          ).toBe(true);
          expect(
            inList.has(key),
            `🔴 PRICE ⊄ DISPLAY — ${p.sid} ${row.domain} 가격은 뜨는데 후보 리스트에 없다(CEO 모순)\n   ${row.discoveredUrl}`,
          ).toBe(true);
        }
      } finally {
        cleanup();
      }
    }

    /* eslint-disable no-console */
    console.log(
      `[CAND02-dom] 불변식 유효 — 상품 ${measuredProducts}/5 · 가격 후보 ${measuredRows}건` +
        (unmeasured.length > 0 ? ` · 🔴 측정불가 ${JSON.stringify(unmeasured)}` : ""),
    );
    /** 🔴 **분모가 비면 이 테스트는 아무것도 증명하지 못한다** — 그래서 분모를 단언한다. */
    expect(measuredProducts, "가격 후보가 있는 상품이 0 — 이 단언은 공집합에서 통과했다").toBeGreaterThan(0);
    expect(measuredRows).toBeGreaterThan(0);
  });

  /**
   * 🔴 CAND-02-G — 리스트에 선 모든 행은 **가격 칸을 갖는다**(값 또는 「가격 미확인」).
   *    🟢 가격이 없는 후보를 **버리지 않는다** 가 CPO §4-A 이고, 그 약속이 화면에
   *       지켜지는지는 **빈 칸이 아닌지** 로만 확인할 수 있다.
   */
  it("CAND-02-G 리스트의 모든 행이 가격 칸을 갖는다(없으면 「가격 미확인」)", () => {
    let checked = 0;
    for (const p of products()) {
      const rows = p.rows.map(toRow);
      if (rows.length === 0) continue;
      const { doc, cleanup } = mount(rows);
      try {
        const lis = Array.from(doc.querySelectorAll('[data-testid="mi-candidate-row"]'));
        /**
         * 🔴🔴 **1차 단언이 동어반복이었고 내 변이가 그것을 잡았다**(M2).
         *    `expected` 를 `selectCandidateList(...)` 로 세면 **그 함수를 좁히는 변이가
         *    기대값도 같이 좁혀서** 6/6 이 통과한다(WU-145 ⒜ 와 같은 함정).
         * 🟢 그래서 기대값은 **실측에 얼어 있는 숫자** 다 — 라이브 실행이 «변이 없는»
         *    운영 선택기로 기록한 `display` 칸이다.
         */
        const frozen = p.rows.filter((m) => m.display != null).length;
        expect(lis.length, `${p.sid} 리스트 행 수가 실측 기록과 다르다`).toBe(frozen);
        for (const li of lis) {
          const price = li.querySelector('[data-testid="mi-candidate-price"]');
          expect(price, `${p.sid} 가격 칸이 없다`).toBeTruthy();
          expect((price!.textContent ?? "").trim().length, `${p.sid} 가격 칸이 비었다`).toBeGreaterThan(0);
          /** 🔴 선택 UI 가 같이 서야 셀러가 «고를» 수 있다(CLOSE-04 와 같은 축). */
          expect(li.querySelector('[data-testid="mi-candidate-select"]'), `${p.sid} 선택 UI 부재`).toBeTruthy();
          checked += 1;
        }
      } finally {
        cleanup();
      }
    }
    expect(checked, "검사한 행이 0 — 공집합 통과다").toBeGreaterThan(0);
  });

  /**
   * 🔴 CAND-02-H — **충돌 판정 후보는 리스트에 서지 않는다**(제외 축의 Negative).
   *    🟢 이것이 없으면 「전부 보여준다」로 넓혀도 이 파일이 초록이다.
   */
  it("CAND-02-H CONFLICT 후보는 리스트에 서지 않는다", () => {
    let conflicts = 0;
    for (const p of products()) {
      const rows = p.rows.map(toRow);
      if (rows.length === 0) continue;
      const { doc, cleanup } = mount(rows);
      try {
        const inList = shownUrls(doc, "mi-candidate-row");
        for (const m of p.rows) {
          if (m.tier !== "CONFLICT" && m.verdict !== "CONFLICT") continue;
          conflicts += 1;
          expect(
            inList.has(loose(m.url)),
            `🔴 ${p.sid} ${m.domain} 충돌 판정인데 후보 리스트에 섰다\n   ${m.url}`,
          ).toBe(false);
        }
      } finally {
        cleanup();
      }
    }
    /** 🔴 실측에 충돌 후보가 **있었다** — 분모가 0 이면 이 단언은 의미가 없다. */
    expect(conflicts, "충돌 후보가 0 — 제외 축을 측정하지 못했다").toBeGreaterThan(0);
  });

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴🔵 **CAND-02-K — 「가격이 없어도 버리지 않는다」(CPO §4-A)를 잠근다.**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 **내 변이(M2)가 이 공백을 찾았다.** 표시 축에 `isPriceConfirmed` 조건을 더해도
   *    `PRICE ⊆ DISPLAY` 는 **여전히 참** 이다(가격 후보는 정의상 가격이 확인된
   *    행이니까) ⟹ CAND-02-F 로는 **그 회귀를 잡을 수 없다.** 그런데 그것이 바로
   *    CEO 가 본 모순의 **다른 절반** 이다 — 「동일상품 가능성이 있는데 가격을
   *    확인하지 못한 후보」가 화면에서 사라지는 것.
   * 🟢 그래서 **가격이 확인되지 않은 후보가 리스트에 서 있는지** 를 따로 단언한다.
   */
  it("CAND-02-K 가격이 확인되지 않은 후보도 리스트에서 사라지지 않는다", () => {
    let unpriced = 0;
    for (const p of products()) {
      const rows = p.rows.map(toRow);
      if (rows.length === 0) continue;
      const { doc, cleanup } = mount(rows);
      try {
        const inList = shownUrls(doc, "mi-candidate-row");
        for (const m of p.rows) {
          /** 🟢 실측이 「표시 대상」으로 기록했고 **가격은 확인되지 않은** 행. */
          if (m.display == null) continue;
          if (m.priceStatus === "VERIFIED_CURRENT") continue;
          unpriced += 1;
          expect(
            inList.has(loose(m.url)),
            `🔴 ${p.sid} ${m.domain} 가격 미확인 후보가 리스트에서 사라졌다(CPO §4-A 위반)\n   ${m.url}`,
          ).toBe(true);
        }
      } finally {
        cleanup();
      }
    }
    /** 🔴 분모가 0 이면 이 단언은 공집합에서 통과한다 — 실측에 그 행이 **있었다**. */
    expect(unpriced, "가격 미확인 후보가 0 — 이 축은 이 표본에서 측정불가").toBeGreaterThan(0);
  });

  /**
   * 🟡 CAND-02-I — **관측** 이고 FAIL 조건이 아니다.
   *    리스트는 「동일상품 **가능성**」이라 사람이 DIFFERENT 라 한 후보도 설 수 있다.
   * 🔴 그러나 **몇 건인지 모르면 CPO 가 판정할 수 없다** ⟹ 숫자를 적는다.
   * 🔴 CTO 가 이것을 근거로 리스트 정책을 바꾸지 않았다(CPO 판정 사안).
   */
  it("CAND-02-I 사람이 DIFFERENT 라 한 후보가 리스트에 몇 건 서는지 적는다", () => {
    const leaked: string[] = [];
    let labeled = 0;
    for (const p of products()) {
      const rows = p.rows.map(toRow);
      if (rows.length === 0) continue;
      const { doc, cleanup } = mount(rows);
      try {
        const inList = shownUrls(doc, "mi-candidate-row");
        for (const m of p.rows) {
          if (m.human !== "SAME" && m.human !== "DIFFERENT") continue;
          labeled += 1;
          if (m.human === "DIFFERENT" && inList.has(loose(m.url))) {
            leaked.push(`${p.sid} ${m.domain}(${m.verdict ?? m.tier ?? "?"})`);
          }
        }
      } finally {
        cleanup();
      }
    }
    console.log(`[CAND02-dom] 라벨 ${labeled}건 · 🟡 human DIFFERENT 가 리스트에 ${leaked.length}건 ${JSON.stringify(leaked)}`);
    expect(labeled).toBeGreaterThan(0);
  });

  /** 🔴 CAND-02-J — 후보가 0 인 상품은 **「없다」고 말한다**(미조회와 섞지 않는다). */
  it("CAND-02-J 행이 0 인 상품은 빈 상태 문구를 말한다", () => {
    const empty = products().filter((p) => p.rows.length === 0);
    /** 🔴 실측에 그 상품이 **있었다**(S5) — 없으면 이 축을 측정하지 못한 것이다. */
    expect(empty.length, "행 0 인 상품이 없다 — 빈 상태 축은 이 표본에서 측정불가").toBeGreaterThan(0);
    const { doc, cleanup } = mount([]);
    try {
      expect(doc.querySelector('[data-testid="mi-candidate-row"]')).toBeNull();
      expect(doc.body.textContent ?? "").not.toContain(CANDIDATE_LIST_HEADING);
    } finally {
      cleanup();
    }
  });
});
