"use client";

import type { CategoryCandidate } from "@commerce/category";
import type { ListingResult, ListingStatus, ReadinessReport } from "@commerce/listing";
import type { ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct } from "@commerce/shared";
import { CategoryRecommendationPanel } from "./CategoryRecommendationPanel";
import { CollapsibleSection } from "./CollapsibleSection";
import { EditableText, EditableTextarea } from "./EditableField";
import { ListingSection } from "./ListingSection";
import { PriceEditor } from "./PriceEditor";
import { computeChecklistReadiness, computeReadinessScoreSummary } from "./readiness";
import { RegistrationReadinessCard } from "./RegistrationReadinessCard";
import { ValidationPanel } from "./ValidationPanel";

export function PlatformPreview({
  product,
  listing,
  categoryCandidates,
  listingStatus,
  listingResult,
  readiness,
  onUpdateField,
  onUpdateSalePriceKrw,
  onSelectCategory,
  onFixTextField,
  onFixNumberField,
  onOpenListingModal,
  onRetryListing,
  onFetchCoupangCategory,
  coupangCategoryFetching,
  settingsMissing,
  developerMode,
}: {
  product: CanonicalProduct;
  listing: ListingModel;
  categoryCandidates: CategoryCandidate[];
  listingStatus: ListingStatus;
  listingResult: ListingResult | null;
  /** SmartStore에서만 넘어온다 — 등록 준비도 패널을 대신 보여줄지 판단하는 신호. */
  readiness?: ReadinessReport;
  onUpdateField: (key: "title" | "brand" | "description", value: string) => void;
  onUpdateSalePriceKrw: (amountKrw: number) => void;
  onSelectCategory: (candidate: CategoryCandidate) => void;
  onFixTextField?: (field: "countryOfOrigin" | "returnPolicy", value: string) => void;
  onFixNumberField?: (field: "shippingFee" | "stockQuantity", value: number) => void;
  onOpenListingModal: () => void;
  onRetryListing: () => void;
  /** 쿠팡 탭에서만 넘어온다 — 있으면 카테고리 추천 패널에 "쿠팡 API로 확인"/검색 UI가 보인다. */
  onFetchCoupangCategory?: (query?: string) => void;
  coupangCategoryFetching?: boolean;
  /** 쿠팡 탭에서만 넘어온다 — 비어있지 않으면 등록 버튼 대신 "설정 필요" 배너를 보여준다. */
  settingsMissing?: string[];
  /** P0-UI Epic 1/4 — Developer Mode가 꺼져 있으면 Payload/개발 로그를 숨긴다. */
  developerMode: boolean;
}) {
  const isCategoryConfirmed =
    listing.category.state === "SELECTED" || listing.category.state === "CONFIRMED";

  // P0-UI Epic 2 — 등록 준비 카드와 상세 체크리스트(ListingSection 안의
  // PreflightChecklist/ReadinessScorePanel)가 반드시 같은 판정을 봐야 한다. readiness가
  // 있으면(SmartStore) 그 계산을, 없으면(쿠팡/11번가) validations+category 계산을 쓴다 —
  // 계산 로직 자체는 commerce/readiness.ts 한 곳뿐이다.
  const readinessSummary = readiness
    ? computeReadinessScoreSummary(readiness)
    : computeChecklistReadiness(listing.validations, listing.category, settingsMissing);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
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

        <PriceEditor product={product} onUpdateSalePriceKrw={onUpdateSalePriceKrw} />
        <CategoryRecommendationPanel
          candidates={categoryCandidates}
          selection={listing.category}
          onSelect={onSelectCategory}
          onFetchCoupangCategory={onFetchCoupangCategory}
          coupangCategoryFetching={coupangCategoryFetching}
        />

        {/* P0-UI Epic 3/4 — "추가정보"는 기본 접힘. ValidationPanel은 등록 준비
         * 카드와 같은 정보를 더 자세히 보여줄 뿐이라 여기 접어둔다. */}
        <CollapsibleSection title="Compliance / 검증 상세">
          <ValidationPanel validations={listing.validations} score={listing.registrableScore} />
        </CollapsibleSection>

        <ListingSection
          platformId={listing.platform}
          platformLabel={listing.platformLabel}
          status={listingStatus}
          result={listingResult}
          readiness={readiness}
          validations={listing.validations}
          category={listing.category}
          onFixTextField={onFixTextField}
          onFixNumberField={onFixNumberField}
          onRetry={onRetryListing}
          settingsMissing={settingsMissing}
          sourceUrl={product.sourceUrl}
          developerMode={developerMode}
        />
      </div>

      <RegistrationReadinessCard
        percent={readinessSummary.percent}
        items={readinessSummary.items}
        allRequiredPassed={readinessSummary.allRequiredPassed}
        platformLabel={listing.platformLabel}
        status={listingStatus}
        onRegister={onOpenListingModal}
        settingsMissing={settingsMissing}
      />
    </div>
  );
}
