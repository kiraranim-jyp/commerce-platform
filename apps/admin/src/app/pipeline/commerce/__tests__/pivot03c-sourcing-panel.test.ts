// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SourcingPanel } from "../SourcingPanel";
import type { SourcingSignal } from "../workflow";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PIVOT-03-C §25 — **화면이 «하지 않아야 할 것» 을 하지 않는가.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 여기 있는 단정은 거의 전부 «부정형» 이다. 부정형은 코드의 «없음» 을 재는
 * 것이라 테스트로만 남고, 빠뜨리면 다음 사람이 「편의 기능」으로 되살린다:
 *
 *   후보가 하나뿐이어도 자동 선택하지 않는다
 *   후보가 늘어도 기존 선택을 바꾸지 않는다
 *   품절이어도 선택을 풀지 않는다
 *   재분석해도 선택을 유지한다
 *   `registrationReadyEvaluated=false` 를 「등록 준비 실패」로 쓰지 않는다
 *   `productId=null` 을 「후보 없음」으로 쓰지 않는다
 *
 * 🔴 「선택 API 를 부르지 않았다」를 **나간 요청으로** 판정한다 — 화면 글자만
 * 보면 내부에서 조용히 PUT 을 한 코드도 통과한다.
 */

const PRODUCT = "p-1";
const LIST_URL = `/api/products/${PRODUCT}/sourcing-candidates`;
const SELECTED_URL = `/api/products/${PRODUCT}/selected-source`;

interface Call {
  url: string;
  method: string;
  body: unknown;
}

const candidate = (over: Record<string, unknown> = {}) => ({
  id: "c1",
  sourceKind: "DISCOVERED",
  sourceUrl: "https://shop.example/a",
  sourceSite: "example",
  sourceCountry: null,
  priceAmount: 75,
  priceAmountRaw: "75",
  currency: "EUR",
  availability: "IN_STOCK",
  shippingNote: null,
  originatingSnapshotId: "s1",
  ...over,
});

let calls: Call[] = [];
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let signals: SourcingSignal[] = [];

/** 서버 상태를 들고 있는 대역. 🔴 선택은 «선택 API 로만» 바뀐다. */
let state: { candidates: ReturnType<typeof candidate>[]; selectedId: string | null; readyEvaluated: boolean };
/** 지정하면 다음 요청이 그 상태코드로 실패한다. */
let failWith: { status: number; error?: string } | null = null;

function masterReady() {
  if (state.selectedId == null) {
    return state.candidates.length > 0
      ? {
          stage: "SOURCING_READY",
          masterConfirmed: false,
          readyForCommerce: false,
          nextAction: "소싱 후보 중에서 어디서 사올지 고릅니다.",
          warning: null,
        }
      : {
          stage: "DISCOVERED",
          masterConfirmed: false,
          readyForCommerce: false,
          nextAction: "아직 소싱 후보가 없습니다 — 가격을 조사하면 후보가 모입니다.",
          warning: null,
        };
  }
  const selected = state.candidates.find((c) => c.id === state.selectedId);
  const warning =
    selected?.availability === "OUT_OF_STOCK"
      ? "선택한 소싱처가 품절입니다 — 다른 후보로 바꾸거나 재입고를 기다려야 합니다."
      : null;
  return {
    stage: "SOURCE_SELECTED",
    masterConfirmed: true,
    readyForCommerce: false,
    nextAction: "등록에 필요한 항목을 채우면 커머스에 보낼 수 있습니다.",
    warning,
  };
}

