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
 * ② CONNECT — 프록시가 터널을 세워 주는가.
 *
 * 🔴 undici 는 CONNECT 단계만 따로 노출하지 않는다. 그래서 「프록시를 거치는
 *    최소 요청」을 보내고, **실패가 프록시 계층에서 났는지** 를 원인 체인으로
 *    판정한다. 터널이 서지 않으면 외부 응답은 애초에 오지 않으므로, 이 단계의
 *    실패는 ③을 `SKIPPED` 로 남긴다 — NULL 은 「거기까지 가지 못했다」다(078).
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

  const base = {
    provider,
    outboundIp: null,
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

  /* ── ②③ CONNECT + OUTBOUND ──────────────────────────────────────────────── */
  const dispatcher = dispatcherForProvider(provider);
  if (!dispatcher) {
    return {
      ...base,
      health: "NOT_CONFIGURED",
      tcp,
      connect: { verdict: "NOT_CONFIGURED", elapsedMs: null, detail: null },
      outbound: SKIPPED,
      totalElapsedMs: Date.now() - startedAt,
    };
  }

  const tunnelStartedAt = Date.now();
  try {
    const res = await undiciFetch(OUTBOUND_PROBE_URL, {
      dispatcher,
      signal: AbortSignal.timeout(CONNECT_TIMEOUT_MS + OUTBOUND_TIMEOUT_MS),
    });
    const connectElapsed = Date.now() - tunnelStartedAt;
    /* 🔴 응답 헤더가 왔다는 것은 터널이 섰다는 «증거» 다 — 여기서 CONNECT PASS 는
       추측이 아니다. 반대로 상태코드는 외부 쪽 사실이므로 ③에 적는다. */
    const connect: EgressStageResult = { verdict: "PASS", elapsedMs: connectElapsed, detail: null };

    if (!res.ok) {
      return {
        ...base,
        health: "DEGRADED",
        tcp,
        connect,
        outbound: {
          verdict: "ERROR",
          elapsedMs: connectElapsed,
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
      ...base,
      outboundIp,
      health: "NORMAL",
      tcp,
      connect,
      outbound: { verdict: "PASS", elapsedMs: Date.now() - tunnelStartedAt, detail: null },
      totalElapsedMs: Date.now() - startedAt,
    };
  } catch (error) {
    const chain = describeErrorCauseChain(error);
    const { verdict, proxyLayer } = classifyProxyFailure(chain);
    const elapsed = Date.now() - tunnelStartedAt;
    const detail = chain.join(" | ");

    if (proxyLayer) {
      /* 터널이 서지 않았다 → ③은 «실행되지 않았다»(SKIPPED). 🔴 이것을
         「outbound 실패」로 적으면 2026-10-10 의 원인을 또 가린다. */
      return {
        ...base,
        health: "DOWN",
        tcp,
        connect: { verdict, elapsedMs: elapsed, detail },
        outbound: SKIPPED,
        totalElapsedMs: Date.now() - startedAt,
      };
    }

    /* 프록시 계층 신호가 없다 → 터널은 섰고 외부 쪽에서 깨진 것으로 본다. */
    return {
      ...base,
      health: "DEGRADED",
      tcp,
      connect: { verdict: "PASS", elapsedMs: null, detail: null },
      outbound: { verdict, elapsedMs: elapsed, detail },
      totalElapsedMs: Date.now() - startedAt,
    };
  }
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
      `outbound=${report.outbound.verdict}`,
      report.connect.detail ?? report.outbound.detail ?? "",
    ]
      .filter((part) => part.length > 0)
      .join(" "),
  });
  return { logged: result.ok };
}
