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
 * 🔵🔵🔵 DISCOVERY-SEARCH-PROVIDER-05 QA — **정의된 Query 전수 육안 화면 계약**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 지키는 것은 다섯이다:
 * ```
 * ① 저장된 검색 결과를 **그대로** 보여준다(재검색 0 · URL 지어내기 0)
 * ② 🔴 **판정하지 않는다** — MI · SAME/DIFFERENT · Query 확정 어휘가 화면에 **없다**
 * ③ 🔴 **A/B/C/D 를 자동으로 찍지 않는다**(CPO §7 — 그 분류는 사람 눈이 한다)
 * ④ 상품마다 **정의된 Query 전부** 를 비교할 수 있고 **URL 이 클릭 가능** 하다
 * ⑤ 🔴 운영 화면이 이 QA 모듈을 **가져가지 않는다**
 * ```
 */

const FIXTURES = join(__dirname, "fixtures");
const RAW = JSON.parse(readFileSync(join(FIXTURES, "search-provider-05-raw.json"), "utf8")) as Parameters<
  typeof buildRunViews
>[0] & { runs: { productId: string; label: string; query: string; results: unknown[] }[] };

const APP = join(__dirname, "../../../../../");

describe("SEARCH-PROVIDER-05 QA §fixture — 저장된 원본이 그대로 있다", () => {
  it("상품 4개 · 질의가 상품마다 여럿 · 같은 (상품, 질의) 가 중복되지 않는다", () => {
    const views = buildRunViews(RAW);
    expect(new Set(views.map((v) => v.productId)).size).toBe(4);
    expect(views.length).toBeGreaterThan(40);
    /**
     * 🔴🔴 **같은 질의를 두 번 «검색» 하지 않았다** 를 단언한다.
     *    SPRINT-06 의 `I-1` 은 SPRINT-05 의 `H-Q3` 와 **문자열이 같아서** 행은 둘이지만
     *    **검색은 한 번** 이다(결과를 복사하고 `alsoFrom` 에 출처를 적었다).
     * 🟢 그래서 「행이 유일하다」가 아니라 **「중복 행은 반드시 복사본이다」** 로 잠근다
     *    — 이쪽이 더 강하다(진짜 재검색이 들어오면 `startedAt` 이 달라 FAIL 한다).
     */
    const raw = RAW as unknown as { runs: { productId: string; query: string; startedAt: string; alsoFrom?: string[] }[] };
    const byKey = new Map<string, typeof raw.runs>();
    for (const r of raw.runs) {
      const k = `${r.productId} ${r.query}`;
      byKey.set(k, [...(byKey.get(k) ?? []), r]);
    }
    for (const [k, group] of byKey) {
      if (group.length === 1) continue;
      const stamps = new Set(group.map((g) => g.startedAt));
      expect(stamps.size, `${k} — 같은 질의를 실제로 두 번 검색했다(과금 중복)`).toBe(1);
      expect(group.filter((g) => (g.alsoFrom?.length ?? 0) > 0).length, `${k} — 복사본에 출처가 없다`).toBe(
        group.length - 1,
      );
    }
  });

  it("🔴 세 출처가 **같은 표** 에 있다 — 운영 열거기 · 운영 Planner · 하니스 라벨", () => {
    const sources = new Set(buildRunViews(RAW).map((v) => v.source));
    for (const s of ["GENERATOR", "PLANNER", "HARNESS"]) expect(sources, s).toContain(s);
  });

  it("🔴 운영 열거기 Q1~Q8 이 **전부** 실행됐다(「Q4/Q5 없음」이 아니다)", () => {
    for (const pid of ["S1", "S2", "S3", "S4"]) {
      const labels = new Set(
        buildRunViews(RAW)
          .filter((v) => v.productId === pid)
          .flatMap((v) => [v.label, ...(v.alsoFrom ?? [])]),
      );
      for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
        expect(labels, `${pid} 에 G-Q${n} 이 없다`).toContain(`G-Q${n}`);
      }
    }
  });

  it("분류는 기존 owner 산출이고 상품상세가 실재한다", () => {
    const views = buildRunViews(RAW);
    const shapes = new Set(views.flatMap((v) => v.results.map((r) => r.shape)));
    expect([...shapes].every((s) => ["PRODUCT_PAGE", "LISTING_PAGE", "UNKNOWN_PAGE", "UNUSABLE"].includes(s))).toBe(
      true,
    );
    expect(views.flatMap((v) => v.results).filter((r) => r.shape === "PRODUCT_PAGE").length).toBeGreaterThan(0);
  });

  it("🔴🔴 「결과 0」은 **재확인 관측을 달고** 나온다 — 0 을 「결과 없음」으로 못 읽게 한다", () => {
    const views = buildRunViews(RAW);
    const zeros = views.filter((v) => v.results.length === 0);
    expect(zeros.length).toBeGreaterThan(0);
    for (const z of zeros) {
      expect(z.recheckOrganicCount, `${z.productId} ${z.label} 에 재확인 관측이 없다`).toBeTypeOf("number");
    }
    /** 🔴 실제로 **재현되지 않은 0** 이 있었다 — 그 사실을 계약으로 박는다. */
    expect(zeros.some((z) => (z.recheckOrganicCount ?? 0) > 0)).toBe(true);
  });

  it("🔵 SPRINT-06 — **목적형 I-1/I-2/I-3** 이 상품 4개 전부에 있다", () => {
    for (const pid of ["S1", "S2", "S3", "S4"]) {
      const labels = new Set(
        buildRunViews(RAW)
          .filter((v) => v.productId === pid && v.source === "INTENT")
          .map((v) => v.label),
      );
      for (const l of ["I-1", "I-2", "I-3"]) expect(labels, `${pid} ${l}`).toContain(l);
    }
  });

  it("🔴 목적형 질의는 **영어** 다 — 한글/영어를 Query 축으로 쓰지 않는다", () => {
    for (const v of buildRunViews(RAW).filter((x) => x.source === "INTENT")) {
      expect(/[가-힣]/.test(v.query), `${v.productId} ${v.label}: ${v.query}`).toBe(false);
    }
  });

  it("🟢 I-1 은 재검색하지 않았다 — 기존 질의와 **같은 문자열** 이라 출처를 적는다", () => {
    for (const v of buildRunViews(RAW).filter((x) => x.label === "I-1")) {
      expect(v.alsoFrom?.length, `${v.productId} I-1 에 출처가 없다`).toBeGreaterThan(0);
    }
  });

  it("🔴🔴 시장은 **관측** 이다 — 공식몰을 국내 등록부로 세지 않는다", () => {
    const rows = buildRunViews(RAW).flatMap((v) => v.results);
    /** 🔴 `bobochoses.com` 은 국내 등록부에 **있지만** 공식몰로 갈라져야 한다(WU-019R). */
    const official = rows.filter((r) => r.host === "bobochoses.com" || r.host === "main-story.com");
    expect(official.length).toBeGreaterThan(0);
    for (const r of official) expect(r.market, r.host).toBe("ORIGIN_BRAND");
    /** 🟢 `.kr` 과 등록부는 **다른 값** 으로 남는다(합쳐 버리면 그 함정이 사라진다). */
    expect(new Set(rows.map((r) => r.market)).size).toBeGreaterThan(2);
  });

  it("🟢 Query 간 겹침을 **관측** 으로 적는다(같은 URL 이 다른 Query 에도 나온다)", () => {
    const views = buildRunViews(RAW);
    /** 🔴 「겹침이 있다」가 아니라 **칸이 정확히 계산된다** 를 단언한다. */
    for (const v of views) {
      for (const r of v.results) {
        expect(r.alsoInQueries, `${v.label} ${r.url}`).not.toContain(v.label);
      }
    }
    expect(views.some((v) => v.results.some((r) => (r.alsoInQueries?.length ?? 0) > 0))).toBe(true);
  });
});

