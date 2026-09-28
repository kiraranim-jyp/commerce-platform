// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LotteOnDeliveryMapping } from "../LotteOnDeliveryMapping";
import { stubRoutes } from "./route-contract";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * RENDER RECHECK — **그려진 DOM 으로 닫는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 가 이 한 항목 때문에 PRE-CHECK 를 보류했다. 이유가 정확하다 —
 * 이 스프린트에서 「조건은 있는데 실제로는 발동하지 않음」이 두 번 났다.
 *
 *   ① ⑤배송 picker 숨김   sellerFixed 가 언제나 null 이라 한 번도 참이 안 됐다
 *   ② 067 컬럼            화면 타입이 몰라 판단 자체가 불가능했다
 *
 * 그래서 여기서는 `useEffect → fetch → 실제 DOM` 전 구간을 마운트해서 본다.
 * 코드에 fetch 가 있는지, 타입이 있는지는 «증거가 아니다».
 */

const LISTS = {
  ok: true,
  outboundPlaces: [{ no: "PLO3837441", name: "Hessen 물류센터" }],
  returnPlaces: [{ no: "PLO-R", name: "반품주소지" }],
  costPolicies: [{ no: "4279402", name: "업체배송 19800원" }],
  couriers: [{ code: "EP", name: "우체국택배" }],
  deliveryRegionGroups: [{ code: "GN101", name: "전국" }],
};

let container: HTMLDivElement;
let root: Root;
const puts: unknown[] = [];

/**
 * 🔴 P0-2(CPO, 2026-09-28) — 스텁이 «URL 만» 보고 대답하면 안 된다.
 *
 * 예전 이 스텁은 URL 만 맞으면 POST 로 부르든 GET 으로 부르든 목록을 돌려줬다.
 * 그래서 Production 에서 405 로 죽어 있던 화면이 여기서는 «11건 전부 통과» 했다.
 * 라우트가 실제로 내보내는 핸들러만 응답하게 바꾼다 — 없는 메서드는 405.
 */
function stubFetch(opts: { listsOk?: boolean; saved?: Record<string, unknown> } = {}) {
  const { listsOk = true, saved = {} } = opts;
  const calls = stubRoutes([
    {
      path: "/api/lotteon/delivery-settings",
      // 라우트 파일이 내보내는 것은 GET 하나뿐이다(route.ts:140).
      handlers: {
        GET: () =>
          listsOk
            ? { body: LISTS }
            : { ok: false, status: 200, body: { ok: false, message: "롯데ON에 연결하지 못했습니다." } },
      },
    },
    {
      path: "/api/settings/lotteon-seller",
      handlers: {
        GET: () => ({ body: { ok: true, values: saved } }),
        PUT: ({ body }) => {
          puts.push(body);
          return { body: { ok: true, values: saved } };
        },
      },
    },
  ]);
  return calls;
}

async function mount(): Promise<HTMLElement> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(LotteOnDeliveryMapping));
  });
  /* 🔴 useEffect 안의 fetch 가 «끝난 뒤» 의 화면을 본다. 이 한 틱을 빼면
     로딩 화면을 보고 「그려졌다」고 말하게 된다. */
  await act(async () => {
    await Promise.resolve();
  });
  return container;
}

