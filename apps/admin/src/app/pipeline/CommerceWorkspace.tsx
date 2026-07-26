"use client";

import { useMemo, useState } from "react";
import type { CanonicalProduct, FieldSource, PlatformId } from "@commerce/shared";
import {
  ruleBasedCategoryProvider,
  UNRESOLVED_CATEGORY,
  type CategoryCandidate,
  type CategorySelection,
} from "@commerce/category";
import { mockProductContentProvider } from "@commerce/content";
import {
  LISTING_EXECUTORS,
  validateSmartStoreListing,
  type ListingResult,
  type ListingStatus,
  type RegistrationHistoryEntry,
} from "@commerce/listing";
import { PLATFORM_ADAPTERS, PLATFORM_ORDER } from "@commerce/marketplace";
import { AIContentPanel } from "./commerce/AIContentPanel";
import { ListingConfirmationModal } from "./commerce/ListingConfirmationModal";
import { PlatformPreview } from "./commerce/PlatformPreview";
import { RegistrationHistoryPanel } from "./commerce/RegistrationHistoryPanel";
import { StageStepper } from "./commerce/StageStepper";
import { SourceDataView } from "./commerce/SourceDataView";

type CommerceTab = "source" | "content" | PlatformId;

const INITIAL_CATEGORY_MAPPINGS: Record<PlatformId, CategorySelection> = {
  smartstore: UNRESOLVED_CATEGORY,
  coupang: UNRESOLVED_CATEGORY,
  elevenst: UNRESOLVED_CATEGORY,
};

const INITIAL_LISTING_STATES: Record<PlatformId, ListingStatus> = {
  smartstore: "DRAFT",
  coupang: "DRAFT",
  elevenst: "DRAFT",
};

const INITIAL_LISTING_RESULTS: Record<PlatformId, ListingResult | null> = {
  smartstore: null,
  coupang: null,
  elevenst: null,
};

const TAB_LABELS: Record<Exclude<CommerceTab, PlatformId>, string> = {
  source: "상품 정보",
  content: "AI 콘텐츠",
};

/**
 * CanonicalProduct 하나를 들고 있다가 상품 정보 / AI 콘텐츠 / 스마트스토어 / 쿠팡 /
 * 11번가 탭을 전환할 때마다 같은 데이터를 해당 플랫폼 Adapter에 통과시켜 다시
 * 렌더링한다. 플랫폼별로 데이터를 복제하지 않는다 — 새 플랫폼을 추가하려면
 * PLATFORM_ADAPTERS에 Adapter 하나만 등록하면 이 컴포넌트는 그대로 재사용된다.
 */
