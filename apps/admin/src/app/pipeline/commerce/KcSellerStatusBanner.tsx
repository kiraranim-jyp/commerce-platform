"use client";

import { COMPLIANCE_RULES, type KcStatus } from "@commerce/listing";

/**
 * N-3.57 STEP1(CPO 지시: "KC 4-State를 Seller가 이해할 수 있는 언어로
 * 전환한다 — NOT_APPLICABLE/CERTIFIED_REFERENCE/SELLER_REVIEW_REQUIRED/
 * BLOCKED를 그대로 노출하지 않는다") — 판정 로직(resolveKcStatus,
 * packages/listing/src/naver/compliance.ts)은 그대로 두고, 이 컴포넌트는
 * 이미 계산된 kcStatus 값을 CPO가 지정한 4개 문구 블록으로 옮겨 보여주기만
 * 한다. 문구/버튼 텍스트는 작업지시서에 적힌 그대로 사용한다 — 여기서 새
 * 법률 판단이나 문구를 지어내지 않는다.
 *
 * N-3.59(CPO 지시: "왜 확인이 필요한지 / 어떤 인증·법적 정보를 확인해야
 * 하는지 / 확인 후 어떤 상태로 바뀌는지") — SELLER_REVIEW_REQUIRED에
 * COMPLIANCE_RULES.KIDS.evidenceTypes(N-3.52가 이미 정의해둔, "판매자가 실제로
 * 제시할 수 있는 근거 유형" 목록)를 그대로 붙인다. kcStatus가
 * SELLER_REVIEW_REQUIRED로 나온다는 것 자체가 이미 categoryRequiresChildCertification
 * =true(=KIDS 그룹)일 때만 가능하다는 뜻이라(resolveKcStatus 참고 — WEAR는
 * 항상 NOT_APPLICABLE로 빠진다), 여기서 그룹을 다시 계산하지 않고 KIDS
 * 항목을 그대로 쓴다 — 새 카테고리 판정을 만들지 않는다.
 */
