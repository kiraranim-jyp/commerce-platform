"use client";

import { useState } from "react";
import type { ExecutionMode, KcStatus } from "@commerce/listing";
import type { ListingModel } from "@commerce/marketplace";
import { formatKrw } from "@commerce/pricing";

/** P-4-H1-2-2 STEP 6(대표님 지시: "판매자가 실제로 등록될 가격을 이 화면에서
 * 볼 수 있어야 한다") — listing.priceSource를 그대로 문구로 옮긴다. 새 판정을
 * 만들지 않는다(어댑터가 이미 정한 값을 표시만 한다). 경고 톤이 아니라
 * 정보 전달 톤으로 — SYSTEM_SUGGESTED가 잘못된 게 아니라 정상적인 자동계산
 * 결과라는 걸 분명히 한다. */
const PRICE_SOURCE_LABEL: Record<ListingModel["priceSource"], string> = {
  SELLER_OVERRIDE: "직접 설정한 최종 판매가격입니다.",
  SYSTEM_SUGGESTED: "가격 계산에서 자동 산출된 권장 판매가격입니다(직접 확정한 값 아님).",
  UNRESOLVED: "판매가격을 계산할 수 없습니다.",
};

/** N-3.52/N-3.53(CPO 지시) — "판매 전 최종 확인" 화면에서 KC 상태별로
 * 보여줄 문구/색상을 한 곳에서만 정의한다(RegistrationReadinessCard의
 * SOURCE_STATUS_BADGE와 같은 패턴 — 판정 로직과 표시 문구가 여러 곳에
 * 흩어지면 나중에 말이 안 맞는 문제가 재발한다). */
const KC_STATUS_LABEL: Record<KcStatus, { label: string; className: string }> = {
  NOT_APPLICABLE: { label: "✓ 이 카테고리는 어린이제품 인증 대상이 아닙니다", className: "text-success" },
  /* 🔴 P0-KC-SAFETY(2026-09-24) — 전에는 「✓ KC 인증정보 확인됨(실제 자료 근거)」
     이었다. 따져는 «실제 자료» 를 본 적이 없다. 이 상태의 근거는 세 칸이
     비어 있지 않다는 것 하나뿐이고(resolveKcStatus), 그것을 「확인됨」이라
     적는 순간 따져가 규제 판단을 한 것처럼 말하게 된다. */
  CERTIFIED_REFERENCE: { label: "⚠ 입력된 KC 인증정보를 확인해주세요", className: "text-warning" },
  SELLER_REVIEW_REQUIRED: { label: "⚠ 판매 전 확인이 필요한 상품입니다", className: "text-warning" },
  BLOCKED: { label: "⚠ 카테고리가 아직 확정되지 않아 확인할 수 없습니다", className: "text-error" },
};

/**
 * REWORK-5 ⑤(CEO 지시, 2026-09-14) — **등록 진행 단계.**
 *
 * 이 모달은 [등록 시작]을 누른 순간 닫히고, 화면 어딘가의 상태 배지가 조용히
 * 바뀌는 것이 전부였다. 셀러 입장에서는 "눌렀는데 아무 일도 안 일어났다"와
 * 구분되지 않는다 — 실제로 등록은 네트워크 왕복 두 번(연결 확인 → 전송)이라
 * 몇 초가 걸린다. 그래서 **같은 모달 안에서** 어디까지 갔는지 보여준다.
 *
 * 🔴 단계를 새로 만든 것이 아니라 **이미 일어나던 일에 이름을 붙인 것**이다:
 *   PREPARING  등록 직전 연결/중복 확인 + payload 준비
 *   SENDING    LISTING_EXECUTORS[platform].execute() 왕복 중
 *   CONFIRMING 돌아온 결과를 기록하는 중
 * 등록 경로(어떤 API를 어떤 인자로 부르는가)는 한 줄도 바뀌지 않는다.
 */
export type ListingProgressStep = "PREPARING" | "SENDING" | "CONFIRMING";

