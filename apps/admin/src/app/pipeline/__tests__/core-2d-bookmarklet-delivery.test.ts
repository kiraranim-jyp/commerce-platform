// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SmartSearchBookmarklet, bookmarkletLabel } from "../SmartSearchBookmarklet";
import {
  buildBookmarkletForSnapshot,
  collectFromResultLinks,
  MAX_HANDOFF_URLS,
  parseSuppliedUrlsParam,
  SUPPLIED_URL_PARAM,
} from "../supplied-url-handoff";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2D — **북마크릿 전달 UX 계약**(CPO 10항)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 가 테스트할 것을 **열 개로 열거** 했다 — 아래가 그 열 개다:
 *    ① bookmarklet 생성 ② snapshotId 포함 ③ candidateUrls 추출 ④ navigation URL 생성
 *    ⑤ 잘못된 URL 제거 ⑥ 중복 제거 ⑦ 상한 50 ⑧ 비-HTTP 제거 ⑨ 기존 `/check` 연결
 *    ⑩ 기존 자동 check 와 **중복 실행 방지**
 *
 * 🔴🔴 **화면 축은 «마운트한 DOM» 이다** — 소스 PASS 를 Render PASS 로 쓰지 않는다
 *    (메모 `render-pass-is-not-source-pass`).
 * 🔴 **`.test.ts` 다** — 이 저장소의 vitest `include` 는 `*.test.ts` 뿐이라
 *    `.test.tsx` 는 **조용히 수집되지 않는다**(메모 `local-toolchain-silent-noops`).
 *    그래서 JSX 대신 `createElement` 를 쓴다(기존 마운트 테스트들과 같은 모양).
 * 🔴 네트워크 0 · 외부 계정 0.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const COMP = strip(readFileSync(path.join(HERE, "..", "SmartSearchBookmarklet.tsx"), "utf8"));
const PAGE = strip(readFileSync(path.join(HERE, "..", "page.tsx"), "utf8"));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  /** 🔴 이 플래그가 없으면 React 가 「act(...) 를 지원하지 않는 환경」이라고 경고하고
   *  effect flush 보장이 흐려진다 — effect 로 href 를 넣으므로 켜 둔다. */
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const mount = (snapshotId: string | null, productTitle?: string | null) => {
  act(() => {
    root.render(createElement(SmartSearchBookmarklet, { snapshotId, productTitle }));
  });
};
const linkEl = () => container.querySelector('[data-testid="smart-search-bookmarklet-link"]');
const hrefOf = () => linkEl()?.getAttribute("href") ?? "";
const sectionText = () =>
  container.querySelector('[data-testid="smart-search-bookmarklet"]')?.textContent ?? "";

