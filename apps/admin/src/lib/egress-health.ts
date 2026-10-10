import { fetch as undiciFetch } from "undici";

import {
  appendEgressLog,
  type EgressConnectResult,
  type EgressLogSource,
  type EgressOutboundResult,
  type EgressProvider,
} from "./egress-settings";
import { describeErrorCauseChain, dispatcherForProvider, envProxyUrlFor } from "./outbound-proxy";

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * EGRESS ⑥ — health 를 «세 단계로 갈라» 잰다 (2026-10-10)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 모듈이 존재하는 이유는 2026-10-10 장애의 양상 하나다:
 *
 *       TCP 8888   OPEN 3/3     ← 포트는 살아 있다
 *       CONNECT    무응답 25s   ← 터널이 서지 않는다
 *
 *    「포트가 열려 있다」를 「프록시가 정상이다」로 읽으면 이 장애를 정상으로
 *    판정한다. 실제로 그렇게 한 시간을 잃었다. 그래서 단계를 묶지 않는다:
 *
 *       ① TCP        프록시 호스트:포트에 소켓이 붙는가
 *       ② CONNECT    프록시가 CONNECT 터널을 세워 주는가
 *       ③ OUTBOUND   그 터널로 실제 외부 HTTPS 응답이 오는가
 *
 *    HEALTH 는 세 결과의 «합» 이고, 어느 하나라도 통과하지 못하면 NORMAL 이 아니다.
 *
 * ── 🔴 407 을 왜곡하지 않는다 ────────────────────────────────────────────────
 *
 * 자격증명 없이 찌른 프록시가 `407 Proxy Authentication Required` 를 주는 것은
 * **「응답 계층이 살아 있다」는 신호** 다(장애 중에는 그 응답조차 오지 않았다).
 * 그러나 그것은 Production outbound 성공과 «다른 사실» 이다. 이 모듈은 자격증명을
 * 가진 정상 경로로만 재므로 407 은 CONNECT 거절(REFUSED)로 기록된다 — 「살아 있다」와
 * 「나갈 수 있다」를 한 칸에 적지 않는다.
 *
 * ── 🔴 elapsed 가 원인을 가른다 ─────────────────────────────────────────────
 *
 *       수백 ms 즉시 실패  →  거절 (상한·자격증명)
 *       20~25s 무응답      →  hang (데몬 이상)
 *
 * 그래서 단계별 elapsed 를 따로 들고 올라간다. 합계만 적으면 이 구별이 사라진다.
 */

/** 외부 HTTPS 대상. 🔴 채널 API 를 쓰지 않는다 — 채널 인증 실패와 프록시 장애가
 *  섞이면 단계 판정이 다시 뭉개진다. 응답이 작고 의미가 단순한 곳을 쓴다.
 *  (기존 `getFixieOutboundIp()`·`getLotteOnOutboundIp()` 가 쓰던 바로 그 대상이다.) */
const OUTBOUND_PROBE_URL = "https://api.ipify.org?format=json";

/** 🔴 20s 가 아니라 짧게 잡는다. 사람이 버튼을 누르고 기다리는 화면이고,
 *  hang 은 「오래 걸린다」가 아니라 「안 온다」로 판정하면 충분하다. */
const TCP_TIMEOUT_MS = 5_000;
const CONNECT_TIMEOUT_MS = 10_000;
const OUTBOUND_TIMEOUT_MS = 10_000;

export type EgressStageVerdict = "PASS" | "REFUSED" | "TIMEOUT" | "ERROR" | "SKIPPED" | "NOT_CONFIGURED";

export type EgressStageResult = {
  verdict: EgressStageVerdict;
  elapsedMs: number | null;
  /** 🔴 비밀값 금지. `describeErrorCauseChain()` 문구만 담는다. */
  detail: string | null;
};

/** 🔴 네 번째 칸을 만들지 않는다 — NORMAL 이 아닌 이유가 어느 «단계» 인지는
 *  stages 가 들고 있고, 이 값은 「써도 되는가」 하나만 답한다. */
