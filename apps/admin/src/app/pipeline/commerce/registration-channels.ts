import type { PlatformId } from "@commerce/shared";
import type { PriorityItem, RegistrationReadinessState } from "./readiness-state";

/**
 * MI-FLOW-2(CEO 지시, 2026-09-11) — 오른쪽 Action Center의 등록 버튼 목록.
 *
 * ── 왜 함수로 빼는가 ─────────────────────────────────────────────────────
 * 버튼을 JSX에 직접 두 개 적어두면(네이버/쿠팡) 채널이 늘 때마다 화면 코드를
 * 고쳐야 하고, 그때 "SOON 채널은 어떻게 보여줬더라"를 매번 다시 판단하게 된다.
 * 채널 목록은 PLATFORM_ORDER 하나에서만 나오게 하고, 각 채널의 상태는 이미
 * 계산돼 있는 값(mergedReadiness)을 옮기기만 한다 — 여기서 새 등록 게이트를
 * 만들지 않는다. 실제 등록 가능 여부는 지금도 각 채널 탭의 검증
 * (validateNaverPayload / buildCoupangCompliance)이 결정한다.
 */
export type ChannelAvailability = "AVAILABLE" | "PREVIEW_ONLY" | "COMING_SOON";

export interface RegistrationChannel {
  id: PlatformId;
  label: string;
  availability: ChannelAvailability;
  /** 방문/사전점검으로 확보된 준비 상태. 어댑터가 이 상품을 못 다루면 null. */
  state: RegistrationReadinessState | null;
  /** 아직 채워야 하는 필수 항목 수. 상태를 모르면 0이다(0을 "준비됨"으로 읽지 않게 state를 함께 본다). */
  blockingCount: number;
  /** 탭을 아직 열지 않아 사전 점검값으로만 계산된 상태인가. */
  provisional: boolean;
}

export interface RegistrationChannelsInput {
  /** 지원 채널 순서 — PLATFORM_ORDER를 그대로 넘긴다. */
  order: readonly PlatformId[];
  labelOf: (id: PlatformId) => string;
  /** 아직 등록 기능이 없는 채널. 목록에서 빼지 않는다 — 없는 것과 준비중인 것은 다르다. */
  isComingSoon: (id: PlatformId) => boolean;
  /** 등록은 아직이지만 미리보기는 되는 채널. */
  isPreviewOnly: (id: PlatformId) => boolean;
  readiness: Partial<
    Record<PlatformId, { state: RegistrationReadinessState; priorityItems: PriorityItem[]; provisional: boolean }>
  >;
}

export function buildRegistrationChannels(input: RegistrationChannelsInput): RegistrationChannel[] {
  return input.order.map((id) => {
    const r = input.readiness[id];
    const availability: ChannelAvailability = !input.isComingSoon(id)
      ? "AVAILABLE"
      : input.isPreviewOnly(id)
        ? "PREVIEW_ONLY"
        : "COMING_SOON";
    return {
      id,
      label: input.labelOf(id),
      availability,
      state: r?.state ?? null,
      blockingCount: r?.priorityItems.length ?? 0,
      provisional: r?.provisional ?? false,
    };
  });
}

/** 버튼 문구 — 채널 이름 + 동작. 상태어("READY")를 그대로 쓰지 않는다. */
export function channelActionLabel(channel: RegistrationChannel): string {
  if (channel.availability === "COMING_SOON") return `${channel.label} 준비중`;
  return `${channel.label} 등록`;
}
