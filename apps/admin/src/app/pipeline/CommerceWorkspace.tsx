"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CanonicalProduct,
  CanonicalProductCertification,
  CanonicalProductVariant,
  CommerceCategoryPathResult,
  FieldSource,
  PlatformId,
} from "@commerce/shared";
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
  buildNaverProductPayload,
  LISTING_EXECUTORS,
  validateNaverPayload,
  type ComplianceFieldSource,
  type ComplianceReport,
  type CoupangCategoryMeta,
  type CoupangPayload,
  type ExecutionMode,
  type ListingResult,
  type ListingStatus,
  type NaverCategoryCandidate,
  type NaverPayloadValidationResult,
  type PlatformConnectionStatus,
  type RegistrationHistoryEntry,
} from "@commerce/listing";
import { PLATFORM_ADAPTERS, PLATFORM_ORDER, isVerifiedCategorySelected } from "@commerce/marketplace";
import { resolveSourcePrice } from "@commerce/pricing";
import { AIContentPanel } from "./commerce/AIContentPanel";
import { BacklogPanel } from "./commerce/BacklogPanel";
import { ComparisonShopSearch } from "./commerce/ComparisonShopSearch";
import { DomesticPriceIntelligencePanel } from "./commerce/DomesticPriceIntelligencePanel";
import type { PriceLevel } from "./commerce/DomesticPriceIntelligencePanel";
import { AuditLogPanel } from "./commerce/AuditLogPanel";
import { DomesticShopSearch } from "./commerce/DomesticShopSearch";
import { ImageInlineEditor } from "./ImageInlineEditor";
import { ListingConfirmationModal } from "./commerce/ListingConfirmationModal";
import type { NaverResolveResponse } from "./commerce/NaverPayloadPreview";
import { PlatformPreview } from "./commerce/PlatformPreview";
import { readinessStateToLevel } from "./commerce/readiness-state";
import type { PriorityItem, ReadinessLevel, RegistrationReadinessState } from "./commerce/readiness-state";
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
  onPreviewImage,
  onSetRepresentative,
  onToggleGalleryUsage,
  onToggleDescriptionUsage,
  onMoveImage,
  onAddImage,
  onRemoveImage,
  addingImage,
  developerMode,
  analysisStartedAt,
  snapshotId,
  jobKey,
  initialCategoryMappings,
  onCategoryMappingsChange,
}: {
  product: CanonicalProduct;
  onUpdateProduct: (updater: (prev: CanonicalProduct) => CanonicalProduct) => void;
  items: WorkspaceItem[];
  thumbnails: Record<string, string>;
  representativeId: string | null;
  onPreviewImage: (id: string) => void;
  onSetRepresentative: (id: string) => void;
  onToggleGalleryUsage: (id: string) => void;
  onToggleDescriptionUsage: (id: string) => void;
  onMoveImage: (id: string, direction: "up" | "down") => void;
  /** CEO 지시(2026-08-24, CPO 부재중): "각 커머스별 이미지는 제거하고 공통인
   * 상품정보에서만 관리". 이 두 콜백은 아래 "source" 탭의 ImageInlineEditor
   * 에게만 넘긴다 — PlatformPreview(커머스 탭)에는 더 이상 이미지 섹션 자체가
   * 없다. */
  onAddImage: (file: File) => void;
  onRemoveImage: (id: string) => void;
  addingImage: boolean;
  /** P0-UI Epic 1/4 — Payload JSON/개발 로그 등은 이 값이 true일 때만 보여준다. */
  developerMode: boolean;
  /** Sprint A-6(작업4 — 등록 소요시간 측정) — page.tsx가 URL 제출 시점에 잰
   * epoch ms. 없으면(예: 재시도로 이 화면에 다시 진입한 경우) 총 소요시간은
   * 생략하고 에디터 소요시간만 잰다. */
  analysisStartedAt?: number | null;
  /** "최근 작업" 스냅샷에서 이어서 등록하는 경우 저장된 스냅샷 id — LIVE 등록
   * 시 그대로 executor에 넘겨 registration_attempts.snapshot_id로 남긴다. */
  snapshotId?: string | null;
  /** Sprint B-1(CPO 지시) — snapshotId와 함께 첫 스냅샷 저장 시점에 서버가
   * 채번해서 내려준 사람이 읽을 수 있는 작업번호("JOB-260819-001"). 아직
   * 한 번도 저장 안 됐으면(분석 직후) null. */
  jobKey?: string | null;
  /** N-3.12 Phase 2 P0① — 카테고리 선택은 그동안 이 컴포넌트의 로컬 state로만
   * 살아있었다(새로고침/재오픈 시 초기화되는 실제 버그의 원인). mirror-up
   * 방식으로 page.tsx가 값을 미러링해 스냅샷에 저장하고,
   * 재오픈 시 이 초기값으로 되돌려준다 — product처럼 완전히 controlled로
   * 끌어올리진 않는다(이 컴포넌트 내부에서 매우 자주 갱신되는 값이라 상위로
   * 완전히 옮기면 변경 범위가 커진다). */
  initialCategoryMappings?: Record<PlatformId, CategorySelection>;
  onCategoryMappingsChange?: (mappings: Record<PlatformId, CategorySelection>) => void;
}) {
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

  // N-4.08 STEP6-4(CPO 지시: "상단 커머스 탭에 상태를 표시") — PlatformPreview가
  // (그 탭이 활성화되어 있는 동안) 계산해서 보고해주는 4-state를 플랫폼별로
  // 캐싱한다. payloadPreview/naverValidation 자체는 지금도 활성 탭에서만
  // 계산되므로(회귀 위험이 큰 "두 플랫폼 항상 동시 계산" 구조 변경은 이번
  // STEP 범위에서 하지 않는다), 한 번도 연 적 없는 탭은 배지가 비어있다 — 탭을
  // 한 번 열면 그 이후로는 다른 탭에 가 있어도 마지막 계산값이 남는다.
  const [platformReadiness, setPlatformReadiness] = useState<
    Partial<Record<PlatformId, { state: RegistrationReadinessState; priorityItems: PriorityItem[] }>>
  >({});
  function handleReadinessChange(platformId: PlatformId, state: RegistrationReadinessState, priorityItems: PriorityItem[]) {
    setPlatformReadiness((prev) => {
      const existing = prev[platformId];
      if (existing && existing.state === state && existing.priorityItems.length === priorityItems.length) return prev;
      return { ...prev, [platformId]: { state, priorityItems } };
    });
  }

  /** N-4.07 Sprint(대표님 지시: "가격경쟁력을 상품정보/스마트스토어/쿠팡과 나란히
   * 4번째 차원으로") — DomesticPriceIntelligencePanel(상품정보 탭 안에서만
   * 마운트됨)이 보고하는 값을 캐싱한다. 그 탭을 아직 안 열었으면 UNKNOWN으로
   * 남는다 — platformReadiness와 같은 "sticky visited" 원칙. */
  const [priceLevel, setPriceLevel] = useState<PriceLevel>("UNKNOWN");
  function handlePriceLevelChange(level: PriceLevel) {
    setPriceLevel((prev) => (prev === level ? prev : level));
  }

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
  /** N-3.15 Phase 3(STEP 2-C) — 예전엔 NaverPayloadPreview가 /api/naver/category-search를
   * 직접 호출해서 자기만의 로컬 state(categoryIdInput)로 관리했다. 그 결과 이
   * 화면(PlatformPreview의 공유 "카테고리" Accordion, listing.category 기반
   * readiness 카드)이 보는 카테고리와 실제로 다를 수 있었다 — 사용자가 위에서
   * 고른 카테고리가 화면 하단 "등록 가능성" 카드에서는 "선택되지 않음"으로
   * 보이는 버그의 원인이었다. Coupang이 이미 하는 방식(coupangApiCandidates)과
   * 완전히 같은 패턴으로 통일한다 — 실제 Naver 카테고리 트리(4999건) 대조 결과를
   * categoryCandidates 공유 state로 흘려보내고, onSelectCategory 한 곳으로만
   * 확정한다. */
  const [naverApiCandidates, setNaverApiCandidates] = useState<CategoryCandidate[]>([]);
  /** CEO 지시(2026-08-19: "탭 전환 시 로딩 화면") — 스마트스토어 탭 진입 시
   * /api/naver/category-search가 끝나기 전까지는 카테고리 후보가 빈 배열이라
   * "카테고리가 아예 없다"처럼 보였다. coupangCategoryFetching과 같은 패턴으로
   * 로딩 상태를 노출한다. */
  const [naverCategoryLoading, setNaverCategoryLoading] = useState(false);
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

  /** 페이지/탭 진입 시 자동으로 호출하지 않는다 — 등록 직전(confirmListing)에만
   * 실제 쿠팡 API가 호출된다(E-5: 탭 상단의 "쿠팡 연결" 표시는 제거했지만, 이
   * 재확인 로직 자체는 그대로 유지 — 등록 버튼을 눌렀을 때 만료된 인증으로
   * LIVE를 시도하지 않기 위함이다). 반환값을 그대로 쓸 수 있게 해서,
   * confirmListing이 방금 setState한 "다음 렌더의" coupangConnection이 아니라
   * "지금 이 순간의" 상태를 즉시 판단할 수 있게 한다(React state는 비동기라
   * setState 직후 값을 바로 읽을 수 없다). */
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
      | "recommendedAge"
      | "importer"
      | "itemName"
      | "modelName"
      | "weight"
      | "certificationType",
    value: string,
  ) {
    setProduct((prev) => ({
      ...prev,
      [key]: { value, source: "USER_EDITED" as FieldSource, confidence: 1 },
    }));
  }

  /** N-3.45(CPO 지시: "상품정보제공고시 공통 관리") — 상세페이지 참조 토글.
   * referenced=true면 값은 비우고 source만 DETAIL_PAGE_REFERENCE로 바꾼다(값을
   * 지어내지 않는다 — 실제 문구는 등록 시점에 어댑터가 채운다,
   * packages/listing/src/notice/reference-eligibility.ts). referenced=false로
   * 되돌리면(직접입력으로 전환) REQUIRED로 리셋한다 — 이전에 입력했던 값을
   * 복원하는 되돌리기 기능은 없다(단순한 두 상태 전환, undo 스택을 만들지 않는다). */
  function setFieldReference(
    key: "itemName" | "modelName" | "weight" | "material" | "color" | "manufacturer" | "careInstructions" | "recommendedAge" | "importer",
    referenced: boolean,
  ) {
    setProduct((prev) => ({
      ...prev,
      [key]: referenced
        ? { value: "", source: "DETAIL_PAGE_REFERENCE" as FieldSource, confidence: 1 }
        : { value: "", source: "REQUIRED" as FieldSource, confidence: 0 },
    }));
  }

  /** N-3.29(CPO 지시) — 어린이제품 인증정보는 문자열 하나가 아니라 3개
   * 하위값(번호/업체명/취득일자)이라 updateField의 단순 string 패턴과
   * 다르게 patch 형태로 부분 수정한다. 값을 전혀 만들어내지 않는다 — 사용자가
   * 입력한 값만 그대로 저장한다. */
  function updateChildCertification(patch: Partial<CanonicalProductCertification>) {
    setProduct((prev) => {
      const current = prev.childCertification.value ?? {
        certificationNumber: "",
        companyName: "",
        certificationDate: "",
      };
      return {
        ...prev,
        childCertification: {
          value: { ...current, ...patch },
          source: "USER_EDITED" as FieldSource,
          confidence: 1,
        },
      };
    });
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
    // N-3.18(CPO 지시: "옵션별 가격/재고/SKU의 출처(Provenance)를 확인") — 사용자가
    // OptionVariantEditor에서 직접 고친 필드만 "USER_EDITED"로 태그한다. patch에
    // 없는 필드는 기존 *Source를 그대로 둔다(건드리지 않은 필드의 출처를 잘못 덮어쓰지 않기 위함).
    const sourcePatch: Partial<
      Pick<CanonicalProductVariant, "skuSource" | "priceSource" | "stockQuantitySource">
    > = {};
    if ("sku" in patch) sourcePatch.skuSource = "USER_EDITED" as FieldSource;
    if ("price" in patch) sourcePatch.priceSource = "USER_EDITED" as FieldSource;
    if ("stockQuantity" in patch) sourcePatch.stockQuantitySource = "USER_EDITED" as FieldSource;
    setProduct((prev) => ({
      ...prev,
      variants: prev.variants.map((v) => (v.id === variantId ? { ...v, ...patch, ...sourcePatch } : v)),
    }));
  }

  function updatePrice(amount: number, currency: string) {
    // N-3.54(CPO 지시) — SourceDataView의 "가격" 필드도 PriceEditor의
    // updateOriginalPrice와 같은 규칙으로 priceValidity를 재판정한다(두 곳이
    // 서로 다른 판정 로직을 쓰면 한쪽에서는 등록 가능한데 다른 쪽 화면은
    // 여전히 경고를 보여주는 불일치가 생긴다).
    const resolved = resolveSourcePrice(amount, currency);
    setProduct((prev) => ({
      ...prev,
      price: { value: { amount, currency }, source: "USER_EDITED" as FieldSource, confidence: 1 },
      priceValidity: resolved.validity === "UNRESOLVED" ? "VALID" : resolved.validity,
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
    setProduct((prev) => {
      const nextValue = { ...prev.price.value, ...patch };
      // N-3.54(CPO 지시) — 사용자가 여기서 직접 값을 입력하는 게 PRICE_UNRESOLVED
      // 상태를 벗어나는 유일한 경로다. 값을 저장만 하고 priceValidity를 그대로
      // 두면 등록 게이트가 여전히 막혀 있어 사용자가 고칠 방법이 없어 보인다 —
      // 사용자가 실제로 입력한 값 기준으로 즉시 재판정한다(자동 추측 아님).
      const resolved = resolveSourcePrice(nextValue.amount, nextValue.currency);
      return {
        ...prev,
        price: { value: nextValue, source: "USER_EDITED" as FieldSource, confidence: 1 },
        priceValidity: resolved.validity === "UNRESOLVED" ? "VALID" : resolved.validity,
      };
    });
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

  // N-3.15 Phase 3(STEP 2-C) — Naver 리프 카테고리 4999건과 실제로 대조한
  // 결과(generateNaverCategoryCandidates, packages/listing)를 CategoryCandidate로
  // 변환해서 공유 state로 흘린다. score는 0~100 스케일(scoreCategoryCandidate)이라
  // confidence(0~1)로 나눠 담는다. isVerifiedPlatformCode: true — categoryId가
  // CartPilot 내부 추측이 아니라 Naver가 실제로 갖고 있는 leaf 카테고리 id이기
  // 때문이다(coupangApiCandidates와 동일한 근거).
  useEffect(() => {
    if (tab !== "smartstore") return;
    let cancelled = false;
    setNaverCategoryLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/naver/category-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(product),
        });
        const data = (await res.json()) as { status: string; candidates?: NaverCategoryCandidate[] };
        if (cancelled) return;
        const converted: CategoryCandidate[] = (data.status === "OK" ? (data.candidates ?? []) : []).map((c) => ({
          id: c.categoryId,
          name: c.categoryPath[c.categoryPath.length - 1] ?? c.categoryId,
          path: c.categoryPath,
          platform: "smartstore",
          confidence: c.score / 100,
          reason: [c.reason],
          source: "rule",
          isVerifiedPlatformCode: true,
          hierarchy: c.hierarchy,
        }));
        setNaverApiCandidates(converted);
      } catch {
        if (!cancelled) setNaverApiCandidates([]);
      } finally {
        if (!cancelled) setNaverCategoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, product]);

  const categoryCandidates = useMemo(() => {
    if (tab === "source" || tab === "content") return [];
    const ruleBased = ruleBasedCategoryProvider.recommendCategory(product, tab);
    // CEO 피드백(2026-08-04) — "AI 추정 카테고리"(CartPilot 내부 rule-based
    // 추측)가 실제 쿠팡 코드가 아니고 선택해도 등록에 못 쓰여 혼란만 준다는
    // 지적. 쿠팡 탭은 실제 쿠팡 API가 돌려준 candidates(coupangApiCandidates)만
    // 보여주고, rule-based는 더 이상 섞지 않는다. 스마트스토어 탭도 이제 같은
    // 원칙 — 실제 Naver 카테고리 트리와 대조한 candidates(naverApiCandidates)만
    // 보여준다(N-3.15 Phase 3 — 예전엔 이 rule-based 추측이 화면에 보이고,
    // NaverPayloadPreview는 별도로 실제 API 후보를 썼다 — 두 후보 목록이 서로
    // 달라서 "선택했는데 미선택으로 보이는" 버그의 원인이었다). 11번가 등
    // 아직 검증 API가 없는 플랫폼만 rule-based를 유지한다.
    if (tab === "coupang") return coupangApiCandidates;
    if (tab === "smartstore") return naverApiCandidates;
    return ruleBased;
  }, [tab, product, coupangApiCandidates, naverApiCandidates]);

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

  // N-4.08 STEP6-3/6-4(CPO 지시: "상품정보 = 공통 정보 관리") — "상품정보" 탭
  // 배지용 가벼운 집계. 새 등록 게이트가 아니다 — 실제 등록 차단 여부는 여전히
  // 각 플랫폼의 validate-payload/buildCoupangCompliance가 결정한다. 여기서는
  // 이미 다른 곳에서 검증된 신호(priceValidity — N-3.54, title/images/brand/
  // description 존재 여부)를 재사용해 "커머스 탭에 가기 전에 상품정보 자체가
  // 얼마나 준비됐는지"만 대략 보여준다.
  const commonInfoLevel: ReadinessLevel = useMemo(() => {
    const hasTitle = Boolean(product.title.value.trim());
    const hasImages = product.images.length > 0;
    const priceValid = product.priceValidity === "VALID";
    if (!hasTitle || !hasImages || !priceValid) return "RED";
    const hasBrand = Boolean(product.brand.value.trim());
    const hasDescription = Boolean(product.description.value.trim() || product.descriptionKo.value.trim());
    if (!hasBrand || !hasDescription) return "YELLOW";
    return "GREEN";
  }, [product]);

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
        body: JSON.stringify({ product, listing }),
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
  }, [payloadPreviewEligible, product, listing]);

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
   * N-3.27(CPO 지시: "Readiness ↔ 실제 Payload Validation 단일화") — SmartStore
   * register route(/api/smartstore/register)가 실제 POST 직전 최종 게이트로
   * 쓰는 것과 완전히 같은 buildNaverProductPayload + validateNaverPayload를
   * 여기서도 호출한다. NaverPayloadPreview.tsx가 자기 화면(Payload Preview/
   * Final Validation 섹션)을 위해 이미 하는 것과 같은 조회(/api/naver/resolve)+
   * 계산이다 — 새 검증 규칙을 만들지 않고, 같은 함수를 RegistrationReadinessCard
   * 몫으로 한 번 더 호출할 뿐이다(두 곳 다 순수함수라 같은 입력이면 항상 같은
   * 결과를 낸다 — 계산이 어긋날 위험이 없다). 카테고리가 아직 확정 안 됐어도
   * leafCategoryId=""로 조회해서(카테고리 외 필드 상태라도) 결과를 보여준다.
   */
  const [smartStoreValidation, setSmartStoreValidation] = useState<NaverPayloadValidationResult | null>(null);
  // N-3.73 STEP7(사용자 지시: "Payload Preview가 별도의 임의 BLOCKED 판정을
  // 만들지 못하게 한다") — NaverPayloadPreview.tsx가 지금까지 이 effect와는
  // 완전히 별개로 자기만의 /api/naver/resolve를 또 호출하고 있었다(같은
  // validateNaverPayload 함수를 쓰지만, 입력 데이터 자체가 서로 다른 네트워크
  // 왕복에서 나온다 — Fixie 프록시처럼 외부 요인이 한쪽만 실패하면 두 화면이
  // 진짜로 다른 결과를 보여줄 수 있었다). 게다가 NaverPayloadPreview는
  // leafCategoryId를 isVerifiedPlatformCode만으로 판정해(isVerifiedCategorySelected
  // 미적용) — AI가 추천만 하고 사용자가 아직 확정하지 않은 카테고리도 "확정됨"으로
  // 취급하는, N-3.65가 이미 경고했던 것과 같은 종류의 버그가 있었다. 이제
  // resolve 결과(data)를 여기 하나에만 저장하고 NaverPayloadPreview는 이 값을
  // prop으로 받기만 한다 — fetch 지점이 하나면 입력 데이터가 갈라질 수 없다.
  const [smartStoreResolved, setSmartStoreResolved] = useState<NaverResolveResponse | null>(null);
  // N-3.72(CEO/사용자 지시: "0%는 값이 없어서가 아니라 검증이 아직 안 끝나서인
  // 경우가 있다 — 계산 중과 실패를 구분하라") — 이전에는 이 effect가 값을
  // 계산하기 전까지 smartStoreValidation이 계속 null이었고, readiness.ts의
  // computeNaverPayloadReadiness(null)은 그 null을 "확인 안 됨"으로 취급해
  // 곧바로 0%/BLOCKED처럼 보이는 필수항목 하나로 채웠다 — "아직 계산 중"과
  // "계산했는데 정말 막혔다"가 화면에서 구분이 안 됐다. 이 플래그로 그 둘을
  // 분리한다(readiness.ts의 판정 로직 자체는 바꾸지 않는다 — 카드가 loading일
  // 때는 그 판정 결과를 아예 보여주지 않고 "계산 중"으로 대체한다).
  const [smartStoreValidationLoading, setSmartStoreValidationLoading] = useState(false);
  // N-3.73 STEP1/2(사용자 지시: "0%가 A.아직 안 끝남/B.실패/C.진짜 0% 중
  // 어느 것인지 분리하라, ERROR를 0%로 표현하지 않는다") — N-3.72는 로딩과
  // "계산된 결과"만 구분했다. 그런데 data.status !== "OK"(예: AUTH_FAILED —
  // 지금 실제로 Fixie 프록시 장애 때 재현됨) 또는 catch의 진짜 예외도 결국
  // smartStoreValidation=null로 귀결돼 readiness.ts가 이걸 "카테고리 미확정"
  // 같은 진짜 MISSING 상태와 구분 없이 똑같은 0%/"Payload 검증 결과 확인
  // 중"으로 보여줬다 — 로딩은 끝났는데 사실은 실패였다는 걸 사용자가 알 방법이
  // 없었다. 이 메시지가 있으면(loading=false && error 있음) 카드가 아예 다른
  // ERROR 화면(퍼센트 없이 "확인 실패" + 다시 확인 버튼)을 보여준다.
  const [smartStoreValidationError, setSmartStoreValidationError] = useState<string | null>(null);
  // "다시 확인" 버튼이 이 값을 증가시켜 effect를 재실행시킨다 — product/listing이
  // 안 바뀌어도 사용자가 재시도를 요청할 수 있어야 한다(외부 요인 — 지금의
  // Fixie 프록시 장애 같은 — 은 코드 상태가 아니라 시간이 지나야 풀린다).
  const [smartStoreValidationRetryTick, setSmartStoreValidationRetryTick] = useState(0);
  const retrySmartStoreValidation = () => setSmartStoreValidationRetryTick((t) => t + 1);
  // Coupang payloadPreview effect(위)와 같은 이유로 이 조건일 때 effect 본문
  // 안에서 곧바로 setState하지 않는다(react-hooks/set-state-in-effect 경고,
  // cascading render 방지) — 대신 아래 렌더 시점에 같은 조건으로 null을
  // 넘긴다("언제 숨길지"는 파생 값 계산이지 effect의 일이 아니다).
  const smartStoreValidationEligible = tab === "smartstore" && !!listing;
  useEffect(() => {
    if (!smartStoreValidationEligible || !listing) return;
    setSmartStoreValidationLoading(true);
    setSmartStoreValidationError(null);
    // N-3.65(CPO 경고 재발 — category-field.ts 주석의 "SaaS-UX 개편 때 3곳에서
    // 재발" 다음 사례) — isVerifiedPlatformCode만 보고 state(SELECTED/CONFIRMED)를
    // 빼먹으면 AI가 추천만 하고 사용자가 아직 확인하지 않은 카테고리로도
    // Readiness가 100%를 보여준다("등록 준비 완료"인데 실제로는 카테고리조차
    // 확정 안 된 상태) — isVerifiedCategorySelected()로 통일한다.
    const leafCategoryId =
      isVerifiedCategorySelected(listing.category) &&
      listing.category.candidate?.platform === "smartstore"
        ? listing.category.candidate.id
        : "";
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (leafCategoryId) params.set("categoryId", leafCategoryId);
      if (product.countryOfOrigin.value) params.set("countryOfOrigin", product.countryOfOrigin.value);
      if (product.brand.value) params.set("brand", product.brand.value);
      const query = params.toString() ? `?${params.toString()}` : "";
      fetch(`/api/naver/resolve${query}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((raw: unknown) => {
          // N-3.73 STEP1 — status!=="OK" 응답(NOT_CONFIGURED/AUTH_FAILED)은
          // NaverResolveResponse(OK 전용 shape)와 구조가 다르다(message
          // 필드가 그때만 존재) — 런타임에서 안전하게 좁혀 쓴다.
          const data = raw as NaverResolveResponse & { message?: string };
          if (data.status !== "OK") {
            // N-3.72 — 여기서도 조회 자체는 끝났다(로딩은 아니다) — 그저
            // 결과가 없을 뿐이다. loading을 꺼야 카드가 "계산 중"이 아니라
            // 실제 이유(카테고리 미확정 등, readiness.ts가 null을 그렇게
            // 취급한다)를 보여준다.
            //
            // N-3.73 STEP1(사용자 지시: "ERROR를 0%로 표현하지 않는다") —
            // 다만 AUTH_FAILED(네이버 연결 자체가 실패 — 지금 Fixie 프록시
            // 장애로 실제 재현됨)는 "카테고리를 아직 안 골랐다"와 근본적으로
            // 다르다. 후자는 사용자가 뭔가 더 입력하면 스스로 풀리지만,
            // 전자는 사용자가 아무리 값을 채워도 절대 안 풀린다(외부 인프라
            // 문제라서). 이 둘을 구분해서 AUTH_FAILED일 때만 별도 ERROR
            // 문구를 보여준다 — NOT_CONFIGURED(네이버 계정 자체 미설정)는
            // 기존처럼 "아직 값이 없다"로 두고 별도 경고를 얹지 않는다(이미
            // Settings 게이트가 그 경우를 안내한다).
            setSmartStoreValidation(null);
            setSmartStoreResolved(null);
            setSmartStoreValidationError(
              data.status === "AUTH_FAILED"
                ? `네이버 연결에 실패했습니다: ${data.message}`
                : null,
            );
            setSmartStoreValidationLoading(false);
            return;
          }
          const releaseAddressBookNo = data.address.releaseAddressBookNo;
          const refundAddressBookNo = data.address.refundAddressBookNo;
          const childCertificationInfoId = data.category?.childCertificationInfoId ?? null;
          const categoryRequiresChildCertification = data.category?.requiresChildCertification ?? false;
          const primaryReturnDeliveryCompanyPriorityType = data.delivery.primaryReturnCompany?.priorityType ?? null;
          const sellerDeliveryFee = data.delivery.deliveryFee;
          const returnDeliveryFee = data.delivery.returnDeliveryFee;
          const exchangeDeliveryFee = data.delivery.exchangeDeliveryFee;
          const originAreaCode = data.origin.match.code;
          const originAreaRequiresContent = data.origin.match.status === "OTHER_MANUAL";
          const deliveryCompany = data.courier.value;
          const warrantyPolicy = data.notice.warrantyPolicy;
          const afterServiceDirector = data.notice.afterServiceDirector;
          // N-3.51 STEP2 — afterServiceDirector(고시용 자유 텍스트)와 다른
          // 실제 소스(SellerProfile.companyContactNumber)를 쓴다.
          const afterServiceTelephoneNumber = data.notice.companyContactNumber;
          const payload = buildNaverProductPayload({
            product,
            listing,
            leafCategoryId,
            releaseAddressBookNo,
            refundAddressBookNo,
            primaryReturnDeliveryCompanyPriorityType,
            sellerDeliveryFee,
            returnDeliveryFee,
            exchangeDeliveryFee,
            childCertificationInfoId,
            categoryRequiresChildCertification,
            originAreaCode,
            originAreaRequiresContent,
            deliveryCompany,
            warrantyPolicy,
            afterServiceDirector,
            afterServiceTelephoneNumber,
            detailBlocks: data.detailPage.detailBlocks,
            descriptionTemplate: data.detailPage.descriptionTemplate,
            commonImages: data.detailPage.commonImages,
            brandIntro: data.detailPage.brandIntro,
          });
          const validation = validateNaverPayload(
            payload,
            {
              product,
              releaseAddressBookNo,
              refundAddressBookNo,
              primaryReturnDeliveryCompanyPriorityType,
              returnDeliveryFee,
              exchangeDeliveryFee,
              returnCompaniesFetchFailed: data.delivery.returnCompaniesFetchFailed,
              childCertificationInfoId,
              originAreaCode,
              originAreaRequiresImporter: data.origin.match.requiresImporter,
              deliveryCompany,
              warrantyPolicy,
              afterServiceDirector,
              afterServiceTelephoneNumber,
            },
            categoryRequiresChildCertification,
          );
          setSmartStoreValidation(validation);
          setSmartStoreResolved(data);
          setSmartStoreValidationLoading(false);
        })
        .catch((err: unknown) => {
          // N-3.72(실제 프로덕션 화면에서 확인된 버그) — 이전엔 여기서 어떤
          // 에러든(AbortError든, buildNaverProductPayload/validateNaverPayload가
          // 실제로 던진 예외든) 전부 조용히 무시했다. AbortError(디바운스가
          // 이전 요청을 취소한 것 — 정상 동작)는 그대로 무시해야 하지만,
          // 그 외의 진짜 에러까지 같이 삼키면 smartStoreValidation이 null에
          // 멈춘 채로 "왜 멈췄는지" 콘솔에서조차 알 수 없다 — 화면은 계속
          // "Payload 검증 결과 확인 중"(readiness.ts)에 갇혀 있는데 사실은
          // 다시 계산될 일이 없는 상태였다. 진짜 에러는 콘솔에 남긴다.
          if (err instanceof DOMException && err.name === "AbortError") return;
          console.error("[SmartStore] payload validation 계산 실패:", err);
          setSmartStoreValidationError(
            err instanceof Error ? `등록 가능성 계산 중 오류가 발생했습니다: ${err.message}` : "등록 가능성 계산 중 알 수 없는 오류가 발생했습니다.",
          );
          setSmartStoreValidationLoading(false);
        });
    }, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- smartStoreValidationRetryTick은 "다시 확인" 버튼이 같은 입력으로 재실행을 강제하기 위한 트리거 전용이다.
  }, [smartStoreValidationEligible, listing, product, smartStoreValidationRetryTick]);

  /**
   * DRAFT인데 ERROR급 validation이 하나도 없으면 화면에는 READY로 보여준다 —
   * 카테고리의 RECOMMENDED와 같은 패턴으로, 실제 state는 사용자가 등록 버튼을
   * 눌러야만(USER_CONFIRMED로) 바뀐다.
   *
   * N-3.27 — noReadinessErrors 판단은 legacy validateSmartStoreListing(errorCount)이
   * 아니라 smartStoreValidation.ok를 쓴다(등록 가능성의 단일 기준 — Sprint
   * P1에서 legacy 계산의 유일한 UI 소비처였던 ReadinessScorePanel도 함께
   * 제거해 이제 validateSmartStoreListing은 smartstoreExecutor의 등록 직전
   * 가드로만 쓰인다). 아직
   * 조회 전이면(null) 이전과 같이 permissive(true)로 둔다 — 실제 등록 가능
   * 여부는 어차피 RegistrationReadinessCard의 allRequiredPassed(같은
   * smartStoreValidation 기반)가 별도로 막는다.
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
    const noReadinessErrors =
      tab === "smartstore" ? (smartStoreValidation ? smartStoreValidation.ok : true) : true;
    // isVerifiedPlatformCode까지 확인해야 한다 — state만 보면 이 화면이
    // READY로 잘못 판정해 등록 버튼을 열어주고 register API가 CP001로
    // 거부하는 버그가 재발한다(같은 실수가 StageStepper/PlatformPreview에도
    // 각각 따로 있었다 — packages/marketplace/category-field.ts 참고).
    const categoryConfirmed = isVerifiedCategorySelected(listing.category);
    const requiresCategory = !SOON_PLATFORMS.has(tab);
    return noMarketplaceErrors && noReadinessErrors && (!requiresCategory || categoryConfirmed)
      ? "READY"
      : "DRAFT";
  }, [tab, listing, listingStates, smartStoreValidation]);

  function openListingModal() {
    if (tab === "source" || tab === "content") return;
    // N-3.60 실측에서 발견 — KcSellerStatusBanner의 "판매 가능 상품으로 확인"
    // 버튼은 RegistrationReadinessCard의 canRegister(allRequiredPassed) 게이트를
    // 거치지 않고 이 함수를 직접 호출해서, 필수 항목이 아직 9개 남은 상태에서도
    // "판매 전 최종 확인" 모달이 열렸다(실제 등록은 서버 validateNaverPayload가
    // 막아 사고로 이어지진 않지만, 셀러가 등록 가능하다고 착각하게 만드는 실제
    // 사용성 버그였다). 판정 로직을 버튼마다 복제하지 않고 이 공용 진입점
    // 하나에서만 게이트한다 — effectiveListingStatus가 이미 RegistrationReadinessCard의
    // canRegister와 같은 신호(필수 항목 통과 + 카테고리 확정)를 담고 있다.
    if (effectiveListingStatus === "DRAFT") return;
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

  /** 쿠팡은 연결됨 상태일 때만 LIVE를 시도한다(별도 인증 확인 버튼이 있어
   * 클릭 시점의 "지금 이 순간의" 상태를 확인할 수 있다). 11번가는 여전히
   * capabilities.registrationEnabled가 false라 LIVE 경로 자체가 없다.
   *
   * Sprint P2 버그 수정(2026-08-19, CEO 실측 보고: "치수 옵션으로 등록은
   * 가능하나 스마트스토어 등록이 안됨") — 이 함수가 SmartStore를 무조건
   * DRY_RUN으로 고정하고 있었다. 주석은 "SmartStore는 이번 Mission 범위 밖이라
   * LIVE 경로가 없다"고 적혀 있었지만 이미 오래전에 사실이 아니게 됐다 —
   * smartstoreExecutor.execute()는 LIVE일 때 실제로 /api/smartstore/register를
   * POST하고, N-3.49/N-3.51에서 이미 실제 등록 성공(originProductNo=13664004406)
   * 사례가 있으며, capabilities.ts의 smartstore.registrationEnabled도 true다.
   * SmartStore는 쿠팡처럼 별도 "연결 확인" 버튼이 없어(Client ID/Secret은
   * Settings에 저장돼 있고 서버가 등록 시점에 검증한다) 클라이언트에서 미리
   * 걸러줄 신호가 없다 — 항상 LIVE를 시도하고, 자격증명/KC/가격 등 실제 차단
   * 사유는 서버(validateNaverPayload)가 이미 안전하게 막는다(그 결과는
   * FAILED로 돌아와 기존 실패 UI가 그대로 처리한다). */
  function resolveExecutionMode(
    platform: PlatformId,
    connectionOverride?: PlatformConnectionStatus,
  ): ExecutionMode {
    const connection = connectionOverride ?? coupangConnection;
    if (platform === "coupang") return connection === "CONNECTED" ? "LIVE" : "DRY_RUN";
    if (platform === "smartstore") return "LIVE";
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
      jobKey: jobKey ?? undefined,
      // N-3.86 STEP3(대표님 지시) — register route는 이제 client가 보낸
      // detailBlocks를 아예 읽지 않는다(sellerProfile을 직접 조회해서
      // resolveDetailBlocks()로 계산한다) — 더 이상 여기서 넘길 필요가 없다.
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
          <ReadinessLevelDot level={commonInfoLevel} />
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
          const readiness = platformReadiness[platformId];
          return (
            <TabButton
              key={platformId}
              active={tab === platformId}
              disabled={soon && !previewOnly}
              onClick={() => setTab(platformId)}
            >
              {PLATFORM_ADAPTERS[platformId].label}
              {readiness && <ReadinessLevelDot level={readinessStateToLevel(readiness.state)} />}
              {previewOnly && <PreviewBadge />}
              {soon && !previewOnly && <SoonBadge />}
            </TabButton>
          );
        })}
      </div>

      {/* N-4.07 Sprint(대표님 지시: "상품정보 🟢 · 스마트스토어 🟢 · 쿠팡 🟡 · 가격 🟢
          처럼 한눈에") — 새 판정이 아니라 이미 계산된 값(commonInfoLevel/
          platformReadiness/priceLevel)을 한 줄로 나열만 한다. 방문한 적 있는
          항목만 표시한다(sticky visited — 위 탭 배지와 같은 원칙). */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
        <span className="flex items-center gap-1">
          <ReadinessLevelDot level={commonInfoLevel} /> 상품정보
        </span>
        {PLATFORM_ORDER.filter((platformId) => platformReadiness[platformId]).map((platformId) => (
          <span key={platformId} className="flex items-center gap-1">
            <ReadinessLevelDot level={readinessStateToLevel(platformReadiness[platformId]!.state)} />{" "}
            {PLATFORM_ADAPTERS[platformId].label}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <PriceLevelDot level={priceLevel} /> 가격경쟁력
        </span>
      </div>

      {/* N-4.08 STEP6-4(CPO 지시: "부족한 항목을 한눈에") — 방문한 적 있는 탭
          중 아직 등록 가능(READY)이 아닌 것만 모아 보여준다. 새 계산이 아니라
          PlatformPreview가 이미 만들어둔 priorityItems(RegistrationStatusBanner와
          완전히 같은 데이터)를 재사용한다. N-4.07 Sprint — 가격경쟁력도 같은
          원칙으로 추가한다(단, priceLevel==="UNKNOWN"은 "부족"이 아니라 "아직
          모름"이라 여기 목록에는 올리지 않는다 — 대표님 지시: "가격 데이터가
          없다고 등록이 불가능한 게 아니다"). */}
      {(Object.entries(platformReadiness).some(([, r]) => r.state !== "READY") ||
        priceLevel === "YELLOW" ||
        priceLevel === "RED") && (
        <div className="rounded-lg border border-border bg-surface p-3 text-sm">
          <p className="mb-2 text-xs font-medium text-text-tertiary">등록 준비 상태</p>
          <ul className="space-y-2">
            {commonInfoLevel !== "GREEN" && (
              <li>
                <button
                  type="button"
                  onClick={() => setTab("source")}
                  className="flex items-center gap-1.5 text-left hover:underline"
                >
                  <ReadinessLevelDot level={commonInfoLevel} />
                  <span className="font-medium text-text-primary">상품정보</span>
                  <span className="text-xs text-text-tertiary">— 상품명/이미지/가격을 확인해주세요</span>
                </button>
              </li>
            )}
            {(Object.entries(platformReadiness) as [PlatformId, { state: RegistrationReadinessState; priorityItems: PriorityItem[] }][])
              .filter(([, r]) => r.state !== "READY")
              .map(([platformId, r]) => (
                <li key={platformId}>
                  <button
                    type="button"
                    onClick={() => setTab(platformId)}
                    className="flex flex-wrap items-center gap-1.5 text-left hover:underline"
                  >
                    <ReadinessLevelDot level={readinessStateToLevel(r.state)} />
                    <span className="font-medium text-text-primary">{PLATFORM_ADAPTERS[platformId].label}</span>
                    {r.priorityItems.length > 0 && (
                      <span className="text-xs text-text-tertiary">
                        — {r.priorityItems.map((item) => item.label).join(", ")}
                      </span>
                    )}
                    {/* N-4.12 STEP3 P0-4(대표님 지시: "[스마트스토어에서 확인하기]로
                     * 이동" — 정확한 CTA 문구) — 클릭 대상은 이미 이 버튼 전체(위
                     * onClick)라 새 동작을 추가하지 않는다, 문구만 명시한다. */}
                    <span className="text-xs font-medium text-primary">
                      {PLATFORM_ADAPTERS[platformId].label}에서 확인하기 →
                    </span>
                  </button>
                </li>
              ))}
            {(priceLevel === "YELLOW" || priceLevel === "RED") && (
              <li>
                <button
                  type="button"
                  onClick={() => setTab("source")}
                  className="flex items-center gap-1.5 text-left hover:underline"
                >
                  <PriceLevelDot level={priceLevel} />
                  <span className="font-medium text-text-primary">가격경쟁력</span>
                  <span className="text-xs text-text-tertiary">
                    — {priceLevel === "RED" ? "예상 마진이 낮습니다" : "국내 평균가보다 판매가가 높습니다"}
                    {" "}(⚠️ 등록 자체는 가능합니다)
                  </span>
                </button>
              </li>
            )}
          </ul>
        </div>
      )}

      {tab === "source" && (
        <>
          <section className="rounded-lg border border-border bg-surface p-4 shadow-subtle">
            <p className="mb-3 text-sm font-medium text-text-primary">이미지</p>
            <ImageInlineEditor
              product={product}
              items={items}
              thumbnails={thumbnails}
              representativeId={representativeId}
              onPreview={onPreviewImage}
              onSetRepresentative={onSetRepresentative}
              onToggleGalleryUsage={onToggleGalleryUsage}
              onToggleDescriptionUsage={onToggleDescriptionUsage}
              onMoveImage={onMoveImage}
              onAddImage={onAddImage}
              onRemoveImage={onRemoveImage}
              addingImage={addingImage}
            />
          </section>
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
          <DomesticShopSearch
            title={product.title.value}
            brand={product.brand.value}
            sourceUrl={product.sourceUrl}
            sku={product.sku.value || undefined}
          />
          {snapshotId && (
            <DomesticPriceIntelligencePanel snapshotId={snapshotId} onPriceLevelChange={handlePriceLevelChange} />
          )}
          {snapshotId && <AuditLogPanel snapshotId={snapshotId} />}
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

      {listing && tab !== "source" && tab !== "content" && (
        <PlatformPreview
          product={product}
          listing={listing}
          categoryCandidates={categoryCandidates}
          listingStatus={effectiveListingStatus}
          listingResult={listingResults[tab]}
          naverValidation={smartStoreValidationEligible ? smartStoreValidation : null}
          naverValidationLoading={smartStoreValidationEligible ? smartStoreValidationLoading : false}
          naverValidationError={smartStoreValidationEligible ? smartStoreValidationError : null}
          onRetryNaverValidation={retrySmartStoreValidation}
          naverResolved={smartStoreValidationEligible ? smartStoreResolved : undefined}
          compliancePreview={complianceReportPreview}
          payloadPreview={payloadPreviewEligible ? payloadPreview : null}
          payloadPreviewUnavailableReason={payloadPreviewEligible ? payloadPreviewUnavailableReason : null}
          onReadinessChange={(state, priorityItems) => handleReadinessChange(tab, state, priorityItems)}
          onUpdateField={updateField}
          onUpdateSalePriceKrw={updateSalePriceKrw}
          onUpdateOriginalPrice={updateOriginalPrice}
          onUpdatePriceBreakdown={updatePriceBreakdown}
          exchangeRates={exchangeRates}
          exchangeRatesLoading={exchangeRatesLoading}
          onRefreshExchangeRates={fetchExchangeRates}
          onSelectCategory={(candidate) => selectCategory(tab, candidate)}
          onFixTextField={updateField}
          onSetFieldReference={setFieldReference}
          onUpdateChildCertification={updateChildCertification}
          onFixNumberField={updateNumberField}
          onUpdateOptions={updateOptions}
          onUpdateVariant={updateVariant}
          onOpenListingModal={openListingModal}
          onRetryListing={retryListing}
          onFetchCoupangCategory={tab === "coupang" ? fetchCoupangCategoryRecommendation : undefined}
          coupangCategoryFetching={coupangCategoryFetching}
          naverCategoryLoading={naverCategoryLoading}
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
          jobKey={jobKey}
        />
      )}

      {/* N-3.38 — 플랫폼 탭에는 그 플랫폼 이력만 보인다(예: SmartStore 탭에
          Coupang 등록 이력이 섞여 보이던 문제 수정). source/content 탭은 특정
          플랫폼이 아니라 전체를 보여준다(기존 동작 유지). */}
      <RegistrationHistoryPanel
        history={
          tab !== "source" && tab !== "content"
            ? registrationHistory.filter((entry) => entry.platform === tab)
            : registrationHistory
        }
      />

      {confirmingPlatform && listing && (
        <ListingConfirmationModal
          listing={listing}
          mode={resolveExecutionMode(confirmingPlatform)}
          smartstoreKcStatus={confirmingPlatform === "smartstore" ? (smartStoreValidation?.kcStatus ?? null) : undefined}
          smartstoreCategoryCode={
            confirmingPlatform === "smartstore"
              ? (isVerifiedCategorySelected(listing.category) &&
                  listing.category.candidate?.platform === "smartstore"
                  ? listing.category.candidate.id
                  : null)
              : undefined
          }
          snapshotId={snapshotId ?? null}
          jobKey={jobKey ?? null}
          onCancel={cancelListingModal}
          onConfirm={confirmListing}
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

/** N-4.08 STEP6-4 — 탭 옆에 붙는 🟢🟡🔴 점. RegistrationStatusBanner(탭 안,
 * 자세한 4-state)와 다른 판정을 새로 만들지 않는다 — readinessStateToLevel()이
 * 그 4-state를 3단계로 이름만 바꾼 값을 그대로 받아 그린다. */
function ReadinessLevelDot({ level }: { level: ReadinessLevel }) {
  const color = level === "GREEN" ? "bg-success" : level === "YELLOW" ? "bg-warning" : "bg-error";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} aria-label={level} />;
}

/** N-4.07 Sprint(대표님 지시: "가격 데이터가 없다고 🔴로 처리하면 안 된다 —
 * ⚪ 판단불가를 별도로 둔다") — ReadinessLevelDot과 같은 모양이지만 UNKNOWN(회색)
 * 한 단계가 더 있다. 등록 3-state(GREEN/YELLOW/RED)에는 이 값이 없다 — 가격
 * 데이터 부재가 등록 차단과 무관하기 때문에 억지로 그 타입에 끼워넣지 않는다. */
function PriceLevelDot({ level }: { level: PriceLevel }) {
  const color =
    level === "GREEN" ? "bg-success" : level === "YELLOW" ? "bg-warning" : level === "RED" ? "bg-error" : "bg-border";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} aria-label={level} />;
}