export type EgressHealthVerdict = "NORMAL" | "DEGRADED" | "DOWN" | "NOT_CONFIGURED";

export type EgressHealthReport = {
  provider: EgressProvider;
  health: EgressHealthVerdict;
  tcp: EgressStageResult;
  connect: EgressStageResult;
  outbound: EgressStageResult;
  /** 외부에서 보이는 우리 IP. 채널 allowlist 등록에 쓰는 값이고 비밀이 아니다. */
  outboundIp: string | null;
  /** 🔴 CONNECT 가 거절됐을 때 그 «상태코드». 407 과 403 은 다른 조치다. */
  connectStatusCode: number | null;
  /** `Proxy-Authenticate` scheme 토큰만(realm 은 버린다). */
  connectAuthScheme: string | null;
  /** 🔴 값이 아니라 «모양» — 407 이 우리 설정 문제인지 계정 문제인지 가른다. */
  credential: ProxyCredentialShape;
  /** 이 시도에서 Proxy-Authorization 을 보냈는가. */
  sentAuthHeader: boolean;
  totalElapsedMs: number;
  checkedAt: string;
};

const SKIPPED: EgressStageResult = { verdict: "SKIPPED", elapsedMs: null, detail: null };

/** 프록시 URL 에서 host/port 만 꺼낸다. 🔴 URL 전체는 반환하지 않는다. */
function hostPortOf(url: string): { host: string; port: number } | null {
  try {
    const parsed = new URL(url);
    const port = parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 80;
    if (!parsed.hostname || !Number.isFinite(port)) return null;
    return { host: parsed.hostname, port };
  } catch {
    return null;
  }
}

/**
 * ① TCP — 소켓이 붙는가.
 *
 * 🔴 이 단계가 PASS 라는 것은 「포트가 열려 있다」까지다. 그 이상을 뜻하지
 *    않는다는 것이 2026-10-10 의 교훈이다.
 */
async function probeTcp(host: string, port: number): Promise<EgressStageResult> {
  const startedAt = Date.now();
  const net = await import("node:net");
  return new Promise<EgressStageResult>((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (verdict: EgressStageVerdict, detail: string | null) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ verdict, elapsedMs: Date.now() - startedAt, detail });
    };
    socket.setTimeout(TCP_TIMEOUT_MS);
    socket.once("connect", () => finish("PASS", null));
    socket.once("timeout", () => finish("TIMEOUT", `TCP ${TCP_TIMEOUT_MS}ms 내 연결되지 않았습니다.`));
    socket.once("error", (error: Error & { code?: string }) => {
      /* 🔴 거절(REFUSED)과 그 밖의 오류를 갈라 적는다 — 「닫혀 있다」와
         「이름을 못 찾는다」는 다른 사실이고 조치가 다르다. */
      const refused = error.code === "ECONNREFUSED" || error.code === "ECONNRESET";
      finish(refused ? "REFUSED" : "ERROR", `${error.code ?? error.name}: ${error.message}`);
    });
    socket.connect(port, host);
  });
}

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 자격증명의 «모양» — 🔴 값을 읽지 않고 407 의 원인을 가른다 (CPO 지시 ①③④)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 2026-10-10 Production 측정: OCI 는 정상이고 **FIXIE 만 CONNECT 407** 이었다.
 * 그리고 자격증명이 «필요한» provider 는 FIXIE 하나다(OCI 는 익명 프록시다).
 *
 * 그래서 407 의 원인이 둘로 갈린다. **화면에서는 똑같이 407 로 보인다**:
 *
 *     ⓐ 자격증명을 «보내지 못했다»   — FIXIE_URL 에 비밀번호 부분이 없거나
 *                                     파싱이 깨졌다 → 우리 설정 문제
 *     ⓑ 보냈는데 «거절당했다»        — 자격증명 만료 / 사용량 상한
 *                                     → Fixie 계정 문제(CEO 사안)
 *
 * 🔴 undici 7.29.0 은 URL 의 userinfo 를 제대로 Basic 헤더로 바꾼다
 *    (proxy-agent.js:126 `else if (username && password)`). 즉 「우리가 안
 *    보낸다」가 기본값은 아니다. **다만 그 조건이 «둘 다» 다** — 사용자명만
 *    있으면 헤더가 아예 붙지 않고, 그 결과는 ⓑ와 구별되지 않는 407 이다.
 *
 * 🔴 그래서 **값을 읽는 대신 모양만 보고한다.** CTO 는 Production Sensitive
 *    값을 읽을 수 없고, 읽을 필요도 없다 — 필요한 것은 「비밀번호 부분이 실제로
 *    들어 있는가」라는 boolean 하나다.
 */
