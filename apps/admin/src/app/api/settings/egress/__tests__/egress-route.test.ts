import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * EGRESS ④ — /api/settings/egress (2026-10-10)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일이 지키는 것은 넷이다.
 *
 *   ① GET 은 **실측하지 않는다** — 설정 화면을 열 때마다 장애 중인 프록시를
 *      다시 때리고 화면이 20초 멈추는 것을 막는다
 *   ② 비밀값(proxy URL·자격증명·host/port)이 응답에 없다
 *   ③ **「DB 쓰기 성공」을 「정상」으로 쓰지 않는다** — 실제 외부 요청이
 *      나가지 않으면 저장 자체를 하지 않는다
 *   ④ **자동 failover 가 없다** — 실패하면 기존 provider 로 남고, 라우트가
 *      대신 다른 provider 를 골라 주지 않는다 (A⑦)
 */

const checkEgressHealth = vi.fn();
const recordEgressHealth = vi.fn();
const readEgressSelection = vi.fn();
const writeEgressSelection = vi.fn();
const readEgressLog = vi.fn();
const resolveOutboundProxyAsync = vi.fn();
const invalidateEgressSelectionCache = vi.fn();
const configuredEgressProviders = vi.fn();

vi.mock("@/lib/egress-health", () => ({
  checkEgressHealth: (...a: unknown[]) => checkEgressHealth(...a),
  recordEgressHealth: (...a: unknown[]) => recordEgressHealth(...a),
}));

vi.mock("@/lib/egress-settings", () => ({
  EGRESS_PROVIDERS: ["OCI", "FIXIE"],
  asEgressProvider: (v: unknown) => (v === "OCI" || v === "FIXIE" ? v : null),
  readEgressSelection: (...a: unknown[]) => readEgressSelection(...a),
  writeEgressSelection: (...a: unknown[]) => writeEgressSelection(...a),
  readEgressLog: (...a: unknown[]) => readEgressLog(...a),
}));

vi.mock("@/lib/outbound-proxy", () => ({
  resolveOutboundProxyAsync: (...a: unknown[]) => resolveOutboundProxyAsync(...a),
  invalidateEgressSelectionCache: (...a: unknown[]) => invalidateEgressSelectionCache(...a),
  configuredEgressProviders: (...a: unknown[]) => configuredEgressProviders(...a),
}));

import { GET, POST } from "../route";

const SECRET_URL = "http://fixieuser:fixiepw@velodrome.usefixie.com:80";

const healthy = (provider: "OCI" | "FIXIE") => ({
  provider,
  health: "NORMAL" as const,
  tcp: { verdict: "PASS", elapsedMs: 180, detail: null },
  connect: { verdict: "PASS", elapsedMs: 420, detail: null },
  outbound: { verdict: "PASS", elapsedMs: 780, detail: null },
  outboundIp: "203.0.113.7",
  totalElapsedMs: 980,
  checkedAt: "2026-10-10T00:00:00.000Z",
});

/** 2026-10-10 장애 양상 — TCP 는 살아 있고 CONNECT 가 무응답이다. */
const hung = (provider: "OCI" | "FIXIE") => ({
  provider,
  health: "DOWN" as const,
  tcp: { verdict: "PASS", elapsedMs: 186, detail: null },
  connect: { verdict: "TIMEOUT", elapsedMs: 25003, detail: "UND_ERR_CONNECT_TIMEOUT" },
  outbound: { verdict: "SKIPPED", elapsedMs: null, detail: null },
  outboundIp: null,
  totalElapsedMs: 25200,
  checkedAt: "2026-10-10T00:00:00.000Z",
});

function post(body: unknown): Request {
  return new Request("http://localhost/api/settings/egress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  for (const fn of [
    checkEgressHealth,
    recordEgressHealth,
    readEgressSelection,
    writeEgressSelection,
    readEgressLog,
    resolveOutboundProxyAsync,
    invalidateEgressSelectionCache,
    configuredEgressProviders,
  ]) {
    fn.mockReset();
  }
  readEgressSelection.mockResolvedValue({ provider: "OCI", store: "READY" });
  resolveOutboundProxyAsync.mockResolvedValue({
    provider: "OCI",
    url: SECRET_URL,
    decidedBy: "DB",
    store: "READY",
  });
  readEgressLog.mockResolvedValue({ entries: [], store: "READY" });
  configuredEgressProviders.mockReturnValue(["OCI", "FIXIE"]);
  recordEgressHealth.mockResolvedValue({ logged: true });
  writeEgressSelection.mockResolvedValue({ ok: true });
});

