"use client";

import { useState } from "react";
import { CommerceWorkspace } from "./CommerceWorkspace";
import { ImageCard } from "./ImageCard";
import { PreviewModal } from "./PreviewModal";
import { ProcessingReportView } from "./ProcessingReport";
import { ProgressPanel } from "./ProgressPanel";
import { readPipelineSSEStream } from "./sse";
import type { PipelineProgressEvent, PipelineResponse, TabKey, WorkspaceItem } from "./types";
import { WorkspaceTabs } from "./WorkspaceTabs";
import { downloadWorkspaceZip, resizeToSquare } from "./zip";

export default function PipelinePage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PipelineResponse | null>(null);
  const [items, setItems] = useState<WorkspaceItem[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<TabKey>("original");
  const [representativeId, setRepresentativeId] = useState<string | null>(null);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [retryCounts, setRetryCounts] = useState<Record<string, number>>({});
  const [currentProgress, setCurrentProgress] = useState<PipelineProgressEvent | null>(null);
  const [progressLog, setProgressLog] = useState<PipelineProgressEvent[]>([]);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  async function precomputeThumbnails(newItems: WorkspaceItem[]) {
    const entries = await Promise.all(
      newItems
        .filter((item): item is WorkspaceItem & { detailDataUrl: string } =>
          Boolean(item.detailDataUrl),
        )
        .map(async (item) => [item.id, await resizeToSquare(item.detailDataUrl, 800)] as const),
    );
    setThumbnails((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
  }

  async function runPipeline() {
    setLoading(true);
    setError(null);
    setResult(null);
    setItems([]);
    setThumbnails({});
    setRepresentativeId(null);
    setExcludedIds(new Set());
    setPreviewId(null);
    setSelectedId(null);
    setRetryCounts({});
    setCurrentProgress(null);
    setProgressLog([]);
    setDetailsExpanded(false);

    try {
      const response = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        // 스트림이 시작되기 전에 실패한 경우(예: url 누락)만 여기로 온다 — 일반 JSON 응답.
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? `요청에 실패했습니다 (HTTP ${response.status}).`);
        return;
      }

      for await (const event of readPipelineSSEStream(response)) {
        if (event.type === "progress") {
          setCurrentProgress(event);
          setProgressLog((prev) => [...prev, event]);
        } else if (event.type === "error") {
          setError(event.error);
        } else if (event.type === "complete") {
          setResult(event);
          setItems(event.items);
          setRepresentativeId(event.items.find((item) => item.isRepresentative)?.id ?? null);
          await precomputeThumbnails(event.items);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function retryItem(item: WorkspaceItem) {
    if (!item.originalDataUrl) return;

    setRetryingIds((prev) => new Set(prev).add(item.id));
    setRetryCounts((prev) => ({ ...prev, [item.id]: (prev[item.id] ?? 0) + 1 }));
    try {
      const response = await fetch("/api/pipeline/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataUrl: item.originalDataUrl,
          fileName: item.fileName,
          type: item.type,
        }),
      });
      const data = (await response.json()) as { item?: WorkspaceItem; error?: string };
      if (!response.ok || !data.item) {
        setError(data.error ?? "재실행에 실패했습니다.");
        return;
      }

      const updated = data.item;
      setItems((prev) => prev.map((existing) => (existing.id === updated.id ? updated : existing)));
      if (updated.detailDataUrl) {
        const square = await resizeToSquare(updated.detailDataUrl, 800);
        setThumbnails((prev) => ({ ...prev, [updated.id]: square }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "재실행 중 오류가 발생했습니다.");
    } finally {
      setRetryingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  function resetWorkspace() {
    setUrl("");
    setLoading(false);
    setError(null);
    setResult(null);
    setItems([]);
    setThumbnails({});
    setRepresentativeId(null);
    setExcludedIds(new Set());
    setPreviewId(null);
    setSelectedId(null);
    setRetryingIds(new Set());
    setRetryCounts({});
    setCurrentProgress(null);
    setProgressLog([]);
    setDetailsExpanded(false);
  }

  function toggleExclude(id: string) {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const counts: Record<TabKey, number> = {
    original: items.length,
    thumbnail: items.length,
    detail: items.length,
  };

  const previewItem = items.find((item) => item.id === previewId) ?? null;
  const canDownload = !loading && items.length > 0 && retryingIds.size === 0;
  const started = loading || result !== null;

  return (
    <main className="mx-auto min-w-0 max-w-5xl px-6 py-10">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={resetWorkspace}
          className="text-lg font-semibold tracking-tight text-text-primary"
        >
          CartPilot
        </button>
        {started && (
          <button
            type="button"
            onClick={resetWorkspace}
            disabled={loading}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface disabled:opacity-40"
          >
            새 상품 분석
          </button>
        )}
      </header>

      {!started ? (
        <section className="mx-auto mt-20 max-w-xl text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-text-primary">
            상품 등록 준비
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">
            해외 상품 URL을 입력하세요. AI가 상품을 분석하고 스토어 등록에 필요한 정보를
            준비합니다.
          </p>

          <div className="mt-8 flex flex-col gap-2 sm:flex-row">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/product/123"
              aria-label="상품 URL"
              disabled={loading}
              className="flex-1 rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text-primary shadow-subtle focus:border-primary focus:outline-none disabled:opacity-60"
            />
            <button
              onClick={runPipeline}
              disabled={loading || !url}
              className="flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-subtle transition-colors hover:bg-primary-hover disabled:opacity-40"
            >
              상품 분석 시작
            </button>
          </div>
        </section>
      ) : (
        <>
          {loading && (
            <p className="mt-6 text-sm text-text-secondary">
              AI가 상품을 분석하고 있습니다 — 이미지 수집, 상품 정보 추출, 배경 제거까지 자동으로
              진행됩니다.
            </p>
          )}

          {(loading || progressLog.length > 0) && (
            <ProgressPanel current={currentProgress} log={progressLog} />
          )}
        </>
      )}

      {error && (
        <p className="mt-4 rounded-md border border-error/20 bg-error-soft p-3 text-sm text-error">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-6 space-y-6">
          <CommerceWorkspace
            key={result.canonicalProduct.sourceUrl}
            initialProduct={result.canonicalProduct}
          />

          <section className="rounded-lg border border-border bg-surface shadow-subtle">
            <button
              type="button"
              onClick={() => setDetailsExpanded((v) => !v)}
              className="flex w-full items-center justify-between px-5 py-3 text-left text-sm font-medium text-text-secondary"
            >
              <span>상세 정보 (이미지 원본, 처리 리포트, ZIP 다운로드)</span>
              <span className="text-text-tertiary">{detailsExpanded ? "접기 ▲" : "펼치기 ▼"}</span>
            </button>

            {detailsExpanded && (
              <div className="space-y-6 border-t border-border p-5">
                <WorkspaceTabs active={activeTab} counts={counts} onChange={setActiveTab} />

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {items.map((item) => (
                    <ImageCard
                      key={item.id}
                      item={item}
                      tab={activeTab}
                      thumbnailDataUrl={thumbnails[item.id]}
                      isExcluded={excludedIds.has(item.id)}
                      isRepresentative={representativeId === item.id}
                      isSelected={selectedId === item.id}
                      retrying={retryingIds.has(item.id)}
                      retryCount={retryCounts[item.id] ?? 0}
                      onPreview={() => {
                        setSelectedId(item.id);
                        setPreviewId(item.id);
                      }}
                      onRetry={() => retryItem(item)}
                      onToggleRepresentative={() => setRepresentativeId(item.id)}
                      onToggleExclude={() => toggleExclude(item.id)}
                    />
                  ))}
                </div>

                <div>
                  <button
                    onClick={() =>
                      result && downloadWorkspaceZip(items, excludedIds, result.metadata, result.report)
                    }
                    disabled={!canDownload}
                    className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-background disabled:opacity-40"
                  >
                    ZIP 다운로드 (원본 + 썸네일 800×800 + 상세 + metadata.json + report.json)
                  </button>
                </div>

                <ProcessingReportView report={result.report} />

                <p className="rounded-md bg-warning-soft p-3 text-xs text-warning">
                  {result.storageNote}
                </p>
              </div>
            )}
          </section>
        </div>
      )}

      {previewItem && <PreviewModal item={previewItem} onClose={() => setPreviewId(null)} />}
    </main>
  );
}