export type ProxyCredentialShape = {
  /** 이 provider 가 자격증명을 들고 있는가(둘 중 하나라도). */
  present: boolean;
  hasUsername: boolean;
  /** 🔴 이 값이 `false` 인데 407 이면 **우리 설정 문제** 다. */
  hasPassword: boolean;
  /** userinfo 가 URL 인코딩으로 깨져 있는가 — decodeURIComponent 가 던지는 경우. */
  decodable: boolean;
  /** 🔴 undici 가 Proxy-Authorization 을 실제로 붙이는 조건을 그대로 복제한다. */
  willSendAuthHeader: boolean;
};

/** 🔴 값은 한 글자도 돌려주지 않는다. 길이도 돌려주지 않는다(추측 재료가 된다). */
export function describeCredentialShape(url: string): ProxyCredentialShape {
  const empty: ProxyCredentialShape = {
    present: false,
    hasUsername: false,
    hasPassword: false,
    decodable: true,
    willSendAuthHeader: false,
  };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ...empty, decodable: false };
  }
  const hasUsername = parsed.username.length > 0;
  const hasPassword = parsed.password.length > 0;
  let decodable = true;
  try {
    decodeURIComponent(parsed.username);
    decodeURIComponent(parsed.password);
  } catch {
    decodable = false;
  }
  return {
    present: hasUsername || hasPassword,
    hasUsername,
    hasPassword,
    decodable,
    /* undici proxy-agent.js:126 과 같은 조건이다. 여기서 흉내 내는 것이 아니라
       «그 조건을 그대로» 적어야 한다 — 다르면 이 보고가 거짓말이 된다. */
    willSendAuthHeader: hasUsername && hasPassword,
  };
}

/**
 * ② CONNECT — 프록시가 터널을 세워 주는가. **직접 말해 본다.**
 *
 * 🔴 전에는 undici fetch 의 실패 원인 체인으로 이 단계를 «추정» 했다. 그러면
 *    상태코드도 인증 scheme 도 알 수 없어서 407 이 ⓐ인지 ⓑ인지 가를 수 없다.
 *    그래서 CONNECT 를 직접 보내고 응답의 첫 줄과 `Proxy-Authenticate` 를 읽는다.
 *
 * 🔴 **로그·응답에 남기는 것은 상태코드와 인증 scheme 토큰뿐이다**(CPO 지시 ④).
 *    realm 값도 버린다 — 계정/조직 이름이 섞여 나올 수 있다.
 */
function parseProxyAuthScheme(head: string): string | null {
  const line = head.split(/\r?\n/).find((l) => /^proxy-authenticate:/i.test(l));
  if (!line) return null;
  const value = line.slice(line.indexOf(":") + 1).trim();
  /* scheme 토큰만. `Basic realm="fixie"` → `Basic` */
  const scheme = value.split(/[\s,]+/)[0];
  return scheme && /^[A-Za-z-]+$/.test(scheme) ? scheme : null;
}

export type ConnectProbeResult = EgressStageResult & {
  /** 프록시가 돌려준 HTTP 상태코드. null = 응답을 받지 못했다(hang/오류). */
  statusCode: number | null;
  /** `Proxy-Authenticate` 의 scheme 토큰만. realm 은 버린다. */
  authScheme: string | null;
  /** 🔴 우리가 이 시도에서 Proxy-Authorization 을 «보냈는가». */
  sentAuthHeader: boolean;
};

