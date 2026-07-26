import type { ListingModel } from "@commerce/marketplace";
import type { ExecutionMode, ListingResult } from "./types";

/**
 * 실제 등록 로직을 API 호출로 할지 브라우저 자동화로 할지는 이 인터페이스
 * 뒤에 완전히 숨는다 — CommerceWorkspace는 LISTING_EXECUTORS[platform].execute()만
 * 호출하고, SmartStore가 API 기반이든 나중에 Coupang이 Playwright 기반이든
 * 알 필요가 없다.
 */
export interface ListingExecutor {
  platform: ListingModel["platform"];
  execute(listing: ListingModel, mode: ExecutionMode): Promise<ListingResult>;
}
