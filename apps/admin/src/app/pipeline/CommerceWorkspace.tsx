"use client";

import { useMemo, useState } from "react";
import type { CanonicalProduct, FieldSource, PlatformId } from "@commerce/shared";
import {
  ruleBasedCategoryProvider,
  UNRESOLVED_CATEGORY,
  type CategoryCandidate,
  type CategorySelection,
} from "@commerce/category";
import { PLATFORM_ADAPTERS, PLATFORM_ORDER } from "@commerce/marketplace";
import { PlatformPreview } from "./commerce/PlatformPreview";
import { SourceDataView } from "./commerce/SourceDataView";

type CommerceTab = "source" | PlatformId;

const INITIAL_CATEGORY_MAPPINGS: Record<PlatformId, CategorySelection> = {
  smartstore: UNRESOLVED_CATEGORY,
  coupang: UNRESOLVED_CATEGORY,
  elevenst: UNRESOLVED_CATEGORY,
};

/**
 * CanonicalProduct 하나를 들고 있다가 Source Data / SmartStore / Coupang / 11번가
 * 탭을 전환할 때마다 같은 데이터를 해당 플랫폼 Adapter에 통과시켜 다시 렌더링한다.
 * 플랫폼별로 데이터를 복제하지 않는다 — 새 플랫폼을 추가하려면 PLATFORM_ADAPTERS에
 * Adapter 하나만 등록하면 이 컴포넌트는 그대로 재사용된다.
 */
export function CommerceWorkspace({ initialProduct }: { initialProduct: CanonicalProduct }) {
  const [product, setProduct] = useState(initialProduct);
  const [tab, setTab] = useState<CommerceTab>("source");
  const [categoryMappings, setCategoryMappings] = useState(INITIAL_CATEGORY_MAPPINGS);

  function updateField(
    key: "title" | "brand" | "sku" | "description" | "material",
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

  const categoryCandidates = useMemo(() => {
    if (tab === "source") return [];
    return ruleBasedCategoryProvider.recommendCategory(product, tab);
  }, [tab, product]);

  /**
   * 저장된 선택이 아직 UNRESOLVED인데 추천 후보가 있으면, 실제로 state를 바꾸지
   * 않고 렌더링/Validation에만 "RECOMMENDED + 1순위 후보"로 보이게 한다 — 사용자가
   * [선택]을 눌러야만 진짜 SELECTED로 커밋된다(추천이 보이는 것과 확정한 것을 구분).
   */
  const effectiveCategorySelection = useMemo((): CategorySelection => {
    if (tab === "source") return UNRESOLVED_CATEGORY;
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
    if (tab === "source") return null;
    return PLATFORM_ADAPTERS[tab].toListingModel(product, effectiveCategorySelection);
  }, [tab, product, effectiveCategorySelection]);

  return (
    <section className="mt-8 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Commerce Listing Preview</h2>
        <p className="mt-1 text-sm text-zinc-500">
          같은 상품 데이터를 플랫폼별 등록 화면 형태로 미리 확인합니다. 실제 API 등록은
          아직 수행하지 않습니다.
        </p>
      </div>

      <div className="flex gap-1 border-b border-zinc-200">
        <TabButton active={tab === "source"} onClick={() => setTab("source")}>
          Source Data
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

      {listing && tab !== "source" && (
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
      className={`px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-b-2 border-black text-black"
          : "border-b-2 border-transparent text-zinc-500 hover:text-zinc-700"
      }`}
    >
      {children}
    </button>
  );
}
