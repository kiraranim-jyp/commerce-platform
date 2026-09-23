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
