import type { PlatformCategoryTable } from "./types";

export const SMARTSTORE_CATEGORIES: PlatformCategoryTable = {
  "T-Shirt": {
    primary: { name: "티셔츠", path: ["유아동패션", "유아동의류", "티셔츠"] },
    alternate: { name: "상의", path: ["유아동패션", "유아동의류", "상의"] },
  },
  Shirt: {
    primary: { name: "셔츠", path: ["패션의류", "남성의류", "셔츠"] },
    alternate: { name: "블라우스/셔츠", path: ["패션의류", "여성의류", "블라우스/셔츠"] },
  },
  Pants: {
    primary: { name: "바지", path: ["유아동패션", "유아동의류", "바지"] },
    alternate: { name: "팬츠", path: ["패션의류", "하의", "팬츠"] },
  },
  Leggings: {
    primary: { name: "레깅스", path: ["유아동패션", "유아동의류", "레깅스"] },
    alternate: { name: "레깅스", path: ["스포츠/레저", "요가/필라테스용품", "레깅스"] },
  },
  Dress: {
    primary: { name: "원피스", path: ["유아동패션", "유아동의류", "원피스"] },
    alternate: { name: "원피스", path: ["패션의류", "여성의류", "원피스"] },
  },
  Jacket: {
    primary: { name: "아우터", path: ["유아동패션", "유아동의류", "아우터"] },
    alternate: { name: "자켓", path: ["패션의류", "아우터", "자켓"] },
  },
  Hoodie: {
    primary: { name: "후드/맨투맨", path: ["유아동패션", "유아동의류", "후드/맨투맨"] },
    alternate: { name: "후드집업", path: ["패션의류", "아우터", "후드집업"] },
  },
  Hat: {
    primary: { name: "모자", path: ["유아동패션", "유아동잡화", "모자"] },
    alternate: { name: "캡/버킷햇", path: ["패션잡화", "모자", "캡/버킷햇"] },
  },
  Shoes: {
    primary: { name: "운동화", path: ["유아동패션", "유아동신발", "운동화"] },
    alternate: { name: "스니커즈", path: ["패션잡화", "신발", "스니커즈"] },
  },
  Swimwear: {
    primary: { name: "수영복", path: ["유아동패션", "유아동의류", "수영복"] },
    alternate: { name: "수영복", path: ["스포츠/레저", "수영용품", "수영복"] },
  },
  Accessories: {
    primary: { name: "액세서리", path: ["유아동패션", "유아동잡화", "액세서리"] },
    alternate: { name: "패션소품", path: ["패션잡화", "액세서리", "기타"] },
  },
};
