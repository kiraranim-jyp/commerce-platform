import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * EGRESS ② — DB 선택값이 런타임에 반영되는가 (2026-10-10)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 078 이 env 를 버리고 DB 로 온 이유는 하나다 — **재배포 없이 전환**. 실측으로
 * 확인했다: `vercel env` 를 바꿔도 돌고 있는 배포본은 옛 값을 계속 쓴다.
 *
 * 그래서 이 파일이 지키는 것은 넷이다.
 *
 *   ① DB 선택값이 env 를 «이긴다»
 *   ② 선택이 없으면(NULL) **기존 env 동작과 한 글자도 다르지 않다** — 무회귀
 *   ③ migration 전·DB 장애를 「선택 없음」과 «갈라» 들고 올라온다
 *   ④ 고른 쪽의 URL 이 없으면 성공으로 둔갑시키지 않는다
 *
 * 🔴 ②가 이 배치에서 가장 중요하다. 지금 Production 은 `OUTBOUND_PROXY=OCI` 로
 *    돌고 있고 DB 는 전부 NULL 이다. 즉 **이 변경 직후의 올바른 동작은
 *    「아무것도 바뀌지 않는 것」** 이다.
 */

const readEgressSelection = vi.fn();

/* 🔴 outbound-proxy 는 egress-settings 를 «동적» import 한다(env 전용 경로에
   supabase 가 끌려오지 않게 하려고). vi.mock 은 동적 import 도 가로챈다. */
vi.mock("../egress-settings", () => ({
  readEgressSelection: (...args: unknown[]) => readEgressSelection(...args),
}));

import {
  configuredEgressProviders,
  createOutboundProxyDispatcherAsync,
  dispatcherForProvider,
  envProxyUrlFor,
  getOutboundProxyDiagnostics,
  getOutboundProxyDiagnosticsAsync,
  invalidateEgressSelectionCache,
  resolveOutboundProxyAsync,
} from "../outbound-proxy";

const OCI = "http://oci.example:8888";
const FIXIE = "http://user:pw@fixie.example:80";

function env(values: { OUTBOUND_PROXY?: string; OCI_PROXY_URL?: string; FIXIE_URL?: string }) {
  vi.stubEnv("OUTBOUND_PROXY", values.OUTBOUND_PROXY ?? "");
  vi.stubEnv("OCI_PROXY_URL", values.OCI_PROXY_URL ?? "");
  vi.stubEnv("FIXIE_URL", values.FIXIE_URL ?? "");
}

/** DB 가 이 선택을 들고 있다고 둔다. */
function dbSelects(provider: "OCI" | "FIXIE" | null, store: "READY" | "NOT_MIGRATED" | "UNAVAILABLE" = "READY") {
  readEgressSelection.mockResolvedValue({ provider, store });
}

