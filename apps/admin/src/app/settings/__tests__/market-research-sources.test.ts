import { JSDOM } from "jsdom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { selectedMarketSourceScopes, sourceFitsScopes } from "@commerce/category";

/**
 * GOLF-01 축 A(CEO 지시, 2026-09-15) — 설정 → 시장조사 사이트 관리.
 *
 * ── 왜 정적 렌더 판정을 하지 않나 ─────────────────────────────────────────
 * 이 저장소에서 "확인했다"는 판정이 아홉 번 사실과 달랐고, 전부 테스트 통과로
 * 닫은 것이다. 그래서 여기서는 실제로 jsdom에 설정 페이지를 마운트하고, 실제로
 * 탭을 누르고, 실제로 <select>를 바꾸고, 실제로 [편집샵 추가]를 클릭해서
 * **DOM에 남은 사이트 이름**과 **나간 요청 본문**으로만 판정한다.
 *
 * ── 아래 카탈로그는 지어낸 값이 아니다 ───────────────────────────────────
 * 마이그레이션 051/052 적용 직후(2026-09-15) 살아있는 DB를 SELECT해서 옮긴
 * 값이다. 도메인·카테고리·enabled·access_status 전부 실측 그대로다.
 *   domestic_price_sources 18행 (기존 16 + 골프 2)
 *   comparison_shops       28행 (기존 25 + 골프 3)
 */

const WS_A = "11111111-1111-1111-1111-111111111111";
const WS_B = "22222222-2222-2222-2222-222222222222";

type Access = "OK" | "BLOCKED" | "LOGIN_REQUIRED" | null;

interface DomesticRow {
  id: string;
  name: string;
  domain: string;
  url: string;
  currency: string;
  categoryScope: string[];
  priority: "P0" | "P1" | "P2";
  collectionStrategy: "AUTO_API" | "AUTO_SCRAPE" | "MANUAL" | "NOT_AVAILABLE";
  status: "ACTIVE" | "PAUSED" | "NOT_AVAILABLE" | "ERROR";
  lastErrorMessage: null;
  lastCheckedAt: null;
  lastSuccessAt: null;
  source: "SYSTEM" | "USER";
  enabled: boolean;
  catalogEnabled: boolean;
  workspaceEnabled: boolean;
  accessStatus: Access;
  accessNote: string | null;
  workspaceId: string | null;
}

function dom_(
  domain: string,
  name: string,
  scope: string[],
  catalogEnabled: boolean,
  strategy: DomesticRow["collectionStrategy"] = "MANUAL",
  status: DomesticRow["status"] = "ACTIVE",
  accessStatus: Access = null,
): DomesticRow {
  return {
    id: `d-${domain}`,
    name,
    domain,
    url: `https://${domain}`,
    currency: "KRW",
    categoryScope: scope,
    priority: "P1",
    collectionStrategy: strategy,
    status,
    lastErrorMessage: null,
    lastCheckedAt: null,
    lastSuccessAt: null,
    source: "SYSTEM",
    // 이 목록은 listDomesticPriceSources가 이미 합쳐서 내려준 모양이다
    // (enabled = 카탈로그 ON && 셀러 ON). 셀러 설정이 없는 상태를 재현한다.
    enabled: catalogEnabled,
    catalogEnabled,
    workspaceEnabled: true,
    accessStatus,
    accessNote: null,
    workspaceId: null,
  };
}

