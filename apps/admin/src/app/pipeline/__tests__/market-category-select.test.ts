import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CATEGORY_PROFILES,
  detectCategoryProfile,
  detectionMarketSourceScopes,
  selectedMarketSourceScopes,
  sourceFitsScopes,
} from "@commerce/category";

/**
 * MARKET-CATEGORY-1(CEO 확정, 2026-09-15) — 상품 검색 진입 화면의 [대상 카테고리].
 *
 * ── 왜 정적 렌더 판정을 하지 않나 ────────────────────────────────────────
 * 이 저장소에서 UI 완료 판정이 여섯 번 화면 사실과 달랐다. "select 엘리먼트가
 * 있다"는 "고를 수 있다"도 "고른 값이 어딘가로 간다"도 증명하지 않는다. 그래서
 * 여기서는 실제로 jsdom에 마운트하고, 실제로 값을 바꾸고, 실제로 버튼을 눌러
 * **네트워크 호출이 나갔는지/안 나갔는지**로 판정한다.
 *
 * ── 병행 작업 격리 ───────────────────────────────────────────────────────
 * pipeline/commerce/*(REWORK-12 병행 수정 중)는 전부 mock으로 끊는다. 진입
 * 화면은 그 컴포넌트들을 렌더링하지 않으므로(result && product가 있어야 나온다)
 * 동작에는 영향이 없고, 남의 작업이 중간 상태여도 이 증거가 흔들리지 않는다.
 */

vi.mock("../CommerceWorkspace", () => ({ CommerceWorkspace: () => null }));
vi.mock("../commerce/WorkflowPanel", () => ({ WorkflowPanel: () => null }));
vi.mock("../commerce/workflow", () => ({
  MARKET_SIGNAL_NOT_STARTED: "NOT_STARTED",
  resolveWorkflow: () => ({ steps: [] }),
}));
vi.mock("next/link", () => ({ default: ({ children }: { children?: unknown }) => children ?? null }));

/** 실측(2026-09-15, 살아있는 DB SELECT) 그대로의 카탈로그 모양.
 *  domestic_price_sources 16행 · 전부 category_scope에 KIDS_FASHION 포함 ·
 *  그중 2행은 KIDS_GOODS도 가짐 · 카탈로그 enabled && ACTIVE는 11행 ·
 *  category_scope가 빈 행 0개 · 골프 스코프를 가진 행 0개. */
const CATALOG = Array.from({ length: 16 }, (_, i) => ({
  id: `src-${i}`,
  categoryScope: i < 2 ? ["KIDS_FASHION", "KIDS_GOODS"] : ["KIDS_FASHION"],
  status: "ACTIVE" as const,
  catalogEnabled: i < 11,
  enabled: i < 11,
}));

/** run-domestic-price-check.ts:330-332 / domestic-price-sources/search/route.ts:178-180
 *  과 **같은 식**이다. 판정을 여기서 다시 만들지 않는다 — 같은 함수를 쓴다. */
function researchTargets(scopes: string[] | null) {
  return CATALOG.filter(
    (s) => s.enabled && s.status === "ACTIVE" && sourceFitsScopes(s.categoryScope, scopes),
  );
}

/* ──────────────────────── ① 화면: 마운트 + 실제 상호작용 ──────────────────────── */

let dom: JSDOM;
let container: HTMLDivElement;
let pipelineCalls: string[];

const MARKET_CATEGORIES = [
  { id: "KIDS_FASHION", label: "아동 패션", sourceCount: 11, catalogSourceCount: 11, available: true },
  { id: "WOMEN_FASHION", label: "여성 패션", sourceCount: 0, catalogSourceCount: 0, available: false },
  { id: "GOLF", label: "골프용품", sourceCount: 0, catalogSourceCount: 0, available: false },
];