beforeEach(() => {
  readEgressSelection.mockReset();
  /* 🔴 캐시를 비우지 않으면 앞 테스트의 선택이 다음 테스트로 새어 들어간다. */
  invalidateEgressSelectionCache();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("① DB 선택값이 env 를 이긴다", () => {
  it("🔴 DB=FIXIE 면 OUTBOUND_PROXY=OCI 여도 FIXIE 로 나간다", async () => {
    env({ OUTBOUND_PROXY: "OCI", OCI_PROXY_URL: OCI, FIXIE_URL: FIXIE });
    dbSelects("FIXIE");
    const resolved = await resolveOutboundProxyAsync();
    expect(resolved.provider).toBe("FIXIE");
    expect(resolved.decidedBy).toBe("DB");
  });

  it("🔴 DB=OCI 면 OUTBOUND_PROXY=FIXIE 여도 OCI 로 나간다", async () => {
    env({ OUTBOUND_PROXY: "FIXIE", OCI_PROXY_URL: OCI, FIXIE_URL: FIXIE });
    dbSelects("OCI");
    const resolved = await resolveOutboundProxyAsync();
    expect(resolved.provider).toBe("OCI");
    expect(resolved.decidedBy).toBe("DB");
  });

  it("전환이 «재배포 없이» 반영된다 — 같은 프로세스에서 선택만 바꾸면 결과가 바뀐다", async () => {
    env({ OUTBOUND_PROXY: "OCI", OCI_PROXY_URL: OCI, FIXIE_URL: FIXIE });
    dbSelects("OCI");
    expect((await resolveOutboundProxyAsync()).provider).toBe("OCI");

    dbSelects("FIXIE");
    invalidateEgressSelectionCache();
    expect((await resolveOutboundProxyAsync()).provider).toBe("FIXIE");
  });
});

describe("② 무회귀 — 선택이 없으면 기존 env 동작 그대로다", () => {
  it("🔴 DB=NULL 이면 env 스위치가 결정한다", async () => {
    env({ OUTBOUND_PROXY: "FIXIE", OCI_PROXY_URL: OCI, FIXIE_URL: FIXIE });
    dbSelects(null);
    const resolved = await resolveOutboundProxyAsync();
    expect(resolved.provider).toBe("FIXIE");
    expect(resolved.decidedBy).toBe("ENV");
  });

  it("🔴 DB=NULL + 스위치 없음 → OCI 우선 (현재 Production 과 같은 상태)", async () => {
    env({ OCI_PROXY_URL: OCI, FIXIE_URL: FIXIE });
    dbSelects(null);
    expect((await resolveOutboundProxyAsync()).provider).toBe("OCI");
  });

  it("🔴 DB=NULL 일 때 async 결과가 «기존 동기 resolver 와 같다» (대조군)", async () => {
    /* 네 조합 모두에서 동기/비동기가 같은 답을 내야 한다 — 하나만 재면
       「우연히 같았다」와 구별되지 않는다. */
    const combos = [
      { OUTBOUND_PROXY: "FIXIE", OCI_PROXY_URL: OCI, FIXIE_URL: FIXIE },
      { OUTBOUND_PROXY: "OCI", OCI_PROXY_URL: OCI, FIXIE_URL: FIXIE },
      { OCI_PROXY_URL: OCI, FIXIE_URL: FIXIE },
      { FIXIE_URL: FIXIE },
    ];
    for (const combo of combos) {
      env(combo);
      dbSelects(null);
      invalidateEgressSelectionCache();
      expect((await resolveOutboundProxyAsync()).provider).toBe(getOutboundProxyDiagnostics().provider);
    }
  });

  it("프록시가 아예 없으면 NONE 이고 dispatcher 는 undefined 다 (로컬 개발 편의 유지)", async () => {
    env({});
    dbSelects(null);
    expect((await resolveOutboundProxyAsync()).provider).toBe("NONE");
    expect(await createOutboundProxyDispatcherAsync()).toBeUndefined();
  });
});

describe("③ migration 전·DB 장애를 「선택 없음」과 갈라 적는다", () => {
  it("🔴 NOT_MIGRATED 는 장애가 아니다 — env 로 내려가고 store 가 그 사실을 말한다", async () => {
    env({ OUTBOUND_PROXY: "OCI", OCI_PROXY_URL: OCI });
    dbSelects(null, "NOT_MIGRATED");
    const resolved = await resolveOutboundProxyAsync();
    expect(resolved.provider).toBe("OCI");
    expect(resolved.decidedBy).toBe("ENV");
    expect(resolved.store).toBe("NOT_MIGRATED");
  });

  it("🔴 DB 읽기가 터져도 등록 경로는 멈추지 않는다 — env 폴백 + UNAVAILABLE", async () => {
    env({ OUTBOUND_PROXY: "OCI", OCI_PROXY_URL: OCI });
    readEgressSelection.mockRejectedValue(new Error("connection refused"));
    const resolved = await resolveOutboundProxyAsync();
    expect(resolved.provider).toBe("OCI");
    expect(resolved.decidedBy).toBe("ENV");
    expect(resolved.store).toBe("UNAVAILABLE");
  });
});

describe("④ 고른 쪽의 URL 이 없으면 숨기지 않는다", () => {
  it("🔴 DB=FIXIE 인데 FIXIE_URL 이 없으면 OCI 로 나가고, provider 가 OCI 라고 말한다", async () => {
    env({ OCI_PROXY_URL: OCI });
    dbSelects("FIXIE");
    const resolved = await resolveOutboundProxyAsync();
    expect(resolved.provider).toBe("OCI");
    expect(resolved.decidedBy).toBe("ENV");
  });

  it("고를 수 있는 provider 는 URL 이 있는 것만이다", () => {
    env({ OCI_PROXY_URL: OCI, FIXIE_URL: FIXIE });
    expect(configuredEgressProviders()).toEqual(["OCI", "FIXIE"]);
    env({ OCI_PROXY_URL: OCI });
    expect(configuredEgressProviders()).toEqual(["OCI"]);
    env({});
    expect(configuredEgressProviders()).toEqual([]);
  });

  it("env 이름 매핑은 한 곳이다 — OCI_PROXY_URL · FIXIE_URL", () => {
    env({ OCI_PROXY_URL: OCI, FIXIE_URL: FIXIE });
    expect(envProxyUrlFor("OCI")).toBe(OCI);
    expect(envProxyUrlFor("FIXIE")).toBe(FIXIE);
    env({});
    expect(envProxyUrlFor("OCI")).toBeNull();
    expect(envProxyUrlFor("FIXIE")).toBeNull();
  });
});

describe("⑤ dispatcher 는 URL 당 하나다 (소켓 누수 방지)", () => {
  it("🔴 같은 URL 이면 같은 agent 를 돌려준다 — 요청마다 새로 만들지 않는다", async () => {
    env({ OUTBOUND_PROXY: "OCI", OCI_PROXY_URL: OCI });
    dbSelects(null);
    const first = await createOutboundProxyDispatcherAsync();
    invalidateEgressSelectionCache();
    const second = await createOutboundProxyDispatcherAsync();
    expect(first).toBeDefined();
    expect(second).toBe(first);
  });

  it("provider 가 다르면 다른 agent 다", () => {
    env({ OCI_PROXY_URL: OCI, FIXIE_URL: FIXIE });
    const oci = dispatcherForProvider("OCI");
    const fixie = dispatcherForProvider("FIXIE");
    expect(oci).toBeDefined();
    expect(fixie).toBeDefined();
    expect(fixie).not.toBe(oci);
  });

  it("URL 이 없는 provider 를 강제하면 undefined 다 — 직접 연결로 조용히 바꾸지 않는다", () => {
    env({ OCI_PROXY_URL: OCI });
    expect(dispatcherForProvider("FIXIE")).toBeUndefined();
  });
});

describe("⑥ DB 를 매 요청마다 때리지 않는다", () => {
  it("TTL 안에서는 선택값을 한 번만 읽는다", async () => {
    env({ OCI_PROXY_URL: OCI });
    dbSelects("OCI");
    await resolveOutboundProxyAsync();
    await resolveOutboundProxyAsync();
    await resolveOutboundProxyAsync();
    expect(readEgressSelection).toHaveBeenCalledTimes(1);
  });

  it("🔴 전환 직후에는 캐시를 버린다 — 그러지 않으면 셀러가 15초 동안 옛 프록시로 나간다", async () => {
    env({ OCI_PROXY_URL: OCI });
    dbSelects("OCI");
    await resolveOutboundProxyAsync();
    invalidateEgressSelectionCache();
    await resolveOutboundProxyAsync();
    expect(readEgressSelection).toHaveBeenCalledTimes(2);
  });
});

describe("⑦ 진단은 여전히 비밀을 말하지 않는다", () => {
  it("🔴 host/port 만 나온다 — 사용자명·비밀번호가 든 URL 전체는 절대 안 나온다", async () => {
    env({ OUTBOUND_PROXY: "FIXIE", FIXIE_URL: FIXIE });
    dbSelects("FIXIE");
    const diagnostics = await getOutboundProxyDiagnosticsAsync();
    expect(diagnostics).toMatchObject({ provider: "FIXIE", host: "fixie.example", status: "READY" });
    const serialized = JSON.stringify(diagnostics);
    expect(serialized).not.toContain("user");
    expect(serialized).not.toContain("pw");
    expect(serialized).not.toContain(FIXIE);
  });

  it("URL 형식이 깨져 있으면 값을 지어내지 않는다", async () => {
    env({ OUTBOUND_PROXY: "OCI", OCI_PROXY_URL: "not-a-url" });
    dbSelects("OCI");
    const diagnostics = await getOutboundProxyDiagnosticsAsync();
    expect(diagnostics.status).toBe("NOT_CONFIGURED");
    expect(diagnostics.host).toBeNull();
  });
});
