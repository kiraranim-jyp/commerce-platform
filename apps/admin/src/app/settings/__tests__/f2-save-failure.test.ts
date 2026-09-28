// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LotteOnDeliveryMapping } from "../LotteOnDeliveryMapping";
import { stubRoutes } from "./route-contract";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * F2 — **저장이 실패했는데 «연결됨» 이라고 말하지 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 2차 검증 BLOCK(2026-09-28). 재현으로 확정된 결함이다 —
 *
 *     [F2-1] 「저장하지 못했습니다」 표시   true
 *     [F2-2] 「✓ 연결됨」 이 그대로 남는가  true   ← 🔴 여기
 *     [F2-3] 서버에 저장된 값              {}
 *     [F2-3b] 다시 열면                    여섯 칸 전부 「연결 필요」
 *
 * 초록 체크와 실패 메시지가 «동시에» 서 있었다. 셀러는 초록을 믿는다.
 * 원인은 하나다 — `setSaved(next)` 를 PUT «전에» 했다. 화면이 서버보다 앞서 갔다.
 *
 * 🔴 조회 실패를 「선택 안 함」으로 위장하지 않는 규칙은 지키면서 **저장 쪽만
 * 안 지키고 있었다.** 이 파일이 두 원칙을 같은 모양으로 맞춘다.
 *
 * 성공과 실패를 «같은 파일에서 마주 놓고» 본다 — 한쪽만 보면 또 놓친다.
 */

const LISTS = {
  ok: true,
  outboundPlaces: [
    { no: "PLO3837441", name: "Hessen 물류센터" },
    { no: "PLO9", name: "서울 물류센터" },
  ],
  returnPlaces: [{ no: "PLO_R", name: "반품주소지" }],
  costPolicies: [{ no: "4279402", name: "업체배송 19800원" }],
  couriers: [{ code: "EP", name: "우체국택배" }],
  deliveryRegionGroups: [{ code: "GN101", name: "전국" }],
};

let container: HTMLDivElement;
let root: Root;
/** 서버가 «실제로» 갖고 있는 것. 저장에 성공했을 때만 채워진다. */
let serverValues: Record<string, unknown>;
let putCount: number;

/**
 * 🔴 P0-2 — 스텁이 «계약대로» 대답한다. URL 만 보고 대답하면 메서드가 어긋난
 * 호출(실제로 405 로 죽어 있던 그 호출)을 그대로 통과시킨다.
 */
function stub(putOk: boolean) {
  return stubRoutes([
    { path: "/api/lotteon/delivery-settings", handlers: { GET: () => ({ body: LISTS }) } },
    {
      path: "/api/settings/lotteon-seller",
      handlers: {
        GET: () => ({ body: { ok: true, values: serverValues } }),
        PUT: ({ body }) => {
          putCount += 1;
          if (putOk) serverValues = body as Record<string, unknown>;
          /* 🔴 저장 실패는 «상태 코드» 로 온다 — 본문만 보고 판단하지 않는다. */
          return putOk ? { body: { ok: true } } : { status: 500, body: { ok: false } };
        },
      },
    },
  ]);
}

async function mount(): Promise<HTMLElement> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(LotteOnDeliveryMapping));
  });
  await act(async () => {
    await Promise.resolve();
  });
  return container;
}

async function unmount() {
  await act(async () => root.unmount());
  container.remove();
}

