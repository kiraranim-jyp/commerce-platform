"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
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
  /** N-3.19(CPO 지시: "삭제 = 상품 등록에서 제외") — 이 하나의 토글이
   * product.images[].useInProductGallery를 직접 뒤집는다. 예전 excludedIds
   * (카드만 회색 처리하고 payload는 안 바뀌던 별도 state)를 없애고 이걸로
   * 통일했다 — "제외"를 눌렀는데 실제 등록엔 계속 들어가는 이중 상태를 막는다. */
  onToggleGalleryUsage: () => void;
  onToggleDescriptionUsage: () => void;
  /** 순서 변경 — product.images[] 배열 자체가 canonical order라 별도
   * imageOrder 필드 없이 이 두 콜백이 배열의 인접 원소를 swap한다. 맨
   * 앞/뒤 이미지는 해당 방향 콜백이 undefined로 넘어와 버튼이 안 보인다. */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  /** PRODUCT는 원본/배경제거 후보 둘 다 만들어진다 — 이 카드가 지금 어느 쪽을 쓸지
   * 전환한다(alternateDataUrl이 있을 때만 호출 가능). */
  onSwapVariant?: () => void;
  /** CEO 지시(2026-08-24): "이미지는 내가 추가/제거 할 수 있어야 해 — 각 이미지별
   * 제거 버튼". 기존 "등록에서 제외"(useInProductGallery 토글, N-3.19)는 되돌릴 수
   * 있는 소프트 제외였고, 이건 완전히 별개로 배열에서 실제로 빼는 하드 삭제다.
   * 없으면(예: 처리 실패해서 product.images에 아직 없는 카드) 버튼 자체를 숨긴다. */
  onRemove?: () => void;
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
  onMoveUp,
  onMoveDown,
  onSwapVariant,
  onRemove,
}: ImageCardProps) {
  const isExcluded = useInProductGallery === false;
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
    <Card
      padding="none"
      className={`flex h-[420px] flex-col overflow-hidden transition-opacity ${
        isSelected ? "ring-2 ring-primary" : ""
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
            className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-sm shadow-[var(--shadow-subtle)] transition-colors ${
              isRepresentative
                ? "bg-primary text-white"
                : "bg-white/90 text-text-tertiary hover:text-warning"
            }`}
          >
            {isRepresentative ? "★" : "☆"}
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-1 p-3 text-xs">
        <p className="truncate font-medium text-text-primary" title={item.fileName}>
          {item.fileName}
        </p>
        <StatusBadge
          status={status === "success" ? "success" : status === "processing" ? "warning" : "error"}
          label={status === "success" ? "완료" : status === "processing" ? "처리 중" : "실패"}
        />
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
          처리 정보 {detailsOpen ? "접기 ▲" : "펼치기 ▼"}
        </button>

        {detailsOpen && (
          <div className="flex flex-col gap-0.5 rounded-[var(--radius-sm)] bg-background p-2">
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
          <div className="mt-1 flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
            <button
              type="button"
              onClick={onSetRepresentative}
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                isRepresentative
                  ? "bg-primary-soft text-primary"
                  : "bg-background text-text-tertiary hover:text-text-secondary"
              }`}
            >
              {isRepresentative ? "★ 대표 이미지" : "대표로 설정"}
            </button>
            <button
              type="button"
              onClick={onToggleDescriptionUsage}
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                useInDescription
                  ? "bg-primary-soft text-primary"
                  : "bg-background text-text-tertiary hover:text-text-secondary"
              }`}
            >
              상세페이지 {useInDescription ? "사용" : "미사용"}
            </button>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2">
          <div className="flex items-center gap-1">
            {(onMoveUp || onMoveDown) && (
              <>
                <button
                  type="button"
                  onClick={onMoveUp}
                  disabled={!onMoveUp}
                  title="순서 위로"
                  className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-text-secondary transition-colors hover:bg-background disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={onMoveDown}
                  disabled={!onMoveDown}
                  title="순서 아래로"
                  className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-text-secondary transition-colors hover:bg-background disabled:opacity-30"
                >
                  ▼
                </button>
              </>
            )}
            {useInProductGallery != null && (
              <button
                type="button"
                onClick={onToggleGalleryUsage}
                className={`rounded-full px-2 py-1 text-[11px] font-medium transition-colors ${
                  isExcluded
                    ? "bg-error-soft text-error"
                    : "text-text-tertiary hover:bg-background"
                }`}
              >
                {isExcluded ? "제외됨" : "제외"}
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {item.alternateDataUrl && onSwapVariant && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onSwapVariant}
                title={
                  item.alternateKind === "PROCESSED"
                    ? "배경제거 후보로 전환"
                    : "원본으로 전환"
                }
                className="px-2 text-[11px]"
              >
                {item.alternateKind === "PROCESSED" ? "누끼 후보" : "원본"}
              </Button>
            )}
            {previewSrc && (
              <a
                href={previewSrc}
                download={downloadFileName}
                className="inline-flex h-8 items-center justify-center rounded-[var(--radius-md)] px-2 text-[11px] font-medium text-text-secondary transition-colors hover:bg-background hover:text-text-primary"
              >
                다운로드
              </a>
            )}
            {status === "failed" && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onRetry}
                disabled={retrying}
                className="px-2 text-[11px]"
              >
                {retrying ? "재실행 중…" : retryCount > 0 ? `재실행 (${retryCount}회)` : "재실행"}
              </Button>
            )}
            {onRemove && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={onRemove}
                title="이미지 삭제"
                className="px-2 text-[11px]"
              >
                삭제
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
