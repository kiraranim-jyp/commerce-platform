/**
 * N-4.04 Part S(대표님 지시) — SOON 마켓플레이스는 실제 API를 호출하지
 * 않지만, "지금 상태가 뭔지"는 명확해야 한다. credential 유무와 "공식 API
 * 스펙을 확보했는지"는 서로 다른 축이다 — credential이 있어도 스펙 자체가
 * 없으면 여전히 NOT_AVAILABLE이다(추정으로 진행하지 않는다는 원칙과 동일).
 */
export type SoonConnectionStatus = "NOT_CONFIGURED" | "READY_FOR_CONNECTION" | "NOT_AVAILABLE";

export function resolveSoonConnectionStatus(hasCredentials: boolean, apiSpecConfirmed: boolean): SoonConnectionStatus {
  if (!apiSpecConfirmed) return "NOT_AVAILABLE";
  return hasCredentials ? "READY_FOR_CONNECTION" : "NOT_CONFIGURED";
}
