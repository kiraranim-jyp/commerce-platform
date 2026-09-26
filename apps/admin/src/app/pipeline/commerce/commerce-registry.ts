import type { PlatformId } from "@commerce/shared";
import { PLATFORM_ADAPTERS, PLATFORM_ORDER } from "@commerce/marketplace";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * N-05 STEP 2(CPO 확정, 2026-09-23) — **화면이 아는 커머스 목록.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 왜 이 파일이 필요한가 ─────────────────────────────────────────────────
 * 화면의 채널 목록은 전부 `Record<PlatformId, …>` 였다. 그런데 `PlatformId` 에는
 * 롯데ON 이 없다 — 그래서 오른쪽 「커머스 등록」 카드에 **롯데ON 이 아예 서지
 * 못했다.** 롯데ON 은 탭 줄에 한 줄 하드코딩으로만 있었다.
 *
 * 🔴 저장은 이미 세 채널을 안다. `registration_attempts.platform` 에 롯데ON 이
 * `'lotteon'` 으로 기록된다(api/lotteon/register/route.ts). 갈라져 있던 것은
 * **화면뿐이다.**
 *
 * ── 🔴 이것은 새 추상화가 «아니다» ────────────────────────────────────────
 * 같은 모양이 이미 CommerceWorkspace 에 있다:
 *
 *     type CommerceTab = "source" | "content" | PlatformId | typeof LOTTEON_TAB;
 *     function isPlatformTab(tab): tab is PlatformId
 *
 * 여기서 하는 일은 그 판별식을 한 파일로 모으고 이름을 붙이는 것뿐이다.
 *
 * ── 🔴 이 파일이 «하지 않는» 것 (CPO 확정) ────────────────────────────────
 * · `packages/shared` 의 `PlatformId` 를 넓히지 않는다.
 * · `PLATFORM_ADAPTERS` / `LISTING_EXECUTORS` / NextGen 어댑터 계열을 통합하지
 *   않는다. 어댑터를 인덱싱하기 «전에» 반드시 `isPlatformCommerce()` 로 가른다.
 * · DB 구조를 바꾸지 않는다.
 *
 * 즉 이 확장은 **화면 orchestration 에서만** 세 커머스를 같은 자격으로 다루기
 * 위한 것이고, 지금까지 지켜 온 PlatformId/NextGen 경계는 그대로다.
 */

/** 롯데ON 의 화면 식별자. 탭 키(`LOTTEON_TAB`)와 DB 의 platform 값과 같은 글자다. */
export const LOTTEON_COMMERCE_ID = "lotteon" as const;

/** 화면이 다루는 커머스 하나. 어댑터 키가 아니라 «화면의» 식별자다. */
export type CommerceId = PlatformId | typeof LOTTEON_COMMERCE_ID;

/**
 * 🔴 어댑터를 인덱싱해도 되는가. false 면 `PLATFORM_ADAPTERS[id]` 는 undefined 라
 * 렌더 중에 터진다 — CommerceWorkspace 의 `isPlatformTab()` 과 같은 계약이다.
 */
export function isPlatformCommerce(id: CommerceId): id is PlatformId {
  return id !== LOTTEON_COMMERCE_ID;
}

/**
 * 화면에 «보이는» 커머스 순서.
 *
 * 11번가는 여기서 빠진다 — LOTTEON COMMERCE SPRINT 3(CEO 확정, 2026-09-14)의
 * 그 정책 그대로다. 빠지는 곳은 이 한 줄뿐이고 `PLATFORM_ORDER` · `PlatformId` ·
 * 11번가 어댑터는 한 줄도 건드리지 않는다(기능 삭제가 아니라 화면 비노출).
 *
 * 🔴 채널을 나열하는 자리는 전부 이 배열 하나를 봐야 한다. 탭 줄 · Action Center ·
 * ④ 흐름 · 커머스 선택기가 각자 다른 목록을 쓰면 「탭에는 없는데 선택기에는
 * 있는」 커머스가 생긴다(이 화면이 이미 여러 번 겪은 불일치다).
 */
export const COMMERCE_ORDER: readonly CommerceId[] = [
  ...PLATFORM_ORDER.filter((id) => id !== "elevenst"),
  LOTTEON_COMMERCE_ID,
] as const;

/** 셀러가 읽는 이름. 플랫폼은 어댑터가 이미 갖고 있는 label 을 그대로 쓴다. */
export function commerceLabel(id: CommerceId): string {
  return isPlatformCommerce(id) ? PLATFORM_ADAPTERS[id].label : "롯데ON";
}

