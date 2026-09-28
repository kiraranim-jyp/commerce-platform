import type { CommonConfirmation, CommonConfirmationScope } from "./common-field";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 기존 «확인 기록» 을 Common 모양으로 **읽는다** — 새 저장소를 만들지 않는다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 🔴 이 파일이 생긴 경위 ────────────────────────────────────────────────
 * 나는 「판매자 확인을 저장할 자리가 없으니 DB 를 바꿔야 한다」고 보고했다.
 * **틀렸다.** 기존 저장 경로를 먼저 보라는 지적을 받고 다시 찾아보니 둘 다
 * 이미 있었다 —
 *
 *     migration 024  seller_compliance_confirmations
 *     product-types  smartStoreKcDeclaration  (판매자 «선언», jsonb 안)
 *
 * ── 🔴 왜 «읽기» 만 하는가 (KC-03) ────────────────────────────────────────
 * 그 테이블을 Common 저장 모델로 재정의할 수 없다. `kc_status` 가
 * `NOT NULL` 이고 CHECK 가 **네이버 어휘 네 값**에 묶여 있어서, 다른 채널의
 * 확인을 쓰려면 네이버 상태값을 «지어내야» 한다. CHECK 를 넓히는 것은
 * migration 이다.
 *
 * 그래서 저장은 **채널이 계속 자기 방식으로** 하고, Common 은 **읽을 때만**
 * 한 모양으로 본다. migration 0 제약 안에서 성립하는 유일한 형태다.
 *
 * ── 🔴 `kcStatus` 를 Common 상태로 «바꾸지 않는다» ────────────────────────
 * `kc_status` 는 스마트스토어 어휘이고, 게이트도 그것을 보지 않는다
 * (`register/route.ts:421` 은 confirmed·policyVersion·categoryCode 셋만 본다.
 * `kcStatus` 는 로그와 결과 메타에만 나온다). 감사 기록이지 판정 입력이 아니다.
 * 여기서 Common 상태로 승격시키면 없던 의미가 생긴다.
 */

/** `seller_compliance_confirmations` 한 줄 중 우리가 읽는 부분. */
export interface StoredComplianceConfirmation {
  confirmed: boolean;
  policyVersion: string;
  confirmedAt: string;
  /** 어느 채널에서 확인했는가. 🔴 «범위» 라서 빠뜨리면 뜻이 달라진다. */
  platform: string;
  /** 🔴 «그 채널의» 카테고리 번호. `platform` 과 쌍으로만 뜻을 갖는다. */
  categoryCode: string;
}

/**
 * 저장된 기록 → Common 확인. **지금 범위에 대한 확인일 때만** 돌려준다.
 *
 * 🔴 판정 규칙을 새로 만들지 않았다. 스마트스토어 등록 게이트가 이미 이렇게
 * 한다(`smartstore/register/route.ts:421`) —
 *
 *     confirmed === true
 *     && policyVersion === 지금 정책
 *     && categoryCode  === 지금 카테고리
 *
 * 여기에 `platform` 이 하나 더 붙는다. 스마트스토어는 테이블을 채널로 나눠
 * 쓰지 않아 그 비교가 필요 없었지만, Common 으로 읽는 순간 필요해진다 —
 * 다른 채널의 확인을 이 채널의 확인으로 읽으면 안 된다.
 *
 * 🔴 `confirmed === false` 는 **확인이 아니다.** 행이 있다는 것과 확인했다는
 * 것은 다른 사실이고, 섞으면 「확인하지 않은 것을 확인했다」고 말하게 된다.
 */
export function toCommonConfirmation(
  stored: StoredComplianceConfirmation | null | undefined,
  scope: CommonConfirmationScope,
): CommonConfirmation | null {
  if (!stored?.confirmed) return null;

  const policyVersion = stored.policyVersion?.trim();
  const confirmedAt = stored.confirmedAt?.trim();
  const platform = stored.platform?.trim();
  const categoryCode = stored.categoryCode?.trim();
  /* 어느 한 칸이라도 비면 «어느 것에 대한 확인인지» 를 말할 수 없다. */
  if (!policyVersion || !confirmedAt || !platform || !categoryCode) return null;

  /* ── 범위가 다르면 «같은 확인이 아니다» ───────────────────────────────── */
  if (platform !== scope.platform.trim()) return null;
  if (categoryCode !== scope.categoryCode.trim()) return null;
  /* 정책이 바뀌면 과거의 확인을 영구히 신뢰하지 않는다(COMPLIANCE_POLICY_VERSION
     주석의 규칙 그대로). 🔴 그 버전의 주인은 «채널» 이다 — 전역 하나로 두면
     한 채널의 정책 변경이 다른 채널의 확인까지 무효로 만든다. */
  if (policyVersion !== scope.policyVersion.trim()) return null;

  return { confirmed: true, confirmedAt, policyVersion, platform, categoryCode };
}
