"use client";

import { useEffect, useState } from "react";
import type { CanonicalProduct } from "@commerce/shared";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import type { ProductSnapshot } from "@/app/api/snapshots/_lib/types";
import { CommerceWorkspace } from "./CommerceWorkspace";
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
  // P0-UI Sprint — 기본은 판매자용 단순 화면. 켜면 JSON/ZIP/원본 URL/Payload/개발
  // 로그 등 전에는 항상 보이던 것들이 다시 보인다(기능을 지운 게 아니라 기본 노출만
  // 바꿨다). CartPilot UI 2.0부터 토글은 설정 페이지 맨 아래로 옮겼고, 여기서는
  // localStorage에 저장된 값을 마운트 시 읽기만 한다(브라우저/세션 넘어서도 유지).
  const [developerMode, setDeveloperMode] = useState(false);
  useEffect(() => {
    try {
      setDeveloperMode(window.localStorage.getItem("cartpilot:developerMode") === "true");
    } catch {
      // localStorage 접근 불가(프라이빗 브라우징 등) — 기본값 false 유지.
    }
  }, []);
  // Sprint A-6(작업4 — 등록 소요시간 측정) — CPO 요구사항: "URL 입력 → 등록
  // 완료" 총 시간. URL 제출(runPipeline 시작) 시점을 여기서 잡아 CommerceWorkspace로
  // 내려보낸다 — 등록 자체는 CommerceWorkspace가 처리하므로 종료 시점은 그쪽에서 잰다.
  const [analysisStartedAt, setAnalysisStartedAt] = useState<number | null>(null);
  // Sprint A-9(작업6 — CEO 실측: "쿠팡 탭에서 배송 수정하다가 뒤로가기하면
  // 랜딩으로 돌아간다") — 분석 결과(product/items 등)는 전부 이 컴포넌트의
  // useState에만 있고 어디에도 저장되지 않았다. 이 페이지를 벗어났다 브라우저
  // 뒤로가기로 돌아오면(다른 관리자 화면을 잠깐 봤다거나) 컴포넌트가 처음부터
  // 다시 마운트돼서 크롤링/이미지 처리를 처음부터 다시 해야 했다. sessionStorage에
  // 스냅샷을 저장해뒀다가 마운트 시 있으면 그걸로 복원한다 — 탭을 닫으면 사라지고
  // (영구 저장이 아니다), 새 URL을 분석하거나 "새 상품 분석"을 누르면 지워진다.
  const WORKSPACE_STORAGE_KEY = "cartpilot-pipeline-workspace-v1";
  const [hydrated, setHydrated] = useState(false);
  // "최근 작업"(product_snapshots) — sessionStorage(이 브라우저 탭 한정)와 별개로
  // DB에도 저장해서 다른 탭/기기에서도 "최근 작업" 목록에서 이어할 수 있게 한다.
  // id가 없으면(첫 저장 전) POST가 insert, 있으면 update로 동작한다(upsert 패턴 —
  // api/snapshots/_lib/snapshot.ts 참고).
  const [snapshotId, setSnapshotId] = useState<string | null>(null);

  /** items에는 상세/원본/누끼후보 3장 분량의 base64 data URI가 다 들어있어서
   * (1500x2000 JPG 기준 장당 수백 KB~1MB대) 5장만 있어도 sessionStorage
   * 용량(보통 5~10MB)을 쉽게 넘긴다 — 그러면 setItem이 조용히
   * QuotaExceededError를 던지고 catch에서 삼켜져서 아예 저장이 안 됐다(실측
   * 확인). 무거운 data URI(originalDataUrl/detailDataUrl/alternateDataUrl)는
   * 빼고 공개 URL(Supabase Storage에 업로드된 detailPublicUrl/
   * alternatePublicUrl — 마켓플레이스 등록에도 어차피 이 값을 쓴다)과
   * 메타데이터만 남긴다. */
  function stripHeavyDataUrls(source: WorkspaceItem[]): WorkspaceItem[] {
    return source.map((item) => ({
      ...item,
      originalDataUrl: null,
      detailDataUrl: item.detailPublicUrl ?? item.detailDataUrl,
      alternateDataUrl: item.alternatePublicUrl ?? null,
    }));
  }

  useEffect(() => {
    void (async () => {
      // "최근 작업" 목록에서 "이어서 작업"을 누르면 ?resume={id}로 진입한다 —
      // sessionStorage 복원보다 우선한다(DB가 항상 최신 저장 상태를 갖고 있고,
      // 다른 탭/기기에서 이어할 수도 있어야 하므로).
      try {
        const resumeId = new URLSearchParams(window.location.search).get("resume");
        if (resumeId) {
          const res = await fetch(`/api/snapshots/${resumeId}`);
          const data = (await res.json()) as { ok: boolean; snapshot?: ProductSnapshot };
          if (data.ok && data.snapshot) {
            const ws = data.snapshot.workspace;
            setSnapshotId(data.snapshot.id);
            setUrl(ws.url);
            setResult({
              metadata: ws.pipelineResponse.metadata,
              items: ws.items,
              report: ws.pipelineResponse.report,
              storageNote: ws.pipelineResponse.storageNote,
              canonicalProduct: ws.canonicalProduct,
            });
            setProduct(ws.canonicalProduct);
            setItems(ws.items);
            setThumbnails(ws.thumbnails ?? {});
            setRepresentativeId(ws.representativeId);
            setExcludedIds(new Set(ws.excludedIds));
            setHydrated(true);
            return;
          }
        }
      } catch {
        // 이어서 작업 복원 실패 — 아래 sessionStorage 복원으로 폴백한다.
      }

      try {
        const raw = sessionStorage.getItem(WORKSPACE_STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as {
            url?: string;
            result?: PipelineResponse | null;
            product?: CanonicalProduct | null;
            items?: WorkspaceItem[];
            thumbnails?: Record<string, string>;
            representativeId?: string | null;
            excludedIds?: string[];
          };
          if (saved.result && saved.product) {
            setUrl(saved.url ?? "");
            setResult(saved.result);
            setProduct(saved.product);
            setItems(saved.items ?? []);
            setThumbnails(saved.thumbnails ?? {});
            setRepresentativeId(saved.representativeId ?? null);
            setExcludedIds(new Set(saved.excludedIds ?? []));
          }
        }
      } catch {
        // sessionStorage가 막혀있거나(프라이빗 브라우징 등) 저장된 값이 깨져있으면
        // 그냥 랜딩부터 시작한다 — 복원은 "되면 좋은" 편의 기능이지 필수 경로가 아니다.
      }
      setHydrated(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 분석이 끝난 뒤(product/items가 채워진 뒤)에만, 값이 바뀔 때마다 스냅샷을
  // 갱신한다. hydrated 이전에는 저장하지 않는다 — 복원 직후 빈 초기값으로
  // 방금 불러온 세션을 덮어쓰는 사고를 막기 위해서다.
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (result && product) {
        sessionStorage.setItem(
          WORKSPACE_STORAGE_KEY,
          JSON.stringify({
            url,
            result,
            product,
            items: stripHeavyDataUrls(items),
            thumbnails,
            representativeId,
            excludedIds: [...excludedIds],
          }),
        );
      } else {
        sessionStorage.removeItem(WORKSPACE_STORAGE_KEY);
      }
    } catch {
      // 용량 초과(QuotaExceededError) 등 — 복원 기능만 못 쓸 뿐 화면 동작에는
      // 영향 없게 조용히 무시한다.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, url, result, product, items, thumbnails, representativeId, excludedIds]);

  async function saveSnapshotToServer() {
    if (!result || !product) return;
    try {
      const representative = items.find((item) => item.id === representativeId);
      const res = await fetch("/api/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: snapshotId ?? undefined,
          sourceUrl: url,
          title: product.title.value || null,
          thumbnailUrl: representative?.detailPublicUrl ?? null,
          workspace: {
            url,
            pipelineResponse: { metadata: result.metadata, report: result.report, storageNote: result.storageNote },
            canonicalProduct: product,
            items: stripHeavyDataUrls(items),
            thumbnails,
            representativeId,
            excludedIds: [...excludedIds],
            activeTab: "source",
            developerMode,
            platformSettings: {},
          },
        }),
      });
      const data = (await res.json()) as { ok: boolean; snapshot?: { id: string } };
      if (data.ok && data.snapshot && !snapshotId) {
        setSnapshotId(data.snapshot.id);
      }
    } catch {
      // 저장 실패해도 화면 동작에는 영향 없다 — sessionStorage가 로컬 캐시로
      // 계속 동작하고, 다음 변경 때 다시 저장을 시도한다.
    }
  }

  // sessionStorage는 이 브라우저 탭 한정 캐시고, "최근 작업" 목록/다른 탭·기기
  // 복원은 DB에 저장돼 있어야 가능하다 — 같은 트리거(hydrated 이후 값이 바뀔 때)에
  // DB 저장도 얹되, 편집 중 키 입력마다 API를 부르지 않도록 2초 디바운스한다.
  useEffect(() => {
    if (!hydrated || !result || !product) return;
    const timer = setTimeout(() => {
      void saveSnapshotToServer();
    }, 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, url, result, product, items, representativeId, excludedIds]);

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
    setAnalysisStartedAt(Date.now());
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
    try {
      sessionStorage.removeItem(WORKSPACE_STORAGE_KEY);
      // Sprint A-10(작업6) — CommerceWorkspace가 마지막 탭을 기억하는 별도 키.
      // 새 상품 분석을 시작하면 이전 상품에서 열려 있던 탭(예: 쿠팡)이 새
      // 상품에 그대로 이어지면 안 되므로 같이 지운다.
      sessionStorage.removeItem("cartpilot-pipeline-tab-v1");
      // ?resume={id}로 들어왔던 경우 새 상품 분석을 시작하면 URL에서 지운다 —
      // 남겨두면 새로고침 시 방금 리셋한 화면이 다시 그 스냅샷으로 복원돼버린다.
      const url = new URL(window.location.href);
      if (url.searchParams.has("resume")) {
        url.searchParams.delete("resume");
        window.history.replaceState(null, "", url.toString());
      }
    } catch {
      // no-op — 세션 스토리지가 막혀있어도 리셋 자체는 계속 진행한다.
    }
    setSnapshotId(null);
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
    <>
      <PageHeader
        title="상품 등록"
        subtitle="AI가 해외 상품을 분석하고 쿠팡 등록까지 자동으로 준비합니다."
        actions={
          started ? (
            <Button variant="secondary" size="sm" onClick={resetWorkspace} disabled={loading}>
              새 상품 분석
            </Button>
          ) : undefined
        }
      />
      {/* Sprint A-9(작업1 — CEO 실측 피드백: "노트북 기준으로도 답답합니다,
          쿠팡 Wing처럼 거의 전체화면을 쓰고 싶다") — 랜딩(!started)은 마케팅
          카피라 좁은 폭이 오히려 읽기 좋지만, Editor(started)는 필드가 많은
          폼이라 넓은 폭이 필요하다. 바깥 컨테이너는 PageContainer size="xl"로
          통일하고, 랜딩의 좁은 폭은 안쪽 섹션(max-w-xl)에서만 준다. */}
      <PageContainer size="xl" className="min-w-0 py-10">
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

          {/* Sprint A-9(작업7 — CEO 지시: "이제 쿠팡 연결 테스트는 끝났습니다.
              랜딩에서는 삭제해주세요. 실제 등록 시 등록 버튼에서만 체크하면
              됩니다.") — 여기서 하던 연결 확인은 삭제한다. CommerceWorkspace가
              쿠팡 탭에서 등록 직전(confirmListing)에 이미 독립적으로 다시
              확인한다(등록 직전 최종 재확인이 이 화면의 사전 확인보다 더
              정확하다 — 그 사이에 토큰이 만료될 수도 있으므로). */}

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

      {result && product && (
        <div className="mt-6 space-y-6">
          <CommerceWorkspace
            product={product}
            onUpdateProduct={updateProduct}
            items={items}
            thumbnails={thumbnails}
            representativeId={representativeId}
            excludedIds={excludedIds}
            onPreviewImage={(id) => {
              setSelectedId(id);
              setPreviewId(id);
            }}
            onSetRepresentative={setRepresentative}
            onToggleGalleryUsage={(id) => toggleImageUsage(id, "useInProductGallery")}
            onToggleDescriptionUsage={(id) => toggleImageUsage(id, "useInDescription")}
            onToggleExclude={toggleExclude}
            developerMode={developerMode}
            analysisStartedAt={analysisStartedAt}
            snapshotId={snapshotId}
          />

          {/* P0-UI Epic 1 — JSON/ZIP/원본 URL/처리 리포트 등은 판매자가 매일 볼
           * 필요가 없는 개발자 정보다. Developer Mode를 껐으면 이 섹션 자체가
           * 화면에 없다(토글 버튼도 안 보인다) — 대표이미지 관리는 이미
           * ImageSummaryCard→갤러리 모달로 옮겨졌으니 여기 안 보여도 기능 손실이
           * 없다. */}
          {developerMode && (
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
          )}
        </div>
      )}

      {previewItem && <PreviewModal item={previewItem} onClose={() => setPreviewId(null)} />}
      </PageContainer>
    </>
  );
}