/** 🔴 테스트가 이 단계를 «실제 프록시» 로 재기 위해 export 한다 — 운영 함수로 재라. */
export async function probeConnect(
  proxy: { host: string; port: number; url: string },
  target: { host: string; port: number },
): Promise<ConnectProbeResult> {
  const startedAt = Date.now();
  const shape = describeCredentialShape(proxy.url);
  const net = await import("node:net");

  /* 🔴 undici 와 «같은» 방식으로 헤더를 만든다. 다르게 만들면 이 측정이
     운영 경로를 재지 않는 것이 된다(운영 함수로 재라 — 한 세션에 네 번 틀렸다). */
  let authHeader: string | null = null;
  if (shape.willSendAuthHeader && shape.decodable) {
    try {
      const parsed = new URL(proxy.url);
      const raw = `${decodeURIComponent(parsed.username)}:${decodeURIComponent(parsed.password)}`;
      authHeader = `Basic ${Buffer.from(raw).toString("base64")}`;
    } catch {
      authHeader = null;
    }
  }

  return new Promise<ConnectProbeResult>((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    let head = "";

    const finish = (
      verdict: EgressStageVerdict,
      detail: string | null,
      statusCode: number | null,
      authScheme: string | null,
    ) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({
        verdict,
        elapsedMs: Date.now() - startedAt,
        detail,
        statusCode,
        authScheme,
        sentAuthHeader: authHeader !== null,
      });
    };

    socket.setTimeout(CONNECT_TIMEOUT_MS);
    socket.once("timeout", () =>
      /* 🔴 2026-10-10 의 그 양상이다 — 「느리다」가 아니라 「안 온다」. */
      finish("TIMEOUT", `CONNECT ${CONNECT_TIMEOUT_MS}ms 내 응답이 없습니다.`, null, null),
    );
    socket.once("error", (error: Error & { code?: string }) =>
      finish("ERROR", `${error.code ?? error.name}: ${error.message}`, null, null),
    );
    socket.once("connect", () => {
      socket.write(
        `CONNECT ${target.host}:${target.port} HTTP/1.1\r\n` +
          `Host: ${target.host}:${target.port}\r\n` +
          (authHeader ? `Proxy-Authorization: ${authHeader}\r\n` : "") +
          `\r\n`,
      );
    });
    socket.on("data", (chunk) => {
      head += chunk.toString("latin1");
      if (!head.includes("\r\n\r\n") && head.length < 8192) return;
      const status = Number(/^HTTP\/\d\.\d (\d{3})/.exec(head)?.[1] ?? NaN);
      const scheme = parseProxyAuthScheme(head);
      if (status === 200) return finish("PASS", null, status, scheme);
      if (!Number.isFinite(status)) {
        return finish("ERROR", "프록시 응답을 해석할 수 없습니다.", null, scheme);
      }
      /* 🔴 상태코드만 적는다. 응답 본문은 담지 않는다 — 프록시가 본문에 계정
         정보를 적어 보내는 경우가 있다. */
      finish("REFUSED", `프록시가 CONNECT 를 거절했습니다 (HTTP ${status})`, status, scheme);
    });
    socket.connect(proxy.port, proxy.host);
  });
}

/**
 * 원인 체인으로 «외부요청» 단계의 실패를 가른다.
 *
 * 🔴 CONNECT 단계는 더 이상 이 함수로 추정하지 않는다 — 위 `probeConnect` 가
 *    직접 재므로, 여기 남는 역할은 터널이 선 «뒤» 의 실패 분류다. 다만 분류
 *    어휘는 그대로 둔다(기존 가드가 이 함수를 보고 있다).
 */
