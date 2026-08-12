"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CanonicalProduct, CommerceCategoryPathResult, FieldSource, PlatformId } from "@commerce/shared";
import {
  buildResolverBiasedQuery,
  resolveProductSignals,
  ruleBasedCategoryProvider,
  UNRESOLVED_CATEGORY,
  type CategoryCandidate,
  type CategorySelection,
} from "@commerce/category";
import { mockProductContentProvider } from "@commerce/content";
import {
  buildComplianceReport,
  buildCoupangCompliance,
  LISTING_EXECUTORS,
  validateSmartStoreListing,
  type ComplianceFieldSource,
  type ComplianceReport,
  type CoupangCategoryMeta,
  type CoupangPayload,
  type DetailPageBlock,
  type ExecutionMode,
  type ListingResult,
  type ListingStatus,
  type PlatformConnectionStatus,
  type RegistrationHistoryEntry,
} from "@commerce/listing";
import { PLATFORM_ADAPTERS, PLATFORM_ORDER, isVerifiedCategorySelected } from "@commerce/marketplace";
import { AIContentPanel } from "./commerce/AIContentPanel";
import { BacklogPanel } from "./commerce/BacklogPanel";
import { ComparisonShopSearch } from "./commerce/ComparisonShopSearch";
import { CoupangConnectionPanel } from "./commerce/CoupangConnectionPanel";
import { ImageGalleryModal } from "./commerce/ImageGalleryModal";
import { ImageSummaryCard } from "./commerce/ImageSummaryCard";
import { ListingConfirmationModal } from "./commerce/ListingConfirmationModal";
import { PlatformPreview } from "./commerce/PlatformPreview";
import { RegistrationHistoryPanel } from "./commerce/RegistrationHistoryPanel";
import { StageStepper } from "./commerce/StageStepper";
import { SourceDataView } from "./commerce/SourceDataView";
import type { WorkspaceItem } from "./types";

type CommerceTab = "source" | "content" | PlatformId;

/** 아직 구현되지 않아 탭에서 비활성화하고 SOON 배지로 표시하는 플랫폼/기능 —
 * 백로그 패널에도 같은 목록을 보여준다. */
const SOON_PLATFORMS = new Set<PlatformId>(["smartstore", "elevenst"]);

const INITIAL_CATEGORY_MAPPINGS: Record<PlatformId, CategorySelection> = {
  smartstore: UNRESOLVED_CATEGORY,
  coupang: UNRESOLVED_CATEGORY,
  elevenst: UNRESOLVED_CATEGORY,
};

const INITIAL_LISTING_STATES: Record<PlatformId, ListingStatus> = {
  smartstore: "DRAFT",
  coupang: "DRAFT",
  elevenst: "DRAFT",
};

const INITIAL_LISTING_RESULTS: Record<PlatformId, ListingResult | null> = {
  smartstore: null,
  coupang: null,
  elevenst: null,
};

const TAB_LABELS: Record<Exclude<CommerceTab, PlatformId>, string> = {
  source: "상품 정보",
  content: "AI 콘텐츠",
};

/**
 * CanonicalProduct 하나를 들고 있다가 상품 정보 / AI 콘텐츠 / 스마트스토어 / 쿠팡 /
 * 11번가 탭을 전환할 때마다 같은 데이터를 해당 플랫폼 Adapter에 통과시켜 다시
 * 렌더링한다. 플랫폼별로 데이터를 복제하지 않는다 — 새 플랫폼을 추가하려면
 * PLATFORM_ADAPTERS에 Adapter 하나만 등록하면 이 컴포넌트는 그대로 재사용된다.
 *
 * product는 이 컴포넌트가 소유하지 않는다(controlled) — page.tsx가 이미지 카드의
 * 원본/누끼 후보 전환도 같은 product state에 반영해야 하므로, 소유권이 상위로
 * 올라가 있어야 두 UI(이미지 카드 / 등록 Preview)가 항상 같은 값을 본다.
 */
