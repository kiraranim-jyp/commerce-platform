"use client";

import type { CanonicalProduct } from "@commerce/shared";
import { ImageCard } from "../ImageCard";
import type { WorkspaceItem } from "../types";

/**
 * 상품 정보 화면에 통합된 이미지 역할 선택 그리드 — 예전에는 별도 "이미지 선택"
 * 화면(ImageSelectionGate)이 상품정보 화면 앞을 가로막았지만, 이제는 상품정보 탭
 * 안에서 원본 이미지 미리보기와 함께 바로 대표/상품/상세 역할을 고른다. AI가 고른
 * 대표/상품 이미지 기본값은 여전히 자동으로 채워지지만 사용자가 카드에서 언제든
 * 바꿀 수 있고, 별도 확인 버튼 없이 즉시 상품 데이터(product.images)에 반영된다.
 *
 * 카드 자체는 새로 만들지 않고 기존 ImageCard를 그대로 재사용한다 — 대표/상품/상세
 * 3-way 컨트롤과 다운로드 버튼이 이미 있다.
 */
export function ImageRoleGrid({
  product,
  items,
  thumbnails,
  representativeId,
  excludedIds,
  onPreview,
  onSetRepresentative,
  onToggleGalleryUsage,
  onToggleDescriptionUsage,
  onToggleExclude,
}: {
  product: CanonicalProduct;
  items: WorkspaceItem[];
  thumbnails: Record<string, string>;
  representativeId: string | null;
  excludedIds: Set<string>;
  onPreview: (id: string) => void;
  onSetRepresentative: (id: string) => void;
  onToggleGalleryUsage: (id: string) => void;
  onToggleDescriptionUsage: (id: string) => void;
  onToggleExclude: (id: string) => void;
}) {
  if (items.length === 0) return null;

  const galleryCount = product.images.filter((img) => img.useInProductGallery).length;
  const hasRepresentative = representativeId !== null;

  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-subtle">
      <h2 className="text-base font-semibold tracking-tight text-text-primary">이미지</h2>
      <p className="mt-1 text-xs text-text-secondary">
        AI가 추천한 대표/상품 이미지가 기본으로 선택되어 있습니다 — 카드에서 직접 바꾸실 수
        있습니다.
      </p>
      <p className="mt-1 text-xs text-text-secondary">
        대표 이미지: {hasRepresentative ? "1장 선택됨" : "선택 필요"} · 상품 이미지: {galleryCount}장
        선택됨
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((item) => {
          const imageUsage = product.images.find((img) => img.id === item.id);
          return (
            <ImageCard
              key={item.id}
              item={item}
              tab="thumbnail"
              thumbnailDataUrl={thumbnails[item.id]}
              isExcluded={excludedIds.has(item.id)}
              isRepresentative={representativeId === item.id}
              useInProductGallery={imageUsage?.useInProductGallery}
              useInDescription={imageUsage?.useInDescription}
              isSelected={false}
              retrying={false}
              retryCount={0}
              onPreview={() => onPreview(item.id)}
              onRetry={() => {}}
              onSetRepresentative={() => onSetRepresentative(item.id)}
              onToggleGalleryUsage={() => onToggleGalleryUsage(item.id)}
              onToggleDescriptionUsage={() => onToggleDescriptionUsage(item.id)}
              onToggleExclude={() => onToggleExclude(item.id)}
            />
          );
        })}
      </div>
    </section>
  );
}