describe("① GET 은 실측하지 않는다", () => {
  it("🔴 화면을 열었을 뿐인데 프록시를 때리지 않는다", async () => {
    await GET();
    expect(checkEgressHealth).not.toHaveBeenCalled();
  });

  it("기록된 최근 측정을 돌려준다 — 이력이 없으면 health 는 null 이다(추정 금지)", async () => {
    const body = await (await GET()).json();
    expect(body.lastCheck).toBeNull();
    expect(body.availableProviders.every((p: { health: null }) => p.health === null)).toBe(true);
  });

  it("🔴 migration 전과 장애를 갈라 내보낸다", async () => {
    readEgressSelection.mockResolvedValue({
      provider: null,
      store: "NOT_MIGRATED",
      reason: "078 migration 이 아직 적용되지 않았습니다 — env 설정을 그대로 씁니다.",
    });
    resolveOutboundProxyAsync.mockResolvedValue({
      provider: "OCI",
      url: SECRET_URL,
      decidedBy: "ENV",
      store: "NOT_MIGRATED",
    });
    const body = await (await GET()).json();
    expect(body.store).toBe("NOT_MIGRATED");
    expect(body.decidedBy).toBe("ENV");
    expect(body.selectedProvider).toBeNull();
    /* 대조군 — 그래도 「지금 어디로 나가는가」는 답한다. */
    expect(body.currentProvider).toBe("OCI");
  });
});

