import type { PlatformId } from "@commerce/shared";
import type { ListingResult } from "./types";

export type MockApiScenario = "SUCCESS" | "VALIDATION_ERROR" | "AUTH_ERROR" | "NETWORK_ERROR";

/**
 * 실제 인증 없이도 등록 API가 낼 수 있는 4가지 결과를 그대로 재현한다 —
 * QA/개발 중에 "성공했을 때 UI가 맞게 그려지는가", "인증 실패 화면이 맞는가"를
 * 실제 네트워크 호출 없이 검증하기 위한 것이다. LIVE 모드 자체를 대체하지
 * 않는다 — 실제 API 연동이 붙으면 이 함수는 테스트에서만 쓰이게 된다.
 */
export function mockApiResponse(scenario: MockApiScenario, platform: PlatformId): ListingResult {
  switch (scenario) {
    case "SUCCESS":
      return {
        status: "SUBMITTED",
        platform,
        mode: "LIVE",
        retryable: false,
        externalProductId: `mock-${platform}-${Date.now()}`,
        externalUrl: `https://smartstore.naver.com/mock/products/${Date.now()}`,
        submittedAt: new Date().toISOString(),
      };
    case "VALIDATION_ERROR":
      return {
        status: "FAILED",
        platform,
        mode: "LIVE",
        retryable: true,
        error: {
          step: "VALIDATION",
          message: "카테고리 코드가 확인되지 않았습니다.",
          retryable: true,
          resolution: "카테고리를 다시 선택해주세요.",
        },
      };
    case "AUTH_ERROR":
      return {
        status: "FAILED",
        platform,
        mode: "LIVE",
        retryable: false,
        error: {
          step: "AUTHENTICATION",
          message: "SmartStore 인증이 필요합니다.",
          retryable: false,
          resolution: "다시 로그인하거나 인증 정보를 확인해주세요.",
        },
      };
    case "NETWORK_ERROR":
      return {
        status: "FAILED",
        platform,
        mode: "LIVE",
        retryable: true,
        error: {
          step: "NETWORK",
          message: "SmartStore 서버에 연결할 수 없습니다.",
          retryable: true,
          resolution: "잠시 후 다시 시도해주세요.",
        },
      };
  }
}
