import { afterEach, describe, expect, it, vi } from "vitest";

import {
  checkEgressHealth,
  classifyProxyFailure,
  toConnectResult,
  toOutboundResult,
  type EgressStageResult,
} from "../egress-health";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * EGRESS ⑥ — 단계를 «갈라» 재는가 (2026-10-10)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일이 지키는 것은 **2026-10-10 장애를 정상으로 판정하지 않는 것** 하나다.
 *
 *       TCP 8888   OPEN 3/3     ← 포트는 살아 있었다
 *       CONNECT    무응답 25s   ← 터널이 서지 않았다
 *
 *    이걸 「포트 열림 = 정상」으로 읽어서 시간을 잃었다. 그리고 그 실패를
 *    「outbound 실패」로 적으면 원인이 외부 API 로 오인된다 — 078 이 두 칸을
 *    갈라 만든 이유가 그것이다.
 *
 * 🔴 **CONNECT 가 실패하면 outbound 는 NULL 이다.** 「실패」가 아니다.
 *    그 구별이 이 테스트의 중심이고, 아래 ①②가 그것만 본다.
 */

const stage = (verdict: EgressStageResult["verdict"], detail: string | null = null): EgressStageResult => ({
  verdict,
  elapsedMs: 0,
  detail,
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("① CONNECT 실패를 outbound 실패로 적지 않는다", () => {
  it("🔴 SKIPPED 는 NULL 이다 — 「그 단계까지 가지 못했다」를 성공/실패로 바꾸지 않는다", () => {
    expect(toOutboundResult(stage("SKIPPED"))).toBeNull();
    expect(toConnectResult(stage("SKIPPED"))).toBeNull();
  });

  it("🔴 NOT_CONFIGURED 도 NULL 이다 — 설정 안 됨은 실패가 아니다", () => {
    expect(toConnectResult(stage("NOT_CONFIGURED"))).toBeNull();
    expect(toOutboundResult(stage("NOT_CONFIGURED"))).toBeNull();
  });

  it("단계 어휘가 078 CHECK 와 맞는다 (대조군 — 전부 NULL 로 뭉개지지 않는다)", () => {
    expect(toConnectResult(stage("PASS"))).toBe("OK");
    expect(toConnectResult(stage("REFUSED"))).toBe("REFUSED");
    expect(toConnectResult(stage("TIMEOUT"))).toBe("TIMEOUT");
    expect(toConnectResult(stage("ERROR"))).toBe("ERROR");
    expect(toOutboundResult(stage("PASS"))).toBe("OK");
    expect(toOutboundResult(stage("TIMEOUT"))).toBe("TIMEOUT");
  });

  it("🔴 외부 HTTP 오류는 ERROR 가 아니라 HTTP_ERROR 다 — 「응답이 왔다」는 사실을 지우지 않는다", () => {
    expect(toOutboundResult(stage("ERROR", "외부 응답 HTTP 503"))).toBe("HTTP_ERROR");
    expect(toOutboundResult(stage("ERROR", "TypeError: fetch failed"))).toBe("ERROR");
  });
});

describe("② 원인 체인을 프록시 계층과 그 밖으로 가른다", () => {
  it("🔴 무응답(20~25s hang)은 CONNECT TIMEOUT 이고 프록시 계층이다 — 2026-10-10 의 그 양상", () => {
    const verdict = classifyProxyFailure([
      "TypeError: fetch failed",
      "Error: The operation was aborted due to timeout (code: UND_ERR_CONNECT_TIMEOUT)",
    ]);
    expect(verdict).toEqual({ verdict: "TIMEOUT", proxyLayer: true });
  });

  it("🔴 407 은 REFUSED 다 — 「응답 계층이 살아 있다」를 「나갈 수 있다」로 쓰지 않는다", () => {
    expect(classifyProxyFailure(["Error: Proxy response (407) !== 200"])).toEqual({
      verdict: "REFUSED",
      proxyLayer: true,
    });
  });

  it("ECONNREFUSED 는 거절이다", () => {
    expect(classifyProxyFailure(["Error: connect ECONNREFUSED 161.33.39.233:8888 (code: ECONNREFUSED)"])).toEqual({
      verdict: "REFUSED",
      proxyLayer: true,
    });
  });

  it("이름 해석 실패는 ERROR 이지만 여전히 프록시 계층이다", () => {
    expect(classifyProxyFailure(["Error: getaddrinfo ENOTFOUND proxy.example (code: ENOTFOUND)"])).toEqual({
      verdict: "ERROR",
      proxyLayer: true,
    });
  });

  it("🔴 프록시 신호가 «없으면» 프록시 계층으로 단정하지 않는다 (대조군)", () => {
    const verdict = classifyProxyFailure(["SyntaxError: Unexpected token < in JSON at position 0"]);
    expect(verdict.proxyLayer).toBe(false);
  });
});

describe("③ TCP 가 막히면 뒤 단계를 «실행하지 않았다» 고 적는다", () => {
  it("🔴 닫힌 포트 → health DOWN · connect/outbound 는 SKIPPED", async () => {
    /* 대조군으로 쓰는 주소다 — 127.0.0.1:1 은 확실히 닫혀 있다.
       「측정 방법 자체」를 검증하는 장치이기도 하다(열린 포트만 재면
       REFUSED 를 한 번도 보지 못한 채 통과한다). */
    vi.stubEnv("OCI_PROXY_URL", "http://127.0.0.1:1");
    vi.stubEnv("FIXIE_URL", "");
    const report = await checkEgressHealth("OCI");

    expect(report.health).toBe("DOWN");
    expect(["REFUSED", "ERROR", "TIMEOUT"]).toContain(report.tcp.verdict);
    expect(report.connect.verdict).toBe("SKIPPED");
    expect(report.outbound.verdict).toBe("SKIPPED");
    /* 🔴 그래서 이력에는 connect/outbound 가 NULL 로 들어간다. */
    expect(toConnectResult(report.connect)).toBeNull();
    expect(toOutboundResult(report.outbound)).toBeNull();
  }, 15_000);

  it("🔴 TCP PASS 를 「정상」으로 쓰지 않는다 — health 는 세 단계의 합이다", () => {
    /* 2026-10-10 의 보고서를 그대로 재구성한다: TCP 는 PASS, CONNECT 는 무응답.
       이 조합이 NORMAL 로 판정되면 그 장애를 또 놓친다. */
    const tcp = stage("PASS");
    const connect = stage("TIMEOUT", "UND_ERR_CONNECT_TIMEOUT");
    const outbound = stage("SKIPPED");
    const normalRequires = tcp.verdict === "PASS" && connect.verdict === "PASS" && outbound.verdict === "PASS";
    expect(normalRequires).toBe(false);
  });
});

describe("④ 설정되지 않은 provider 를 「실패」로 적지 않는다", () => {
  it("🔴 URL 이 없으면 NOT_CONFIGURED 이고 DOWN 이 아니다 — 조치가 다르다", async () => {
    vi.stubEnv("OCI_PROXY_URL", "");
    vi.stubEnv("FIXIE_URL", "");
    const report = await checkEgressHealth("FIXIE");
    expect(report.health).toBe("NOT_CONFIGURED");
    expect(report.tcp.verdict).toBe("NOT_CONFIGURED");
    expect(report.connect.verdict).toBe("SKIPPED");
  });

  it("주소 형식이 깨져 있으면 값을 지어내지 않는다", async () => {
    vi.stubEnv("OCI_PROXY_URL", "not-a-url");
    const report = await checkEgressHealth("OCI");
    expect(report.health).toBe("NOT_CONFIGURED");
    expect(report.outboundIp).toBeNull();
  });
});

describe("⑤ 보고서에 비밀값이 없다", () => {
  it("🔴 자격증명이 든 URL 을 줘도 보고서에 나오지 않는다", async () => {
    /* 🔴 실제 프록시 호스트를 쓰지 않는다 — 단위 테스트가 외부 네트워크에
       의존하면 네트워크가 없는 환경에서 «이유 없이» 떨어지고, 그때 가드가
       깨진 것인지 선이 빠진 것인지 구별할 수 없다. 닫힌 주소로도 이 가드가
       재려는 것(보고서에 자격증명이 실리는가)은 그대로 재진다. */
    vi.stubEnv("FIXIE_URL", "http://fixieuser:fixiepw@127.0.0.1:1");
    vi.stubEnv("OCI_PROXY_URL", "");
    const report = await checkEgressHealth("FIXIE");
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("fixiepw");
    expect(serialized).not.toContain("fixieuser");
    /* 대조군 — 보고서가 비어서 통과한 것이 아니다. */
    expect(serialized).toContain("FIXIE");
    expect(report.tcp.verdict).not.toBe("PASS");
  }, 15_000);
});
