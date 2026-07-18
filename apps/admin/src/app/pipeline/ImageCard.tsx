"use client";

import { formatBytes, formatDimensions } from "./format";
import type { TabKey, WorkspaceItem } from "./types";

interface ImageCardProps {
  item: WorkspaceItem;
  tab: TabKey;
  thumbnailDataUrl?: string;
  isExcluded: boolean;
  isRepresentative: boolean;
  retrying: boolean;
  onPreview: () => void;
  onRetry: () => void;
  onToggleRepresentative: () => void;
  onToggleExclude: () => void;
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
  retrying,
  onPreview,
  onRetry,
  onToggleRepresentative,
  onToggleExclude,
}: ImageCardProps) {
  const previewSrc =
    tab === "original"
      ? item.originalDataUrl
      : tab === "thumbnail"
        ? thumbnailDataUrl
        : item.detailDataUrl;
  const status = retrying ? "processing" : item.status;

  return (
    <div
      className={`flex h-[380px] flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white transition-opacity ${
        isExcluded ? "opacity-40" : ""
      }`}
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
          <span className="text-xs text-zinc-400">미리보기 없음</span>
        )}
        {tab === "thumbnail" && (
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onToggleRepresentative();
            }}
            title="네이버 대표 이미지로 지정"
            className="absolute right-1.5 top-1.5 text-xl leading-none drop-shadow"
          >
            {isRepresentative ? "⭐" : "☆"}
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-0.5 p-3 text-xs">
        <p className="truncate font-medium text-zinc-800" title={item.fileName}>
          {item.fileName}
        </p>
        <p className="text-zinc-500">
          Original: {formatDimensions(item.originalWidth, item.originalHeight)}
        </p>
        <p className="text-zinc-500">
          Output: {formatDimensions(item.outputWidth, item.outputHeight)}
        </p>
        <p className="text-zinc-500">File: {formatBytes(item.fileSize)}</p>

        <p className="mt-0.5">
          {status === "success" && <span>🟢 Success</span>}
          {status === "processing" && <span>🟡 Processing</span>}
          {status === "failed" && <span>🔴 Failed</span>}
        </p>
        {status === "failed" && item.failureReason && (
          <p className="line-clamp-2 text-red-600" title={item.failureReason}>
            {item.failureReason}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <label className="flex items-center gap-1 text-zinc-500">
            <input type="checkbox" checked={isExcluded} onChange={onToggleExclude} />
            제외
          </label>

          {status === "success" && item.detailDataUrl && (
            <a
              href={item.detailDataUrl}
              download={item.fileName}
              className="rounded border border-zinc-300 px-2 py-1 font-medium hover:bg-zinc-50"
            >
              다운로드
            </a>
          )}
          {status === "failed" && (
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="rounded border border-zinc-300 px-2 py-1 font-medium hover:bg-zinc-50 disabled:opacity-50"
            >
              {retrying ? "재실행 중..." : "재실행"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