/** 실측 18행. 아동 16행 중 카탈로그 ON은 11행이다(29CM·보보쇼즈·무신사·SSF·W컨셉 OFF). */
const DOMESTIC: DomesticRow[] = [
  dom_("29cm.co.kr", "29CM 키즈", ["FASHION_ACCESSORIES", "KIDS_FASHION", "WOMEN_FASHION"], false),
  dom_("bobochoses.com", "Bobo Choses Korea(공식)", ["KIDS_FASHION"], false, "AUTO_API"),
  dom_("chocoel.co.kr", "CHOCO.EL(초코엘)", ["KIDS_FASHION"], true, "AUTO_SCRAPE"),
  dom_("chouchouenfant.kr", "CHOUCHOU ENFANT(슈슈앙팡)", ["KIDS_FASHION"], true),
  dom_("coconjennie.com", "COCO & JENNIE(코코앤제니)", ["KIDS_FASHION"], true),
  dom_("deuxbebe.com", "DEUXBEBE(듀베베)", ["KIDS_FASHION"], true, "AUTO_SCRAPE"),
  dom_("foretforet.com", "포레포레", ["KIDS_FASHION"], true, "AUTO_SCRAPE"),
  dom_("karymarket.com", "KARYMARKET(캐리마켓)", ["KIDS_FASHION"], true),
  dom_("kidikidi.elandmall.co.kr", "키디키디", ["KIDS_FASHION", "KIDS_GOODS"], true),
  dom_("looxloo.com", "LOOXLOO", ["KIDS_FASHION"], true, "AUTO_SCRAPE"),
  dom_("musinsa.com", "무신사 키즈", ["FASHION_ACCESSORIES", "KIDS_FASHION", "WOMEN_FASHION"], false),
  dom_("nokimore.com", "NOKIMORE(노키모어)", ["KIDS_FASHION", "KIDS_GOODS"], true),
  dom_("ocokorea.com", "OCO(오씨오)", ["KIDS_FASHION"], true),
  dom_("rulii.co.kr", "RULII(루리샵)", ["KIDS_FASHION"], true, "AUTO_SCRAPE"),
  dom_("ssfshop.com", "SSF SHOP", ["FASHION_ACCESSORIES", "KIDS_FASHION", "WOMEN_FASHION"], false),
  dom_("wconcept.co.kr", "W컨셉", ["FASHION_ACCESSORIES", "KIDS_FASHION", "WOMEN_FASHION"], false),
  // 052가 넣은 골프 2곳.
  dom_("danawa.com", "다나와", ["GOLF"], true, "MANUAL", "ACTIVE", "OK"),
  dom_(
    "shopping.naver.com",
    "네이버 쇼핑",
    ["GOLF"],
    true,
    "NOT_AVAILABLE",
    "NOT_AVAILABLE",
    "LOGIN_REQUIRED",
  ),
];

interface OverseasRow {
  id: string;
  name: string;
  domain: string;
  url: string;
  country: string | null;
  currency: string | null;
  categoryScope: string[];
  accessStatus: Access;
  accessNote: string | null;
  source: "SYSTEM" | "USER";
  isActive: boolean;
}

function ovs(domain: string, name: string, scope: string[], accessStatus: Access = null): OverseasRow {
  return {
    id: `o-${domain}`,
    name,
    domain,
    url: `https://${domain}`,
    country: null,
    currency: null,
    categoryScope: scope,
    accessStatus,
    accessNote: null,
    source: "SYSTEM",
    isActive: true,
  };
}

/** 실측 28행. 051이 기존 25행에 KIDS_FASHION을 명시적으로 넣었다. */
const KIDS_OVERSEAS_DOMAINS = [
  "alexandalexa.com",
  "babyshop.com",
  "bobochoses.com",
  "bucketsandspades.com.au",
  "childrensalon.com",
  "cissyweras.com",
  "designerkidswear.com",
  "folkberlin.com",
  "isolabellakids.com",
  "junioredition.com",
  "kidbizkid.com",
  "kids-world.com",
  "kidsdepartment.nl",
  "kidsroom.de",
  "luksusbaby.com",
  "melijoe.com",
  "mytheresa.com",
  "nickis.com",
  "pandaandcub.com",
  "petitemaisonkids.com",
  "scoutandcokids.com",
  "shoppiccoliandco.com",
  "smallable.com",
  "studioplay.be",
  "villagekids.co.uk",
];

const OVERSEAS: OverseasRow[] = [
  ...KIDS_OVERSEAS_DOMAINS.map((d) => ovs(d, d, ["KIDS_FASHION"])),
  ovs("shop.golfdigest.co.jp", "GDO 골프샵", ["GOLF"], "BLOCKED"),
  ovs("victoriagolf.co.jp", "Victoria Golf", ["GOLF"], "BLOCKED"),
  ovs("rakuten.co.jp", "Rakuten 市場", ["GOLF"], "OK"),
];

