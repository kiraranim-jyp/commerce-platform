"use client";

import { useEffect, useState } from "react";
import type { CategoryCandidate } from "@commerce/category";
import type {
  ComplianceFieldSource,
  ComplianceReport,
  CoupangCategoryMeta,
  CoupangPayload,
  ListingResult,
  ListingStatus,
  NaverPayloadValidationResult,
} from "@commerce/listing";
import { isVerifiedCategorySelected, MARKETPLACE_DESCRIPTORS } from "@commerce/marketplace";
import type { ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct, CanonicalProductCertification, CanonicalProductOptionGroup, FieldSource } from "@commerce/shared";
import { CategoryRecommendationPanel } from "./CategoryRecommendationPanel";
import { CategoryRequirementsEditor } from "./CategoryRequirementsEditor";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { ComplianceBreakdown } from "./ComplianceBreakdown";
import { CoupangPayloadInspector } from "./CoupangPayloadInspector";
import { EditableDate, EditableText, EditableTextarea } from "./EditableField";
import { GuidedResolutionModal } from "./GuidedResolutionModal";
import { KcSellerStatusBanner } from "./KcSellerStatusBanner";
import { ListingSection } from "./ListingSection";
import { NaverPayloadPreview } from "./NaverPayloadPreview";
import type { NaverResolveResponse } from "./NaverPayloadPreview";
import { OptionVariantEditor } from "./OptionVariantEditor";
import { PriceEditor } from "./PriceEditor";
import { computeChecklistReadiness, computeNaverPayloadReadiness } from "./readiness";
import { RegistrationReadinessCard } from "./RegistrationReadinessCard";
import { buildPriorityItems, resolveRegistrationReadinessState, RegistrationStatusBanner } from "./RegistrationStatusBanner";
import type { PriorityItem, RegistrationReadinessState } from "./readiness-state";
import { SellerProfileSummaryCard } from "./SellerProfileSummaryCard";
import { NaverSellerProfileSummaryCard } from "./NaverSellerProfileSummaryCard";
import { extractionSourceLabel, ProvenanceBadge } from "./provenance";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ValueBadge } from "@/components/ui/ValueBadge";

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

/** N-3.45(CPO 지시) — 상품정보제공고시 필드 중 reference-eligibility.ts 화이트리스트에
 * 있는 필드용 FieldRow. "상세페이지 참조"를 선택하면 입력창 대신 참조 상태 배지를
 * 보여주고, 다시 직접입력으로 되돌릴 수 있다. KC 필드(certificationType 등)는 이
 * 컴포넌트를 쓰지 않는다 — 항상 일반 FieldRow+EditableText만 쓴다(참조 불가 원칙). */