export function classifyProxyFailure(chain: string[]): { verdict: EgressStageVerdict; proxyLayer: boolean } {
  const joined = chain.join(" | ");
  /* 407 · 프록시 응답 코드 → 프록시가 «응답은 했고» 거절했다. */
  if (/Proxy response \(\d+\)|407|UND_ERR_PRX/i.test(joined)) {
    return { verdict: "REFUSED", proxyLayer: true };
  }
  if (/ECONNREFUSED|ECONNRESET/i.test(joined)) return { verdict: "REFUSED", proxyLayer: true };
  if (/ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT|TimeoutError|aborted due to timeout|HeadersTimeout/i.test(joined)) {
    /* 🔴 무응답이다. 2026-10-10 의 그 양상이고, 「느리다」가 아니라 「안 온다」로
       적는다. 단계는 CONNECT 로 본다 — 터널이 섰다는 증거가 하나도 없다. */
    return { verdict: "TIMEOUT", proxyLayer: true };
  }
  if (/ENOTFOUND|EAI_AGAIN/i.test(joined)) return { verdict: "ERROR", proxyLayer: true };
  return { verdict: "ERROR", proxyLayer: false };
}

/**
 * provider 한 개를 세 단계로 잰다.
 *
 * 🔴 이 함수는 **아무것도 저장하지 않고 아무것도 전환하지 않는다.** 재기만 한다.
 *    저장/전환 판단은 호출부(A④)의 일이다 — 측정과 결정을 한 함수에 섞으면
 *    「측정했더니 바뀌어 있었다」가 된다.
 */
export async function checkEgressHealth(provider: EgressProvider): Promise<EgressHealthReport> {
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();
  const url = envProxyUrlFor(provider);

  /* 🔴 자격증명 «모양» 은 측정 결과와 무관하게 언제나 보고한다. 「주소가 없다」
     일 때도 모양(= present:false)을 적어야 화면이 이유를 말할 수 있다. */
  const credential = url
    ? describeCredentialShape(url)
    : { present: false, hasUsername: false, hasPassword: false, decodable: true, willSendAuthHeader: false };

  const base = {
    provider,
    outboundIp: null,
    connectStatusCode: null,
    connectAuthScheme: null,
    credential,
    sentAuthHeader: false,
    checkedAt,
  };

  if (!url) {
    /* 🔴 「설정되지 않았다」를 「실패했다」로 적지 않는다. 조치가 다르다 —
       이쪽은 Production env 등록 문제이고 프록시 장애가 아니다. */
    return {
      ...base,
      health: "NOT_CONFIGURED",
      tcp: { verdict: "NOT_CONFIGURED", elapsedMs: null, detail: null },
      connect: SKIPPED,
      outbound: SKIPPED,
      totalElapsedMs: Date.now() - startedAt,
    };
  }

  const endpoint = hostPortOf(url);
  if (!endpoint) {
    return {
      ...base,
      health: "NOT_CONFIGURED",
      tcp: { verdict: "NOT_CONFIGURED", elapsedMs: null, detail: "프록시 주소 형식을 해석할 수 없습니다." },
      connect: SKIPPED,
      outbound: SKIPPED,
      totalElapsedMs: Date.now() - startedAt,
    };
  }

  /* ── ① TCP ───────────────────────────────────────────────────────────────── */
  const tcp = await probeTcp(endpoint.host, endpoint.port);
  if (tcp.verdict !== "PASS") {
    return {
      ...base,
      health: "DOWN",
      tcp,
      connect: SKIPPED,
      outbound: SKIPPED,
      totalElapsedMs: Date.now() - startedAt,
    };
  }

  /* ── ② CONNECT — 직접 말해 본다 ──────────────────────────────────────────────
     🔴 전에는 undici fetch 의 실패 원인으로 이 단계를 «추정» 했다. 그러면
     407 이 「우리가 자격증명을 못 보냈다」인지 「보냈는데 거절당했다」인지
     구별할 수 없다. CONNECT 를 직접 보내고 상태코드와 인증 scheme 을 읽는다. */
  const connectProbe = await probeConnect(
    { host: endpoint.host, port: endpoint.port, url },
    { host: new URL(OUTBOUND_PROBE_URL).hostname, port: 443 },
  );
  const connect: EgressStageResult = {
    verdict: connectProbe.verdict,
    elapsedMs: connectProbe.elapsedMs,
    detail: connectProbe.detail,
  };
  const probed = {
    ...base,
    connectStatusCode: connectProbe.statusCode,
    connectAuthScheme: connectProbe.authScheme,
    sentAuthHeader: connectProbe.sentAuthHeader,
  };

  if (connectProbe.verdict !== "PASS") {
    /* 터널이 서지 않았다 → ③은 «실행되지 않았다»(SKIPPED). 🔴 이것을
       「outbound 실패」로 적으면 2026-10-10 의 원인을 또 가린다. */
    return {
      ...probed,
      health: "DOWN",
      tcp,
      connect,
      outbound: SKIPPED,
      totalElapsedMs: Date.now() - startedAt,
    };
  }

  /* ── ③ OUTBOUND — 실제 외부 HTTPS ────────────────────────────────────────── */
  const dispatcher = dispatcherForProvider(provider);
  if (!dispatcher) {
    return {
      ...probed,
      health: "NOT_CONFIGURED",
      tcp,
      connect,
      outbound: SKIPPED,
      totalElapsedMs: Date.now() - startedAt,
    };
  }

  const outboundStartedAt = Date.now();
  try {
    const res = await undiciFetch(OUTBOUND_PROBE_URL, {
      dispatcher,
      signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS),
    });

    if (!res.ok) {
      return {
        ...probed,
        health: "DEGRADED",
        tcp,
        connect,
        outbound: {
          verdict: "ERROR",
          elapsedMs: Date.now() - outboundStartedAt,
          detail: `외부 응답 HTTP ${res.status}`,
        },
        totalElapsedMs: Date.now() - startedAt,
      };
    }

    let outboundIp: string | null = null;
    try {
      const body = (await res.json()) as { ip?: string };
      outboundIp = body.ip ?? null;
    } catch {
      /* 본문 파싱 실패는 외부 응답이 «왔다» 는 사실을 바꾸지 않는다. */
    }

    return {
      ...probed,
      outboundIp,
      health: "NORMAL",
      tcp,
      connect,
      outbound: { verdict: "PASS", elapsedMs: Date.now() - outboundStartedAt, detail: null },
      totalElapsedMs: Date.now() - startedAt,
    };
  } catch (error) {
    const chain = describeErrorCauseChain(error);
    const { verdict, proxyLayer } = classifyProxyFailure(chain);
    const elapsed = Date.now() - outboundStartedAt;
    const detail = chain.join(" | ");

    /* 🔴 ②가 PASS 였는데 여기서 프록시 계층 신호가 나오면, 터널은 «섰다가»
       깨진 것이다. 그것을 ②의 실패로 소급 기록하지 않는다 — 우리가 실제로
       관측한 것은 「CONNECT 는 됐고 그 뒤가 깨졌다」다. */
    return {
      ...probed,
      health: "DEGRADED",
      tcp,
      connect,
      outbound: { verdict, elapsedMs: elapsed, detail: proxyLayer ? `터널 이후 프록시 계층 오류 — ${detail}` : detail },
      totalElapsedMs: Date.now() - startedAt,
    };
  }
}