/** 첫 칸(출고지)에서 「Hessen 물류센터」를 고른다 — 셀러가 하는 그 동작. */
async function pickFirst(el: HTMLElement) {
  const first = el.querySelectorAll("select")[0] as HTMLSelectElement;
  await act(async () => {
    first.value = "PLO3837441";
    first.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

beforeEach(() => {
  // @ts-expect-error — act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  serverValues = {};
  putCount = 0;
});

afterEach(async () => {
  await unmount();
  vi.unstubAllGlobals();
});

const text = (el: HTMLElement) => (el.textContent ?? "").replace(/\s+/g, " ");
const count = (el: HTMLElement, word: string) => (text(el).match(new RegExp(word, "g")) ?? []).length;

describe("① 저장 «성공» — 연결됐다고 말해도 되는 경우", () => {
  it("✓ 연결됨 + 이름이 서고, 서버에도 그 값이 있다", async () => {
    stub(true);
    const el = await mount();
    await pickFirst(el);
    expect(text(el)).toContain("✓ 연결됨");
    expect(text(el)).toContain("Hessen 물류센터");
    expect(serverValues.outboundPlaceNo).toBe("PLO3837441");
    /* 🔴 화면이 말하는 것과 서버가 가진 것이 «같다» — 이것이 F2 의 본질이다. */
    expect(count(el, "연결 필요")).toBe(5);
  });
});

describe("② 🔴 저장 «실패» — 여기서 BLOCK 이 났다", () => {
  it("✓ 연결됨이 «서지 않는다»", async () => {
    stub(false);
    const el = await mount();
    await pickFirst(el);
    /* 🔴 수정 전에는 이 줄이 true 였다. 초록 체크가 그대로 남아 있었다. */
    expect(text(el)).not.toContain("✓ 연결됨");
  });

  it("실패라고 말하고 «다시 시도» 를 준다", async () => {
    stub(false);
    const el = await mount();
    await pickFirst(el);
    expect(text(el)).toContain("저장하지 못했습니다");
    const retry = Array.from(el.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("다시 시도"),
    );
    expect(retry, "다시 시도 버튼이 없다").toBeDefined();
  });

  it("🔴 화면 상태와 서버 상태가 «어긋나지 않는다»", async () => {
    stub(false);
    const el = await mount();
    await pickFirst(el);
    /* 서버는 아무것도 저장하지 못했다. 그러면 화면도 연결됐다고 하면 안 된다. */
    expect(serverValues).toEqual({});
    expect(text(el)).not.toContain("✓ 연결됨");
  });

  it("🔴 다시 열었을 때와 «같은 말» 을 한다", async () => {
    stub(false);
    const el = await mount();
    await pickFirst(el);
    const beforeReopen = text(el).includes("✓ 연결됨");
    await unmount();
    const again = await mount();
    const afterReopen = text(again).includes("✓ 연결됨");
    /* 수정 전에는 before=true / after=false 로 «달랐다» — 그 간극이 셀러를
       「분명 연결했는데」로 만든다. 지금은 둘 다 false 로 같다. */
    expect(beforeReopen).toBe(afterReopen);
    expect(afterReopen).toBe(false);
    expect(count(again, "연결 필요")).toBe(6);
  });

  it("다시 시도를 누르면 «같은 값» 으로 다시 보낸다", async () => {
    stub(false);
    const el = await mount();
    await pickFirst(el);
    expect(putCount).toBe(1);
    const retry = Array.from(el.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("다시 시도"),
    ) as HTMLButtonElement;
    await act(async () => {
      retry.click();
    });
    expect(putCount).toBe(2);
    /* 실패가 반복돼도 연결됐다고 말하지 않는다. */
    expect(text(el)).not.toContain("✓ 연결됨");
  });
});

describe("④ 🔴 실패한 값이 «다음 저장에 묻어가지 않는다»", () => {
  /*
   * 🔴 이 검사가 F2 의 «진짜» 자리다.
   *
   * 처음 쓴 가드 다섯은 옛 버그(`setSaved` 를 PUT 전에 하기)를 되살려도 전부
   * 통과했다 — 화면이 `failed` 분기를 «먼저» 보기 때문에 초록 체크가 어차피
   * 가려졌다. 즉 그 다섯은 «표시» 만 봤고 «상태 오염» 은 못 봤다.
   *
   * 오염은 다음 저장에서 터진다. PUT 본문이 `{...saved, ...patch}` 이므로
   * `saved` 가 실패한 값으로 더럽혀져 있으면, 셀러가 «다른 칸» 을 저장하는
   * 순간 그 실패한 값이 조용히 함께 서버로 넘어간다. 셀러는 고른 적 없는
   * 출고지로 물건을 내보내게 된다.
   */
  it("출고지 저장이 실패한 뒤 택배사를 저장해도 출고지가 따라가지 않는다", async () => {
    stub(false);
    const el = await mount();
    await pickFirst(el); // 출고지 PUT 실패
    expect(serverValues).toEqual({});

    /* 서버가 돌아왔다. 셀러는 이번엔 «택배사» 를 고른다. */
    vi.unstubAllGlobals();
    stub(true);
    const courier = el.querySelectorAll("select")[4] as HTMLSelectElement;
    await act(async () => {
      courier.value = "EP";
      courier.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(serverValues.courierCode).toBe("EP");
    /* 🔴 실패했던 출고지는 «서버에 가면 안 된다». 셀러가 확정한 적이 없다. */
    expect(serverValues.outboundPlaceNo ?? null).toBeNull();
    expect(serverValues.outboundPlaceLabel ?? null).toBeNull();
  });

  it("실패한 칸은 여전히 «연결 필요» 로 남는다", async () => {
    stub(false);
    const el = await mount();
    await pickFirst(el);
    vi.unstubAllGlobals();
    stub(true);
    const courier = el.querySelectorAll("select")[4] as HTMLSelectElement;
    await act(async () => {
      courier.value = "EP";
      courier.dispatchEvent(new Event("change", { bubbles: true }));
    });
    /* 택배사 하나만 연결됐으니 나머지 다섯이 「연결 필요」여야 한다.
       출고지가 오염돼 있으면 넷이 되어 이 줄이 깨진다. */
    expect(count(el, "연결 필요")).toBe(5);
    expect(count(el, "✓ 연결됨")).toBe(1);
  });
});

describe("③ 실패 뒤 «성공» 하면 그때 연결됨으로 바뀐다", () => {
  it("한 번 실패해도 길이 막히지 않는다", async () => {
    stub(false);
    const el = await mount();
    await pickFirst(el);
    expect(text(el)).not.toContain("✓ 연결됨");

    /* 서버가 돌아왔다 — 같은 화면에서 다시 시도한다. */
    vi.unstubAllGlobals();
    stub(true);
    const retry = Array.from(el.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("다시 시도"),
    ) as HTMLButtonElement;
    await act(async () => {
      retry.click();
    });
    expect(text(el)).toContain("✓ 연결됨");
    expect(serverValues.outboundPlaceNo).toBe("PLO3837441");
  });
});