describe("CORE-2D A — ① 생성 · ② snapshotId 포함(마운트 DOM)", () => {
  it("A-1 🟢 북마크릿이 **실제 href 로** 붙는다", () => {
    mount("snap-77", "Hug Hairy Monster T-shirt");
    expect(hrefOf().startsWith("javascript:(function()"), `🔴 href=${hrefOf().slice(0, 90)}`).toBe(true);
  });

  it("A-2 🔴🔴 React 19 의 **차단 코드가 들어가지 않았다**", () => {
    mount("snap-77");
    /** 🔴 `href` prop 으로 주면 `sanitizeURL` 이 이 문장으로 **교체** 한다
     *  (`react-dom-client.development.js:3166` 실측). */
    expect(hrefOf(), "🔴 React 가 href 를 sanitize 했다 — 고장난 북마크가 등록된다").not.toContain(
      "React has blocked a javascript",
    );
  });

  /**
   * ════════════════════════════════════════════════════════════════════════
   * 🔴🔴 **§5-B CONTROL — 「React 가 막는다」가 «가정» 이 아니라 «실측» 이다**
   * ════════════════════════════════════════════════════════════════════════
   *
   * 🔴 **왜 이 테스트가 필요한가.** D-1(소스 앵커)이 「`href` prop 을 쓰지 말라」고
   *    말하는데, 그 금지의 **근거가 실재하는지** 를 아무것도 증명하지 않으면 다음
   *    사람이 「과한 규칙」이라 보고 지운다.
   *
   * 🔴🔴 그리고 **행동 축으로는 잡을 수 없다는 것도 측정했다** — `href` prop 을
   *    추가하는 변이에서 A-1·A-2 가 **통과했다**(effect 가 sanitize 뒤에 덮어쓴다).
   *    ⟹ 🟢 그러므로 이 금지를 지키는 것은 **D-1 소스 앵커 + 이 CONTROL** 둘이다.
   *       「변이가 통과했다」를 「계약이 충분하다」로 읽지 않는다.
   */
  it("A-2b 🔴🔴 CONTROL — React 19 는 `href` prop 의 `javascript:` 를 **실제로 막는다**", () => {
    const real = buildBookmarkletForSnapshot("https://x", "snap-1");
    act(() => {
      root.render(createElement("a", { href: real, "data-testid": "control-anchor" }, "x"));
    });
    const blocked = container.querySelector('[data-testid="control-anchor"]')?.getAttribute("href") ?? "";
    expect(
      blocked,
      "🔴 React 가 더 이상 막지 않는다면 D-1 금지의 근거가 사라진다 — 그때 다시 판단한다",
    ).toContain("React has blocked a javascript");
    expect(blocked).not.toEqual(real);
  });

  it("A-3 🔴 **그 상품의 snapshotId** 가 박혀 있다", () => {
    mount("snap-AAA");
    expect(hrefOf()).toContain("resume=snap-AAA");
    expect(hrefOf()).toContain(`${SUPPLIED_URL_PARAM}=`);
  });

  it("A-4 🔴🔴 **상품이 다르면 북마크릿도 다르다**(상품 간 혼선 금지)", () => {
    mount("snap-A");
    const a = hrefOf();
    mount("snap-B");
    const b = hrefOf();
    expect(a).not.toEqual(b);
    expect(a).toContain("resume=snap-A");
    expect(b).toContain("resume=snap-B");
  });

  it("A-5 🔴 `snapshotId` 가 없으면 **아무것도 렌더하지 않는다**", () => {
    mount(null);
    expect(container.textContent).toBe("");
    expect(linkEl()).toBeNull();
  });
});

describe("CORE-2D B — ④ navigation · ⑦ 상한 · ⑤⑥⑧ URL 위생", () => {
  it("B-1 🔴 navigation 으로 넘긴다 — `fetch`/XHR 가 **없다**", () => {
    const b = buildBookmarkletForSnapshot("https://x", "s");
    expect(b).toContain("location.href=");
    expect(b).not.toContain("fetch(");
    expect(b).not.toContain("XMLHttpRequest");
  });

  it("B-2 🔴 ⑦ 상한 50 이 **세 자리에서 같다**", () => {
    expect(buildBookmarkletForSnapshot("https://x", "s")).toContain(`slice(0,${MAX_HANDOFF_URLS})`);
    const many = Array.from({ length: MAX_HANDOFF_URLS + 30 }, (_, i) => `https://s.example/products/${i}`);
    expect(parseSuppliedUrlsParam(`?${SUPPLIED_URL_PARAM}=${encodeURIComponent(many.join("\n"))}`)).toHaveLength(
      MAX_HANDOFF_URLS,
    );
    expect(collectFromResultLinks(many, "https://other")).toHaveLength(MAX_HANDOFF_URLS);
  });

  it("B-3 🔴 ⑤ 잘못된 URL · ⑧ 비-HTTP 를 제거한다", () => {
    const mixed = ["javascript:alert(1)", "data:text/html,x", "mailto:a@b.c", "https://", "https://ok/p/1"];
    const q = `?${SUPPLIED_URL_PARAM}=${encodeURIComponent(mixed.join("\n"))}`;
    expect(parseSuppliedUrlsParam(q)).toEqual(["https://ok/p/1"]);
  });

  it("B-4 🔴 ⑥ 중복을 제거한다", () => {
    const u = "https://ok.example/products/1";
    expect(parseSuppliedUrlsParam(`?${SUPPLIED_URL_PARAM}=${encodeURIComponent([u, u].join("\n"))}`)).toEqual([u]);
    expect(collectFromResultLinks([u, u], "https://other")).toEqual([u]);
  });

  it("B-5 🔴 ③ 검색 결과에서 **다른 판매처 URL 만** 뽑는다(래퍼 해제 포함)", () => {
    const got = collectFromResultLinks(
      [
        "https://duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.lfmall.co.kr%2Fapp%2Fproduct%2FDNSVXX00636",
        "https://html.duckduckgo.com/html/?q=next",
      ],
      "https://html.duckduckgo.com",
    );
    expect(got).toEqual(["https://www.lfmall.co.kr/app/product/DNSVXX00636"]);
  });
});