/* ══════════════════════ ① /api/market-categories — 실측 카탈로그로 센다 ══════════════════════ */

interface CategoryPayload {
  id: string;
  label: string;
  sourceCount: number;
  catalogSourceCount: number;
  overseasSourceCount: number;
  available: boolean;
}

async function callMarketCategories(): Promise<CategoryPayload[]> {
  vi.resetModules();
  vi.doMock("@/lib/auth/require-user", () => ({
    requireUser: async () => ({ ok: true, user: { workspaceId: WS_A } }),
  }));
  vi.doMock("../../api/domestic-price-sources/_lib/domestic-price-source", () => ({
    listDomesticPriceSources: async () => DOMESTIC,
  }));
  // isCollectableAccess는 진짜를 써야 한다 — 그게 이번에 판정을 바꾸는 함수다.
  vi.doMock("../../api/comparison-shops/_lib/comparison-shop", async () => {
    const actual = await vi.importActual<typeof import("../../api/comparison-shops/_lib/comparison-shop")>(
      "../../api/comparison-shops/_lib/comparison-shop",
    );
    return { ...actual, listComparisonShops: async () => OVERSEAS };
  });
  const { GET } = await import("../../api/market-categories/route");
  const body = (await (await GET()).json()) as { categories: CategoryPayload[] };
  vi.doUnmock("@/lib/auth/require-user");
  vi.doUnmock("../../api/domestic-price-sources/_lib/domestic-price-source");
  vi.doUnmock("../../api/comparison-shops/_lib/comparison-shop");
  return body.categories;
}

let CATEGORIES: CategoryPayload[] = [];

beforeAll(async () => {
  CATEGORIES = await callMarketCategories();
  console.log(
    "[GOLF-01 증거] 실측 카탈로그 기반 카테고리 목록: " +
      CATEGORIES.map(
        (c) =>
          `${c.label}=국내 ${c.sourceCount}곳/해외 ${c.overseasSourceCount}곳(${c.available ? "선택가능" : "준비중"})`,
      ).join(" · "),
  );
});

describe("GOLF-01 ① 카테고리별 조사 대상 수 — 등록됐다고 세지 않는다", () => {
  it("🔴 아동의류는 11곳 그대로다(회귀)", () => {
    const kids = CATEGORIES.find((c) => c.id === "KIDS_FASHION")!;
    expect(kids.sourceCount, "아동의류 국내 조사 대상 수가 실측 11곳에서 달라졌다").toBe(11);
    expect(kids.catalogSourceCount).toBe(11);
    expect(kids.available).toBe(true);
    // 051이 기존 25행에 KIDS_FASHION을 명시적으로 넣었으므로 해외도 그대로다.
    expect(kids.overseasSourceCount, "아동 해외 편집샵 25곳이 달라졌다").toBe(25);
  });

  it("🔴 골프용품이 열렸다 — 그리고 막힌 3곳은 세지 않는다", () => {
    const golf = CATEGORIES.find((c) => c.id === "GOLF")!;
    expect(golf.available, "골프 소스를 넣었는데 여전히 준비중이다").toBe(true);
    // 다나와만 센다. 네이버 쇼핑은 LOGIN_REQUIRED(+status NOT_AVAILABLE)라 빠진다.
    expect(golf.sourceCount, "로그인이 막는 사이트를 조사 대상으로 셌다").toBe(1);
    // Rakuten만 센다. GDO·Victoria는 BLOCKED라 빠진다.
    expect(golf.overseasSourceCount, "403으로 막힌 사이트를 조사 대상으로 셌다").toBe(1);
  });

  it("🔴 골프에 아동의류 소스가 한 곳도 섞이지 않는다", () => {
    const golfScopes = selectedMarketSourceScopes("GOLF");
    const domesticFit = DOMESTIC.filter((s) => sourceFitsScopes(s.categoryScope, golfScopes));
    const overseasFit = OVERSEAS.filter((s) => sourceFitsScopes(s.categoryScope, golfScopes));
    expect(domesticFit.map((s) => s.domain).sort()).toEqual(["danawa.com", "shopping.naver.com"]);
    expect(overseasFit.map((s) => s.domain).sort()).toEqual([
      "rakuten.co.jp",
      "shop.golfdigest.co.jp",
      "victoriagolf.co.jp",
    ]);
    // 반대 방향도 본다 — 골프 3곳이 아동 조사에 섞여 들어가지도 않는다.
    const kidsScopes = selectedMarketSourceScopes("KIDS_FASHION");
    expect(OVERSEAS.filter((s) => sourceFitsScopes(s.categoryScope, kidsScopes))).toHaveLength(25);
  });
});

