"use client";

import { useState } from "react";
import { formatBytes, formatDimensions } from "./format";
import type { TabKey, WorkspaceItem } from "./types";

/** 다운로드 파일명은 원본 파일명을 최대한 유지하되, 실제 산출물 포맷과 확장자가
 * 다르면(예: 원본 webp를 JPG로 변환) data URL의 진짜 MIME을 기준으로 확장자를
 * 맞춘다 — 그래야 "product.webp"라는 이름으로 실제로는 JPEG 바이트가 저장되는
 * 불일치가 없다. */
function downloadNameFor(fileName: string, dataUrl: string | null | undefined): string {
  if (!dataUrl) return fileName;
  const match = /^data:image\/(\w+);/.exec(dataUrl);
  const mimeSubtype = match?.[1];
  if (!mimeSubtype) return fileName;
  const ext = mimeSubtype === "jpeg" ? "jpg" : mimeSubtype;
  const base = fileName.replace(/\.[^./]+$/, "");
  return `${base}.${ext}`;
}

interface ImageCardProps {
  item: WorkspaceItem;
  tab: TabKey;
  thumbnailDataUrl?: string;
  isExcluded: boolean;
  isRepresentative: boolean;
  /** product.images에 아직 반영 안 됐으면(예: 처리 실패한 이미지) undefined —
   * 그 경우 용도 선택 컨트롤 자체를 숨긴다(등록에 쓰일 수 없는 이미지이므로). */
  useInProductGallery?: boolean;
  useInDescription?: boolean;
  isSelected: boolean;
  retrying: boolean;
  retryCount: number;
  onPreview: () => void;
  onRetry: () => void;
  onSetRepresentative: () => void;
  onToggleGalleryUsage: () => void;
  onToggleDescriptionUsage: () => void;
  onToggleExclude: () => void;
  /** PRODUCT는 원본/배경제거 후보 둘 다 만들어진다 — 이 카드가 지금 어느 쪽을 쓸지
   * 전환한다(alternateDataUrl이 있을 때만 호출 가능). */
  onSwapVariant?: () => void;
}

/**
 * 세 탭 모두 이 카드를 그대로 재사용한다 — 이미지 소스만 탭에 따라 바뀌고
 * (원본/800정사각/1500x2000 결과) 카드 높이와 정보 영역 레이아웃은 고정이라
 * 탭을 전환해도 그리드가 들썩이지 않는다.
 */