describe("CORE-2D C — 🔴 금지 전수(마운트 DOM 으로 본다)", () => {
  /**
   * 🔴🔴 **1차 단언이 「판매처」를 금지해 FAIL 했고 «내 단언이 틀렸다».**
   *
   * 설명문의 「이 상품을 파는 다른 **판매처**를 직접 찾지 않아도 됩니다」는
   * **일반 명사 한 번** 이고 CPO 가 금지한 「후보/검색 결과 **목록**」이 아니다.
   * 🟢 헌장 선례를 따른다 — 「문자열 grep 으로 지우지 않는다 · 기준은 사용자에게
   *    그 **기능/단계** 를 가리키는가」(「소싱 국가」를 남긴 그 판단).
   * 🟢 그래서 ⒜ **판정/가격 어휘** 는 전면 금지 ⒝ **일반 명사는 개수로 범위를 좁힌다**
   *    ⒞ 🔴 그리고 **구조** 로 잠근다 — 후보 목록은 표/행으로 나타난다.
   */
  it("C-1 🔴🔴 **후보/검색 결과를 그리지 않는다**(CPO 금지)", () => {
    mount("s", "T");
    const text = sectionText();
    expect(text.length, "🔴 섹션이 렌더되지 않았다 — 이 단언이 공허해진다").toBeGreaterThan(50);
    /** ⒜ 판정·가격·URL 어휘는 **한 글자도** 안 된다. */
    for (const banned of ["동일상품", "유사상품", "최저가", "가격비교", "₩", "http://", "https://", "원"]) {
      expect(text, `🔴 "${banned}" 가 화면에 있다 — 후보/결과 노출 금지`).not.toContain(banned);
    }
    /** ⒝ 일반 명사는 **개수** 로 좁힌다 — 목록을 설명하기 시작하면 늘어난다. */
    expect((text.match(/판매처/g) ?? []).length, "🔴 「판매처」가 늘었다 — 후보 설명이 생겼다").toBeLessThanOrEqual(1);
    /** ⒞ 🔴 **구조로 잠근다** — 표·행이 없으면 목록을 그릴 수 없다. */
    const section = container.querySelector('[data-testid="smart-search-bookmarklet"]')!;
    expect(section.querySelectorAll("table")).toHaveLength(0);
    expect(section.querySelectorAll("tbody")).toHaveLength(0);
    expect(section.querySelectorAll("a[href^='http']"), "🔴 외부 링크가 있다 — 후보 노출이다").toHaveLength(0);
    expect(section.querySelectorAll("img")).toHaveLength(0);
  });

  it("C-2 🔴 **입력칸이 하나도 없다**(셀러 URL 입력 기능 부활 금지)", () => {
    mount("s");
    expect(container.querySelectorAll("input")).toHaveLength(0);
    expect(container.querySelectorAll("textarea")).toHaveLength(0);
    expect(container.querySelectorAll("form")).toHaveLength(0);
  });

  it("C-3 🔴 MI·가격 어휘가 이 컴포넌트에 **없다**", () => {
    for (const banned of ["SAME", "threshold", "priceTier", "matchTruth", "judgeDomestic", "Registry"]) {
      expect(COMP, `🔴 "${banned}" 가 생겼다 — 이 컴포넌트는 전달만 한다`).not.toContain(banned);
    }
  });

  it("C-4 🔴 **검색을 실행하지 않는다** — 외부 요청 0", () => {
    expect(COMP).not.toContain("fetch(");
    expect(COMP).not.toContain("XMLHttpRequest");
  });

  it("C-5 🟢 드래그 등록 UX 가 살아 있다 · 클릭 실행은 **막는다**", () => {
    mount("s");
    expect(linkEl()?.getAttribute("draggable"), "🔴 드래그가 이 UX 의 전부다").toBe("true");
    /** 🔴 페이지 안에서 `javascript:` 를 클릭 실행시키면 브라우저가 막아 **고장으로 오해** 된다. */
    expect(COMP).toContain("e.preventDefault()");
  });

  it("C-6 🟢 사용법 1·2·3 이 **셋 다** 있다", () => {
    mount("s");
    expect(container.querySelectorAll("li")).toHaveLength(3);
    expect(sectionText()).toContain("북마크바로");
    expect(sectionText()).toContain("한 번 클릭");
  });
});