export function KcSellerStatusBanner({
  kcStatus,
  childCertification,
  onFinalConfirm,
  onConfirmSellable,
  onEnterKcInfo,
  onGoToCategory,
}: {
  kcStatus: KcStatus;
  /** N-3.59 — CERTIFIED_REFERENCE일 때 실제 값을 보여주기 위함(N-3.57에서는
   * 문구만 있고 실제 근거를 안 보여줘서 "뭘 근거로 통과했는지" 알 수 없었다).
   * TTAEJYO가 값을 지어내는 게 아니라 사용자가 이미 입력해둔 값을 그대로
   * 보여주기만 한다(resolveKcStatus와 같은 CanonicalProduct.childCertification). */
  childCertification?: { certificationNumber?: string; companyName?: string; certificationDate?: string } | null;
  /** ①②: "판매 전 최종 확인" — 새 확인 UI를 만들지 않고 기존
   * ListingConfirmationModal(N-3.52가 이미 만든 KC 확인 체크박스 화면)을 그대로 연다. */
  onFinalConfirm: () => void;
  /** ③: "판매 가능 상품으로 확인" — 같은 이유로 같은 모달을 연다(그 모달
   * 안에 이미 SELLER_REVIEW_REQUIRED용 체크박스가 있다). */
  onConfirmSellable: () => void;
  /** ③: "KC 정보 직접 입력하기" — 이 섹션 안의 기존 KcCertificationBlock
   * 입력 필드로 스크롤만 한다(새 입력 UI 아님). */
  onEnterKcInfo: () => void;
  /** ④: BLOCKED(카테고리 미확정)일 때 카테고리 섹션으로 이동 — 이미 있는
   * goToSection 메커니즘을 그대로 쓴다. */
  onGoToCategory?: () => void;
}) {
  if (kcStatus === "NOT_APPLICABLE") {
    return (
      <div className="rounded-md border border-success/30 bg-success-soft p-3">
        <p className="text-sm font-semibold text-success">🟢 KC 인증 대상 아님</p>
        <p className="mt-1 text-xs text-text-secondary">
          현재 선택한 카테고리는 어린이제품 인증 대상이 아닌 것으로 판단됩니다.
        </p>
        <button
          type="button"
          onClick={onFinalConfirm}
          className="mt-2 rounded border border-primary px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
        >
          판매 전 최종 확인
        </button>
      </div>
    );
  }

  if (kcStatus === "CERTIFIED_REFERENCE") {
    return (
      <div className="rounded-md border border-success/30 bg-success-soft p-3">
        <p className="text-sm font-semibold text-success">🟢 인증정보 확인 필요 없음</p>
        <p className="mt-1 text-xs text-text-secondary">
          원본 상품 상세정보에 국내 판매를 위한 인증 관련 정보가 확인됩니다.
        </p>
        {childCertification && (
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 rounded bg-surface px-2 py-1.5 text-xs">
            <dt className="text-text-tertiary">인증번호</dt>
            <dd className="text-text-primary">{childCertification.certificationNumber || "—"}</dd>
            <dt className="text-text-tertiary">업체명</dt>
            <dd className="text-text-primary">{childCertification.companyName || "—"}</dd>
            <dt className="text-text-tertiary">취득일자</dt>
            <dd className="text-text-primary">{childCertification.certificationDate || "—"}</dd>
          </dl>
        )}
        <p className="mt-1 text-xs font-medium text-warning">
          ⚠️ 실제 판매에 사용할 인증정보가 맞는지 최종 확인해주세요.
        </p>
        <button
          type="button"
          onClick={onFinalConfirm}
          className="mt-2 rounded border border-primary px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
        >
          판매 전 최종 확인
        </button>
      </div>
    );
  }

  if (kcStatus === "SELLER_REVIEW_REQUIRED") {
    const evidenceTypes = COMPLIANCE_RULES.KIDS.evidenceTypes;
    return (
      <div className="rounded-md border border-warning/30 bg-warning-soft p-3">
        <p className="text-sm font-semibold text-warning">🟠 판매 가능 여부를 확인해주세요</p>
        <p className="mt-1 text-xs text-text-secondary">
          이 상품은 어린이제품 등 관련 법령에 따라 인증 또는 신고 대상일 수 있습니다. 상품의 실제
          인증 여부를 판매자가 직접 확인해주세요.
        </p>
        {evidenceTypes.length > 0 && (
          <p className="mt-1.5 text-xs text-text-secondary">
            <span className="font-medium text-text-primary">확인할 정보: </span>
            {evidenceTypes.join(" · ")}
          </p>
        )}
        <p className="mt-1 text-xs text-text-secondary">
          <span className="font-medium text-text-primary">어디서: </span>
          원본 상품 상세페이지 또는 판매자가 실제 보유한 인증자료
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          <span className="font-medium text-text-primary">확인 후: </span>
          &ldquo;판매 가능 상품으로 확인&rdquo;을 누르면 이 상품의 등록을 계속 진행할 수 있습니다.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onConfirmSellable}
            className="rounded border border-primary px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
          >
            판매 가능 상품으로 확인
          </button>
          <button
            type="button"
            onClick={onEnterKcInfo}
            className="rounded border border-border px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface"
          >
            KC 정보 직접 입력하기
          </button>
        </div>
      </div>
    );
  }

  // BLOCKED
  return (
    <div className="rounded-md border border-error/30 bg-error-soft p-3">
      <p className="text-sm font-semibold text-error">🔴 현재 등록할 수 없습니다</p>
      <p className="mt-1 text-xs text-text-secondary">
        카테고리가 아직 확정되지 않아 KC 확인이 필요한 상품인지조차 판단할 수 없습니다. 카테고리를
        먼저 확정한 뒤 다시 확인해주세요.
      </p>
      {onGoToCategory && (
        <button
          type="button"
          onClick={onGoToCategory}
          className="mt-2 rounded border border-border px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface"
        >
          카테고리 확인하러 가기
        </button>
      )}
    </div>
  );
}
