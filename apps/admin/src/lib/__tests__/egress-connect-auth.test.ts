import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  describeCredentialShape,
  explainConnectRefusal,
  probeConnect,
  type EgressHealthReport,
} from "../egress-health";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 407 의 «원인» 을 가른다 — 인증을 요구하는 «실제 프록시» 로 잰다 (2026-10-10)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Production 측정: OCI 정상 · **FIXIE 만 CONNECT 407**. 그리고 자격증명이
 * 필요한 provider 는 FIXIE 하나다(OCI 는 익명이다).
 *
 * 🔴 407 은 **두 가지 완전히 다른 사실**을 같은 모습으로 보여준다:
 *
 *     ⓐ 자격증명을 «보내지 못했다»  → 우리 설정 문제 (FIXIE_URL)
 *     ⓑ 보냈는데 «거절당했다»       → 계정 문제 (만료/사용량 한도) · CEO 사안
 *
 * 둘을 구별하지 못하면 고칠 곳을 못 고른다. 그래서 **진짜 CONNECT 프록시** 를
 * 띄워 우리 경로를 잰다 — 손으로 만든 요청이 아니라 운영 함수(`probeConnect`)
 * 로 잰다.
 *
 * 🔴 외부 네트워크에 의존하지 않는다. 프록시도 대상도 로컬이다 — 네트워크가
 *    없는 곳에서 «이유 없이» 떨어지면 가드가 깨진 것인지 선이 빠진 것인지
 *    구별할 수 없다.
 */

const USER = "fixieuser";
const PASS = "s3cr3t-pw";

type ProxyMode = "REQUIRE_AUTH" | "NO_AUTH" | "HANG";

let server: Server;
let port = 0;
/** 🔴 프록시가 «실제로 받은» Authorization 헤더의 존재 여부만 기록한다. */
let received: { hadAuthHeader: boolean; authOk: boolean } | null = null;

/* 🔴 CONNECT 로 넘어간 소켓은 server.close() 가 기다린다 — 직접 추적해 끊지
   않으면 afterEach 가 10초 hook timeout 으로 멈춘다(실제로 걸렸다). */
let sockets: Array<{ destroy: () => void }> = [];

function startProxy(mode: ProxyMode): Promise<void> {
  received = null;
  sockets = [];
  server = createServer();
  server.on("connection", (socket) => {
    sockets.push(socket);
  });
  server.on("connect", (req, socket) => {
    sockets.push(socket);
    if (mode === "HANG") return; /* 아무 응답도 하지 않는다 — 2026-10-10 양상 */

    const header = req.headers["proxy-authorization"];
    const expected = `Basic ${Buffer.from(`${USER}:${PASS}`).toString("base64")}`;
    const authOk = header === expected;
    received = { hadAuthHeader: typeof header === "string", authOk };

    if (mode === "NO_AUTH" || authOk) {
      socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      return;
    }
    socket.write(
      'HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="fixie-internal"\r\n\r\n',
    );
    socket.end();
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      port = (server.address() as AddressInfo).port;
      resolve();
    });
  });
}

/** 프록시 URL 을 만든다 — userinfo 조합을 바꿔 가며 잰다. */
function proxyUrl(userinfo: string): string {
  return `http://${userinfo}${userinfo ? "@" : ""}127.0.0.1:${port}`;
}

async function connectWith(userinfo: string) {
  return probeConnect({ host: "127.0.0.1", port, url: proxyUrl(userinfo) }, { host: "example.com", port: 443 });
}

afterEach(
  () =>
    new Promise<void>((resolve) => {
      for (const socket of sockets) {
        try {
          socket.destroy();
        } catch {
          /* 이미 닫힌 소켓은 넘어간다 */
        }
      }
      sockets = [];
      server.close(() => resolve());
    }),
);

describe("① 자격증명이 맞으면 터널이 선다 (대조군)", () => {
  beforeEach(() => startProxy("REQUIRE_AUTH"));

  it("🔴 URL 의 userinfo 가 실제로 Proxy-Authorization 으로 나간다", async () => {
    const result = await connectWith(`${USER}:${PASS}`);
    expect(result.verdict).toBe("PASS");
    expect(result.statusCode).toBe(200);
    expect(result.sentAuthHeader).toBe(true);
    /* 🔴 프록시 «쪽에서» 확인한다 — 우리가 보냈다고 주장하는 것으로 끝내지 않는다. */
    expect(received).toEqual({ hadAuthHeader: true, authOk: true });
  });
});

