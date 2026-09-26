"use client";

import { useEffect, useState, type ReactNode } from "react";
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
import { validateKcDeclaration } from "@commerce/listing";
import { isVerifiedCategorySelected, MARKETPLACE_DESCRIPTORS } from "@commerce/marketplace";
import type { ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct, CanonicalProductCertification, CanonicalProductOptionGroup, FieldSource, SmartStoreKcDeclaration } from "@commerce/shared";
import { CategoryRecommendationPanel } from "./CategoryRecommendationPanel";
import { ChannelPriceSection } from "./ChannelPriceSection";
import { CategoryRequirementsEditor } from "./CategoryRequirementsEditor";
import { ChannelRegistrationFrame, ChannelRegistrationSummary } from "./ChannelRegistrationFrame";
import { ChannelEditUnavailableCard } from "./ChannelEditSummary";
import { editUnavailableNote } from "./edit-adapters";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { ComplianceBreakdown } from "./ComplianceBreakdown";
import { CoupangPayloadInspector } from "./CoupangPayloadInspector";
import { EditableDate, EditableText, EditableTextarea } from "./EditableField";
import { KcSellerStatusBanner } from "./KcSellerStatusBanner";
import { ListingSection } from "./ListingSection";
import { ManufacturerField } from "./ManufacturerResolutionNote";
import type { ManufacturerResolutionState } from "./use-manufacturer-resolution";
/* REWORK-11 ①(CEO 지시, 2026-09-15) — 여기 있던 FieldRow · FIELD_INPUT_CLASS가
   공용 모듈로 나갔다. 롯데ON 탭이 **같은 행 컴포넌트**를 쓰게 하기 위해서다
   (그 탭은 지금까지 자기 TextField/TextAreaField를 따로 갖고 있었다).
   스마트스토어·쿠팡 렌더 결과는 그대로다 — 옮기기만 했다. */
