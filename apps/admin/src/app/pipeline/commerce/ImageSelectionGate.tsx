"use client";

import type { CanonicalProduct } from "@commerce/shared";
import { ImageCard } from "../ImageCard";
import type { WorkspaceItem } from "../types";

/**
 * 이미지 처리 완료 직후 ~ 상품 등록 준비 화면(CommerceWorkspace) 사이에 끼워 넣는
 * 필수 확인 단계. AI가 고른 대표 이미지(해상도 기준, ResolutionThumbnailSelector)와
 * "상품 이미지로 쓸지"(useInProductGallery) 기본값은 여전히 자동으로 채워지지만,
 * 어디까지나 초기 추천값일 뿐이다 — 이 화면을 통과([이미지 선택 완료])해야만
 * 등록 준비 화면에 갈 수 있으므로, 최종 선택은 항상 사용자가 확정하게 된다.
 *
 * 카드 자체는 새로 만들지 않고 기존 ImageCard를 그대로 재사용한다 — 대표/상품/상세
 * 3-way 컨트롤이 이미 있고, page.tsx의 "상세 정보" 패널과 완전히 같은 방식으로
 * 상태를 다루므로 두 화면이 서로 다르게 동작할 위험이 없다.
 */
export function ImageSelectionGate({
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
  onConfirm,
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
  onConfirm: () => void;
}) {
  const galleryCount = product.images.filter((img) => img.useInProductGallery).length;
  const hasRepresentative = representativeId !== null;
  const canConfirm = hasRepresentative && galleryCount >= 1;

  return (
    <section className="mt-6 rounded-lg border border-border bg-surface p-5 shadow-subtle">
      <h2 className="text-base font-semibold tracking-tight text-text-primary">1. 이미지 선택</h2>
      <p className="mt-1 text-xs text-text-secondary">
        AI가 추천한 대표/상품 이미지가 기본으로 선택되어 있습니다 — 카드에서 직접 바꾸실 수
        있습니다. 대표 이미지는 정확히 1장, 상품 이미지는 1장 이상 선택해야 다음 단계로
        진행할 수 있습니다.
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

      <div className="mt-5 flex flex-col items-start justify-between gap-3 border-t border-border pt-4 sm:flex-row sm:items-center">
        <div className="text-xs text-text-secondary">
          <p>대표 이미지: {hasRepresentative ? "1장 선택됨" : "선택 필요"}</p>
          <p>상품 이미지: {galleryCount}장 선택됨</p>
          {!canConfirm && (
            <p className="mt-1 font-medium text-warning">
              대표 이미지 1장과 상품 이미지 1장 이상을 선택해주세요.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm}
          className="shrink-0 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-subtle transition-colors hover:bg-primary-hover disabled:opacity-40"
        >
          이미지 선택 완료
        </button>
      </div>
    </section>
  );
}