function ReferenceEligibleFieldRow({
  label,
  field,
  onCommit,
  onSetReference,
  placeholder,
  required,
}: {
  label: string;
  field: { value: string; source: FieldSource; confidence: number };
  onCommit: (v: string) => void;
  onSetReference?: (referenced: boolean) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const isReferenced = field.source === "DETAIL_PAGE_REFERENCE";
  return (
    <FieldRow label={label} field={field} required={required}>
      {isReferenced ? (
        <div className="flex items-center justify-between gap-2 rounded border border-dashed border-selected-border bg-selected-soft px-2 py-1 text-sm text-selected">
          <span>상세페이지 참조로 등록됩니다</span>
          {onSetReference && (
            <button
              type="button"
              className="shrink-0 text-[11px] underline"
              onClick={() => onSetReference(false)}
            >
              직접 입력으로 전환
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          <EditableText value={field.value} onCommit={onCommit} placeholder={placeholder} className={FIELD_INPUT_CLASS} />
          {onSetReference && (
            <button
              type="button"
              className="text-[11px] text-text-tertiary underline hover:text-text-secondary"
              onClick={() => onSetReference(true)}
            >
              상세페이지 참조로 등록
            </button>
          )}
        </div>
      )}
    </FieldRow>
  );
}

/** N-3.48(CPO 지시: "KC 인증정보 확보 UX") — KC 관련 4개 필드(대상 여부/번호/
 * 업체명/취득일자)를 한 곳에 모으고, 실제로 등록을 막고 있을 때(naverValidation에
 * KC_CERTIFICATION_REQUIRED code가 있을 때)만 전용 경고 배너를 보여준다.
 * 이 컴포넌트는 ReferenceEligibleFieldRow를 쓰지 않는다 — "상세페이지 참조로
 * 등록" 버튼이 KC 필드에 절대 노출되지 않는다는 걸 코드 구조로 고정한다
 * (STEP10 영구 가드, packages/listing/src/notice/reference-eligibility.ts와
 * 동일한 원칙을 UI 레벨에서도 반복). */
function KcCertificationBlock({
  product,
  naverValidation,
  fix,
  onUpdateChildCertification,
  onGoToSection,
}: {
  product: CanonicalProduct;
  naverValidation: NaverPayloadValidationResult | null | undefined;
  fix?: (field: "certificationType", value: string) => void;
  onUpdateChildCertification: (patch: Partial<CanonicalProductCertification>) => void;
  onGoToSection: () => void;
}) {
  const [showUploadNote, setShowUploadNote] = useState(false);
  const [requestCopied, setRequestCopied] = useState(false);

  const kcIssues = (naverValidation?.fields ?? []).filter(
    (f) => f.code === "KC_CERTIFICATION_REQUIRED" && f.status !== "READY",
  );
  const isBlocked = kcIssues.length > 0;

  async function copyRequestText() {
    const productName = product.title.value || "(상품명 미확인)";
    const text = [
      "KC 인증정보 요청",
      "",
      `상품명: ${productName}`,
      "",
      "필요 정보:",
      "- 인증 대상 여부",
      "- 인증 유형",
      "- 인증번호",
      "- 인증 업체명",
      "- 취득/인증 일자",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setRequestCopied(true);
      window.setTimeout(() => setRequestCopied(false), 2000);
    } catch {
      // 클립보드 권한이 없는 환경(HTTP 등) — 조용히 무시한다, 별도 에러 UI를
      // 만들 정도로 중요한 실패는 아니다(사용자가 텍스트를 직접 선택할 수 있음).
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-md border border-border bg-background p-3">
      {isBlocked && (
        <div className="space-y-2 rounded-md border border-error/30 bg-error-soft p-3">
          <p className="text-sm font-semibold text-error">⚠ KC 인증정보 확인 필요</p>
          <p className="text-xs text-text-secondary">
            이 상품은 KC 인증정보가 확인되지 않았습니다. 상세페이지에 정보가 없으므로
            &ldquo;상품 상세페이지 참조&rdquo;로 등록할 수 없습니다 — 실제 인증정보를 직접
            입력해야 합니다.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={onGoToSection}
              className="rounded border border-primary px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
            >
              인증정보 직접 입력
            </button>
            <button
              type="button"
              onClick={() => setShowUploadNote((v) => !v)}
              className="rounded border border-border px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface"
            >
              인증자료 업로드
            </button>
            <button
              type="button"
              onClick={copyRequestText}
              className="rounded border border-border px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface"
            >
              {requestCopied ? "복사됨" : "판매자에게 확인 요청"}
            </button>
          </div>
          {showUploadNote && (
            <p className="rounded bg-background px-2 py-1 text-[11px] text-text-tertiary">
              인증자료 업로드(파일 첨부 + 확인)는 다음 스프린트에서 지원될 예정입니다 —
              지금은 아래 필드에 실제 인증정보를 직접 입력해주세요.
            </p>
          )}
        </div>
      )}
      <p className="text-xs font-medium text-text-secondary">
        실제로 취득한 인증서 값만 입력해주세요 — 값이 없으면 비워둡니다(임의 값 금지).
      </p>
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        <FieldRow label="인증 대상 여부/유형" field={product.certificationType}>
          <EditableText
            value={product.certificationType.value}
            onCommit={(v) => fix?.("certificationType", v)}
            placeholder="예: 공급자적합성확인대상 어린이제품"
            className={FIELD_INPUT_CLASS}
          />
        </FieldRow>
        <FieldRow label="인증번호">
          <EditableText
            value={product.childCertification.value?.certificationNumber ?? ""}
            onCommit={(v) => onUpdateChildCertification({ certificationNumber: v })}
            placeholder="예: 123456-01-0001"
            className={FIELD_INPUT_CLASS}
          />
        </FieldRow>
        <FieldRow label="발급업체">
          <EditableText
            value={product.childCertification.value?.companyName ?? ""}
            onCommit={(v) => onUpdateChildCertification({ companyName: v })}
            placeholder="예: OO시험연구원"
            className={FIELD_INPUT_CLASS}
          />
        </FieldRow>
        <FieldRow label="인증기관명">
          <EditableText
            value={product.childCertification.value?.name ?? ""}
            onCommit={(v) => onUpdateChildCertification({ name: v })}
            placeholder="예: 한국건설생활환경시험연구원(발급업체와 다를 수 있음)"
            className={FIELD_INPUT_CLASS}
          />
        </FieldRow>
        <FieldRow label="취득일자">
          <EditableDate
            value={product.childCertification.value?.certificationDate ?? ""}
            onCommit={(v) => onUpdateChildCertification({ certificationDate: v })}
            className={FIELD_INPUT_CLASS}
          />
        </FieldRow>
      </div>
    </div>
  );
}

export function PlatformPreview({
  product,
  listing,
  categoryCandidates,
  listingStatus,
  listingResult,
  naverValidation,
  naverValidationLoading,
  naverValidationError,
  onRetryNaverValidation,
  naverResolved,
  compliancePreview,
  onUpdateField,
  onUpdateSalePriceKrw,
  onUpdateOriginalPrice,
  onUpdatePriceBreakdown,
  onUpdateCustomsCost,
  exchangeRates,
  exchangeRatesLoading,
  onRefreshExchangeRates,
  onSelectCategory,
  onFixTextField,
  onSetFieldReference,
  onFixNumberField,
  onUpdateChildCertification,
  onUpdateOptions,
  onUpdateVariant,
  onOpenListingModal,
  onRetryListing,
  onFetchCoupangCategory,
  coupangCategoryFetching,
  naverCategoryLoading,
  coupangSearchCandidates,
  coupangSearchAttempted,
  coupangRecommendAttempted,
  categoryTraceLog,
  coupangResolverDecision,
  categoryMeta,
  categoryMetaLoading,
  categoryMetaError,
  categoryFieldOverrides,
  onUpdateCategoryFieldOverride,
  resolvedCategoryFields,
  productOptionGroups,
  settingsMissing,
  settingsRecommended,
  developerMode,
  jobKey,
  payloadPreview,
  payloadPreviewUnavailableReason,
  onReadinessChange,
}: {
  product: CanonicalProduct;
  listing: ListingModel;
  categoryCandidates: CategoryCandidate[];
  listingStatus: ListingStatus;
  listingResult: ListingResult | null;
  /** N-3.27(CPO 지시: "Readiness ↔ 실제 Payload Validation 단일화") —
   * CommerceWorkspace가 register route와 완전히 같은 validateNaverPayload를
   * 호출해서 계산해둔 결과. SmartStore RegistrationReadinessCard의 %/등록
   * 버튼 활성화 여부는 이제 이 값 하나로만 정해진다(레거시 readiness는 더 이상
   * 관여하지 않는다). */
  naverValidation?: NaverPayloadValidationResult | null;
  /** N-3.72(사용자 지시: "계산 중과 실패를 구분하라") — naverValidation이
   * null인 두 가지 이유(아직 첫 조회가 안 끝났다 / 조회는 끝났는데 실패했다)를
   * 구분해서 카드가 "계산 중"과 "0%"를 다르게 보여줄 수 있게 한다. readiness.ts의
   * 판정 로직 자체는 바꾸지 않는다 — 이 값이 true인 동안은 그 판정 결과를
   * 아예 안 쓰고 카드를 로딩 상태로 대체한다. */
  naverValidationLoading?: boolean;
  /** N-3.73 STEP1/2(사용자 지시: "ERROR를 0%로 표현하지 않는다") — data.status
   * !== "OK"(AUTH_FAILED 등, 지금 실제로 Fixie 프록시 장애로 재현됨) 또는
   * catch의 진짜 예외 때문에 naverValidationLoading이 꺼졌는데도 naverValidation이
   * 여전히 null인 경우의 사유 메시지. 있으면 카드가 퍼센트/BLOCKED 대신
   * "등록 가능성 확인 실패 + 다시 확인" 전용 화면을 보여준다. */
  naverValidationError?: string | null;
  /** N-3.73 STEP2 — ERROR 화면의 "다시 확인" 버튼이 호출한다. */
  onRetryNaverValidation?: () => void;
  /** N-3.73 STEP7 — CommerceWorkspace가 이미 fetch한 /api/naver/resolve 결과.
   * NaverPayloadPreview에 그대로 전달해서 그 컴포넌트가 같은 데이터를 또
   * 조회하지 않게 한다(undefined는 "이 탭에서는 아직 해당 없음", null은
   * "조회는 시도했지만 아직 결과 없음"). */
  naverResolved?: NaverResolveResponse | null;
  /** Sprint A-3(작업8 — Resolver Trace) — CommerceWorkspace가 이미 등록 전에 계산해둔
   * buildCoupangCompliance() 결과를 그대로 받는다. register 라우트가 등록 시점에
   * 또 계산하는 것과 다른 결과를 보여주면 CP001과 같은 신뢰 문제가 재발하므로,
   * 여기서 새로 계산하지 않고 그 값을 그대로 보여주기만 한다. */
  compliancePreview?: ComplianceReport | null;
  onUpdateField: (key: "title" | "brand" | "description", value: string) => void;
  onUpdateSalePriceKrw: (amountKrw: number) => void;
  /** CEO 지시(2026-08-03) — Shopify Markets 스토어의 presentment pricing 때문에
   * 자동 감지된 원본 통화/금액이 실제와 다를 수 있어, 원본 가격을 직접 고칠 수
   * 있게 한다. */
  onUpdateOriginalPrice?: (patch: Partial<{ amount: number; currency: string }>) => void;
  onUpdatePriceBreakdown: (breakdown: { shippingKrw: number; feePercent: number; marginPercent: number }) => void;
  onUpdateCustomsCost: (patch: Partial<{ customsDutyKrw: number | null; customsVatKrw: number | null }>) => void;
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
      | "careInstructions"
      | "importer"
      | "itemName"
      | "modelName"
      | "weight"
      | "certificationType",
    value: string,
  ) => void;
  /** N-3.45(CPO 지시: "상품정보제공고시 공통 관리") — "이 필드는 상세페이지 참조로
   * 등록해도 된다"는 사용자 선택. packages/listing/src/notice/reference-eligibility.ts
   * 화이트리스트에 있는 필드만 이 버튼을 보여준다(KC 관련 필드는 절대 여기 없다). */
  onSetFieldReference?: (
    field:
      | "itemName"
      | "modelName"
      | "weight"
      | "material"
      | "color"
      | "manufacturer"
      | "careInstructions"
      | "recommendedAge"
      | "importer",
    referenced: boolean,
  ) => void;
  onFixNumberField?: (field: "shippingFee" | "stockQuantity", value: number) => void;
  /** N-3.29(CPO 지시) — 어린이제품 인증정보(번호/업체명/취득일자) 부분 수정.
   * 문자열 필드(onFixTextField)와 달리 3개 하위 값을 한 번에 patch로 받는다 —
   * 값이 없으면 null(임의 값 생성 없음). */
  onUpdateChildCertification?: (patch: Partial<CanonicalProductCertification>) => void;
  /** Sprint A-3(작업1 — 옵션도 Editable) */
  onUpdateOptions?: (raw: string) => void;
  /** Sprint A-12(작업6) — 옵션 조합별 SKU/재고/가격 편집. */
  onUpdateVariant?: (
    variantId: string,
    patch: Partial<{ sku: string; stockQuantity: number; price: { amount: number; currency: string } | undefined }>,
  ) => void;
  onOpenListingModal: () => void;
  onRetryListing: () => void;
  /** 쿠팡 탭에서만 넘어온다 — 있으면 카테고리 추천 패널에 "쿠팡 API로 확인"/검색 UI가 보인다. */
  onFetchCoupangCategory?: (query?: string) => void;
  coupangCategoryFetching?: boolean;
  /** CEO 지시(2026-08-19: "탭 전환 시 로딩 화면") — 스마트스토어 탭 진입 시
   * /api/naver/category-search 응답 전까지 true. */
  naverCategoryLoading?: boolean;
  /** A-12.3-P0-4(CPO 3차 지시 — regression 수정: "추천과 검색은 항상 동시에
   * 존재해야 한다") — 검색 결과는 AI 추천(categoryCandidates)과 완전히 분리된
   * 목록이라 별도로 내려받는다. */
  coupangSearchCandidates?: CategoryCandidate[];
  coupangSearchAttempted?: boolean;
  coupangRecommendAttempted?: boolean;
  /** P0(Category Resolver 추적) — "추천 신호 → 쿠팡 API 질의 → 검증 결과 → 선택"
   * 순서를 그대로 보여준다. */
  categoryTraceLog?: string[];
  /** Sprint A-9(작업2/8 — CEO 지시: "왜 등록불가인지 전혀 이해하지 못합니다") —
   * Resolver 3.0의 최종 판정을 사람이 읽을 문장으로 보여주는 데 쓴다. 원시
   * categoryTraceLog(개발 로그 형식)와 분리된 이유는, 로그는 Developer Mode
   * 뒤로 숨기고 이 판정만 항상 보이게 하기 위해서다. */
  coupangResolverDecision?: {
    decision: "AUTO_SELECT" | "RECOMMEND" | "REJECT";
    score: number;
    reason?: string;
    rejectedCandidates?: { categoryName: string; categoryCode: number; score: number; reason: string }[];
  } | null;
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
  /** Sprint A-11(작업8) — 없어도 등록은 되지만 채워두면 좋은 판매자 설정
   * (배송비/반품배송비/교환배송비/제조자/품질보증/AS연락처) 중 비어있는 것들. */
  settingsRecommended?: string[];
  /** P0-UI Epic 1/4 — Developer Mode가 꺼져 있으면 Payload/개발 로그를 숨긴다. */
  developerMode: boolean;
  /** Sprint B-1(CPO 지시) — ListingSection의 문의하기 진단 번들에 실린다. */
  jobKey?: string | null;
  /** Sprint A-3(작업6 — Payload Preview) — 카테고리가 확정되면 CommerceWorkspace가
   * 디바운스로 미리 계산해둔 실제 쿠팡 payload. 등록 버튼을 누르기 전에도 항상
   * 최신 상태를 보여준다. */
  payloadPreview?: { payload: CoupangPayload; complianceReport: ComplianceReport } | null;
  payloadPreviewUnavailableReason?: string | null;
  /** N-4.08 STEP6-4(CPO 지시: "상단 커머스 탭에 상태를 표시") — 이 탭이 방금
   * 계산한 4-state(READY/NEEDS_REVIEW/SELLER_REVIEW/BLOCKED)를 CommerceWorkspace로
   * 올려보낸다. 새 판정을 만들지 않는다 — 바로 아래(약 40줄 뒤)서 이미 계산해둔
   * registrationState/priorityItems를 그대로 보고하기만 한다. CommerceWorkspace는
   * 이 값을 캐싱해뒀다가 탭 바 배지에 쓴다(탭이 바뀌어도 마지막 계산값이 남아있게
   * 하기 위함 — payloadPreview/naverValidation 자체는 지금도 활성 탭에서만
   * 계산되므로, 두 플랫폼을 동시에 강제로 미리 계산하는 구조 변경 없이도 한 번
   * 방문한 탭의 상태는 계속 보인다). */
  onReadinessChange?: (state: RegistrationReadinessState, priorityItems: PriorityItem[]) => void;
}) {
  // isVerifiedPlatformCode까지 확인해야 한다 — state만 보면 미리보기가
  // "선택 완료"로 보이는데 실제 등록은 CP001로 거부되는 버그가 재발한다.
  const isCategoryConfirmed = isVerifiedCategorySelected(listing.category);

  // Sprint A-0(2026-08-09) — 이 아래 4곳의 `listing.platform === "coupang"`을
  // 대체한다. 새 플랫폼(SmartStore 등)에 같은 기능을 붙일 때 이 파일을 다시
  // 고치지 않고 capabilities.ts 한 곳만 바꾸면 되게 하기 위함 — 지금은 순수
  // 리팩터링이라 값은 기존 분기와 동일(coupang만 true).
  const capabilities = MARKETPLACE_DESCRIPTORS[listing.platform].capabilities;

  // P0-UI Epic 2 — 등록 준비 카드와 상세 체크리스트(ListingSection 안의
  // ReadinessScorePanel)가 반드시 같은 판정을 봐야 한다.
  // N-3.27(CPO 지시: "Readiness ↔ 실제 Payload Validation 단일화") — SmartStore
  // (hasNaverPreview)는 register route가 실제 POST 직전 게이트로 쓰는 것과
  // 완전히 같은 validateNaverPayload 결과(naverValidation)를 쓴다. 예전엔
  // readiness prop(레거시 validateSmartStoreListing)이 이 자리를 채웠는데, 그
  // 검증기는 KC 인증/원산지 수입사명/배송 프로필 등을 전혀 보지 않아서
  // "카드는 100%인데 register route는 FAIL" 하는 구조적 신뢰 문제가 있었다
  // (N-3.26 실측으로 확인). 쿠팡/11번가는 그대로 validations+category+compliance
  // 계산을 쓴다 — 계산 로직 자체는 commerce/readiness.ts 한 곳뿐이다.
  // A-12.3-P0(CPO 지시: "품질점수는 Payload 기준으로 — Brand Profile/Seller
  // Profile로 채워질 수 있으면 100%") — compliancePreview(클라이언트에서
  // product 필드만 보고 계산, 브랜드/셀러 프로필 모름)는 카테고리 확정 전
  // 잠정 안내용일 뿐이다. payloadPreview.complianceReport는 실제 등록과 동일한
  // buildCoupangPayload(브랜드 프로필 → Seller 기본값 우선순위까지 적용)가 낸
  // 결과라 이게 있으면 항상 이걸 우선한다 — 두 계산이 다른 결과를 보여주면
  // CP001과 같은 신뢰 문제가 재발한다.
  const readinessSummary = capabilities.hasNaverPreview
    ? computeNaverPayloadReadiness(naverValidation ?? null)
    : computeChecklistReadiness(
        listing.validations,
        listing.category,
        settingsMissing,
        payloadPreview?.complianceReport ?? compliancePreview ?? undefined,
        settingsRecommended,
      );

  // N-3.55(CPO 지시: "67~71%라는 점수와 오른쪽의 수십 개 MISSING 항목이
  // 셀러에게 무엇을 먼저 해야 하는지 알려주지 못한다") — 새 판정을 만들지
  // 않는다. readinessSummary(위에서 이미 계산)와 N-3.54의 priceValidity,
  // N-3.52의 kcStatus를 그대로 재조합해 4단계 상태 + 우선순위 목록만
  // 만든다(RegistrationStatusBanner.tsx).
  const priceValid = product.priceValidity === "VALID";
  const registrationState = resolveRegistrationReadinessState(
    readinessSummary,
    priceValid,
    naverValidation?.kcStatus,
  );
  const priorityItems = buildPriorityItems(readinessSummary, priceValid, "section-price");

  // N-4.08 STEP6-4 — 위에서 계산한 것과 정확히 같은 값을 그대로 부모에 보고한다
  // (새 계산 없음). registrationState/priorityItems가 실제로 바뀔 때만 부모
  // setState를 유발하도록 참조가 아니라 상태 문자열/우선순위 라벨로 비교해도
  // 되지만, 이 값들은 매 렌더마다 새로 만들어지는 배열/객체라 참조가 항상
  // 달라진다 — 부모(CommerceWorkspace)가 setState 안에서 얕은 비교로 방어한다.
  useEffect(() => {
    onReadinessChange?.(registrationState, priorityItems);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrationState, priorityItems]);

  const [guideOpen, setGuideOpen] = useState(false);

  // Sprint A-3(작업2 — Accordion, 작업4 — Auto Scroll) — 어떤 섹션이 펼쳐져 있는지
  // 여기서 관리한다(controlled). Summary에서 항목을 클릭하면 해당 섹션을 펼치고
  // 그 위치로 스크롤한다.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    "section-basic": true,
  });

  function goToSection(sectionId: string) {
    setOpenSections((prev) => ({ ...prev, [sectionId]: true }));
    requestAnimationFrame(() => {
      const section = document.getElementById(sectionId);
      section?.scrollIntoView({ behavior: "smooth", block: "start" });
      // A-10.1-②(CEO 지시: "다음 입력하기 → 해당 Accordion이 열리고 해당 입력칸에
      // 포커스") — 필드마다 고유 id를 새로 붙이는 대신, 방금 연 섹션 안에서 첫
      // 번째 입력 가능한 요소를 찾아 포커스한다(스크롤 애니메이션이 끝나길
      // 기다려야 해서 약간 지연시킨다 — 스크롤 도중 포커스하면 브라우저가 다시
      // 그 위치로 스크롤을 끌어당겨서 사용자가 보던 위치가 흔들린다).
      window.setTimeout(() => {
        const input = section?.querySelector<HTMLElement>(
          'input:not([type="checkbox"]):not([disabled]), textarea:not([disabled])',
        );
        input?.focus();
      }, 400);
    });
  }

  function sectionProps(id: string) {
    return {
      id,
      open: openSections[id] ?? false,
      onToggle: (next: boolean) => setOpenSections((prev) => ({ ...prev, [id]: next })),
    };
  }

  /** A-10.1-①(CEO 지시: "Accordion 제목에 기본정보 ✅ / 옵션 ⚠️처럼 완료 여부
   * 표시") — readinessSummary.items가 이미 sectionId별로 필수/통과 여부를 갖고
   * 있다(readiness.ts, RegistrationReadinessCard와 같은 계산). 그 섹션에 매핑된
   * 필수 항목이 하나라도 안 채워졌으면 ⚠️, 다 채워졌으면(또는 이 섹션에 필수
   * 항목이 없으면) ✅ — "등록 가능성" 퍼센트(#306에서 고친 필수 항목 기준)와
   * 같은 기준이라 서로 다른 판정을 보여줄 일이 없다.
   *
   * Sprint E-3(CPO 지시: "missing이라고 해서 무조건 🔴가 아니다") — 이전에는
   * required 항목만 봐서 선택 항목이 비어 있어도 "준비됨"으로만 보였다(선택
   * 항목이 비었다는 사실 자체가 안 보임). required 미충족은 그대로 needsCheck
   * (🟠, 등록을 막는 상태)로 두고, optional 미충족은 새로 warning(🟡, 셀러가
   * 판단해서 넘어갈 수 있는 상태)으로 구분한다 — 판정 기준(required/passed)은
   * readiness.ts 그대로, 여기서 새 규칙을 만들지 않는다. */
  function sectionCompletionBadge(sectionId: string) {
    const relevant = readinessSummary.items.filter((i) => i.sectionId === sectionId);
    if (relevant.length === 0) return null;
    const hasRequiredFail = relevant.some((i) => i.required && !i.passed);
    if (hasRequiredFail) {
      return <StatusBadge status="needsCheck" label="확인 필요" />;
    }
    const hasOptionalFail = relevant.some((i) => !i.required && !i.passed);
    if (hasOptionalFail) {
      return <StatusBadge status="warning" label="선택 입력 가능" />;
    }
    return <StatusBadge status="success" label="준비됨" />;
  }

  // N-3.16 잔여3(CPO 지시: "섹션 제목 → 상태 → 요약 → 펼침" — 기본정보 섹션은
  // 접혀 있어도 "지금 뭘 확인해야 하는지"를 한 줄로 보여준다) — REQUIRED는
  // FieldRow가 "입력 필요" ProvenanceBadge로 그리는 것과 같은 판정(값이 비어
  // 있고 사용자 입력이 필요함)이라 여기서도 그 기준을 그대로 쓴다. 새 규칙을
  // 만들지 않는다.
  const BASIC_INFO_PROVENANCE_FIELDS = [
    product.title,
    product.brand,
    product.sku,
    product.manufacturer,
    product.material,
    product.color,
    product.recommendedAge,
  ];
  const basicInfoNeedsCheck = BASIC_INFO_PROVENANCE_FIELDS.filter((f) => f.source === "REQUIRED").length;
  const basicInfoAutoFilled = BASIC_INFO_PROVENANCE_FIELDS.length - basicInfoNeedsCheck;
  const basicInfoSummary = `자동 입력 ${basicInfoAutoFilled}개 · 확인 필요 ${basicInfoNeedsCheck}개`;

  // Phase 3-D(CPO 지시: "공통 상품 Editor + 채널별 필드 확장" — 기본정보/가격과
  // 같은 "제목 → 상태 → 요약 → 펼침" 골격을 옵션에도 그대로 적용) — 옵션은
  // 7개 텍스트 필드처럼 개별 FieldSource가 없는 대신, 원본 사이트에서 실제
  // 옵션그룹 구조를 찾았는지(productOptionGroups) 여부로 "자동 추출" vs
  // "직접 입력 필요"를 구분한다 — 새 판정 기준을 만들지 않고 이미 옵션 섹션
  // 본문이 쓰는 조건(productOptionGroups.length > 0)을 요약에도 그대로 쓴다.
  const optionGroupCount = productOptionGroups?.length ?? 0;
  const optionValueCount = productOptionGroups?.reduce((sum, g) => sum + g.values.length, 0) ?? 0;
  const optionSummary =
    optionGroupCount > 0
      ? `자동 추출 — 옵션그룹 ${optionGroupCount}개 · 값 ${optionValueCount}개`
      : listing.options.length > 0
        ? `직접 입력 — ${listing.options.length}개`
        : "옵션 없음 — 단일 상품으로 등록됩니다";

  const fix = onFixTextField;

  // CEO 지시(2026-08-19: "탭 전환 시 로딩 화면 — 대상정보를 확인중입니다") —
  // 스마트스토어/쿠팡 탭에 들어오면 카테고리 후보를 실제 API로 조회하는 동안
  // (naverCategoryLoading/coupangCategoryFetching) 화면이 빈 상태로 보여서
  // 응답이 느려 보였다. 새 판정을 만들지 않고 이미 있는 두 로딩 플래그를
  // 플랫폼에 맞게 그대로 보여준다.
  // N-3.72 — SmartStore는 카테고리 조회(naverCategoryLoading)뿐 아니라
  // payload validation 조회(naverValidationLoading)도 같은 "대상정보를
  // 확인중입니다" 배너로 보여준다 — 이게 끝나기 전에 readinessSummary가
  // null validation을 "확인 안 됨"으로 잘못 읽어 0%를 보여주던 게 이번에
  // 고치는 버그의 핵심이다.
  const tabDataLoading =
    listing.platform === "smartstore"
      ? Boolean(naverCategoryLoading) || Boolean(naverValidationLoading)
      : listing.platform === "coupang"
        ? Boolean(coupangCategoryFetching)
        : false;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      {tabDataLoading && (
        <div className="order-0 col-span-full flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text-secondary">
          <span
            aria-hidden
            className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-border border-t-primary"
          />
          대상정보를 확인중입니다...
        </div>
      )}
      {/* N-3.58 STEP1(CPO 지시: "판매 전 체크를 가장 먼저 보여주기") — 이
       * grid의 DOM 순서 자체는 그대로 두되(오른쪽 sticky 컬럼이라는 기존
       * 구조를 다시 만들지 않는다), order 유틸리티만으로 모바일(lg 미만,
       * grid-cols가 1열로 접혀 DOM 순서대로 세로 스택된다)에서는 이 배너+카드
       * 컬럼이 화면 맨 위에 먼저 오도록 시각적 순서만 바꾼다. 데스크톱(lg+)은
       * order-lg 클래스로 기존 좌/우 배치를 그대로 유지한다 — 레이아웃 자체를
       * 새로 설계하지 않는다. */}
      <div className="order-1 space-y-4 lg:order-2">
        <RegistrationStatusBanner
          state={registrationState}
          priorityItems={priorityItems}
          onItemClick={(item) => item.sectionId && goToSection(item.sectionId)}
          onOpenGuide={priorityItems.length > 0 ? () => setGuideOpen(true) : undefined}
        />

        <RegistrationReadinessCard
          isCalculating={capabilities.hasNaverPreview && Boolean(naverValidationLoading)}
          errorMessage={capabilities.hasNaverPreview ? naverValidationError : null}
          onRetry={onRetryNaverValidation}
          percent={readinessSummary.percent}
          required={readinessSummary.required}
          recommended={readinessSummary.recommended}
          allRequiredPassed={readinessSummary.allRequiredPassed}
          platformLabel={listing.platformLabel}
          status={listingStatus}
          registrationEnabled={capabilities.registrationEnabled}
          registrationReadinessState={registrationState}
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

      <div className="order-2 space-y-3 lg:order-1">
        <CollapsibleSection
          title="기본정보"
          badge={sectionCompletionBadge("section-basic")}
          summary={basicInfoSummary}
          {...sectionProps("section-basic")}
        >
          {/* N-4.12 STEP3(대표님 지시: "이 정보는 어디서 수정하지?라는 질문이
              없어야 함") — 이 아래 필드들은 새 값을 갖지 않는다. 상품정보 탭의
              SourceDataView가 같은 product.title/brand/material/options에
              같은 onUpdateField/updateOptions setter로 값을 쓰고, 여기서도
              동일 setter를 그대로 호출한다(값이 두 곳에 따로 저장되는 구조가
              아니다) — 그래서 어느 탭에서 고쳐도 항상 같은 결과가 된다는 걸
              문구로 명시한다. 새 read-only 처리는 하지 않는다 — 등록 화면을
              보면서 바로 고칠 수 있는 게 실제로 더 편하다는 게 여러 스프린트
              동안 검증된 이 UI의 설계이고, 값이 갈라지는 문제가 없으므로
              막을 이유가 없다. */}
          <p className="mb-2 rounded bg-selected-soft px-2 py-1.5 text-[11px] text-selected">
            🔵 이 정보는 상품정보 탭과 공유됩니다 — 어느 탭에서 고쳐도 모든 커머스에 동일하게 적용됩니다.
          </p>
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
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
            <ReferenceEligibleFieldRow
              label="제조사"
              field={product.manufacturer}
              onCommit={(v) => fix?.("manufacturer", v)}
              onSetReference={(r) => onSetFieldReference?.("manufacturer", r)}
              placeholder="제조사 미확인"
            />
            {/* N-3.85 STEP1(대표님 지시) — 제조사가 null일 때 그냥 빈 칸을
                보여주지 않는다. 원문→브랜드 기본값→판매자 기본값 순서로
                이미 다 확인했지만 셋 다 값이 없다는 사실과, 실제 입력 위치를
                명시한다(값을 지어내지 않는다는 원칙은 그대로 — 안내 문구만
                추가). naverResolved.notice.manufacturer는 register 라우트와
                동일한 resolveNaverContext() 결과라 payload에 실제로 들어갈
                값과 항상 같다(별도 판정 로직 없음). */}
            {!product.manufacturer.value && !naverResolved?.notice?.manufacturer && (
              <p className="col-span-2 -mt-1 rounded bg-warning-soft px-2 py-1.5 text-[11px] text-warning">
                ⚠ 제조사 정보가 없습니다 — 자동 입력 순서(상품 원문 → 브랜드 기본값 → 판매자 기본정보)를 모두
                확인했지만 입력 가능한 값이 없습니다. 위 입력창에 직접 입력하거나, Settings의 판매자 정보
                탭에서 기본 제조사를 등록해주세요(이후 등록되는 모든 상품에 자동 적용됩니다).
              </p>
            )}
            <ReferenceEligibleFieldRow
              label="소재"
              field={product.material}
              onCommit={(v) => fix?.("material", v)}
              onSetReference={(r) => onSetFieldReference?.("material", r)}
              placeholder="소재 미확인"
            />
            <ReferenceEligibleFieldRow
              label="색상"
              field={product.color}
              onCommit={(v) => fix?.("color", v)}
              onSetReference={(r) => onSetFieldReference?.("color", r)}
              placeholder="색상 미확인"
            />
            <ReferenceEligibleFieldRow
              label="사용연령"
              field={product.recommendedAge}
              onCommit={(v) => fix?.("recommendedAge", v)}
              onSetReference={(r) => onSetFieldReference?.("recommendedAge", r)}
              placeholder="예: 36개월 이상"
            />
            {/* N-3.44(CPO 지시) — Naver KIDS 고시정보 필수 필드 중 N-3.43에서
                "CartPilot에 입력 경로가 없다"고 확인된 4개 중 3개(품명/모델명/중량).
                Naver 전용 탭이 아니라 커머스 공통 상품 데이터로 여기(기본정보)에
                둔다 — 다른 커머스 Adapter가 필요해지면 그대로 재사용할 수 있어야
                한다는 CPO 지시. N-3.45(CPO 지시) — 이 3개는 "상세페이지 참조"로도
                등록 가능해졌다(ReferenceEligibleFieldRow). 나머지 하나
                certificationType(KC 대상 여부)은 N-3.48부터 아래 "KC" 섹션으로
                옮겼다 — KC 관련 필드(certificationType/childCertification)는
                절대 참조 버튼 없이 한 곳에 모아 실제 값만 입력받는다(CPO 지시). */}
            <ReferenceEligibleFieldRow
              label="품명"
              field={product.itemName}
              onCommit={(v) => fix?.("itemName", v)}
              onSetReference={(r) => onSetFieldReference?.("itemName", r)}
              placeholder="품명 미확인"
            />
            <ReferenceEligibleFieldRow
              label="모델명"
              field={product.modelName}
              onCommit={(v) => fix?.("modelName", v)}
              onSetReference={(r) => onSetFieldReference?.("modelName", r)}
              placeholder="모델명 미확인"
            />
            <ReferenceEligibleFieldRow
              label="중량"
              field={product.weight}
              onCommit={(v) => fix?.("weight", v)}
              onSetReference={(r) => onSetFieldReference?.("weight", r)}
              placeholder="예: 120g (섬유제품은 사이즈로 대체 가능)"
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="카테고리" badge={sectionCompletionBadge("section-category")} {...sectionProps("section-category")}>
          <p
            className={`text-sm ${isCategoryConfirmed ? "text-text-primary" : "text-warning"}`}
          >
            {isCategoryConfirmed && listing.category.candidate
              ? listing.category.candidate.path.join(" > ")
              : "미지정 — 아래에서 카테고리를 선택해주세요."}
            {/* SmartStore 플로우 개선(CPO 지시) — 카테고리 목록에서 직접 찾은
                선택은 AI 추천을 승인한 것과 다르다는 걸 보여준다. */}
            {isCategoryConfirmed && listing.category.candidate?.manuallySelected && (
              <span className="ml-1.5 text-xs font-medium text-selected-border">✎ 판매자 선택</span>
            )}
          </p>
          <CategoryRecommendationPanel
            candidates={categoryCandidates}
            selection={listing.category}
            onSelect={onSelectCategory}
            onFetchCoupangCategory={onFetchCoupangCategory}
            coupangCategoryFetching={coupangCategoryFetching}
            resolverDecision={coupangResolverDecision}
            searchCandidates={coupangSearchCandidates}
            searchAttempted={coupangSearchAttempted}
            recommendAttempted={coupangRecommendAttempted}
          />
          {/* Sprint A-9(작업2/8) — "검증됨=false" 같은 개발자 로그 문구는 일반
              사용자에게 의미가 없다. Developer Mode를 켰을 때만 원시 추적
              로그를 보여주고, 평소엔 CategoryRecommendationPanel의 사람이
              읽는 판정 문장(resolverDecision)만 보인다. */}
          {developerMode && categoryTraceLog && categoryTraceLog.length > 0 && (
            <div className="rounded-md bg-background p-3 text-[11px] text-text-secondary">
              <p className="font-medium text-text-tertiary">카테고리 추적 로그(Developer Mode)</p>
              <ul className="mt-1 space-y-0.5">
                {categoryTraceLog.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="옵션"
          badge={sectionCompletionBadge("section-options")}
          summary={optionSummary}
          {...sectionProps("section-options")}
        >
          {productOptionGroups && productOptionGroups.length > 0 ? (
            <>
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-text-tertiary">
                <ValueBadge kind="original" />
                원본 사이트의 옵션 구조(사이즈/색상 등 옵션그룹 {productOptionGroups.length}개)가
                품목별 가격/재고에 그대로 반영됩니다. 값 목록은 아래에서 확인할 수 있습니다.
              </p>
              {/* A-10(작업1 — 넓어진 폭을 옵션그룹 여러 개가 나란히 보이는 데 쓴다.
                  기존엔 그룹 이름/값이 콤마로 뭉친 한 줄 텍스트라 사이즈/색상이
                  몇 개인지 한눈에 안 보였다. */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {productOptionGroups.map((group) => (
                  <div key={group.name} className="rounded-md border border-border p-2.5">
                    <p className="text-xs font-medium text-text-secondary">
                      {group.name} <span className="text-text-tertiary">({group.values.length}개)</span>
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {group.values.map((v) => (
                        <span key={v} className="rounded-full bg-background px-2 py-0.5 text-xs text-text-primary">
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
          {onUpdateVariant && (
            <OptionVariantEditor
              variants={product.variants}
              onUpdateVariant={onUpdateVariant}
              baseProduct={{ amount: product.price.value.amount, currency: product.price.value.currency, finalKrw: listing.priceKrw }}
            />
          )}
          <EditableText
            value={product.options.value.join(", ")}
            onCommit={(v) => onUpdateOptions?.(v)}
            placeholder="옵션 없음 (쉼표로 구분)"
            className={FIELD_INPUT_CLASS}
          />
          {(!productOptionGroups || productOptionGroups.length === 0) && listing.options.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {listing.options.map((opt) => (
                <span key={opt} className="rounded-full bg-background px-2 py-0.5 text-xs text-text-primary">
                  {opt}
                </span>
              ))}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="가격"
          badge={sectionCompletionBadge("section-price")}
          alwaysRenderChildren
          {...sectionProps("section-price")}
        >
          <PriceEditor
            product={product}
            open={openSections["section-price"] ?? false}
            onUpdateSalePriceKrw={onUpdateSalePriceKrw}
            onUpdateOriginalPrice={onUpdateOriginalPrice}
            onUpdatePriceBreakdown={onUpdatePriceBreakdown}
            onUpdateCustomsCost={onUpdateCustomsCost}
            exchangeRates={exchangeRates}
            exchangeRatesLoading={exchangeRatesLoading}
            onRefreshExchangeRates={onRefreshExchangeRates}
          />
        </CollapsibleSection>

        {/* CEO 지시(2026-08-24, CPO 부재중): "각 커머스별 이미지는 제거하고
         * 공통인 상품정보에서만 관리" — 이미지 Accordion은 이제 "상품정보"
         * (source) 탭 하나에만 있다(CommerceWorkspace.tsx). 여기 있던
         * ImageInlineEditor는 완전히 제거했다 — 중복 관리 지점을 없애는 게
         * 목적이라 숨기지 않고 아예 뺐다. */}

        <CollapsibleSection title="배송" badge={sectionCompletionBadge("section-shipping")} {...sectionProps("section-shipping")}>
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
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
          {capabilities.hasSellerProfileSummary && (
            <p className="text-xs text-text-tertiary">
              비워두면 판매자 기본값(아래 "배송 정책 · 반품/교환" 카드)이 자동 적용됩니다.
            </p>
          )}
          {/* N-3.85 STEP6(대표님 지시, 확인 완료) — 배송비는 상품 수량과
              무관하게 고정 배송비 하나만 전송한다(위 EditableText가 그대로
              Naver deliveryFeeType=PAID의 baseFee가 된다). 여러 개를 함께
              구매하는 경우의 배송비 정산은 CartPilot이 자동 계산하지 않고
              판매자가 Wing에서 직접 확인하도록 안내만 한다 — 임의로 수량별
              할인/할증 로직을 만들지 않는다. */}
          <p className="rounded bg-background px-2 py-1.5 text-[11px] text-text-tertiary">
            ℹ️ 배송비는 수량과 무관하게 위 금액 하나로 고정 전송됩니다. 한 구매자가 여러 개를 함께 주문한
            경우의 배송비 정산은 자동 계산하지 않으니 Wing에서 직접 확인해주세요.
          </p>
        </CollapsibleSection>

        {/* Sprint A-8(작업1/3) — 상품마다 다시 입력하지 않는 배송/반품/교환/
            제조자 정보를 판매자 기본값(SellerProfile)에서 자동으로 불러와
            보여준다. 실제 수정은 Settings 페이지에서만(CP001 방지 — 판정/편집
            로직을 두 곳에 두지 않는다). Sprint P1(2026-08-19) — SmartStore는
            Coupang과 필드 구성이 달라(출고지 개념이 다름) 별도 카드를 쓴다. */}
        {capabilities.hasSellerProfileSummary &&
          (listing.platform === "coupang" ? <SellerProfileSummaryCard /> : <NaverSellerProfileSummaryCard />)}

        <CollapsibleSection title="고시정보" badge={sectionCompletionBadge("section-notice")} {...sectionProps("section-notice")}>
          <p className="mb-2 rounded bg-selected-soft px-2 py-1.5 text-[11px] text-selected">
            🔵 원산지·세탁방법은 상품정보 탭과 공유됩니다 — 어느 탭에서 고쳐도 모든 커머스에 동일하게 적용됩니다.
          </p>
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <FieldRow label="원산지" field={product.countryOfOrigin} required>
              <EditableText
                value={product.countryOfOrigin.value}
                onCommit={(v) => fix?.("countryOfOrigin", v)}
                placeholder="원산지 미확인"
                className={FIELD_INPUT_CLASS}
              />
            </FieldRow>
            <ReferenceEligibleFieldRow
              label="세탁방법/취급주의"
              field={product.careInstructions}
              onCommit={(v) => fix?.("careInstructions", v)}
              onSetReference={(r) => onSetFieldReference?.("careInstructions", r)}
              placeholder="세탁방법 미확인"
            />
            {/* N-3.29(CPO 지시) — 원산지가 수입산으로 확정됐을 때만(=
                naverValidation.fields에 이 필드가 있을 때만) 보여준다. 국내산이면
                이 필드 자체가 검증 결과에 없어서 자동으로 숨겨진다 — "언제
                보여줄지"를 여기서 새로 판단하지 않고 validateNaverPayload가
                이미 계산한 결과를 그대로 관찰만 한다(단일 소스 원칙).
                N-3.45 STEP8(CPO 지시) — "구매대행이라고 해서 판매자가 법적으로
                수입자인 것은 아니다"(CPO가 이전 오판을 직접 정정). 실제 수입자
                지위가 확인되지 않았으면 자동 추정하지 않고, 상세페이지 참조로도
                등록할 수 있게 한다. */}
            {naverValidation?.fields.some((f) => f.field === "detailAttribute.originAreaInfo.importer") && (
              <ReferenceEligibleFieldRow
                label="수입사명"
                field={product.importer}
                onCommit={(v) => fix?.("importer", v)}
                onSetReference={(r) => onSetFieldReference?.("importer", r)}
                placeholder="원산지가 수입산으로 확인되어 입력이 필요합니다"
                required
              />
            )}
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
              productName={listing.title}
            />
          )}
          {compliancePreview && <ComplianceBreakdown report={compliancePreview} />}
        </CollapsibleSection>

        <CollapsibleSection title="KC (어린이제품 등 인증정보)" badge={sectionCompletionBadge("section-kc")} {...sectionProps("section-kc")}>
          {/* N-3.57 STEP1(CPO 지시: "KC 4-State를 Seller가 이해할 수 있는
              언어로 전환") — SmartStore에서 kcStatus가 계산된 경우에만 보여준다
              (Coupang/11번가는 이 4-state 모델을 아직 쓰지 않는다, N-3.56
              compute-readiness.ts 주석 참고). */}
          {capabilities.hasNaverPreview && naverValidation?.kcStatus && (
            <KcSellerStatusBanner
              kcStatus={naverValidation.kcStatus}
              childCertification={product.childCertification.value}
              onFinalConfirm={onOpenListingModal}
              onConfirmSellable={onOpenListingModal}
              onEnterKcInfo={() => goToSection("section-kc")}
              onGoToCategory={() => goToSection("section-category")}
            />
          )}
          {/* N-3.73(사용자 지시: "KC 상세정보 입력 → 사용자 확정 → 다시 입력하라고
              하지 않음") — 여기 있던 `product.certification`(범용 문자열 필드) 기반
              FieldRow를 제거했다. 이 필드는 KcCertificationBlock/KcSellerStatusBanner/
              validateNaverPayload가 실제로 읽는 product.childCertification과 완전히
              별개의, 조사해보니 실제 등록 파이프라인 어디서도 읽지 않는 죽은 필드였다
              (packages/listing/src/smartstore/build-payload.ts라는, 어떤 라우트에서도
              호출되지 않는 레거시 모듈 1곳에서만 참조). 사용자가 아래 KcCertificationBlock에
              KC 정보를 입력/확정해도 이 필드는 절대 동기화되지 않아 "또 입력하라는
              것처럼" 보였다 — 실제 값이 저장되는 단일 소스(childCertification)만
              남기고 이 중복 표시를 삭제한다. */}
          {/* N-3.29(CPO 지시) — SmartStore가 실제로 어린이제품 인증
              (CHILD_CERTIFICATION)을 요구하는 카테고리일 때만(=naverValidation에
              productCertificationInfos 필드가 있을 때만) 보여준다. 실제 인증
              취득 여부를 CartPilot이 알 수 없으므로 값은 항상 사용자가 직접
              입력한다 — 가짜 값/기본값/면제 추정 금지(CPO 지시).
              N-3.48(CPO 지시) — certificationType(대상 여부)도 이 블록으로
              옮겨서 KC 관련 4개 필드(대상 여부/번호/업체명/취득일자)를 한
              곳에 모았다 — 전부 같은 categoryRequiresChildCertification
              조건에서만 검사되는 필드라 조건도 그대로 재사용한다. */}
          {capabilities.hasNaverPreview &&
            naverValidation?.fields.some((f) => f.field.startsWith("productCertificationInfos")) &&
            onUpdateChildCertification && (
              <KcCertificationBlock
                product={product}
                naverValidation={naverValidation}
                fix={fix}
                onUpdateChildCertification={onUpdateChildCertification}
                onGoToSection={() => goToSection("section-kc")}
              />
            )}
          <p className="text-xs text-text-tertiary">
            어린이제품/전기용품 등 KC 인증이 필요한 카테고리는 인증번호를 반드시
            입력해야 승인됩니다. 해당 없는 카테고리는 비워두면 됩니다.
          </p>
        </CollapsibleSection>

        <CollapsibleSection title="상세설명" badge={sectionCompletionBadge("section-description")} {...sectionProps("section-description")}>
          <FieldRow label="상세설명" field={product.description}>
            <EditableTextarea
              value={listing.description}
              onCommit={(v) => onUpdateField("description", v)}
              placeholder="상세설명 없음"
              rows={10}
              className={FIELD_INPUT_CLASS}
            />
          </FieldRow>
        </CollapsibleSection>

        {capabilities.hasPayloadInspector && (
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

        {capabilities.hasNaverPreview && (
          <NaverPayloadPreview
            product={product}
            listing={listing}
            sharedResolved={naverResolved}
            sharedResolving={naverValidationLoading}
            sharedResolveError={naverValidationError}
            sharedValidation={naverValidation}
          />
        )}

        <ListingSection
          platformId={listing.platform}
          platformLabel={listing.platformLabel}
          status={listingStatus}
          result={listingResult}
          onRetry={onRetryListing}
          sourceUrl={product.sourceUrl}
          developerMode={developerMode}
          jobKey={jobKey}
        />
      </div>

      {guideOpen && (
        <GuidedResolutionModal
          items={priorityItems}
          onClose={() => setGuideOpen(false)}
          onGoToItem={(item) => {
            if (item.sectionId) goToSection(item.sectionId);
            setGuideOpen(false);
          }}
        />
      )}
    </div>
  );
}
