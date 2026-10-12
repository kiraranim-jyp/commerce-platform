import { createGoogleDiscoveryProvider, googleDiscoveryReadiness } from "./google-discovery";
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
    };
  }
  try {
    const provider = createGoogleDiscoveryProvider(
      options?.preferredDomains ? { preferredDomains: options.preferredDomains } : {},
    );
    const urls = await provider.discover(identity, query);
    return { outcome: "OK", urls, failureDetail: null };
  } catch (error) {
    const name = error instanceof Error ? error.name : "unknown";
    const message = error instanceof Error ? error.message : String(error);
    return {
      outcome: name === "GoogleDiscoveryConfigError" ? "CONFIG_MISSING" : "API_FAILURE",
      urls: [],
      failureDetail: `${name}: ${message}`,
    };
  }
}
