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

/**
 * ══ OUTBOUND-PROXY-SWITCH(CEO 지시, 2026-09-22) ══
 *
 * **어느 프록시로 나갈지 «명시적으로» 고르는 스위치.** 값은 "FIXIE" 또는 "OCI".
 * 없거나 모르는 값이면 아래 기존 우선순위 그대로다(= 이 변경 전과 같다).
 *
 * ── 왜 생겼나 ──────────────────────────────────────────────────────────────
 * 2026-09-22, 세 채널(스마트스토어·쿠팡·롯데ON)의 연결 확인이 «동시에» 실패했다.
 * 셋의 유일한 공통 경로가 이 프록시다. 롯데ON 은 그날 하루 종일 같은 경로에서
 * 20초 timeout 과 성공을 오갔다(proxy=OCI).
 *
 * 위 주석이 적어 둔 원복 절차는 「Vercel 에서 OCI_PROXY_URL 을 제거」였다.
 * 그런데 그렇게 하면 **그 값이 사라져 되돌릴 수 없다** — OCI 가 살아났을 때
 * 누군가 URL 을 따로 보관하고 있어야 한다. 그래서 «지우는» 대신 «고르는»
 * 방식으로 바꾼다.
 *
 *     OUTBOUND_PROXY=FIXIE  를 «추가» 하면 FIXIE 로 나간다
 *     그 한 줄을 지우면 즉시 예전 동작(OCI 우선)으로 돌아온다
 *     OCI_PROXY_URL 은 그대로 남아 있다
 *
 * 🔴 Fixie 는 사용량 상한이 있다(N-3.75 가 OCI 로 옮겨간 이유가 그것이다).
 * 트래픽이 갑자기 늘면 다시 막힐 수 있으므로 **되돌리기가 «한 줄» 이어야 한다는
 * 것이 이 설계의 핵심**이다.
 *
 * 🔴 «건강 기반» 자동 폴백이 아니다. OCI 가 죽어도 이 함수가 알아서 FIXIE 로
 * 넘어가지는 않는다 — 그건 등록 경로의 동작을 바꾸는 별건이고 CEO 승인 전이다.
 * 여기서 하는 일은 «사람이 고른 것을 그대로 따르는 것» 뿐이다.
 */
function selectedProvider(): "OCI" | "FIXIE" | null {
  const raw = process.env.OUTBOUND_PROXY?.trim().toUpperCase();
  return raw === "FIXIE" || raw === "OCI" ? raw : null;
}

function resolveProxyUrl(): { provider: OutboundProxyProvider; url: string | null } {
  const ociUrl = process.env.OCI_PROXY_URL;
  const fixieUrl = process.env.FIXIE_URL;

  const chosen = selectedProvider();
  if (chosen === "FIXIE" && fixieUrl) return { provider: "FIXIE", url: fixieUrl };
  if (chosen === "OCI" && ociUrl) return { provider: "OCI", url: ociUrl };
  /* 🔴 고른 쪽의 URL 이 «없으면» 조용히 다른 쪽으로 넘어가지 않는 것처럼 보이게
     하지 않는다. 아래 기존 우선순위로 내려가되, 실제로 어디로 나갔는지는
     진단(getOutboundProxyDiagnostics)과 실패 로그의 provider 이름이 그대로
     말한다 — 「FIXIE 를 골랐는데 OCI 로 나가고 있었다」를 숨기지 않는다. */

  if (ociUrl) return { provider: "OCI", url: ociUrl };
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