describe("CORE-2D D — 🔴🔴 배선(소스 앵커 — 마운트만으로는 못 본다)", () => {
  it("D-1 🔴🔴 `href` 를 **prop 으로 주지 않는다**(React 19 sanitize 회피)", () => {
    expect(COMP, "🔴 href prop 을 주면 React 가 차단 코드로 바꾼다").not.toMatch(/href=\{/);
    expect(COMP).toContain('setAttribute("href"');
  });

  it("D-2 🔴 `setAttribute` 가 **owner 함수** 의 산출을 넣는다(사본 금지)", () => {
    expect(COMP).toContain('from "./supplied-url-handoff"');
    expect(COMP).toContain("buildBookmarkletForSnapshot(window.location.origin, snapshotId)");
  });

  it("D-3 🔴 페이지가 **현재 상품의 snapshotId** 를 넘긴다", () => {
    expect(PAGE).toContain("<SmartSearchBookmarklet snapshotId={snapshotId}");
  });

  it("D-4 🔴 자리가 `CommerceWorkspace` **뒤** 다(결론이 최상단이어야 한다)", () => {
    const workspace = PAGE.indexOf("<CommerceWorkspace");
    const bookmarklet = PAGE.indexOf("<SmartSearchBookmarklet");
    expect(workspace).toBeGreaterThan(-1);
    expect(bookmarklet, "🔴 도구가 판단 결과보다 먼저 서면 WU-140-R1 의 FAIL 모양이다").toBeGreaterThan(
      workspace,
    );
  });

  it("D-5 🔴 ⑨ 기존 `/check` 에 연결된다 — 새 API 를 만들지 않았다", () => {
    expect(PAGE).toContain("candidateUrls: suppliedUrls");
    const routes = PAGE.match(/fetch\("\/api\/[^"]+"/g) ?? [];
    expect(
      routes.filter((r) => r.includes("price-history/check")),
      "🔴 핸드오프가 쓰는 route 는 기존 /check 하나다",
    ).toHaveLength(2);
  });

  it("D-6 🔴🔴 ⑩ 기존 자동 check 와 **중복 실행되지 않는다**", () => {
    const resumeRead = PAGE.indexOf('get("resume")');
    const handoff = PAGE.indexOf("parseSuppliedUrlsParam(window.location.search)");
    const firstInsert = PAGE.indexOf("const isFirstInsert");
    expect(handoff).toBeGreaterThan(resumeRead);
    expect(firstInsert).toBeGreaterThan(handoff);
    /** 🔴 빈 목록이면 **호출 자체를 안 한다**. */
    expect(PAGE).toContain("if (suppliedUrls.length > 0)");
    /** 🔴 한 번 쓰고 URL 에서 지운다 — 새로고침으로 또 돌지 않는다. */
    expect(PAGE).toContain("searchParams.delete(SUPPLIED_URL_PARAM)");
  });
});

describe("CORE-2D E — 라벨", () => {
  it("E-1 🟢 상품명을 짧게 넣는다 · 없으면 **지어내지 않는다**", () => {
    expect(bookmarkletLabel("Hug Hairy Monster T-shirt")).toContain("따져 검색 · ");
    expect(bookmarkletLabel("")).toBe("따져 검색");
    expect(bookmarkletLabel(null)).toBe("따져 검색");
    expect(bookmarkletLabel("x".repeat(40)).length).toBeLessThan(40);
  });
});
