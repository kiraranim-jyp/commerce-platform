import type { ProductType } from "../keyword-rules";

export interface CategoryPath {
  name: string;
  path: string[];
}

export interface CategoryMapping {
  primary: CategoryPath;
  /** 상위 카테고리로 등록해도 되는 경우의 대안 — 없는 타입도 있다. */
  alternate?: CategoryPath;
}

export type PlatformCategoryTable = Record<ProductType, CategoryMapping>;
