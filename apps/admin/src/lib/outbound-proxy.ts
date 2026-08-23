import { ProxyAgent } from "undici";

/**
 * N-3.75(사용자 지시) — Fixie Commuter 사용량 제한으로 Naver/Coupang 아웃바운드
 * 요청이 전부 막힌 상태(2026-08-21~). 2026-09-03 Fixie 사용량 초기화 전까지
 * Oracle OCI Tinyproxy(161.33.39.233:8888)를 임시 프록시로 쓴다.
 *
 * 우선순위: OCI_PROXY_URL → FIXIE_URL → (Production에서는 DIRECT 금지, 기존
 * "프록시 없으면 dispatcher undefined = 직접 연결"이라는 로컬 개발 편의만
 * 유지하고 Production 안전장치는 그대로 둔다 — 이 리졸버가 새로 만드는 게
 * 아니라 naver/coupang client.ts가 원래 하던 "없으면 undefined" 동작을 그대로
 * 옮긴 것뿐이다).
 *
 * 9/3 이후 원복 절차: Vercel Production에서 OCI_PROXY_URL만 제거하면(FIXIE_URL은
 * 절대 건드리지 않는다) 이 함수가 자동으로 FIXIE_URL로 돌아간다 — 코드 변경 없음.
 */
export type OutboundProxyProvider = "OCI" | "FIXIE" | "NONE";

function resolveProxyUrl(): { provider: OutboundProxyProvider; url: string | null } {
  const ociUrl = process.env.OCI_PROXY_URL;
  if (ociUrl) return { provider: "OCI", url: ociUrl };
  const fixieUrl = process.env.FIXIE_URL;
  if (fixieUrl) return { provider: "FIXIE", url: fixieUrl };
  return { provider: "NONE", url: null };
}

/** naver/coupang client.ts가 이걸로 dispatcher를 만든다. 프록시가 없으면(로컬
 * 개발 등) undefined를 반환해 undici 기본 동작(직접 연결)으로 폴백한다 — 이건
 * 새 동작이 아니라 기존 두 client.ts가 각각 하던 걸 한 곳으로 합친 것이다. */
export function createOutboundProxyDispatcher(): ProxyAgent | undefined {
  const { url } = resolveProxyUrl();
  return url ? new ProxyAgent(url) : undefined;
}

/** 로그/콘솔에 프록시를 언급할 때는 이 짧은 라벨만 쓴다 — URL 전체(사용자/
 * 비밀번호 포함 가능)는 절대 로그에 남기지 않는다(기존 client.ts들의 원칙 유지). */
export function outboundProxyLogLabel(): string {
  return `Outbound proxy: ${resolveProxyUrl().provider}`;
}

/**
 * N-3.75(사용자 지시로 도입) — Node/undici의 `fetch failed`는 최상위
 * TypeError.message일 뿐이고, 진짜 원인(ECONNREFUSED/타임아웃/프록시 CONNECT
 * 거부 등)은 `error.cause`(때로는 `.cause.cause`까지)에 중첩되어 있다.
 * 2026-08-03 Fixie 407 진단 때도 이 체인을 펼쳐봐야 "Proxy response (407)"
 * 같은 진짜 원인이 보였다 — 지금 이 케이스도 같은 패턴일 가능성이 높아
 * 재사용 가능한 헬퍼로 뽑아둔다. 프록시 URL 자체(사용자/비밀번호)는 Node
 * 표준 에러 메시지에 절대 포함되지 않으므로(호스트/포트/에러코드만 나온다)
 * 이 체인을 그대로 debug 응답에 넣어도 안전하다.
 */
export function describeErrorCauseChain(error: unknown, maxDepth = 5): string[] {
  const chain: string[] = [];
  let current: unknown = error;
  for (let i = 0; i < maxDepth && current; i++) {
    if (current instanceof Error) {
      const codePart = "code" in current && current.code ? ` (code: ${String(current.code)})` : "";
      chain.push(`${current.name}: ${current.message}${codePart}`);
      current = current.cause;
    } else {
      chain.push(String(current));
      break;
    }
  }
  return chain;
}

/** N-3.75 STEP4 — Diagnostics/Settings UI용. host/port만 노출하고 사용자명/
 * 비밀번호/전체 URL은 절대 포함하지 않는다. */
export function getOutboundProxyDiagnostics(): {
  provider: OutboundProxyProvider;
  host: string | null;
  port: string | null;
  status: "READY" | "NOT_CONFIGURED";
} {
  const { provider, url } = resolveProxyUrl();
  if (!url) return { provider, host: null, port: null, status: "NOT_CONFIGURED" };
  try {
    const parsed = new URL(url);
    return { provider, host: parsed.hostname, port: parsed.port || null, status: "READY" };
  } catch {
    // URL 파싱 자체가 실패하면(형식이 이상하면) host/port 없이 provider만
    // 알려준다 — 값을 추측해서 지어내지 않는다.
    return { provider, host: null, port: null, status: "NOT_CONFIGURED" };
  }
}
