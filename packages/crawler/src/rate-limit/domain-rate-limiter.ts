/**
 * 도메인별 요청 속도 제어 — 최소 요청 간격, 동시 요청 상한, Retry-After 준수,
 * 429 시 1회 재시도(지수 백오프)를 한 곳에서 관리한다. 상태는 모듈 레벨 Map에
 * 보관하므로 같은 서버리스 인스턴스(웜 컨테이너)가 재사용되는 동안에만 유효하다 —
 * Vercel 환경에서 완벽한 전역 동기화는 되지 않지만, 같은 인스턴스 안에서 연속으로
 * 발생하는 요청(예: 갤러리 여러 장을 짧은 시간에 잇달아 요청하는 경우)을 줄이는
 * 것만으로도 실질적인 효과가 있다.
 */

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
    return response;
  } finally {
    release();
  }
}
