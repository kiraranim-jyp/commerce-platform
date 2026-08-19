import type { CoupangPayload } from "./coupang/build-payload";
import type { NaverProductRegistrationPayload } from "./naver/types";
import type { ListingResult, RegistrationReport } from "./types";

function isCoupangPayload(payload: unknown): payload is CoupangPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "sellerProductName" in payload &&
    "items" in payload
  );
}

function isNaverPayload(payload: unknown): payload is NaverProductRegistrationPayload {
  return typeof payload === "object" && payload !== null && "originProduct" in payload;
}

/**
 * ListingResult(등록 시도 1건의 원시 결과)를 사람이 바로 읽을 수 있는 요약으로
 * 바꾼다. 성공/실패에 따라 보여줄 정보가 다르므로 RegistrationReport는 판별
 * 유니언이다 — 호출부(ListingSection.tsx)는 outcome만 보고 분기하면 된다.
 *
 * Sprint P2 버그 수정(2026-08-19, CEO 실측 보고: "치수 옵션으로 등록은
 * 가능하나 결과 카드에 상품명 —/이미지 0장/옵션 0개로 표시") — 이 함수가
 * isCoupangPayload만 검사해서 SmartStore(Naver) payload는 항상 매칭 실패로
 * 빈 값을 보여주고 있었다. Naver payload 모양(originProduct.name/images/
 * detailAttribute.optionInfo.optionCombinations)도 인식하도록 분기 추가.
 */
export function buildRegistrationReport(result: ListingResult): RegistrationReport {
  if (result.status === "SUBMITTED") {
    if (isNaverPayload(result.payload)) {
      const { originProduct } = result.payload;
      const optionCombinations = originProduct.detailAttribute?.optionInfo?.optionCombinations ?? [];
      return {
        outcome: "SUCCESS",
        productName: originProduct.name ?? "",
        imageCount: 1 + (originProduct.images?.optionalImages?.length ?? 0),
        optionCount: optionCombinations.length,
        externalProductId: result.externalProductId,
        durationMs: result.durationMs,
      };
    }
    const payload = isCoupangPayload(result.payload) ? result.payload : null;
    const item = payload?.items[0];
    return {
      outcome: "SUCCESS",
      productName: payload?.sellerProductName ?? "",
      imageCount: item?.images.length ?? 0,
      optionCount: item?.searchTags.length ?? 0,
      externalProductId: result.externalProductId,
      durationMs: result.durationMs,
    };
  }

  const error = result.error;
  return {
    outcome: "FAILURE",
    reason: error?.message ?? "알 수 없는 오류로 등록에 실패했습니다.",
    code: error?.code,
    autoRetryable: error?.retryable ?? false,
    resolution: error?.resolution,
  };
}
