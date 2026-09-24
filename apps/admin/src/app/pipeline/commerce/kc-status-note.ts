import type { KcStatus } from "@commerce/listing";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * N-07-01 2차(CEO 확정, 2026-09-24) — **③ 등록 준비의 KC 한 줄.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 왜 필요한가 ───────────────────────────────────────────────────────────
 * KC 상태는 지금까지 **스마트스토어 탭을 열어야만** 보였다(KcSellerStatusBanner).
 * 그래서 ③ 등록 준비에서 「무엇을 확인해야 하는가」를 읽던 셀러는 KC 가 걸려
 * 있다는 사실을 ④ 최종 확인 모달에서야 처음 만났다.
 *
 * ── 🔴 여기서 판정하지 않는다 ─────────────────────────────────────────────
 * `resolveKcStatus()`(packages/listing)가 이미 낸 4-state 를 «한 줄로 옮겨
 * 적을 뿐» 이다. 새 상태 모델을 만들지 않는다(CEO 확정) — 만드는 순간
 * `KcStatus` 와 두 벌이 되어 두 화면이 다른 말을 하게 된다.
 *
 * 긴 설명·근거·버튼 묶음은 탭 안의 `KcSellerStatusBanner` 가 계속 담당한다.
 * 이 파일은 목록 한 줄에 들어갈 «짧은 사실» 만 만든다.
 *
 * ── 🔴 null 은 「해당 없음」이 아니다 ─────────────────────────────────────
 * 탭을 아직 열지 않아 판정이 «없는» 상태다. 그것을 「대상 아님」으로 적으면
 * 확인하지 않은 것을 확인했다고 말하는 것이 된다.
 */

export type KcNoteTone = "OK" | "ATTENTION" | "UNKNOWN";

export interface KcStatusNote {
  tone: KcNoteTone;
  /** 목록 한 줄에 그대로 찍히는 글자. */
  text: string;
  /** 셀러가 지금 할 수 있는 행동이 있으면 그 버튼 이름. 없으면 undefined. */
  actionLabel?: string;
}

/**
 * 🔴 상태 이름을 임의로 재해석하지 않는다. 각 값의 뜻은 `resolveKcStatus()` 의
 * 주석에 적힌 그대로다:
 *
 *   NOT_APPLICABLE        카테고리가 어린이제품 인증을 요구하지 않는다
 *   CERTIFIED_REFERENCE   요구하고, 인증정보 세 값이 이미 채워져 있다
 *   SELLER_REVIEW_REQUIRED 요구하는데 인증정보가 없다 — 판매자 판단이 필요하다
 *   BLOCKED               카테고리가 확정되지 않아 «판단 자체가» 불가능하다
 */
export function kcStatusNote(status: KcStatus | null | undefined): KcStatusNote {
  if (!status) {
    return { tone: "UNKNOWN", text: "KC 인증 · 확인 전", actionLabel: "확인하기" };
  }
  switch (status) {
    case "NOT_APPLICABLE":
      return { tone: "OK", text: "KC 인증 · 해당 없음" };
    case "CERTIFIED_REFERENCE":
      return { tone: "OK", text: "KC 인증 · 인증정보 확인됨" };
    case "SELLER_REVIEW_REQUIRED":
      /* 🔴 「입력 필요」가 아니라 「판매자 확인 필요」다. 값을 채우는 것만이
         답이 아니고, 「이 상품은 인증 대상이 아니다」라는 판단도 답이다 —
         그 판단은 TTAEJYO 가 대신할 수 없다(AI 판단 ≠ 법적 확정). */
      return { tone: "ATTENTION", text: "KC 인증 · 판매자 확인 필요", actionLabel: "확인하기" };
    case "BLOCKED":
      /* 카테고리를 먼저 확정해야 KC 대상 여부를 «물어볼 수» 있다. */
      return { tone: "ATTENTION", text: "KC 인증 · 카테고리 확정 후 확인", actionLabel: "확인하기" };
  }
}

/** 이 상태가 셀러의 행동을 기다리고 있는가(③ 목록에서 ⚠ 로 셀지 판단). */
export function kcNeedsAction(status: KcStatus | null | undefined): boolean {
  return kcStatusNote(status).tone === "ATTENTION";
}
