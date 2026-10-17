import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BIG_STEP_LABELS, BIG_STEP_ORDER, resolveWorkflow } from "../workflow";
import { resolveStageFocus } from "../stage-focus";
import { renderToStaticMarkup } from "react-dom/server";
import { productTabElement, type TabOptions } from "./product-tab-composition";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-058 — **소싱 단계·소싱 URL UI 가 제품에서 사라졌다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🟢 소싱의 자리는 **AI 후보 URL → MI → 국내/해외 가격비교** 가 가졌다.
 * 🔴 backend(`sourcing_candidates` · `/api/products/[id]/…` · schema)는 **그대로 둔다** —
 *    참조 관계를 확인하지 않고 지우지 않는다(CPO §1·§5).
 *
 * 🔴🔴 **문자열 grep 으로 지우지 않았다**(CPO §5). 「소싱 국가」(쿠팡 출고지) ·
 *    「국내 소싱」(원가 축) 처럼 **일반 명사로 쓰인 것** 은 제거 대상이 아니다.
 *    기준은 **「사용자에게 소싱이라는 «기능/단계» 를 가리키는가」** 하나다.
 */

const repoRoot = (() => {
  let dir = __dirname;
  for (let i = 0; i < 12; i++) {
    if (existsSync(path.join(dir, "packages", "crawler", "package.json"))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error("repo 루트를 찾지 못했다");
})();
const read = (p: string) => readFileSync(path.join(repoRoot, p), "utf8");
const strip = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

/* ══════════ A. 🔴 상단 Flow 에 소싱 단계가 없다 ══════════ */

describe("A. 상단 Flow", () => {
  it("🔴 큰 단계가 **넷** 이고 소싱이 없다", () => {
    expect([...BIG_STEP_ORDER]).toEqual([
      "COLLECTING",
      "MARKET_JUDGING",
      "REGISTRATION_PREPARING",
      "COMMERCE_REGISTERING",
    ]);
    expect(BIG_STEP_ORDER).toHaveLength(4);
  });

  /** 🔴 라벨에도 「소싱」이 없다 — 셀러가 읽는 글자가 기준이다. */
  it("🔴 단계 라벨에 「소싱」이 없다", () => {
    for (const label of Object.values(BIG_STEP_LABELS)) {
      expect(label).not.toContain("소싱");
    }
  });

  /**
   * 🔴🔴 **빈 단계가 생기지 않았다** — CPO §A-1 이 금지한 상태다.
   *    단계마다 본문 주인공이 «하나씩» 있어야 한다.
   */
  it("🔴🔴 네 단계가 각각 자기 본문을 갖는다 (빈 단계 0)", () => {
    const mains = BIG_STEP_ORDER.map(
      (stage) => resolveStageFocus({ stage, surface: "PRODUCT", marketDetailOpen: false }).main,
    );
    expect(mains).toEqual(["COLLECTION", "MARKET", "PREPARE", "REGISTER"]);
    /** 🔴 중복이 없어야 한다 — 둘이 같은 본문을 가리키면 한쪽이 빈 단계다. */
    expect(new Set(mains).size).toBe(4);
  });

  /** 🟢 번호가 1..4 로 연속한다 — 「잘못된 단계 번호」가 남지 않았다(§A-1). */
  it("🟢 단계 번호가 1~4 로 연속한다", () => {
    const steps = resolveWorkflow({
      collection: { running: false, percent: 100, productReady: true, imageCount: 3, failedImageCount: 0 },
      market: {
        notStarted: false,
        priceProbeDone: true,
        domesticProbeDone: true,
        domesticDataFound: true,
        demandProbeDone: true,
        demandDataFound: true,
        profitabilityDone: true,
        profitabilityFound: true,
        verdictKnown: true,
        verdictLabel: "조건부 판매",
        loadFailed: false,
      },
      prepare: {
        productInfoOk: true,
        productInfoMissing: null,
        optionGroupCount: 1,
        imageCount: 3,
        detailReady: true,
        priceResolved: true,
        priceKrw: 100_000,
        requiredFieldBlockingCount: 0,
      },
      register: { channels: [] },
    }).steps;
    expect(steps.map((s) => s.index)).toEqual([1, 2, 3, 4]);
    expect(steps.map((s) => s.key)).toEqual([...BIG_STEP_ORDER]);
  });
});

/* ══════════ B. 🔴 소싱 UI 진입점이 없다 ══════════ */

describe("B. 소싱 UI 진입점", () => {
  it("🔴 `SourcingPanel` 파일이 없다", () => {
    expect(existsSync(path.join(repoRoot, "apps/admin/src/app/pipeline/commerce/SourcingPanel.tsx"))).toBe(false);
  });

  /** 🔴 운영 코드에 그 컴포넌트를 마운트하는 곳이 없다. */
  it("🔴 StageBody·Workspace 가 소싱을 그리지 않는다", () => {
    const stageBody = strip("apps/admin/src/app/pipeline/commerce/StageBody.tsx");
    const workspace = strip("apps/admin/src/app/pipeline/CommerceWorkspace.tsx");
    for (const src of [stageBody, workspace]) {
      expect(src).not.toContain("SourcingPanel");
      expect(src).not.toMatch(/sourcing/i);
    }
  });

  /**
   * 🔴🔴 **마운트한 DOM 으로 본다** — 소스 검사만으로는 「접혀 있다」와 「없다」를
   *    구분하지 못한다(이 저장소가 반복해서 걸린 함정).
   */
  it("🔴🔴 상품정보 화면 DOM 에 「소싱」·「URL 추가」가 없다", () => {
    /**
     * 🔴 이 하니스는 단계를 `marketDone`/`marketDetailOpen` 으로 몬다(`TabOptions`).
     *    🟢 네 조합을 전부 돌려 **어느 단계에서도** 소싱 잔재가 없음을 본다.
     */
    const cases: TabOptions[] = [
      {},
      { marketDone: true },
      { marketDetailOpen: true },
      { marketDone: true, marketDetailOpen: true },
    ];
    for (const options of cases) {
      const html = renderToStaticMarkup(productTabElement(options));
      expect(html, `${JSON.stringify(options)} 화면에 「소싱」이 남았다`).not.toContain("소싱");
      expect(html, `${JSON.stringify(options)} 화면에 「URL 추가」가 남았다`).not.toContain("URL 추가");
    }
  });
});

/* ══════════ C. 🟢 핵심 루프가 살아 있다 (보호) ══════════ */

describe("C. 핵심 가격비교 루프 보호", () => {
  /** 🔴 소싱 제거가 AI 후보 생산자를 건드리지 않았다. */
  it("🟢 `__url_candidates__` 생산자 계약이 그대로다", () => {
    const leaf = strip("apps/admin/src/app/api/price-history/_lib/transient-candidates.ts");
    expect(leaf).toContain('export const TRANSIENT_URL_SHOP_ID = "__url_candidates__"');
    const runner = strip("apps/admin/src/app/api/price-history/_lib/run-domestic-price-check.ts");
    expect(runner).toContain("if (isTransientShopId(shopId)) return;");
  });

  /** 🟢 두 참고 축이 응답에 그대로 실린다(WU-049 · WU-056). */
  it("🟢 국내/해외 참고가격 응답 칸이 그대로다", () => {
    const route = strip("apps/admin/src/app/api/price-history/check/route.ts");
    const ret = route.slice(route.lastIndexOf("return NextResponse.json({"));
    expect(ret).toContain("overseasReference: intelligence?.candidateOverseasPrice ?? null");
    expect(ret).toContain("domesticReference: intelligence?.candidateDomesticPrice ?? null");
  });

  /** 🟢 가격 신뢰도 owner 와 상세 가격 보존(WU-055)이 그대로다. */
  it("🟢 priceSource detail 계약이 그대로다", () => {
    const facts = strip("packages/crawler/src/comparison-search/product-url-facts.ts");
    expect(facts).toContain('priceSource: priced ? "detail" : null');
    const adapter = strip("packages/crawler/src/comparison-search/price-source-adapter.ts");
    expect(adapter).toContain('c.priceSource === "detail"');
  });

  /** 🟢 보안 경계 파일을 건드리지 않았다. */
  it("🟢 SSRF/DNS 경계가 그대로다", () => {
    const pool = strip("apps/admin/src/app/api/price-history/_lib/url-candidate-pool.ts");
    expect(pool).toContain("classifyOutboundUrl");
    expect(pool).toContain('metrics.dropped.push({ url, reason: "NOT_PUBLIC_HOST" })');
  });
});
