/* ─────────── 이 모듈은 `discovery-core` 가 소유한다 ───────────
 * MI-DISCOVERY-CORE-IMPLEMENTATION-004 — google-discovery 가 기본 preferredDomains
 * 로 이것을 쓴다(core → benchmark 는 금지 방향이므로 같이 옮겼다).
 * 🟢 이 파일은 원래부터 `comparison-search/price-source-adapter` 를 import 했다 —
 *    즉 Production 을 가리키는 방향이었고 core 에서도 그대로 유효하다. */
export * from "../discovery-core/supported-sellers";
