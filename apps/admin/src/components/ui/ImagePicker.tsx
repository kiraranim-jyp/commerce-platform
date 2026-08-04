"use client";

import { useState } from "react";
import { Button } from "./Button";

export interface ImageAssetOption {
  id: string;
  url: string;
  fileName: string | null;
  tags: string[];
}

export interface ImagePickerProps {
  label: string;
  hint?: string;
  imageUrl: string | null;
  uploading: boolean;
  onUpload: (file: File) => void;
  /** ON/OFF 토글이 필요 없는 곳(예: 브랜드 대표 이미지)은 생략하면 체크박스
   * 자체가 안 그려진다 — CommonImageField와 달리 이 필드는 모든 소비처에
   * 강제하지 않는다. */
  enabled?: boolean;
  onEnabledChange?: (v: boolean) => void;
  /** 있으면 "라이브러리에서 선택" 버튼이 추가로 뜬다. */
  onSelectExisting?: (asset: ImageAssetOption) => void;
}

/** `CommonImageField`를 대체하는 프리미티브 — "업로드"에 더해 "이미지
 * 라이브러리에서 재사용"을 추가했다. 별도 Modal 프리미티브 없이 인라인으로
 * 목록을 펼치는 방식(이번 스프린트는 Modal까지 만들지 않는다 — 계획서 참고). */
export function ImagePicker({
  label,
  hint,
  imageUrl,
  uploading,
  onUpload,
  enabled,
  onEnabledChange,
  onSelectExisting,
}: ImagePickerProps) {
  const [browsing, setBrowsing] = useState(false);
  const [assets, setAssets] = useState<ImageAssetOption[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);

  async function openBrowser() {
    setBrowsing((prev) => !prev);
    if (browsing) return;
    setLoadingAssets(true);
    try {
      const res = await fetch("/api/assets");
      const data = (await res.json()) as { assets?: ImageAssetOption[] };
      setAssets(data.assets ?? []);
    } finally {
      setLoadingAssets(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-text-secondary">{label}</label>
        {hint && <span className="text-xs text-text-tertiary">{hint}</span>}
      </div>
      <div className="mt-1 flex items-center gap-3">
        {imageUrl ? (
          <img src={imageUrl} alt={label} className="h-16 w-16 rounded border border-border object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded border border-dashed border-border text-[10px] text-text-tertiary">
            없음
          </div>
        )}
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file);
                e.target.value = "";
              }}
              className="text-xs text-text-secondary file:mr-2 file:rounded file:border file:border-border file:bg-background file:px-2 file:py-1 file:text-xs"
            />
            {onSelectExisting && (
              <Button type="button" variant="ghost" size="sm" onClick={() => void openBrowser()}>
                라이브러리에서 선택
              </Button>
            )}
          </div>
          {uploading && <span className="text-[11px] text-text-tertiary">업로드 중…</span>}
          {enabled !== undefined && onEnabledChange && (
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={enabled}
                disabled={!imageUrl}
                onChange={(e) => onEnabledChange(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              사용 (ON)
            </label>
          )}
        </div>
      </div>
      {browsing && (
        <div className="mt-2 rounded-[var(--radius-md)] border border-border bg-background p-2">
          {loadingAssets ? (
            <p className="text-xs text-text-tertiary">불러오는 중...</p>
          ) : assets.length === 0 ? (
            <p className="text-xs text-text-tertiary">라이브러리에 저장된 이미지가 없습니다.</p>
          ) : (
            <div className="grid grid-cols-6 gap-2">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => {
                    onSelectExisting?.(asset);
                    setBrowsing(false);
                  }}
                  className="overflow-hidden rounded border border-border transition-colors hover:border-primary"
                  title={asset.fileName ?? undefined}
                >
                  <img src={asset.url} alt={asset.fileName ?? "자산"} className="h-14 w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
