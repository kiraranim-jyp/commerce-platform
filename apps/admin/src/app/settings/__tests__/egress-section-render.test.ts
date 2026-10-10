// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EgressSection } from "../EgressSection";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * EGRESS ⑤ — 화면을 «마운트한 DOM» 으로 잰다 (2026-10-10)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 소스 문자열 검사로 UI 를 닫지 않는다(여덟 번 걸린 함정). 여기서 보는 것은
 *    전부 실제로 마운트한 뒤의 `document` 다.
 *
 * 🔴 이 파일이 지키는 것:
 *    ① 화면에 프록시 URL·자격증명·host/port·Tinyproxy 가 «없다»
 *    ② 「연결 테스트」와 「전환」이 다른 버튼이고, 테스트는 저장을 호출하지 않는다
 *    ③ 단계(TCP/터널/외부요청)가 «펼쳐져» 보인다 — 합쳐서 「정상」이라고 하지 않는다
 *    ④ 「미실행」을 「실패」로 칠하지 않는다
 *    ⑤ 주소가 없는 provider 는 고를 수 없다
 */

const SECRET_URL = "http://fixieuser:fixiepw@velodrome.usefixie.com:8888";

type Json = Record<string, unknown>;

let container: HTMLDivElement;
let root: Root;
let posts: Array<{ url: string; body: Json }>;

const baseState = (overrides: Json = {}): Json => ({
  ok: true,
  currentProvider: "OCI",
  selectedProvider: null,
  decidedBy: "ENV",
  store: "READY",
  storeReason: null,
  availableProviders: [
    {
      provider: "OCI",
      configured: true,
      health: "NORMAL",
      measuredAt: "2026-10-10T01:00:00.000Z",
      lastSuccessAt: "2026-10-10T01:00:00.000Z",
      lastFailureAt: null,
      lastError: null,
    },
    {
      provider: "FIXIE",
      configured: true,
      health: null,
      measuredAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastError: null,
    },
  ],
  lastCheck: "2026-10-10T01:00:00.000Z",
  lastSuccess: "2026-10-10T01:00:00.000Z",
  lastFailure: null,
  lastError: null,
  recentHistory: [],
  historyStore: "READY",
  ...overrides,
});

/** POST 응답까지 흉내낸다 — 버튼을 누른 «뒤» 의 화면을 봐야 한다. */
function stubFetch(state: Json, postResponse: Json = { ok: true, switched: false }) {
  posts = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === "POST") {
        posts.push({ url, body: JSON.parse(init.body ?? "{}") as Json });
        return { json: async () => postResponse } as Response;
      }
      return { json: async () => state } as Response;
    }),
  );
}

async function mount(): Promise<HTMLElement> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(EgressSection));
  });
  /* useEffect 안의 fetch 가 끝난 뒤의 화면을 본다. */
  await act(async () => {
    await Promise.resolve();
  });
  return container;
}

async function click(el: HTMLElement) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  /* 전역 선언이 없는 플래그다 — 리포의 다른 jsdom 테스트와 같은 꼴로 단언한다. */
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("⓪ 🔴 응답 모양을 믿지 않는다 — 이 섹션이 설정 화면 전체를 죽이지 않는다", () => {
  /**
   * 🔴 이것은 전수 회귀가 잡은 «실제 결함» 의 가드다(2026-10-10).
   *    처음 구현은 `ok:true` 만 보고 `availableProviders.find()` 를 했고,
   *    빈 설정 객체가 오자 **설정 화면 전체** 가 렌더에서 터졌다
   *    (market-research-sources 12건이 그래서 떨어졌다).
   *
   *    배포 시차·오류 봉투·로그인 HTML 에서 실제로 일어나는 상황이고,
   *    그때 내 섹션 하나 때문에 커머스 계정·배송·판매자 정보까지 사라지면 안 된다.
   */
  it.each([
    ["빈 설정 객체 (배포 시차)", { ok: true }],
    ["다른 엔드포인트 모양", { ok: true, sources: [], shops: [] }],
    ["null", null],
    ["HTML 문자열(로그인 페이지)", "<!doctype html>"],
    ["ok:false 봉투", { ok: false, error: "503" }],
    ["availableProviders 가 배열이 아님", { ok: true, currentProvider: "OCI", availableProviders: {} }],
  ])("🔴 %s 를 받아도 던지지 않고 「불러오지 못했습니다」로 선다", async (_label, payload) => {
    stubFetch(payload as Json);
    const el = await mount();
    expect(el.querySelector('[data-egress-section="unavailable"]')).not.toBeNull();
    expect(el.textContent ?? "").toContain("불러오지 못했습니다");
  });

  it("🔴 이력이 배열이 아니면 «빈 이력» 이다 — 없는 행을 지어내지 않는다", async () => {
    stubFetch(baseState({ recentHistory: null }));
    const el = await mount();
    expect(el.querySelector('[data-egress-section="true"]')).not.toBeNull();
    expect(el.querySelector('[data-egress-history="empty"]')).not.toBeNull();
  });

  it("모양이 맞으면 당연히 정상으로 선다 (대조군)", async () => {
    stubFetch(baseState());
    const el = await mount();
    expect(el.querySelector('[data-egress-section="true"]')).not.toBeNull();
    expect(el.querySelector('[data-egress-section="unavailable"]')).toBeNull();
  });
});