/**
 * N-05-C/D — 한 커머스의 등록 «결과».
 *
 * 🔴 `ListingResult`(packages/listing)를 넓히지 않는다. 그 타입의 `platform` 은
 * `PlatformId` 이고, 롯데ON 을 넣으려면 패키지 계약을 건드려야 한다 — 이번
 * 범위가 아니다. 화면이 세 커머스를 나란히 보여주는 데 필요한 것은 네 칸뿐이라
 * 화면 레이어에서 그 네 칸만 정의한다.
 *
 * 채널별 «원본» 결과는 지금처럼 각자의 자리에 그대로 남는다(스마트스토어·쿠팡은
 * listingResults, 롯데ON 은 패널). 이것은 그 위에 서는 «요약» 이다.
 */
export interface CommerceOutcome {
  /** SUBMITTED = 실제로 제출됨. SKIPPED = 준비가 안 돼 호출조차 하지 않음. */
  status: "SUBMITTED" | "FAILED" | "SKIPPED";
  /** 셀러가 읽는 한 줄. 실패 사유이거나 건너뛴 이유다. */
  message?: string;
  /** 채널이 돌려준 상품 번호. 없으면 null — 지어내지 않는다. */
  externalProductId?: string | null;
}

/** 등록 실행 결과 묶음. 선택하지 «않은» 커머스는 키 자체가 없다. */
export type CommerceOutcomes = Partial<Record<CommerceId, CommerceOutcome>>;

/**
 * N-06-B — 이 커머스에 «마지막으로» 무슨 일이 있었나(registration_attempts).
 *
 * 🔴 이력이 «없는» 커머스는 키 자체가 없다. 없는 것을 「미등록」이라는 값으로
 * 만들지 않는다 — 화면이 키의 부재를 보고 그렇게 «말할» 뿐이다.
 */
export interface CommerceLastAttempt {
  status: "SUBMITTED" | "FAILED";
  /** ISO 시각. 화면이 사람이 읽는 꼴로 바꾼다. */
  at: string;
  /** 채널이 돌려준 상품번호. 실패했으면 없다. */
  externalProductId: string | null;
  errorCode: string | null;
}

export type CommerceLastAttempts = Partial<Record<CommerceId, CommerceLastAttempt>>;

/**
 * N-06-C(CPO 승인, 2026-09-23) — **어느 커머스의 무엇이 비었는가.**
 *
 * 🔴 `PriorityItem`(채널 검증이 이미 만든 값)을 고치지 않는다. 그 타입에는
 * 「어느 커머스의」가 없는데, 채널별 «배열» 에 담겨 있어서 배열 밖으로 나오는
 * 순간 출처를 잃는다. 그래서 화면 레이어에서 한 겹만 감싼다 — 새 판정도,
 * 새 저장소도 만들지 않는다.
 */
/**
 * Commerce-6 Phase E-3 — 세 번째 값이 늘었다: `SELLER_CENTER`.
 *
 * 🔴 «새 축» 이 아니다. 새 상태 모델을 만드는 대신 이미 있는 이 축에 한 칸을
 * 넣는다 — 지금까지 이 정보는 롯데ON 쪽 `LotteOnFixLocation` 에만 있었고 상위
 * 레이어로 올라오면서 «버려지고» 있었다.
 *
 * 왜 「입력 필요」로 뭉칠 수 없나: 출고지번호 같은 값은 셀러가 우리 화면 어디에
 * 무엇을 적어도 해결되지 않는다. 커머스 판매자센터에 먼저 등록해야 «번호가
 * 생긴다». 「입력 필요」라고 말하면 셀러는 적을 곳을 찾다가 못 찾는다.
 */
export type MissingKind = "CONFIRM" | "INPUT" | "SELLER_CENTER";

/**
 * 🔴 새 축을 만들지 않는다. `ReadinessItem.sourceStatus` 가 이미 「이 값이 어디서
 * 오는가」를 말하고 있고, 그중 `MANUAL_REQUIRED` 만이 «셀러가 직접 적어야»
 * 하는 것이다. 나머지(AUTO · SETTINGS_DEFAULT · DEFAULT_VALUE)는 채울 근거가
 * 있으니 셀러는 «맞는지 보기만» 하면 된다.
 *
 * 🔴 근거가 없으면 `undefined` 를 준다 — 가격/카테고리처럼 sourceItems 가 비어
 * 있는 항목까지 「확인」으로 싸잡아 적으면, 확인하지 않은 것을 확인했다고
 * 말하는 것이 된다.
 */
