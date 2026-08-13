import type { CanonicalProduct } from "@commerce/shared";
import { getSelectedImageUrl } from "@commerce/shared";
import type { FieldRule } from "./validation";

/**
 * 3개 어댑터가 전부 같은 이미지 형식 규칙을 쓴다 — 이미지가 하나도 없거나, 실제로
 * 등록에 쓰일(선택된) 이미지 중 하나라도 JPEG/PNG가 아니면 ERROR로 등록을 막는다.
 * 기본 등록 흐름은 원본을 최대한 그대로 쓰므로(JPG/PNG ≤10MB는 원본 유지, 그 외는
 * JPG로 변환) 최종 산출물은 항상 이 둘 중 하나다. getSelectedImageUrl()은 두 가지
 * 형태를 돌려줄 수 있다 — 브라우저 미리보기 전용 흐름에서는 파이프라인이 만든
 * data URL("data:image/jpeg..."), 실제 마켓플레이스 등록 흐름에서는 Supabase
 * Storage에 올린 공개 https URL(마켓플레이스 vendorPath 요구사항 — data URI는
 * 길이 제한에 걸려 실제 쿠팡 API가 거부한다, 실등록 시도로 확인). 둘 다 파이프라인이
 * JPEG/PNG로 검증한 뒤에만 만들어지는 값이라 확장자만 보면 충분하다(픽셀까지 다시
 * 디코딩할 필요 없음).
 */
function isJpegOrPngUrl(url: string): boolean {
  if (url.startsWith("data:image/jpeg") || url.startsWith("data:image/png")) return true;
  const withoutQuery = url.split(/[?#]/)[0].toLowerCase();
  return withoutQuery.endsWith(".jpg") || withoutQuery.endsWith(".jpeg") || withoutQuery.endsWith(".png");
}

export function imageFormatFieldRule(product: CanonicalProduct): FieldRule {
  // N-3.19(CPO 지시: "Readiness도 반드시 동일 source 사용" — product.images.filter(
  // useInProductGallery)) — 대표 이미지는 useInProductGallery와 별개 필드라 항상
  // 포함하고, 나머지는 실제로 등록 갤러리에 쓰일 이미지만 본다. 사용자가 "등록에서
  // 제외"한 이미지의 포맷 문제로 등록 자체가 막히면 안 된다 — 그 이미지는 애초에
  // payload에 안 들어가기 때문이다.
  const images = product.images.filter((img) => img.isRepresentative || img.useInProductGallery);
  const allValidFormat =
    images.length > 0 && images.every((img) => isJpegOrPngUrl(getSelectedImageUrl(img)));

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