describe("① 화면에 비밀값·내부 구성요소가 없다", () => {
  it("🔴 프록시 URL·사용자명·비밀번호·host·port 가 DOM 에 한 글자도 없다", async () => {
    stubFetch(
      baseState({
        recentHistory: [
          {
            id: "r1",
            createdAt: "2026-10-10T01:00:00.000Z",
            provider: "OCI",
            connectResult: "TIMEOUT",
            outboundResult: null,
            elapsedMs: 25003,
            switchedFrom: null,
            switchCommitted: null,
            source: "HEALTH_CHECK",
            detail: "health=DOWN connect=TIMEOUT",
          },
        ],
      }),
    );
    const el = await mount();
    const text = el.textContent ?? "";
    const html = el.innerHTML;

    for (const secret of ["fixiepw", "fixieuser", "velodrome", "8888", SECRET_URL]) {
      expect(text).not.toContain(secret);
      expect(html).not.toContain(secret);
    }
    /* 대조군 — 화면이 비어서 통과한 것이 아니다. */
    expect(el.querySelector('[data-egress-section="true"]')).not.toBeNull();
    expect(text).toContain("OCI");
  });

  it("🔴 Tinyproxy 는 선택지로도, 글자로도 화면에 없다 (provider 는 둘뿐이다)", async () => {
    stubFetch(baseState());
    const el = await mount();
    expect((el.textContent ?? "").toLowerCase()).not.toContain("tinyproxy");
    const providers = [...el.querySelectorAll("[data-egress-provider]")].map((node) =>
      node.getAttribute("data-egress-provider"),
    );
    expect(providers).toEqual(["OCI", "FIXIE"]);
  });
});

describe("② 「연결 테스트」와 「전환」이 다른 버튼이다", () => {
  it("🔴 연결 테스트는 action=test 를 보낸다 — 저장을 부르지 않는다", async () => {
    stubFetch(baseState(), { ok: true, switched: false });
    const el = await mount();
    const button = el.querySelector('[data-egress-test="FIXIE"]') as HTMLElement;
    expect(button).not.toBeNull();
    await click(button);

    expect(posts).toHaveLength(1);
    expect(posts[0].body).toEqual({ action: "test", provider: "FIXIE" });
  });

  it("전환은 action=switch 를 보낸다", async () => {
    stubFetch(baseState(), { ok: true, switched: true });
    const el = await mount();
    await click(el.querySelector('[data-egress-switch="FIXIE"]') as HTMLElement);
    expect(posts[0].body).toEqual({ action: "switch", provider: "FIXIE" });
  });

  it("🔴 테스트 성공을 「전환됐다」고 말하지 않는다", async () => {
    stubFetch(baseState(), { ok: true, switched: false });
    const el = await mount();
    await click(el.querySelector('[data-egress-test="FIXIE"]') as HTMLElement);

    const result = el.querySelector("[data-egress-result]");
    expect(result?.getAttribute("data-egress-result")).toBe("ok");
    expect(result?.textContent ?? "").toContain("설정은 바뀌지 않았습니다");
    expect(result?.textContent ?? "").not.toContain("전환했습니다");
  });

  it("🔴 전환 실패는 「기존 설정 유지」를 화면이 말한다", async () => {
    stubFetch(baseState(), {
      ok: false,
      switched: false,
      error: "FIXIE 로 실제 외부 요청이 나가지 않아 전환하지 않았습니다 — 기존 설정을 그대로 유지합니다.",
    });
    const el = await mount();
    await click(el.querySelector('[data-egress-switch="FIXIE"]') as HTMLElement);

    const result = el.querySelector("[data-egress-result]");
    expect(result?.getAttribute("data-egress-result")).toBe("failed");
    expect(result?.textContent ?? "").toContain("기존 설정을 그대로 유지");
  });
});

