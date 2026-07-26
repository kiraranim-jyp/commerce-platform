import type { CanonicalProduct } from "@commerce/shared";
import { getSelectedImageUrl } from "@commerce/shared";
import type { FieldRule } from "./validation";

/**
 * 3개 어댑터가 전부 같은 이미지 형식 규칙을 쓴다 — 이미지가 하나도 없거나, 실제로
 * 등록에 쓰일(선택된) 이미지 중 하나라도 JPEG가 아니면 ERROR로 등록을 막는다.
 * getSelectedImageUrl()이 만드는 data URL은 이미지 파이프라인이 만든 값이라
 * "data:image/jpeg"로 시작하는지만 보면 실제로 JPEG로 인코딩됐는지 알 수 있다
 * (픽셀까지 다시 디코딩할 필요 없음 — 디코딩 가능 여부는 파이프라인 쪽에서 이미 검증했다).
 */
export function imageFormatFieldRule(product: CanonicalProduct): FieldRule {
  const images = product.images;
  const allJpeg =
    images.length > 0 && images.every((img) => getSelectedImageUrl(img).startsWith("data:image/jpeg"));

  return {
    field: "imageFormat",
    label: "이미지 형식",
    check: () => allJpeg,
    onFail: "ERROR",
    message:
      images.length === 0
        ? "등록 가능한 이미지가 없습니다."
        : "JPG 형식이 아닌 이미지가 있습니다 — 표준화가 필요합니다.",
  };
}