/**
 * 🔴 407 의 «조치» 를 한 문장으로 가른다 (CPO 지시 ①③④).
 *
 * 화면과 이력이 이것을 그대로 쓴다. 두 경우는 같은 407 이지만 고칠 곳이 다르다.
 */
export function explainConnectRefusal(report: EgressHealthReport): string | null {
  if (report.connect.verdict !== "REFUSED") return null;
  const status = report.connectStatusCode;
  const scheme = report.connectAuthScheme ? ` · 요구 방식 ${report.connectAuthScheme}` : "";

  if (status !== 407) {
    return `프록시가 연결을 거절했습니다 (HTTP ${status ?? "?"}${scheme}).`;
  }
  if (!report.credential.present) {
    return `프록시가 인증을 요구하는데(HTTP 407${scheme}) 이 연결 방식에는 인증 정보가 설정되어 있지 않습니다.`;
  }
  if (!report.credential.decodable) {
    return `인증 정보가 주소 안에서 깨져 있습니다 — 특수문자가 URL 인코딩되지 않은 것으로 보입니다 (HTTP 407${scheme}).`;
  }
  if (!report.credential.willSendAuthHeader) {
    /* 🔴 이것이 「우리 설정 문제」다. 사용자명만 있으면 인증 헤더가 아예
       붙지 않고, 결과는 「자격증명이 거절됐다」와 구별되지 않는 407 이다. */
    return `인증 정보가 불완전합니다 — ${
      report.credential.hasUsername ? "비밀번호" : "사용자명"
    } 부분이 주소에 없어 인증을 보내지 못했습니다 (HTTP 407${scheme}).`;
  }
  /* 보낼 것은 다 보냈는데 거절당했다 → 우리 설정이 아니라 계정 쪽이다. */
  return `인증 정보를 보냈으나 프록시가 거절했습니다 (HTTP 407${scheme}) — 자격증명 만료 또는 사용량 한도일 수 있습니다.`;
}

