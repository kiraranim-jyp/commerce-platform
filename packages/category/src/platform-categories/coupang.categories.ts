import type { PlatformCategoryTable } from "./types";

export const COUPANG_CATEGORIES: PlatformCategoryTable = {
  "T-Shirt": {
    primary: { name: "티셔츠", path: ["패션의류/잡화", "유아동의류", "상의", "티셔츠"] },
    alternate: { name: "상의", path: ["패션의류/잡화", "유아동의류", "상의"] },
  },
  Shirt: {
    primary: { name: "셔츠/남방", path: ["패션의류/잡화", "남성의류", "셔츠/남방"] },
    alternate: { name: "블라우스", path: ["패션의류/잡화", "여성의류", "블라우스"] },
  },
  Pants: {
    primary: { name: "바지", path: ["패션의류/잡화", "유아동의류", "하의", "바지"] },
    alternate: { name: "하의", path: ["패션의류/잡화", "유아동의류", "하의"] },
  },
  Leggings: {
    primary: { name: "레깅스", path: ["패션의류/잡화", "유아동의류", "하의", "레깅스"] },
    alternate: { name: "레깅스", path: ["스포츠", "요가/필라테스", "레깅스"] },
  },
  Dress: {
    primary: { name: "원피스", path: ["패션의류/잡화", "유아동의류", "원피스"] },
    alternate: { name: "원피스", path: ["패션의류/잡화", "여성의류", "원피스"] },
  },
  Jacket: {
    primary: { name: "아우터", path: ["패션의류/잡화", "유아동의류", "아우터"] },
    alternate: { name: "자켓/코트", path: ["패션의류/잡화", "남성의류", "자켓/코트"] },
  },
  Hoodie: {
    primary: { name: "후드티", path: ["패션의류/잡화", "유아동의류", "상의", "후드티"] },
    alternate: { name: "맨투맨/스웨트", path: ["패션의류/잡화", "남성의류", "맨투맨/스웨트"] },
  },
  Hat: {
    primary: { name: "모자", path: ["패션의류/잡화", "유아동잡화", "모자"] },
    alternate: { name: "캡", path: ["패션의류/잡화", "잡화", "모자", "캡"] },
  },
  Shoes: {
    primary: { name: "운동화", path: ["패션의류/잡화", "유아동신발", "운동화"] },
    alternate: { name: "스니커즈", path: ["패션의류/잡화", "신발", "스니커즈"] },
  },
  Swimwear: {
    primary: { name: "수영복", path: ["패션의류/잡화", "유아동의류", "수영복"] },
    alternate: { name: "래시가드", path: ["스포츠", "수영용품", "래시가드"] },
  },
  Accessories: {
    primary: { name: "액세서리", path: ["패션의류/잡화", "유아동잡화", "액세서리"] },
    alternate: { name: "잡화", path: ["패션의류/잡화", "잡화", "기타"] },
  },
};
