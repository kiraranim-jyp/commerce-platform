import type { PlatformId } from "@commerce/shared";
import type { ListingExecutor } from "./executor";
import { coupangExecutor } from "./executors/coupang.executor";
import { createNotImplementedExecutor } from "./executors/not-implemented.executor";
import { smartstoreExecutor } from "./executors/smartstore.executor";

/** 새 플랫폼 등록 자동화를 추가할 때는 Executor 파일 하나를 만들고 여기 한 줄만 바꾸면 된다. */
export const LISTING_EXECUTORS: Record<PlatformId, ListingExecutor> = {
  smartstore: smartstoreExecutor,
  coupang: coupangExecutor,
  elevenst: createNotImplementedExecutor("elevenst", "11번가"),
};
