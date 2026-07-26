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
import { PLATFORM_ADAPTERS, PLATFORM_ORDER } from "@commerce/marketplace";
import { AIContentPanel } from "./commerce/AIContentPanel";
import { PlatformPreview } from "./commerce/PlatformPreview";
import { ReadinessChecklist } from "./commerce/ReadinessChecklist";
import { SourceDataView } from "./commerce/SourceDataView";

type CommerceTab = "source" | "content" | PlatformId;

const INITIAL_CATEGORY_MAPPINGS: Record<PlatformId, CategorySelection> = {
  smartstore: UNRESOLVED_CATEGORY,
  coupang: UNRESOLVED_CATEGORY,
  elevenst: UNRESOLVED_CATEGORY,
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

  function updateField(
    key: "title" | "brand" | "sku" | "description" | "material" | "titleKo" | "descriptionKo" | "seoTitle" | "seoDescription",
    value: string,
  ) {
    setProduct((prev) => ({
      ...prev,
      [key]: { value, source: "EDITED" as FieldSource, confidence: 1 },
    }));
  }

  function updatePrice(amount: number, currency: string) {
    setProduct((prev) => ({
      ...prev,
      price: { value: { amount, currency }, source: "EDITED" as FieldSource, confidence: 1 },
    }));
  }

  function updateOptions(raw: string) {
    const options = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setProduct((prev) => ({
      ...prev,
      options: { value: options, source: "EDITED" as FieldSource, confidence: 1 },
    }));
  }

  function updateKeywords(raw: string) {
    const keywords = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setProduct((prev) => ({
      ...prev,
      keywords: { value: keywords, source: "EDITED" as FieldSource, confidence: 1 },
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

  return (
    <section className="mt-8 space-y-4">
      <ReadinessChecklist
        product={product}
        categoryMappings={categoryMappings}
        onNavigate={setTab}
      />

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
          onUpdateField={updateField}
          onUpdatePriceKrw={(amountKrw) => updatePrice(amountKrw, "KRW")}
          onSelectCategory={(candidate) => selectCategory(tab, candidate)}
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
