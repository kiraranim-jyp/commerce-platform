import type { CanonicalProduct } from "@commerce/shared";
import { getSelectedImageUrl } from "@commerce/shared";
import type { FieldRule } from "./validation";

/**
 * 3개 어댑터가 전부 같은 이미지 형식 규칙을 쓴다 — 이미지가 하나도 없거나, 실제로
 * 등록에 쓰일(선택된) 이미지 중 하나라도 JPEG/PNG가 아니면 ERROR로 등록을 막는다.
 * 기본 등록 흐름은 원본을 최대한 그대로 쓰므로(JPG/PNG ≤10MB는 원본 유지, 그 외는
 * JPG로 변환) 최종 산출물은 항상 이 둘 중 하나다. getSelectedImageUrl()이 만드는
 * data URL은 이미지 파이프라인이 만든 값이라 "data:image/jpeg"나 "data:image/png"로
 * 시작하는지만 보면 실제로 어떤 형식으로 인코딩됐는지 알 수 있다(픽셀까지 다시
 * 디코딩할 필요 없음 — 디코딩 가능 여부는 파이프라인 쪽에서 이미 검증했다).
 */
export function imageFormatFieldRule(product: CanonicalProduct): FieldRule {
  const images = product.images;
  const allValidFormat =
    images.length > 0 &&
    images.every((img) => {
      const url = getSelectedImageUrl(img);
      return url.startsWith("data:image/jpeg") || url.startsWith("data:image/png");
    });

  return {
    field: "imageFormat",
    label: "이미지 형식",
    check: () => allValidFormat,
    onFail: "ERROR",
    message:
      images.length === 0
        ? "등록 가능한 이미지가 없습니다."
        : "JPG/PNG 형식이 아닌 이미지가 있습니다 — 표준화가 필요합니다.",
  };
}