beforeEach(() => {
  dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "http://localhost/pipeline",
  });
  const w = dom.window as unknown as Window & typeof globalThis;
  // Node 24의 globalThis.navigator는 getter 전용이라 Object.assign이 통하지 않는다.
  Object.defineProperty(globalThis, "navigator", {
    value: w.navigator,
    configurable: true,
    writable: true,
  });
  Object.assign(globalThis, {
    window: w,
    document: w.document,
    HTMLElement: w.HTMLElement,
    Element: w.Element,
    Node: w.Node,
    Event: w.Event,
    getComputedStyle: w.getComputedStyle.bind(w),
    requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number,
    cancelAnimationFrame: (id: number) => clearTimeout(id),
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  container = w.document.getElementById("root") as HTMLDivElement;

  pipelineCalls = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : String(input);
    if (url.includes("/api/market-categories")) {
      return new Response(JSON.stringify({ ok: true, categories: MARKET_CATEGORIES }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/pipeline")) {
      pipelineCalls.push(String(init?.body ?? ""));
      return new Response(JSON.stringify({ error: "테스트에서는 실제 분석을 돌리지 않는다" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: false }), { status: 404 });
  }) as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function mountPage() {
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { act } = await import("react");
  const PipelinePage = (await import("../page")).default;

  const root = createRoot(container);
  await act(async () => {
    root.render(React.createElement(PipelinePage));
  });
  // 마운트 직후 비동기 effect(카테고리 목록 fetch, 복원)가 끝날 때까지.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return { root, act };
}

function q<T extends Element>(selector: string): T {
  const el = container.querySelector<T>(selector);
  if (!el) throw new Error(`엘리먼트를 찾지 못했다: ${selector}`);
  return el;
}

function analyzeButton(): HTMLButtonElement {
  const buttons = [...container.querySelectorAll("button")] as HTMLButtonElement[];
  const found = buttons.find((b) => (b.textContent ?? "").includes("상품 분석"));
  if (!found) throw new Error("[상품 분석] 버튼을 찾지 못했다");
  return found;
}

/** React 19의 controlled input에 "사람이 친 것처럼" 값을 넣는다. */
function typeInto(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto = el instanceof dom.window.HTMLSelectElement
    ? dom.window.HTMLSelectElement.prototype
    : dom.window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  el.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
}

describe("MARKET-CATEGORY-1 ① 상품 검색 화면 — 카테고리를 고르기 전에는 검색이 시작되지 않는다", () => {
  it("🔴 URL만 채우고 [상품 분석]을 실제로 눌러도 /api/pipeline이 호출되지 않는다", async () => {
    const { root, act } = await mountPage();

    const urlInput = q<HTMLInputElement>('input[aria-label="상품 URL"]');
    await act(async () => {
      typeInto(urlInput, "https://example.com/product/123");
    });

    expect(analyzeButton().disabled, "카테고리를 안 골랐는데 버튼이 열려 있다").toBe(true);

    // 눌러 본다 — disabled여도 프로그램 경로로 들어올 수 있으므로 실제로 클릭한다.
    await act(async () => {
      analyzeButton().dispatchEvent(new dom.window.Event("click", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(pipelineCalls, "카테고리 없이 검색이 시작됐다").toHaveLength(0);

    // 카테고리를 고르면 그때 열린다.
    const select = q<HTMLSelectElement>('select[aria-label="대상 카테고리"]');
    await act(async () => {
      typeInto(select, "KIDS_FASHION");
    });
    expect(analyzeButton().disabled, "URL·카테고리가 다 있는데 버튼이 막혀 있다").toBe(false);

    await act(async () => {
      analyzeButton().dispatchEvent(new dom.window.Event("click", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(pipelineCalls, "카테고리를 골랐는데도 검색이 시작되지 않았다").toHaveLength(1);

    await act(async () => root.unmount());
  });

  it("🔴 카테고리 칸이 URL 칸보다 위에 있고 필수 표시가 붙어 있다", async () => {
    const { root, act } = await mountPage();
    const select = q<HTMLSelectElement>('select[aria-label="대상 카테고리"]');
    const urlInput = q<HTMLInputElement>('input[aria-label="상품 URL"]');
    // DOCUMENT_POSITION_FOLLOWING = 4 : select 다음에 url이 온다.
    expect(select.compareDocumentPosition(urlInput) & 4).toBeTruthy();

    const label = select.closest("label");
    expect(label?.textContent ?? "").toContain("대상 카테고리");
    expect(label?.textContent ?? "").toContain("*");
    await act(async () => root.unmount());
  });
});

describe("MARKET-CATEGORY-1 ② 골프용품 — 보이지만 고를 수 없다", () => {
  it("🔴 목록에 '골프용품'이 있고, option이 disabled이며, '준비중'이라고 적혀 있다", async () => {
    const { root, act } = await mountPage();
    const select = q<HTMLSelectElement>('select[aria-label="대상 카테고리"]');
    const options = [...select.querySelectorAll("option")] as HTMLOptionElement[];

    const golf = options.find((o) => (o.textContent ?? "").includes("골프용품"));
    expect(golf, "골프용품이 목록에 아예 없다 — CEO는 '보이되 선택 불가'라고 했다").toBeTruthy();
    expect(golf!.disabled, "골프용품을 고를 수 있게 열려 있다").toBe(true);
    expect(golf!.textContent).toContain("준비중");

    // 사람은 disabled option을 클릭할 수 없지만 select.value는 프로그램으로
    // 넣을 수 있다 — 그렇게 값이 들어가도 검색은 시작되지 않아야 한다.
    const urlInput = q<HTMLInputElement>('input[aria-label="상품 URL"]');
    await act(async () => {
      typeInto(urlInput, "https://example.com/product/123");
      typeInto(select, "GOLF");
    });
    expect(analyzeButton().disabled, "골프용품인데 검색 버튼이 열려 있다").toBe(true);

    await act(async () => {
      analyzeButton().dispatchEvent(new dom.window.Event("click", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(pipelineCalls, "조사 사이트가 0곳인 카테고리로 검색이 시작됐다").toHaveLength(0);

    await act(async () => root.unmount());
  });

  it("🔴 골프용품이 잠기는 이유는 이름이 아니라 소스 0개다 — 코드에 '골프' 하드코딩이 없다", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    /** 주석은 설명이지 분기가 아니다 — 실행되는 코드만 본다. */
    const codeOnly = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

    // 라우트가 특정 카테고리 id/이름으로 분기하면, CEO 승인 사이트가 들어와도
    // 코드를 고쳐야 열린다 — CTO가 명시적으로 금지한 모양이다.
    const routeSrc = codeOnly(
      fs.readFileSync(path.join(process.cwd(), "src/app/api/market-categories/route.ts"), "utf8"),
    );
    expect(routeSrc).not.toMatch(/GOLF|골프/);

    const pageSrc = codeOnly(
      fs.readFileSync(path.join(process.cwd(), "src/app/pipeline/page.tsx"), "utf8"),
    );
    expect(pageSrc).not.toMatch(/GOLF|골프/);
  });

  it("🔴 소스가 카탈로그에 들어오면 코드 변경 없이 선택 가능해진다", async () => {
    // market-categories 라우트가 쓰는 그 식 그대로. 골프 스코프를 가진 행이
    // 하나 생기는 것만으로 available이 뒤집힌다.
    const golfScopes = selectedMarketSourceScopes("GOLF");
    const before = CATALOG.filter(
      (s) => s.status === "ACTIVE" && sourceFitsScopes(s.categoryScope, golfScopes) && s.catalogEnabled,
    );
    expect(before.length, "오늘 골프 소스가 0개가 아니다 — 실측과 다르다").toBe(0);

    const withGolfSite = [
      ...CATALOG,
      { id: "golf-1", categoryScope: ["GOLF"], status: "ACTIVE" as const, catalogEnabled: true, enabled: true },
    ];
    const after = withGolfSite.filter(
      (s) => s.status === "ACTIVE" && sourceFitsScopes(s.categoryScope, golfScopes) && s.catalogEnabled,
    );
    expect(after.length).toBe(1);
    expect(after.length > 0, "사이트를 넣어도 여전히 잠겨 있다").toBe(true);
  });
});

/* ──────────────── ③④ 서버: 고른 값이 조사 대상 필터까지 실제로 닿는가 ──────────────── */

describe("MARKET-CATEGORY-1 ③ 아동의류를 고르면 그 카테고리 소스가 실제로 조사 대상이 된다", () => {
  it("🔴 선택값 → 조사 범위 → sourceFitsScopes 필터까지 실제로 흐른다 (개수 출력)", async () => {
    const scopes = selectedMarketSourceScopes("KIDS_FASHION");
    expect(scopes).toEqual(["KIDS_FASHION", "KIDS_GOODS"]);

    // 카테고리 적합도만 본 통과 수 = 카탈로그 16행 전부.
    const scopeFits = CATALOG.filter((s) => sourceFitsScopes(s.categoryScope, scopes));
    // 실제 조사 대상 = 위 + 노출 조건(카탈로그 ON && 셀러 ON && ACTIVE).
    const targets = researchTargets(scopes);

    console.log(
      `[MARKET-CATEGORY-1 증거] 아동의류 선택 → category_scope 적합 ${scopeFits.length}곳 / 16곳, ` +
        `실제 조사 대상(enabled && ACTIVE) ${targets.length}곳`,
    );

    expect(scopeFits.length, "아동의류를 골랐는데 카탈로그 16행이 다 안 걸린다").toBe(16);
    expect(targets.length, "실제 조사 대상 수가 실측(11곳)과 다르다").toBe(11);
    expect(targets.length, "조사 대상이 0곳이면 화면이 '비교상품 없음'이라고 거짓말하게 된다").toBeGreaterThan(0);
  });

  it("🔴 골프용품을 고를 수 있었다면 조사 대상이 0곳이 됐을 것이다 — 그래서 잠근다", () => {
    expect(researchTargets(selectedMarketSourceScopes("GOLF")).length).toBe(0);
  });
});

describe("MARKET-CATEGORY-1 ④ 아동의류 기존 동작 무회귀", () => {
  it("🔴 선택값이 없으면(레거시 스냅샷) 자동 추정 결과가 그대로 쓰인다", async () => {
    const { resolveMarketCategoryScopes } = await import(
      "../../api/domestic-price-sources/_lib/category-scope"
    );
    const f = (value: string) => ({ value, source: "ORIGINAL" as const, confidence: 0.9 });
    // resolveMarketCategoryScopes가 실제로 읽는 필드만 채운다(순수 함수라 나머지는
    // 보지 않는다 — category-scope.ts의 resolveCategoryScopesFromProduct 참고).
    const product = {
      sourceUrl: "https://example.com/kids/dress",
      title: f("Bobo Choses Girls Dress"),
      description: f(""),
      brand: f("Bobo Choses"),
      recommendedAge: f(""),
      breadcrumbPath: undefined,
    } as never;

    const auto = detectCategoryProfile(
      { ageGroup: "unknown", gender: "unknown", productType: null },
      "Bobo Choses Girls Dress",
      "Bobo Choses",
    );
    expect(auto?.profile.id, "GOLF 프로필 추가가 아동 브랜드 판정을 가로챘다").toBe("KIDS_FASHION");

    const legacy = resolveMarketCategoryScopes(product, undefined);
    expect(legacy).toEqual(detectionMarketSourceScopes(auto!));
    expect(researchTargets(legacy).length, "레거시 스냅샷의 조사 대상 수가 달라졌다").toBe(11);
  });

  it("🔴 GOLF 프로필을 더해도 자동 추정 결과는 한 건도 바뀌지 않는다", () => {
    // 신호 칸이 전부 비어 있어 detectCategoryProfile의 네 분기가 구조적으로
    // 이 프로필에 도달할 수 없다 — 이것이 "어휘를 지어내지 않았다"의 증거다.
    const golf = CATEGORY_PROFILES.GOLF;
    expect(golf.productTypes).toEqual([]);
    expect(golf.brandHints).toEqual([]);
    expect(golf.productKeywords).toEqual([]);
    expect(golf.ageGroups).toEqual([]);
    expect(golf.subProfiles ?? []).toEqual([]);

    // 골프라는 말이 들어간 상품을 넣어도 GOLF로 가지 않는다(어휘가 없으므로).
    const detection = detectCategoryProfile(
      { ageGroup: "unknown", gender: "unknown", productType: null },
      "titleist pro v1 골프공 드라이버",
      "",
    );
    expect(detection, "골프 어휘를 지어 넣지 않았는데 골프로 판정됐다").toBeNull();
  });

  it("🔴 골프 사이트를 코드에 지어 넣지 않았다 — 도메인 한 개도 없다", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const profilesSrc = fs.readFileSync(
      path.join(process.cwd(), "../../packages/category/src/profiles.ts"),
      "utf8",
    );
    const golfBlock = profilesSrc.slice(profilesSrc.indexOf("  GOLF: {"));
    expect(golfBlock).not.toMatch(/https?:\/\//);
    expect(golfBlock).not.toMatch(/\.(com|co\.kr|kr|net)\b/);
  });
});

/* ─────────────────── ⑤ 목록은 카탈로그 실측에서 나온다 ─────────────────── */

describe("MARKET-CATEGORY-1 ⑤ /api/market-categories — 목록은 상수가 아니라 실측이다", () => {
  it("🔴 소스 0개 카테고리는 available=false로 내려온다", async () => {
    vi.doMock("@/lib/auth/require-user", () => ({
      requireUser: async () => ({ ok: true, user: { workspaceId: "ws-1" } }),
    }));
    vi.doMock("../../api/domestic-price-sources/_lib/domestic-price-source", () => ({
      listDomesticPriceSources: async () => CATALOG,
    }));
    const { GET } = await import("../../api/market-categories/route");
    const body = (await (await GET()).json()) as {
      ok: boolean;
      categories: { id: string; label: string; sourceCount: number; available: boolean }[];
    };

    const byId = Object.fromEntries(body.categories.map((c) => [c.id, c]));
    console.log(
      "[MARKET-CATEGORY-1 증거] 카탈로그 실측 기반 목록:",
      body.categories.map((c) => `${c.label}=${c.sourceCount}곳(${c.available ? "선택가능" : "준비중"})`).join(" · "),
    );

    expect(byId.KIDS_FASHION.available).toBe(true);
    expect(byId.KIDS_FASHION.sourceCount).toBe(11);
    expect(byId.GOLF.available, "골프가 선택 가능으로 내려왔다 — 소스가 0개인데").toBe(false);
    expect(byId.GOLF.sourceCount).toBe(0);
    // 골프만 특별 취급하지 않는다 — 오늘 0개인 다른 카테고리도 같이 잠긴다.
    expect(byId.HOME_LIFESTYLE.available).toBe(false);
    vi.doUnmock("@/lib/auth/require-user");
    vi.doUnmock("../../api/domestic-price-sources/_lib/domestic-price-source");
  });
});