beforeEach(() => {
  calls = [];
  signals = [];
  failWith = null;
  state = { candidates: [candidate()], selectedId: null, readyEvaluated: false };
  container = document.createElement("div");
  document.body.appendChild(container);

  vi.stubGlobal("fetch", (input: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ url: input, method, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (failWith && method !== "GET") {
      return Promise.resolve(
        new Response(JSON.stringify({ ok: false, error: failWith.error }), { status: failWith.status }),
      );
    }
    if (failWith && method === "GET") {
      return Promise.resolve(new Response(JSON.stringify({ ok: false }), { status: failWith.status }));
    }
    if (input.startsWith(LIST_URL) && method === "GET") {
      return Promise.resolve(new Response(JSON.stringify({ ok: true, candidates: state.candidates })));
    }
    if (input.startsWith(SELECTED_URL) && method === "GET") {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ok: true,
            selectedCandidateId: state.selectedId,
            candidateCount: state.candidates.length,
            masterReady: masterReady(),
            registrationReadyEvaluated: state.readyEvaluated,
          }),
        ),
      );
    }
    if (input.startsWith(SELECTED_URL) && method === "PUT") {
      state.selectedId = (JSON.parse(String(init?.body)) as { candidateId: string }).candidateId;
      return Promise.resolve(new Response(JSON.stringify({ ok: true })));
    }
    if (input.startsWith(SELECTED_URL) && method === "DELETE") {
      state.selectedId = null;
      return Promise.resolve(new Response(JSON.stringify({ ok: true })));
    }
    if (input.startsWith(LIST_URL) && method === "POST") {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      state.candidates.push(candidate({ id: `c${state.candidates.length + 1}`, ...body }));
      /* 🔴 생성이 선택을 바꾸지 «않는다» — 서버도 그렇게 동작한다(②의 테스트). */
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 201 }));
    }
    if (method === "DELETE") {
      state.candidates = state.candidates.filter((c) => !input.endsWith(c.id));
      return Promise.resolve(new Response(JSON.stringify({ ok: true })));
    }
    return Promise.resolve(new Response(JSON.stringify({ ok: true })));
  });
});