/** 단계 판정 → 078 어휘. 🔴 `SKIPPED`/`NOT_CONFIGURED` 는 NULL 이다 —
 *  「그 단계까지 가지 못했다」를 「성공/실패」로 바꾸지 않는다. */
export function toConnectResult(stage: EgressStageResult): EgressConnectResult | null {
  switch (stage.verdict) {
    case "PASS":
      return "OK";
    case "REFUSED":
      return "REFUSED";
    case "TIMEOUT":
      return "TIMEOUT";
    case "ERROR":
      return "ERROR";
    default:
      return null;
  }
}

export function toOutboundResult(stage: EgressStageResult): EgressOutboundResult | null {
  switch (stage.verdict) {
    case "PASS":
      return "OK";
    case "TIMEOUT":
      return "TIMEOUT";
    case "REFUSED":
    case "ERROR":
      return stage.detail?.startsWith("외부 응답 HTTP ") ? "HTTP_ERROR" : "ERROR";
    default:
      return null;
  }
}

/**
 * 측정 1건을 이력에 남긴다.
 *
 * 🔴 이력 기록 실패가 측정 결과를 바꾸지 않는다 — 돌려주는 것은 health 판정이고,
 *    저장 성공 여부는 별도 값이다. 「기록됐다」를 「정상이다」로 쓰지 않는다.
 */
export async function recordEgressHealth(
  report: EgressHealthReport,
  options: {
    source: EgressLogSource;
    switchedFrom?: EgressProvider | null;
    switchCommitted?: boolean | null;
  },
): Promise<{ logged: boolean }> {
  const result = await appendEgressLog({
    provider: report.provider,
    connectResult: toConnectResult(report.connect),
    outboundResult: toOutboundResult(report.outbound),
    /* 🔴 단계 합계가 아니라 «터널 이후» 시간을 쓴다 — TCP 수백 ms 를 섞으면
       「즉시 거절」과 「hang」의 구별이 흐려진다. */
    elapsedMs: report.outbound.elapsedMs ?? report.connect.elapsedMs ?? report.tcp.elapsedMs,
    switchedFrom: options.switchedFrom ?? null,
    switchCommitted: options.switchCommitted ?? null,
    source: options.source,
    detail: [
      `health=${report.health}`,
      `tcp=${report.tcp.verdict}${report.tcp.elapsedMs !== null ? `/${report.tcp.elapsedMs}ms` : ""}`,
      `connect=${report.connect.verdict}`,
      /* 🔴 상태코드와 인증 scheme 을 이력에 «같이» 남긴다. 그러지 않으면
         다음 세션이 「왜 407 이었나」를 또 추측에서 시작한다(CPO 지시 ④).
         🔴 남기는 것은 이 둘과 「인증을 보냈는가」 boolean 뿐이다 —
         URL·자격증명·realm 은 어디에도 넣지 않는다. */
      report.connectStatusCode !== null ? `status=${report.connectStatusCode}` : "",
      report.connectAuthScheme ? `authScheme=${report.connectAuthScheme}` : "",
      report.credential.present ? `sentAuth=${report.sentAuthHeader}` : "",
      `outbound=${report.outbound.verdict}`,
      report.connect.detail ?? report.outbound.detail ?? "",
    ]
      .filter((part) => part.length > 0)
      .join(" "),
  });
  return { logged: result.ok };
}