describe("③ 단계를 펼쳐 보여준다", () => {
  it("🔴 TCP 통과 + 터널 무응답이 «각각» 화면에 선다 — 합쳐서 정상이라고 하지 않는다", async () => {
    stubFetch(baseState(), {
      ok: false,
      switched: false,
      error: "전환하지 않았습니다.",
      report: {
        provider: "FIXIE",
        health: "DOWN",
        tcp: { verdict: "PASS", elapsedMs: 186, detail: null },
        connect: { verdict: "TIMEOUT", elapsedMs: 25003, detail: "UND_ERR_CONNECT_TIMEOUT" },
        outbound: { verdict: "SKIPPED", elapsedMs: null, detail: null },
        outboundIp: null,
        totalElapsedMs: 25200,
        checkedAt: "2026-10-10T01:00:00.000Z",
      },
    });
    const el = await mount();
    await click(el.querySelector('[data-egress-switch="FIXIE"]') as HTMLElement);

    const rows = el.querySelectorAll("[data-egress-stage]");
    expect(rows).toHaveLength(3);
    const byLabel = Object.fromEntries(
      [...rows].map((r) => [r.getAttribute("data-egress-stage"), r.textContent ?? ""]),
    );
    expect(byLabel["TCP 연결"]).toContain("통과");
    expect(byLabel["터널 연결"]).toContain("무응답");
    /* 🔴 외부요청은 «실패» 가 아니라 «미실행» 이다. */
    expect(byLabel["외부 요청"]).toContain("미실행");
    expect(byLabel["외부 요청"]).not.toContain("실패");
    /* elapsed 가 원인을 가른다 — 25초가 화면에 있어야 한다. */
    expect(byLabel["터널 연결"]).toContain("25.0초");
  });
});

describe("③-b 🔴 407 의 «조치» 가 화면에 선다 (CPO 지시 ④)", () => {
  /**
   * Production 에서 FIXIE 만 407 이었다. 「거절됐다」만 보여주면 셀러도 CTO 도
   * 어디를 고쳐야 하는지 모른다 — 같은 407 이 두 가지 다른 원인을 가린다.
   */
  const refusal = (reason: string, sentAuthHeader: boolean) => ({
    ok: false,
    switched: false,
    error: "전환하지 않았습니다.",
    report: {
      provider: "FIXIE",
      health: "DOWN",
      tcp: { verdict: "PASS", elapsedMs: 186, detail: null },
      connect: { verdict: "REFUSED", elapsedMs: 488, detail: "프록시가 CONNECT 를 거절했습니다 (HTTP 407)" },
      outbound: { verdict: "SKIPPED", elapsedMs: null, detail: null },
      outboundIp: null,
      connectStatusCode: 407,
      connectAuthScheme: "Basic",
      sentAuthHeader,
      refusalReason: reason,
      totalElapsedMs: 700,
      checkedAt: "2026-10-10T01:00:00.000Z",
    },
  });

  it("🔴 ⓐ 「인증을 보내지 못했다」가 화면에 그대로 선다 — 우리 설정 문제", async () => {
    stubFetch(
      baseState(),
      refusal("인증 정보가 불완전합니다 — 비밀번호 부분이 주소에 없어 인증을 보내지 못했습니다 (HTTP 407 · 요구 방식 Basic).", false),
    );
    const el = await mount();
    await click(el.querySelector('[data-egress-switch="FIXIE"]') as HTMLElement);

    const node = el.querySelector('[data-egress-refusal-reason="true"]');
    expect(node).not.toBeNull();
    expect(node?.textContent ?? "").toContain("비밀번호");
    expect(node?.textContent ?? "").toContain("보내지 못했습니다");
  });

  it("🔴 ⓑ 「보냈으나 거절」이 화면에 선다 — 계정 문제", async () => {
    stubFetch(
      baseState(),
      refusal("인증 정보를 보냈으나 프록시가 거절했습니다 (HTTP 407 · 요구 방식 Basic) — 자격증명 만료 또는 사용량 한도일 수 있습니다.", true),
    );
    const el = await mount();
    await click(el.querySelector('[data-egress-switch="FIXIE"]') as HTMLElement);
    expect(el.querySelector('[data-egress-refusal-reason="true"]')?.textContent ?? "").toContain("사용량 한도");
  });

  it("🔴 거절이 아니면 이 문구가 화면에 «없다» (대조군)", async () => {
    stubFetch(baseState(), { ok: true, switched: true });
    const el = await mount();
    await click(el.querySelector('[data-egress-switch="FIXIE"]') as HTMLElement);
    expect(el.querySelector('[data-egress-refusal-reason="true"]')).toBeNull();
  });

  it("🔴 조치 문구와 같이 와도 비밀값·realm 은 화면에 없다", async () => {
    stubFetch(baseState(), refusal("인증 정보를 보냈으나 프록시가 거절했습니다 (HTTP 407 · 요구 방식 Basic).", true));
    const el = await mount();
    await click(el.querySelector('[data-egress-switch="FIXIE"]') as HTMLElement);
    const text = el.textContent ?? "";
    for (const secret of ["fixiepw", "fixieuser", "velodrome", "realm", SECRET_URL]) {
      expect(text).not.toContain(secret);
    }
    /* 대조군 — 문구 자체는 떠 있다. */
    expect(text).toContain("HTTP 407");
  });
});

