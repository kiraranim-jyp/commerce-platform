"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { backfillCanonicalProduct, type CanonicalProduct, type PlatformId } from "@commerce/shared";
import type { CategorySelection } from "@commerce/category";
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
  // Sprint B-1(CPO 지시) — 스냅샷과 1:1로 생기는 사람이 읽을 수 있는 작업번호
  // ("JOB-260819-001"). 스냅샷 최초 저장(insert) 응답에서만 받고, 이후
  // 업데이트에서는 서버가 그대로 유지한다(재발급 없음).
  const [jobKey, setJobKey] = useState<string | null>(null);
  /** B-3(CPO 지시: "이미 등록된 상품을 다시 보기 → 현재 설정과 실제 등록
   * 이력을 구분해서 표시") — REGISTERED 상태면 아래 미리보기가 "현재 설정"
   * 기준 재계산이라는 걸 알리고, 실제 등록 시 제출된 값(registration_attempts)
   * 을 보러 갈 수 있는 링크를 보여준다. */
  const [snapshotStatus, setSnapshotStatus] = useState<"IN_PROGRESS" | "REGISTERED" | null>(null);
  // N-3.12 Phase 2 P0① — CommerceWorkspace가 mirror-up(onCategoryMappingsChange)으로
  // 알려주는 카테고리 선택 상태. null이면 "아직 CommerceWorkspace가 마운트 전"이거나
  // "복원할 저장값이 없음" — 이 경우 CommerceWorkspace가 자체 기본값을 쓴다.
  const [categoryMappings, setCategoryMappings] = useState<Record<PlatformId, CategorySelection> | null>(null);

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
            setJobKey(data.snapshot.jobKey ?? null);
            setSnapshotStatus(data.snapshot.status);
            setUrl(ws.url);
            setResult({
              metadata: ws.pipelineResponse.metadata,
              items: ws.items,
              report: ws.pipelineResponse.report,
              storageNote: ws.pipelineResponse.storageNote,
              canonicalProduct: ws.canonicalProduct,
            });
            setProduct(backfillCanonicalProduct(ws.canonicalProduct));
            setItems(ws.items);
            setThumbnails(ws.thumbnails ?? {});
            setRepresentativeId(ws.representativeId);
            setCategoryMappings(ws.categoryMappings ?? null);
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
            categoryMappings?: Record<PlatformId, CategorySelection>;
          };
          if (saved.result && saved.product) {
            setUrl(saved.url ?? "");
            setResult(saved.result);
            setProduct(backfillCanonicalProduct(saved.product));
            setItems(saved.items ?? []);
            setThumbnails(saved.thumbnails ?? {});
            setRepresentativeId(saved.representativeId ?? null);
            setCategoryMappings(saved.categoryMappings ?? null);
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
            categoryMappings,
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
  }, [hydrated, url, result, product, items, thumbnails, representativeId, categoryMappings]);

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
            activeTab: "source",
            developerMode,
            platformSettings: {},
            categoryMappings: categoryMappings ?? undefined,
          },
        }),
      });
      const data = (await res.json()) as { ok: boolean; snapshot?: { id: string; jobKey?: string | null } };
      if (data.ok && data.snapshot && !snapshotId) {
        setSnapshotId(data.snapshot.id);
        // Sprint B-1 — 최초 insert 응답에만 새 job_key가 실려 온다(서버가 그
        // 시점에 한 번만 채번한다) — 이후 update 응답에도 같은 값이 오지만
        // 여기서는 최초 1회만 세팅하면 충분하다(같은 snapshotId로 계속
        // upsert되므로 값이 바뀌지 않는다).
        setJobKey(data.snapshot.jobKey ?? null);
        // P-13C-2 STEP3-B(CPO 승인) — 스냅샷이 "처음" 생기는 이 순간에만 1회
        // 호출한다. 이후 이미지/가격/상세페이지 수정으로 saveSnapshotToServer()가
        // 다시 실행돼도(위 useEffect 의존성 배열 참고) snapshotId가 이미 있어
        // 이 블록 자체를 다시 타지 않는다 — Resolver 재호출 원천 차단. 화면
        // 렌더링을 막지 않도록 await하지 않는다(void).
        void fetch(`/api/snapshots/${data.snapshot.id}/category-recommendation`, { method: "POST" }).catch(() => {
          // 실패해도 화면에 영향 없음 — 사용자가 쿠팡 탭을 열면 기존 자동 fetch가
          // 캐시 없음을 확인하고 평소대로 동작한다(P-13C-2 STEP3-B-4).
        });
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
  }, [hydrated, url, result, product, items, representativeId, categoryMappings]);

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
    setJobKey(null);
    setSnapshotStatus(null);
    setUrl("");
    setLoading(false);
    setError(null);
    setResult(null);
    setProduct(null);
    setItems([]);
    setThumbnails({});
    setRepresentativeId(null);
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

  /** N-3.19(CPO 지시: "삭제 = 상품 등록에서 제외") — 예전엔 별도 excludedIds
   * Set이 있어서 카드에 회색 처리만 하고 실제 등록 payload(product.images의
   * useInProductGallery)는 전혀 안 바뀌는 버그가 있었다("삭제했는데 실제
   * 등록에는 들어간다"). source-of-truth를 하나로 합친다 — 이 토글이 바로
   * useInProductGallery를 뒤집는다. */
  function moveImage(id: string, direction: "up" | "down") {
    updateProduct((prev) => {
      const idx = prev.images.findIndex((img) => img.id === id);
      if (idx === -1) return prev;
      const swapWith = direction === "up" ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= prev.images.length) return prev;
      const nextImages = [...prev.images];
      [nextImages[idx], nextImages[swapWith]] = [nextImages[swapWith], nextImages[idx]];
      return { ...prev, images: nextImages };
    });
  }

  const [addingImage, setAddingImage] = useState(false);

  /** CEO 지시(2026-08-24, CPO 부재중): "이미지는 내가 추가/제거 할 수 있어야
   * 해". 크롤링이 못 가져온 이미지를 상품정보 탭에서 바로 올린다 — 배경제거/
   * JPG 표준화 같은 파이프라인 처리는 거치지 않고, 업로드된 원본 URL을 그대로
   * originalUrl/detailPublicUrl 양쪽에 쓴다(마켓플레이스 payload가 실제로 읽는
   * 값이 detailPublicUrl이므로 반드시 공개 URL이어야 한다 — data URI 아님). */
  async function addImage(file: File) {
    setAddingImage(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/pipeline/upload-image", { method: "POST", body });
      const data = (await res.json()) as { ok: boolean; url?: string; error?: string };
      if (!data.ok || !data.url) {
        alert(data.error ?? "이미지 업로드에 실패했습니다.");
        return;
      }
      const url = data.url;
      const dims = await new Promise<{ width: number; height: number }>((resolve) => {
        const img = new window.Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve({ width: 0, height: 0 });
        img.src = url;
      });
      const id = crypto.randomUUID();
      const newItem: WorkspaceItem = {
        id,
        fileName: file.name,
        type: "PRODUCT",
        status: "success",
        originalDataUrl: url,
        originalWidth: dims.width,
        originalHeight: dims.height,
        originalBytes: file.size,
        detailDataUrl: url,
        detailPublicUrl: url,
        outputWidth: dims.width,
        outputHeight: dims.height,
        fileSize: file.size,
        isRepresentative: false,
        isJPEG: file.type === "image/jpeg",
        processingTimeSec: 0,
      };
      const wasEmpty = (product?.images.length ?? 0) === 0;
      setItems((prev) => [...prev, newItem]);
      setThumbnails((prev) => ({ ...prev, [id]: url }));
      updateProduct((prev) => ({
        ...prev,
        images: [
          ...prev.images,
          {
            id,
            originalUrl: url,
            selectedVariant: "ORIGINAL",
            isRepresentative: wasEmpty,
            useInProductGallery: true,
            useInDescription: true,
            classification: "PRODUCT",
          },
        ],
      }));
      if (wasEmpty) setRepresentativeId(id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "이미지 업로드에 실패했습니다.");
    } finally {
      setAddingImage(false);
    }
  }

  /** 위 addImage와 짝 — 완전히 배열에서 빼는 하드 삭제다(N-3.19의 "등록에서
   * 제외" 토글과 별개). 대표 이미지를 지우면 남은 첫 이미지를 새 대표로
   * 승격한다(대표가 아예 없는 상태로 남지 않도록). */
  function removeImage(id: string) {
    if (!product) return;
    if (!window.confirm("이 이미지를 삭제하시겠습니까?")) return;
    const wasRepresentative = product.images.find((img) => img.id === id)?.isRepresentative ?? false;
    const remaining = product.images.filter((img) => img.id !== id);
    const newRepresentativeId = wasRepresentative ? (remaining[0]?.id ?? null) : representativeId;
    setItems((prev) => prev.filter((item) => item.id !== id));
    setThumbnails((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setProduct((prev) =>
      prev
        ? {
            ...prev,
            images: prev.images
              .filter((img) => img.id !== id)
              .map((img) =>
                wasRepresentative && img.id === newRepresentativeId ? { ...img, isRepresentative: true } : img,
              ),
          }
        : prev,
    );
    setRepresentativeId(newRepresentativeId);
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
        subtitle="AI가 해외 상품 정보를 분석하고 국내 판매에 필요한 정보를 준비합니다."
        actions={
          started ? (
            <div className="flex items-center gap-3">
              {/* Sprint B-1(CPO 지시) — "에러 발생 시 Job Key 하나만 전달하면
               * 전체 흐름을 찾을 수 있게" — 작업 화면 어디서든 항상 보이는
               * 위치에 둔다. 아직 저장 전(분석 직후, 2초 debounce 이전)에는
               * null이라 표시하지 않는다 — 지어내지 않는다. */}
              {jobKey && (
                <span className="rounded-full bg-surface px-3 py-1 text-xs font-mono text-text-tertiary shadow-subtle">
                  {jobKey}
                </span>
              )}
              <Button variant="secondary" size="sm" onClick={resetWorkspace} disabled={loading}>
                새 상품 분석
              </Button>
            </div>
          ) : undefined
        }
      />
      {/* N-3.16 잔여3(CPO 지시: "실제 /pipeline에 1360px 기준 적용 — 단, 전체
          화면을 무조건 1360px로 강제하지 말고 브라우저가 넓어질 때 좌우
          여백이 자연스럽게 생기는 구조로") — 예전 A-9 지시("Wing처럼 거의
          전체화면")로 xl(1800px)까지 넓혔던 걸 되돌린다. PageContainer는
          이미 mx-auto + max-w라 이 값을 넘으면 자동으로 좌우 여백이 생기고,
          그 아래에서는 화면 폭에 맞춰 줄어든다(강제 고정 아님). 랜딩(!started)은
          기존과 동일하게 size="md"(1200px) 유지. */}
      <PageContainer size={started ? "editor" : "md"} className="min-w-0 py-10">
      {/* B-3(CPO 지시: "이미 등록된 상품을 다시 보기 → 현재 설정과 실제 등록
       * 이력을 구분해서 표시") — 아래 미리보기는 항상 "지금 설정" 기준으로
       * 다시 계산된다(등록 당시 값이 얼려져 있지 않음). 등록 완료 상품을
       * 다시 열었을 때만 이 사실을 알리고, 실제 제출된 값은 등록 이력에서
       * 확인하게 한다. */}
      {started && snapshotStatus === "REGISTERED" && snapshotId && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          <p>
            이 상품은 이미 등록 완료 상태입니다. 아래 미리보기는 <b>현재 설정</b> 기준으로 다시 계산된
            내용이며, 실제 등록 시 제출된 내용과 다를 수 있습니다.
          </p>
          <Link
            href={`/admin/registrations?snapshotId=${snapshotId}`}
            className="shrink-0 rounded-md border border-warning/40 bg-surface px-3 py-1.5 text-xs font-medium text-warning hover:bg-warning-soft"
          >
            실제 등록 이력 보기 →
          </Link>
        </div>
      )}
      {!started ? (
        <>
          {/* CPO 2차 재실측 지시 — Hero 메인 문구(eyebrow/headline/description)를
              완전히 없애는 방식으로 width 문제를 풀면 안 된다: 상품등록은
              "무엇을 해야 하는지"를 3초 안에 알려줘야 하는 진입 화면이다.
              PageHeader("상품 등록" + 기능 위치 안내)와 이 Hero(가치 제안 +
              무엇을 입력해야 하는지)는 역할이 다르므로 병합하지 않는다.
              Hero 콘텐츠 전체는 넓어진 xl App 폭과 무관하게 max-w-[1000px]
              (960~1040px 권장 범위)로 별도 고정한다. */}
          <div className="mx-auto max-w-[1000px] py-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              원가부터 마진까지, 꼼꼼하게 따져드립니다
            </p>
            <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-text-primary md:text-4xl">
              해외 상품을 판매 가능한 상품으로
              <br />
              가장 빠르게 준비하는 방법
            </h2>
            <p className="mx-auto mt-4 max-w-[720px] text-sm leading-relaxed text-text-secondary">
              URL 하나를 입력하면 따져 AI가 상품 정보, 이미지, 카테고리, 콘텐츠를 분석하고
              국내 판매 등록을 준비합니다.
            </p>

            {/* Sprint A-9(작업7 — CEO 지시: "이제 쿠팡 연결 테스트는 끝났습니다.
                랜딩에서는 삭제해주세요. 실제 등록 시 등록 버튼에서만 체크하면
                됩니다.") — 여기서 하던 연결 확인은 삭제한다. CommerceWorkspace가
                쿠팡 탭에서 등록 직전(confirmListing)에 이미 독립적으로 다시
                확인한다(등록 직전 최종 재확인이 이 화면의 사전 확인보다 더
                정확하다 — 그 사이에 토큰이 만료될 수도 있으므로). */}
            <div className="mx-auto mt-8 flex max-w-[960px] flex-col gap-2 rounded-xl border border-border bg-surface p-2 shadow-subtle sm:flex-row sm:items-center">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/product/123"
                aria-label="상품 URL"
                disabled={loading}
                className="flex-1 rounded-md border-0 bg-transparent px-4 py-3.5 text-sm text-text-primary focus:outline-none disabled:opacity-60"
              />
              <button
                onClick={runPipeline}
                disabled={loading || !url}
                className="flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3.5 text-sm font-medium text-white shadow-subtle transition-colors hover:bg-primary-hover disabled:opacity-40"
              >
                상품 분석 →
              </button>
            </div>
          </div>

          <div className="mx-auto mt-10 max-w-[1000px] border-t border-border pt-6">
            <p className="text-xs font-medium text-text-tertiary">
              따져가 자동으로 처리합니다
            </p>
            <ul className="mt-3 grid grid-cols-1 gap-2 text-left text-sm text-text-secondary sm:grid-cols-2 lg:grid-cols-3">
              {[
                "상품 정보 추출",
                "카테고리 분석",
                "이미지 최적화 (JPG 표준화)",
                "상품명·설명 생성",
                "국내 판매 정보 준비",
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <span className="text-success">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="mx-auto mt-6 max-w-[1000px] border-t border-border pt-6">
            <p className="text-xs font-medium text-text-tertiary">지원 플랫폼</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
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
        </>
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
            onPreviewImage={(id) => {
              setSelectedId(id);
              setPreviewId(id);
            }}
            onSetRepresentative={setRepresentative}
            onToggleGalleryUsage={(id) => toggleImageUsage(id, "useInProductGallery")}
            onToggleDescriptionUsage={(id) => toggleImageUsage(id, "useInDescription")}
            onMoveImage={moveImage}
            onAddImage={addImage}
            onRemoveImage={removeImage}
            addingImage={addingImage}
            developerMode={developerMode}
            analysisStartedAt={analysisStartedAt}
            snapshotId={snapshotId}
            jobKey={jobKey}
            initialCategoryMappings={categoryMappings ?? undefined}
            onCategoryMappingsChange={setCategoryMappings}
          />

          {/* P0-UI Epic 1 — JSON/ZIP/원본 URL/처리 리포트 등은 판매자가 매일 볼
           * 필요가 없는 개발자 정보다. Developer Mode를 껐으면 이 섹션 자체가
           * 화면에 없다(토글 버튼도 안 보인다) — 대표이미지 관리는 이미
           * "원본" 탭의 ImageInlineEditor로 옮겨졌으니 여기 안 보여도 기능
           * 손실이 없다. */}
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
                  {(product?.images ?? []).map((image, index) => {
                    const item = items.find((existing) => existing.id === image.id);
                    if (!item) return null;
                    return (
                      <ImageCard
                        key={item.id}
                        item={item}
                        tab={activeTab}
                        thumbnailDataUrl={thumbnails[item.id]}
                        isRepresentative={representativeId === item.id}
                        useInProductGallery={image.useInProductGallery}
                        useInDescription={image.useInDescription}
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
                        onMoveUp={index > 0 ? () => moveImage(item.id, "up") : undefined}
                        onMoveDown={index < (product?.images.length ?? 0) - 1 ? () => moveImage(item.id, "down") : undefined}
                        onSwapVariant={item.alternateDataUrl ? () => swapVariant(item.id) : undefined}
                      />
                    );
                  })}
                </div>

                <div>
                  <button
                    onClick={() =>
                      result &&
                      downloadWorkspaceZip(
                        items,
                        new Set((product?.images ?? []).filter((img) => !img.useInProductGallery).map((img) => img.id)),
                        result.metadata,
                        result.report,
                      )
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
