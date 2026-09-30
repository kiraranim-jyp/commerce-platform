import type { ChannelNoticeOverride } from "@commerce/shared";
import { DETAIL_PAGE_REFERENCE_TEXT } from "./reference-eligibility";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * NAVER-CHANNEL-NOTICE-OVERRIDES-03 (CPO 확정 「㉡」, 2026-09-30)
 * **「이 칸에 무엇이 나가고, 그것을 «누가» 정했는가」를 한 곳에서 판정한다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 왜 필요한가 ────────────────────────────────────────────────────────────
 * `naver/build-payload.ts` 가 `packDateText`·`releaseDateText` 에 참조 문구를
 * **무조건** 박고 있었다. 셀러는 그 사실을 알 길이 없었고, 상세페이지에 그 연월이
 * 없으면 우리가 채널에 «없는 사실» 을 주장한 셈이다.
 *
 * 🔴 그런데 값을 비울 수는 없다 — 실측 기록이 있다(fixture attempt 6):
 * 「productInfoProvidedNotice.wear.packDate 가 NotEmpty 로 거부」.
 * 그래서 이 모듈이 바꾸는 것은 **payload 가 아니라 «상태»** 다.
 *
 * ── 🔴 세 상태를 «끝까지» 가른다 ───────────────────────────────────────────
 *
 *   SELLER_VALUE        셀러가 실제 연월을 적었다        → 그 값이 나간다
 *   SELLER_REFERENCED   셀러가 참조를 «골랐다»           → 참조 문구가 나간다
 *   DISCLOSED_DEFAULT   셀러가 아무것도 하지 않았다      → 참조 문구가 나간다
 *                                                        🔴 화면이 그 사실을 말한다
 *
 * 뒤의 둘은 **payload 가 같다.** 그래서 합치고 싶어지는데, 합치면 「셀러가 확인한
 * 것」과 「우리가 정한 것」이 한 값으로 뭉치고 이 작업의 목적이 사라진다.
 *
 * 🔴 `DISCLOSED_DEFAULT` 는 **저장되지 않는다 — 부재 그 자체다.** 저장하면
 * `SELLER_REFERENCED` 와 구분할 수 없다. 부재는 자동저장·재로딩에서 부재로
 * 남으므로 왕복해도 구분이 보존된다.
 *
 * 🔴 우선순위는 뒤집히지 않는다: 실제 값이 언제나 먼저다. 셀러가 적어 둔
 * 「2025-03」을 참조 문구가 덮으면 그건 값을 잃는 것이다.
 */
export type ChannelNoticeFieldState = "SELLER_VALUE" | "SELLER_REFERENCED" | "DISCLOSED_DEFAULT";

export interface ResolvedChannelNoticeField {
  /** 실제로 payload 에 나갈 문자열. 🔴 절대 빈 문자열이 되지 않는다. */
  outgoing: string;
  /** 그 값을 누가 정했는가. 화면이 이 값으로 문구를 만든다. */
  state: ChannelNoticeFieldState;
}

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

/**
 * 한 칸을 판정한다.
 *
 * @param override 이 채널의 셀러 결정(없으면 undefined — 그래도 동작한다)
 * @param key      의미 이름(`packDate` · `releaseDate`). payload 필드명이 아니다.
 *
 * 🔴 `outgoing` 이 비지 않는 것이 이 함수의 계약이다. 비면 네이버가 `NotEmpty` 로
 * 거부한다(실측). 그래서 폴백이 «항상» 참조 문구다 — 날짜를 지어내지 않는다.
 */
export function resolveChannelNoticeField(
  override: ChannelNoticeOverride | undefined,
  key: string,
): ResolvedChannelNoticeField {
  const entered = clean(override?.values?.[key]);
  /* 🔴 실제 값이 먼저다. 이 순서를 뒤집으면 셀러가 적은 연월이 사라진다. */
  if (entered) return { outgoing: entered, state: "SELLER_VALUE" };

  if (override?.referenced?.includes(key)) {
    return { outgoing: DETAIL_PAGE_REFERENCE_TEXT, state: "SELLER_REFERENCED" };
  }

  /* 🔴 셀러가 «아무것도 하지 않은» 상태. payload 는 기존과 같고(회귀 0),
     달라지는 것은 화면이 이 사실을 숨기지 않는다는 점이다. */
  return { outgoing: DETAIL_PAGE_REFERENCE_TEXT, state: "DISCLOSED_DEFAULT" };
}

/** 셀러가 이 칸을 직접 정했는가 — 화면이 「기본값으로 나갑니다」를 붙일지 가른다. */
export function isSellerDecidedNoticeState(state: ChannelNoticeFieldState): boolean {
  return state !== "DISCLOSED_DEFAULT";
}

/* ══ 의미 키 ═══════════════════════════════════════════════════════════════
   🔴 payload 필드명(`packDateText`/`releaseDateText`)을 키로 쓰지 않는다.
   저장 구조가 채널 payload 를 알면, 네이버가 필드 이름을 바꾸는 날 저장된
   셀러 입력이 고아가 된다. */

/** WEAR 고시 「제조연월」. 🔴 생략 시 `NotEmpty` 거부가 실측됐다. */
export const NOTICE_KEY_PACK_DATE = "packDate";
/** KIDS 고시 「동일모델의 출시연월」. 🔴 필수 여부는 UNKNOWN 이다(증거 없음). */
export const NOTICE_KEY_RELEASE_DATE = "releaseDate";

/**
 * 🔴 이 칸이 네이버에서 «필수임이 확인됐는가».
 *
 * `true`  실제 거부 기록이 있다(fixture attempt 6 `packDate` NotEmpty)
 * `false` **「선택」이 아니라 「모른다」** 다 — 빼고 등록해 본 적이 없다.
 *         화면은 이것을 「선택 항목」으로 말하지 않는다.
 */
export const NAVER_NOTICE_REQUIRED_CONFIRMED: Record<string, boolean> = {
  [NOTICE_KEY_PACK_DATE]: true,
  [NOTICE_KEY_RELEASE_DATE]: false,
};
