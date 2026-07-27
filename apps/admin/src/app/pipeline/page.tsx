"use client";

import { useState } from "react";
import type { PlatformConnectionStatus } from "@commerce/listing";
import type { CanonicalProduct } from "@commerce/shared";
import { CommerceWorkspace } from "./CommerceWorkspace";
import { CoupangConnectionPanel } from "./commerce/CoupangConnectionPanel";
import { ImageSelectionGate } from "./commerce/ImageSelectionGate";
import { ImageCard } from "./ImageCard";
import { ImageUsageTable } from "./ImageUsageTable";
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
  // product는 CommerceWorkspace가 아니라 여기서 소유한다(controlled) — 이미지 카드의
  // 원본/누끼 후보 전환(swapVariant)이 등록 화면에도 그대로 반영되려면 두 UI가 같은
  // state를 공유해야 한다. CommerceWorkspace는 이 값을 그대로 받아 렌더링만 한다.
  const [product, setProduct] = useState<CanonicalProduct | null>(null);
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
  // 이미지 처리가 끝나도 곧바로 등록 준비 화면(CommerceWorkspace)으로 안 넘어간다 —
  // [이미지 선택 완료]를 눌러야만 true가 되고, 그 전까지는 ImageSelectionGate만
  // 보여준다. AI 추천(대표/상품 이미지 기본값)은 유지하되 최종 확정은 항상
  // 사용자가 하게 만드는 게 목적이다.
  const [imageSelectionConfirmed, setImageSelectionConfirmed] = useState(false);
  // 홈 화면 전용 쿠팡 연결 상태 — CommerceWorkspace 안의 쿠팡 탭이 갖고 있는
  // coupangConnection과는 별개의 state다. 여기는 "분석 비용을 쓰기 전 게이트",
  // 그쪽은 "실제 등록 직전 최종 재확인"으로 목적이 달라서 공유하지 않는다 —
  // 등록 직전엔 항상 그 순간 다시 확인하는 게 더 안전하다.
  const [coupangConnection, setCoupangConnection] = useState<PlatformConnectionStatus>("UNKNOWN");
  const [coupangConnectionCheckedAt, setCoupangConnectionCheckedAt] = useState<string | null>(null);
  const [coupangConnectionChecking, setCoupangConnectionChecking] = useState(false);

  /** 페이지 로딩 시 자동으로 호출하지 않는다 — 사용자가 [연결 확인] 버튼을 눌러야만
   * 실제 쿠팡 API가 나간다(불필요한 호출 방지). 반환값을 그대로 써서, 방금 호출한
   * runPipeline()이 "다음 렌더의" state가 아니라 "지금 이 순간" 확인한 결과로
   * 바로 판단할 수 있게 한다. */
  async function checkCoupangConnection(): Promise<PlatformConnectionStatus> {
    setCoupangConnectionChecking(true);
    let status: PlatformConnectionStatus = "AUTH_FAILED";
    try {
      const res = await fetch("/api/coupang/auth-test", { method: "POST" });
      const data = (await res.json()) as { status?: PlatformConnectionStatus };
      status = data.status ?? "NOT_CONFIGURED";
    } catch {
      status = "AUTH_FAILED";
    }
    setCoupangConnection(status);
    setCoupangConnectionCheckedAt(new Date().toISOString());
    setCoupangConnectionChecking(false);
    return status;
  }

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
    // 버튼이 disabled로 막혀 있어도, 혹시 모를 우회 호출을 한 번 더 막는다 —
    // 쿠팡 연결이 확인되지 않은 상태에서 이미지 처리 비용이 나가지 않게 한다.
    if (coupangConnection !== "CONNECTED") return;

    setLoading(true);
    setError(null);
    setResult(null);
    setProduct(null);
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
    setImageSelectionConfirmed(false);

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
          setProduct(event.canonicalProduct);
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
    setProduct(null);
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
    setImageSelectionConfirmed(false);
  }

  /** CommerceWorkspace는 product가 항상 있다고 가정하고 업데이터를 호출한다(그 컴포넌트가
   * 렌더링될 때는 이미 product가 null이 아니므로) — page.tsx의 product state는 로딩 중엔
   * null일 수 있어서 그 차이를 여기서 좁혀준다. */
  function updateProduct(updater: (prev: CanonicalProduct) => CanonicalProduct) {
    setProduct((prev) => (prev ? updater(prev) : prev));
  }

  /** ⭐ 토글이 기존엔 representativeId(카드 UI 표시용 로컬 state)만 바꾸고
   * product.images에는 전혀 반영되지 않던 버그를 여기서 같이 고친다 — 대표 이미지를
   * 바꿔도 실제 등록 payload가 계속 이전 이미지를 대표로 썼던 문제였다. Mission 3의
   * swapVariant와 같은 원칙: UI 표시(representativeId)와 등록 데이터(product.images)를
   * 반드시 같은 액션 안에서 함께 갱신한다. */
  function setRepresentative(itemId: string) {
    setRepresentativeId(itemId);
    updateProduct((prev) => ({
      ...prev,
      images: prev.images.map((img) => ({ ...img, isRepresentative: img.id === itemId })),
    }));
  }

  function toggleImageUsage(itemId: string, field: "useInProductGallery" | "useInDescription") {
    updateProduct((prev) => ({
      ...prev,
      images: prev.images.map((img) => (img.id === itemId ? { ...img, [field]: !img[field] } : img)),
    }));
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

  /** PRODUCT는 원본/배경제거 후보 두 변형을 함께 갖고 있다 — detailDataUrl과
   * alternateDataUrl을 맞바꿔서 이 카드가 어느 쪽을 대표로 쓸지 사용자가 고를 수 있게 한다.
   * 카드 표시(items)만 바꾸고 끝나면 안 된다 — product.images의 selectedVariant도
   * 반드시 같이 갱신해야 등록 화면(SmartStore/Coupang Preview)과 실제 payload에
   * 이 선택이 반영된다. UI가 URL을 직접 등록 데이터에 꽂아넣지 않고, 항상
   * selectedVariant라는 단일 필드를 통해서만 어떤 이미지가 쓰일지 결정한다. */
  async function swapVariant(id: string) {
    const item = items.find((existing) => existing.id === id);
    if (!item?.alternateDataUrl || !item.alternateKind) return;
    const newVariant = item.alternateKind;
    const swapped: WorkspaceItem = {
      ...item,
      detailDataUrl: item.alternateDataUrl,
      outputWidth: item.alternateWidth,
      outputHeight: item.alternateHeight,
      fileSize: item.alternateBytes,
      usedOriginal: item.alternateKind === "ORIGINAL",
      alternateDataUrl: item.detailDataUrl,
      alternateWidth: item.outputWidth,
      alternateHeight: item.outputHeight,
      alternateBytes: item.fileSize,
      alternateKind: item.usedOriginal ? "ORIGINAL" : "PROCESSED",
    };
    setItems((prev) => prev.map((existing) => (existing.id === id ? swapped : existing)));
    setProduct((prev) =>
      prev
        ? {
            ...prev,
            images: prev.images.map((img) =>
              img.id === id ? { ...img, selectedVariant: newVariant } : img,
            ),
          }
        : prev,
    );
    if (swapped.detailDataUrl) {
      const square = await resizeToSquare(swapped.detailDataUrl, 800);
      setThumbnails((prev) => ({ ...prev, [id]: square }));
    }
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
        <section className="mx-auto mt-16 max-w-xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            AI Commerce Copilot
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">
            해외 상품을 판매 가능한 상품으로
            <br />
            바꾸는 가장 빠른 방법
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">
            URL 하나를 입력하면 CartPilot AI가 상품 정보, 이미지, 카테고리, 콘텐츠를 분석하고
            국내 판매 등록을 준비합니다.
          </p>

          {coupangConnection !== "CONNECTED" && (
            <div className="mt-8 text-left">
              <CoupangConnectionPanel
                status={coupangConnection}
                checking={coupangConnectionChecking}
                checkedAt={coupangConnectionCheckedAt}
                onCheck={checkCoupangConnection}
              />
              <p className="mt-2 text-xs text-text-tertiary">
                쿠팡 연결을 먼저 확인해야 상품 분석을 시작할 수 있습니다 — 분석은 이미지
                처리 등 비용이 드는 작업이라, 등록할 수 없는 상태로 미리 진행하지 않습니다.
              </p>
            </div>
          )}

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
              disabled={loading || !url || coupangConnection !== "CONNECTED"}
              title={coupangConnection !== "CONNECTED" ? "쿠팡 연결을 먼저 확인해주세요" : undefined}
              className="flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-subtle transition-colors hover:bg-primary-hover disabled:opacity-40"
            >
              상품 분석 시작
            </button>
          </div>

          <div className="mt-12 border-t border-border pt-8">
            <p className="text-xs font-medium text-text-tertiary">
              CartPilot이 자동으로 처리합니다
            </p>
            <ul className="mt-3 grid grid-cols-1 gap-2 text-left text-sm text-text-secondary sm:grid-cols-2">
              {[
                "상품 정보 추출",
                "이미지 최적화 (JPG 표준화)",
                "상품 카테고리 추천",
                "AI 상품명/설명 생성",
                "국내 커머스 등록 준비",
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <span className="text-success">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 border-t border-border pt-6">
            <p className="text-xs font-medium text-text-tertiary">지원 플랫폼</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {["스마트스토어", "쿠팡", "11번가"].map((platform) => (
                <span
                  key={platform}
                  className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-text-secondary shadow-subtle"
                >
                  {platform}
                </span>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <>
          {loading && (
            <div className="mt-6">
              <p className="text-sm text-text-secondary">
                AI가 상품을 분석하고 있습니다 — 이미지 수집, 상품 정보 추출, 배경 제거까지
                자동으로 진행됩니다.
              </p>
              <AnalysisStageIndicator percent={currentProgress?.percent ?? 0} />
            </div>
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

      {result && product && !imageSelectionConfirmed && (
        <ImageSelectionGate
          product={product}
          items={items}
          thumbnails={thumbnails}
          representativeId={representativeId}
          excludedIds={excludedIds}
          onPreview={(id) => {
            setSelectedId(id);
            setPreviewId(id);
          }}
          onSetRepresentative={setRepresentative}
          onToggleGalleryUsage={(id) => toggleImageUsage(id, "useInProductGallery")}
          onToggleDescriptionUsage={(id) => toggleImageUsage(id, "useInDescription")}
          onToggleExclude={toggleExclude}
          onConfirm={() => setImageSelectionConfirmed(true)}
        />
      )}

      {result && product && imageSelectionConfirmed && (
        <div className="mt-6 space-y-6">
          <CommerceWorkspace product={product} onUpdateProduct={updateProduct} />

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

                {product && <ImageUsageTable product={product} items={items} />}

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {items.map((item) => {
                    const imageUsage = product?.images.find((img) => img.id === item.id);
                    return (
                      <ImageCard
                        key={item.id}
                        item={item}
                        tab={activeTab}
                        thumbnailDataUrl={thumbnails[item.id]}
                        isExcluded={excludedIds.has(item.id)}
                        isRepresentative={representativeId === item.id}
                        useInProductGallery={imageUsage?.useInProductGallery}
                        useInDescription={imageUsage?.useInDescription}
                        isSelected={selectedId === item.id}
                        retrying={retryingIds.has(item.id)}
                        retryCount={retryCounts[item.id] ?? 0}
                        onPreview={() => {
                          setSelectedId(item.id);
                          setPreviewId(item.id);
                        }}
                        onRetry={() => retryItem(item)}
                        onSetRepresentative={() => setRepresentative(item.id)}
                        onToggleGalleryUsage={() => toggleImageUsage(item.id, "useInProductGallery")}
                        onToggleDescriptionUsage={() => toggleImageUsage(item.id, "useInDescription")}
                        onToggleExclude={() => toggleExclude(item.id)}
                        onSwapVariant={item.alternateDataUrl ? () => swapVariant(item.id) : undefined}
                      />
                    );
                  })}
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

/**
 * StageStepper(commerce/StageStepper.tsx)의 5단계 중 앞의 두 단계(상품 분석/이미지
 * 준비)만 보여주는 축소판 — 이미지 파이프라인이 끝나기 전(CommerceWorkspace가
 * 마운트되기 전)에는 나머지 세 단계(카테고리/AI 콘텐츠/스토어 등록)를 판단할
 * 데이터가 아직 없다. percent<=7(URL 분석+이미지 URL 추출)까지는 1단계가
 * 진행 중이고, 그 이후는 이미지 다운로드/분류/가공 단계이므로 2단계가 진행 중이다
 * (packages/image/src/pipeline/progress.ts의 STAGE_WEIGHTS와 맞춘 값).
 */
function AnalysisStageIndicator({ percent }: { percent: number }) {
  const stage1 = percent > 7 ? "done" : "active";
  const stage2 = percent >= 100 ? "done" : percent > 7 ? "active" : "locked";

  return (
    <div className="mt-3 flex items-center gap-2 text-xs">
      <StagePill label="① 상품 분석" state={stage1} />
      <span className="text-text-tertiary" aria-hidden>
        →
      </span>
      <StagePill label="② 이미지 준비" state={stage2} />
    </div>
  );
}

function StagePill({
  label,
  state,
}: {
  label: string;
  state: "locked" | "active" | "done";
}) {
  const icon = state === "done" ? "✓" : state === "active" ? "●" : "○";
  const className =
    state === "done"
      ? "border-success/30 bg-success-soft text-success"
      : state === "active"
        ? "border-warning/30 bg-warning-soft text-warning"
        : "border-border text-text-tertiary";

  return (
    <span
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium ${className}`}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </span>
  );
}