export function CommerceWorkspace({
  product,
  onUpdateProduct,
  items,
  thumbnails,
  representativeId,
  excludedIds,
  onPreviewImage,
  onSetRepresentative,
  onToggleGalleryUsage,
  onToggleDescriptionUsage,
  onToggleExclude,
  developerMode,
  analysisStartedAt,
  snapshotId,
  detailBlocks,
  onDetailBlocksChange,
  initialCategoryMappings,
  onCategoryMappingsChange,
}: {
  product: CanonicalProduct;
  onUpdateProduct: (updater: (prev: CanonicalProduct) => CanonicalProduct) => void;
  items: WorkspaceItem[];
  thumbnails: Record<string, string>;
  representativeId: string | null;
  excludedIds: Set<string>;
  onPreviewImage: (id: string) => void;
  onSetRepresentative: (id: string) => void;
  onToggleGalleryUsage: (id: string) => void;
  onToggleDescriptionUsage: (id: string) => void;
  onToggleExclude: (id: string) => void;
  /** P0-UI Epic 1/4 — Payload JSON/개발 로그 등은 이 값이 true일 때만 보여준다. */
  developerMode: boolean;
  /** Sprint A-6(작업4 — 등록 소요시간 측정) — page.tsx가 URL 제출 시점에 잰
   * epoch ms. 없으면(예: 재시도로 이 화면에 다시 진입한 경우) 총 소요시간은
   * 생략하고 에디터 소요시간만 잰다. */
  analysisStartedAt?: number | null;
  /** "최근 작업" 스냅샷에서 이어서 등록하는 경우 저장된 스냅샷 id — LIVE 등록
   * 시 그대로 executor에 넘겨 registration_attempts.snapshot_id로 남긴다. */
  snapshotId?: string | null;
  /** Detail Page Editor(2026-08-04) — product와 같은 이유로 controlled다.
   * page.tsx가 스냅샷 저장/복원 대상에 포함해야 하므로 이 컴포넌트가 상태를
   * 소유하지 않는다. */
  detailBlocks: DetailPageBlock[];
  onDetailBlocksChange: (blocks: DetailPageBlock[]) => void;
  /** N-3.12 Phase 2 P0① — 카테고리 선택은 그동안 이 컴포넌트의 로컬 state로만
   * 살아있었다(새로고침/재오픈 시 초기화되는 실제 버그의 원인). detailBlocks와
   * 같은 방식(mirror-up)으로 page.tsx가 값을 미러링해 스냅샷에 저장하고,
   * 재오픈 시 이 초기값으로 되돌려준다 — product처럼 완전히 controlled로
   * 끌어올리진 않는다(이 컴포넌트 내부에서 매우 자주 갱신되는 값이라 상위로
   * 완전히 옮기면 변경 범위가 커진다). */
  initialCategoryMappings?: Record<PlatformId, CategorySelection>;
  onCategoryMappingsChange?: (mappings: Record<PlatformId, CategorySelection>) => void;
}) {
  // P0-UI Epic 1 — "이미지" 영역을 대표이미지+장수 요약 카드로 줄이고, 기존
  // ImageRoleGrid(대표/상품/상세 역할 지정 그리드)는 이 카드를 눌렀을 때만 여는
  // 모달로 옮긴다. 데이터/핸들러는 전부 이 컴포넌트가 이미 갖고 있던 그대로 재사용한다.
  const [galleryOpen, setGalleryOpen] = useState(false);
  // Sprint A-6(작업4) — 이 컴포넌트가 처음 마운트되는 시점 = AI 분석이 끝나고
  // Registration Editor가 실제로 뜬 시점이다. useState 초기화 함수는 최초
  // 렌더에서 딱 한 번만 실행되므로 재렌더마다 값이 바뀌지 않는다.
  const [editorEnteredAt] = useState(() => Date.now());
  const setProduct = onUpdateProduct;
  // Sprint A-10(작업6 — CEO 지시: "URL 분석→쿠팡 수정→설정→뒤로가기→쿠팡 수정
  // 화면 유지") — page.tsx의 sessionStorage 복원(A-9-6)은 product/items 등
  // 분석 결과만 복원했지, 어느 탭이 열려 있었는지는 기억하지 못했다. 그래서
  // Settings에 갔다가 뒤로가기하면 상품 데이터는 그대로인데 탭만 "source"로
  // 되돌아갔다. 이 컴포넌트가 다시 마운트될 때(= 페이지를 벗어났다 돌아올 때)
  // 마지막으로 보던 탭을 그대로 복원한다.
  const TAB_STORAGE_KEY = "cartpilot-pipeline-tab-v1";
  const [tab, setTab] = useState<CommerceTab>(() => {
    if (typeof window === "undefined") return "source";
    try {
      const saved = sessionStorage.getItem(TAB_STORAGE_KEY);
      if (saved === "source" || saved === "content" || PLATFORM_ORDER.includes(saved as PlatformId)) {
        return saved as CommerceTab;
      }
    } catch {
      // sessionStorage 접근 불가 — 기본값(source)으로 시작한다.
    }
    return "source";
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(TAB_STORAGE_KEY, tab);
    } catch {
      // 저장 실패해도 이번 세션 안에서는 정상 동작한다 — 복원만 안 될 뿐이다.
    }
  }, [tab]);
  const [categoryMappings, setCategoryMappings] = useState(
    () => initialCategoryMappings ?? INITIAL_CATEGORY_MAPPINGS,
  );
  // N-3.12 Phase 2 P0① — page.tsx로 미러링해서 스냅샷에 저장한다(위 props 주석 참고).
  useEffect(() => {
    onCategoryMappingsChange?.(categoryMappings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryMappings]);
  const [listingStates, setListingStates] = useState(INITIAL_LISTING_STATES);
  const [listingResults, setListingResults] = useState(INITIAL_LISTING_RESULTS);
  const [confirmingPlatform, setConfirmingPlatform] = useState<PlatformId | null>(null);
  // A-12.3(작업8, CPO 지시: "React State → Payload → 등록 구조는 유지하고, 지금은
  // 임시 수정 상태인지 저장된 상태인지 알려주는 UX만 추가") — EditableText/
  // EditableTextarea(commerce/EditableField.tsx)는 blur 시점에만 CanonicalProduct에
  // 커밋한다. 그 사이(포커스 중)엔 화면에 보이는 값이 아직 product state에
  // 반영되지 않은 상태다 — data-draft-field로 마킹된 필드만 추적한다(카테고리
  // 검색창 등 커밋 개념이 없는 다른 input과 섞이지 않도록).
  const [isEditingDraftField, setIsEditingDraftField] = useState(false);
  // 등록 버튼 클릭은 마우스다운→(포커스 이동에 따른 blur)→click 순으로 일어나서,
  // click 핸들러(openListingModal) 시점엔 이미 blur가 끝나 있다 — 그래서 "클릭
  // 직전에 편집 중이었는지"는 blur보다 먼저 도착하는 mousedown에서 미리 기록해둔다.
  const wasEditingDraftFieldRef = useRef(false);
  function isDraftFieldTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && target.getAttribute("data-draft-field") === "true";
  }
  const [registrationHistory, setRegistrationHistory] = useState<RegistrationHistoryEntry[]>([]);
  const [coupangConnection, setCoupangConnection] = useState<PlatformConnectionStatus>("UNKNOWN");
  const [coupangConnectionCheckedAt, setCoupangConnectionCheckedAt] = useState<string | null>(null);
  const [coupangConnectionChecking, setCoupangConnectionChecking] = useState(false);
  // A-12.3-P0-2(CPO 지시: "① 쿠팡 API 추천이 후보 1개가 아니라 순위 리스트로
  // 보여야 한다") — 예전엔 resolveCategoryV3가 이미 계산해둔 Top5 후보 중
  // best 하나만 화면에 올라갔다(나머지는 Trace Log 텍스트로만 보였다). 이제
  // 실존 검증(metaVerified)까지 통과한 후보를 전부 배열로 들고 있는다.
  const [coupangApiCandidates, setCoupangApiCandidates] = useState<CategoryCandidate[]>([]);
  /** A-12.3-P0-4(CPO 3차 지시 — regression 수정: "추천과 검색은 대체관계가
   * 아니라 항상 동시에 존재해야 한다") — 이전엔 검색 결과를 recommend와 같은
   * state(coupangApiCandidates)에 덮어써서, 검색하면 추천이 사라지고 추천을
   * 다시 부르면 검색 결과가 사라졌다. 완전히 분리된 state로 "AI 추천"과
   * "직접 검색" 두 결과가 동시에 화면에 남아있게 한다. */
  const [coupangSearchCandidates, setCoupangSearchCandidates] = useState<CategoryCandidate[]>([]);
  const [coupangSearchAttempted, setCoupangSearchAttempted] = useState(false);
  const [coupangRecommendAttempted, setCoupangRecommendAttempted] = useState(false);
  /** Sprint A-5(Category Resolver 3.0 KPI) — coupangApiCandidate가 어떤
   * 판정(AUTO_SELECT/RECOMMEND/REJECT)과 유사도로 나왔는지. selectCategory가
   * 사용자 확정 시점에 categoryResolverKpi로 그대로 옮겨 담아서 등록 이력에
   * 남긴다(대시보드 Reject Rate/Resolver Accuracy 집계용). */
  const [coupangResolverDecision, setCoupangResolverDecision] = useState<{
    decision: "AUTO_SELECT" | "RECOMMEND" | "REJECT";
    score: number;
    // Sprint A-10(작업2/8 — CEO 지시: "사유: 상품유형 불일치 / KC 요구 카테고리 /
    // 식품 카테고리 충돌처럼 사람이 이해할 수 있는 문장으로") — scoreCategoryCandidate
    // (packages/category)가 이미 만들어둔 실제 대조 근거 문장을 그대로 옮긴다.
    // 지어낸 사유 목록을 새로 만들지 않는다 — REJECT일 때만 있다.
    reason?: string;
    rejectedCandidates?: { categoryName: string; categoryCode: number; score: number; reason: string }[];
  } | null>(null);
  const [coupangCategoryFetching, setCoupangCategoryFetching] = useState(false);
  const [coupangSettingsMissing, setCoupangSettingsMissing] = useState<string[] | null>(null);
  /** Sprint A-11(작업8) — 없어도 등록은 되지만 채워두면 좋은 판매자 설정 목록. */
  const [coupangSettingsRecommended, setCoupangSettingsRecommended] = useState<string[] | null>(null);
  /** P0(Category Resolver 추적) — "추천 → 검증 → 선택"이 실제로 어떻게 이어졌는지
   * 등록 전에도 화면에서 바로 볼 수 있게 한다(register/route.ts의 "카테고리 추적"
   * 로그는 등록 시점에만 남아서, 등록 전 단계의 추론 과정은 별도로 남겨야 한다). */
  const [categoryTraceLog, setCategoryTraceLog] = useState<string[]>([]);
  const [exchangeRates, setExchangeRates] = useState<{
    rates: Record<string, number>;
    fetchedAt: string;
    source: "frankfurter" | "fallback";
  } | null>(null);
  const [exchangeRatesLoading, setExchangeRatesLoading] = useState(false);
  /** Sprint A #1(Category Meta -> 동적 입력폼) — 카테고리를 실제로 선택(검증된
   * 쿠팡 코드로 SELECTED)하면 그 코드의 필수 구매옵션/고시정보를 미리 불러와서
   * 등록 전에 화면에서 채울 수 있게 한다. 지금까지는 이 API가 등록 시점
   * (register 라우트) 안에서만 호출돼서, 카테고리를 골라도 "아무것도 안 생기고"
   * 등록해야 비로소 "카테고리 코드 없음/속성 없음" 오류를 만났다 — 그 공백을
   * 메운다. 쿠팡에만 있다(요구사항 자체가 쿠팡 등록 실패에서 나왔고,
   * buildCoupangCompliance도 쿠팡 전용이다). */
  const [categoryMeta, setCategoryMeta] = useState<CoupangCategoryMeta | null>(null);
  const [categoryMetaLoading, setCategoryMetaLoading] = useState(false);
  const [categoryMetaError, setCategoryMetaError] = useState<string | null>(null);
  /** Sprint A-2(Auto Fill) — register 라우트가 실제 등록 시 쓰는 기본 배송
   * 프로필의 연락처를 미리 가져온다. buildCoupangCompliance의 "소비자상담
   * 관련 전화번호"/"A/S 책임자와 전화번호" KNOWN_VALUE 매칭이 등록 시점과
   * 똑같이 동작하게 하려면 이 값이 필요하다(없으면 그 두 필드만 실제로는
   * 자동 채워지는데도 화면에서 "입력 필요"로 잘못 보인다). */
  const [defaultContactNumber, setDefaultContactNumber] = useState("");

  /** P0(환율 시스템) — 고정 환율표 대신 실제 환율을 보여준다. 컴포넌트 마운트
   * 시 한 번 불러오고, 이후엔 "새로고침" 버튼으로만 다시 부른다(CPO 요구사항:
   * "실시간일 필요 없다" — 매 렌더/매 타이핑마다 다시 부르지 않는다). */
  async function fetchExchangeRates() {
    setExchangeRatesLoading(true);
    try {
      const res = await fetch("/api/exchange-rates");
      const data = await res.json();
      setExchangeRates(data);
    } catch {
      // 실패해도 화면은 packages/pricing의 고정 환율표로 계속 동작한다
      // (PriceEditor가 liveRates 없으면 자동 폴백) — 여기서 에러를 삼킨다.
    } finally {
      setExchangeRatesLoading(false);
    }
  }

  useEffect(() => {
    fetchExchangeRates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 쿠팡 탭에서 카테고리가 "검증된 코드로 실제 선택"됐을 때만 부른다 — 추천만
   * 떠 있는 상태(RECOMMENDED)나 미검증 후보로는 부르지 않는다(CP001과 같은 이유:
   * state만 보고 판단하면 검증 안 된 후보에도 반응해서 register 라우트가 이미
   * 겪은 것과 같은 문제가 여기서도 재발한다 — isVerifiedCategorySelected 하나로
   * 통일). */
  useEffect(() => {
    const selection = categoryMappings.coupang;
    if (tab !== "coupang" || !isVerifiedCategorySelected(selection) || !selection.candidate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchExchangeRates 위와 같은 패턴(기존 코드)
      setCategoryMeta(null);
      setCategoryMetaError(null);
      return;
    }
    let cancelled = false;
    setCategoryMetaLoading(true);
    setCategoryMetaError(null);
    fetch(`/api/coupang/category-meta?code=${selection.candidate.id}`)
      .then((res) => res.json())
      .then((data: { body?: CoupangCategoryMeta; error?: string }) => {
        if (cancelled) return;
        if (data.body) {
          setCategoryMeta(data.body);
        } else {
          setCategoryMeta(null);
          setCategoryMetaError(data.error ?? "카테고리 필수 항목을 불러오지 못했습니다.");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCategoryMeta(null);
          setCategoryMetaError("카테고리 필수 항목을 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!cancelled) setCategoryMetaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, categoryMappings.coupang]);

  /** Sprint A-2(Auto Fill) — 기본 배송 프로필의 연락처만 필요하다(전체 설정
   * 미비 여부는 아래 별도 effect가 이미 확인한다). 쿠팡 탭 진입 시 한 번만
   * 조회한다 — 자주 안 바뀌는 값이라 카테고리 선택마다 다시 부를 이유가 없다. */
  useEffect(() => {
    if (tab !== "coupang") return;
    let cancelled = false;
    fetch("/api/settings/coupang/profiles")
      .then((res) => res.json())
      .then((data: { profiles?: { isDefault: boolean; companyContactNumber: string }[] }) => {
        if (cancelled) return;
        const profiles = data.profiles ?? [];
        const defaultProfile = profiles.find((p) => p.isDefault) ?? profiles[0];
        setDefaultContactNumber(defaultProfile?.companyContactNumber ?? "");
      })
      .catch(() => {
        if (!cancelled) setDefaultContactNumber("");
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  /** 쿠팡 탭에 들어올 때마다 저장된 판매자 설정이 등록에 필요한 항목을 모두
   * 채웠는지 확인한다 — 실제 쿠팡 API를 호출하지 않는 단순 DB/env 조회라 자동으로
   * 확인해도 비용/부작용이 없다(쿠팡 연결 확인 자체와는 다르다, 그건 여전히
   * 수동이다). 누락됐으면 등록 버튼 대신 "설정하러 가기" 배너를 보여준다. */
  useEffect(() => {
    if (tab !== "coupang") return;
    let cancelled = false;
    fetch("/api/settings/coupang")
      .then((res) => res.json())
      .then((data: { missing?: string[]; recommended?: string[] }) => {
        if (!cancelled) {
          setCoupangSettingsMissing(data.missing ?? []);
          setCoupangSettingsRecommended(data.recommended ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCoupangSettingsMissing(null);
          setCoupangSettingsRecommended(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  /** 페이지/탭 진입 시 자동으로 호출하지 않는다 — 사용자가 [연결 다시 확인]을
   * 누르거나(CoupangConnectionPanel), 등록 직전(confirmListing)에만 실제 쿠팡
   * API가 호출된다. 반환값을 그대로 쓸 수 있게 해서, confirmListing이 방금 setState한
   * "다음 렌더의" coupangConnection이 아니라 "지금 이 순간의" 상태를 즉시 판단할 수
   * 있게 한다(React state는 비동기라 setState 직후 값을 바로 읽을 수 없다). */
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

  function updateField(
    key:
      | "title"
      | "brand"
      | "sku"
      | "description"
      | "material"
      | "titleKo"
      | "descriptionKo"
      | "seoTitle"
      | "seoDescription"
      | "countryOfOrigin"
      | "returnPolicy"
      | "manufacturer"
      | "certification"
      | "careInstructions"
      | "color"
      | "recommendedAge",
    value: string,
  ) {
    setProduct((prev) => ({
      ...prev,
      [key]: { value, source: "USER_EDITED" as FieldSource, confidence: 1 },
    }));
  }

  function updateNumberField(key: "shippingFee" | "stockQuantity", value: number) {
    setProduct((prev) => ({
      ...prev,
      [key]: { value, source: "USER_EDITED" as FieldSource, confidence: 1 },
    }));
  }

  /** Sprint A-12(작업6 — CPO 지시: "옵션 품질 개선: SKU/재고/가격추가까지
   * 편집 가능해야 한다") — variants[]는 이미 sku?/stockQuantity?/price?를
   * 갖고 있었지만(P0-2 Option 모델 설계) 편집 UI가 없어서 실질적으로 항상
   * 비어 있었다. id로 하나만 골라 patch한다 — 나머지 variant는 그대로 둔다. */
  function updateVariant(
    variantId: string,
    patch: Partial<{ sku: string; stockQuantity: number; price: { amount: number; currency: string } | undefined }>,
  ) {
    setProduct((prev) => ({
      ...prev,
      variants: prev.variants.map((v) => (v.id === variantId ? { ...v, ...patch } : v)),
    }));
  }

  function updatePrice(amount: number, currency: string) {
    setProduct((prev) => ({
      ...prev,
      price: { value: { amount, currency }, source: "USER_EDITED" as FieldSource, confidence: 1 },
    }));
  }

  /** "원본 가격"(product.price, 항상 원본 통화)과 별개로 "실제 판매가"(KRW)만
   * 저장한다 — updatePrice처럼 product.price를 덮어쓰면 원본 통화 정보가
   * 사라져서 다시 보여줄 수 없게 된다. 어댑터는 이 값이 있으면 환율 추정 대신
   * 이 값을 우선 쓴다(packages/marketplace의 각 adapter 참고). */
  function updateSalePriceKrw(amountKrw: number) {
    setProduct((prev) => ({
      ...prev,
      priceOverrideKrw: { value: amountKrw, source: "USER_EDITED" as FieldSource, confidence: 1 },
    }));
  }

  /** CEO 실측 리포트(2026-08-03) — Shopify Markets 스토어는 공개 상품 JSON의
   * 통화/가격이 요청 지역(서버 리전)에 따라 달라지는 경우가 있어(presentment
   * pricing), 자동 크롤링이 실제 판매 통화/금액과 다른 값을 가져올 수 있다.
   * 완벽한 자동 감지가 불가능하니, "재화를 선택하면 대상 환율로 변경되서
   * 적용" — 원본 통화/금액을 직접 고칠 수 있게 하고, 고치는 즉시 아래
   * PriceEditor의 환율 계산이 새 통화 기준으로 그대로 다시 돈다(별도 재계산
   * 로직 불필요 — computePriceBreakdown이 product.price.value를 그대로 읽는다). */
  function updateOriginalPrice(patch: Partial<{ amount: number; currency: string }>) {
    setProduct((prev) => ({
      ...prev,
      price: { value: { ...prev.price.value, ...patch }, source: "USER_EDITED" as FieldSource, confidence: 1 },
    }));
  }

  /** P0-1(가격 계산 투명화) — 배송비/수수료율/마진율 입력값을 저장한다.
   * priceOverrideKrw(최종 판매가)와는 별개다 — "적용" 버튼을 눌러야만
   * suggestedPriceKrw가 priceOverrideKrw로 반영된다(계산기와 최종값을
   * 분리해서, 계산기를 만지는 중에 등록가가 먼저 바뀌지 않게 한다). */
  function updatePriceBreakdown(breakdown: { shippingKrw: number; feePercent: number; marginPercent: number }) {
    setProduct((prev) => ({ ...prev, priceBreakdown: breakdown }));
  }

  /** Sprint A #1 — CategoryRequirementsEditor에서 입력한 값을 저장한다. 빈
   * 문자열로 지우면 다시 자동 매칭/임시값 경로로 돌아간다(build-payload.ts가
   * falsy 값은 override로 취급하지 않는다). */
  function updateCategoryFieldOverride(fieldName: string, value: string) {
    setProduct((prev) => {
      const next = { ...(prev.categoryFieldOverrides ?? {}) };
      if (value) {
        next[fieldName] = value;
      } else {
        delete next[fieldName];
      }
      return { ...prev, categoryFieldOverrides: next };
    });
  }

  function updateOptions(raw: string) {
    const options = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setProduct((prev) => ({
      ...prev,
      options: { value: options, source: "USER_EDITED" as FieldSource, confidence: 1 },
    }));
  }

  function updateKeywords(raw: string) {
    const keywords = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setProduct((prev) => ({
      ...prev,
      keywords: { value: keywords, source: "USER_EDITED" as FieldSource, confidence: 1 },
    }));
  }

  function generateContent() {
    setProduct((prev) => {
      const seo = mockProductContentProvider.generateSeo(prev);
      return {
        ...prev,
        titleKo: mockProductContentProvider.generateTitle(prev),
        descriptionKo: mockProductContentProvider.generateDescription(prev),
        keywords: mockProductContentProvider.generateKeywords(prev),
        seoTitle: seo.title,
        seoDescription: seo.description,
      };
    });
  }

  const categoryCandidates = useMemo(() => {
    if (tab === "source" || tab === "content") return [];
    const ruleBased = ruleBasedCategoryProvider.recommendCategory(product, tab);
    // CEO 피드백(2026-08-04) — "AI 추정 카테고리"(CartPilot 내부 rule-based
    // 추측)가 실제 쿠팡 코드가 아니고 선택해도 등록에 못 쓰여 혼란만 준다는
    // 지적. 쿠팡 탭은 실제 쿠팡 API가 돌려준 candidates(coupangApiCandidates)만
    // 보여주고, rule-based는 더 이상 섞지 않는다. 다른 플랫폼(스마트스토어 등,
    // 아직 검증 API가 없음)은 rule-based가 유일한 추천 소스라 그대로 둔다.
    if (tab === "coupang") return coupangApiCandidates;
    return ruleBased;
  }, [tab, product, coupangApiCandidates]);

  /** A-12.3-P0-3 — resolveCategoryV3의 "Rule" 입력 소스로 쓸 이름 목록.
   * ruleBasedCategoryProvider가 이미 매칭한 카테고리 이름을 predict 질의로
   * 다시 보내 실제 쿠팡 코드를 얻는다(위 categoryCandidates와 달리 이건 화면에
   * 직접 보여주지 않고 서버 질의 힌트로만 쓴다). */
  const ruleBasedQueryNames = useMemo(() => {
    if (tab !== "coupang") return [];
    return ruleBasedCategoryProvider.recommendCategory(product, tab).map((c) => c.name);
  }, [tab, product]);

  /**
   * 저장된 선택이 아직 UNRESOLVED인데 추천 후보가 있으면, 실제로 state를 바꾸지
   * 않고 렌더링/Validation에만 "RECOMMENDED + 1순위 후보"로 보이게 한다 — 사용자가
   * [선택]을 눌러야만 진짜 SELECTED로 커밋된다(추천이 보이는 것과 확정한 것을 구분).
   */
  const effectiveCategorySelection = useMemo((): CategorySelection => {
    if (tab === "source" || tab === "content") return UNRESOLVED_CATEGORY;
    const stored = categoryMappings[tab];
    if (stored.state === "UNRESOLVED" && categoryCandidates.length > 0) {
      return { state: "RECOMMENDED", candidate: categoryCandidates[0], provenance: "RECOMMENDED" };
    }
    return stored;
  }, [tab, categoryMappings, categoryCandidates]);

  function selectCategory(platform: PlatformId, candidate: CategoryCandidate) {
    setCategoryMappings((prev) => ({
      ...prev,
      [platform]: { state: "SELECTED", candidate, provenance: "USER_SELECTED" },
    }));
    setCategoryTraceLog((prev) => [
      ...prev,
      `선택: "${candidate.path.join(" > ")}" (id ${candidate.id}, 검증됨=${candidate.isVerifiedPlatformCode ?? false})`,
    ]);
    // Sprint A-2.5(Resolver KPI) — CPO 요구사항: "등록마다 Resolver Accuracy
    // KPI를 저장한다." predict API가 준 후보(coupangApiCandidate, 있으면)와
    // 실제 선택한 후보가 다르면 사용자가 수동으로 override한 것이다 — 이
    // 시점에 알 수 있는 것만 여기서 기록해두고, 실제 등록 시점(register
    // 라우트)에 finalRegistered를 더해 registration_attempts에 함께 저장한다.
    if (platform === "coupang") {
      const bestCoupangApiCandidate = coupangApiCandidates[0] ?? null;
      const predictResult =
        bestCoupangApiCandidate != null
          ? { code: Number(bestCoupangApiCandidate.id), name: bestCoupangApiCandidate.name }
          : null;
      const manualOverride = predictResult != null && String(predictResult.code) !== candidate.id;
      setProduct((prev) => ({
        ...prev,
        categoryResolverKpi: {
          predictResult,
          selectedResult: { code: Number(candidate.id) || 0, name: candidate.name },
          manualOverride,
          evidence: candidate.reason,
          resolverDecision: coupangResolverDecision?.decision ?? null,
          similarityScore: coupangResolverDecision?.score ?? null,
        },
      }));
    }
  }

  const listing = useMemo(() => {
    if (tab === "source" || tab === "content") return null;
    return PLATFORM_ADAPTERS[tab].toListingModel(product, effectiveCategorySelection);
  }, [tab, product, effectiveCategorySelection]);

  /** Sprint A-2(Auto Fill) — register 라우트가 등록 시점에만 돌리던
   * buildCoupangCompliance()를 여기서도 그대로 호출해서 "이미 자동으로 채워질
   * 값"을 등록 전에 미리 보여준다. 별도 매칭 로직을 새로 만들지 않는다 — 등록
   * 시점 계산과 다른 결과를 보여주면 그 자체로 CP001과 같은 종류의 신뢰
   * 문제가 된다(하나의 계산만 있어야 한다). variant는 대표로 첫 번째 것만
   * 쓴다 — 사이즈/색상처럼 옵션마다 값이 달라지는 필드는 CategoryRequirementsEditor가
   * source==="OPTION_MATCH"일 때 값을 직접 보여주지 않고 "옵션별로 자동 반영"
   * 안내만 하므로, 여기서 어떤 variant를 대표로 쓰든 최종 등록 결과에는 영향이
   * 없다(실제 등록은 품목마다 buildCoupangItem이 자기 variant로 다시 계산한다). */
  const compliancePreview = useMemo(() => {
    if (tab !== "coupang" || !categoryMeta || !listing) return null;
    return buildCoupangCompliance(
      categoryMeta,
      {
        productName: listing.title,
        contactNumber: defaultContactNumber,
        brand: product.brand.value || undefined,
        material: product.material.value || undefined,
        countryOfOrigin: product.countryOfOrigin.value || undefined,
        color: product.color.value || undefined,
        recommendedAge: product.recommendedAge.value || undefined,
        manufacturer: product.manufacturer.value || undefined,
        careInstructions: product.careInstructions.value || undefined,
        userOverrides: product.categoryFieldOverrides,
      },
      { optionGroups: product.optionGroups, variant: product.variants[0] },
    );
  }, [tab, categoryMeta, listing, product, defaultContactNumber]);

  const resolvedCategoryFields = useMemo(() => {
    if (!compliancePreview) return undefined;
    const map: Record<string, { value: string; source: ComplianceFieldSource; confidence: number }> = {};
    for (const r of [...compliancePreview.attributeResults, ...compliancePreview.noticeResults]) {
      map[r.fieldName] = { value: r.value, source: r.source, confidence: r.confidence };
    }
    return map;
  }, [compliancePreview]);

  /** Sprint A-3(작업7/8 — Summary가 KC/고시정보까지 반영, Resolver Trace를 등록 전에도
   * 보여주기) — compliancePreview(원시 attributeResults/noticeResults)를 register
   * 라우트와 똑같은 buildComplianceReport()에 통과시켜 점수/등급/근거까지 낸다.
   * 다른 계산을 새로 만들면 등록 시점 결과와 달라질 수 있다(CP001과 같은 위험). */
  const complianceReportPreview = useMemo(() => {
    if (!compliancePreview) return null;
    return buildComplianceReport(compliancePreview.attributeResults, compliancePreview.noticeResults);
  }, [compliancePreview]);

  // Sprint A-3(작업6 — Payload Preview) — CPO 요구사항: "등록 버튼을 누르는 순간
  // 생성하지 않는다. 항상 생성되어 있어야 한다." register/route.ts와 완전히 같은
  // 조립 로직을 재사용하는 /api/coupang/payload-preview를 카테고리가 확정되고
  // 필드가 바뀔 때마다(1.2초 디바운스) 호출해서 최신 payload를 들고 있는다 —
  // 등록 버튼 클릭과 무관하게 항상 최신 상태를 보여준다.
  const [payloadPreview, setPayloadPreview] = useState<{
    payload: CoupangPayload;
    complianceReport: ComplianceReport;
  } | null>(null);
  const [payloadPreviewUnavailableReason, setPayloadPreviewUnavailableReason] = useState<string | null>(null);

  // 카테고리가 아직 확정 안 됐거나 쿠팡 탭이 아니면 새로 요청할 것도 없다 — 이때
  // stale한 이전 payload를 지우는 setState는 여기서 하지 않는다(effect 본문
  // 안에서 곧바로 setState하면 react-hooks/set-state-in-effect가 캐스케이딩
  // 렌더 경고를 낸다). 대신 아래 렌더 시점에 같은 조건으로 null을 넘긴다 —
  // "언제 숨길지"는 파생 값 계산이지 effect의 일이 아니다.
  const payloadPreviewEligible = tab === "coupang" && !!listing && isVerifiedCategorySelected(listing.category);

  useEffect(() => {
    if (!payloadPreviewEligible || !listing) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch("/api/coupang/payload-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, listing, detailBlocks }),
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then(
          (data: {
            payload?: CoupangPayload;
            complianceReport?: ComplianceReport;
            reason?: string;
            error?: string;
          }) => {
            if (data.payload && data.complianceReport) {
              setPayloadPreview({ payload: data.payload, complianceReport: data.complianceReport });
              setPayloadPreviewUnavailableReason(null);
            } else {
              setPayloadPreview(null);
              setPayloadPreviewUnavailableReason(
                data.reason === "NOT_CONFIGURED"
                  ? "쿠팡 인증 정보가 설정되어 있지 않습니다."
                  : data.reason === "NO_SELLER_PROFILE"
                    ? "배송 프로필이 아직 없습니다 — 설정 페이지에서 먼저 만들어주세요."
                    : (data.error ?? "Payload를 생성하지 못했습니다."),
              );
            }
          },
        )
        .catch(() => {
          // AbortError(다음 입력이 이전 요청을 취소한 경우)는 조용히 무시한다 —
          // 진짜 실패가 아니라 디바운스가 의도한 동작이다.
        });
    }, 1200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [payloadPreviewEligible, product, listing, detailBlocks]);

  /** 쿠팡 카테고리 추천(자동매칭) API를 호출해서 실제 쿠팡 숫자 코드를 후보로
   * 보여준다 — CartPilot 내부 AI 추천(categoryCandidates)과는 완전히 다른 코드
   * 체계이므로 별도 state로 관리하고, isVerifiedPlatformCode: true로 표시해서
   * 사용자가 "이건 실제 쿠팡 코드"라는 걸 구분할 수 있게 한다. */
  async function fetchCoupangCategoryRecommendation(searchQuery?: string) {
    if (!listing) return;
    setCoupangCategoryFetching(true);
    // Sprint A-2.5(Category Resolver 2.0) — CPO 지시: "Predict API 중심 →
    // CartPilot Resolver 중심"으로 뒤집는다. predict API는 상품명 텍스트만 보고
    // 추측해서, 원본 사이트 자체 분류(breadcrumb/JSON-LD category/URL 경로)나
    // 브랜드(Kids Brand 목록)에 이미 있는 신호를 놓치면 성인/여성 쪽으로
    // 잘못 추측하는 게 실측으로 반복 확인됐다(Veja 스니커즈→여성스니커즈,
    // Eastpak 백팩→여성백팩). resolveProductSignals()가 CartPilot이 이미
    // 갖고 있는 신호를 전부 모아 먼저 판단하고, 그 판단으로 predict API에
    // 보내는 질의문을 보정한다 — 사용자가 직접 검색어를 입력했으면(searchQuery)
    // 이미 사람이 확정한 의도라 보정하지 않는다.
    const signals = resolveProductSignals(product);
    const baseQuery = searchQuery?.trim() || listing.title;
    const isUserQuery = !!searchQuery?.trim();
    const biasedQuery = buildResolverBiasedQuery(signals, baseQuery, isUserQuery);
    const evidenceLines = isUserQuery
      ? ["사용자가 직접 검색어를 입력함 — 자동 신호 보정 건너뜀"]
      : signals.evidence.length > 0
        ? signals.evidence.map((e) => `✓ ${e.label}`)
        : ["신호 없음 — 원본 상품명 그대로 질의"];
    // CPO 요구사항: Trace Log 형식(Breadcrumb → Kids → Brand → Kids Brand →
    // Product Type → T-shirt → Predict API → 여아 티셔츠 → Verified → 코드).
    setCategoryTraceLog((prev) => [
      ...prev,
      `Resolver 판단: 연령대=${signals.ageGroup} / 성별=${signals.gender} / 상품유형=${signals.productType ?? "미상"}`,
      ...evidenceLines,
      `→ Predict API 질의="${biasedQuery}"`,
    ]);
    try {
      const res = await fetch("/api/coupang/category-recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: biasedQuery,
          brand: listing.brand,
          signals,
          ruleBasedNames: ruleBasedQueryNames,
        }),
      });
      const data = (await res.json()) as {
        decision?: "AUTO_SELECT" | "RECOMMEND" | "REJECT";
        best?: { categoryCode: number; categoryName: string; score: number; reason: string } | null;
        candidates?: {
          categoryCode: number;
          categoryName: string;
          /** N-3.1 — root부터 leaf까지 전체 이름 경로. */
          path?: string[];
          /** N-3.1 — 각 노드의 실제 id를 포함한 계층(조회 가능했을 때만). */
          hierarchy?: CommerceCategoryPathResult;
          query: string;
          score: number;
          reason: string;
          conflict: boolean;
          /** A-12.3-P0-2 — category-meta 조회로 실제 존재(등록 가능한 리프
           * 카테고리)까지 확인됐는지. false면 predict가 코드를 줬을 뿐 등록
           * 시점에 거부될 수 있다는 뜻이라 "바로 등록 가능"으로 올리지 않는다. */
          metaVerified?: boolean;
        }[];
      };
      // Sprint A-5(Category Resolver 3.0) — CPO 지시: "말이 안 되면 Reject."
      // Top5 후보 비교를 Trace Log(사람이 읽는 텍스트 목록)에도 그대로
      // 노출한다 — CPO 예시 형식("1위 Coffee 22% ×, 2위 침구 94% ○")을 따른다.
      const candidateLines = (data.candidates ?? []).map(
        (c, i) =>
          `  ${i + 1}위 "${c.categoryName}"(코드 ${c.categoryCode}) — 유사도 ${c.score}% ${c.conflict ? "✗" : "○"}${c.metaVerified === false ? " · 실존 확인 안 됨" : ""} — ${c.reason}`,
      );
      // A-12.3-P0-4(CPO 3차 지시 — regression 수정) — 검색(isUserQuery)과
      // 자동추천은 서로 다른 state에 쓴다. 결과가 REJECT거나 candidates가
      // 0개여도 반드시 setState를 호출해서(빈 배열이라도) "시도했다"는
      // 사실이 남게 한다 — 그래야 화면이 "결과 없음" 메시지를 보여줄 수
      // 있다(이전엔 이 경로에서 아무 것도 안 하고 조용히 끝나서 검색
      // 버튼을 눌러도 화면이 그대로였다).
      const setCandidates = isUserQuery ? setCoupangSearchCandidates : setCoupangApiCandidates;
      if (isUserQuery) setCoupangSearchAttempted(true);
      else setCoupangRecommendAttempted(true);

      if (data.decision === "REJECT" || !data.candidates || data.candidates.length === 0) {
        setCandidates([]);
        if (!isUserQuery) {
          setCoupangResolverDecision({
            decision: "REJECT",
            score: data.best?.score ?? 0,
            reason: data.best?.reason,
            rejectedCandidates: (data.candidates ?? []).slice(0, 3).map((c) => ({
              categoryName: c.categoryName,
              categoryCode: c.categoryCode,
              score: c.score,
              reason: c.reason,
            })),
          });
        }
        setCategoryTraceLog((prev) => [
          ...prev,
          `→ Resolver 3.0 판정: REJECT${isUserQuery ? "(검색)" : ""} — 예측 결과가 상품유형과 명백히 다르거나, 실제 등록 가능한 카테고리로 확인되지 않았습니다.`,
          ...candidateLines,
        ]);
      } else {
        if (!isUserQuery) setCoupangResolverDecision({ decision: data.decision ?? "RECOMMEND", score: data.best!.score });
        // A-12.3-P0-2(CPO 지시: "① 쿠팡 API 추천이 순위 리스트로 보여야
        // 한다") — best 하나만이 아니라 candidates 전부를 후보로 올린다.
        // 실존 검증(metaVerified)을 통과한 것만 "바로 등록 가능"(①) 배지를
        // 받는다 — 통과 못 한 건 CategoryRecommendationPanel의 다른
        // 버킷(②/③)으로 자연히 내려간다.
        setCandidates(
          data.candidates.map((c) => ({
            id: String(c.categoryCode),
            name: c.categoryName,
            // N-3.1 — leaf 이름 하나가 아니라 트리에서 나온 전체 경로. 혹시
            // 경로 복원이 안 됐으면(트리 조회 실패 등) leaf 이름만이라도
            // 보여준다(빈 배열보다 낫다) — 추측으로 중간 단계를 채우지 않는다.
            path: c.path && c.path.length > 0 ? c.path : [c.categoryName],
            hierarchy: c.hierarchy,
            platform: "coupang",
            confidence: c.score / 100,
            reason: [
              ...evidenceLines,
              `✓ Predict API: "${c.categoryName}"(코드 ${c.categoryCode}, 유사도 ${c.score}%) — 등록 전 최종 확인이 필요합니다.`,
              c.metaVerified === false
                ? "⚠ 쿠팡 카테고리 메타 조회에서 존재가 확인되지 않았습니다 — 실제 등록 시 거부될 수 있습니다."
                : "✓ 쿠팡 카테고리 메타 조회로 실제 존재/등록 가능이 확인됐습니다.",
            ],
            source: "ai",
            isVerifiedPlatformCode: c.metaVerified === true,
          })),
        );
        setCategoryTraceLog((prev) => [
          ...prev,
          `→ Resolver 3.0 판정: ${data.decision}${isUserQuery ? "(검색)" : ""}(유사도 ${data.best!.score}%) — "${data.best!.categoryName}" (코드 ${data.best!.categoryCode})`,
          ...candidateLines,
        ]);
      }
    } catch {
      // A-12.3-P0-4(CPO 3차 지시) — 이전엔 catch에서 아무것도 안 해서 실패해도
      // 화면이 조용히 그대로였다("검색 버튼만 있고 아무 결과도 안 나온다"는
      // CPO 지적의 실제 원인 중 하나). 실패도 "시도했다"로 기록해서 화면이
      // 명시적인 에러/빈 상태 메시지를 보여줄 수 있게 한다.
      if (isUserQuery) {
        setCoupangSearchAttempted(true);
        setCoupangSearchCandidates([]);
      } else {
        setCoupangRecommendAttempted(true);
      }
    } finally {
      setCoupangCategoryFetching(false);
    }
  }

  /** A-12.3-P0-4(CPO 3차 지시 — regression 수정: "AI 추천 → 항상 표시") —
   * 지금까지 "쿠팡 API로 카테고리 확인"은 사용자가 버튼을 직접 눌러야만
   * 실행됐다(이 자체가 처음부터 있던 설계였다 — 최근 회귀와는 별개). CPO가
   * 원하는 흐름은 AI 추천이 사람 개입 없이 자동으로 나타나는 것이라, 쿠팡
   * 탭에 들어오면 한 번 자동으로 호출한다. sourceUrl이 바뀌면(새 상품)
   * 다시 자동 호출되도록 ref로 마지막에 자동 호출한 상품을 기억한다 —
   * 그 외의 리렌더/재선택에서는 재호출하지 않는다(무한 루프 방지, 또한
   * 이미 쿠팡 API를 여러 번 두드린 뒤라 불필요한 재호출로 레이트리밋을
   * 더 태우지 않기 위함).
   */
  const autoFetchedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (tab !== "coupang" || !listing) return;
    const key = product.sourceUrl;
    if (autoFetchedForRef.current === key) return;
    autoFetchedForRef.current = key;
    void fetchCoupangCategoryRecommendation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, listing, product.sourceUrl]);

  /**
   * SmartStore에서만 계산한다 — 원산지/반품정보/배송비/재고 같은 등록 직전
   * 필드는 CanonicalProduct에만 있고 ListingModel에는 없어서, product와 listing을
   * 둘 다 받는 이 함수로 합쳐야 한다(STEP 1의 3단 분리 원칙).
   */
  const smartStoreReadiness = useMemo(() => {
    if (tab !== "smartstore" || !listing) return undefined;
    return validateSmartStoreListing(product, listing);
  }, [tab, listing, product]);

  /**
   * DRAFT인데 ERROR급 validation이 하나도 없으면 화면에는 READY로 보여준다 —
   * 카테고리의 RECOMMENDED와 같은 패턴으로, 실제 state는 사용자가 등록 버튼을
   * 눌러야만(USER_CONFIRMED로) 바뀐다. SmartStore는 원산지/반품정보 누락도
   * ERROR로 잡아야 하므로 readiness.errorCount도 함께 확인한다.
   *
   * 카테고리는 marketplace validation에서 WARNING으로만 잡힌다(추천이 떠 있는
   * 상태와 사용자가 실제로 확정한 상태를 구분해야 해서 ERROR로 못 올린다 — WARNING
   * 의미 자체가 여러 곳에서 재사용된다). 하지만 실등록이 가능한 플랫폼(SOON이 아닌
   * 곳)은 카테고리 미확정 상태로 등록 API를 호출하면 서버가 CP001로 거부하는 게
   * 이미 확인된 문제였다 — 그 실패를 API 호출 이후가 아니라 여기서 미리 막는다.
   */
  const effectiveListingStatus: ListingStatus = useMemo(() => {
    if (tab === "source" || tab === "content" || !listing) return "DRAFT";
    const stored = listingStates[tab];
    if (stored !== "DRAFT") return stored;
    const noMarketplaceErrors = listing.validations.every((v) => v.status !== "ERROR");
    const noReadinessErrors = smartStoreReadiness ? smartStoreReadiness.errorCount === 0 : true;
    // isVerifiedPlatformCode까지 확인해야 한다 — state만 보면 이 화면이
    // READY로 잘못 판정해 등록 버튼을 열어주고 register API가 CP001로
    // 거부하는 버그가 재발한다(같은 실수가 StageStepper/PlatformPreview에도
    // 각각 따로 있었다 — packages/marketplace/category-field.ts 참고).
    const categoryConfirmed = isVerifiedCategorySelected(listing.category);
    const requiresCategory = !SOON_PLATFORMS.has(tab);
    return noMarketplaceErrors && noReadinessErrors && (!requiresCategory || categoryConfirmed)
      ? "READY"
      : "DRAFT";
  }, [tab, listing, listingStates, smartStoreReadiness]);

  function openListingModal() {
    if (tab === "source" || tab === "content") return;
    if (wasEditingDraftFieldRef.current) {
      wasEditingDraftFieldRef.current = false;
      const proceed = window.confirm(
        "적용되지 않은 변경사항이 있습니다. 적용 후 등록하시겠습니까?",
      );
      if (!proceed) return;
    }
    setListingStates((prev) => ({ ...prev, [tab]: "USER_CONFIRMED" }));
    setConfirmingPlatform(tab);
  }

  function cancelListingModal() {
    if (confirmingPlatform) {
      setListingStates((prev) => ({ ...prev, [confirmingPlatform]: "DRAFT" }));
    }
    setConfirmingPlatform(null);
  }

  /** 쿠팡 + 연결됨 상태일 때만 LIVE를 시도한다 — 그 외(SmartStore/11번가, 또는
   * 쿠팡이지만 인증 안 됨)는 항상 DRY_RUN이다. 아직 SmartStore/11번가는 이번
   * Mission 범위 밖이라 LIVE 경로 자체가 없다(executor가 NOT_IMPLEMENTED로
   * 막는다 — 여기서 미리 걸러도 되지만 executor가 이미 안전하므로 그대로 둔다).
   * connectionOverride: confirmListing이 방금 재확인한 "지금 이 순간의" 상태를
   * 넘겨줄 때 쓴다 — 안 넘기면 화면에 표시 중인(마지막으로 확인된) 상태를 쓴다. */
  function resolveExecutionMode(
    platform: PlatformId,
    connectionOverride?: PlatformConnectionStatus,
  ): ExecutionMode {
    const connection = connectionOverride ?? coupangConnection;
    if (platform === "coupang" && connection === "CONNECTED") return "LIVE";
    return "DRY_RUN";
  }

  async function confirmListing() {
    if (!confirmingPlatform || !listing) return;
    const platform = confirmingPlatform;
    setConfirmingPlatform(null);

    // 등록 직전 한 번 더 인증을 확인한다 — 모달을 열어둔 사이에 키가 만료되거나
    // 세션 시작 뒤 한 번도 확인 안 했을 수 있다. 여기서 확인한 "지금 이 순간의"
    // 상태로만 LIVE 여부를 결정한다(모달이 열려 있던 시점의 오래된 상태로 실제
    // 등록을 시도하지 않는다).
    const freshConnection = platform === "coupang" ? await checkCoupangConnection() : undefined;
    const mode = resolveExecutionMode(platform, freshConnection);
    const listingKey = `${product.sourceUrl}::${platform}`;

    // 중복 LIVE 등록 방지: 같은 상품(sourceUrl)+플랫폼으로 이미 성공한 LIVE 이력이
    // 세션 안에 있으면 쿠팡에 다시 요청하지 않고 그 결과를 그대로 다시 보여준다.
    if (mode === "LIVE") {
      const existing = registrationHistory.find(
        (entry) => entry.listingKey === listingKey && entry.mode === "LIVE" && entry.result.status === "SUBMITTED",
      );
      if (existing) {
        setListingResults((prev) => ({ ...prev, [platform]: existing.result }));
        setListingStates((prev) => ({ ...prev, [platform]: existing.result.status }));
        return;
      }
    }

    setListingStates((prev) => ({ ...prev, [platform]: "SUBMITTING" }));
    const result = await LISTING_EXECUTORS[platform].execute(product, listing, mode, {
      snapshotId: snapshotId ?? undefined,
      detailBlocks: platform === "coupang" ? detailBlocks : undefined,
    });
    setListingResults((prev) => ({ ...prev, [platform]: result }));
    const finishedAt = Date.now();
    setRegistrationHistory((prev) => [
      {
        productName: listing.title,
        platform,
        executedAt: new Date().toISOString(),
        mode,
        result,
        listingKey,
        // Sprint A-6(작업4 — 등록 소요시간 측정) — CPO 예시: "URL 입력 → 등록
        // 완료 2분 31초", "사용자 입력시간 42초"를 그대로 잰다. 재시도로 이
        // 시도가 여러 번째면 analysisStartedAt/editorEnteredAt은 최초 진입
        // 시점 그대로라 재시도 대기시간까지 포함된다 — "몇 번 막혔는지"를
        // 간접적으로도 보여주는 값이라 의도적으로 그대로 둔다.
        timing: {
          totalElapsedMs: analysisStartedAt != null ? finishedAt - analysisStartedAt : null,
          editorElapsedMs: finishedAt - editorEnteredAt,
        },
      },
      ...prev,
    ]);
    setListingStates((prev) => ({ ...prev, [platform]: result.status }));
  }

  function retryListing() {
    if (tab === "source" || tab === "content") return;
    setListingStates((prev) => ({ ...prev, [tab]: "DRAFT" }));
    setListingResults((prev) => ({ ...prev, [tab]: null }));
  }

  return (
    <section
      className="mt-8 space-y-4"
      onFocusCapture={(e) => {
        if (isDraftFieldTarget(e.target)) setIsEditingDraftField(true);
      }}
      onBlurCapture={(e) => {
        if (isDraftFieldTarget(e.target)) setIsEditingDraftField(false);
      }}
      onMouseDownCapture={() => {
        wasEditingDraftFieldRef.current = isDraftFieldTarget(document.activeElement);
      }}
    >
      <StageStepper product={product} categoryMappings={categoryMappings} onNavigate={setTab} />

      {isEditingDraftField && (
        <div className="flex w-fit items-center gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-1.5 text-xs font-medium text-warning">
          {/* A-12.3-P0(CPO 지시: "저장은 DB 저장을 오해시킨다") — 실제로는
           * React State에 커밋될 뿐 DB에는 아무것도 쓰지 않는다. "저장"이라는
           * 단어가 주는 "DB에 안전하게 들어갔다"는 인상을 피하려고 문구를
           * 바꾼다 — 동작은 그대로(blur → onCommit), 이름만 정확하게. */}
          <span>● 적용되지 않은 변경사항이 있습니다.</span>
          <button
            type="button"
            onClick={() => (document.activeElement as HTMLElement | null)?.blur()}
            className="rounded border border-warning/40 px-2 py-0.5 hover:bg-warning/10"
          >
            변경사항 적용
          </button>
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto border-b border-border">
        <TabButton active={tab === "source"} onClick={() => setTab("source")}>
          {TAB_LABELS.source}
        </TabButton>
        <TabButton active={tab === "content"} disabled onClick={() => setTab("content")}>
          {TAB_LABELS.content}
          <SoonBadge />
        </TabButton>
        {PLATFORM_ORDER.map((platformId) => {
          const soon = SOON_PLATFORMS.has(platformId);
          // Sprint N-2.7(CPO 지시) — smartstore(네이버)만 Preview 전용으로 임시
          // 활성화한다. requiresCategory 등 나머지 SOON_PLATFORMS 판정은 그대로
          // 두고(등록 버튼 자체가 registrationEnabled=false로 막혀 있어 무관하다),
          // 탭 클릭 가능 여부/배지만 smartstore를 예외 처리한다.
          const previewOnly = platformId === "smartstore";
          return (
            <TabButton
              key={platformId}
              active={tab === platformId}
              disabled={soon && !previewOnly}
              onClick={() => setTab(platformId)}
            >
              {PLATFORM_ADAPTERS[platformId].label}
              {previewOnly && <PreviewBadge />}
              {soon && !previewOnly && <SoonBadge />}
            </TabButton>
          );
        })}
      </div>

      {tab === "source" && (
        <>
          <ImageSummaryCard
            product={product}
            items={items}
            thumbnails={thumbnails}
            onOpen={() => setGalleryOpen(true)}
          />
          <SourceDataView
            product={product}
            onUpdateField={updateField}
            onUpdatePrice={updatePrice}
            onUpdateOptions={updateOptions}
            exchangeRates={exchangeRates}
          />
          <ComparisonShopSearch
            title={product.title.value}
            brand={product.brand.value}
            sourceUrl={product.sourceUrl}
            sku={product.sku.value || undefined}
          />
          <BacklogPanel />
        </>
      )}

      {tab === "content" && (
        <AIContentPanel
          product={product}
          onGenerate={generateContent}
          onUpdateField={updateField}
          onUpdateKeywords={updateKeywords}
        />
      )}

      {tab === "coupang" && (
        <CoupangConnectionPanel
          status={coupangConnection}
          checking={coupangConnectionChecking}
          checkedAt={coupangConnectionCheckedAt}
          onCheck={checkCoupangConnection}
        />
      )}

      {listing && tab !== "source" && tab !== "content" && (
        <PlatformPreview
          product={product}
          listing={listing}
          categoryCandidates={categoryCandidates}
          listingStatus={effectiveListingStatus}
          listingResult={listingResults[tab]}
          readiness={smartStoreReadiness}
          compliancePreview={complianceReportPreview}
          payloadPreview={payloadPreviewEligible ? payloadPreview : null}
          payloadPreviewUnavailableReason={payloadPreviewEligible ? payloadPreviewUnavailableReason : null}
          onUpdateField={updateField}
          onUpdateSalePriceKrw={updateSalePriceKrw}
          onUpdateOriginalPrice={updateOriginalPrice}
          onUpdatePriceBreakdown={updatePriceBreakdown}
          exchangeRates={exchangeRates}
          exchangeRatesLoading={exchangeRatesLoading}
          onRefreshExchangeRates={fetchExchangeRates}
          onSelectCategory={(candidate) => selectCategory(tab, candidate)}
          onFixTextField={updateField}
          onFixNumberField={updateNumberField}
          onUpdateOptions={updateOptions}
          onUpdateVariant={updateVariant}
          onOpenListingModal={openListingModal}
          onRetryListing={retryListing}
          onFetchCoupangCategory={tab === "coupang" ? fetchCoupangCategoryRecommendation : undefined}
          coupangCategoryFetching={coupangCategoryFetching}
          coupangSearchCandidates={tab === "coupang" ? coupangSearchCandidates : undefined}
          coupangSearchAttempted={coupangSearchAttempted}
          coupangRecommendAttempted={coupangRecommendAttempted}
          categoryTraceLog={categoryTraceLog}
          coupangResolverDecision={tab === "coupang" ? coupangResolverDecision : null}
          categoryMeta={tab === "coupang" ? categoryMeta : null}
          categoryMetaLoading={tab === "coupang" && categoryMetaLoading}
          categoryMetaError={tab === "coupang" ? categoryMetaError : null}
          categoryFieldOverrides={product.categoryFieldOverrides}
          onUpdateCategoryFieldOverride={updateCategoryFieldOverride}
          resolvedCategoryFields={resolvedCategoryFields}
          productOptionGroups={product.optionGroups}
          settingsMissing={tab === "coupang" ? (coupangSettingsMissing ?? undefined) : undefined}
          settingsRecommended={tab === "coupang" ? (coupangSettingsRecommended ?? undefined) : undefined}
          developerMode={developerMode}
          items={items}
          thumbnails={thumbnails}
          onOpenGallery={() => setGalleryOpen(true)}
          detailBlocks={tab === "coupang" ? detailBlocks : undefined}
          onDetailBlocksChange={tab === "coupang" ? onDetailBlocksChange : undefined}
        />
      )}

      <RegistrationHistoryPanel history={registrationHistory} />

      {confirmingPlatform && listing && (
        <ListingConfirmationModal
          listing={listing}
          mode={resolveExecutionMode(confirmingPlatform)}
          connectionStatus={confirmingPlatform === "coupang" ? coupangConnection : undefined}
          descriptionImageCount={product.images.filter((img) => img.useInDescription).length}
          selectedGalleryCount={
            product.images.filter((img) => img.useInProductGallery && !img.isRepresentative).length
          }
          complianceReport={confirmingPlatform === "coupang" ? complianceReportPreview : null}
          onCancel={cancelListingModal}
          onConfirm={confirmListing}
        />
      )}

      {galleryOpen && (
        <ImageGalleryModal
          product={product}
          items={items}
          thumbnails={thumbnails}
          representativeId={representativeId}
          excludedIds={excludedIds}
          onPreview={onPreviewImage}
          onSetRepresentative={onSetRepresentative}
          onToggleGalleryUsage={onToggleGalleryUsage}
          onToggleDescriptionUsage={onToggleDescriptionUsage}
          onToggleExclude={onToggleExclude}
          onClose={() => setGalleryOpen(false)}
        />
      )}
    </section>
  );
}

function TabButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? "다음 스프린트에 제공될 예정입니다" : undefined}
      className={`flex shrink-0 items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
        disabled
          ? "cursor-not-allowed border-b-2 border-transparent text-text-tertiary"
          : active
            ? "border-b-2 border-primary text-primary"
            : "border-b-2 border-transparent text-text-secondary hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}

/** 작고 둥근 muted pill — 비활성 탭 옆에 붙어 "곧 제공될 기능"임을 알려준다. */
function SoonBadge() {
  return (
    <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-text-tertiary">
      SOON
    </span>
  );
}

/** Sprint N-2.7 — smartstore 탭은 클릭 가능하지만 실제 등록은 아직 안 된다는
 * 걸 SOON과는 다른 문구로 구분한다("준비중"이 아니라 "미리보기 가능"). */
function PreviewBadge() {
  return (
    <span className="rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-warning">
      PREVIEW
    </span>
  );
}