import { FieldRow, FIELD_INPUT_CLASS, InfoTip } from "./registration-fields";
import { NaverPayloadPreview } from "./NaverPayloadPreview";
import {
  FIELD_GRID_CLASS,
  FIELD_GRID_NARROW_CLASS,
  initialOpenSections,
  SECTION_NOTE_CLASS,
  SECTION_STACK_CLASS,
  sectionTitle,
} from "./registration-sections";
import type { NaverResolveResponse } from "./NaverPayloadPreview";
import { OptionVariantEditor } from "./OptionVariantEditor";
import { computeChecklistReadiness, computeNaverPayloadReadiness } from "./readiness";
import { buildPriorityItems, resolveRegistrationReadinessState } from "./RegistrationStatusBanner";
import type { PriorityItem, RegistrationReadinessState } from "./readiness-state";
import { SellerProfileSummaryCard } from "./SellerProfileSummaryCard";
import { NaverSellerProfileSummaryCard } from "./NaverSellerProfileSummaryCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ValueBadge } from "@/components/ui/ValueBadge";

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
  referenceLimitation,
  referenceLimitationDetail,
}: {
  label: string;
  field: { value: string; source: FieldSource; confidence: number };
  onCommit: (v: string) => void;
  onSetReference?: (referenced: boolean) => void;
  placeholder?: string;
  required?: boolean;
  /**
   * REWORK-6 ①(CEO 판정, 2026-09-14: "화면에는 참조로 등록됐다고 나오는데
   * payload에서는 빈 값이면 사용자를 속이는 UI다") — **이 입력칸이 두 군데로
   * 나뉘어 나갈 때**, 참조가 통하지 않는 쪽을 그 자리에서 말한다.
   *
   * 지금 해당하는 필드는 "모델명" 하나다. 이 한 칸이 두 곳으로 간다:
   *   productInfoProvidedNotice(KIDS).modelName   참조 대체 **가능**
   *   naverShoppingSearchInfo.modelName           참조 대체 **불가**(조사 결과)
   * 참조를 고르면 앞쪽만 채워지고 뒤쪽은 비는데, 지금까지 화면에는
   * "상세페이지 참조로 등록됩니다" 한 줄만 떴다 — 절반만 참인 문장이다.
   *
   * 🔴 빈 문자열/참조 문구를 카탈로그 쪽에 몰래 실어 보내지 않는다. 네이버가
   * 그 문자열을 받아준다는 근거를 찾지 못했고(조사 §1), 카탈로그 매칭용
   * 필드에 "상품 상세페이지 참조"를 넣는 것은 네이버에 거짓 데이터를 보내는
   * 일이다. 대신 **셀러에게 그 자리에서 알리고 직접 입력을 요구한다.**
   */
  referenceLimitation?: string;
  /**
   * REWORK-11 ⑤(CEO 지시, 2026-09-15) — 위 한 줄 뒤에 **접히는** 나머지.
   * 화면에는 ⓘ 하나만 서고, 글자는 툴팁·보조기술에 그대로 남는다.
   */
  referenceLimitationDetail?: string;
}) {
  const isReferenced = field.source === "DETAIL_PAGE_REFERENCE";
  /* REWORK-12 ③(CEO 실측 캡처, 2026-09-15) — 참조 안내 한 줄이 `children` 안에
     있던 동안, 그 줄을 가진 칸(모델명)만 세로로 커져서 3열 격자의 같은 줄 전체가
     틀어져 보였다. 같은 글자를 FieldRow의 `note` 슬롯으로 옮기면 **칸 바닥**에
     서므로(FieldRow의 mt-auto) 입력칸들의 높이가 서로 어긋나지 않는다.
     🔴 문장은 한 글자도 바뀌지 않았다 — 서는 자리만 바뀐다.
     누르기 **전에도** 그 버튼이 무엇을 못 하는지 알 수 있어야 한다는 REWORK-6의
     요구도 그대로다(참조 전/후 모두 같은 자리에서 말한다). */
  const limitationNote = referenceLimitation ? (
    <span className={isReferenced ? "text-warning" : undefined}>
      {isReferenced ? `⚠ ${referenceLimitation}` : referenceLimitation}
    </span>
  ) : undefined;
  return (
    <FieldRow
      label={label}
      field={field}
      required={required}
      labelSuffix={referenceLimitationDetail ? <InfoTip text={referenceLimitationDetail} /> : undefined}
      note={limitationNote}
    >
      {isReferenced ? (
        <div className="flex items-center justify-between gap-2 rounded border border-dashed border-selected-border bg-selected-soft px-2 py-1 text-sm text-selected">
          <span className="min-w-0 truncate">상세페이지 참조로 등록됩니다</span>
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

/**
 * P0-KC-11 ⑤ — 한 축을 그리는 라디오. 🔴 «기본 선택이 없다» — 고르지 않은
 * 상태가 실재하고, 그것을 「대상 아님」으로 읽으면 안 되기 때문이다.
 */
function KcAxisRadio({
  label,
  name,
  value,
  options,
  onChange,
}: {
  label: string;
  name: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="w-24 shrink-0 text-xs font-medium text-text-secondary">{label}</span>
      {options.map((option) => (
        <label key={option.value} className="flex cursor-pointer items-center gap-1 text-xs text-text-primary">
          <input
            type="radio"
            name={name}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
      {value === undefined && <span className="text-[11px] text-text-tertiary">— 아직 고르지 않음</span>}
    </div>
  );
}

function KcCertificationBlock({
  product,
  naverValidation,
  fix,
  onUpdateChildCertification,
  onUpdateKcDeclaration,
  onGoToSection,
}: {
  product: CanonicalProduct;
  naverValidation: NaverPayloadValidationResult | null | undefined;
  fix?: (field: "certificationType", value: string) => void;
  onUpdateChildCertification: (patch: Partial<CanonicalProductCertification>) => void;
  onUpdateKcDeclaration: (patch: Partial<SmartStoreKcDeclaration>) => void;
  onGoToSection: () => void;
}) {
  const [requestCopied, setRequestCopied] = useState(false);

  const kcIssues = (naverValidation?.fields ?? []).filter(
    (f) => f.code === "KC_CERTIFICATION_REQUIRED" && f.status !== "READY",
  );
  const isBlocked = kcIssues.length > 0;

  /* P0-KC-11 — 🔴 화면이 «자기 규칙» 을 만들지 않는다. 조합 판정은
     validateKcDeclaration() 한 곳에만 있고 여기서는 부르기만 한다.

     capability 는 「이 카테고리가 어린이제품 인증을 요구하는가」다. 이 컴포넌트가
     가진 유일한 신호는 검증이 낸 KC 이슈 존재 여부이므로 그것을 쓴다 — 새
     판정을 만들지 않는다. */
  const declaration = product.smartStoreKcDeclaration ?? {};
  const declarationProblems = validateKcDeclaration(declaration, {
    childCertificationRequired: isBlocked,
  });

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
          <p className="text-sm font-semibold text-error">⚠ KC 인증 · 판매자 확인 필요</p>
          {/* 🔴 P0-KC-06(CPO 확정, 2026-09-24) — 전에는 「실제 인증정보를 직접
              입력해야 합니다」 한 줄이었다. 그런데 ④ 최종 확인에서는 «입력 없이»
              판매자 확인만으로도 등록된다. ③ 이 「입력 외에 길이 없다」고 말하니
              셀러는 칸을 채우려 했고, 그래서 아무 값이나 들어갔다 —
              「12313ㄹㅇ」이 실제 상품에 붙은 행동 경로가 바로 이것이다.
              두 갈래를 «둘 다» 적는다. */}
          <p className="text-xs text-text-secondary">
            이 상품은 KC 관련 확인이 필요합니다. KC 항목은
            &ldquo;상품 상세페이지 참조&rdquo;로 대체할 수 없습니다.
          </p>
          <ul className="space-y-1 text-xs text-text-secondary">
            <li>
              <span className="font-medium text-text-primary">① 실제 인증정보가 있는 경우</span> —
              인증정보를 직접 입력합니다.
            </li>
            <li>
              <span className="font-medium text-text-primary">② 입력하지 않는 경우</span> — 최종 확인
              단계에서 인증자료를 확인한 뒤 판매 가능 여부를 «직접» 확인해야 합니다.
            </li>
          </ul>
          <p className="text-xs font-medium text-text-secondary">
            🔴 TTAEJYO는 KC 인증의 진위나 법적 적용 여부를 판정하지 않습니다.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={onGoToSection}
              className="rounded border border-primary px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
            >
              인증정보 직접 입력
            </button>
            {/* 🔴 P0-KC-06 — 「인증자료 업로드」를 «제거» 했다. 누르면
                「다음 스프린트에서 지원 예정」 안내만 펼쳐지는 미구현 기능이었다.
                되는 것처럼 보이는 버튼은 안내가 아니라 거짓말이다. 실제 업로드
                기능이 생기면 그때 다시 넣는다. */}
            <button
              type="button"
              onClick={copyRequestText}
              className="rounded border border-border px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface"
            >
              {requestCopied ? "복사됨" : "요청 문구 복사"}
            </button>
          </div>
        </div>
      )}
      {/* ══════════════════════════════════════════════════════════════════
          P0-KC-11 ⑤(CPO 확정, 2026-09-24) — **판매자가 «고르는» 인증 대상 축.**

          스마트스토어 판매자센터에는 이 두 축이 원래 있는데 따져에는 없었다.
          그래서 인증서가 없는 판매자는 빠져나갈 길이 없어 아무 값이나 넣었다.

          🔴 여기서 판정하지 않는다. 기본 선택도 두지 않는다 — 「고르지 않음」과
          「대상 아님」은 다른 상태다. 고르지 않으면 인증정보를 예전 그대로 요구한다.
          🔴 두 축을 자동 결합하지 않는다. 한쪽을 골라도 다른 쪽은 그대로다. */}
      <div className="space-y-2 rounded-md border border-border bg-surface px-3 py-2.5">
        <KcAxisRadio
          label="어린이제품 인증"
          name="kc-child"
          value={declaration.child}
          options={[
            { value: "TARGET", label: "인증 대상" },
            { value: "EXCLUDED", label: "인증 대상 아님" },
          ]}
          onChange={(v) => onUpdateKcDeclaration?.({ child: v as "TARGET" | "EXCLUDED" })}
        />
        <KcAxisRadio
          label="KC 인증"
          name="kc-main"
          value={declaration.kc}
          options={[
            { value: "TARGET", label: "인증 대상" },
            { value: "EXCLUDED", label: "인증 대상 아님" },
            { value: "EXEMPTION", label: "면제 대상" },
          ]}
          onChange={(v) => onUpdateKcDeclaration?.({ kc: v as "TARGET" | "EXCLUDED" | "EXEMPTION" })}
        />
        {/* 면제 사유는 «면제를 고른 경우에만» 묻는다. 그 밖에는 값도 지운다
            (updateKcDeclaration) — 남아 있으면 반쪽 신고가 된다. */}
        {declaration.kc === "EXEMPTION" && (
          <KcAxisRadio
            label="면제 사유"
            name="kc-exemption"
            value={declaration.exemptionReason}
            options={[
              { value: "OVERSEAS", label: "구매대행" },
              { value: "SAFE_CRITERION", label: "안전기준 준수" },
              { value: "PARALLEL_IMPORT", label: "병행수입" },
            ]}
            onChange={(v) =>
              onUpdateKcDeclaration?.({
                exemptionReason: v as "OVERSEAS" | "SAFE_CRITERION" | "PARALLEL_IMPORT",
              })
            }
          />
        )}
        {declarationProblems.length > 0 && (
          <p className="text-[11px] text-warning">
            {declarationProblems.includes("KC_EXEMPTION_REASON_MISSING")
              ? "면제 사유를 골라야 신고가 완성됩니다."
              : declarationProblems.includes("CHILD_CHOICE_MISSING")
                ? "이 카테고리는 어린이제품 인증 대상 여부를 골라야 합니다."
                : "선택 조합이 맞지 않습니다 — 대상 아님과 면제는 함께 신고할 수 없습니다."}
          </p>
        )}
      </div>

      <p className="text-xs font-medium text-text-secondary">
        실제로 취득한 인증서 값만 입력해주세요 — 값이 없으면 비워둡니다(임의 값 금지).
      </p>
      <div className={FIELD_GRID_NARROW_CLASS}>
        {/* 🔴 N-07-01 2차(CEO 확정, 2026-09-24) — 라벨이 「인증 대상 여부/유형」
            이었다. 「여부」까지 자유 텍스트로 답하라는 것처럼 읽혀서, 빈 값이
            「비대상」인지 「미입력」인지 구분되지 않았다.

            🔴 여기에 「○ 인증 대상 / ○ 해당 없음」 라디오를 «만들지 않는다».
            그 축은 이미 있다 — 대상 여부는 카테고리가 정하고(resolveKcStatus →
            NOT_APPLICABLE), 셀러가 「대상이 아니다」라고 판단하는 경로는 위
            KcSellerStatusBanner 의 확인(seller_compliance_confirmations)이다.
            라디오를 새로 만들면 KcStatus 와 두 벌이 되어 두 화면이 다른 말을
            하게 된다(CEO 확정 2번: 새 KC 상태 모델 금지).

            그래서 이 칸은 «유형» 만 받는다 — payload 의
            productInfoProvidedNotice.kids.certificationType 에 그대로 실리는
            값이고, 값 자체는 한 글자도 바뀌지 않는다. */}
        <FieldRow
          label="인증 유형"
          field={product.certificationType}
          note="대상 여부는 위 상태가 말합니다 — 이 칸은 인증서에 적힌 유형만 적습니다."
        >
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
  onRequestPriceReview,
  onSelectCategory,
  onFixTextField,
  onSetFieldReference,
  onFixNumberField,
  onUpdateChildCertification,
  onUpdateKcDeclaration,
  onUpdateOptions,
  onUpdateVariant,
  onOpenListingModal,
  onRetryListing,
  onFetchCoupangCategory,
  coupangCategoryFetching,
  naverCategoryLoading,
  naverCategoryError,
  onRetryNaverCategory,
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
  onUpdateChannelPrice,
  productPriceKrw,
  manufacturerResolution,
  editSummary,
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
  /**
   * UX 2.5(CEO 지시, 2026-09-11) — 가격 편집기(PriceEditor)가 이 화면에서
   * 내려간 자리에 남는 유일한 가격 관련 prop. 값을 고치는 setter가 아니라
   * "가격을 관리하는 한 곳으로 데려가는" 이동이다 — 채널 화면은 이제
   * 판매가를 **읽기만** 한다.
   *
   * 왜 가격 setter 넷(판매가 · 원본가 · 배송비/수수료/마진 · 관세)과 환율
   * props를 통째로 지웠나: 남겨두면 "여기서도 고칠 수 있다"는 신호가 되어
   * 언젠가 두 번째 편집 UI가 그 prop을 타고 되살아난다. 등록에 쓰이는
   * 판매가는 resolveListingPrice()가 내는 값 하나뿐이고, 이 화면은 그
   * 결과(listing.priceKrw)를 그대로 보여주기만 한다.
   */
  onRequestPriceReview?: () => void;
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
  onUpdateKcDeclaration?: (patch: Partial<SmartStoreKcDeclaration>) => void;
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
  /** P1-3 — 스마트스토어 카테고리 «조회 실패» 사유. 후보 0건과 다른 상태다. */
  naverCategoryError?: string | null;
  onRetryNaverCategory?: () => void;
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
  /**
   * N-06 C-5(CPO 확정, 2026-09-24) — 세 번째 인자 `requiredTotal` 이 늘었다.
   *
   * 🔴 새로 세지 않는다. 바로 위 `readinessSummary.required` 는 이미 계산돼
   * 있었고, 부모로 올릴 때만 버려지고 있었다 — 그래서 Master 화면은 「확인 2건」
   * 은 알아도 「그게 몇 개 중 2건인지」는 말할 수 없었다.
   */
  onReadinessChange?: (
    state: RegistrationReadinessState,
    priorityItems: PriorityItem[],
    requiredTotal: number,
  ) => void;
  /** PHASE 3.2 — 이 채널의 최종 등록가격을 정하거나(숫자) 지운다(null).
   * null을 넘기면 상품정보 최종 판매가격으로 되돌아간다 — 0을 저장하지 않는다.
   * 이 핸들러는 상품정보 가격(priceOverrideKrw)을 절대 건드리지 않고, MI
   * 재조회도 일으키지 않는다(CommerceWorkspace의 updateChannelPriceKrw 참고). */
  onUpdateChannelPrice?: (amountKrw: number | null) => void;
  /** PHASE 3.2 — 채널 최종가가 없을 때 이 채널이 쓰게 될 값(= 상품정보 최종
   * 판매가격). "수정을 취소하면 얼마로 돌아가는가"를 화면이 정직하게 말하려면
   * listing.priceKrw만으로는 부족하다 — 그 값은 이미 채널 최종가일 수 있다.
   * 계산할 수 없으면(원본가 미확인) null. */
  productPriceKrw?: number | null;
  /**
   * REWORK-10 A(CEO 지시, 2026-09-15) — 전 채널 공통 제조사 resolver의 결과.
   * 탭과 무관하게 CommerceWorkspace가 한 번 계산해서 세 채널에 **같은 값**을
   * 내려보낸다(useManufacturerResolution). 이 화면은 판정하지 않는다.
   */
  manufacturerResolution: ManufacturerResolutionState;
  /**
   * P0-CHANNEL-03 F-14-5 — 우측 기둥에 서는 «수정 요약»(ChannelEditSummary).
   *
   * 🔴 여기서 만들지 않고 «받는다». 기준값(ChannelEditModel)은 CommerceWorkspace
   * 한 곳이 채널에서 읽어 들고 있고, 좌측 Editor 와 이 요약이 «같은 그것» 을
   * 본다. 이 화면이 직접 읽으면 좌우가 다른 값을 말할 수 있다.
   *
   * 🔴 없으면 서지 않는다 — 불러오지 않았거나 연결이 없는 상태다.
   */
  editSummary?: ReactNode;
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
  const requiredTotal = readinessSummary.required.length;
  useEffect(() => {
    onReadinessChange?.(registrationState, priorityItems, requiredTotal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrationState, priorityItems, requiredTotal]);

  /* REWORK-4 §2(CEO 지시, 2026-09-14) — 여기 있던 `guideOpen` state와
     GuidedResolutionModal이 사라졌다. 그 모달을 여는 유일한 버튼이
     「부족한 정보 한 번에 해결하기」였고, 그 버튼이 이번에 없어졌다.
     모달 자체도 같은 목록을 한 번 더 읽어주기만 했지 해결하지는 않았다 —
     지금은 그 자리를 「먼저 해결할 항목 1개」가 대신한다. */

  // Sprint A-3(작업2 — Accordion, 작업4 — Auto Scroll) — 어떤 섹션이 펼쳐져 있는지
  // 여기서 관리한다(controlled). Summary에서 항목을 클릭하면 해당 섹션을 펼치고
  // 그 위치로 스크롤한다.
  /* REWORK-11 ① — 첫 화면의 펼침 정책은 이제 세 채널이 **한 곳**에서 받는다
     (registration-sections.ts). 값은 그대로다 — ① 기본 상품정보 하나만 열린다. */
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    initialOpenSections("section-basic"),
  );

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

  /**
   * REWORK-10 B(CEO 지시, 2026-09-15) — 접혀 있을 때도 보이는 카테고리 한 줄.
   * 조회 중 · 확정됨 · 미지정 셋을 같은 자리에서 말한다 — 스마트스토어만 갖던
   * 전용 대기 배너가 하던 일 중 "카테고리를 불러오는 중"이 여기로 왔다.
   */
  const categorySummary =
    naverCategoryLoading || coupangCategoryFetching
      ? "카테고리 후보를 불러오는 중…"
      : isCategoryConfirmed && listing.category.candidate
        ? listing.category.candidate.path.join(" > ")
        : "미지정 — 추천 후보에서 선택해주세요.";

  /*
   * REWORK-10 B(CEO 정정, 2026-09-15) — **SmartStore 전용 대기 UI를 없앤다.**
   *
   * 여기 있던 것: `tabDataChecks` / `tabDataLoading`과 좌측 맨 위의
   * 「등록 대상 정보를 확인하고 있습니다」 배너(확인 항목 목록 포함).
   *
   * REWORK-9에서는 "무엇을 확인하는지 보여주자"로 갔다. CEO 판정은 **제거**다 —
   * 세 채널 중 스마트스토어만 중간 상태를 보여주는 구조 자체가 UX 차이였다.
   *
   * 🔴 조회를 없앤 것이 아니다. `naverCategoryLoading` /
   * `naverValidationLoading`은 그대로 돌고, 등록 게이트도 그대로
   * `smartStoreValidation.ok`를 쓴다(CommerceWorkspace L2197 무변경). 조회 중
   * 상태는 **다른 채널과 같은 방식**으로 흡수된다 — 우측 등록 요약의
   * `isCalculating`(RegistrationReadinessCard의 "확인 중…")이 이미 그 자리이고,
   * 카테고리 조회 중 상태는 CategoryRecommendationPanel이 자기 안에서 말한다.
   */

  /**
   * REWORK-2(CEO 지시, 2026-09-14) — 우측 · 등록 요약.
   *
   * UX 2.2에서 이 두 카드를 오른쪽 기둥에서 본문 맨 위로 내렸었다. 그 결과
   * 채널 탭은 "판정 → 상세 → 등록 버튼"이 한 줄로 쌓인 세로 문서가 됐고,
   * 오른쪽에는 채널과 무관한 상품 Action 카드가 대신 서 있었다(BEFORE 덤프).
   * 이번에는 두 카드를 **채널 요약 기둥**으로 되돌리되, 세 채널이 같은
   * 컴포넌트(ChannelRegistrationSummary)를 통해서만 세운다.
   *
   * 값은 하나도 다시 계산하지 않는다 — 바로 위에서 이미 만든
   * registrationState / priorityItems / readinessSummary 그대로다.
   */
  /* P0-CHANNEL-03 F-14-5 — 🔴 등록 요약 «아래» 에 수정 요약을 세운다. 등록과
     수정은 다른 질문이라 카드를 합치지 않는다(「등록할 수 있는가」 vs 「지금
     나가 있는 것을 무엇으로 고치는가」). 없으면 아무것도 서지 않는다. */
  const summary = (
    /* 🔴 여기에 sticky 를 걸지 않는다 — 등록 요약 카드가 «자기 안에서» 이미
       sticky 다(ChannelRegistrationFrame). 겹쳐 걸면 둘 다 어긋난다.

       🔴 F-14-7(CTO 지시 §2) — 간격을 벌린다(space-y-4 → 6). 두 카드가 붙어
       있으면 아래 것이 위 것의 «부속» 으로 읽힌다. 등록 준비와 등록 후 관리는
       같은 격의 «다른 일» 이다. */
    <div className="space-y-6">
      <ChannelRegistrationSummary
        state={registrationState}
        priorityItems={priorityItems}
        onPriorityItemClick={(item) => item.sectionId && goToSection(item.sectionId)}
        isCalculating={capabilities.hasNaverPreview && Boolean(naverValidationLoading)}
        errorMessage={capabilities.hasNaverPreview ? naverValidationError : null}
        onRetry={onRetryNaverValidation}
        required={readinessSummary.required}
        allRequiredPassed={readinessSummary.allRequiredPassed}
        status={listingStatus}
        registrationEnabled={capabilities.registrationEnabled}
        onRegister={onOpenListingModal}
      />
      {/* ══════════════════════════════════════════════════════════════════════
          Commerce-3B(CPO 지시, 2026-09-26) — 🔴 **이 자리가 비어 있었다.**

          `editSummary` 는 어댑터가 있는 채널(지금은 SmartStore)만 채운다. 그래서
          쿠팡·11번가 탭에서는 이 자리에 «아무것도» 서지 않았고, 셀러는 「등록된
          상품을 수정할 수 있는가」에 대해 아무 말도 듣지 못했다 — 「확인되지
          않았습니다」조차. 빈 칸은 「없다」가 아니라 「말하지 않은 것」이다.

          🔴 문구는 capability 계층이 정한 것을 그대로 쓴다(editUnavailableNote).
             그 함수는 어댑터가 «있으면» undefined 를 내므로, 이 카드는 어댑터가
             없는 채널에서만 선다 — 조건을 여기서 따로 쓰지 않는다(채널 이름을
             화면에 박으면 표가 바뀌어도 화면은 옛말을 계속 한다).
      ══════════════════════════════════════════════════════════════════════ */}
      {editSummary ?? (
        <ChannelEditUnavailableCard
          commerceLabel={listing.platformLabel}
          note={editUnavailableNote(listing.platform)}
        />
      )}
    </div>
  );

  const detail = (
    <div className="space-y-4">
      {/* REWORK-10 B — 여기 있던 SmartStore 전용 「등록 대상 정보를 확인하고
          있습니다」 배너가 사라졌다. 좌측 상세는 세 채널 모두 **10섹션 골격으로
          바로 시작한다.** */}
      {/* REWORK-13B — 카드 사이 간격도 세 채널이 같은 한 곳에서 받는다
          (registration-sections.ts). 값은 그대로 `space-y-3`이다. */}
      <div className={SECTION_STACK_CLASS}>
        {/* REWORK-10 C-2(CEO 지시, 2026-09-15) — 아래 열 섹션의 제목은 이제
            **세 채널이 같은 한 곳**(registration-sections.ts)에서 온다. 예전엔
            스마트스토어·쿠팡만 자기 문자열("기본정보" · "KC (어린이제품 등
            인증정보)" · "등록 정보")을 들고 있어서, 같은 자리가 탭마다 다른
            이름·번호로 보였다(rework5-three-tab-parity가 그 간극을 기록해 두고
            있었다). 섹션 id(section-basic 등)와 내용은 하나도 바뀌지 않는다 —
            readiness.ts의 스크롤 목적지와 계약이 그대로 유지된다. */}
        <CollapsibleSection
          title={sectionTitle("BASIC")}
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
          <p className={SECTION_NOTE_CLASS}>
            🔵 이 정보는 상품정보 탭과 공유됩니다 — 어느 탭에서 고쳐도 모든 커머스에 동일하게 적용됩니다.
          </p>
          <div className={FIELD_GRID_CLASS}>
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
            {/* REWORK-11 ②(CEO 판정, 2026-09-15: "CEO 화면엔 여전히 제조사
                미확인") — 여기 있던 것은 **두 조각**이었다: 입력칸
                (ReferenceEligibleFieldRow — `product.manufacturer.value`를 읽어
                빈 값이면 placeholder "제조사 미확인"을 띄운다)과 그 아래 별도
                문단(ManufacturerResolutionNote — resolver 결과를 읽는다).
                브랜드 프로필이 제조사를 채운 상품에서 칸은 비고 문단만 값을
                말하니, 화면에 먼저 보이는 글자는 그대로 "제조사 미확인"이었다.
                이제 한 컴포넌트가 **칸과 안내를 함께** 그리고, 칸이 resolver
                결과를 보여준다(세 탭 공용 — 롯데ON도 같은 컴포넌트다). */}
            <ManufacturerField
              field={product.manufacturer}
              resolution={manufacturerResolution}
              onCommit={(v) => fix?.("manufacturer", v)}
              onSetReference={(r) => onSetFieldReference?.("manufacturer", r)}
            />
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
            {/* REWORK-6 ①(CEO 판정, 2026-09-14) — 이 한 칸이 **두 곳으로** 나간다.
                고시정보 모델명은 참조로 대체되지만, 네이버 쇼핑 카탈로그
                모델명(naverShoppingSearchInfo.modelName)은 대체되지 않는다 —
                네이버가 그 자리에 "상품 상세페이지 참조" 문자열을 허용한다는
                근거를 찾지 못했고(공식 문서·GitHub Discussion #2136/#979/#1878
                에 해당 문구 허용 언급 없음), 그 필드는 카탈로그 검색·연결에
                쓰이는 값이라 문구를 채워 보내면 네이버에 거짓 데이터를 보내는
                것이 된다. 그래서 **조용히 비우지 않고 그 자리에서 말한다.** */}
            {/* DELTA-B(CEO 판정, 2026-09-15) — 라벨이 그냥 "모델명"이면 두 개념이
                섞인다. 이 한 칸이 가는 두 자리를 라벨에 그대로 적는다.
                직접 입력하면 **둘 다** 채워지고, 참조를 고르면 고시정보 쪽만
                채워진다(아래 referenceLimitation이 고르기 전에 말한다). */}
            <ReferenceEligibleFieldRow
              /* REWORK-12 ③(CEO 실측 캡처, 2026-09-15: "모델명(고시정보 + 네이버
                 쇼핑 카탈… 에서 잘림") — 이름이 25자라 3열 격자의 한 칸을 넘쳤다.
                 두 자리를 가리킨다는 **사실**은 그대로 두고 글자만 줄인다
                 (고시정보 → 고시 · 네이버 쇼핑 카탈로그 → 카탈로그). 전문은
                 바로 옆 ⓘ와 아래 한 줄이 계속 말한다. */
              label="모델명(고시 + 카탈로그)"
              field={product.modelName}
              onCommit={(v) => fix?.("modelName", v)}
              onSetReference={(r) => onSetFieldReference?.("modelName", r)}
              placeholder="예: B226AC043 (상품코드(SKU)와 다른 값)"
              /* REWORK-11 ⑤(CEO 지시, 2026-09-15: "설명으로 화면을 채우지 마라") —
                 화면에 남는 것은 **이 칸이 무엇인가** 한 줄이고, "고시정보 모델명과는
                 별도"라는 정책은 ⓘ로 접힌다. 문장 자체는 한 글자도 버리지 않았다 —
                 참조를 고르기 전에도 읽을 수 있어야 한다는 REWORK-6의 요구는 그대로다. */
              referenceLimitation="네이버 쇼핑 카탈로그 등록에 사용하는 모델명입니다."
              /* REWORK-12 ⑤(CEO 판정, 2026-09-15: "툴팁 내용이 길어서 보라는건지
                 말라는건지") — 200자 → 58자. 남긴 것은 **무엇인지** 두 마디다:
                 두 모델명은 다른 값이고, 참조는 한쪽만 채운다. 빠진 것은 "왜"와
                 "예외"(어린이제품 카테고리 설명) — 그 사실이 실제로 등록을 막으면
                 부족 항목이 그 자리에서 이름과 사유를 대고 선다. */
              referenceLimitationDetail="「고시정보 모델명」과 「네이버 쇼핑 카탈로그 모델명」은 별도 값입니다. 참조는 고시정보만 채우므로 카탈로그는 직접 입력해야 합니다."
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

        {/* REWORK-10 B — 카테고리 조회 중이라는 사실이 서는 자리. 스마트스토어
            전용 배너가 없어졌으니 이 상태는 다른 섹션(기본정보 · 옵션 · 가격)이
            이미 쓰는 그 슬롯(summary — 접혀 있을 때도 보이는 한 줄)으로 말한다. */}
        <CollapsibleSection
          title={sectionTitle("CATEGORY")}
          badge={sectionCompletionBadge("section-category")}
          summary={categorySummary}
          {...sectionProps("section-category")}
        >
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
            /* REWORK-10 B — 스마트스토어 전용 대기 배너가 없어진 자리. 카테고리
               조회 중이라는 사실은 쿠팡이 이미 쓰던 이 패널 안의 한 줄로 흡수된다. */
            candidatesLoading={naverCategoryLoading}
            /* P1-3 — 조회 «실패»는 스마트스토어 조회에서만 나온다(쿠팡은 자기
               [다시 확인] 버튼과 categoryMetaError를 따로 쓴다). 그래서 쿠팡
               탭에서는 이 자리가 비고, 예전 문구가 그대로 선다. */
            candidatesError={capabilities.hasNaverPreview ? naverCategoryError : null}
            onRetryCandidates={capabilities.hasNaverPreview ? onRetryNaverCategory : undefined}
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
          title={sectionTitle("OPTIONS")}
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

        {/* PHASE 3.2(CPO 확정, 2026-09-11) — 채널별 최종 등록가격.
         *
         * UX 2.5에서 이 자리는 완전한 읽기 전용이었다. 그때 판단의 근거는
         * "판매가는 채널별 값이 아니다"였고, 그건 그 시점에 사실이었다. 이번에
         * 바뀐 것은 화면이 아니라 **데이터 모델**이다: 채널마다 다른 등록가를
         * 실제로 저장할 수 있게 됐다(CanonicalProduct.channelPriceOverrides).
         *
         * 그래도 기본값은 여전히 읽기 전용이다. 가격을 정하는 곳은 상품정보
         * 하나이고, 이 화면은 "그 값을 이 채널에 그대로 쓰겠다"를 기본으로
         * 보여준다. [수정]을 눌러야만 이 채널 전용 값을 만든다 — 편집창을
         * 처음부터 열어두면 UX 2.5 이전으로 돌아가 셀러가 채널마다 가격을
         * 따로 관리해야 한다고 읽는다.
         *
         * 여기서 고친 값은 이 채널에만 적용된다. 상품정보의 최종 판매가격은
         * 절대 바뀌지 않는다(applyChannelPriceOverride가 그 경계다) — 상품정보로
         * 돌아가면 여전히 원래 숫자가 보여야 한다.
         *
         * id="section-price"는 그대로 살아 있어야 한다: readiness.ts의
         * LABEL_TO_SECTION["판매가격"]과 naverFieldSection("originProduct.salePrice")이
         * 이 id로 스크롤하고, readiness.test.ts가 "required이고 READY가 아닌
         * 항목은 갈 곳이 반드시 있다"를 계약으로 검사한다. */}
        <CollapsibleSection
          title={sectionTitle("PRICE")}
          badge={sectionCompletionBadge("section-price")}
          alwaysRenderChildren
          {...sectionProps("section-price")}
        >
          {/* key에 채널을 박는 이유: PlatformPreview는 탭을 바꿔도 같은 자리에
              재사용된다(언마운트되지 않는다). key가 없으면 쿠팡 탭에서 열어둔
              편집 상태가 스마트스토어 탭으로 그대로 넘어가, 다른 채널의 값을
              고치는 것처럼 보인다. */}
          <ChannelPriceSection
            key={listing.platform}
            platformLabel={listing.platformLabel}
            priceKrw={listing.priceKrw}
            priceOrigin={listing.priceOrigin}
            productPriceKrw={productPriceKrw ?? null}
            onUpdateChannelPrice={onUpdateChannelPrice}
            onRequestPriceReview={onRequestPriceReview}
          />
        </CollapsibleSection>

        {/* CEO 지시(2026-08-24, CPO 부재중): "각 커머스별 이미지는 제거하고
         * 공통인 상품정보에서만 관리" — 이미지 Accordion은 이제 "상품정보"
         * (source) 탭 하나에만 있다(CommerceWorkspace.tsx). 여기 있던
         * ImageInlineEditor는 완전히 제거했다 — 중복 관리 지점을 없애는 게
         * 목적이라 숨기지 않고 아예 뺐다. */}

        <CollapsibleSection title={sectionTitle("SHIPPING")} badge={sectionCompletionBadge("section-shipping")} {...sectionProps("section-shipping")}>
          <div className={FIELD_GRID_CLASS}>
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
              비워두면 판매자 기본값(아래 {sectionTitle("SHIPPING_POLICY")} 카드)이 자동 적용됩니다.
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

        <CollapsibleSection title={sectionTitle("NOTICE")} badge={sectionCompletionBadge("section-notice")} {...sectionProps("section-notice")}>
          <p className={SECTION_NOTE_CLASS}>
            🔵 원산지·세탁방법은 상품정보 탭과 공유됩니다 — 어느 탭에서 고쳐도 모든 커머스에 동일하게 적용됩니다.
          </p>
          <div className={FIELD_GRID_NARROW_CLASS}>
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

        <CollapsibleSection title={sectionTitle("KC")} badge={sectionCompletionBadge("section-kc")} {...sectionProps("section-kc")}>
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
                onUpdateKcDeclaration={onUpdateKcDeclaration ?? (() => {})}
                onGoToSection={() => goToSection("section-kc")}
              />
            )}
          {/* 🔴 P0-KC-07(CPO 확정, 2026-09-24) — 여기 있던 한 줄이 위의 두
              블록과 «정반대» 말을 하고 있었다:

                「인증번호를 반드시 입력해야 승인됩니다」

              바로 위 KcSellerStatusBanner 는 「판매 가능 여부를 확인해주세요」 +
              [판매 가능 상품으로 확인] 을 띄우고, KcCertificationBlock 은
              「입력하지 않는 경우 최종 확인에서 직접 확인」이라고 적는데, 그
              아래에서 이 줄이 「반드시 입력」이라고 덮어썼다.

              🔴 P0-KC-06 은 KcCertificationBlock «한 컴포넌트만» 고치고 테스트도
              그 파일만 봤다. 같은 화면의 다른 문구가 정반대를 말하는 것을
              못 잡았다 — 실제 화면을 열지 않고 PASS 를 낸 결과다.

              그리고 이 문장은 사실도 아니다. KC 는 판매자 확인으로도 등록된다
              (isKcStatusRegistrable + seller_compliance_confirmations). 지운다. */}
        </CollapsibleSection>

        <CollapsibleSection title={sectionTitle("DESCRIPTION")} badge={sectionCompletionBadge("section-description")} {...sectionProps("section-description")}>
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
          /* LOTTEON COMMERCE SPRINT 3(CEO 지시, 2026-09-14) — 스마트스토어 탭의
             같은 섹션과 이름을 맞춘다("등록 정보"). 기능은 그대로다 —
             CoupangPayloadInspector도 섹션 id(section-payload)도 안 건드렸다. */
          <CollapsibleSection title={sectionTitle("LISTING_INFO")} {...sectionProps("section-payload")}>
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
    </div>
  );

  return <ChannelRegistrationFrame detail={detail} summary={summary} />;
}
