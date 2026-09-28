// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LotteOnDeliveryMapping } from "../LotteOnDeliveryMapping";
import { stubRoutes } from "./route-contract";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * STEP 3 — **공통 택배사가 롯데ON 코드로 «자동으로» 이어진다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 배송 프로필에 「우체국택배」가 있는데 여기서 또 고르게 하면, 그것이 이 스프린트가
 * 없애려던 「공통에 있는 값을 다시 묻는」 자리다.
 *
 * 🔴 완전 일치만이다. 실응답이 그 이유를 보여준다 —
 *      0001 롯데택배   vs  0055 롯데택배 해외특송
 *      0002 CJ대한통운 vs  0056 CJ대한통운 국제특송
 *
 * 🔴 그리고 이 파일은 «저장이 반복되지 않는지» 를 본다. 자동 매핑을 useEffect 로
 * 걸면 저장 → saved 변경 → 다시 저장 으로 돌 수 있다. 그것이 실제 위험이다.
 */

/** 🔴 실응답(2026-09-28)에서 이 검사에 필요한 부분만 — 오매칭 후보를 «포함» 한다. */
const COURIERS = [
  { code: "0001", name: "롯데택배" },
  { code: "0002", name: "CJ대한통운" },
  { code: "0004", name: "우체국택배" },
  { code: "0042", name: "GS Postbox 택배" },
  { code: "0055", name: "롯데택배 해외특송" },
  { code: "0056", name: "CJ대한통운 국제특송" },
];

const LISTS = {
  ok: true,
  outboundPlaces: [{ no: "PLO3837441", name: "PLO3837441_출고지__Am Holzweg 28-34|Hessen" }],
  returnPlaces: [{ no: "PLO3837441", name: "PLO3837441_회수지_12921_경기 하남시" }],
  costPolicies: [{ no: "4279402", name: "4279402 / 업체배송_배송비 유료 19800원" }],
  couriers: COURIERS,
  deliveryRegionGroups: [{ code: "GN000", name: "전국" }],
};

let container: HTMLDivElement;
let root: Root;
let serverValues: Record<string, unknown>;
let putBodies: Record<string, unknown>[];

function stub() {
  return stubRoutes([
    { path: "/api/lotteon/delivery-settings", handlers: { GET: () => ({ body: LISTS }) } },
    {
      path: "/api/settings/lotteon-seller",
      handlers: {
        GET: () => ({ body: { ok: true, values: serverValues } }),
        PUT: ({ body }) => {
          putBodies.push(body as Record<string, unknown>);
          serverValues = body as Record<string, unknown>;
          return { body: { ok: true } };
        },
      },
    },
  ]);
}

async function mount(commonCarrier: string | null) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(LotteOnDeliveryMapping, { commonCarrier }));
  });
  /* useEffect → fetch → 자동 매핑 → PUT 까지 흐르게 한다. */
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
  return container;
}

