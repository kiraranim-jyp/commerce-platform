import type { PlatformId } from "@commerce/shared";
import { COUPANG_CATEGORIES } from "./coupang.categories";
import { ELEVENST_CATEGORIES } from "./elevenst.categories";
import { SMARTSTORE_CATEGORIES } from "./smartstore.categories";
import type { PlatformCategoryTable } from "./types";

export * from "./types";

/** 새 플랫폼을 추가할 때는 이 표에 한 줄만 추가하면 된다(카테고리 시드 파일은 별도). */
export const PLATFORM_CATEGORY_TABLES: Record<PlatformId, PlatformCategoryTable> = {
  smartstore: SMARTSTORE_CATEGORIES,
  coupang: COUPANG_CATEGORIES,
  elevenst: ELEVENST_CATEGORIES,
};