const PROGRESS_ORDER: ListingProgressStep[] = ["PREPARING", "SENDING", "CONFIRMING"];

export function ListingConfirmationModal({
  listing,
  mode = "DRY_RUN",
  smartstoreKcStatus,
  smartstoreCategoryCode,
  smartstoreChildCertification,
  coupangKcNotices,
  snapshotId,
  jobKey,
  progress = null,
  onCancel,
  onConfirm,
}: {
  /**
   * REWORK-7 ⑤(CEO 지시, 2026-09-15) — 롯데ON은 PlatformId가 아니라서
   * ListingModel을 만들 수 없다(그 타입은 marketplace 어댑터가 만든다).
   * 이 모달이 실제로 읽는 네 칸만 요구한다 — 그래야 **세 채널이 같은
   * 컴포넌트**를 쓸 수 있다. ListingModel은 이 네 칸을 전부 갖고 있으므로
   * 스마트스토어·쿠팡 호출부는 한 글자도 바뀌지 않는다.
   */
  listing: Pick<ListingModel, "platformLabel" | "title" | "priceKrw" | "priceSource">;
  /** LIVE면 실제 API가 호출된다는 경고 문구와 버튼 문구를 바꾼다. */
  mode?: ExecutionMode;
  /** null이면 확인 화면, 그 외에는 같은 모달이 진행 화면으로 바뀐다. */
  progress?: ListingProgressStep | null;
  /** N-3.52(CPO 지시) — SmartStore일 때만 넘어온다(smartStoreValidation.kcStatus
   * 그대로, 여기서 다시 계산하지 않는다). undefined면 이 카드 자체를 숨긴다
   * (Coupang 등 다른 플랫폼). */
  smartstoreKcStatus?: KcStatus | null;
  smartstoreCategoryCode?: string | null;
  /**
   * P0-KC-03 — 쿠팡 KC 관련 고시 칸에 «지금 등록될» 문장. 따져가 대신 넣은
   * 것이면 autoFilled=true. 🔴 표시 전용이다 — payload 는 이 값을 여기서
   * 읽지 않고, 빌더가 등록 시점에 같은 규칙으로 다시 만든다.
   */
  coupangKcNotices?: { fieldName: string; value: string; autoFilled: boolean }[];
  /** P0-KC-SAFETY — 판매자가 «무엇을» 보증하는지 보여주기 위한 표시 전용 값. */
  smartstoreChildCertification?: {
    name?: string; companyName?: string; certificationNumber?: string; certificationDate?: string;
  } | null;
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
  const [coupangNoticeConfirmed, setCoupangNoticeConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const hasSmartstoreKcCard = smartstoreKcStatus != null;
  /* 🔴 P0-KC-SAFETY — 전에는 SELLER_REVIEW_REQUIRED 만 확인을 받았다. 그래서
     KC 칸을 «채우기만» 하면 확인 절차가 사라졌다 — 인센티브가 거꾸로였다.
     아무 글자나 넣은 상품이 빈 상품보다 쉽게 나갔고, 실제로 그렇게 나갔다.
     두 상태 모두 판매자의 명시적 확인을 받는다. 새 상태를 만들지 않는다. */
  const kcNeedsReview =
    smartstoreKcStatus === "SELLER_REVIEW_REQUIRED" || smartstoreKcStatus === "CERTIFIED_REFERENCE";
  const kcHasEnteredCertification = smartstoreKcStatus === "CERTIFIED_REFERENCE";

  /* P0-KC-03 — 따져가 «대신 적은» 쿠팡 고시 문장이 있으면 판매자가 그것을
     보고 확인해야 한다. 사람이 직접 넣은 값(autoFilled=false)은 이미 판매자의
     문장이므로 다시 묻지 않는다. */
  const autoFilledCoupangNotices = (coupangKcNotices ?? []).filter((n) => n.autoFilled);
  const coupangNoticeNeedsReview = autoFilledCoupangNotices.length > 0;
  const kcBlocked = smartstoreKcStatus === "BLOCKED";
  const kcRegistrable = !hasSmartstoreKcCard || !kcBlocked && (!kcNeedsReview || reviewConfirmed);
  const coupangNoticeRegistrable = !coupangNoticeNeedsReview || coupangNoticeConfirmed;
  const canConfirm =
    generalConfirmed && priceInfoConfirmed && responsibilityConfirmed && kcRegistrable && coupangNoticeRegistrable && !submitting;

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

  /* REWORK-5 ⑤ — 진행 중에는 닫히지 않는다. 배경을 눌러 닫으면 등록은 그대로
     진행되는데 화면만 사라져서 셀러가 "취소됐다"고 오해한다. */
  const dismissable = progress == null;

  if (progress != null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="w-full max-w-md rounded-lg bg-surface p-5 shadow-elevated">
          <h3 className="text-base font-semibold tracking-tight text-text-primary">등록 중...</h3>
          <p className="mt-1 text-xs text-text-secondary">
            {listing.platformLabel}에 등록하고 있습니다 — 이 창을 닫지 마세요.
          </p>
          <ol className="mt-4 space-y-2">
            {(
              [
                ["PREPARING", "상품정보 준비"],
                ["SENDING", `${listing.platformLabel} 전송`],
                ["CONFIRMING", "등록 결과 확인"],
              ] as const
            ).map(([step, label], index) => {
              const at = PROGRESS_ORDER.indexOf(progress);
              const mine = PROGRESS_ORDER.indexOf(step);
              const state = mine < at ? "DONE" : mine === at ? "ACTIVE" : "WAITING";
              return (
                <li key={step} className="flex items-center gap-2 text-sm">
                  <span
                    className={`w-4 shrink-0 text-center ${
                      state === "DONE"
                        ? "text-success"
                        : state === "ACTIVE"
                          ? "text-primary"
                          : "text-text-tertiary"
                    }`}
                  >
                    {state === "DONE" ? "✓" : state === "ACTIVE" ? "●" : "○"}
                  </span>
                  <span
                    className={
                      state === "WAITING" ? "text-text-tertiary" : "font-medium text-text-primary"
                    }
                  >
                    {index + 1}. {label}
                  </span>
                  {state === "WAITING" && <span className="text-xs text-text-tertiary">대기</span>}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={dismissable ? onCancel : undefined}
    >
      <div
        className="w-full max-w-md rounded-lg bg-surface p-5 shadow-elevated"
        onClick={(event) => event.stopPropagation()}
      >
        {/* REWORK-5 ⑤ — 제목이 채널 이름을 달고 선다. 세 채널이 **같은 모달**을
            쓰기 때문에, 지금 어느 채널에 등록하는지는 제목이 말해야 한다. */}
        {/* REWORK-7 ⑤(CEO 지시, 2026-09-15) — 제목은 세 채널이 **같은 한 문장**,
            채널 이름은 바로 아래 줄이 말한다. */}
        <h3 className="text-base font-semibold tracking-tight text-text-primary">판매 전 최종 확인</h3>
        <p className="mt-1 text-xs text-text-secondary">
          {listing.platformLabel}에 상품을 등록합니다 · {formatKrw(listing.priceKrw)}
        </p>

        {/* 등록 대상 — 무엇을 등록하는지가 가격보다 먼저 온다. */}
        <div className="mt-4 rounded-md border border-border bg-background p-3">
          <p className="text-xs font-medium text-text-tertiary">📦 등록 대상</p>
          <p className="mt-1 text-sm font-medium text-text-primary">{listing.title}</p>
        </div>
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
                {/* 🔴 P0-KC-SAFETY — 값을 «보여주고» 확인받는다. 지금까지 판매자는
                    자기가 무엇을 보증하는지 이 화면에서 볼 수 없었다. 인증번호가
                    「12313ㄹㅇ」인 상품이 실제로 등록된 이유다. */}
                {kcHasEnteredCertification && smartstoreChildCertification && (
                  <dl className="mt-2 space-y-0.5 rounded border border-border bg-surface px-2.5 py-2 text-xs">
                    {[
                      ["인증번호", smartstoreChildCertification.certificationNumber],
                      ["업체명", smartstoreChildCertification.companyName],
                      ["인증기관", smartstoreChildCertification.name],
                      ["취득일자", smartstoreChildCertification.certificationDate],
                    ].map(([label, value]) => (
                      <div key={label} className="flex gap-2">
                        <dt className="w-14 shrink-0 text-text-tertiary">{label}</dt>
                        <dd className="break-all font-medium text-text-primary">{value || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <p className="mt-1 text-xs text-text-secondary">
                  {kcHasEnteredCertification
                    ? "위 값은 판매자가 입력한 것입니다 — TTAEJYO는 인증번호의 진위를 확인할 수 없습니다. 실제 인증서와 같은지 보고 확인해주세요."
                    : "현재 인증정보: 확인되지 않음. 아래 중 실제 해당하는 항목을 확인해주세요 — TTAEJYO가 대신 판단하지 않습니다."}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface"
                  >
                    {kcHasEnteredCertification ? "KC 인증정보 고치기" : "KC 인증정보 직접 입력하기"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewConfirmed(true)}
                    className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface"
                  >
                    {/* 🔴 P0-KC-06(CPO 확정, 2026-09-24) — 아래 문구는
                        SELLER_REVIEW_REQUIRED 일 때 「인증자료 확인 — 판매 가능
                        여부 확인 완료」였다. 그런데 이 상태는 «인증자료가 없는»
                        상태다. 없는 자료를 확인했다고 적게 하면, 기록의 뜻이
                        실제보다 커진다.

                        seller_compliance_confirmations 가 실제로 담는 것은
                        「이 상품/카테고리/정책버전에 대해 판매자가 판매 전 최종
                        확인을 했다」 하나다. 문구를 거기에 맞춘다. */}
                    {kcHasEnteredCertification
                      ? "실제 인증서와 같습니다 — 확인 완료"
                      : "이 상품을 판매해도 되는지 직접 확인했습니다"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            P0-KC-03(CPO 확정, 2026-09-24) — **따져가 대신 적은 문장을 보여준다.**

            쿠팡 KC 고시 칸은 사람이 아무것도 안 하면 따져가 문장을 넣는다.
            실제 등록 11건이 전부 그 경로였고, 판매자가 그 문장을 본 적은 없다.

            🔴 확인의 뜻은 「이 상품이 KC 면제 대상임을 판매자가 증명했다」가
            «아니다». 「지금 등록될 문구가 무엇인지 확인했다」 하나뿐이다.
            payload 값은 확인 전후가 같다 — 바뀌는 것은 「봤는가」뿐이다. */}
        {coupangNoticeNeedsReview && (
          <div className="mt-4 rounded-md border border-warning/40 bg-warning-soft p-3">
            <p className="text-xs font-medium text-text-tertiary">⚠ 쿠팡 상품고시 — 자동 입력값 확인</p>
            <dl className="mt-2 space-y-1">
              {autoFilledCoupangNotices.map((notice) => (
                <div key={notice.fieldName} className="text-xs">
                  <dt className="text-text-tertiary">{notice.fieldName}</dt>
                  <dd className="break-all font-medium text-text-primary">「{notice.value}」</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-xs text-text-secondary">
              위 문구는 따져가 «자동으로» 입력한 기본값입니다. TTAEJYO는 이 상품의 KC 적용 여부나 면제
              여부를 법적으로 판정하지 않습니다 — 실제 등록될 값을 확인해주세요.
            </p>
            <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs text-text-primary">
              <input
                type="checkbox"
                checked={coupangNoticeConfirmed}
                onChange={(e) => setCoupangNoticeConfirmed(e.target.checked)}
                className="mt-0.5"
              />
              <span>위 입력값을 확인했습니다.</span>
            </label>
          </div>
        )}

        {/* P-4-H1-2-2 STEP 6 — 이 값은 listing.priceKrw(어댑터가 resolveListingPrice()로
            이미 계산한 값)를 그대로 표시만 한다 — 실제 payload의 salePrice와 동일한
            값이다(둘 다 같은 listing에서 나온다). */}
        <div className="mt-4 rounded-md border border-border bg-background p-3">
          <p className="text-xs font-medium text-text-tertiary">💰 판매가격</p>
          <p className="mt-1 text-base font-semibold text-text-primary">{formatKrw(listing.priceKrw)}</p>
          <p className="mt-1 text-xs text-text-secondary">{PRICE_SOURCE_LABEL[listing.priceSource]}</p>
        </div>

        {/* REWORK-7 ⑤ — **무엇이 등록되는가.** 이 모달이 열렸다는 사실 자체가
            상위 게이트(필수항목 전부 통과 + 카테고리 확정)를 이미 지났다는
            뜻이라, 여기서 다시 판정하지 않고 등록되는 것의 목록만 말한다. */}
        <div className="mt-3 rounded-md border border-border bg-background p-3">
          <p className="text-xs font-medium text-text-tertiary">등록되는 정보</p>
          <p className="mt-1 text-xs text-text-secondary">
            상품정보 · 옵션 · 상세페이지 · 배송/반품 · 채널별 필수정보
          </p>
        </div>

        {/* REWORK-7 ⑤ — 등록 결과의 최종 확인 장소는 우리 화면이 아니다.
            등록 요청이 전달된 것과 실제로 판매 가능한 상태로 등록된 것은
            다르다(SUSPENSION 등) — 누르기 전에 그 사실을 말한다. */}
        <p className="mt-3 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
          ⚠ 등록 후 커머스 판매자센터에서 실제 등록 결과를 확인해주세요.
        </p>

        <p className="mt-4 text-xs font-medium text-text-tertiary">확인할 사항</p>
        <div className="mt-1.5 space-y-2">
          <label className="flex items-start gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={priceInfoConfirmed}
              onChange={(e) => setPriceInfoConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span>상품정보와 판매가격을 확인했습니다.</span>
          </label>
          <label className="flex items-start gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={generalConfirmed}
              onChange={(e) => setGeneralConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span>필요한 인증정보를 확인했습니다.</span>
          </label>
          <label className="flex items-start gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={responsibilityConfirmed}
              onChange={(e) => setResponsibilityConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span>등록 후 결과를 확인하겠습니다.</span>
          </label>
        </div>
        {confirmError && <p className="mt-1 text-xs text-error">{confirmError}</p>}

        {/* REWORK-5 ⑤ — 등록 진행 안내. 누르면 무슨 일이 일어나는지를 누르기
            전에 말한다(아래 진행 화면의 세 단계와 같은 말이다). */}
        <div className="mt-4 rounded-md bg-background px-3 py-2">
          <p className="text-xs font-medium text-text-tertiary">등록 진행 안내</p>
          <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">
            ① 상품정보 준비 → ② {listing.platformLabel} 전송 → ③ 등록 결과 확인 순서로 진행됩니다. 전송 중에는
            이 창이 닫히지 않습니다.
          </p>
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-background"
          >
            취소
          </button>
          {/* 세 채널이 같은 버튼을 쓴다 — 문구만 채널 이름을 받는다. */}
          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={!canConfirm}
            className={`rounded-md px-4 py-1.5 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              isLive ? "bg-error hover:bg-error/90" : "bg-primary hover:bg-primary-hover"
            }`}
          >
            {/* REWORK-7 ⑤ — 우측 요약의 [등록 시작]과 **같은 문구**로 끝난다.
                채널 이름은 위 두 줄이 이미 말했다. */}
            {submitting ? "확인 저장 중..." : "등록 시작"}
          </button>
        </div>
      </div>
    </div>
  );
}
