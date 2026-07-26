import type { PlatformId } from "@commerce/shared";
import type { ListingExecutor } from "../executor";

/**
 * Coupang/11번가는 이번 Mission 범위 밖이다(PM 지시: "SmartStore 먼저"). 다만
 * ListingExecutor 인터페이스는 지금 구현해서 등록해둔다 — 나중에 실제 Executor로
 * 갈아끼울 때 registry.ts 한 줄만 바꾸면 되고, UI 쪽은 이미 "실패 → 재시도"
 * 흐름을 갖고 있어서 새 코드 없이도 "준비 중" 메시지를 자연스럽게 보여준다.
 */
export function createNotImplementedExecutor(platform: PlatformId, label: string): ListingExecutor {
  return {
    platform,
    async execute(_listing, mode) {
      return {
        status: "FAILED",
        platform,
        mode,
        retryable: false,
        error: {
          step: "not_implemented",
          message: `${label} 등록 자동화는 아직 준비 중입니다.`,
          retryable: false,
        },
      };
    },
  };
}
