/**
 * 도메인별 요청 속도 제어 — 최소 요청 간격, 동시 요청 상한, Retry-After 준수,
 * 429 시 1회 재시도(지수 백오프)를 한 곳에서 관리한다. 상태는 모듈 레벨 Map에
 * 보관하므로 같은 서버리스 인스턴스(웜 컨테이너)가 재사용되는 동안에만 유효하다 —
 * Vercel 환경에서 완벽한 전역 동기화는 되지 않지만, 같은 인스턴스 안에서 연속으로
 * 발생하는 요청(예: 갤러리 여러 장을 짧은 시간에 잇달아 요청하는 경우)을 줄이는
 * 것만으로도 실질적인 효과가 있다.
 */

import { fetchHtmlDirect } from "../utils/direct-html-fetch";

interface DomainState {
  lastRequestAt: number;
  activeCount: number;
  blockedUntil: number;
}

const DOMAIN_STATE = new Map<string, DomainState>();

const MIN_INTERVAL_MS = 500;
const MAX_CONCURRENT = 2;
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

  for (;;) {
    const now = Date.now();
    if (state.blockedUntil > now) {
      await sleep(state.blockedUntil - now);
      continue;
    }
    if (state.activeCount >= MAX_CONCURRENT) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    const elapsed = now - state.lastRequestAt;
    if (elapsed < MIN_INTERVAL_MS) {
      await sleep(MIN_INTERVAL_MS - elapsed);
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
export async function fetchWithDomainRateLimit(url: string, init?: RequestInit): Promise<Response> {
  const release = await acquireDomainSlot(url);
  try {
    let response = await fetch(url, init);
    recordRateLimitResponse(url, response.status, response.headers.get("retry-after"));

    let attempt = 0;
    while (response.status === 429 && attempt < MAX_RETRY_ON_429) {
      const hostname = new URL(url).hostname;
      const state = stateFor(hostname);
      const waitMs = Math.max(state.blockedUntil - Date.now(), BACKOFF_BASE_MS * 2 ** attempt);
      await sleep(Math.min(waitMs, BACKOFF_CAP_MS));
      attempt++;
      response = await fetch(url, init);
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