beforeEach(() => {
  // @ts-expect-error — act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  puts.length = 0;
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const text = (el: HTMLElement) => (el.textContent ?? "").replace(/\s+/g, " ");

describe("⓪ 🔴 HTTP 계약 — 화면이 부르는 메서드가 라우트에 «있는가»", () => {
  /*
   * 이 한 칸이 없어서 Production 에서 화면이 죽어 있는 동안 아래 11건이 전부
   * 통과했다. 스텁이 URL 만 보고 대답했기 때문이다.
   *
   *   route.ts                 export async function GET()   ← 이것뿐
   *   LotteOnDeliveryMapping   fetch(..., { method: "POST" }) → 405
   *
   * 이제 스텁이 Next.js 처럼 405 를 돌려주므로, 메서드가 어긋나면 아래가 무너진다.
   * 그래도 «무엇이 어긋났는지» 를 바로 말해 주는 칸을 따로 둔다 — 11건이 한꺼번에
   * 깨지면 원인을 찾는 데 시간이 걸린다.
   */
  it("목록 조회는 GET 이고, 405 를 맞지 않는다", async () => {
    const calls = stubFetch();
    await mount();
    const list = calls.filter((c) => c.path === "/api/lotteon/delivery-settings");
    expect(list.length, "목록 조회를 부르지 않았다").toBeGreaterThan(0);
    for (const c of list) {
      expect(c.method, "라우트에 없는 메서드로 불렀다").toBe("GET");
      expect(c.status, "405 — 라우트 계약과 어긋난다").not.toBe(405);
    }
  });

  it("저장은 PUT 이고, 405 를 맞지 않는다", async () => {
    const calls = stubFetch();
    const el = await mount();
    const first = el.querySelectorAll("select")[0] as HTMLSelectElement;
    await act(async () => {
      first.value = "PLO3837441";
      first.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const saves = calls.filter((c) => c.path === "/api/settings/lotteon-seller");
    expect(saves.some((c) => c.method === "PUT"), "저장을 PUT 으로 부르지 않았다").toBe(true);
    expect(saves.every((c) => c.status !== 405)).toBe(true);
  });

  /* 🔴 스텁 자체가 «실제로» 405 를 낼 수 있는지 본다. 이것이 참이 아니면
     위 두 칸은 아무것도 증명하지 않는다(내가 이 스프린트에서 두 번 당했다). */
  it("스텁은 라우트에 없는 메서드에 405 를 준다", async () => {
    stubFetch();
    const res = await fetch("/api/lotteon/delivery-settings", { method: "POST" });
    expect(res.status).toBe(405);
    expect(res.ok).toBe(false);
  });
});

describe("① 영역이 «실제로» 그려진다", () => {
  it("여섯 줄이 DOM 에 선다", async () => {
    stubFetch();
    const el = await mount();
    expect(el.querySelector('[data-lotteon-delivery-mapping="true"]')).not.toBeNull();
    for (const label of ["출고지", "반품지", "배송비 정책", "배송 가능 지역", "택배사", "반품 택배사"]) {
      expect(text(el), label).toContain(label);
    }
    expect(el.querySelectorAll("select")).toHaveLength(6);
  });

  it("목록이 롯데ON 이 준 «이름» 으로 보인다", async () => {
    stubFetch();
    const el = await mount();
    expect(text(el)).toContain("Hessen 물류센터");
    expect(text(el)).toContain("우체국택배");
  });
});

describe("② 저장값이 «화면에» 표시된다", () => {
  it("연결된 줄은 ✓ 연결됨 + 이름을 보여준다", async () => {
    stubFetch({ saved: { outboundPlaceNo: "PLO3837441", outboundPlaceLabel: "Hessen 물류센터" } });
    const el = await mount();
    expect(text(el)).toContain("✓ 연결됨");
    expect(text(el)).toContain("Hessen 물류센터");
    const first = el.querySelectorAll("select")[0] as HTMLSelectElement;
    expect(first.value).toBe("PLO3837441");
  });

  it("저장값이 없으면 «연결 필요» 로 선다 — 조용히 넘어가지 않는다", async () => {
    stubFetch();
    const el = await mount();
    expect(text(el)).toContain("연결 필요");
    expect(text(el)).not.toContain("✓ 연결됨");
  });
});

describe("③ 🔴 조회 실패가 «선택 안 함» 으로 위장되지 않는다", () => {
  it("실패라고 말하고 다시 불러오기를 준다", async () => {
    stubFetch({ listsOk: false });
    const el = await mount();
    expect(text(el)).toContain("연결하지 못했습니다");
    const retry = Array.from(el.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("다시 불러오기"),
    );
    expect(retry, "다시 불러오기 버튼이 화면에 없다").toBeDefined();
  });

  it("실패했을 때 고르는 select 를 그리지 «않는다»", async () => {
    stubFetch({ listsOk: false });
    const el = await mount();
    expect(el.querySelectorAll("select")).toHaveLength(0);
  });
});

describe("④ 🔴 내부 코드가 화면에 «없다»", () => {
  it("롯데ON 번호가 글자로 나오지 않는다", async () => {
    stubFetch({ saved: { outboundPlaceNo: "PLO3837441", outboundPlaceLabel: "Hessen 물류센터" } });
    const el = await mount();
    /* 🔴 빈 DOM 이면 아래 not.toContain 은 «저절로» 통과한다 — 그 함정을 먼저 막는다.
       그려졌고, 값도 물려 있고, 그럼에도 번호가 글자로 없다는 것이 증거다. */
    expect(text(el)).toContain("Hessen 물류센터");
    expect((el.querySelectorAll("select")[0] as HTMLSelectElement).value).toBe("PLO3837441");
    expect(text(el)).not.toContain("PLO3837441");
    expect(text(el)).not.toContain("4279402");
  });

  it("코드를 적는 입력칸이 없다", async () => {
    stubFetch();
    const el = await mount();
    expect(el.querySelectorAll("select")).toHaveLength(6); // 그려진 상태에서 본다
    expect(el.querySelectorAll('input[type="text"]')).toHaveLength(0);
  });
});

describe("⑤ 고르면 «즉시» 저장된다", () => {
  it("select 를 바꾸면 PUT 이 나가고 여섯 값이 함께 실린다", async () => {
    stubFetch();
    const el = await mount();
    const first = el.querySelectorAll("select")[0] as HTMLSelectElement;
    await act(async () => {
      first.value = "PLO3837441";
      first.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(puts).toHaveLength(1);
    const body = puts[0] as Record<string, unknown>;
    expect(body.outboundPlaceNo).toBe("PLO3837441");
    /* 🔴 이름도 함께 저장해야 다음에 열었을 때 코드가 아니라 이름이 보인다. */
    expect(body.outboundPlaceLabel).toBe("Hessen 물류센터");
    /* 🔴 한 칸만 보내면 나머지가 지워진다 — 여섯 값을 통째로 보낸다. */
    expect(Object.keys(body)).toContain("courierCode");
    expect(Object.keys(body)).toContain("returnCourierCode");
  });

  /* 🔴 CPO ⑦: 「저장 후 새로고침해도 값이 유지되는가」. 화면 state 가 바뀐 것과
     다음에 열었을 때 그대로인 것은 «다른 일» 이다 — 언마운트하고 다시 연다. */
  it("저장한 뒤 다시 열어도 그 값이 서 있다", async () => {
    stubFetch();
    const el = await mount();
    const first = el.querySelectorAll("select")[0] as HTMLSelectElement;
    await act(async () => {
      first.value = "PLO3837441";
      first.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const persisted = puts[0] as Record<string, unknown>;

    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();

    /* 서버가 방금 저장한 것을 그대로 돌려준다 — 새로고침한 셀러가 보는 것. */
    stubFetch({ saved: persisted });
    const again = await mount();
    expect(text(again)).toContain("✓ 연결됨");
    expect(text(again)).toContain("Hessen 물류센터");
    expect((again.querySelectorAll("select")[0] as HTMLSelectElement).value).toBe("PLO3837441");
    expect(text(again)).not.toContain("PLO3837441"); // 값으로만 남고 글자로는 없다
  });

  it("저장 뒤 화면이 «연결됨» 으로 바뀐다", async () => {
    stubFetch();
    const el = await mount();
    const first = el.querySelectorAll("select")[0] as HTMLSelectElement;
    await act(async () => {
      first.value = "PLO3837441";
      first.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(text(el)).toContain("✓ 연결됨");
    expect(text(el)).toContain("자동 적용됩니다");
  });
});