/* ══════════════════════ ② 해외 검색 라우트 — 막힌 곳을 부르지 않는다 ══════════════════════ */

describe("GOLF-01 ② /api/comparison/search — 카테고리로 좁히고 막힌 곳은 호출하지 않는다", () => {
  async function searchWith(marketCategoryProfileId: string | null) {
    vi.resetModules();
    const calledDomains: string[][] = [];
    vi.doMock("@commerce/crawler", () => ({
      searchComparisonShops: async (_q: unknown, shops: { domain: string }[]) => {
        calledDomains.push(shops.map((s) => s.domain));
        return [];
      },
      verifySourcePriceDirect: async () => ({ status: "NOT_APPLICABLE", price: null, regularPrice: null }),
      attachProductMatchTruth: (_q: unknown, r: unknown) => r,
    }));
    vi.doMock("../../api/comparison-shops/_lib/comparison-shop", async () => {
      const actual = await vi.importActual<typeof import("../../api/comparison-shops/_lib/comparison-shop")>(
        "../../api/comparison-shops/_lib/comparison-shop",
      );
      return { ...actual, listComparisonShops: async () => OVERSEAS };
    });
    const { POST } = await import("../../api/comparison/search/route");
    await POST(
      new Request("http://localhost/api/comparison/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "TaylorMade Qi10 Driver 10.5",
          ...(marketCategoryProfileId ? { marketCategoryProfileId } : {}),
        }),
      }),
    );
    vi.doUnmock("@commerce/crawler");
    vi.doUnmock("../../api/comparison-shops/_lib/comparison-shop");
    return calledDomains[0] ?? [];
  }

  it("🔴 골프용품을 고르면 아동복 편집샵 25곳이 한 곳도 조회되지 않는다", async () => {
    const domains = await searchWith("GOLF");
    console.log(`[GOLF-01 증거] 골프 선택 → 해외 조회 대상 ${domains.length}곳: ${domains.join(", ")}`);
    expect(domains, "차단된 사이트를 호출했다 / 아동복이 섞였다").toEqual(["rakuten.co.jp"]);
    for (const kid of KIDS_OVERSEAS_DOMAINS) expect(domains).not.toContain(kid);
  });

  it("🔴 아동 상품은 예전처럼 25곳 전부 조회된다(회귀)", async () => {
    const domains = await searchWith("KIDS_FASHION");
    expect(domains).toHaveLength(25);
    expect(domains).not.toContain("rakuten.co.jp");
  });
});

/* ══════════════════════ ③ 설정 화면 — 진짜로 마운트하고 진짜로 누른다 ══════════════════════ */

let dom: JSDOM;
let container: HTMLDivElement;
let posts: { url: string; body: string }[];

/** 설정 화면의 다른 섹션(쿠팡 계정·배송 프로필·브랜드·템플릿·네이버·LotteON)이
 *  마운트 때 읽는 최소 모양. 이 테스트의 관심사가 아니라 전부 빈 값이다 —
 *  다만 undefined를 주면 loadAll()이 터져서 화면이 뜨지 않으므로 껍데기는 준다. */
