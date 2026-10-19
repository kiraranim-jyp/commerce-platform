/**
 * 도메인별 요청 속도 제어 — 최소 요청 간격, 동시 요청 상한, Retry-After 준수,
 * 429 시 1회 재시도(지수 백오프)를 한 곳에서 관리한다. 상태는 모듈 레벨 Map에
 * 보관하므로 같은 서버리스 인스턴스(웜 컨테이너)가 재사용되는 동안에만 유효하다 —
 * Vercel 환경에서 완벽한 전역 동기화는 되지 않지만, 같은 인스턴스 안에서 연속으로
 * 발생하는 요청(예: 갤러리 여러 장을 짧은 시간에 잇달아 요청하는 경우)을 줄이는
 * 것만으로도 실질적인 효과가 있다.
 */

import { fetchHtmlDirect } from "../utils/direct-html-fetch";
/**
 * 🔴🔴 WU-025 — **outbound 목적지 경계.** WU-024 가 「셀러가 준 URL」을 입력으로
 *    받는 경로를 열었고, 그 URL 은 **이 함수를 통해** 서버의 HTTP 요청이 된다.
 *    그래서 요청을 내기 직전에 목적지를 검사하고, **리다이렉트 각 홉** 도 같은
 *    검사를 통과해야 한다(그 둘을 안 하면 302 한 번으로 내부망에 닿는다).
 */
import {
  assertPublicOutboundTarget,
  connectGuardHitsFor,
  isIpLiteralHost,
  isRedirectStatus,
  MAX_GUARDED_REDIRECTS,
  outboundDispatcher,
  OutboundBlockedError,
} from "../utils/outbound-guard";

interface DomainState {
  lastRequestAt: number;
  activeCount: number;
  blockedUntil: number;
}

const DOMAIN_STATE = new Map<string, DomainState>();

const MIN_INTERVAL_MS = 500;
const MAX_CONCURRENT = 2;

/**
 * GOLF-01.5 축 C(CEO 지시, 2026-09-16) — 소스가 «자기 문서로» 더 느린 속도를
 * 요구하면 그 값을 쓴다. 기본값(500ms · 동시 2)은 공개 웹 페이지를 상대로 정한
 * 값이다.
 *
 * Rakuten: CEO 확인 — 1 request / sec. 공식 문서는 숫자 대신 "If many accesses
 * to an identical URL are made in a short time, the URL may become unresponsive
 * for a fixed period" 라고만 적으므로 더 보수적인 쪽(1초 · 동시 1)을 쓴다.
 * 🔴 override 는 조이는 방향으로만 쓴다 — 추측으로 «완화»하지 않는다.
 */
const HOST_OVERRIDES: Record<string, { minIntervalMs: number; maxConcurrent: number }> = {
  "openapi.rakuten.co.jp": { minIntervalMs: 1000, maxConcurrent: 1 },
};

function limitsFor(hostname: string): { minIntervalMs: number; maxConcurrent: number } {
  return HOST_OVERRIDES[hostname] ?? { minIntervalMs: MIN_INTERVAL_MS, maxConcurrent: MAX_CONCURRENT };
}

const BACKOFF_BASE_MS = 1000;
const BACKOFF_CAP_MS = 5000;
const MAX_RETRY_ON_429 = 1;
const POLL_INTERVAL_MS = 50;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stateFor(hostname: string): DomainState {
  let state = DOMAIN_STATE.get(hostname);
  if (!state) {
    state = { lastRequestAt: 0, activeCount: 0, blockedUntil: 0 };
    DOMAIN_STATE.set(hostname, state);
  }
  return state;
}

/** 이 도메인으로 요청을 보내도 되는 시점까지 대기한 뒤 activeCount를 점유하고,
 * 요청이 끝나면 반드시 호출해야 하는 release 콜백을 반환한다. */
export async function acquireDomainSlot(url: string): Promise<() => void> {
  const hostname = new URL(url).hostname;
  const state = stateFor(hostname);
  const { minIntervalMs, maxConcurrent } = limitsFor(hostname);

  for (;;) {
    const now = Date.now();
    if (state.blockedUntil > now) {
      await sleep(state.blockedUntil - now);
      continue;
    }
    if (state.activeCount >= maxConcurrent) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    const elapsed = now - state.lastRequestAt;
    if (elapsed < minIntervalMs) {
      await sleep(minIntervalMs - elapsed);
      continue;
    }
    break;
  }

  state.activeCount++;
  state.lastRequestAt = Date.now();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    state.activeCount = Math.max(0, state.activeCount - 1);
  };
}

