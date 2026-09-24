import type { SmartStoreKcDeclaration } from "@commerce/shared";
import type { NaverCertificationTargetExcludeContent } from "./types";

export type { SmartStoreKcDeclaration };

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-KC-11(CPO 확정, 2026-09-24) — **판매자가 네이버에 «신고»하는 인증 대상 축**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 왜 필요한가 ───────────────────────────────────────────────────────────
 * 스마트스토어 화면에는 「어린이제품 인증대상 / 대상 아님」과 「KC인증 있음 /
 * 없음(+사유)」이 «별도 축» 으로 있는데, 따져에는 그 축이 하나도 없었다.
 * 그래서 실제 인증서가 없는 판매자는 빠져나갈 길이 없었고 — 결국 아무 값이나
 * 넣었다. 「12313ㄹㅇ」이 실제 어린이제품에 붙은 뿌리가 여기다.
 *
 *   정직한 판매자는 막히고, 아무 값이나 넣은 판매자는 통과했다.
 *   출구가 없으면 시스템은 거짓말을 보상한다.
 *
 * ── 🔴 여기서 «판정하지» 않는다 ───────────────────────────────────────────
 * 이 모듈은 판매자가 «고른 것» 을 네이버 필드로 옮겨 적기만 한다. 어떤
 * 상품이 KC 대상인지, 면제인지는 법적 판단이고 따져가 내리지 않는다.
 * 그래서 입력이 없으면 `undefined` 를 내고, 억지로 기본값을 만들지 않는다.
 *
 * ── 🔴 두 축을 «자동 결합하지» 않는다 ─────────────────────────────────────
 * 「어린이제품 대상 아님」이 「KC 대상 아님」을 뜻하지 않는다. 네이버가 두
 * 필드를 따로 둔 이유가 그것이다. 한쪽을 골랐다고 다른 쪽을 대신 정하지 않는다.
 *
 * ── KcStatus 와 다른 것 ───────────────────────────────────────────────────
 *   KcStatus                  따져가 «아는» 준비 상태(4-state, 카테고리+입력값)
 *   SmartStoreKcDeclaration   판매자가 «선언하는» 대상/제외 — 이 파일
 * 섞지 않는다. `SELLER_REVIEW_REQUIRED` 라고 해서 자동으로 「대상 아님」이
 * 되지 않는다.
 */

/* 🔴 선언 «타입» 은 packages/shared 의 CanonicalProduct 옆에 하나만 둔다
   (COMMERCE_BINDING 군). 여기서 다시 정의하면 두 벌이 되어 갈라진다.
   이 파일이 갖는 것은 «규칙» 이다 — 조합 검사와 payload 변환. */
export type ChildCertificationChoice = NonNullable<SmartStoreKcDeclaration["child"]>;
export type KcCertificationChoice = NonNullable<SmartStoreKcDeclaration["kc"]>;
export type KcExemptionReason = NonNullable<SmartStoreKcDeclaration["exemptionReason"]>;

/** 이 카테고리가 무엇을 요구하는지 — 네이버 카테고리 API 가 알려준 사실. */
export interface KcDeclarationCapability {
  /** 어린이제품 인증 대상 카테고리인가(exceptionalCategories 에 CHILD_CERTIFICATION). */
  childCertificationRequired: boolean;
}

export type KcDeclarationProblem =
  | "KC_EXEMPTION_REASON_MISSING"
  | "KC_EXEMPTION_REASON_NOT_ALLOWED"
  | "CHILD_CHOICE_MISSING";

/**
 * 선언이 «그 자체로» 앞뒤가 맞는지. 🔴 법적 타당성이 아니라 «조합의 완결성» 만
 * 본다 — 네이버가 받아 줄 모양인지의 문제다.
 */
export function validateKcDeclaration(
  declaration: SmartStoreKcDeclaration | undefined,
  capability: KcDeclarationCapability,
): KcDeclarationProblem[] {
  const problems: KcDeclarationProblem[] = [];
  const d = declaration ?? {};

  /* 🔴 어린이제품 대상 카테고리에서는 이 축이 «필수» 다(공식 스키마).
     고르지 않은 것을 따져가 대신 고르지 않는다 — 문제로 보고할 뿐이다. */
  if (capability.childCertificationRequired && d.child === undefined) {
    problems.push("CHILD_CHOICE_MISSING");
  }

  if (d.kc === "EXEMPTION" && d.exemptionReason === undefined) {
    // 면제라고만 하고 사유가 없으면 네이버가 받을 수 없는 반쪽 신고다.
    problems.push("KC_EXEMPTION_REASON_MISSING");
  }
  if (d.kc !== "EXEMPTION" && d.exemptionReason !== undefined) {
    /* 🔴 「대상 아님」인데 면제 사유를 같이 보내지 않는다. 두 주장이 겹치면
       어느 쪽으로 신고한 것인지 알 수 없게 된다. */
    problems.push("KC_EXEMPTION_REASON_NOT_ALLOWED");
  }
  return problems;
}

/**
 * 선언 → `detailAttribute.certificationTargetExcludeContent`.
 *
 * 🔴 «의미 없는 필드는 보내지 않는다.» 고르지 않은 축, 그리고 EXEMPTION 이
 * 아닐 때의 면제 사유는 키 자체를 만들지 않는다.
 *
 * 🔴 조합이 깨져 있으면 `undefined` 를 낸다 — 반쪽 신고를 네이버로 보내지
 * 않는다. 무엇이 부족한지는 validateKcDeclaration() 이 말한다.
 */
export function buildCertificationTargetExcludeContent(
  declaration: SmartStoreKcDeclaration | undefined,
  capability: KcDeclarationCapability,
): NaverCertificationTargetExcludeContent | undefined {
  if (!declaration) return undefined;
  if (validateKcDeclaration(declaration, capability).length > 0) return undefined;

  const out: NaverCertificationTargetExcludeContent = {};
  if (declaration.child !== undefined) {
    out.childCertifiedProductExclusionYn = declaration.child === "EXCLUDED";
  }
  if (declaration.kc !== undefined) {
    out.kcCertifiedProductExclusionYn =
      declaration.kc === "EXCLUDED" ? "TRUE" : declaration.kc === "TARGET" ? "FALSE" : "KC_EXEMPTION_OBJECT";
  }
  if (declaration.kc === "EXEMPTION" && declaration.exemptionReason !== undefined) {
    out.kcExemptionType = declaration.exemptionReason;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * 실제 인증정보(번호·업체·기관·일자)를 «요구해야 하는가».
 *
 * 지금까지는 「어린이제품 카테고리면 무조건 요구」였다. 그래서 대상이 아닌
 * 상품까지 값을 채우도록 몰렸다. 이제 판매자의 선언을 함께 본다:
 *
 *   카테고리 요구  +  판매자 선언  →  인증정보가 필요한가
 *
 * 🔴 선언이 «없으면» 예전과 똑같이 요구한다. 없는 것을 「대상 아님」으로
 * 읽지 않는다 — 확인하지 않은 것을 확인했다고 말하는 것이 된다.
 */
export function requiresChildCertificationData(
  declaration: SmartStoreKcDeclaration | undefined,
  capability: KcDeclarationCapability,
): boolean {
  if (!capability.childCertificationRequired) return false;
  return declaration?.child !== "EXCLUDED";
}
