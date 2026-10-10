import { afterEach, describe, expect, it, vi } from "vitest";

import { asEgressProvider, EGRESS_PROVIDERS, redactEgressDetail } from "../egress-settings";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * EGRESS A⑨ — 비밀값이 이력으로 새는 길을 입구에서 끊는다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `commerce_egress_log.detail` 은 사람이 읽는 진단 문구다. 지금 넣기로 한 것은
 * `describeErrorCauseChain()` 의 결과뿐이고, 그 함수는 host/port/에러코드만
 * 남긴다 — 즉 **현재는** 안전하다.
 *
 * 🔴 문제는 「현재는 안전하다」가 가드가 아니라는 것이다. 나중에 누군가
 *    `fetch` 입력 URL 이나 `error.message` 를 그대로 detail 에 넣으면
 *    자격증명이 DB → API → 화면까지 한 번에 흘러간다. 되돌릴 수 없는 유출이다.
 *    그래서 저장 «직전» 과 읽기 «직후» 에 한 번 더 지운다.
 *
 * 🔴 「전부 지워버리는 구현」과 구별하기 위해 **대조군** 을 같이 둔다 —
 *    정상 진단 문구는 한 글자도 깎이지 않아야 한다. 안 그러면 가드가
 *    진단을 죽이고도 테스트는 통과한다.
 */

const OCI = "http://oci.example:8888";
const FIXIE = "http://fixieuser:fixiepw@velodrome.usefixie.com:80";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("① env 에 든 프록시 URL 이 문구에 섞여도 남지 않는다", () => {
  it("🔴 OCI_PROXY_URL 전체가 등장하면 지워진다", () => {
    vi.stubEnv("OCI_PROXY_URL", OCI);
    const out = redactEgressDetail(`connect ECONNREFUSED to ${OCI} after 25003ms`);
    expect(out).not.toContain(OCI);
    expect(out).toContain("[REDACTED]");
    /* 대조군 — 진단에 필요한 사실은 남아 있어야 한다. */
    expect(out).toContain("ECONNREFUSED");
    expect(out).toContain("25003ms");
  });

  it("🔴 FIXIE_URL 의 자격증명이 남지 않는다", () => {
    vi.stubEnv("FIXIE_URL", FIXIE);
    const out = redactEgressDetail(`Proxy response (407) from ${FIXIE}`);
    expect(out).not.toContain("fixiepw");
    expect(out).not.toContain("fixieuser");
    expect(out).toContain("407");
  });
});

describe("② env 와 다른 자격증명도 잡는다", () => {
  it("🔴 `//user:pass@` 형태는 env 에 없어도 지워진다", () => {
    vi.stubEnv("OCI_PROXY_URL", "");
    vi.stubEnv("FIXIE_URL", "");
    const out = redactEgressDetail("tunnel failed: http://someone:s3cret@proxy.internal:3128");
    expect(out).not.toContain("s3cret");
    expect(out).not.toContain("someone");
    expect(out).toContain("[REDACTED]");
    /* 대조군 — host/port 는 진단에 필요하므로 남는다. */
    expect(out).toContain("proxy.internal:3128");
  });
});

describe("③ 정상 문구는 깎지 않는다 (대조군)", () => {
  it("describeErrorCauseChain 모양의 문구가 그대로 보존된다", () => {
    vi.stubEnv("OCI_PROXY_URL", OCI);
    vi.stubEnv("FIXIE_URL", FIXIE);
    const chain = "TypeError: fetch failed | Error: connect ETIMEDOUT 161.33.39.233:8888 (code: ETIMEDOUT)";
    expect(redactEgressDetail(chain)).toBe(chain);
  });

  it("빈 값·null 은 null 이다 — 빈 문자열을 지어내지 않는다", () => {
    expect(redactEgressDetail(null)).toBeNull();
    expect(redactEgressDetail(undefined)).toBeNull();
    expect(redactEgressDetail("")).toBeNull();
  });

  it("🔴 env 가 빈 문자열이면 아무것도 지우지 않는다 — 전체 문구가 날아가면 안 된다", () => {
    vi.stubEnv("OCI_PROXY_URL", "");
    vi.stubEnv("FIXIE_URL", "");
    expect(redactEgressDetail("CONNECT timeout after 25s")).toBe("CONNECT timeout after 25s");
  });
});

describe("④ provider 어휘는 둘뿐이다", () => {
  it("OCI · FIXIE 만 통과한다", () => {
    expect(asEgressProvider("OCI")).toBe("OCI");
    expect(asEgressProvider("FIXIE")).toBe("FIXIE");
    expect(EGRESS_PROVIDERS).toEqual(["OCI", "FIXIE"]);
  });

  it("🔴 Tinyproxy 는 provider 가 아니다 (OCI 의 내부 구성요소다)", () => {
    expect(asEgressProvider("TINYPROXY")).toBeNull();
    expect(asEgressProvider("Tinyproxy")).toBeNull();
  });

  it("🔴 소문자·공백·빈 값·객체를 받아 넘기지 않는다 — 078 CHECK 와 같은 판정이다", () => {
    for (const bad of ["oci", "fixie", " OCI", "OCI ", "", null, undefined, 1, {}, ["OCI"]]) {
      expect(asEgressProvider(bad)).toBeNull();
    }
  });
});
