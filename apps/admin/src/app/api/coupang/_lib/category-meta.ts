import type { CoupangCredentials } from "./env";
import { callCoupangApi } from "./client";

/**
 * 카테고리별 필수 구매옵션(attributes)/고시정보(notices) 실제 스키마 조회 —
 * register 라우트가 등록 시점에 매번 호출해서 payload의 items[].attributes[]/
 * notices[]를 채운다. 빈 배열로 보내면 실제 쿠팡 API가 "고시정보 입력해야
 * 합니다"로 거부한다(실등록 시도로 확인).
 */
const CATEGORY_META_PATH =
  "/v2/providers/seller_api/apis/api/v1/marketplace/meta/category-related-metas/display-category-codes";

export interface CategoryAttributeMeta {
  attributeTypeName: string;
  dataType: string;
  inputType: string;
  inputValues: string[];
  basicUnit: string;
  required: "MANDATORY" | "OPTIONAL";
}

export interface CategoryNoticeDetailMeta {
  noticeCategoryDetailName: string;
  required: "MANDATORY" | "OPTIONAL";
}

export interface CategoryNoticeMeta {
  noticeCategoryName: string;
  noticeCategoryDetailNames: CategoryNoticeDetailMeta[];
}

export interface CategoryMeta {
  attributes: CategoryAttributeMeta[];
  noticeCategories: CategoryNoticeMeta[];
}

interface RawCategoryMetaResponse {
  code?: string;
  data?: {
    attributes?: CategoryAttributeMeta[];
    noticeCategories?: CategoryNoticeMeta[];
  };
}

export async function fetchCategoryMeta(
  credentials: CoupangCredentials,
  displayCategoryCode: number,
): Promise<CategoryMeta | null> {
  try {
    const response = await callCoupangApi(credentials, {
      method: "GET",
      path: `${CATEGORY_META_PATH}/${displayCategoryCode}`,
    });
    if (!response.ok) return null;
    const parsed = response.body as RawCategoryMetaResponse;
    return {
      attributes: parsed.data?.attributes ?? [],
      noticeCategories: parsed.data?.noticeCategories ?? [],
    };
  } catch {
    return null;
  }
}