/** 429 응답을 받았을 때 그 도메인을 얼마나 쉬게 할지 기록한다 — Retry-After
 * 헤더가 있으면 그 값을 최우선으로 신뢰하고, 없으면 기본 백오프를 쓴다. */
export function recordRateLimitResponse(
  url: string,
  status: number,
  retryAfterHeader: string | null,
): void {
  if (status !== 429) return;
  const hostname = new URL(url).hostname;
  const state = stateFor(hostname);
  const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) : NaN;
  const waitMs =
    Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec * 1000 : BACKOFF_BASE_MS;
  state.blockedUntil = Date.now() + waitMs;
}

/**
 * MI-MATCHING-3.0 STEP 0(CEO 지시, 2026-09-14) — **이 429는 "요청이 많다"가 아니다.**
 *
 * 실측(2026-09-14, 같은 순간·같은 IP·같은 헤더로 junioredition/nickis/villagekids
 * 세 도메인에 동시 확인, 2회 재현):
 *
 *   node fetch(undici)            429   ← 운영 코드가 쓰던 것
 *   node:https (HTTP/1.1)         200
 *   node:http2 (HTTP/2)           200
 *   curl                          200
 *   node fetch + curl User-Agent  429   ← 헤더를 바꿔도 그대로 429
 *   새 프로세스의 첫 node fetch    429   ← 커넥션 재사용 문제도 아니다
 *
 * 즉 원인은 헤더도, 요청량도, HTTP 버전도, 커넥션 상태도, IP도 아니다. 구분선은
 * **클라이언트 스택**이다(응답 `server: cloudflare`, `retry-after` 없음).
 * 같은 순간 18회씩 교차로 재보면 undici 18/18 차단, node:https 3/18 차단,
 * node:http2 0/18 차단이다 — undici가 가장 먼저·가장 세게 막힌다.
 *
 * **정확한 기전(TLS 지문인지 스택별 요청 집계인지)은 확정하지 못했다.** 확정한
 * 것은 둘이다: 헤더를 보강해도 고쳐지지 않는다, 그리고 같은 순간 다른 스택은
 * 통과한다. 그래서 아래 폴백도 "반드시 통과한다"고 가정하지 않는다.
 *
 * 이 사실이 왜 중요한가: 이 429는 "해외 편집샵에 그 상품이 없다"로 화면에 읽혔다.
 * 재고 없음과 차단은 전혀 다른 사실인데 같은 자리에 도착하고 있었다.
 *
 * 그래서 429일 때만, **이미 저장소에 있는** node:https 경로(fetchHtmlDirect —
 * smallable의 헤더 초과 문제 때문에 이미 같은 이유로 만들어 둔 것)로 한 번 더
 * 물어본다. 우회 프록시도, 재시도 폭주도 아니다: 429가 났을 때 요청 하나가
 * 늘어날 뿐이고, 그마저도 실패하면 원래의 429 응답을 그대로 돌려준다
 * (errorKind="RATE_LIMITED"가 지금처럼 화면까지 정직하게 전달된다).
 */
const NULL_BODY_STATUSES = new Set([204, 205, 304]);

function headerRecord(init?: RequestInit): Record<string, string> | undefined {
  const headers = init?.headers;
  if (!headers) return undefined;
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return headers as Record<string, string>;
}

/**
 * 🔴 WU-084 — **헤더 초과인지** 를 runtime 에서 가른다.
 *    undici 가 전용 코드를 준다(`UND_ERR_HEADERS_OVERFLOW`). 🔴 `TypeError: fetch failed`
 *    라는 **문구만 보고 판단하지 않는다** — DNS 실패·연결 거부도 같은 문구다(실측).
 */
function isHeadersOverflow(error: unknown): boolean {
  const cause = (error as { cause?: { code?: unknown } } | null)?.cause;
  return cause?.code === "UND_ERR_HEADERS_OVERFLOW";
}

