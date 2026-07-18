"use client";

import { useEffect, useState } from "react";
import { formatBytes, formatDimensions } from "./format";
import type { WorkspaceItem } from "./types";

export function PreviewModal({ item, onClose }: { item: WorkspaceItem; onClose: () => void }) {
  const [zoomed, setZoomed] = useState(false);
  const [compare, setCompare] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const canCompare =
    item.status === "success" && Boolean(item.originalDataUrl) && Boolean(item.detailDataUrl);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <h3 className="text-sm font-medium">{item.fileName}</h3>
          <div className="flex gap-2">
            {canCompare && (
              <button
                type="button"
                onClick={() => setCompare((v) => !v)}
                className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
              >
                {compare ? "비교 끄기" : "원본/결과 비교"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setZoomed((v) => !v)}
              className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
            >
              {zoomed ? "축소" : "확대"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
            >
              닫기
            </button>
          </div>
        </div>

        <div className={`flex-1 gap-4 p-4 ${zoomed ? "overflow-auto" : "overflow-hidden"} flex`}>
          {compare && item.originalDataUrl && (
            <figure className="min-w-0 flex-1">
              <figcaption className="mb-1 text-center text-xs text-zinc-500">원본</figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.originalDataUrl}
                alt="원본"
                className={
                  zoomed ? "max-w-none" : "mx-auto max-h-[55vh] w-auto max-w-full object-contain"
                }
              />
            </figure>
          )}
          {item.detailDataUrl ? (
            <figure className="min-w-0 flex-1">
              {compare && (
                <figcaption className="mb-1 text-center text-xs text-zinc-500">결과</figcaption>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.detailDataUrl}
                alt="결과"
                className={
                  zoomed ? "max-w-none" : "mx-auto max-h-[55vh] w-auto max-w-full object-contain"
                }
              />
            </figure>
          ) : (
            item.originalDataUrl && (
              <figure className="min-w-0 flex-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.originalDataUrl}
                  alt="원본"
                  className={
                    zoomed ? "max-w-none" : "mx-auto max-h-[55vh] w-auto max-w-full object-contain"
                  }
                />
              </figure>
            )
          )}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-zinc-200 px-4 py-3 text-xs text-zinc-600 sm:grid-cols-4">
          <div>
            <dt className="text-zinc-400">타입</dt>
            <dd className="font-medium text-zinc-800">{item.type}</dd>
          </div>
          <div>
            <dt className="text-zinc-400">원본 크기</dt>
            <dd className="font-medium text-zinc-800">
              {formatDimensions(item.originalWidth, item.originalHeight)}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-400">결과 크기</dt>
            <dd className="font-medium text-zinc-800">
              {formatDimensions(item.outputWidth, item.outputHeight)}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-400">파일 크기</dt>
            <dd className="font-medium text-zinc-800">{formatBytes(item.fileSize)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
