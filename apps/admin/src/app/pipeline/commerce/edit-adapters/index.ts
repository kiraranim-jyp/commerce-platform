import { channelEditScope } from "../channel-field-capability";
import type { CommerceId } from "../commerce-registry";
import type { CommerceEditAdapter } from "../commerce-edit-adapter";
import { smartStoreEditAdapter } from "./smartstore";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 Sprint A — **커머스가 늘어나면 «여기 한 줄» 이 늘어난다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 새 커머스를 「등록된 상품 수정」에 붙이는 데 필요한 것은 둘뿐이다:
 *   ① `edit-adapters/<commerce>.ts` — 그 채널 API 모양을 중립 통화로 번역
 *   ② 아래 표에 한 줄
 * Core(ChannelEditModel · ChangeSet · EditGate · Panel · Summary)도, Master 도
 * 한 줄도 바뀌지 않는다. 그 구조를 테스트가 지킨다.
 *
 * ── 🔴 쿠팡·롯데ON 을 «여기 적지 않는» 이유 ──────────────────────────────
 * 어댑터가 없어서가 아니라 «읽고 고칠 수 있는지 확인되지 않았기» 때문이다.
 * `CHANNEL_CAPABILITY` 가 두 채널의 update 를 UNKNOWN 으로 선언하고 있고(PHASE B),
 * 그 상태에서 어댑터를 적으면 화면이 「수정할 수 있다」고 말하게 된다 —
 * 「문서에 API 가 있다」는 것은 capability 근거가 아니다(이 프로젝트가 LotteON
 * apiNo 90 에서 이미 겪은 혼동이다).
 *
 * 🔴 그래서 지금 여기 없는 것은 «구현 부채가 아니라 조사 부채» 다. 조사(GET 응답
 * 실측 · UPDATE 지원 확인)가 끝나면 그때 한 줄이 는다. 그 전에 적으면, 셀러에게
 * 확인되지 않은 것을 확인했다고 말하는 것이 된다.
 */
const EDIT_ADAPTERS: Partial<Record<CommerceId, CommerceEditAdapter>> = {
  smartstore: smartStoreEditAdapter as CommerceEditAdapter,
};

/** 이 커머스의 「등록된 상품 수정」이 지금 가능한가. 없으면 `undefined`. */
export function editAdapterFor(commerceId: CommerceId): CommerceEditAdapter | undefined {
  return EDIT_ADAPTERS[commerceId];
}

/**
 * 왜 이 커머스에서는 수정 화면이 서지 않는가 — 셀러의 말로.
 *
 * 🔴 「안 됩니다」라고 말하지 않는다. 확인되지 «않았을» 뿐이고, 그 문구는
 * capability 계층이 이미 정해 두었다(fieldCapabilityNote). 여기서 새 문구를
 * 지어내면 같은 사실이 두 목소리로 갈라진다.
 */
export function editUnavailableNote(commerceId: CommerceId): string | undefined {
  if (editAdapterFor(commerceId)) return undefined;
  const scope = channelEditScope(commerceId);
  return scope.editable.length === 0
    ? "이 커머스에서 등록된 상품을 수정할 수 있는지 아직 확인되지 않았습니다."
    : /* 🔴 capability 는 고칠 수 있다는데 어댑터가 없다 — 우리 쪽 미비다.
         그 둘을 같은 문구로 뭉개면 조사 부채와 구현 부채가 섞인다. */
      "이 커머스의 수정 기능은 아직 연결되지 않았습니다.";
}

/** 🔴 테스트가 「Core 를 고치지 않고 늘어났는가」를 세는 지점. */
export const EDIT_ADAPTER_COMMERCE_IDS = Object.keys(EDIT_ADAPTERS) as CommerceId[];