describe("② 비밀값이 응답에 없다", () => {
  it("🔴 proxy URL·자격증명·host/port 가 한 글자도 나가지 않는다", async () => {
    readEgressLog.mockResolvedValue({
      entries: [
        {
          id: "1",
          createdAt: "2026-10-10T00:00:00.000Z",
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
      store: "READY",
    });
    const text = await (await GET()).text();
    expect(text).not.toContain("fixiepw");
    expect(text).not.toContain("fixieuser");
    expect(text).not.toContain("velodrome");
    expect(text).not.toContain(SECRET_URL);
    /* 대조군 — 응답이 비어서 통과한 것이 아니다. */
    expect(text).toContain("OCI");
    expect(text).toContain("TIMEOUT");
  });
});

describe("③ 어휘 밖의 값을 받아 넘기지 않는다", () => {
  it.each(["oci", "TINYPROXY", "", " OCI", 1])("🔴 %s 는 400 으로 거절한다", async (bad) => {
    const res = await POST(post({ provider: bad }));
    expect(res.status).toBe(400);
    expect(writeEgressSelection).not.toHaveBeenCalled();
    expect(checkEgressHealth).not.toHaveBeenCalled();
  });

  it("본문이 깨져 있으면 400 이다", async () => {
    const res = await POST(
      new Request("http://localhost/api/settings/egress", { method: "POST", body: "not-json" }),
    );
    expect(res.status).toBe(400);
  });
});

describe("④ 측정만 하는 경로는 저장하지 않는다", () => {
  it('🔴 action="test" 는 선택값을 바꾸지 않는다', async () => {
    checkEgressHealth.mockResolvedValue(healthy("FIXIE"));
    const body = await (await POST(post({ action: "test", provider: "FIXIE" }))).json();

    expect(checkEgressHealth).toHaveBeenCalledWith("FIXIE");
    expect(writeEgressSelection).not.toHaveBeenCalled();
    expect(invalidateEgressSelectionCache).not.toHaveBeenCalled();
    expect(body.switched).toBe(false);
    /* 🔴 선택값은 «기존» 그대로임을 값으로 돌려준다. */
    expect(body.selectedProvider).toBe("OCI");
    expect(recordEgressHealth).toHaveBeenCalledWith(expect.anything(), { source: "HEALTH_CHECK" });
  });
});

describe("⑤ 🔴 실제로 나가지 않으면 저장하지 않는다", () => {
  it("🔴 CONNECT hang 이면 DB 를 건드리지 않고 기존 provider 를 유지한다", async () => {
    checkEgressHealth.mockResolvedValue(hung("FIXIE"));
    const res = await POST(post({ provider: "FIXIE" }));
    const body = await res.json();

    expect(writeEgressSelection).not.toHaveBeenCalled();
    expect(invalidateEgressSelectionCache).not.toHaveBeenCalled();
    expect(body.ok).toBe(false);
    expect(body.switched).toBe(false);
    expect(body.selectedProvider).toBe("OCI");
    /* 실패도 이력에 남는다 — switch_committed=false 로. */
    expect(recordEgressHealth).toHaveBeenCalledWith(expect.anything(), {
      source: "SWITCH",
      switchedFrom: "OCI",
      switchCommitted: false,
    });
  });

  it("🔴 자동 failover 가 없다 — 실패 응답이 다른 provider 를 골라 주지 않는다", async () => {
    checkEgressHealth.mockResolvedValue(hung("FIXIE"));
    const body = await (await POST(post({ provider: "FIXIE" }))).json();

    /* 측정은 요청받은 provider «하나» 에만 했다. */
    expect(checkEgressHealth).toHaveBeenCalledTimes(1);
    expect(checkEgressHealth).toHaveBeenCalledWith("FIXIE");
    /* 저장은 아무것도 안 했고, 선택값은 기존 그대로다. */
    expect(writeEgressSelection).not.toHaveBeenCalled();
    expect(body.selectedProvider).toBe("OCI");
  });

  it("🔴 DEGRADED(터널은 섰지만 외부 실패)도 전환하지 않는다", async () => {
    checkEgressHealth.mockResolvedValue({
      ...healthy("FIXIE"),
      health: "DEGRADED",
      outbound: { verdict: "ERROR", elapsedMs: 900, detail: "외부 응답 HTTP 503" },
    });
    const body = await (await POST(post({ provider: "FIXIE" }))).json();
    expect(body.ok).toBe(false);
    expect(writeEgressSelection).not.toHaveBeenCalled();
  });

  it("측정은 통과했는데 저장이 실패하면 전환으로 보고하지 않는다", async () => {
    checkEgressHealth.mockResolvedValue(healthy("FIXIE"));
    writeEgressSelection.mockResolvedValue({
      ok: false,
      store: "NOT_MIGRATED",
      error: "078 migration 이 아직 적용되지 않아 선택을 저장할 수 없습니다.",
    });
    const body = await (await POST(post({ provider: "FIXIE" }))).json();
    expect(body.ok).toBe(false);
    expect(body.switched).toBe(false);
    expect(body.store).toBe("NOT_MIGRATED");
    expect(body.selectedProvider).toBe("OCI");
    expect(invalidateEgressSelectionCache).not.toHaveBeenCalled();
  });
});

describe("⑥ 성공 경로", () => {
  it("🔴 측정 PASS → 저장 → 캐시 무효화 → 전환 기록, 순서대로 전부 한다", async () => {
    checkEgressHealth.mockResolvedValue(healthy("FIXIE"));
    resolveOutboundProxyAsync
      .mockResolvedValueOnce({ provider: "OCI", url: SECRET_URL, decidedBy: "DB", store: "READY" })
      .mockResolvedValue({ provider: "FIXIE", url: SECRET_URL, decidedBy: "DB", store: "READY" });

    const body = await (await POST(post({ provider: "FIXIE" }))).json();

    expect(writeEgressSelection).toHaveBeenCalledWith("FIXIE");
    expect(invalidateEgressSelectionCache).toHaveBeenCalledTimes(1);
    expect(recordEgressHealth).toHaveBeenCalledWith(expect.anything(), {
      source: "SWITCH",
      switchedFrom: "OCI",
      switchCommitted: true,
    });
    expect(body).toMatchObject({ ok: true, switched: true, selectedProvider: "FIXIE" });
  });

  it("🔴 null 로 되돌리면 env 가 고를 쪽을 «실제로» 재고 나서 저장한다", async () => {
    readEgressSelection.mockResolvedValue({ provider: "FIXIE", store: "READY" });
    resolveOutboundProxyAsync.mockResolvedValue({
      provider: "OCI",
      url: SECRET_URL,
      decidedBy: "ENV",
      store: "READY",
    });
    checkEgressHealth.mockResolvedValue(healthy("OCI"));

    const body = await (await POST(post({ provider: null }))).json();

    expect(checkEgressHealth).toHaveBeenCalledWith("OCI");
    expect(writeEgressSelection).toHaveBeenCalledWith(null);
    expect(body.selectedProvider).toBeNull();
  });

  it("되돌릴 대상이 env 에 없으면 409 이고 아무것도 저장하지 않는다", async () => {
    resolveOutboundProxyAsync.mockResolvedValue({
      provider: "NONE",
      url: null,
      decidedBy: "ENV",
      store: "READY",
    });
    const res = await POST(post({ provider: null }));
    expect(res.status).toBe(409);
    expect(writeEgressSelection).not.toHaveBeenCalled();
    expect(checkEgressHealth).not.toHaveBeenCalled();
  });
});
