import { coupangAdapter } from "./adapters/coupang.adapter";
import { elevenstAdapter } from "./adapters/elevenst.adapter";
import { smartstoreAdapter } from "./adapters/smartstore.adapter";
import type { PlatformAdapter, PlatformId } from "./types";

/** 새 플랫폼을 추가할 때는 어댑터 파일 하나를 만들고 여기 한 줄만 추가하면 된다. */
export const PLATFORM_ADAPTERS: Record<PlatformId, PlatformAdapter> = {
  smartstore: smartstoreAdapter,
  coupang: coupangAdapter,
  elevenst: elevenstAdapter,
};

export const PLATFORM_ORDER: PlatformId[] = ["smartstore", "coupang", "elevenst"];

/**
 * N-4.12 STEP11(대표님 지시: "API 승인 대기 중인 5개 커머스의 인터페이스만
 * 확정한다 — 실제 API 호출 구현은 금지") — 우선순위는 대표님이 재확인한
 * 순서 그대로다: ① 카카오 → ② SSG → ③ 롯데ON → ④ G마켓 → ⑤ 11번가
 * (G마켓/11번가를 먼저 진행하는 것으로 바뀐 적 없음).
 *
 * 새 타입/새 어댑터 파일을 만들지 않는다 — PlatformId 유니언에 kakao/ssg/
 * lotteon/gmarket을 지금 추가하면 이 값을 소진 검사(exhaustive switch)하는
 * 기존 코드 전체(readiness.ts/priority.ts/RegistrationStatusBanner 등)가
 * 컴파일 에러를 내거나, 에러 없이 조용히 "지원 안 함" 취급되는 곳이 생길
 * 위험이 있다 — 승인도 안 된 플랫폼 때문에 지금 동작 중인 코드를 흔들 이유가
 * 없다(이번 작업지시서 "절대 금지" 원칙). 대신, API가 승인되는 순간 각
 * 플랫폼이 채워야 할 자리만 여기 문서로 남긴다 — N-4.11 STEP11에서 이미
 * 확정한 계약(types.ts PlatformAdapter 주석 참고) 그대로, 새 계약을 만들지
 * 않는다:
 *
 *   1) CategoryProvider 구현체 하나 (@commerce/category, 플랫폼별 카테고리
 *      트리/추천 API 연동 — smartstore-category.ts/coupang-category.ts와
 *      같은 자리)
 *   2) buildXxxPayload() — CanonicalProduct → 그 플랫폼의 실제 등록 API
 *      바디로 변환(packages/listing/src/{platform}/build-payload.ts)
 *   3) validateXxxPayload() — 등록 전 필수값 검증, ReadinessItem[] 리턴
 *      형태를 그대로 따른다(packages/listing/src/{platform}/validate-payload.ts)
 *   4) {platform}Adapter: PlatformAdapter — toListingModel() 구현
 *      (packages/marketplace/src/adapters/{platform}.adapter.ts), 여기
 *      PLATFORM_ADAPTERS에 한 줄 등록
 *   5) {Platform}Executor: ListingExecutor 구현 — .execute() (packages/
 *      listing/src/executor.ts LISTING_EXECUTORS에 한 줄 등록)
 *   6) /api/{platform}/register route.ts — DRY_RUN/LIVE 분기, registration_
 *      attempts 로깅(logRegistrationAttempt 재사용, 새 로깅 계층 없음)
 *   7) /api/{platform}/payload-preview route.ts — Preview=Validation=Register
 *      가 같은 buildXxxPayload/validateXxxPayload를 쓰는지가 유일한 검증
 *      기준(N-4.12 STEP1 결론)
 *
 * KakaoAdapter/SSGAdapter/LotteOnAdapter/GmarketAdapter/ElevenStreetAdapter
 * (11번가는 이미 elevenstAdapter로 골격이 있음 — 실제 API 연동만 남음) 각각
 * 이 7개 자리를 채우면 되고, 순서는 위 우선순위(카카오 최우선)를 따른다 —
 * 지금 코드를 미리 만들지는 않는다(추측 구현 금지, 실제 API 스펙 확인 후
 * 착수).
 */
