export const IMAGE_TYPES = [
  "MODEL",
  "PRODUCT",
  "DETAIL",
  "SIZE_CHART",
  "PACKAGE",
  "LOGO",
  "BANNER",
  "UNKNOWN",
] as const;

export type ImageType = (typeof IMAGE_TYPES)[number];

export interface ExtractedImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface ClassifiedImage {
  file: string;
  type: ImageType;
  confidence: number;
}

export interface ProductMetadata {
  title: string;
  sourceUrl: string;
  images: string[];
  thumbnail: string;
  productImages: string[];
  detailImages: string[];
  modelImages: string[];
  sizeChart: string[];
  /** 사람 검수 모드용: 이미지별 AI 분류 결과와 신뢰도. 관리자 화면에서 재분류/제외에 사용한다. */
  classifications: ClassifiedImage[];
}
