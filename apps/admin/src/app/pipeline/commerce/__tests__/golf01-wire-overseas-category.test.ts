// @vitest-environment jsdom
import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetMarketCollectionsForTests } from "../market-collection";
import { ComparisonShopSearch } from "../ComparisonShopSearch";

/**
 * GOLF-01-WIRE(CEO 지시, 2026-09-16) — **고른 카테고리가 해외 조회까지 간다.**
 *
 * 축 A가 `/api/comparison/search`에 `marketCategoryProfileId`를 받는 자리를
 * 열고 `sourceFitsScopes`로 거르게 만들었는데, **화면이 그 값을 보내지 않았다.**
 * 안 보내면 라우트가 자동 추정으로 내려가고, 골프는 어휘가 비어 있어 `null`이
 * 된다. `null`은 "필터 없음"이라 아동복 소싱처 25곳과 접근이 막힌 GDO·Victoria
 * 까지 전부 조회된다 — CEO가 FAIL로 지정한 바로 그 장면이다.
 *
 * 그래서 여기서 재는 것은 화면 모양이 아니라 **나간 요청 본문**이다. 코드에
 * prop이 적혀 있는지가 아니라, 실제로 마운트했을 때 그 값이 네트워크로 나가는지.
 */

const ROUTE = "/api/comparison/search";

let container: HTMLDivElement;
let root: Root;
let bodies: Array<Record<string, unknown>>;

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    json: async () => payload,
  } as unknown as Response;
}

beforeEach(() => {
  // @ts-expect-error — React가 act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  resetMarketCollectionsForTests();
  bodies = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith(ROUTE)) {
        bodies.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
        return jsonResponse({ ok: true, results: [], sourceVerification: null });
      }
      return jsonResponse({ ok: true, rates: {}, source: "fallback" });
    }),
  );
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  resetMarketCollectionsForTests();
});

async function mountWith(marketCategoryProfileId?: string) {
  await act(async () => {
    root.render(
      createElement(ComparisonShopSearch, {
        title: "PING G440 MAX Driver ALTA J CB BLUE",
        brand: "PING",
        sourceUrl: "https://item.rakuten.co.jp/victoriagolf/108781680014/",
        marketCategoryProfileId,
        open: true,
        onToggle: () => {},
      }),
    );
  });
  // useCollectOnce는 마운트 직후 비동기로 돈다 — 마이크로태스크를 한 번 비운다.
  await act(async () => {
    await Promise.resolve();
  });
}

describe("GOLF-01-WIRE — 고른 카테고리가 해외 조회 요청에 실린다", () => {
  it("🔴 골프용품을 고르면 요청 본문에 marketCategoryProfileId=GOLF 가 실린다", async () => {
    await mountWith("GOLF");
    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies[0]!.marketCategoryProfileId).toBe("GOLF");
    // eslint-disable-next-line no-console
    console.log(`[GOLF-01-WIRE 증거] 나간 본문: ${JSON.stringify(bodies[0])}`);
  });

  it("아동의류를 고르면 KIDS_FASHION 이 그대로 실린다 (회귀)", async () => {
    await mountWith("KIDS_FASHION");
    expect(bodies[0]!.marketCategoryProfileId).toBe("KIDS_FASHION");
  });

  it("미선택(레거시 스냅샷)이면 키를 싣지 않는다 — 라우트의 자동추정 폴백이 그대로 산다", async () => {
    await mountWith(undefined);
    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies[0]!.marketCategoryProfileId).toBeUndefined();
  });

  it("조회는 마운트당 한 번뿐이다 — MI-COLLECTION-GUARD-1", async () => {
    await mountWith("GOLF");
    expect(bodies.length).toBe(1);
  });
});