export function classifyMissing(
  sourceStatuses: readonly (string | undefined)[],
): MissingKind | undefined {
  if (sourceStatuses.length === 0) return undefined;
  if (sourceStatuses.some((s) => s === undefined)) return undefined;
  return sourceStatuses.every((s) => s === "MANUAL_REQUIRED") ? "INPUT" : "CONFIRM";
}

export function missingKindLabel(kind: MissingKind | undefined): string | null {
  if (!kind) return null;
  if (kind === "INPUT") return "입력 필요";
  /* Phase E-3 — 「판매자센터」라고 말해야 셀러가 우리 화면에서 헤매지 않는다. */
  if (kind === "SELLER_CENTER") return "판매자센터 등록 필요";
  return "확인 필요";
}

export interface CommerceMissingItem {
  commerceId: CommerceId;
  key: string;
  label: string;
  /** 그 채널 화면 안의 스크롤 목적지. 없으면 채널 화면 맨 위로 간다. */
  sectionId?: string;
  /** 설정 화면 등 «채널 밖» 으로 가야 하는 항목(sectionId 와 배타). */
  externalHref?: string;
  /** N-07-01 2차 — 「확인하면 되는 것」과 「직접 적어야 하는 것」은 셀러가 들이는
   * 품이 다르다. 근거가 없으면 «비워 둔다» — 추정해서 적지 않는다. */
  kind?: MissingKind;
}

export type CommerceMissingByChannel = Partial<Record<CommerceId, CommerceMissingItem[]>>;

/**
 * P0-CHANNEL-03 F-10 — 이 상품 × 이 채널로 «지금» 나가 있는 외부 상품.
 * 서버가 `channel_products` 에서 읽어 내려준다.
 */
export interface CommerceChannelConnection {
  externalProductId: string;
  channelProductId: string;
  status: string;
}

export type CommerceChannelConnections = Partial<Record<CommerceId, CommerceChannelConnection>>;

/**
 * 무엇을 근거로 「등록됨」이라고 말하는가. 🔴 같은 「등록됨」이라도 근거가
 * 다르면 셀러가 할 수 있는 일이 다르다 — 화면이 이 값을 보고 말을 고른다.
 */
export type RegistrationBasis =
  /** `channel_products` 의 현재 연결. 정상 경로이고 수정/재등록이 가능하다. */
  | "CHANNEL_PRODUCT"
  /** 🔴 연결은 «없는데» 성공 이력이 있다. 아래 주석 참고. */
  | "ATTEMPT_ONLY"
  /** 등록된 적 없다. */
  | "NONE";

export interface CommerceRegistrationState {
  registered: boolean;
  basis: RegistrationBasis;
  /** 아는 경우에만. 🔴 모르면 null — 지어내지 않는다. */
  externalProductId: string | null;
  /** 🔴 셀러(그리고 우리)가 들여다봐야 하는 상태인가. */
  needsAttention: boolean;
}