export function CommerceWorkspace({ initialProduct }: { initialProduct: CanonicalProduct }) {
  const [product, setProduct] = useState(initialProduct);
  const [tab, setTab] = useState<CommerceTab>("source");
  const [categoryMappings, setCategoryMappings] = useState(INITIAL_CATEGORY_MAPPINGS);
  const [listingStates, setListingStates] = useState(INITIAL_LISTING_STATES);
  const [listingResults, setListingResults] = useState(INITIAL_LISTING_RESULTS);
  const [confirmingPlatform, setConfirmingPlatform] = useState<PlatformId | null>(null);
  const [registrationHistory, setRegistrationHistory] = useState<RegistrationHistoryEntry[]>([]);

  function updateField(
    key:
      | "title"
      | "brand"
      | "sku"
      | "description"
      | "material"
      | "titleKo"
      | "descriptionKo"
      | "seoTitle"
      | "seoDescription"
      | "countryOfOrigin"
      | "returnPolicy",
    value: string,
  ) {
    setProduct((prev) => ({
      ...prev,
      [key]: { value, source: "USER_EDITED" as FieldSource, confidence: 1 },
    }));
  }

  function updateNumberField(key: "shippingFee" | "stockQuantity", value: number) {
    setProduct((prev) => ({
      ...prev,
      [key]: { value, source: "USER_EDITED" as FieldSource, confidence: 1 },
    }));
  }

  function updatePrice(amount: number, currency: string) {
    setProduct((prev) => ({
      ...prev,
      price: { value: { amount, currency }, source: "USER_EDITED" as FieldSource, confidence: 1 },
    }));
  }

  function updateOptions(raw: string) {
    const options = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setProduct((prev) => ({
      ...prev,
      options: { value: options, source: "USER_EDITED" as FieldSource, confidence: 1 },
    }));
  }

  function updateKeywords(raw: string) {
    const keywords = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setProduct((prev) => ({
      ...prev,
      keywords: { value: keywords, source: "USER_EDITED" as FieldSource, confidence: 1 },
    }));
  }

  function generateContent() {
    setProduct((prev) => {
      const seo = mockProductContentProvider.generateSeo(prev);
      return {
        ...prev,
        titleKo: mockProductContentProvider.generateTitle(prev),
        descriptionKo: mockProductContentProvider.generateDescription(prev),
        keywords: mockProductContentProvider.generateKeywords(prev),
        seoTitle: seo.title,
        seoDescription: seo.description,
      };
    });
  }

  const categoryCandidates = useMemo(() => {
    if (tab === "source" || tab === "content") return [];
    return ruleBasedCategoryProvider.recommendCategory(product, tab);
  }, [tab, product]);

  /**
   * 저장된 선택이 아직 UNRESOLVED인데 추천 후보가 있으면, 실제로 state를 바꾸지
   * 않고 렌더링/Validation에만 "RECOMMENDED + 1순위 후보"로 보이게 한다 — 사용자가
   * [선택]을 눌러야만 진짜 SELECTED로 커밋된다(추천이 보이는 것과 확정한 것을 구분).
   */
  const effectiveCategorySelection = useMemo((): CategorySelection => {
    if (tab === "source" || tab === "content") return UNRESOLVED_CATEGORY;
    const stored = categoryMappings[tab];
    if (stored.state === "UNRESOLVED" && categoryCandidates.length > 0) {
      return { state: "RECOMMENDED", candidate: categoryCandidates[0], provenance: "RECOMMENDED" };
    }
    return stored;
  }, [tab, categoryMappings, categoryCandidates]);

  function selectCategory(platform: PlatformId, candidate: CategoryCandidate) {
    setCategoryMappings((prev) => ({
      ...prev,
      [platform]: { state: "SELECTED", candidate, provenance: "USER_SELECTED" },
    }));
  }

  const listing = useMemo(() => {
    if (tab === "source" || tab === "content") return null;
    return PLATFORM_ADAPTERS[tab].toListingModel(product, effectiveCategorySelection);
  }, [tab, product, effectiveCategorySelection]);

  /**
   * SmartStore에서만 계산한다 — 원산지/반품정보/배송비/재고 같은 등록 직전
   * 필드는 CanonicalProduct에만 있고 ListingModel에는 없어서, product와 listing을
   * 둘 다 받는 이 함수로 합쳐야 한다(STEP 1의 3단 분리 원칙).
   */
  const smartStoreReadiness = useMemo(() => {
    if (tab !== "smartstore" || !listing) return undefined;
    return validateSmartStoreListing(product, listing);
  }, [tab, listing, product]);

  /**
   * DRAFT인데 ERROR급 validation이 하나도 없으면 화면에는 READY로 보여준다 —
   * 카테고리의 RECOMMENDED와 같은 패턴으로, 실제 state는 사용자가 등록 버튼을
   * 눌러야만(USER_CONFIRMED로) 바뀐다. SmartStore는 원산지/반품정보 누락도
   * ERROR로 잡아야 하므로 readiness.errorCount도 함께 확인한다.
   */
  const effectiveListingStatus: ListingStatus = useMemo(() => {
    if (tab === "source" || tab === "content" || !listing) return "DRAFT";
    const stored = listingStates[tab];
    if (stored !== "DRAFT") return stored;
    const noMarketplaceErrors = listing.validations.every((v) => v.status !== "ERROR");
    const noReadinessErrors = smartStoreReadiness ? smartStoreReadiness.errorCount === 0 : true;
    return noMarketplaceErrors && noReadinessErrors ? "READY" : "DRAFT";
  }, [tab, listing, listingStates, smartStoreReadiness]);

  function openListingModal() {
    if (tab === "source" || tab === "content") return;
    setListingStates((prev) => ({ ...prev, [tab]: "USER_CONFIRMED" }));
    setConfirmingPlatform(tab);
  }

  function cancelListingModal() {
    if (confirmingPlatform) {
      setListingStates((prev) => ({ ...prev, [confirmingPlatform]: "DRAFT" }));
    }
    setConfirmingPlatform(null);
  }

  async function confirmListing() {
    if (!confirmingPlatform || !listing) return;
    const platform = confirmingPlatform;
    setConfirmingPlatform(null);
    setListingStates((prev) => ({ ...prev, [platform]: "SUBMITTING" }));
    const result = await LISTING_EXECUTORS[platform].execute(product, listing, "DRY_RUN");
    setListingResults((prev) => ({ ...prev, [platform]: result }));
    setRegistrationHistory((prev) => [
      {
        productName: listing.title,
        platform,
        executedAt: new Date().toISOString(),
        mode: "DRY_RUN",
        result,
      },
      ...prev,
    ]);
    setListingStates((prev) => ({ ...prev, [platform]: result.status }));
  }

  function retryListing() {
    if (tab === "source" || tab === "content") return;
    setListingStates((prev) => ({ ...prev, [tab]: "DRAFT" }));
    setListingResults((prev) => ({ ...prev, [tab]: null }));
  }

  return (
    <section className="mt-8 space-y-4">
      <StageStepper product={product} categoryMappings={categoryMappings} onNavigate={setTab} />

      <div className="flex gap-1 overflow-x-auto border-b border-border">
        <TabButton active={tab === "source"} onClick={() => setTab("source")}>
          {TAB_LABELS.source}
        </TabButton>
        <TabButton active={tab === "content"} onClick={() => setTab("content")}>
          {TAB_LABELS.content}
        </TabButton>
        {PLATFORM_ORDER.map((platformId) => (
          <TabButton
            key={platformId}
            active={tab === platformId}
            onClick={() => setTab(platformId)}
          >
            {PLATFORM_ADAPTERS[platformId].label}
          </TabButton>
        ))}
      </div>

      {tab === "source" && (
        <SourceDataView
          product={product}
          onUpdateField={updateField}
          onUpdatePrice={updatePrice}
          onUpdateOptions={updateOptions}
        />
      )}

      {tab === "content" && (
        <AIContentPanel
          product={product}
          onGenerate={generateContent}
          onUpdateField={updateField}
          onUpdateKeywords={updateKeywords}
        />
      )}

      {listing && tab !== "source" && tab !== "content" && (
        <PlatformPreview
          listing={listing}
          categoryCandidates={categoryCandidates}
          listingStatus={effectiveListingStatus}
          listingResult={listingResults[tab]}
          readiness={smartStoreReadiness}
          onUpdateField={updateField}
          onUpdatePriceKrw={(amountKrw) => updatePrice(amountKrw, "KRW")}
          onSelectCategory={(candidate) => selectCategory(tab, candidate)}
          onFixTextField={updateField}
          onFixNumberField={updateNumberField}
          onOpenListingModal={openListingModal}
          onRetryListing={retryListing}
        />
      )}

      <RegistrationHistoryPanel history={registrationHistory} />

      {confirmingPlatform && listing && (
        <ListingConfirmationModal
          listing={listing}
          onCancel={cancelListingModal}
          onConfirm={confirmListing}
        />
      )}
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-b-2 border-primary text-primary"
          : "border-b-2 border-transparent text-text-secondary hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}
