"use client";

import type { CanonicalProduct } from "@commerce/shared";
import type { WorkspaceItem } from "../types";

/**
 * P0-UI Epic 1(이미지 영역 단순화) — 예전에는 이 자리에 전체 이미지 그리드
 * (ImageRoleGrid, 대표/상품/상세 3-way 컨트롤이 이미지 개수만큼 반복)가 항상
 * 펼쳐져 있었다. 이제 대표이미지 1장 + "총 이미지 N장"만 보여주고, 실제 역할
 * 지정(대표/상품/상세)은 이 카드를 눌렀을 때 뜨는 갤러리(ImageGalleryModal)
 * 안에서 한다 — 기능은 그대로, 기본 화면 차지 면적만 줄인다.
 */
export function ImageSummaryCard({
  product,
  items,
  thumbnails,
  onOpen,
}: {
  product: CanonicalProduct;
  items: WorkspaceItem[];
  thumbnails: Record<string, string>;
  onOpen: () => void;
}) {
  if (items.length === 0) return null;

  const representative = product.images.find((img) => img.isRepresentative);
  const representativeItem = representative ? items.find((i) => i.id === representative.id) : undefined;
  const thumbUrl = representativeItem ? thumbnails[representativeItem.id] : undefined;
  // N-3.19 — 여기 숫자도 실제 등록 payload가 쓰는 기준(isRepresentative ||
  // useInProductGallery)과 같아야 한다. 예전엔 items.length(원본 전체 장수)만
  // 보여줘서 "등록에서 제외"한 이미지까지 등록되는 것처럼 보였다.
  const registeredCount = product.images.filter((img) => img.isRepresentative || img.useInProductGallery).length;
  const excludedCount = product.images.length - registeredCount;

  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-subtle">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-4 text-left"
      >
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-background">
          {thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbUrl} alt="대표 이미지" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-text-tertiary">
              대표이미지
              <br />
              미선택
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">이미지</p>
          <p className="mt-0.5 text-xs text-text-secondary">
            원본 {product.images.length}장 · 등록 {registeredCount}장
            {excludedCount > 0 && ` · 제외 ${excludedCount}장`}
          </p>
          <p className="mt-1 text-xs font-medium text-primary">이미지 관리 →</p>
        </div>
      </button>
    </section>
  );
}
