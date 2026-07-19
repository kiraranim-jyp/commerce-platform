import type { ExtractedImage } from "@commerce/shared";
import { universalExtract } from "./universal-extractor";

/** 기존 파이프라인이 쓰는 얇은 진입점 — 내부는 universalExtract()가 담당한다.
 * 반환 형태(ExtractedImage[])는 그대로라 하위 호환이 유지된다. */
export async function extractProductImages(url: string): Promise<ExtractedImage[]> {
  const result = await universalExtract(url);
  return result.images;
}