const EMPTY_SETTINGS = {
  ok: true,
  configured: false,
  missing: [],
  values: { accessKeyMasked: null, secretKeySaved: false, vendorId: null, vendorUserId: null, sellerId: null, clientIdMasked: null, clientSecretSaved: false, apiKeySaved: false },
  profiles: [],
  templates: [],
  // /api/platform-status
  soon: [],
  fields: [],
};

beforeEach(() => {
  dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "http://localhost/settings",
  });
  const w = dom.window as unknown as Window & typeof globalThis;
  Object.defineProperty(globalThis, "navigator", { value: w.navigator, configurable: true, writable: true });
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

  posts = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : String(input);
    const json = (v: unknown) =>
      new Response(JSON.stringify(v), { headers: { "Content-Type": "application/json" } });
    if (init?.method === "POST") posts.push({ url, body: String(init.body ?? "") });
    if (url.includes("/api/market-categories")) return json({ ok: true, categories: CATEGORIES });
    if (url.includes("/api/domestic-price-sources")) return json({ sources: DOMESTIC, ok: true });
    if (url.includes("/api/comparison-shops")) return json({ shops: OVERSEAS, ok: true });
    // 플랫폼 지원 현황 표는 이 테스트의 관심사가 아니다 — null이면 화면이
    // "불러오지 못했습니다"만 그리고 넘어간다(형태를 흉내 내지 않는다).
    if (url.includes("/api/platform-status")) return json(null);
    // 설정 화면의 나머지 섹션들 — 이 테스트의 관심사가 아니므로 빈 값으로 연다.
    return json(EMPTY_SETTINGS);
  }) as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function mountSettings() {
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { act } = await import("react");
  const SettingsPage = (await import("../page")).default;

  const root = createRoot(container);
  await act(async () => {
    root.render(React.createElement(SettingsPage));
  });
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

function typeInto(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto =
    el instanceof dom.window.HTMLSelectElement
      ? dom.window.HTMLSelectElement.prototype
      : dom.window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  el.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
}

/** 제목으로 섹션을 찾는다 — 국내/해외 두 목록이 같은 화면에 있으므로 눈에
 *  보이는 제목으로 가른다(테스트용 id를 새로 심지 않는다). */
function sectionByHeading(text: string): HTMLElement {
  const section = [...container.querySelectorAll("section")].find((s) =>
    (s.querySelector("h2")?.textContent ?? "").includes(text),
  );
  if (!section) throw new Error(`섹션을 찾지 못했다: ${text}`);
  return section as HTMLElement;
}

/** 목록의 각 줄에서 **사이트 이름 한 칸**만 뽑는다. 같은 줄의 배지("조사완료"
 *  "내가 추가")도 font-medium이라 줄 단위로 첫 칸만 읽는다. */
function shopNamesIn(headingText: string): string[] {
  return [...sectionByHeading(headingText).querySelectorAll("li")].map(
    (li) => li.querySelector("span.font-medium")?.textContent ?? "",
  );
}

describe("GOLF-01 ③ 설정 → 시장조사 사이트 관리 — 카테고리를 고르면 그 사이트만 보인다", () => {
  it("🔴 [골프용품]을 고르면 국내는 골프 2곳만, 해외는 골프 3곳만 남는다", async () => {
    const { root, act } = await mountSettings();

    // 탭을 실제로 누른다.
    const tab = [...container.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes("시장조사 사이트 관리"),
    );
    expect(tab, "시장조사 사이트 관리 탭이 없다").toBeTruthy();
    await act(async () => {
      tab!.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));
    });

    // 카테고리를 고르기 전 — 전체가 보인다.
    expect(shopNamesIn("국내 편집샵 후보 목록")).toHaveLength(18);
    expect(shopNamesIn("편집샵(Seller) 목록")).toHaveLength(28);

    const select = q<HTMLSelectElement>('select[aria-label="시장조사 카테고리"]');
    await act(async () => {
      typeInto(select, "GOLF");
      await new Promise((r) => setTimeout(r, 0));
    });

    const domesticNames = shopNamesIn("국내 편집샵 후보 목록");
    const overseasNames = shopNamesIn("편집샵(Seller) 목록");
    console.log(
      `[GOLF-01 증거] 설정 화면 [골프용품] 선택 → 국내 ${domesticNames.length}곳(${domesticNames.join(", ")}) · ` +
        `해외 ${overseasNames.length}곳(${overseasNames.join(", ")})`,
    );

    expect(domesticNames.sort()).toEqual(["네이버 쇼핑", "다나와"]);
    expect(overseasNames.sort()).toEqual(["GDO 골프샵", "Rakuten 市場", "Victoria Golf"]);
    // 🔴 아동복이 한 곳이라도 남아 있으면 FAIL이다.
    for (const kid of ["포레포레", "LOOXLOO", "melijoe.com", "smallable.com"]) {
      expect([...domesticNames, ...overseasNames]).not.toContain(kid);
    }

    await act(async () => root.unmount());
  });

  it("🔴 [아동의류]를 고르면 기존 사이트가 그대로 보인다(회귀)", async () => {
    const { root, act } = await mountSettings();
    const select = q<HTMLSelectElement>('select[aria-label="시장조사 카테고리"]');
    await act(async () => {
      typeInto(select, "KIDS_FASHION");
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(shopNamesIn("국내 편집샵 후보 목록")).toHaveLength(16);
    expect(shopNamesIn("편집샵(Seller) 목록")).toHaveLength(25);
    await act(async () => root.unmount());
  });

  it("🔴 막힌 사이트는 화면이 '접근 차단' · '로그인 필요'라고 그대로 말한다", async () => {
    const { root, act } = await mountSettings();
    const select = q<HTMLSelectElement>('select[aria-label="시장조사 카테고리"]');
    await act(async () => {
      typeInto(select, "GOLF");
      await new Promise((r) => setTimeout(r, 0));
    });

    const domesticText = sectionByHeading("국내 편집샵 후보 목록").textContent ?? "";
    const overseasText = sectionByHeading("편집샵(Seller) 목록").textContent ?? "";
    expect(domesticText, "로그인이 막는 사이트를 화면이 말하지 않는다").toContain("로그인 필요");
    expect(domesticText, "다나와가 수집 가능이라고 말하지 않는다").toContain("수집 가능");
    expect(overseasText, "403으로 막힌 사이트를 화면이 말하지 않는다").toContain("접근 차단");
    expect(overseasText).toContain("조사 대상에서 자동 제외됩니다");

    await act(async () => root.unmount());
  });

  it("🔴 [편집샵 추가]를 실제로 눌렀을 때 고른 카테고리가 요청에 실린다", async () => {
    const { root, act } = await mountSettings();
    const select = q<HTMLSelectElement>('select[aria-label="시장조사 카테고리"]');
    await act(async () => {
      typeInto(select, "GOLF");
      await new Promise((r) => setTimeout(r, 0));
    });

    const section = sectionByHeading("국내 편집샵 후보 목록");
    const urlInput = [...section.querySelectorAll("input")].find(
      (i) => (i as HTMLInputElement).placeholder?.startsWith("https://"),
    ) as HTMLInputElement;
    await act(async () => {
      typeInto(urlInput, "https://my-golf-shop.co.kr");
    });
    const addButton = [...section.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes("편집샵 추가"),
    ) as HTMLButtonElement;
    expect(addButton.disabled).toBe(false);
    await act(async () => {
      addButton.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));
    });

    const post = posts.find((p) => p.url.includes("/api/domestic-price-sources"));
    expect(post, "[편집샵 추가]를 눌렀는데 요청이 나가지 않았다").toBeTruthy();
    const payload = JSON.parse(post!.body) as { url: string; categoryScope?: string[] };
    console.log(`[GOLF-01 증거] 사이트 추가 요청 본문: ${post!.body}`);
    expect(payload.categoryScope, "고른 카테고리가 추가 요청에 실리지 않았다 — 연결되지 않는다").toEqual([
      "GOLF",
    ]);

    await act(async () => root.unmount());
  });

  it("🔴 셀러가 추가한 사이트인지 화면이 구분해서 말한다", async () => {
    // 내가 추가한 사이트 한 줄을 목록에 섞어서 배지가 실제로 붙는지 본다.
    const mine: DomesticRow = {
      ...dom_("my-golf-shop.co.kr", "내 골프샵", ["GOLF"], true),
      source: "USER",
      workspaceId: WS_A,
    };
    const base = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : String(input);
      if (url.includes("/api/domestic-price-sources")) {
        return new Response(JSON.stringify({ sources: [...DOMESTIC, mine] }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return base(input, init);
    }) as typeof fetch;

    const { root, act } = await mountSettings();
    const select = q<HTMLSelectElement>('select[aria-label="시장조사 카테고리"]');
    await act(async () => {
      typeInto(select, "GOLF");
      await new Promise((r) => setTimeout(r, 0));
    });
    const text = sectionByHeading("국내 편집샵 후보 목록").textContent ?? "";
    expect(text).toContain("내 골프샵");
    expect(text, "내가 추가한 사이트를 중앙 기본 사이트와 구분해서 말하지 않는다").toContain("내가 추가");
    expect(text).toContain("내 계정에만 보입니다");
    await act(async () => root.unmount());
  });
});

