import type { CommerceId } from "./commerce-registry";
import type { PriorityItem, RegistrationReadinessState } from "./readiness-state";

/**
 * MI-FLOW-2(CEO 지시, 2026-09-11) — 오른쪽 Action Center의 등록 버튼 목록.
 *
 * ── 왜 함수로 빼는가 ─────────────────────────────────────────────────────
 * 버튼을 JSX에 직접 두 개 적어두면(네이버/쿠팡) 채널이 늘 때마다 화면 코드를
 * 고쳐야 하고, 그때 "SOON 채널은 어떻게 보여줬더라"를 매번 다시 판단하게 된다.
 * 채널 목록은 COMMERCE_ORDER 하나에서만 나오게 하고, 각 채널의 상태는 이미
 * 계산돼 있는 값(mergedReadiness)을 옮기기만 한다 — 여기서 새 등록 게이트를
 * 만들지 않는다. 실제 등록 가능 여부는 지금도 각 채널 탭의 검증
 * (validateNaverPayload / buildCoupangCompliance / validateLotteOnPayload)이
 * 결정한다.
 *
 * ── N-05 STEP 2(CPO 확정, 2026-09-23) ────────────────────────────────────
 * 🔴 `id` 가 `PlatformId` 에서 `CommerceId` 로 넓어졌다. 그전까지 이 목록에는
 * **롯데ON 이 들어갈 수 없었다** — 타입에 자리가 없어서다. 그래서 오른쪽
 * 「커머스 등록」 카드는 두 채널만 보여줬고, 셀러는 롯데ON 을 탭에서 따로
 * 찾아야 했다. 넓힌 것은 화면 식별자 하나뿐이고 어댑터 계약은 그대로다.
 */
export type ChannelAvailability = "AVAILABLE" | "PREVIEW_ONLY" | "COMING_SOON";

export interface RegistrationChannel {
  id: CommerceId;
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
  /** 지원 채널 순서 — COMMERCE_ORDER를 그대로 넘긴다. */
  order: readonly CommerceId[];
  labelOf: (id: CommerceId) => string;
  /** 아직 등록 기능이 없는 채널. 목록에서 빼지 않는다 — 없는 것과 준비중인 것은 다르다. */
  isComingSoon: (id: CommerceId) => boolean;
  /** 등록은 아직이지만 미리보기는 되는 채널. */
  isPreviewOnly: (id: CommerceId) => boolean;
  readiness: Partial<
    Record<CommerceId, { state: RegistrationReadinessState; priorityItems: PriorityItem[]; provisional: boolean }>
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

/**
 * 버튼 문구 — 채널 이름 + 동작. 상태어("READY")를 그대로 쓰지 않는다.
 *
 * 🔴 N-06-C(CPO 지시, 2026-09-23) — ③ 등록 준비에서 이 버튼은 «탭으로 데려갈
 * 뿐» 인데 「등록」이라고 적혀 있었다. 누르면 등록되는 줄 알고 못 누르거나,
 * 눌렀는데 등록이 안 됐다고 읽는다. 단계마다 그 자리에서 «실제로 일어나는
 * 일» 을 적는다:
 *
 *     ③ 등록 준비   확인하기   (탭으로 이동한다)
 *     ④ 커머스 등록  등록       (실제로 나간다)
 */
export type ChannelActionMode = "CHECK" | "REGISTER";

export function channelActionLabel(channel: RegistrationChannel, mode: ChannelActionMode = "REGISTER"): string {
  if (channel.availability === "COMING_SOON") return `${channel.label} 준비중`;
  return mode === "CHECK" ? `${channel.label} 확인하기` : `${channel.label} 등록`;
}
