import type { CommonConfirmation } from "./common-field";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 기존 «확인 기록» 을 Common 모양으로 읽는다 — **새로 만들지 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 🔴 이 파일이 생긴 경위 ────────────────────────────────────────────────
 * 나는 「판매자 확인을 저장할 자리가 없으니 DB 를 바꿔야 한다」고 보고했다.
 * **틀렸다.** 기존 저장 경로를 먼저 보라는 지적을 받고 다시 찾아보니 둘 다
 * 이미 있었다 —
 *
 *     migration 024  seller_compliance_confirmations
 *                    snapshot_id · platform · category_code · kc_status ·
 *                    confirmed · policy_version · confirmed_at
 *     product-types  smartStoreKcDeclaration  (판매자 «선언», jsonb 안)
 *
 * 그래서 이 파일은 **읽는 어댑터일 뿐** 이다. 쓰지 않고, 스키마를 바꾸지 않고,
 * backfill 하지 않는다.
 *
 * ── 🔴 기존 것을 지우지 않는 이유 ─────────────────────────────────────────
 * `smartStoreKcDeclaration` 은 이름이 채널에 묶여 있어서(같은 KC 사실을 채널마다
 * 다시 선언하게 만든다) Common 관점에서는 옳지 않다. 그러나 **이미 저장된
 * 선언이 있다.** 지우면 판매자가 확인한 기록이 사라진다 — 읽기 호환으로 남긴다.
 */

/** `seller_compliance_confirmations` 한 줄 중 우리가 읽는 부분. */
export interface StoredComplianceConfirmation {
  confirmed: boolean;
  policyVersion: string;
  confirmedAt: string;
  /** 어느 채널에서 확인했는가. 🔴 기록을 버리지 않는다 — 감사 로그 목적이다. */
  platform?: string;
}

/**
 * 저장된 기록 → Common 확인.
 *
 * 🔴 `confirmed === false` 는 **확인이 아니다.** 행이 있다는 것과 확인했다는
 * 것은 다른 사실이고, 섞으면 「확인하지 않은 것을 확인했다」고 말하게 된다.
 *
 * 🔴 `currentPolicyVersion` 을 주면 «지금 정책 기준으로» 판정한다. 정책이
 * 바뀌면 과거의 확인을 영구히 신뢰하지 않는다는 규칙은 이미 있다
 * (`naver/compliance.ts` 의 `COMPLIANCE_POLICY_VERSION` 주석).
 */
export function toCommonConfirmation(
  stored: StoredComplianceConfirmation | null | undefined,
  currentPolicyVersion?: string,
): CommonConfirmation | null {
  if (!stored?.confirmed) return null;
  const policyVersion = stored.policyVersion?.trim();
  const confirmedAt = stored.confirmedAt?.trim();
  if (!policyVersion || !confirmedAt) return null;
  /* 정책이 바뀌었으면 다시 확인해야 한다. */
  if (currentPolicyVersion && policyVersion !== currentPolicyVersion) return null;
  return { confirmedAt, policyVersion };
}
