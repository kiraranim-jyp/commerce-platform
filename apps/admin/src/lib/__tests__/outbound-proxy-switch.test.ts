import { afterEach, describe, expect, it, vi } from "vitest";
import { getOutboundProxyDiagnostics } from "../outbound-proxy";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * OUTBOUND-PROXY-SWITCH(CEO 지시, 2026-09-22)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 2026-09-22, 스마트스토어·쿠팡·롯데ON 의 연결 확인이 «동시에» 실패했다. 셋의
 * 유일한 공통 경로가 아웃바운드 프록시다(롯데ON 은 그날 하루 종일 같은 경로에서
 * 20초 timeout 과 성공을 오갔다 — proxy=OCI).
 *
 * 문서화돼 있던 원복 절차는 「Vercel 에서 OCI_PROXY_URL 을 제거」였는데, 그러면
 * 그 값이 사라져 되돌릴 수 없다. 그래서 «지우는» 대신 «고르는» 스위치를 뒀다.
 *
 * 🔴 이 파일이 지키는 것은 두 가지다.
 *    ① 고른 대로 나간다
 *    ② 스위치가 없으면 **예전과 한 글자도 다르지 않다**(무회귀)
 *
 * 🔴 Fixie 는 사용량 상한이 있다. 되돌리기가 «한 줄» 이어야 한다는 것이 이
 *    설계의 핵심이고, 그래서 OCI_PROXY_URL 을 지우지 않는다.
 */

const OCI = "http://oci.example:8888";
const FIXIE = "http://user:pw@fixie.example:80";

/** 값 자체는 검사하지 않는다 — 진단은 host/port 만 노출하고 URL 전체는 숨긴다. */
const providerWith = (env: Record<string, string | undefined>) => {
  vi.stubEnv("OUTBOUND_PROXY", env.OUTBOUND_PROXY ?? "");
  vi.stubEnv("OCI_PROXY_URL", env.OCI_PROXY_URL ?? "");
  vi.stubEnv("FIXIE_URL", env.FIXIE_URL ?? "");
  return getOutboundProxyDiagnostics().provider;
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("① 고른 대로 나간다", () => {
  it("🔴 OUTBOUND_PROXY=FIXIE 면 OCI_PROXY_URL 이 «살아 있어도» FIXIE 로 나간다", () => {
    expect(providerWith({ OUTBOUND_PROXY: "FIXIE", OCI_PROXY_URL: OCI, FIXIE_URL: FIXIE })).toBe("FIXIE");
  });

  it("OUTBOUND_PROXY=OCI 면 OCI 로 나간다", () => {
    expect(providerWith({ OUTBOUND_PROXY: "OCI", OCI_PROXY_URL: OCI, FIXIE_URL: FIXIE })).toBe("OCI");
  });

  it.each([["fixie"], ["Fixie"], ["  FIXIE  "]])("대소문자·공백은 문제되지 않는다(%s)", (raw) => {
    expect(providerWith({ OUTBOUND_PROXY: raw, OCI_PROXY_URL: OCI, FIXIE_URL: FIXIE })).toBe("FIXIE");
  });
});

describe("② 무회귀 — 스위치가 없으면 예전 그대로다", () => {
  it("🔴 스위치 없음 + 둘 다 있음 → OCI 우선(이 변경 전과 같다)", () => {
    expect(providerWith({ OCI_PROXY_URL: OCI, FIXIE_URL: FIXIE })).toBe("OCI");
  });

  it("스위치 없음 + OCI 만 없음 → FIXIE", () => {
    expect(providerWith({ FIXIE_URL: FIXIE })).toBe("FIXIE");
  });

  it("둘 다 없으면 NONE — 프록시를 지어내지 않는다", () => {
    expect(providerWith({})).toBe("NONE");
  });

  it("모르는 값은 스위치로 치지 않는다 — 오타가 동작을 바꾸면 안 된다", () => {
    expect(providerWith({ OUTBOUND_PROXY: "FIXY", OCI_PROXY_URL: OCI, FIXIE_URL: FIXIE })).toBe("OCI");
  });
});

describe("③ 고른 쪽이 «없을» 때를 숨기지 않는다", () => {
  it("🔴 FIXIE 를 골랐는데 FIXIE_URL 이 없으면 OCI 로 나가고, provider 가 그 사실을 말한다", () => {
    // 조용히 FIXIE 인 척하지 않는다 — 롯데ON 처럼 IP allowlist 가 걸린 채널에서
    // 「FIXIE 를 골랐는데 왜 안 되지」로 원인을 못 찾게 되면 안 된다.
    expect(providerWith({ OUTBOUND_PROXY: "FIXIE", OCI_PROXY_URL: OCI })).toBe("OCI");
  });

  it("OCI 를 골랐는데 OCI_PROXY_URL 이 없으면 FIXIE 로 나가고, provider 가 그렇게 말한다", () => {
    expect(providerWith({ OUTBOUND_PROXY: "OCI", FIXIE_URL: FIXIE })).toBe("FIXIE");
  });
});

describe("④ 진단은 여전히 비밀을 말하지 않는다", () => {
  it("🔴 host/port 만 나온다 — 사용자명·비밀번호가 든 URL 전체는 절대 안 나온다", () => {
    vi.stubEnv("OUTBOUND_PROXY", "FIXIE");
    vi.stubEnv("OCI_PROXY_URL", "");
    vi.stubEnv("FIXIE_URL", FIXIE);
    const d = getOutboundProxyDiagnostics();
    expect(d).toEqual({ provider: "FIXIE", host: "fixie.example", port: null, status: "READY" });
    expect(JSON.stringify(d)).not.toContain("pw");
    expect(JSON.stringify(d)).not.toContain("user");
  });
});
