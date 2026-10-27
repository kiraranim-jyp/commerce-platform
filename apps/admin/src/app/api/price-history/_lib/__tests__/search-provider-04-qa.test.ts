// @vitest-environment jsdom
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stripComments } from "@/app/pipeline/commerce/__tests__/source-text";
import { buildRunViews } from "@/app/qa/search/page";
import { SearchCompareView } from "@/app/qa/search/SearchCompareView";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 DISCOVERY-SEARCH-PROVIDER-04 QA — **육안 검증 화면 계약**(순수 · 네트워크 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 지키는 것은 넷이다:
 * ```
 * ① 저장된 8회 결과를 **그대로** 보여준다(재검색 0 · URL 지어내기 0)
 * ② 🔴 **판정하지 않는다** — MI · SAME/DIFFERENT · Query 확정 어휘가 화면에 **없다**
 * ③ Q2/Q3 를 **나란히** 비교할 수 있다
 * ④ 🔴 운영 화면이 이 QA 모듈을 **가져가지 않는다**
 * ```
 */

const RAW = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "search-provider-04-raw.json"), "utf8"),
) as Parameters<typeof buildRunViews>[0] & { runs: { results: unknown[] }[] };

const APP = join(__dirname, "../../../../../");

describe("SEARCH-PROVIDER-04 QA §fixture — 저장된 원본이 그대로 있다", () => {
  it("8 run · 상품 4 · Q2/Q3 각 4 · 결과 73건", () => {
    expect(RAW.runs).toHaveLength(8);
    const views = buildRunViews(RAW);
    expect(new Set(views.map((v) => v.productId)).size).toBe(4);
    expect(views.filter((v) => v.label === "Q2")).toHaveLength(4);
    expect(views.filter((v) => v.label === "Q3")).toHaveLength(4);
    expect(views.reduce((a, v) => a + v.results.length, 0)).toBe(73);
  });

  it("🔴 Q3 질의는 **품번을 포함** 한다(CPO §3 — BRAND_DESIGN 축을 그대로 쓰지 않는다)", () => {
    for (const v of buildRunViews(RAW).filter((x) => x.label === "Q3")) {
      const code = RAW.origins[v.productId]!.code;
      expect(v.query, v.query).toContain(code);
    }
  });

  it("🔴 Q2/Q3 질의에 **따옴표가 없다**(Q1 은 이 실험에서 제외됐다)", () => {
    for (const v of buildRunViews(RAW)) expect(v.query).not.toContain('"');
  });

  it("분류는 기존 owner 산출이고 상품상세가 실재한다", () => {
    const views = buildRunViews(RAW);
    const shapes = new Set(views.flatMap((v) => v.results.map((r) => r.shape)));
    expect([...shapes].every((s) => ["PRODUCT_PAGE", "LISTING_PAGE", "UNKNOWN_PAGE", "UNUSABLE"].includes(s))).toBe(
      true,
    );
    expect(views.flatMap((v) => v.results).filter((r) => r.shape === "PRODUCT_PAGE").length).toBeGreaterThan(0);
  });
});

describe("SEARCH-PROVIDER-04 QA §마운트 DOM — 화면이 실제로 그린다", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  /**
   * 🔴 SPRINT-05 에서 배치가 **2단 나란히 → 질의별 세로 나열** 로 바뀌었다(질의가 상품당
   *    13~17개라 두 칸에 안 들어간다). 🟢 이 계약이 보는 것은 **배치가 아니라 「둘 다 있다」** 이고
   *    그 성질은 그대로다 — 그래서 이름만 정정한다.
   */
  it("Q2 와 Q3 가 상품마다 **둘 다** 그려지고 원본 URL 이 링크로 나온다", () => {
    const views = buildRunViews(RAW);
    act(() => root.render(createElement(SearchCompareView, { origins: RAW.origins, runs: views })));
    const text = container.textContent ?? "";
    /** 상품 4개 머리글 */
    for (const pid of ["S1", "S2", "S3", "S4"]) {
      expect(container.querySelector(`[data-testid="qa-origin-${pid}"]`), pid).toBeTruthy();
      /** Q2 · Q3 요약이 **둘 다** 있어야 비교가 성립한다. */
      expect(container.querySelector(`[data-testid="qa-sum-${pid}-Q2"]`), pid).toBeTruthy();
      expect(container.querySelector(`[data-testid="qa-sum-${pid}-Q3"]`), pid).toBeTruthy();
    }
    /** 🟢 원본 URL 이 **클릭 가능한 링크** 로 나온다(CPO: 직접 클릭 검증). */
    const links = [...container.querySelectorAll("a[href^='http']")];
    expect(links.length).toBe(73);
    expect(text).toContain("상품상세");
  });

  it("🔴 화면에 **판정 어휘가 없다** — MI · SAME/DIFFERENT 를 말하지 않는다", () => {
    act(() =>
      root.render(createElement(SearchCompareView, { origins: RAW.origins, runs: buildRunViews(RAW) })),
    );
    const text = container.textContent ?? "";
    for (const w of ["동일상품입니다", "SAME", "DIFFERENT", "MI 판단", "권장 판매가", "판매판단"]) {
      expect(text, w).not.toContain(w);
    }
    /** 🟢 대신 **관측이라는 사실** 을 화면이 말한다. */
    expect(text).toContain("관측");
    expect(text).toContain("검색을 다시 돌리지 않으며");
  });
});

describe("SEARCH-PROVIDER-04 QA §격리 — 운영 화면이 가져가지 않는다", () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name === "__tests__" || name === "node_modules" || name === "qa") continue;
        walk(full, out);
      } else if (name.endsWith(".tsx")) out.push(full);
    }
    return out;
  }

  it("운영 `.tsx` 가 QA 검색 모듈을 import 하지 않는다", () => {
    const files = walk(join(APP, "app"));
    expect(files.length).toBeGreaterThan(20);
    for (const f of files) {
      const code = stripComments(readFileSync(f, "utf8").replace(/\r\n/g, "\n"));
      for (const forbidden of ["SearchCompareView", "search-provider-04-raw", "qa/search"]) {
        expect(code, `${f} 가 ${forbidden} 를 쓴다`).not.toContain(forbidden);
      }
    }
  });

  it("🔴 QA 페이지가 **네트워크를 쓰지 않는다**(재검색 금지가 코드로 지켜진다)", () => {
    const code = stripComments(
      readFileSync(join(APP, "app/qa/search/page.tsx"), "utf8").replace(/\r\n/g, "\n"),
    );
    for (const w of ["fetch(", "apify.com", "APIFY_API_TOKEN"]) expect(code).not.toContain(w);
    expect(code).toContain("readFileSync");
  });
});