describe("SEARCH-PROVIDER-05 QA §마운트 DOM — 화면이 실제로 그린다", () => {
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

  const render = () =>
    act(() => root.render(createElement(SearchCompareView, { origins: RAW.origins, runs: buildRunViews(RAW) })));

  it("상품마다 질의 전부가 그려지고 원본 URL 이 **전건** 링크로 나온다", () => {
    const views = buildRunViews(RAW);
    render();
    for (const pid of ["S1", "S2", "S3", "S4"]) {
      expect(container.querySelector(`[data-testid="qa-origin-${pid}"]`), pid).toBeTruthy();
    }
    for (const v of views) {
      expect(
        container.querySelector(`[data-testid="qa-sum-${v.productId}-${v.label}"]`),
        `${v.productId} ${v.label} 요약 없음`,
      ).toBeTruthy();
      expect(
        container.querySelector(`[data-testid="qa-q-${v.productId}-${v.label}"]`),
        `${v.productId} ${v.label} 질의 문자열 없음`,
      ).toBeTruthy();
    }
    /** 🟢 결과 **하나도 빠뜨리지 않고** 클릭 가능한 링크로 낸다(CPO §5). */
    const links = [...container.querySelectorAll("a[href^='http']")];
    expect(links.length).toBe(views.reduce((a, v) => a + v.results.length, 0));
    expect(container.textContent ?? "").toContain("상품상세");
    /** 🔴 재현되지 않은 0 은 **화면에서** 경고로 보여야 한다(표만 보면 「0 = 없음」으로 읽는다). */
    expect(container.textContent ?? "").toContain("이 0 은 재현되지 않았습니다");
  });

  it("🔴 화면에 **판정 어휘가 없다** — MI · SAME/DIFFERENT 를 말하지 않는다", () => {
    render();
    const text = container.textContent ?? "";
    for (const w of ["동일상품입니다", "SAME", "DIFFERENT", "MI 판단", "권장 판매가", "판매판단", "최종 Query"]) {
      expect(text, w).not.toContain(w);
    }
    expect(text).toContain("관측");
    expect(text).toContain("검색을 다시 돌리지 않으며");
  });

  it("🔴🔴 **A/B/C/D 를 자동으로 찍지 않는다** — 기준만 설명하고 결과에 라벨이 없다", () => {
    render();
    const text = container.textContent ?? "";
    /** 🟢 기준 설명은 있어야 한다(사람이 같은 기준으로 본다). */
    expect(text).toContain("육안 분류 기준");
    expect(text).toContain("이 분류는 화면이 찍지 않습니다");
    /** 🔴 시장 표시도 «관측» 이라고 화면이 직접 말해야 한다(등록부 ≠ 국내 시장). */
    expect(text).toContain("시장 표시는 관측입니다");
    expect(text).toContain("「등록부에 있다」는 「국내 시장이다」를 뜻하지 않습니다");
    /** 🔴 각 결과 줄에 판정 라벨이 붙으면 그것이 자동 분류다. */
    for (const w of ["유효 상품 후보로 분류", "무관으로 분류", "분류: A", "분류: C"]) {
      expect(text, w).not.toContain(w);
    }
  });
});

describe("SEARCH-PROVIDER-05 QA §격리 — 운영 화면이 가져가지 않는다", () => {
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
      for (const forbidden of ["SearchCompareView", "search-provider-05-raw", "qa/search"]) {
        expect(code, `${f} 가 ${forbidden} 를 쓴다`).not.toContain(forbidden);
      }
    }
  });

  it("🔴 QA 페이지가 **네트워크를 쓰지 않는다**(재검색 금지가 코드로 지켜진다)", () => {
    const code = stripComments(readFileSync(join(APP, "app/qa/search/page.tsx"), "utf8").replace(/\r\n/g, "\n"));
    for (const w of ["fetch(", "apify.com", "APIFY_API_TOKEN"]) expect(code).not.toContain(w);
    expect(code).toContain("readFileSync");
  });
});
