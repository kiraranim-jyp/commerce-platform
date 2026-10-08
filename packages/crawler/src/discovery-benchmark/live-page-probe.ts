import { fetchWithDomainRateLimit } from "../rate-limit/domain-rate-limiter";
import type { PageProbe } from "./url-resolver";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-DISCOVERY-P5.4-C.1(CPO 승인, 2026-10-07) — `PageProbe` 의 실제 HTTP 구현.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `resolveCandidate` 는 처음부터 이 함수를 요구하고 있었는데(url-resolver.ts:28)
 * 구현이 인터페이스와 테스트 stub 뿐이었다. 그래서 Google grounding URL 이
 * 파이프라인에 들어오면 리다이렉트를 추적할 수 없고, 모양만 보면
 * `/grounding-api-redirect/…` 이라 `UNKNOWN_PAGE` 로 전부 버려진다 — 그러면
 * 측정 결과가 「Google 이 쓸 만한 후보를 0건 줬다」로 **거짓으로** 읽힌다.
 *
 * ── 🔴 HEAD 를 쓰지 않는다 — 가정이 아니라 실측이다 ─────────────────────────
 * 2026-10-07 실측(상한 12초와 30초로 두 번):
 *
 *   main-story.com   상품  HEAD 200 · 12.01s / 30.01s(= «상한에 정확히» 걸린다) · canonical 없음
 *                          GET  200 ·  0.84s · 255,904B · canonical 확보
 *   junioredition    상품  HEAD 200 · 12.01s                      · canonical 없음
 *                          GET  200 ·  0.65s · 820,395B · canonical 확보
 *   main-story       404   HEAD 404 · 12.01s                      · canonical 없음
 *                          GET  404 ·  0.81s · canonical=/404
 *
 * 🔴 세 건 모두 HEAD 가 **상한까지 끝나지 않는다**. status 는 헤더에서 읽히지만
 *    연결이 닫히지 않는다 — 「본문이 없으니 싸다」는 정확히 틀렸다. 그리고
 *    canonical 은 본문에 있으므로 HEAD 로는 애초에 얻을 수 없다.
 * 🔴 그래서 GET 하나만 쓴다. 본문을 받는 비용은 숨기지 않고 그대로 보고한다
 *    (`bytes` 를 반환하는 이유).
 *
 * ── 🔴 최적화를 하지 않는다 (CPO §8) ────────────────────────────────────────
 * Range 요청·배치·캐시·동시성 조정을 **하지 않는다**. 먼저 정확한 baseline 을
 * 만든다. 🔴 알려진 비효율을 적어 둔다 — 이 probe 가 본문을 받고, 그 뒤
 * `factsFromProductUrl` 이 **같은 페이지를 다시 받는다**. Shopify 는 두 번째가
 * 8KB(`.json`)지만 비-Shopify 는 같은 HTML 을 두 번 받는다. 지우지 않고 남긴다.
 */
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const DEFAULT_TIMEOUT_MS = 15000;

/** 🔴 `rel="canonical"` 은 속성 순서가 사이트마다 다르다. 두 순서를 다 본다 —
 *  한쪽만 보면 littleluna(`href` 가 먼저 오는 경우)를 놓친다. */
const CANONICAL_PATTERNS = [
  /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
  /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i,
];

export function extractCanonicalUrl(html: string, baseUrl: string): string | null {
  for (const re of CANONICAL_PATTERNS) {
    const hit = re.exec(html)?.[1]?.trim();
    if (!hit) continue;
    try {
      // 상대 경로 canonical 도 있다 — base 로 절대화한다.
      return new URL(hit, baseUrl).toString();
    } catch {
      continue;
    }
  }
  return null;
}

export interface LiveProbeResult {
  status: number;
  finalUrl: string;
  canonicalUrl: string | null;
  /** 🔴 이 probe 가 받은 본문 바이트. 비용을 코드가 직접 보고한다. */
  bytes: number;
  /** 🔴 이 probe 가 쓴 HTTP 요청 수(리다이렉트는 fetch 가 내부에서 따라간다). */
  httpCalls: number;
}

export interface LivePageProbeOptions {
  timeoutMs?: number;
  /** 🔴 각 probe 의 결과를 밖에서 모을 수 있게 한다 — 비용 계측이 추정이 되지 않게. */
  onResult?: (result: LiveProbeResult) => void;
}

/**
 * `resolveCandidate` 가 요구하는 세 칸(status · finalUrl · canonicalUrl)만 만든다.
 *
 * 🔴 요구하지 않는 정보를 위해 추가 요청을 하지 않는다. canonical 은 **이미 받은
 *    본문** 에서 읽으므로 두 번째 요청이 없다.
 * 🔴 실패를 「상품이 없다」로 만들지 않는다 — 네트워크 실패는 던지고
 *    `resolveCandidate` 가 그것을 `UNUSABLE` 로 적는다(그 함수의 try/catch 가
 *    이미 그 일을 한다).
 */
export function createLivePageProbe(options?: LivePageProbeOptions): PageProbe {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return async (url: string) => {
    const response = await fetchWithDomainRateLimit(url, {
      // 🔴 GET 이다. HEAD 는 실측에서 상한까지 끝나지 않았다(파일 머리 주석).
      method: "GET",
      headers: { Accept: "text/html,application/json;q=0.9,*/*;q=0.8", "User-Agent": CHROME_UA },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const finalUrl = response.url || url;
    // 🔴 404/410 이어도 본문을 읽는다 — Shopify 는 404 에도 canonical(`/404`)을 넣고,
    //    그 사실이 「검색 색인이 낡았다」를 설명한다(resolveCandidate 가 NOT_FOUND 로 적는다).
    const html = await response.text();
    const result: LiveProbeResult = {
      status: response.status,
      finalUrl,
      canonicalUrl: extractCanonicalUrl(html, finalUrl),
      bytes: html.length,
      httpCalls: 1,
    };
    options?.onResult?.(result);
    return { status: result.status, finalUrl: result.finalUrl, canonicalUrl: result.canonicalUrl };
  };
}
