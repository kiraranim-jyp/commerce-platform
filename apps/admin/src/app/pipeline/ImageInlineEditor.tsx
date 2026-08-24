"use client";

import type { CanonicalProduct } from "@commerce/shared";
import { Card } from "@/components/ui/Card";
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
  onAddImage,
  onRemoveImage,
  addingImage,
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
  /** CEO 지시(2026-08-24): "이미지는 내가 추가/제거 할 수 있어야 해". 커머스별
   * 탭에는 더 이상 이미지 섹션이 없다 — 상품정보(source) 탭 하나에서만 이 두
   * 콜백을 넘긴다(PlatformPreview는 이 프로퍼티를 받지 않는다). */
  onAddImage?: (file: File) => void;
  onRemoveImage?: (id: string) => void;
  addingImage?: boolean;
}) {
  // N-4.13-이미지공통화(대표님 지시) — 예전엔 items.length===0이면 컴포넌트
  // 전체가 안 그려져서, 크롤링이 이미지를 하나도 못 가져온 상품은 "이미지
  // 추가" 버튼조차 보일 수 없었다. onAddImage가 있는 화면(상품정보 탭)에서는
  // 항상 추가 버튼만은 그려야 한다.
  if (items.length === 0 && !onAddImage) return null;

  const representative = product.images.find((img) => img.isRepresentative);
  const representativeItem = representative ? items.find((i) => i.id === representative.id) : undefined;
  const representativeThumbUrl = representativeItem ? thumbnails[representativeItem.id] : undefined;
  const registeredCount = product.images.filter((img) => img.isRepresentative || img.useInProductGallery).length;
  const excludedCount = product.images.length - registeredCount;

  return (
    <div className="flex flex-col gap-4">
      <Card padding="sm" className="flex items-center gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-md)] border border-border bg-background">
          {representativeThumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={representativeThumbUrl} alt="대표 이미지" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-center text-[10px] leading-tight text-text-tertiary">
              대표이미지
              <br />
              미선택
            </div>
          )}
        </div>
        <div className="text-xs">
          <p className="text-sm font-semibold text-text-primary">대표 이미지</p>
          <p className="mt-0.5 text-text-secondary">아래 그리드에서 ★을 눌러 변경할 수 있습니다.</p>
        </div>
      </Card>

      {/* N-3.21 — 예전 ImageGalleryModal은 max-w-5xl(1024px) 모달 안에서 xl:5열까지
       * 썼다. Inline으로 옮긴 뒤에는 SmartStore/Coupang 아코디언이 우측 sticky
       * 요약 카드와 폭을 나눠 쓰는 좁은 컬럼(~605px)이라, 같은 5열 기준을 그대로
       * 쓰면 카드 폭이 100px대로 눌려 정보가 과밀해진다. 4열로 낮춰 두 컨텍스트
       * (원본 탭의 넓은 폭, 플랫폼 탭의 좁은 폭) 모두에서 카드가 읽을 수 있는
       * 폭을 유지하게 한다. */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
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
              onRemove={onRemoveImage ? () => onRemoveImage(item.id) : undefined}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-text-secondary">
          등록 {registeredCount}장{excludedCount > 0 && ` · 제외 ${excludedCount}장`}
        </p>
        {onAddImage && (
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[var(--radius-md)] border border-dashed border-border-strong px-3 text-xs font-medium text-text-secondary transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary">
            {addingImage ? "업로드 중…" : "+ 이미지 추가"}
            <input
              type="file"
              accept="image/*"
              disabled={addingImage}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onAddImage(file);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}
