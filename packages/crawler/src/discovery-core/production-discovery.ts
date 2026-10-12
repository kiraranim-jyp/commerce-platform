import {
  createGoogleDiscoveryProvider,
  googleDiscoveryReadiness,
  type GoogleDiscoveryUsage,
} from "./google-discovery";
import type { DiscoveredUrl, DiscoveryQuery, ProductIdentity } from "./types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * Production 용 Gemini Discovery — **fail-soft wrapper**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * MI-DISCOVERY-CORE-IMPLEMENTATION-004(CPO 승인 §6).
 *
 * 🔴 **왜 필요한가.** `createGoogleDiscoveryProvider(...).discover()` 는 키/설정이
 *    없으면 `GoogleDiscoveryConfigError` 를, API 실패에는 `GoogleDiscoveryApiError`
 *    를 **던진다.** 그 예외가 운영 가격확인 경로(`runDomesticPriceCheck`)로 올라오면
 *    **상품 하나의 Discovery 실패가 가격 확인 전체를 깨뜨린다.**
 *    🟢 국내 경로는 이미 같은 원칙을 쓴다 — `searchDomesticShops` 는 샵 하나가
 *       실패해도 `status:"error"` 를 돌려주고 나머지를 살린다.
 *
 * 🔴 그래서 이 wrapper 의 계약은 **「절대 던지지 않는다」** 다:
 *      키 없음        → `{ outcome: "CONFIG_MISSING", urls: [] }`
 *      API/네트워크 실패 → `{ outcome: "API_FAILURE",  urls: [] }`
 *      정상            → `{ outcome: "OK", urls }`
 *    🟢 어느 쪽이든 **후보 0** 이면 호출부는 기존 동작과 완전히 같다.
 *
 * 🔴 「0 건」과 「실패」를 **같은 칸에 담지 않는다** — `outcome` 으로 가른다.
 *    그러지 않으면 「Gemini 가 후보를 못 찾았다」와 「키가 없다」가 구분되지 않는다
 *    (이 트랙에서 그 혼동으로 거짓 결론이 두 번 났다).
 *
 * 🔴 이 파일은 **운영 호출부를 만들지 않는다.** WU-1 범위는 경계 확정까지다 —
 *    `run-domestic-price-check.ts` 는 한 줄도 바뀌지 않았다.
 */
export interface ProductionDiscoveryResult {
  outcome: "OK" | "CONFIG_MISSING" | "API_FAILURE";
  urls: DiscoveredUrl[];
  /** 🔴 실패 사유를 삼켜 없애지 않는다 — 로그/측정이 읽을 수 있게 남긴다. */
  failureDetail: string | null;
  /**
   * 🔴🔴 MI-GEMINI-INTEGRATION-005 §10 — **비용을 재려면 이 칸이 있어야 한다.**
   *
   * WU-1 에서 이 wrapper 를 만들 때 `{outcome, urls, failureDetail}` 만 돌려줬고,
   * `provider.usage()` 를 밖으로 내보내지 않았다. 🔴 그 상태로는 상품당
   * 토큰/호출 수를 **구조적으로 측정할 수 없다**(provider 인스턴스가 함수 안에서
   * 죽는다). 그래서 계약에 추가한다.
   *
   * 🔴 `null` 은 「호출 자체를 안 했다」는 뜻이다 — `CONFIG_MISSING` 이 그 경우다.
   *    0 과 구분한다(0 은 「불렀는데 토큰이 0」이고 그런 일은 없어야 한다).
   *
   * 🔴 **`groundingQueries` 는 여기에 «없다».** `GoogleDiscoveryUsage` 가 내놓는
   *    것은 `requests · promptTokens · candidatesTokens · thoughtsTokens ·
   *    totalTokens` 다섯뿐이고, grounding 쿼리 수는 응답 `usageMetadata` 에
   *    들어오지 않는다. 🔴 지시서 §10 이 요구한 `groundingQueries` 는
   *    **현재 구조에서 측정 불가** 다 — 0 으로 적지 않는다.
   */
  usage: GoogleDiscoveryUsage | null;
  /** 🟢 실제로 쓰인 모델 이름 — `provider.modelName()` 을 그대로 적는다.
   *  🔴 메서드 이름을 `model()` 로 «추측» 했다가 TS2339 를 냈다. 이 트랙에서
   *     칸/메서드 이름을 추측해 틀린 것이 다섯 번째다 — 타입 선언을 먼저 읽는다. */
  model: string | null;
}

export interface ProductionDiscoveryOptions {
  /** 비워 두면 `google-discovery` 의 기본(등록 판매처 도메인)이 쓰인다. */
  preferredDomains?: readonly string[];
}

/** 🔴 절대 throw 하지 않는다. 실패는 전부 `outcome` 으로 돌려준다. */
export async function createProductionGoogleDiscovery(
  identity: ProductIdentity,
  query: DiscoveryQuery,
  options?: ProductionDiscoveryOptions,
): Promise<ProductionDiscoveryResult> {
  const readiness = googleDiscoveryReadiness();
  if (readiness.state !== "READY") {
    return {
      outcome: "CONFIG_MISSING",
      urls: [],
      failureDetail: `missing: ${readiness.missing.join(", ") || "(unknown)"}`,
      usage: null,
      model: null,
    };
  }
  /** 🔴 provider 를 try 밖에서 만든다 — 안에서 만들면 예외 시 `usage()` 를 읽을
   *     길이 없고, 그러면 **실패한 호출의 토큰이 집계에서 사라진다.** */
  let provider: ReturnType<typeof createGoogleDiscoveryProvider> | null = null;
  try {
    provider = createGoogleDiscoveryProvider(
      options?.preferredDomains ? { preferredDomains: options.preferredDomains } : {},
    );
    const urls = await provider.discover(identity, query);
    return { outcome: "OK", urls, failureDetail: null, usage: provider.usage(), model: provider.modelName() };
  } catch (error) {
    const name = error instanceof Error ? error.name : "unknown";
    const message = error instanceof Error ? error.message : String(error);
    return {
      outcome: name === "GoogleDiscoveryConfigError" ? "CONFIG_MISSING" : "API_FAILURE",
      urls: [],
      failureDetail: `${name}: ${message}`,
      usage: provider ? provider.usage() : null,
      model: provider ? provider.modelName() : null,
    };
  }
}
