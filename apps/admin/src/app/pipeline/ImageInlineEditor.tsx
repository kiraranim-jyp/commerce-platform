"use client";

import type { CanonicalProduct } from "@commerce/shared";
import { ImageCard } from "./ImageCard";
import type { WorkspaceItem } from "./types";

/**
 * N-3.20(CPO 지시: "세 화면이 동일한 ImageInlineEditor와 동일한 product.images[]
 * 상태를 사용하게 만드는 것") — 예전 ImageGalleryModal의 그리드 렌더링 로직을
 * 그대로 옮겨왔다(핸들러/상태는 전부 그대로, Modal 껍데기만 제거). SmartStore/
 * Coupang 이미지 Accordion과 "원본" 탭이 이 컴포넌트 하나를 공유한다 — 플랫폼별로
 * 따로 만들지 않는다.
 */
export function ImageInlineEditor({
  product,
  items,
  thumbnails,
  representativeId,
  onPreview,
  onSetRepresentative,
  onToggleGalleryUsage,
  onToggleDescriptionUsage,
  onMoveImage,
}: {
  product: CanonicalProduct;
  items: WorkspaceItem[];
  thumbnails: Record<string, string>;
  representativeId: string | null;
  onPreview: (id: string) => void;
  onSetRepresentative: (id: string) => void;
  onToggleGalleryUsage: (id: string) => void;
  onToggleDescriptionUsage: (id: string) => void;
  onMoveImage: (id: string, direction: "up" | "down") => void;
}) {
  if (items.length === 0) return null;

  const representative = product.images.find((img) => img.isRepresentative);
  const representativeItem = representative ? items.find((i) => i.id === representative.id) : undefined;
  const representativeThumbUrl = representativeItem ? thumbnails[representativeItem.id] : undefined;
  const registeredCount = product.images.filter((img) => img.isRepresentative || img.useInProductGallery).length;
  const excludedCount = product.images.length - registeredCount;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-background">
          {representativeThumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={representativeThumbUrl} alt="대표 이미지" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-center text-[10px] text-text-tertiary">
              대표이미지
              <br />
              미선택
            </div>
          )}
        </div>
        <div className="text-xs text-text-secondary">
          <p className="text-sm font-medium text-text-primary">대표 이미지</p>
          <p className="mt-0.5">그리드에서 ⭐를 눌러 변경할 수 있습니다.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {product.images.map((image, index) => {
          const item = items.find((existing) => existing.id === image.id);
          if (!item) return null;
          return (
            <ImageCard
              key={item.id}
              item={item}
              tab="thumbnail"
              thumbnailDataUrl={thumbnails[item.id]}
              isRepresentative={representativeId === item.id}
              useInProductGallery={image.useInProductGallery}
              useInDescription={image.useInDescription}
              isSelected={false}
              retrying={false}
              retryCount={0}
              onPreview={() => onPreview(item.id)}
              onRetry={() => {}}
              onSetRepresentative={() => onSetRepresentative(item.id)}
              onToggleGalleryUsage={() => onToggleGalleryUsage(item.id)}
              onToggleDescriptionUsage={() => onToggleDescriptionUsage(item.id)}
              onMoveUp={index > 0 ? () => onMoveImage(item.id, "up") : undefined}
              onMoveDown={index < product.images.length - 1 ? () => onMoveImage(item.id, "down") : undefined}
            />
          );
        })}
      </div>

      <p className="text-xs text-text-secondary">
        등록 {registeredCount}장{excludedCount > 0 && ` · 제외 ${excludedCount}장`}
      </p>
    </div>
  );
}
