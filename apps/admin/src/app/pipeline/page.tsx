"use client";

import { useState } from "react";
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
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [currentProgress, setCurrentProgress] = useState<PipelineProgressEvent | null>(null);
  const [progressLog, setProgressLog] = useState<PipelineProgressEvent[]>([]);

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
    setCurrentProgress(null);
    setProgressLog([]);

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

  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="text-2xl font-semibold">Image Workspace</h1>
      <p className="mt-2 text-sm text-zinc-500">
        상품 URL을 입력하면 이미지 수집 → 분류(Gemini) → 배경제거 → 표준화 → 압축까지 전체
        파이프라인을 실행합니다.
      </p>

      <div className="mt-6 flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/product/123"
          className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm"
        />
        <button
          onClick={runPipeline}
          disabled={loading || !url}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {loading ? "실행 중..." : "실행"}
        </button>
      </div>

      {(loading || progressLog.length > 0) && (
        <ProgressPanel current={currentProgress} log={progressLog} />
      )}

      {error && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {items.length > 0 && (
        <div className="mt-8 space-y-6">
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
                retrying={retryingIds.has(item.id)}
                onPreview={() => setPreviewId(item.id)}
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
              className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-40"
            >
              Download ZIP (original + thumbnail 800×800 + detail + metadata.json + report.json)
            </button>
          </div>

          {result && <ProcessingReportView report={result.report} />}

          {result && (
            <p className="rounded bg-amber-50 p-3 text-xs text-amber-800">{result.storageNote}</p>
          )}
        </div>
      )}

      {previewItem && <PreviewModal item={previewItem} onClose={() => setPreviewId(null)} />}
    </main>
  );
}