/* ══════════════════════ ④ 셀러 격리 — 남의 추가분은 내 목록에 없다 ══════════════════════ */

describe("GOLF-01 ④ 판매자 추가 사이트는 그 판매자만 본다", () => {
  it("🔴 목록 조회에 소유자 조건이 실제로 걸린다", async () => {
    vi.resetModules();
    const orExpressions: string[] = [];
    const chain = (table: string) => {
      const c: Record<string, unknown> = {};
      const self = () => c;
      Object.assign(c, {
        select: self,
        order: self,
        eq: self,
        or: (expr: string) => {
          orExpressions.push(`${table}:${expr}`);
          return c;
        },
        then: (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null }),
      });
      return c;
    };
    vi.doMock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({ from: chain }) }));
    const { listDomesticPriceSources } = await import(
      "../../api/domestic-price-sources/_lib/domestic-price-source"
    );
    await listDomesticPriceSources(WS_B);
    vi.doUnmock("@/lib/supabase-admin");

    console.log(`[GOLF-01 증거] 목록 조회 필터: ${orExpressions.join(" | ")}`);
    expect(
      orExpressions.some((e) => e === `domestic_price_sources:workspace_id.is.null,workspace_id.eq.${WS_B}`),
      "목록 조회가 소유자 조건 없이 카탈로그 전 행을 읽는다 — 남의 추가분이 그대로 보인다",
    ).toBe(true);
  });

  it("🔴 추가 요청은 요청자의 workspace를 반드시 실어 보낸다", async () => {
    vi.resetModules();
    const inserted: Record<string, unknown>[] = [];
    const chain = () => {
      const c: Record<string, unknown> = {};
      const self = () => c;
      Object.assign(c, {
        select: self,
        order: self,
        eq: self,
        or: self,
        maybeSingle: async () => ({ data: null, error: null }),
        insert: (row: Record<string, unknown>) => {
          inserted.push(row);
          return {
            select: () => ({
              single: async () => ({ data: { ...row, id: "new", created_at: "2026-01-01T00:00:00.000Z" }, error: null }),
            }),
          };
        },
      });
      return c;
    };
    vi.doMock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({ from: chain }) }));
    vi.doMock("@/lib/auth/require-user", () => ({
      requireUser: async () => ({ ok: true, user: { workspaceId: WS_B } }),
    }));
    const { POST } = await import("../../api/domestic-price-sources/route");
    await POST(
      new Request("http://localhost/api/domestic-price-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://my-golf-shop.co.kr", categoryScope: ["GOLF"] }),
      }),
    );
    vi.doUnmock("@/lib/supabase-admin");
    vi.doUnmock("@/lib/auth/require-user");

    expect(inserted).toHaveLength(1);
    expect(inserted[0].workspace_id, "셀러 추가분이 임자 없이 공용 카탈로그에 들어간다").toBe(WS_B);
    expect(inserted[0].category_scope).toEqual(["GOLF"]);
  });
});