describe("② 🔴 ⓑ 보냈는데 거절당했다 — 계정 문제", () => {
  beforeEach(() => startProxy("REQUIRE_AUTH"));

  it("비밀번호가 틀리면 407 이고, 우리는 «보냈다»", async () => {
    const result = await connectWith(`${USER}:wrong-pw`);
    expect(result.verdict).toBe("REFUSED");
    expect(result.statusCode).toBe(407);
    expect(result.sentAuthHeader).toBe(true);
    expect(received).toEqual({ hadAuthHeader: true, authOk: false });
  });

  it("🔴 Proxy-Authenticate 의 scheme «토큰만» 남고 realm 은 버려진다", async () => {
    const result = await connectWith(`${USER}:wrong-pw`);
    expect(result.authScheme).toBe("Basic");
    /* realm 에 계정/조직 이름이 섞여 나올 수 있다 — 어디에도 남기지 않는다. */
    expect(JSON.stringify(result)).not.toContain("fixie-internal");
    expect(JSON.stringify(result)).not.toContain("realm");
  });

  it("🔴 비밀값이 결과에 없다", async () => {
    const serialized = JSON.stringify(await connectWith(`${USER}:${PASS}`));
    expect(serialized).not.toContain(PASS);
    expect(serialized).not.toContain(USER);
  });
});

describe("③ 🔴 ⓐ 보내지 못했다 — 우리 설정 문제", () => {
  beforeEach(() => startProxy("REQUIRE_AUTH"));

  it("🔴 사용자명만 있으면 인증 헤더가 «아예 붙지 않는다» — 그런데 결과는 같은 407 이다", async () => {
    const result = await connectWith(USER);
    expect(result.statusCode).toBe(407);
    expect(result.verdict).toBe("REFUSED");
    /* 🔴 이것이 ⓐ와 ⓑ를 가르는 단 하나의 사실이다. */
    expect(result.sentAuthHeader).toBe(false);
    expect(received?.hadAuthHeader).toBe(false);
  });

  it("자격증명이 아예 없으면 당연히 보내지 않는다", async () => {
    const result = await connectWith("");
    expect(result.statusCode).toBe(407);
    expect(result.sentAuthHeader).toBe(false);
  });
});

describe("④ 익명 프록시(OCI 모양)는 자격증명 없이 통과한다", () => {
  beforeEach(() => startProxy("NO_AUTH"));

  it("🔴 자격증명이 «필요 없는» provider 는 없어도 PASS 다 — OCI 가 그 모양이다", async () => {
    const result = await connectWith("");
    expect(result.verdict).toBe("PASS");
    expect(result.statusCode).toBe(200);
    expect(result.sentAuthHeader).toBe(false);
  });
});

describe("⑤ 무응답은 거절과 «다른» 판정이다", () => {
  beforeEach(() => startProxy("HANG"));

  it("🔴 응답이 오지 않으면 TIMEOUT 이고 statusCode 는 null 이다 (2026-10-10 양상)", async () => {
    const result = await connectWith(`${USER}:${PASS}`);
    expect(result.verdict).toBe("TIMEOUT");
    expect(result.statusCode).toBeNull();
    /* 🔴 「느리다」가 아니라 「안 온다」로 적혀 있어야 한다. */
    expect(result.detail).toContain("응답이 없습니다");
  }, 20_000);
});

