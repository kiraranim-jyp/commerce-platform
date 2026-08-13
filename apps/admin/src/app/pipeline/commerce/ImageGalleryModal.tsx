"use client";

import { useEffect } from "react";
import type { CanonicalProduct } from "@commerce/shared";
import { ImageCard } from "../ImageCard";
import type { WorkspaceItem } from "../types";

/**
 * P0-UI Epic 1 — 예전 ImageRoleGrid의 내용(대표/상품/상세 역할 지정 그리드)을
 * 그대로 모달로 옮긴 것. 카드 자체(ImageCard)는 새로 만들지 않고 재사용한다.
 */
export function ImageGalleryModal({
  product,
  items,
  thumbnails,
  representativeId,
  onPreview,
  onSetRepresentative,
  onToggleGalleryUsage,
  onToggleDescriptionUsage,
  onMoveImage,
  onClose,
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
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const galleryCount = product.images.filter((img) => img.useInProductGallery).length;
  const hasRepresentative = representativeId !== null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-surface"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-text-primary">이미지 관리</h3>
            <p className="mt-0.5 text-xs text-text-secondary">
              대표 이미지: {hasRepresentative ? "1장 선택됨" : "선택 필요"} · 상품 이미지: {galleryCount}장
              선택됨
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border px-2 py-1 text-xs hover:bg-background"
          >
            닫기
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 overflow-y-auto p-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
      </div>
    </div>
  );
}
