import type { ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct } from "@commerce/shared";
import type { DetailPageBlock } from "./coupang/build-payload";
import type { ExecutionMode, ListingResult } from "./types";

/**
 * 실제 등록 로직을 API 호출로 할지 브라우저 자동화로 할지는 이 인터페이스
 * 뒤에 완전히 숨는다 — CommerceWorkspace는 LISTING_EXECUTORS[platform].execute()만
 * 호출하고, SmartStore가 API 기반이든 나중에 Coupang이 Playwright 기반이든
 * 알 필요가 없다.
 *
 * product를 listing과 별도로 받는 이유: 원산지/반품정보/배송비/재고 같은 등록
 * 직전 필드는 ListingModel(플랫폼 Preview 모양)에 없다 — CanonicalProduct에만
 * 있다. ListingModel에 이 필드들을 밀어넣으면 "플랫폼 Preview 모양"과 "등록
 * 준비 데이터"가 섞여서 STEP 1이 요구하는 3단 분리(CanonicalProduct → ListingModel
 * → Payload)가 무너진다.
 */
export interface ListingExecutor {
  platform: ListingModel["platform"];
  execute(
    product: CanonicalProduct,
    listing: ListingModel,
    mode: ExecutionMode,
    /** "최근 작업" 스냅샷에서 이어서 등록한 경우의 스냅샷 id — LIVE 등록 시
     * registration_attempts.snapshot_id에 남겨 감사 추적 및 스냅샷 status를
     * REGISTERED로 갱신하는 데 쓴다. API 기반이 아닌 실행기(Playwright 등)는
     * 무시해도 된다. */
    context?: {
      snapshotId?: string;
      /** Sprint B-1(CPO 지시) — snapshotId와 함께 그대로 register API에 전달해서
       * registration_attempts.job_key에 남긴다(감사 로그를 조인 없이 검색하기
       * 위한 복제값 — snapshotId가 구조적 연결의 원본이다). */
      jobKey?: string;
      /** Detail Page Editor(2026-08-04, Sprint P1에서 smartstoreExecutor도
       * 사용하도록 확장, 2026-08-19) — 있으면 그대로 register API에 전달해서
       * 이 순서로 상세페이지 contents를 조립한다. */
      detailBlocks?: DetailPageBlock[];
    },
  ): Promise<ListingResult>;
}