describe("⑥ 자격증명 «모양» 만 보고한다 — 값은 돌려주지 않는다", () => {
  beforeEach(() => startProxy("NO_AUTH"));

  it.each([
    ["둘 다 있음", `http://u:p@h:8888`, { hasUsername: true, hasPassword: true, willSendAuthHeader: true }],
    ["사용자명만", `http://u@h:8888`, { hasUsername: true, hasPassword: false, willSendAuthHeader: false }],
    ["없음", `http://h:8888`, { hasUsername: false, hasPassword: false, willSendAuthHeader: false }],
  ])("%s", (_label, url, expected) => {
    expect(describeCredentialShape(url)).toMatchObject(expected);
  });

  it("🔴 모양에 값이 섞여 나오지 않는다 (길이도 주지 않는다 — 추측 재료다)", () => {
    const shape = describeCredentialShape(`http://${USER}:${PASS}@h:8888`);
    const serialized = JSON.stringify(shape);
    expect(serialized).not.toContain(USER);
    expect(serialized).not.toContain(PASS);
    expect(serialized).not.toContain(String(PASS.length));
  });

  it("URL 인코딩이 깨져 있으면 decodable=false 로 말한다", () => {
    expect(describeCredentialShape("http://u:%ZZ@h:8888").decodable).toBe(false);
    /* 대조군 — 정상 인코딩은 true 다. */
    expect(describeCredentialShape("http://u:%40abc@h:8888").decodable).toBe(true);
  });

  it("주소 형식 자체가 깨져 있으면 decodable=false 다", () => {
    expect(describeCredentialShape("not-a-url").decodable).toBe(false);
  });
});

describe("⑦ 407 의 «조치» 를 한 문장으로 가른다", () => {
  beforeEach(() => startProxy("NO_AUTH"));

  const report = (over: Partial<EgressHealthReport>): EgressHealthReport =>
    ({
      provider: "FIXIE",
      health: "DOWN",
      tcp: { verdict: "PASS", elapsedMs: 180, detail: null },
      connect: { verdict: "REFUSED", elapsedMs: 488, detail: "HTTP 407" },
      outbound: { verdict: "SKIPPED", elapsedMs: null, detail: null },
      outboundIp: null,
      connectStatusCode: 407,
      connectAuthScheme: "Basic",
      credential: {
        present: true,
        hasUsername: true,
        hasPassword: true,
        decodable: true,
        willSendAuthHeader: true,
      },
      sentAuthHeader: true,
      totalElapsedMs: 700,
      checkedAt: "2026-10-10T00:00:00.000Z",
      ...over,
    }) as EgressHealthReport;

  it("🔴 ⓑ 보냈는데 거절 → 「계정 쪽」 이라고 말한다", () => {
    const message = explainConnectRefusal(report({}));
    expect(message).toContain("보냈으나");
    expect(message).toContain("사용량 한도");
  });

  it("🔴 ⓐ 비밀번호가 없음 → 「인증을 보내지 못했다」 고 말한다", () => {
    const message = explainConnectRefusal(
      report({
        sentAuthHeader: false,
        credential: {
          present: true,
          hasUsername: true,
          hasPassword: false,
          decodable: true,
          willSendAuthHeader: false,
        },
      }),
    );
    expect(message).toContain("비밀번호");
    expect(message).toContain("보내지 못했습니다");
    /* 🔴 계정 문제라고 말하지 «않는다» — 고칠 곳이 다르다. */
    expect(message).not.toContain("사용량 한도");
  });

  it("자격증명이 아예 없는데 407 → 「설정되어 있지 않다」", () => {
    const message = explainConnectRefusal(
      report({
        sentAuthHeader: false,
        credential: {
          present: false,
          hasUsername: false,
          hasPassword: false,
          decodable: true,
          willSendAuthHeader: false,
        },
      }),
    );
    expect(message).toContain("설정되어 있지 않습니다");
  });

  it("407 이 아닌 거절은 상태코드를 그대로 말한다 — 407 전용 문구를 쓰지 않는다", () => {
    const message = explainConnectRefusal(report({ connectStatusCode: 403, connectAuthScheme: null }));
    expect(message).toContain("403");
    expect(message).not.toContain("인증");
  });

  it("🔴 거절이 아니면 이 문구를 만들지 않는다 (null)", () => {
    expect(explainConnectRefusal(report({ connect: { verdict: "PASS", elapsedMs: 1, detail: null } }))).toBeNull();
    expect(
      explainConnectRefusal(report({ connect: { verdict: "TIMEOUT", elapsedMs: 25003, detail: "x" } })),
    ).toBeNull();
  });
});