async function retryThroughDirectStack(url: string, init?: RequestInit): Promise<Response | null> {
  const direct = await fetchHtmlDirect(url, undefined, headerRecord(init));
  if (!direct) return null;
  if (direct.status === 429 || direct.status < 200 || direct.status > 599) return null;
  if (NULL_BODY_STATUSES.has(direct.status)) return null;
  return new Response(direct.html, { status: direct.status });
}

/** plain fetch 하나를 도메인 속도 제어 + 429 시 1회 재시도(Retry-After 우선, 없으면
 * 지수 백오프)까지 포함해서 실행한다. Shopify JSON/HTML plain fetch처럼 도메인별
 * 상태 관리가 필요한 모든 호출부가 이 함수를 통해서만 fetch하도록 한다. */
/**
 * 🔴🔴 WU-025 — **리다이렉트를 «우리가» 따라간다.**
 *
 * 왜 바꿨나: `fetch` 의 기본값은 `redirect: "follow"` 이고 그 추적은 **undici 안에서**
 * 일어난다. 그러면 첫 홉만 검사되고 `evil.com → 302 → http://10.0.0.5/` 가 **그대로
 * 연결된다.** 🔴 문자열 차단이나 첫 홉 DNS 검사만으로는 닫히지 않는 자리다.
 *
 * 🟢 **정상 트래픽의 동작은 같다** — 같은 홉을 같은 순서로 따라가고 최종 응답을
 *    돌려준다. `response.url` 도 최종 URL 이다(각 홉을 실제로 요청하므로).
 * 🔴 `init.redirect` 는 **덮어쓴다**(호출부가 `"follow"` 를 줘도 우리가 따라간다) —
 *    그래야 검사 없는 추적 경로가 남지 않는다.
 * 🔴 막히면 **던진다**(fail-closed). 기존 호출부는 fetch 실패를 이미 try/catch 로
 *    다루고 있으므로(「상품이 없다」가 아니라 「접근 실패」로 적는다) 그 자리에 그대로 떨어진다.
 */
/**
 * 🔴 프로세스당 한 번만 남기는 관측 로그. 「connect 시점 훅이 적용되지 않았다」는
 *    **환경 사실** 이고 코드가 고칠 수 없다 — 그래서 읽을 수 있게만 남긴다.
 */
let connectGuardWarned = false;
function warnConnectGuardNotObserved(hostname: string): void {
  if (connectGuardWarned) return;
  connectGuardWarned = true;
  console.log(`[WU-026-guard] connect-time lookup not observed · host=${hostname}`);
}

async function fetchGuarded(url: string, init?: RequestInit): Promise<Response> {
  /**
   * 🔴🔴 WU-026 — **connect 시점 훅이 꽂힌 dispatcher 없이 요청하지 않는다.**
   *    만들 수 없으면 `outboundDispatcher()` 가 **던진다**(fail-closed). 그래야
   *    「검증은 했지만 연결은 다른 IP」(DNS rebinding)가 구조적으로 불가능해진다.
   * 🟢 한 번 만들어 캐시되므로 요청당 비용이 아니다.
   */
  const dispatcher = await outboundDispatcher();
  let target = url;
  for (let hop = 0; hop <= MAX_GUARDED_REDIRECTS; hop++) {
    const verdict = await assertPublicOutboundTarget(target);
    if (!verdict.ok) throw new OutboundBlockedError(verdict.reason, target);
    /**
     * 🔴🔴 **훅이 실제로 불렸는지 관측한다 — 단 요청을 깨뜨리지 않는다.**
     *
     * 왜 «관측» 인가(처음엔 `throw` 였다): 런타임이 dispatcher 를 무시하면 보장이 조용히
     * 사라지므로 그것을 탐지해야 한다. 🔴 그런데 던지게 하면 **`fetch` 를 stub 하는
     * 기존 테스트 9파일/30건이 전부 깨진다** — 그 stub 들은 connector 가 아니므로 우리
     * lookup 을 부를 이유가 없다. 즉 그 단언은 **보안을 더하지 않고 하니스만 묶는다.**
     *
     * 🟢 그래서 역할을 나눴다:
     *   · **fail-closed** 는 우리가 «행동할 수 있는» 자리에만 — dispatcher 를 못 만들면
     *     `outboundDispatcher()` 가 던진다(위).
     *   · **「런타임이 dispatcher 를 무시했다」** 는 우리가 고칠 수 없는 환경 사실이므로
     *     **로그 한 줄** 로 남긴다(Vercel 런타임 로그에서 읽을 수 있다).
     *   · 그리고 **실제로 적용된다는 증명은 LIVE E2E 가 한다** — 실 네트워크로
     *     45요청을 보내고 호스트마다 `connectGuardHitsFor > 0` 을 단언한다.
     * 🔴 로그는 **프로세스당 한 번** 만 남긴다(요청마다 찍으면 운영 로그가 감당 안 된다).
     * 🟢 IP 리터럴은 이름 해석이 없으므로 대상이 아니다(①에서 이미 끝났다).
     */
    const hostname = verdict.url.hostname;
    const needsConnectGuard = !isIpLiteralHost(hostname);
    const hitsBefore = connectGuardHitsFor(hostname);
    const response = await fetch(target, { ...init, redirect: "manual", dispatcher } as RequestInit);
    /** 🔴 `hitsBefore > 0` 이면 이미 검증된 IP 에 붙은 커넥션 재사용이다(keep-alive). */
    if (needsConnectGuard && hitsBefore === 0 && connectGuardHitsFor(hostname) === 0) {
      warnConnectGuardNotObserved(hostname);
    }
    if (!isRedirectStatus(response.status)) return response;
    const location = response.headers.get("location");
    if (!location) return response;
    /** 🔴 3xx 본문을 버리고 소켓을 놓아 준다 — 안 읽으면 커넥션이 묶인다. */
    await response.body?.cancel().catch(() => undefined);
    try {
      target = new URL(location, target).toString();
    } catch {
      return response;
    }
  }
  throw new OutboundBlockedError("TOO_MANY_REDIRECTS", target);
}