export interface RegistrationStateInput {
  /** 서버가 읽은 현재 연결. */
  connections: CommerceChannelConnections;
  /** 이 snapshot 이 Product 에 속해 있는가(기존 381건은 false). */
  hasProductIdentity: boolean;
  /** 🔴 «막는 쪽으로만» 쓰인다. 상태의 근거로 되돌리지 않는다. */
  lastAttempts: CommerceLastAttempts;
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-10(CTO 지시, 2026-09-25) — **등록 상태 판정을 한 곳에서.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 무엇이 바뀌었나 ───────────────────────────────────────────────────────
 * 전: 이 «snapshot» 에 SUBMITTED 이력이 있는가   → 재분석하면 초기화됐다
 * 후: 이 «상품» 이 이 채널에 나가 있는가          → 재분석해도 그대로다
 *
 * 재분석하면 새 snapshot 이 생기고, 그 snapshot 에는 이력이 없어 화면이
 * 「미등록」이라고 말했다. 셀러가 그 말을 믿고 다시 누른 결과가 SmartStore
 * 외부번호 6개다. 이제 같은 Product 를 가리키는 한 연결은 그대로 보인다.
 *
 * ── 🔴 규칙은 한 줄이다 ──────────────────────────────────────────────────
 *     연결이 있으면 그것이 답이고, 없을 때만 이력이 «막는 쪽으로만» 일한다.
 *
 * 이력은 «상태의 근거로 복귀하지 않는다»(CTO 명시). 이력이 할 수 있는 일은
 * `registered` 를 false → true 로 올리는 것뿐이고, true → false 로 내리는
 * 길이 없다. 그래서 옛 버그(이력이 없어서 「미등록」)가 되살아날 수 없다.
 *
 * ── 🔴 왜 이력을 완전히 버리지 않는가 ────────────────────────────────────
 * 연결이 없는데 성공 이력이 있는 경우가 «두 가지» 실재한다:
 *   ① 기존 381 snapshot — product_id 가 NULL 이라 연결을 «가질 수 없다».
 *      backfill 이 금지선이므로 앞으로도 생기지 않는다.
 *   ② 연결 기록 유실 — 등록은 성공했는데 ChannelProduct insert 가 실패한
 *      경우다. 라우트는 그것을 «조용히» 지나가도록 설계돼 있다(상품은 이미
 *      나갔으므로 DB 실패로 등록을 「실패」라 말하지 않는다).
 * 두 경우 모두 상품은 «마켓에 있다». 여기서 「미등록」이라고 말하면 셀러가
 * 다시 눌러 중복을 만든다 — 이번 스프린트가 고치려는 바로 그 일이다.
 *
 * ②는 정상이 아니므로 `needsAttention` 으로 «표시» 한다. ①은 예전부터의 정상
 * 상태라 표시하지 않는다. 그 둘을 가르는 것이 `hasProductIdentity` 다.
 */
export function resolveRegistrationState(
  id: CommerceId,
  input: RegistrationStateInput,
): CommerceRegistrationState {
  const connection = input.connections[id];
  if (connection) {
    return {
      registered: true,
      basis: "CHANNEL_PRODUCT",
      externalProductId: connection.externalProductId,
      needsAttention: false,
    };
  }

  const attempt = input.lastAttempts[id];
  if (attempt?.status === "SUBMITTED") {
    return {
      registered: true,
      basis: "ATTEMPT_ONLY",
      externalProductId: attempt.externalProductId,
      /* 🔴 정체성이 «있는데» 연결이 없으면 기록이 유실된 것이다 — 정상이 아니다.
         정체성이 없으면(기존 381건) 연결을 가질 수 없었던 것이라 정상이다. */
      needsAttention: input.hasProductIdentity,
    };
  }

  return { registered: false, basis: "NONE", externalProductId: null, needsAttention: false };
}

/**
 * 「이 커머스에 다시 보내지 않는다」 판정 — 화면의 단일 관문.
 *
 * 🔴 `resolveRegistrationState` 를 «거쳐서» 답한다. 여기에 규칙을 따로 쓰면
 * 판정이 두 벌이 되고, 그것이 이 스프린트 내내 고쳐 온 실수다.
 */
export function isAlreadyRegistered(input: RegistrationStateInput, id: CommerceId): boolean {
  return resolveRegistrationState(id, input).registered;
}

/**
 * 화면이 이 채널로 등록 «요청을 보내도 되는가».
 *
 * 🔴 「등록됨」과 「보내면 안 됨」은 이제 «다른 질문» 이다. 그 둘이 같았던 것이
 * F-10 이전의 상태이고, 그래서 등록된 상품은 고칠 방법이 아예 없었다.
 *
 *   CHANNEL_PRODUCT  연결을 안다 → 보내도 된다. 서버가 resolveLifecycle 로
 *                    UPDATE / RECREATE(동의) / BLOCKED 를 정한다. 중복이 생길
 *                    길은 라우트의 blocksCreate 빗장이 이미 막고 있다.
 *   🔴 ATTEMPT_ONLY  연결을 «모른다». 이 상태로 보내면 서버도 연결을 찾지 못해
 *                    CREATE 경로로 내려가고, 마켓에 이미 있는 상품이 하나 더
 *                    생긴다 — 정확히 이번 스프린트가 고치려는 사고다. 막는다.
 *   NONE             최초 등록. 보낸다.
 */
export function blocksRegistrationRequest(state: CommerceRegistrationState): boolean {
  return state.basis === "ATTEMPT_ONLY";
}

/** 화면이 그대로 쓰는 문장. 🔴 근거마다 «할 수 있는 일» 이 달라 말도 다르다. */
export function registrationBasisNote(state: CommerceRegistrationState): string | null {
  if (!state.registered) return null;
  const no = state.externalProductId ? `(${state.externalProductId})` : "";
  if (state.basis === "CHANNEL_PRODUCT") return `이 커머스에 등록돼 있습니다 ${no}`.trim();
  return state.needsAttention
    ? `등록 이력은 있으나 연결 정보를 찾지 못했습니다 ${no} — 다시 등록하면 중복이 될 수 있어 막았습니다.`.trim()
    : `이 커머스에 등록된 적이 있습니다 ${no}`.trim();
}
