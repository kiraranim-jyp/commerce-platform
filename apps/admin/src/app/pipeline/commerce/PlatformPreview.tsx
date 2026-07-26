"use client";

import type { CategoryCandidate } from "@commerce/category";
import type { ListingResult, ListingStatus, ReadinessReport } from "@commerce/listing";
import type { ListingModel } from "@commerce/marketplace";
import { formatKrw } from "@commerce/pricing";
import { CategoryRecommendationPanel } from "./CategoryRecommendationPanel";
import { EditableText, EditableTextarea } from "./EditableField";
import { ListingSection } from "./ListingSection";
import { ValidationPanel } from "./ValidationPanel";

export function PlatformPreview({
  listing,
  categoryCandidates,
  listingStatus,
  listingResult,
  readiness,
  onUpdateField,
  onUpdatePriceKrw,
  onSelectCategory,
  onFixTextField,
  onFixNumberField,
  onOpenListingModal,
  onRetryListing,
}: {
  listing: ListingModel;
  categoryCandidates: CategoryCandidate[];
  listingStatus: ListingStatus;
  listingResult: ListingResult | null;
  /** SmartStore에서만 넘어온다 — 등록 준비도 패널을 대신 보여줄지 판단하는 신호. */
  readiness?: ReadinessReport;
  onUpdateField: (key: "title" | "brand" | "description", value: string) => void;
  onUpdatePriceKrw: (amountKrw: number) => void;
  onSelectCategory: (candidate: CategoryCandidate) => void;
  onFixTextField?: (field: "countryOfOrigin" | "returnPolicy", value: string) => void;
  onFixNumberField?: (field: "shippingFee" | "stockQuantity", value: number) => void;
  onOpenListingModal: () => void;
  onRetryListing: () => void;
}) {
  const isCategoryConfirmed =
    listing.category.state === "SELECTED" || listing.category.state === "CONFIRMED";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-lg border border-border p-4 text-sm">
          <h3 className="text-base font-medium">{listing.platformLabel} 등록 미리보기</h3>

          <div className="mt-4 flex gap-4">
            <div className="h-40 w-40 flex-shrink-0 overflow-hidden rounded border border-border bg-background">
              {listing.representativeImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={listing.representativeImage}
                  alt="대표이미지"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-text-tertiary">
                  대표이미지 없음
                </div>
              )}
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <label className="text-xs text-text-secondary">상품명</label>
                <EditableText
                  value={listing.title}
                  onCommit={(v) => onUpdateField("title", v)}
                  className="mt-0.5 w-full rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary">브랜드</label>
                <EditableText
                  value={listing.brand ?? ""}
                  onCommit={(v) => onUpdateField("brand", v)}
                  placeholder="브랜드 미확인"
                  className="mt-0.5 w-full rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary">
                  판매가격{listing.priceIsEstimate ? " (환율 추정)" : ""}
                </label>
                <div className="mt-0.5 flex items-center gap-2">
                  <EditableText
                    value={String(listing.priceKrw)}
                    onCommit={(v) => onUpdatePriceKrw(Number(v) || 0)}
                    className="w-32 rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
                  />
                  <span className="text-xs text-text-secondary">{formatKrw(listing.priceKrw)}</span>
                </div>
              </div>
            </div>
          </div>

          {listing.additionalImages.length > 0 && (
            <div className="mt-4">
              <label className="text-xs text-text-secondary">
                추가이미지 ({listing.additionalImages.length})
              </label>
              <div className="mt-1 flex gap-2 overflow-x-auto">
                {listing.additionalImages.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={src}
                    src={src}
                    alt=""
                    className="h-16 w-16 flex-shrink-0 rounded border border-border object-cover"
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mt-4">
            <label className="text-xs text-text-secondary">카테고리</label>
            <p
              className={`mt-0.5 text-sm ${isCategoryConfirmed ? "text-text-primary" : "text-warning"}`}
            >
              {isCategoryConfirmed && listing.category.candidate
                ? listing.category.candidate.path.join(" > ")
                : "미지정 — 아래 카테고리 추천에서 선택해주세요."}
            </p>
          </div>

          {listing.options.length > 0 && (
            <div className="mt-4">
              <label className="text-xs text-text-secondary">옵션</label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {listing.options.map((opt) => (
                  <span
                    key={opt}
                    className="rounded-full bg-background px-2 py-0.5 text-xs text-text-primary"
                  >
                    {opt}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4">
            <label className="text-xs text-text-secondary">배송정보</label>
            <p className="mt-0.5 text-sm text-text-primary">{listing.shippingInfo}</p>
          </div>

          <div className="mt-4">
            <label className="text-xs text-text-secondary">상세설명</label>
            <EditableTextarea
              value={listing.description}
              onCommit={(v) => onUpdateField("description", v)}
              placeholder="상세설명 없음"
              className="mt-0.5 w-full rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </section>

        <div className="space-y-4">
          <CategoryRecommendationPanel
            candidates={categoryCandidates}
            selection={listing.category}
            onSelect={onSelectCategory}
          />
          {/* SmartStore는 ListingSection의 등록 준비도 패널이 이 정보를 더 자세히
           * 보여준다 — 같은 내용을 두 번 안 보여준다. */}
          {!readiness && (
            <ValidationPanel validations={listing.validations} score={listing.registrableScore} />
          )}
        </div>
      </div>

      <ListingSection
        platformLabel={listing.platformLabel}
        status={listingStatus}
        result={listingResult}
        readiness={readiness}
        onFixTextField={onFixTextField}
        onFixNumberField={onFixNumberField}
        onOpenModal={onOpenListingModal}
        onRetry={onRetryListing}
      />
    </div>
  );
}