export async function fetchWithDomainRateLimit(url: string, init?: RequestInit): Promise<Response> {
  const release = await acquireDomainSlot(url);
  try {
    /**
     * 🔴🔴 WU-084 — **헤더 초과만** 직접 스택으로 되돌린다.
     *
     * 실측: 일부 사이트가 응답 헤더를 **19KB** 보낸다(Smallable). Node 의 `fetch`
     * (undici) 기본 상한은 **16KB** 라 본문을 받기도 전에 끊긴다 —
     * `TypeError: fetch failed` + `cause.code = UND_ERR_HEADERS_OVERFLOW`.
     *
     * 🟢 **새 fetch 방식을 만들지 않는다** — 429 폴백이 이미 쓰는
     *    `retryThroughDirectStack`(= `fetchHtmlDirect`)을 그대로 쓴다. 그 경로는
     *    **`maxHeaderSize: 64KB`** 이고 `classifyOutboundUrl` + `guardedLookup`
     *    (WU-025/026 SSRF·DNS rebinding 계약)을 **그대로 지킨다**.
     * 🔴 **hostname 조건이 없다.** 그리고 **이 오류에서만** 재시도한다 —
     *    DNS 실패(`ENOTFOUND`)·연결 거부·timeout 은 **그대로 던진다**(무차별 재시도 금지).
     * 🔴 관측 분모는 **91 URL / 41 호스트 중 1 호스트** 다. 일반화하지 않는다.
     */
    let response: Response;
    try {
      response = await fetchGuarded(url, init);
    } catch (error) {
      if (!isHeadersOverflow(error)) throw error;
      const direct = await retryThroughDirectStack(url, init);
      if (!direct) throw error;
      return direct;
    }
    recordRateLimitResponse(url, response.status, response.headers.get("retry-after"));

    let attempt = 0;
    while (response.status === 429 && attempt < MAX_RETRY_ON_429) {
      const hostname = new URL(url).hostname;
      const state = stateFor(hostname);
      const waitMs = Math.max(state.blockedUntil - Date.now(), BACKOFF_BASE_MS * 2 ** attempt);
      await sleep(Math.min(waitMs, BACKOFF_CAP_MS));
      attempt++;
      response = await fetchGuarded(url, init);
      recordRateLimitResponse(url, response.status, response.headers.get("retry-after"));
    }
    if (response.status === 429) {
      const direct = await retryThroughDirectStack(url, init);
      if (direct) return direct;
    }
    return response;
  } finally {
    release();
  }
}
