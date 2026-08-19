"use client";

import { useState } from "react";
import type { ExecutionMode, KcStatus } from "@commerce/listing";
import type { ListingModel } from "@commerce/marketplace";

/** N-3.52/N-3.53(CPO 지시) — "판매 전 최종 확인" 화면에서 KC 상태별로
 * 보여줄 문구/색상을 한 곳에서만 정의한다(RegistrationReadinessCard의
 * SOURCE_STATUS_BADGE와 같은 패턴 — 판정 로직과 표시 문구가 여러 곳에
 * 흩어지면 나중에 말이 안 맞는 문제가 재발한다). */
const KC_STATUS_LABEL: Record<KcStatus, { label: string; className: string }> = {
  NOT_APPLICABLE: { label: "✓ 이 카테고리는 어린이제품 인증 대상이 아닙니다", className: "text-success" },
  CERTIFIED_REFERENCE: { label: "✓ KC 인증정보 확인됨(실제 자료 근거)", className: "text-success" },
  SELLER_REVIEW_REQUIRED: { label: "⚠ 판매 전 확인이 필요한 상품입니다", className: "text-warning" },
  BLOCKED: { label: "⚠ 카테고리가 아직 확정되지 않아 확인할 수 없습니다", className: "text-error" },
};

export function ListingConfirmationModal({
  listing,
  mode = "DRY_RUN",
  smartstoreKcStatus,
  smartstoreCategoryCode,
  snapshotId,
  jobKey,
  onCancel,
  onConfirm,
}: {
  listing: ListingModel;
  /** LIVE면 실제 쿠팡 API가 호출된다는 경고 문구와 버튼 문구를 바꾼다. */
  mode?: ExecutionMode;
  /** N-3.52(CPO 지시) — SmartStore일 때만 넘어온다(smartStoreValidation.kcStatus
   * 그대로, 여기서 다시 계산하지 않는다). undefined면 이 카드 자체를 숨긴다
   * (Coupang 등 다른 플랫폼). */
  smartstoreKcStatus?: KcStatus | null;
  smartstoreCategoryCode?: string | null;
  snapshotId?: string | null;
  /** Sprint B-1(CPO 지시) — seller_compliance_confirmations 감사 로그에도
   * 같은 Job Key를 남긴다. */
  jobKey?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isLive = mode === "LIVE";

  // N-3.52/N-3.53(CPO 지시 STEP1/4/6) — "API 등록 가능"과 "판매 가능"을
  // 분리한다. TTAEJYO가 KC를 자동으로 면제하지 않는다 — SELLER_REVIEW_REQUIRED
  // 상품은 판매자가 이 모달에서 직접 실제 자료를 확인하고 "판매 가능 여부를
  // 확인했다" 버튼을 눌러야만 그 선언이 성립한다(세션 상태일 뿐, 실제 저장은
  // 확인 버튼 클릭 시 POST로 이뤄진다). BLOCKED는 이 화면에서 우회할 수
  // 없다 — 카테고리를 먼저 확정해야 한다.
  const [generalConfirmed, setGeneralConfirmed] = useState(false);
  // N-3.58 STEP5(CPO 지시: "최종 등록 모달은 약관 동의처럼 단순하게") — 필드별
  // 체크리스트(상품명/카테고리/이미지 등)를 전부 보여주던 방식을 3개 체크박스로
  // 대체한다. 이 화면이 열리는 시점엔 이미 상위 게이트(RegistrationReadinessCard의
  // canRegister)가 그 필드들을 전부 통과시킨 뒤라 여기서 다시 나열하는 건
  // 중복이었다 — 판매자가 최종적으로 책임지고 확인하는 3가지만 남긴다.
  const [priceInfoConfirmed, setPriceInfoConfirmed] = useState(false);
  const [responsibilityConfirmed, setResponsibilityConfirmed] = useState(false);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const hasSmartstoreKcCard = smartstoreKcStatus != null;
  const kcNeedsReview = smartstoreKcStatus === "SELLER_REVIEW_REQUIRED";
  const kcBlocked = smartstoreKcStatus === "BLOCKED";
  const kcRegistrable = !hasSmartstoreKcCard || !kcBlocked && (!kcNeedsReview || reviewConfirmed);
  const canConfirm =
    generalConfirmed && priceInfoConfirmed && responsibilityConfirmed && kcRegistrable && !submitting;

  async function handleConfirmClick() {
    if (!canConfirm) return;
    if (hasSmartstoreKcCard && smartstoreCategoryCode && smartstoreKcStatus) {
      setSubmitting(true);
      setConfirmError(null);
      try {
        const res = await fetch("/api/smartstore/seller-compliance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            snapshotId: snapshotId ?? null,
            jobKey: jobKey ?? null,
            categoryCode: smartstoreCategoryCode,
            kcStatus: smartstoreKcStatus,
            confirmed: true,
          }),
        });
        if (!res.ok) {
          setConfirmError("확인 기록 저장에 실패했습니다 — 다시 시도해주세요.");
          setSubmitting(false);
          return;
        }
      } catch {
        setConfirmError("확인 기록 저장에 실패했습니다 — 네트워크를 확인해주세요.");
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
    }
    onConfirm();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-lg bg-surface p-5 shadow-elevated"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-base font-semibold tracking-tight text-text-primary">판매 전 최종 확인</h3>
        <p className="mt-1 text-xs text-text-secondary">
          이 상품을 {listing.platformLabel}에 판매 등록하기 전에 아래 내용을 확인해주세요.
        </p>
        {isLive && (
          <p className="mt-2 rounded-md bg-warning-soft px-3 py-2 text-xs font-medium text-warning">
            ⚠ 실제로 {listing.platformLabel}에 등록됩니다 — 등록 후 되돌릴 수 없으니 아래 내용을 확인해주세요.
          </p>
        )}

        {/* N-3.52(CPO 지시 STEP6) — "판매 전 최종 확인" 핵심 카드. KC를 상세페이지
            참조 토글과 명확히 분리한다(STEP5) — 여기 버튼은 KC 전용이고,
            일반 고시 필드의 "상세페이지 참조"는 PlatformPreview의 Accordion에서
            여전히 별도로 처리된다. */}
        {hasSmartstoreKcCard && smartstoreKcStatus && (
          <div className="mt-4 rounded-md border border-border bg-background p-3">
            <p className="text-xs font-medium text-text-tertiary">🛡️ KC / 안전기준 확인</p>
            <p className={`mt-1 text-sm font-medium ${KC_STATUS_LABEL[smartstoreKcStatus].className}`}>
              {KC_STATUS_LABEL[smartstoreKcStatus].label}
            </p>
            {kcBlocked && (
              <p className="mt-1 text-xs text-text-secondary">
                카테고리가 아직 확정되지 않아 TTAEJYO가 KC 대상 여부를 판단할 근거가 없습니다 — 카테고리를
                먼저 확정한 뒤 다시 시도해주세요.
              </p>
            )}
            {kcNeedsReview && !reviewConfirmed && (
              <>
                <p className="mt-1 text-xs text-text-secondary">
                  현재 인증정보: 확인되지 않음. 아래 중 실제 해당하는 항목을 확인해주세요 — TTAEJYO가 대신
                  판단하지 않습니다.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface"
                  >
                    KC 인증정보 직접 입력하기
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewConfirmed(true)}
                    className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface"
                  >
                    인증자료 확인 — 판매 가능 여부 확인 완료
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="mt-4 space-y-2">
          <label className="flex items-start gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={generalConfirmed}
              onChange={(e) => setGeneralConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span>상품의 판매 가능 여부와 필요한 인증정보를 직접 확인했습니다.</span>
          </label>
          <label className="flex items-start gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={priceInfoConfirmed}
              onChange={(e) => setPriceInfoConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span>상품 가격과 상품정보가 실제 판매 상품과 일치합니다.</span>
          </label>
          <label className="flex items-start gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={responsibilityConfirmed}
              onChange={(e) => setResponsibilityConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span>등록 후 문제가 발생할 경우 판매자가 판매중지/수정 조치를 해야 합니다.</span>
          </label>
        </div>
        {confirmError && <p className="mt-1 text-xs text-error">{confirmError}</p>}

        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-background"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={!canConfirm}
            className={`rounded-md px-4 py-1.5 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              isLive ? "bg-error hover:bg-error/90" : "bg-primary hover:bg-primary-hover"
            }`}
          >
            {submitting ? "확인 저장 중..." : isLive ? `🚀 ${listing.platformLabel} 등록 시작` : "등록 시작"}
          </button>
        </div>
      </div>
    </div>
  );
}
