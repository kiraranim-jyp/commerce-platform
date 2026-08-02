"use client";

import type { ComplianceReport, ExecutionMode, PlatformConnectionStatus } from "@commerce/listing";
import type { ListingModel } from "@commerce/marketplace";
import { formatKrw } from "@commerce/pricing";

const CONNECTION_LABEL: Record<PlatformConnectionStatus, string> = {
  UNKNOWN: "미확인",
  CHECKING: "확인 중",
  NOT_CONFIGURED: "⚠ 연결 설정 필요",
  CONNECTED: "✓ 연결됨",
  AUTH_FAILED: "✕ 인증 실패",
};

export function ListingConfirmationModal({
  listing,
  mode = "DRY_RUN",
  connectionStatus,
  descriptionImageCount,
  selectedGalleryCount,
  complianceReport,
  onCancel,
  onConfirm,
}: {
  listing: ListingModel;
  /** LIVE면 실제 쿠팡 API가 호출된다는 경고 문구와 버튼 문구를 바꾼다. */
  mode?: ExecutionMode;
  /** 쿠팡일 때만 넘어온다 — "✓ 쿠팡 연결됨" 행 표시용(등록 직전 실제로 재확인된 값). */
  connectionStatus?: PlatformConnectionStatus;
  /** 상세설명에 함께 들어갈 이미지 개수 — useInDescription으로 사용자가 고른 값. */
  descriptionImageCount?: number;
  /** 사용자가 "상품 이미지"로 선택한 전체 장수(대표 제외) — 커머스 어댑터가 실제로
   * 담은 listing.additionalImages.length보다 많으면 플랫폼 한도 때문에 일부가
   * 잘렸다는 뜻이라 그 사실을 등록 직전에 알려준다. */
  selectedGalleryCount?: number;
  /** A-10.1-③(CEO 지시: "등록 버튼을 누르면 자동 입력 N개/직접 입력 M개/필수
   * 누락 없음을 한 번 더 보여주고 등록") — CommerceWorkspace가 이미 계산해둔
   * complianceReportPreview를 그대로 받는다(register 라우트/Sticky Summary와
   * 같은 계산 — CP001과 같은 종류의 판정 불일치를 피하려고 새로 계산하지
   * 않는다). 쿠팡 외 플랫폼이거나 카테고리가 아직 확정 안 됐으면 없다. */
  complianceReport?: ComplianceReport | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isCategoryConfirmed =
    listing.category.state === "SELECTED" || listing.category.state === "CONFIRMED";
  const isLive = mode === "LIVE";
  const criticalMissing = complianceReport?.userInputNeeded.some((f) => f.reasonCode === "CRITICAL") ?? false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-lg bg-surface p-5 shadow-elevated"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-base font-semibold tracking-tight text-text-primary">
          {listing.platformLabel} 등록 준비 완료
        </h3>
        <p className="mt-1 text-xs text-text-secondary">
          AI가 준비한 값입니다. 다시 입력할 필요 없이 확인만 하고 등록을 시작하세요.
        </p>
        {isLive && (
          <p className="mt-2 rounded-md bg-warning-soft px-3 py-2 text-xs font-medium text-warning">
            ⚠ 실제로 {listing.platformLabel}에 등록됩니다 — 등록 후 되돌릴 수 없으니 아래 내용을 확인해주세요.
          </p>
        )}

        {complianceReport && (
          <div className="mt-3 grid grid-cols-3 gap-2 rounded-md bg-background p-2.5 text-center">
            <div>
              <p className="text-[10px] text-text-tertiary">자동 입력</p>
              <p className="text-base font-semibold tabular-nums text-success">
                {complianceReport.autoResolvedCount}개
              </p>
            </div>
            <div>
              <p className="text-[10px] text-text-tertiary">직접 입력</p>
              <p className="text-base font-semibold tabular-nums text-text-primary">
                {complianceReport.userRequiredCount}개
              </p>
            </div>
            <div>
              <p className="text-[10px] text-text-tertiary">필수 누락</p>
              <p className={`text-base font-semibold ${criticalMissing ? "text-error" : "text-success"}`}>
                {criticalMissing ? "있음" : "없음"}
              </p>
            </div>
          </div>
        )}

        <ul className="mt-4 space-y-3 text-sm">
          <ConfirmRow label="상품명" value={listing.title} />
          <ConfirmRow
            label="카테고리"
            value={listing.category.candidate?.path.join(" > ") ?? "미지정"}
            warning={!isCategoryConfirmed}
            warningNote={
              !isCategoryConfirmed && listing.category.candidate
                ? "추천만 됐고 아직 선택하지 않았습니다 — 등록이 거부될 수 있습니다."
                : undefined
            }
          />
          <ConfirmRow label="판매가" value={formatKrw(listing.priceKrw)} />
          <ConfirmRow label="배송방식" value={listing.shippingInfo || "미지정"} />
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-success">✓</span>
            <div>
              <p className="text-xs text-text-secondary">대표 이미지</p>
              {listing.representativeImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={listing.representativeImage}
                  alt=""
                  className="mt-1 h-16 w-16 rounded-md border border-border object-cover"
                />
              ) : (
                <p className="font-medium text-warning">없음</p>
              )}
            </div>
          </li>
          <ConfirmRow
            label="추가 이미지"
            value={
              selectedGalleryCount != null && selectedGalleryCount > listing.additionalImages.length
                ? `선택 ${selectedGalleryCount}장 · 등록 가능 ${listing.additionalImages.length}장 · 실제 등록 ${listing.additionalImages.length}장`
                : `${listing.additionalImages.length}장`
            }
            warning={selectedGalleryCount != null && selectedGalleryCount > listing.additionalImages.length}
            warningNote={
              selectedGalleryCount != null && selectedGalleryCount > listing.additionalImages.length
                ? "플랫폼 이미지 장수 한도 때문에 일부만 등록됩니다."
                : undefined
            }
          />
          {descriptionImageCount != null && (
            <ConfirmRow label="상세 이미지" value={`${descriptionImageCount}장`} />
          )}
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-success">✓</span>
            <div>
              <p className="text-xs text-text-secondary">상세설명</p>
              <p className="line-clamp-2 font-medium text-text-primary">
                {listing.description || "없음"}
              </p>
            </div>
          </li>
          {connectionStatus && (
            <ConfirmRow
              label="쿠팡 연결"
              value={CONNECTION_LABEL[connectionStatus]}
              warning={connectionStatus !== "CONNECTED"}
            />
          )}
        </ul>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-background"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-md px-4 py-1.5 text-sm font-medium text-white transition-colors ${
              isLive ? "bg-error hover:bg-error/90" : "bg-primary hover:bg-primary-hover"
            }`}
          >
            {isLive ? `${listing.platformLabel}에 등록` : "등록 시작"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmRow({
  label,
  value,
  warning,
  warningNote,
}: {
  label: string;
  value: string;
  warning?: boolean;
  warningNote?: string;
}) {
  return (
    <li className="flex items-start gap-2">
      <span className={`mt-0.5 ${warning ? "text-warning" : "text-success"}`}>
        {warning ? "!" : "✓"}
      </span>
      <div>
        <p className="text-xs text-text-secondary">{label}</p>
        <p className={`font-medium ${warning ? "text-warning" : "text-text-primary"}`}>{value}</p>
        {warningNote && <p className="mt-0.5 text-xs text-warning">{warningNote}</p>}
      </div>
    </li>
  );
}
