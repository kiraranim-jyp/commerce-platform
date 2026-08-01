"use client";

import { useState } from "react";
import type { CategoryCandidate } from "@commerce/category";
import type {
  ComplianceFieldSource,
  ComplianceReport,
  CoupangCategoryMeta,
  CoupangPayload,
  ListingResult,
  ListingStatus,
  ReadinessReport,
} from "@commerce/listing";
import { isVerifiedCategorySelected } from "@commerce/marketplace";
import type { ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct, CanonicalProductOptionGroup, FieldSource } from "@commerce/shared";
import type { WorkspaceItem } from "../types";
import { CategoryRecommendationPanel } from "./CategoryRecommendationPanel";
import { CategoryRequirementsEditor } from "./CategoryRequirementsEditor";
import { CollapsibleSection } from "./CollapsibleSection";
import { ComplianceBreakdown } from "./ComplianceBreakdown";
import { CoupangPayloadInspector } from "./CoupangPayloadInspector";
import { EditableText, EditableTextarea } from "./EditableField";
import { ImageSummaryCard } from "./ImageSummaryCard";
import { ListingSection } from "./ListingSection";
import { PriceEditor } from "./PriceEditor";
import { computeChecklistReadiness, computeReadinessScoreSummary } from "./readiness";
import { RegistrationReadinessCard } from "./RegistrationReadinessCard";
import { extractionSourceLabel, ProvenanceBadge } from "./provenance";

/** Sprint A-3(작업1 — 모든 항목 Editable, 작업8 — Resolver Trace) 필드 라벨 행.
 * SourceDataView가 이미 쓰던 "라벨 + 값 + Source + Confidence" 패턴을 accordion
 * 안에서도 그대로 쓴다 — 새 렌더링 방식을 또 만들지 않는다(CP001과 같은 종류의
 * "같은 걸 두 번 다르게 그린다" 문제를 피한다). */