beforeEach(() => {
  // @ts-expect-error — act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  serverValues = {};
  putBodies = [];
  stub();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const text = (el: HTMLElement) => (el.textContent ?? "").replace(/\s+/g, " ");
const state = (el: HTMLElement) =>
  el.querySelector("[data-lotteon-carrier-match]")?.getAttribute("data-lotteon-carrier-match") ?? null;

describe("① exact match 성공 — 셀러가 고르지 않는다", () => {
  it("🔴 우체국택배 → 저장된 값이 0004 다", async () => {
    const el = await mount("EPOST");
    expect(state(el)).toBe("MATCHED");
    expect(serverValues.courierCode).toBe("0004");
    expect(serverValues.returnCourierCode).toBe("0004");
    /* 🔴 이름도 함께 — 다음에 열었을 때 코드가 아니라 이름이 보여야 한다. */
    expect(serverValues.courierLabel).toBe("우체국택배");
  });

  it("화면이 «왜 그렇게 됐는지» 말한다 — 코드는 보여주지 않는다", async () => {
    const el = await mount("EPOST");
    const body = text(el);
    expect(body).toContain("배송 프로필과 이름이 같아 자동으로 이었습니다");
    expect(body).toContain("우체국택배");
    expect(body).not.toContain("0004");
  });

  it("🔴 저장이 «반복되지 않는다» — PUT 은 한 번뿐이다", async () => {
    await mount("EPOST");
    expect(putBodies).toHaveLength(1);
  });
});

describe("② 🔴 유사명 오매칭을 막는다", () => {
  it("롯데택배는 «해외특송» 으로 가지 않는다", async () => {
    await mount("LOTTE");
    expect(serverValues.courierCode).toBe("0001");
    expect(serverValues.courierLabel).toBe("롯데택배");
  });

  it("CJ대한통운은 «국제특송» 으로 가지 않는다", async () => {
    await mount("CJGLS");
    expect(serverValues.courierCode).toBe("0002");
  });

  it("🔴 정확한 이름이 없고 비슷한 것만 있으면 «아무것도 저장하지 않는다»", async () => {
    /* 목록에서 국내 이름을 뺀다 — 해외특송만 남는다. */
    vi.unstubAllGlobals();
    stubRoutes([
      {
        path: "/api/lotteon/delivery-settings",
        handlers: {
          GET: () => ({
            body: { ...LISTS, couriers: [{ code: "0055", name: "롯데택배 해외특송" }] },
          }),
        },
      },
      {
        path: "/api/settings/lotteon-seller",
        handlers: {
          GET: () => ({ body: { ok: true, values: serverValues } }),
          PUT: ({ body }) => {
            putBodies.push(body as Record<string, unknown>);
            return { body: { ok: true } };
          },
        },
      },
    ]);
    const el = await mount("LOTTE");
    expect(state(el)).toBe("NOT_FOUND");
    expect(putBodies).toHaveLength(0);
    expect(serverValues.courierCode ?? null).toBeNull();
  });
});

describe("③ exact match 실패 — 「확인 필요」로 남는다", () => {
  it("GS Postbox 택배(편의점택배)는 괄호 때문에 이어지지 않는다", async () => {
    const el = await mount("CVSNET");
    expect(state(el)).toBe("NOT_FOUND");
    expect(text(el)).toContain("롯데ON 택배사 매핑 확인 필요");
    expect(putBodies).toHaveLength(0);
  });

  it("공통 택배사가 없으면 그 줄을 세우지 «않는다»", async () => {
    const el = await mount(null);
    expect(state(el)).toBeNull();
    expect(putBodies).toHaveLength(0);
  });
});

describe("④ 🔴 셀러가 이미 고른 값을 «덮지 않는다»", () => {
  it("저장값이 있으면 자동 매핑이 건드리지 않는다", async () => {
    serverValues = {
      courierCode: "0002",
      courierLabel: "CJ대한통운",
      returnCourierCode: "0002",
      returnCourierLabel: "CJ대한통운",
    };
    const el = await mount("EPOST");
    /* 공통은 우체국택배(0004)인데 셀러가 CJ(0002)를 골라 뒀다 — 그대로 둔다. */
    expect(serverValues.courierCode).toBe("0002");
    expect(putBodies).toHaveLength(0);
    /* 🔴 그래도 「이름이 다르다」는 사실은 말해 준다 — 조용히 넘기지 않는다. */
    expect(state(el)).toBe("MATCHED");
  });

  it("한쪽만 비어 있으면 «그쪽만» 잇는다", async () => {
    serverValues = { courierCode: "0002", courierLabel: "CJ대한통운" };
    await mount("EPOST");
    expect(putBodies).toHaveLength(1);
    expect(serverValues.courierCode).toBe("0002");
    expect(serverValues.returnCourierCode).toBe("0004");
  });
});

describe("⑤ 저장값 재조회 — 다시 열어도 그대로다", () => {
  it("자동으로 이은 값이 재방문에서 살아 있다", async () => {
    await mount("EPOST");
    expect(serverValues.courierCode).toBe("0004");
    await act(async () => root.unmount());
    container.remove();

    const again = await mount("EPOST");
    expect(text(again)).toContain("✓ 연결됨");
    expect(text(again)).toContain("우체국택배");
    /* 🔴 이미 저장돼 있으므로 다시 저장하지 않는다. */
    expect(putBodies).toHaveLength(1);
  });
});
