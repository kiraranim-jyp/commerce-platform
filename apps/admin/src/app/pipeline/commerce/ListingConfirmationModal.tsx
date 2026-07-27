"use client";

import type { ExecutionMode } from "@commerce/listing";
import type { ListingModel } from "@commerce/marketplace";
import { formatKrw } from "@commerce/pricing";

export function ListingConfirmationModal({
  listing,
  mode = "DRY_RUN",
  onCancel,
  onConfirm,
}: {
  listing: ListingModel;
  /** LIVE면 실제 쿠팡 API가 호출된다는 경고 문구와 버튼 문구를 바꾼다. */
  mode?: ExecutionMode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isCategoryConfirmed =
    listing.category.state === "SELECTED" || listing.category.state === "CONFIRMED";
  const isLive = mode === "LIVE";

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
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-success">✓</span>
            <div>
              <p className="text-xs text-text-secondary">상세설명</p>
              <p className="line-clamp-2 font-medium text-text-primary">
                {listing.description || "없음"}
              </p>
            </div>
          </li>
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
