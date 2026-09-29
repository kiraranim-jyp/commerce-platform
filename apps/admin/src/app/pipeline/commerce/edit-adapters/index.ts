import { channelEditScope, FIELD_LABEL } from "../channel-field-capability";
import type { CommerceId } from "../commerce-registry";
import type { CommerceEditAdapter } from "../commerce-edit-adapter";
import { smartStoreEditAdapter } from "./smartstore";
import { coupangEditAdapter } from "./coupang";

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
  /* 🔴 COUPANG-UPDATE-WIRE-01 Phase 3(2026-09-29) — **그 「이어지는 커밋」이 이것이다.**
     앞 스프린트에서 이 줄을 «일부러 비워 뒀다» — 어댑터만 있고 부르는 화면이
     없으면 「고칠 수 있다」고 말하고 아무 일도 일어나지 않기 때문이다.
     이제 다섯이 «같은 커밋에» 있다:
       [x] 읽기 라우트(api/coupang/registered-product)
       [x] 어댑터(edit-adapters/coupang.ts) · 서버 실행부(_lib/update-product.ts)
       [x] capability — 🔴 상품명 «하나» 만 EDITABLE(updateFields: ["name"])
       [x] CommerceWorkspace 의 채널별 수정 orchestration
       [x] register 라우트의 UPDATE 실행 경계(_lib/update-execution.ts)
     🔴 열린 축이 상품명 하나인 것은 「쿠팡이 못 한다」가 아니라 «우리가 확인한
     것이 거기까지» 라서다. 넓히려면 그 축의 GET/PUT 왕복 실측이 먼저다. */
  coupang: coupangEditAdapter as CommerceEditAdapter,
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

/**
 * ══ UI-UNIFY-01 A(CPO 결정, 2026-09-30) — **지원 «되는» 채널도 말한다** ═══════
 *
 * 위 `editUnavailableNote()` 는 어댑터가 «없는» 채널만 말한다. 그래서 어댑터가
 * 생긴 채널(스마트스토어·쿠팡)은 아직 등록 전일 때 우측 요약에서 **아무 말도
 * 하지 않았다** — 롯데ON 만 「확인되지 않음」 카드를 세우고 있었다. 셀러에게는
 * 같은 자리가 채널마다 비었다 찼다 하는 것으로 보인다.
 *
 * 🔴 여기서 capability 를 «다시 판정하지 않는다». `channelEditScope()` 가 이미
 * 낸 결과를 문장으로 옮길 뿐이라, 쿠팡의 「상품명 하나」가 「전 항목」으로 부풀
 * 수 없다(CPO 명시).
 * 🔴 어댑터가 없으면 `undefined` — 그 자리는 기존 카드가 계속 말한다. 두 카드가
 * 한 자리에 서지 않도록 «서로 배타» 다.
 */
export function editSupportedScope(commerceId: CommerceId): { status: string; note: string } | undefined {
  if (!editAdapterFor(commerceId)) return undefined;
  const scope = channelEditScope(commerceId);
  if (scope.editable.length === 0) return undefined;

  const editable = scope.editable.map((field) => FIELD_LABEL[field]);
  const blocked = [...scope.recreateOnly, ...scope.unknown].map((field) => FIELD_LABEL[field]);

  /* 🔴 「전 항목」이라고 말할 수 있는 것은 막힌 축이 «하나도» 없을 때뿐이다. */
  const status = blocked.length === 0 ? "전 항목 수정 가능" : `${editable.join(" · ")} 수정 가능`;
  const note =
    blocked.length === 0
      ? "등록된 상품을 이 화면에서 수정할 수 있습니다."
      : /* 🔴 나머지를 「불가」로 적지 않는다 — 확인되지 «않은» 것이다(고정 어휘). */
        `나머지 항목(${blocked.join(" · ")})은 이 커머스에서 수정할 수 있는지 아직 확인되지 않았습니다.`;
  return { status, note };
}

/** 🔴 테스트가 「Core 를 고치지 않고 늘어났는가」를 세는 지점. */
export const EDIT_ADAPTER_COMMERCE_IDS = Object.keys(EDIT_ADAPTERS) as CommerceId[];