describe("④ 이력에서 「미실행」을 「실패」로 칠하지 않는다", () => {
  it("🔴 connect/outbound 가 NULL 인 행은 「미실행」으로 선다", async () => {
    stubFetch(
      baseState({
        recentHistory: [
          {
            id: "r1",
            createdAt: "2026-10-10T01:00:00.000Z",
            provider: "OCI",
            connectResult: "TIMEOUT",
            outboundResult: null,
            elapsedMs: 25003,
            switchedFrom: "FIXIE",
            switchCommitted: false,
            source: "SWITCH",
            detail: "health=DOWN",
          },
        ],
      }),
    );
    const el = await mount();
    const row = el.querySelector('[data-egress-history-row="r1"]');
    const cells = [...(row?.querySelectorAll("td") ?? [])].map((td) => td.textContent ?? "");
    expect(cells[1]).toBe("OCI");
    expect(cells[2]).toBe("TIMEOUT");
    expect(cells[3]).toBe("미실행");
    expect(cells[5]).toBe("전환 안 함");
  });

  it("이력이 없으면 「이상 없다」가 아니라 「기록이 없다」고 말한다", async () => {
    stubFetch(baseState());
    const el = await mount();
    const empty = el.querySelector('[data-egress-history="empty"]');
    expect(empty?.textContent ?? "").toContain("기록된 이력이 없습니다");
  });
});

describe("⑤ 고를 수 없는 것을 고를 수 있게 두지 않는다", () => {
  it("🔴 주소가 등록되지 않은 provider 의 버튼은 비활성이다", async () => {
    stubFetch(
      baseState({
        availableProviders: [
          {
            provider: "OCI",
            configured: true,
            health: "NORMAL",
            measuredAt: "2026-10-10T01:00:00.000Z",
            lastSuccessAt: null,
            lastFailureAt: null,
            lastError: null,
          },
          {
            provider: "FIXIE",
            configured: false,
            health: null,
            measuredAt: null,
            lastSuccessAt: null,
            lastFailureAt: null,
            lastError: null,
          },
        ],
      }),
    );
    const el = await mount();
    const test = el.querySelector('[data-egress-test="FIXIE"]') as HTMLButtonElement;
    const sw = el.querySelector('[data-egress-switch="FIXIE"]') as HTMLButtonElement;
    expect(test.disabled).toBe(true);
    expect(sw.disabled).toBe(true);
    /* 대조군 — OCI 는 누를 수 있다. */
    expect((el.querySelector('[data-egress-test="OCI"]') as HTMLButtonElement).disabled).toBe(false);
    expect(el.textContent ?? "").toContain("주소가 등록되어 있지 않아");
  });

  it("🔴 자동 전환이 아니라는 것을 화면이 먼저 말한다", async () => {
    stubFetch(baseState());
    const el = await mount();
    expect(el.textContent ?? "").toContain("자동으로 바뀌지 않습니다");
  });

  it("migration 전이면 「저장할 수 없다」를 화면이 말한다 — 조용히 실패하지 않는다", async () => {
    stubFetch(baseState({ store: "NOT_MIGRATED" }));
    const el = await mount();
    expect(el.textContent ?? "").toContain("저장 공간이 아직 준비되지 않아");
  });
});