function FieldRow({
  label,
  field,
  required,
  children,
}: {
  label: string;
  field?: { source: FieldSource; confidence: number };
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs text-text-secondary">
          {label}
          {required && <span className="ml-0.5 text-error">*</span>}
        </label>
        {field && (
          <span className="flex items-center gap-1 text-[11px] text-text-tertiary">
            {extractionSourceLabel(field)}
            <ProvenanceBadge source={field.source} />
          </span>
        )}
      </div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

const FIELD_INPUT_CLASS =
  "w-full rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none";

export function PlatformPreview({
  product,
  listing,
  categoryCandidates,
  listingStatus,
  listingResult,
  readiness,
  compliancePreview,
  onUpdateField,
  onUpdateSalePriceKrw,
  onUpdatePriceBreakdown,
  exchangeRates,
  exchangeRatesLoading,
  onRefreshExchangeRates,
  onSelectCategory,
  onFixTextField,
  onFixNumberField,
  onUpdateOptions,
  onOpenListingModal,
  onRetryListing,
  onFetchCoupangCategory,
  coupangCategoryFetching,
  categoryTraceLog,
  categoryMeta,
  categoryMetaLoading,
  categoryMetaError,
  categoryFieldOverrides,
  onUpdateCategoryFieldOverride,
  resolvedCategoryFields,
  productOptionGroups,
  settingsMissing,
  developerMode,
  items,
  thumbnails,
  onOpenGallery,
  payloadPreview,
  payloadPreviewUnavailableReason,
}: {
  product: CanonicalProduct;
  listing: ListingModel;
  categoryCandidates: CategoryCandidate[];
  listingStatus: ListingStatus;
  listingResult: ListingResult | null;
  /** SmartStore에서만 넘어온다 — 등록 준비도 패널을 대신 보여줄지 판단하는 신호. */
  readiness?: ReadinessReport;
  /** Sprint A-3(작업8 — Resolver Trace) — CommerceWorkspace가 이미 등록 전에 계산해둔
   * buildCoupangCompliance() 결과를 그대로 받는다. register 라우트가 등록 시점에
   * 또 계산하는 것과 다른 결과를 보여주면 CP001과 같은 신뢰 문제가 재발하므로,
   * 여기서 새로 계산하지 않고 그 값을 그대로 보여주기만 한다. */
  compliancePreview?: ComplianceReport | null;
  onUpdateField: (key: "title" | "brand" | "description", value: string) => void;
  onUpdateSalePriceKrw: (amountKrw: number) => void;
  onUpdatePriceBreakdown: (breakdown: { shippingKrw: number; feePercent: number; marginPercent: number }) => void;
  exchangeRates: { rates: Record<string, number>; fetchedAt: string; source: "frankfurter" | "fallback" } | null;
  exchangeRatesLoading: boolean;
  onRefreshExchangeRates: () => void;
  onSelectCategory: (candidate: CategoryCandidate) => void;
  onFixTextField?: (
    field:
      | "countryOfOrigin"
      | "returnPolicy"
      | "sku"
      | "manufacturer"
      | "certification"
      | "brand"
      | "material"
      | "color"
      | "recommendedAge"
      | "careInstructions",
    value: string,
  ) => void;
  onFixNumberField?: (field: "shippingFee" | "stockQuantity", value: number) => void;
  /** Sprint A-3(작업1 — 옵션도 Editable) */
  onUpdateOptions?: (raw: string) => void;
  onOpenListingModal: () => void;
  onRetryListing: () => void;
  /** 쿠팡 탭에서만 넘어온다 — 있으면 카테고리 추천 패널에 "쿠팡 API로 확인"/검색 UI가 보인다. */
  onFetchCoupangCategory?: (query?: string) => void;
  coupangCategoryFetching?: boolean;
  /** P0(Category Resolver 추적) — "추천 신호 → 쿠팡 API 질의 → 검증 결과 → 선택"
   * 순서를 그대로 보여준다. */
  categoryTraceLog?: string[];
  /** Sprint A #1(Category Meta -> 동적 입력폼) — 쿠팡 탭에서 카테고리가 실제
   * 선택됐을 때만 채워진다. */
  categoryMeta?: CoupangCategoryMeta | null;
  categoryMetaLoading?: boolean;
  categoryMetaError?: string | null;
  categoryFieldOverrides?: Record<string, string>;
  onUpdateCategoryFieldOverride?: (fieldName: string, value: string) => void;
  /** Sprint A-2(Auto Fill) — CartPilot이 이미 아는 값(브랜드/제조국/색상/소재 등)을
   * fieldName별로 미리 계산해둔 결과. CategoryRequirementsEditor가 이 값을 보고
   * "✓ 자동"으로 미리 채워 보여줄지, 빈 입력으로 사용자에게 요청할지 정한다. */
  resolvedCategoryFields?: Record<string, { value: string; source: ComplianceFieldSource; confidence: number }>;
  /** Sprint A-2(Auto Fill 완성도) — 사이즈/색상처럼 옵션마다 값이 여러 개라
   * 자동으로 하나를 고를 수 없는 필드도, 실제 옵션 값 목록이 있으면 자유
   * 입력 대신 select로 빠르게 고르게 한다. */
  productOptionGroups?: CanonicalProductOptionGroup[];
  /** 쿠팡 탭에서만 넘어온다 — 비어있지 않으면 등록 버튼 대신 "설정 필요" 배너를 보여준다. */
  settingsMissing?: string[];
  /** P0-UI Epic 1/4 — Developer Mode가 꺼져 있으면 Payload/개발 로그를 숨긴다. */
  developerMode: boolean;
  /** Sprint A-3(작업1 — 이미지도 Accordion 안에서) — "source" 탭 전용이던 이미지
   * 갤러리를 플랫폼 탭 안에서도 열 수 있게 한다. 모달 자체는 CommerceWorkspace가
   * 한 곳에서만 렌더한다(중복 마운트 방지). */
  items: WorkspaceItem[];
  thumbnails: Record<string, string>;
  onOpenGallery: () => void;
  /** Sprint A-3(작업6 — Payload Preview) — 카테고리가 확정되면 CommerceWorkspace가
   * 디바운스로 미리 계산해둔 실제 쿠팡 payload. 등록 버튼을 누르기 전에도 항상
   * 최신 상태를 보여준다. */
  payloadPreview?: { payload: CoupangPayload; complianceReport: ComplianceReport } | null;
  payloadPreviewUnavailableReason?: string | null;
}) {
  // isVerifiedPlatformCode까지 확인해야 한다 — state만 보면 미리보기가
  // "선택 완료"로 보이는데 실제 등록은 CP001로 거부되는 버그가 재발한다.
  const isCategoryConfirmed = isVerifiedCategorySelected(listing.category);

  // P0-UI Epic 2 — 등록 준비 카드와 상세 체크리스트(ListingSection 안의
  // ReadinessScorePanel)가 반드시 같은 판정을 봐야 한다. readiness가 있으면
  // (SmartStore) 그 계산을, 없으면(쿠팡/11번가) validations+category+compliance
  // 계산을 쓴다 — 계산 로직 자체는 commerce/readiness.ts 한 곳뿐이다.
  const readinessSummary = readiness
    ? computeReadinessScoreSummary(readiness)
    : computeChecklistReadiness(
        listing.validations,
        listing.category,
        settingsMissing,
        compliancePreview ?? undefined,
      );

  // Sprint A-3(작업2 — Accordion, 작업4 — Auto Scroll) — 어떤 섹션이 펼쳐져 있는지
  // 여기서 관리한다(controlled). Summary에서 항목을 클릭하면 해당 섹션을 펼치고
  // 그 위치로 스크롤한다.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    "section-basic": true,
  });

  function goToSection(sectionId: string) {
    setOpenSections((prev) => ({ ...prev, [sectionId]: true }));
    requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function sectionProps(id: string) {
    return {
      id,
      open: openSections[id] ?? false,
      onToggle: (next: boolean) => setOpenSections((prev) => ({ ...prev, [id]: next })),
    };
  }

  const fix = onFixTextField;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-3">
        <CollapsibleSection title="기본정보" {...sectionProps("section-basic")}>
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <FieldRow label="상품명" field={product.title} required>
              <EditableText
                value={listing.title}
                onCommit={(v) => onUpdateField("title", v)}
                className={FIELD_INPUT_CLASS}
              />
            </FieldRow>
            <FieldRow label="브랜드" field={product.brand} required>
              <EditableText
                value={listing.brand ?? ""}
                onCommit={(v) => onUpdateField("brand", v)}
                placeholder="브랜드 미확인"
                className={FIELD_INPUT_CLASS}
              />
            </FieldRow>
            <FieldRow label="상품코드(SKU)" field={product.sku}>
              <EditableText
                value={product.sku.value}
                onCommit={(v) => fix?.("sku", v)}
                placeholder="SKU 없음"
                className={FIELD_INPUT_CLASS}
              />
            </FieldRow>
            <FieldRow label="제조사" field={product.manufacturer}>
              <EditableText
                value={product.manufacturer.value}
                onCommit={(v) => fix?.("manufacturer", v)}
                placeholder="제조사 미확인"
                className={FIELD_INPUT_CLASS}
              />
            </FieldRow>
            <FieldRow label="소재" field={product.material}>
              <EditableText
                value={product.material.value}
                onCommit={(v) => fix?.("material", v)}
                placeholder="소재 미확인"
                className={FIELD_INPUT_CLASS}
              />
            </FieldRow>
            <FieldRow label="색상" field={product.color}>
              <EditableText
                value={product.color.value}
                onCommit={(v) => fix?.("color", v)}
                placeholder="색상 미확인"
                className={FIELD_INPUT_CLASS}
              />
            </FieldRow>
            <FieldRow label="사용연령" field={product.recommendedAge}>
              <EditableText
                value={product.recommendedAge.value}
                onCommit={(v) => fix?.("recommendedAge", v)}
                placeholder="예: 36개월 이상"
                className={FIELD_INPUT_CLASS}
              />
            </FieldRow>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="카테고리" {...sectionProps("section-category")}>
          <p
            className={`text-sm ${isCategoryConfirmed ? "text-text-primary" : "text-warning"}`}
          >
            {isCategoryConfirmed && listing.category.candidate
              ? listing.category.candidate.path.join(" > ")
              : "미지정 — 아래에서 카테고리를 선택해주세요."}
          </p>
          <CategoryRecommendationPanel
            candidates={categoryCandidates}
            selection={listing.category}
            onSelect={onSelectCategory}
            onFetchCoupangCategory={onFetchCoupangCategory}
            coupangCategoryFetching={coupangCategoryFetching}
          />
          {categoryTraceLog && categoryTraceLog.length > 0 && (
            <div className="rounded-md bg-background p-3 text-[11px] text-text-secondary">
              <p className="font-medium text-text-tertiary">카테고리 추적 로그</p>
              <ul className="mt-1 space-y-0.5">
                {categoryTraceLog.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection title="옵션" badge={<span className="text-xs text-text-tertiary">{listing.options.length}개</span>} {...sectionProps("section-options")}>
          {productOptionGroups && productOptionGroups.length > 0 ? (
            <p className="text-xs text-text-tertiary">
              원본 사이트의 옵션 구조(사이즈/색상 등 옵션그룹 {productOptionGroups.length}개)가
              품목별 가격/재고에 그대로 반영됩니다. 값 목록은 아래에서 확인·수정할 수
              있습니다.
            </p>
          ) : null}
          <EditableText
            value={product.options.value.join(", ")}
            onCommit={(v) => onUpdateOptions?.(v)}
            placeholder="옵션 없음 (쉼표로 구분)"
            className={FIELD_INPUT_CLASS}
          />
          {listing.options.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {listing.options.map((opt) => (
                <span
                  key={opt}
                  className="rounded-full bg-background px-2 py-0.5 text-xs text-text-primary"
                >
                  {opt}
                </span>
              ))}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection title="가격" {...sectionProps("section-price")}>
          <PriceEditor
            product={product}
            onUpdateSalePriceKrw={onUpdateSalePriceKrw}
            onUpdatePriceBreakdown={onUpdatePriceBreakdown}
            exchangeRates={exchangeRates}
            exchangeRatesLoading={exchangeRatesLoading}
            onRefreshExchangeRates={onRefreshExchangeRates}
          />
        </CollapsibleSection>

        <CollapsibleSection title="이미지" badge={<span className="text-xs text-text-tertiary">{items.length}장</span>} {...sectionProps("section-images")}>
          <ImageSummaryCard product={product} items={items} thumbnails={thumbnails} onOpen={onOpenGallery} />
        </CollapsibleSection>

        <CollapsibleSection title="배송" {...sectionProps("section-shipping")}>
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <FieldRow label="재고">
              <div className="flex items-center gap-1">
                <EditableText
                  value={String(product.stockQuantity.value)}
                  onCommit={(v) => onFixNumberField?.("stockQuantity", Math.max(0, Number(v) || 0))}
                  className={FIELD_INPUT_CLASS}
                />
                <span className="text-xs text-text-secondary">개</span>
              </div>
            </FieldRow>
            <FieldRow label="배송비">
              <div className="flex items-center gap-1">
                <span className="text-xs text-text-secondary">₩</span>
                <EditableText
                  value={String(product.shippingFee.value)}
                  onCommit={(v) => onFixNumberField?.("shippingFee", Math.max(0, Number(v) || 0))}
                  className={FIELD_INPUT_CLASS}
                />
              </div>
            </FieldRow>
            <FieldRow label="반품/교환 안내" field={product.returnPolicy}>
              <EditableText
                value={product.returnPolicy.value}
                onCommit={(v) => fix?.("returnPolicy", v)}
                placeholder="반품/교환 안내 없음"
                className={FIELD_INPUT_CLASS}
              />
            </FieldRow>
          </div>
          <p className="text-xs text-text-tertiary">현재 배송 요약: {listing.shippingInfo}</p>
        </CollapsibleSection>

        <CollapsibleSection title="고시정보" {...sectionProps("section-notice")}>
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <FieldRow label="원산지" field={product.countryOfOrigin} required>
              <EditableText
                value={product.countryOfOrigin.value}
                onCommit={(v) => fix?.("countryOfOrigin", v)}
                placeholder="원산지 미확인"
                className={FIELD_INPUT_CLASS}
              />
            </FieldRow>
            <FieldRow label="세탁방법/취급주의" field={product.careInstructions}>
              <EditableText
                value={product.careInstructions.value}
                onCommit={(v) => fix?.("careInstructions", v)}
                placeholder="세탁방법 미확인"
                className={FIELD_INPUT_CLASS}
              />
            </FieldRow>
          </div>
          {onUpdateCategoryFieldOverride && (categoryMeta || categoryMetaLoading || categoryMetaError) && (
            <CategoryRequirementsEditor
              categoryMeta={categoryMeta ?? null}
              loading={categoryMetaLoading ?? false}
              error={categoryMetaError ?? null}
              overrides={categoryFieldOverrides}
              onUpdateOverride={onUpdateCategoryFieldOverride}
              resolvedFields={resolvedCategoryFields}
              productOptionGroups={productOptionGroups ?? []}
            />
          )}
          {compliancePreview && <ComplianceBreakdown report={compliancePreview} />}
        </CollapsibleSection>

        <CollapsibleSection title="KC (어린이제품 등 인증정보)" {...sectionProps("section-kc")}>
          <FieldRow label="인증정보(KC 등)" field={product.certification}>
            <EditableText
              value={product.certification.value}
              onCommit={(v) => fix?.("certification", v)}
              placeholder="해당 없음"
              className={FIELD_INPUT_CLASS}
            />
          </FieldRow>
          <p className="text-xs text-text-tertiary">
            어린이제품/전기용품 등 KC 인증이 필요한 카테고리는 인증번호를 반드시
            입력해야 승인됩니다. 해당 없는 카테고리는 비워두면 됩니다.
          </p>
        </CollapsibleSection>

        <CollapsibleSection title="상세설명" {...sectionProps("section-description")}>
          <FieldRow label="상세설명" field={product.description}>
            <EditableTextarea
              value={listing.description}
              onCommit={(v) => onUpdateField("description", v)}
              placeholder="상세설명 없음"
              className={FIELD_INPUT_CLASS}
            />
          </FieldRow>
        </CollapsibleSection>

        {listing.platform === "coupang" && (
          <CollapsibleSection title="Payload Preview" {...sectionProps("section-payload")}>
            <p className="text-xs text-text-tertiary">
              실제로 쿠팡에 전송될 데이터입니다 — 등록 버튼을 누르기 전에도 항상 최신
              상태로 계산되어 있습니다.
            </p>
            {payloadPreview ? (
              <CoupangPayloadInspector payload={payloadPreview.payload} />
            ) : (
              <p className="rounded-md bg-background p-3 text-xs text-text-tertiary">
                {payloadPreviewUnavailableReason ??
                  "카테고리를 확정하면 payload 미리보기가 생성됩니다."}
              </p>
            )}
          </CollapsibleSection>
        )}

        <ListingSection
          platformId={listing.platform}
          platformLabel={listing.platformLabel}
          status={listingStatus}
          result={listingResult}
          readiness={readiness}
          onFixTextField={onFixTextField}
          onFixNumberField={onFixNumberField}
          onRetry={onRetryListing}
          sourceUrl={product.sourceUrl}
          developerMode={developerMode}
        />
      </div>

      <RegistrationReadinessCard
        percent={readinessSummary.percent}
        required={readinessSummary.required}
        recommended={readinessSummary.recommended}
        allRequiredPassed={readinessSummary.allRequiredPassed}
        platformLabel={listing.platformLabel}
        status={listingStatus}
        onRegister={onOpenListingModal}
        onItemClick={goToSection}
        settingsMissing={settingsMissing}
        autoFillStats={
          compliancePreview
            ? {
                total: compliancePreview.autoResolvedCount + compliancePreview.userRequiredCount,
                autoFilled: compliancePreview.autoResolvedCount,
                userInput: compliancePreview.userRequiredCount,
              }
            : undefined
        }
      />
    </div>
  );
}