export function ImageCard({
  item,
  tab,
  thumbnailDataUrl,
  isExcluded,
  isRepresentative,
  useInProductGallery,
  useInDescription,
  isSelected,
  retrying,
  retryCount,
  onPreview,
  onRetry,
  onSetRepresentative,
  onToggleGalleryUsage,
  onToggleDescriptionUsage,
  onToggleExclude,
  onSwapVariant,
}: ImageCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const previewSrc =
    tab === "original"
      ? item.originalDataUrl
      : tab === "thumbnail"
        ? thumbnailDataUrl
        : item.detailDataUrl;
  const status = retrying ? "processing" : item.status;
  const originalFormat = (item.fileName.split(".").pop() ?? "").toUpperCase();
  const downloadFileName = downloadNameFor(item.fileName, previewSrc);

  return (
    <div
      className={`flex h-[420px] flex-col overflow-hidden rounded-lg border bg-surface transition-opacity ${
        isSelected ? "border-primary ring-2 ring-primary" : "border-border"
      } ${isExcluded ? "opacity-40" : ""}`}
    >
      <button
        type="button"
        onClick={onPreview}
        disabled={!previewSrc}
        className="relative flex h-48 shrink-0 items-center justify-center bg-[repeating-conic-gradient(#eee_0_25%,white_0_50%)_0_0/16px_16px]"
      >
        {previewSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewSrc}
            alt={item.fileName}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <span className="text-xs text-text-tertiary">미리보기 없음</span>
        )}
        {tab === "thumbnail" && (
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onSetRepresentative();
            }}
            title="대표 이미지로 지정"
            className="absolute right-1.5 top-1.5 text-xl leading-none drop-shadow"
          >
            {isRepresentative ? "⭐" : "☆"}
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-0.5 p-3 text-xs">
        <p className="truncate font-medium text-text-primary" title={item.fileName}>
          {item.fileName}
        </p>
        <p>
          {status === "success" && <span>🟢 Success</span>}
          {status === "processing" && <span>🟡 Processing</span>}
          {status === "failed" && <span>🔴 Failed</span>}
        </p>
        {status === "failed" && item.failureReason && (
          <p className="line-clamp-2 text-error" title={item.failureReason}>
            {item.failureReason}
          </p>
        )}

        <button
          type="button"
          onClick={() => setDetailsOpen((v) => !v)}
          className="mt-0.5 self-start text-text-tertiary underline-offset-2 hover:underline"
        >
          처리 정보 {detailsOpen ? "숨기기 ▲" : "보기 ▼"}
        </button>

        {detailsOpen && (
          <div className="flex flex-col gap-0.5">
            <p className="text-text-secondary">Type: {item.type}</p>
            <p className="text-text-secondary">
              Original: {formatDimensions(item.originalWidth, item.originalHeight)} ({originalFormat})
            </p>
            <p className="text-text-secondary">
              Output: {formatDimensions(item.outputWidth, item.outputHeight)}
              {item.status === "success" ? " (JPEG)" : ""}
            </p>
            <p className="text-text-secondary">File: {formatBytes(item.fileSize)}</p>
            {item.status === "success" && (
              <p className={item.isJPEG ? "text-success" : "text-error"}>
                {item.isJPEG ? "✓ JPG 표준화 완료" : "✕ JPG 검증 실패"}
              </p>
            )}
            {item.type === "PRODUCT" && item.status === "success" && (
              <p className="text-text-secondary">
                Processing: ✦ 배경제거 후보
                {item.quality && ` (${item.usedOriginal ? "원본 사용" : "누끼 사용"})`}
              </p>
            )}
            {item.quality && (
              <p className="text-text-secondary">
                Quality {item.quality.overall}/100 · Background:{" "}
                {item.usedOriginal ? "원본 유지" : "제거됨"}
              </p>
            )}
            <p className="text-text-secondary">Processing: {item.processingTimeSec}s</p>
          </div>
        )}

        {useInProductGallery != null && useInDescription != null && (
          <div className="mt-1 flex flex-col gap-0.5 border-t border-border pt-1.5 text-[11px]">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name={`representative-${item.id}`}
                checked={isRepresentative}
                onChange={onSetRepresentative}
              />
              대표 이미지
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={useInProductGallery} onChange={onToggleGalleryUsage} />
              상품 이미지
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={useInDescription} onChange={onToggleDescriptionUsage} />
              상세페이지
            </label>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <label className="flex items-center gap-1 text-text-secondary">
            <input type="checkbox" checked={isExcluded} onChange={onToggleExclude} />
            제외
          </label>

          <div className="flex items-center gap-2">
            {item.alternateDataUrl && onSwapVariant && (
              <button
                type="button"
                onClick={onSwapVariant}
                title={
                  item.alternateKind === "PROCESSED"
                    ? "배경제거 후보로 전환"
                    : "원본으로 전환"
                }
                className="rounded border border-border px-2 py-1 font-medium text-text-primary hover:bg-background"
              >
                {item.alternateKind === "PROCESSED" ? "⇄ 누끼 후보" : "⇄ 원본"}
              </button>
            )}
            {previewSrc && (
              <a
                href={previewSrc}
                download={downloadFileName}
                className="rounded border border-border px-2 py-1 font-medium text-text-primary hover:bg-background"
              >
                ⬇ Download
              </a>
            )}
            {status === "failed" && (
              <button
                type="button"
                onClick={onRetry}
                disabled={retrying}
                className="rounded border border-border px-2 py-1 font-medium text-text-primary hover:bg-background disabled:opacity-50"
              >
                {retrying ? "재실행 중..." : retryCount > 0 ? `재실행 (${retryCount}회)` : "재실행"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
