/**
 * ════════════════════════════════════════════════════════════════════════════
 * Discovery Core — 공개 surface
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **최소화한다**(CPO §7). Production 이 Discovery 를 쓰려면 필요한 것만 낸다.
 *    여기에 없는 것은 깊은 경로로 받아야 하고, 그것이 「왜 필요한가」를 묻게 된다.
 *
 * 🔴 `createGoogleDiscoveryProvider` 를 **직접 내지 않는다** — 키가 없으면 예외를
 *    던지기 때문이다. Production 은 fail-soft wrapper 를 써야 한다:
 *      `createProductionGoogleDiscovery()`  (production-discovery.ts)
 *    🟢 benchmark 는 지금처럼 깊은 경로로 원본을 그대로 쓴다(대조군 보존).
 */
export type {
  ProductIdentity,
  QueryId,
  DiscoveryQuery,
  DiscoveredUrl,
  DiscoveryProvider,
  ResolutionStep,
  ResolutionClass,
  ResolvedCandidate,
} from "./types";

export { generateQueries } from "./query-generator";
export { resolveCandidate, isCrawlable, type PageProbe } from "./url-resolver";
export { createLivePageProbe, type LiveProbeResult } from "./live-page-probe";
/** 🔴 `GoogleDiscoveryUsage` 를 함께 낸다 — MI-GEMINI-005 §10 이 상품당 토큰을
 *  요구하고, 호출부가 그 타입을 읽지 못하면 **비용 측정이 불가능** 하다.
 *  🟢 surface 최소화 원칙과 충돌하지 않는다 — 이것은 «읽기 전용 계측 타입» 이고
 *     provider 를 노출하는 것이 아니다. */
export {
  googleDiscoveryReadiness,
  type GoogleDiscoveryReadiness,
  type GoogleDiscoveryUsage,
} from "./google-discovery";
export { createProductionGoogleDiscovery, type ProductionDiscoveryResult } from "./production-discovery";