afterEach(() => {
  act(() => root?.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function mount(productId: string | null) {
  await act(async () => {
    root = createRoot(container);
    root.render(
      createElement(SourcingPanel, {
        productId,
        onSignalChange: (s: SourcingSignal) => signals.push(s),
      }),
    );
  });
}

const text = () => container.textContent ?? "";
const buttonWith = (label: string) =>
  [...container.querySelectorAll("button")].find((b) => (b.textContent ?? "").includes(label));
const click = async (label: string) => {
  const button = buttonWith(label);
  expect(button, `[${label}] 버튼이 없다`).toBeTruthy();
  await act(async () => {
    button!.click();
  });
};
const selectionWrites = () => calls.filter((c) => c.url.includes("selected-source") && c.method !== "GET");

describe("🔴 productId = null — 「후보 없음」으로 그리지 않는다", () => {
  it("정체성이 없다는 문구를 쓴다 — 서버와 같은 문장", async () => {
    await mount(null);
    expect(text()).toContain("상품을 저장하면 소싱 후보를 모을 수 있습니다");
    /* 🔴 이 문장이 뜨면 「조사해 보니 없다」는 거짓이 된다. */
    expect(text()).not.toContain("아직 소싱 후보가 없습니다");
    expect(text()).not.toContain("후보가 없습니다");
  });

  it("후보 API 를 부르지 «않는다» — 부를 키가 없다", async () => {
    await mount(null);
    expect(calls).toEqual([]);
  });

  it("상단 Flow 에 «정체성 없음» 으로 보고한다 — notStarted 와 구분된다", async () => {
    await mount(null);
    const last = signals[signals.length - 1]!;
    expect(last.productMissing).toBe(true);
    expect(last.notStarted).toBe(false);
  });
});

describe("🔴 자동 선택이 없다", () => {
  it("후보가 «하나뿐» 이어도 선택되지 않는다", async () => {
    await mount(PRODUCT);
    expect(state.selectedId).toBeNull();
    expect(selectionWrites()).toEqual([]);
    expect(text()).toContain("어디서 사올지 고릅니다");
  });

  it("새 후보를 추가해도 선택이 생기지 않는다", async () => {
    await mount(PRODUCT);
    await click("+ 소싱처 직접 추가");
    const [url, site] = [...container.querySelectorAll("input")];
    await act(async () => {
      (url as HTMLInputElement).value = "https://shop.example/z";
      url!.dispatchEvent(new Event("input", { bubbles: true }));
      (site as HTMLInputElement).value = "example";
      site!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click("추가");
    expect(state.candidates.length).toBe(2);
    expect(state.selectedId).toBeNull();
    expect(selectionWrites()).toEqual([]);
  });

  it("🔴 셀러가 직접 넣은 후보는 «항상» SELLER_ENTERED 로 나간다", async () => {
    await mount(PRODUCT);
    await click("+ 소싱처 직접 추가");
    const [url, site] = [...container.querySelectorAll("input")];
    await act(async () => {
      (url as HTMLInputElement).value = "https://shop.example/z";
      url!.dispatchEvent(new Event("input", { bubbles: true }));
      (site as HTMLInputElement).value = "example";
      site!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click("추가");
    const post = calls.find((c) => c.method === "POST")!;
    expect((post.body as { sourceKind: string }).sourceKind).toBe("SELLER_ENTERED");
    /* 🔴 빈 가격을 0 으로 보내지 않는다 — 칸 자체를 넣지 않는다. */
    expect(post.body).not.toHaveProperty("priceAmount");
  });

  it("🔴 이미 고른 뒤 후보가 늘어도 선택이 «그대로» 다", async () => {
    state.selectedId = "c1";
    await mount(PRODUCT);
    state.candidates.push(candidate({ id: "c9", sourceUrl: "https://shop.example/new" }));
    await mount(PRODUCT);
    expect(state.selectedId).toBe("c1");
    expect(selectionWrites()).toEqual([]);
  });

  it("🔴 재분석(새 snapshot)해도 선택이 유지된다 — 선택은 Product 의 것이다", async () => {
    state.selectedId = "c1";
    state.candidates.push(candidate({ id: "c9", originatingSnapshotId: "s-new" }));
    await mount(PRODUCT);
    expect(text()).toContain("선택된 소싱처");
    expect(state.selectedId).toBe("c1");
    expect(selectionWrites()).toEqual([]);
  });
});

describe("🔴 품절 — 경고만 올리고 선택은 유지한다", () => {
  beforeEach(() => {
    state = { candidates: [candidate({ availability: "OUT_OF_STOCK" })], selectedId: "c1", readyEvaluated: false };
  });

  it("경고가 보인다", async () => {
    await mount(PRODUCT);
    expect(text()).toContain("품절");
    expect(text()).toContain("다른 후보로 바꾸거나");
  });

  it("🔴 선택이 풀리지 않는다 — 해제 요청이 나가지 않는다", async () => {
    await mount(PRODUCT);
    expect(state.selectedId).toBe("c1");
    expect(selectionWrites()).toEqual([]);
  });
});

describe("🔴 registrationReadyEvaluated = false — 「등록 준비 실패」가 아니다", () => {
  beforeEach(() => {
    state = { candidates: [candidate()], selectedId: "c1", readyEvaluated: false };
  });

  it("「아직 평가되지 않았습니다」로 그린다", async () => {
    await mount(PRODUCT);
    expect(text()).toContain("아직 평가되지 않았습니다");
  });

  it("🔴 실패/미달 문구를 쓰지 않는다", async () => {
    await mount(PRODUCT);
    for (const forbidden of ["등록 준비 실패", "준비되지 않았습니다", "등록할 수 없습니다"]) {
      expect(text(), forbidden).not.toContain(forbidden);
    }
    /* 🔴 평가 안 된 상태로 「준비 완료」도 말하지 않는다. */
    expect(text()).not.toContain("판매 상품으로 준비되었습니다");
  });

  it("평가된 상태(false)는 서버 문구를 그대로 쓴다", async () => {
    state.readyEvaluated = true;
    await mount(PRODUCT);
    expect(text()).toContain("등록에 필요한 항목을 채우면");
    expect(text()).not.toContain("아직 평가되지 않았습니다");
  });
});

describe("선택 / 해제 — 셀러가 «명시적으로» 할 때만", () => {
  it("[선택] 을 누르면 PUT 하나가 나간다", async () => {
    await mount(PRODUCT);
    await click("선택");
    const writes = selectionWrites();
    expect(writes).toHaveLength(1);
    expect(writes[0]!.method).toBe("PUT");
    expect(writes[0]!.body).toEqual({ candidateId: "c1" });
    expect(state.selectedId).toBe("c1");
  });

  it("[선택 해제] 를 누르면 후보는 «남고» 선택만 풀린다", async () => {
    state.selectedId = "c1";
    await mount(PRODUCT);
    await click("선택 해제");
    expect(state.selectedId).toBeNull();
    expect(state.candidates).toHaveLength(1);
    expect(calls.some((c) => c.method === "DELETE" && c.url.includes("sourcing-candidates"))).toBe(false);
  });
});

describe("§19 오류 UX — API 의미를 그대로 쓴다", () => {
  it("🔴 409 는 «보호 동작» 으로 안내한다 — 후보가 남는다", async () => {
    state.selectedId = "c1";
    await mount(PRODUCT);
    failWith = { status: 409, error: "선택한 소싱처입니다 — 다른 후보를 선택하거나 선택을 해제한 뒤 삭제하세요." };
    await click("삭제");
    expect(text()).toContain("선택을 해제한 뒤 삭제");
    expect(state.candidates).toHaveLength(1);
    /* 🔴 ?force=true 를 «기본 삭제로 쓰지 않는다»(§10). */
    expect(calls.every((c) => !c.url.includes("force"))).toBe(true);
  });

  it("422 / 404 / 5xx 를 각각 사람이 읽는 문장으로 그린다", async () => {
    const cases: [number, string][] = [
      [422, "소싱처 정보를 확인해 주세요."],
      [404, "소싱 후보를 찾을 수 없습니다. 다시 확인해 주세요."],
      [500, "소싱 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."],
    ];
    for (const [status, expected] of cases) {
      /* 🔴 직전 회차의 failWith 가 남아 있으면 «조회» 부터 실패해서 [선택] 버튼이
         아예 안 그려진다 — 측정 대상이 쓰기 실패인데 읽기 실패를 재게 된다. */
      failWith = null;
      state = { candidates: [candidate()], selectedId: null, readyEvaluated: false };
      await mount(PRODUCT);
      failWith = { status };
      await click("선택");
      expect(text(), String(status)).toContain(expected);
      act(() => root.unmount());
    }
  });

  it("조회 자체가 실패하면 «후보 없음» 으로 내려가지 않는다", async () => {
    failWith = { status: 500 };
    await mount(PRODUCT);
    expect(text()).toContain("다시 불러오기");
    expect(text()).not.toContain("아직 소싱 후보가 없습니다");
    expect(signals[signals.length - 1]!.loadFailed).toBe(true);
  });
});

describe("provenance — 모르는 것을 둘 중 하나로 «분류하지 않는다»", () => {
  it("DISCOVERED / SELLER_ENTERED / null 이 서로 다른 말이다", async () => {
    state = {
      candidates: [
        candidate({ id: "c1", sourceKind: "DISCOVERED" }),
        candidate({ id: "c2", sourceKind: "SELLER_ENTERED" }),
        candidate({ id: "c3", sourceKind: null }),
      ],
      selectedId: null,
      readyEvaluated: false,
    };
    await mount(PRODUCT);
    expect(text()).toContain("수집에서 발견");
    expect(text()).toContain("직접 입력");
    /* 🔴 077 의 NULL 은 legacy 미확정이다 — 추측해서 분류하지 않는다. */
    expect(text()).toContain("출처 미확정");
  });
});
