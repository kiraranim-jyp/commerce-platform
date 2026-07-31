"use client";

import { useEffect, useMemo, useState } from "react";
import type { CanonicalProduct, FieldSource, PlatformId } from "@commerce/shared";
import {
  detectKidsSignal,
  ruleBasedCategoryProvider,
  UNRESOLVED_CATEGORY,
  type CategoryCandidate,
  type CategorySelection,
} from "@commerce/category";
import { mockProductContentProvider } from "@commerce/content";
import {
  buildCoupangCompliance,
  LISTING_EXECUTORS,
  validateSmartStoreListing,
  type ComplianceFieldSource,
  type CoupangCategoryMeta,
  type ExecutionMode,
  type ListingResult,
  type ListingStatus,
  type PlatformConnectionStatus,
  type RegistrationHistoryEntry,
} from "@commerce/listing";
import { PLATFORM_ADAPTERS, PLATFORM_ORDER, isVerifiedCategorySelected } from "@commerce/marketplace";
import { AIContentPanel } from "./commerce/AIContentPanel";
import { BacklogPanel } from "./commerce/BacklogPanel";
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
}) {
  // P0-UI Epic 1 — "이미지" 영역을 대표이미지+장수 요약 카드로 줄이고, 기존
  // ImageRoleGrid(대표/상품/상세 역할 지정 그리드)는 이 카드를 눌렀을 때만 여는
  // 모달로 옮긴다. 데이터/핸들러는 전부 이 컴포넌트가 이미 갖고 있던 그대로 재사용한다.
  const [galleryOpen, setGalleryOpen] = useState(false);
  const setProduct = onUpdateProduct;
  const [tab, setTab] = useState<CommerceTab>("source");
  const [categoryMappings, setCategoryMappings] = useState(INITIAL_CATEGORY_MAPPINGS);
  const [listingStates, setListingStates] = useState(INITIAL_LISTING_STATES);
  const [listingResults, setListingResults] = useState(INITIAL_LISTING_RESULTS);
  const [confirmingPlatform, setConfirmingPlatform] = useState<PlatformId | null>(null);
  const [registrationHistory, setRegistrationHistory] = useState<RegistrationHistoryEntry[]>([]);
  const [coupangConnection, setCoupangConnection] = useState<PlatformConnectionStatus>("UNKNOWN");
  const [coupangConnectionCheckedAt, setCoupangConnectionCheckedAt] = useState<string | null>(null);
  const [coupangConnectionChecking, setCoupangConnectionChecking] = useState(false);
  const [coupangApiCandidate, setCoupangApiCandidate] = useState<CategoryCandidate | null>(null);
  const [coupangCategoryFetching, setCoupangCategoryFetching] = useState(false);
  const [coupangSettingsMissing, setCoupangSettingsMissing] = useState<string[] | null>(null);
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
      .then((data: { missing?: string[] }) => {
        if (!cancelled) setCoupangSettingsMissing(data.missing ?? []);
      })
      .catch(() => {
        if (!cancelled) setCoupangSettingsMissing(null);
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
    // 쿠팡 API가 준 실제 코드 후보를 맨 앞에 보여준다 — CartPilot 내부 AI 추천과
    // 섞이긴 하지만 isVerifiedPlatformCode로 화면에서 구분 배지를 보여준다.
    if (tab === "coupang" && coupangApiCandidate) return [coupangApiCandidate, ...ruleBased];
    return ruleBased;
  }, [tab, product, coupangApiCandidate]);

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

  /** 쿠팡 카테고리 추천(자동매칭) API를 호출해서 실제 쿠팡 숫자 코드를 후보로
   * 보여준다 — CartPilot 내부 AI 추천(categoryCandidates)과는 완전히 다른 코드
   * 체계이므로 별도 state로 관리하고, isVerifiedPlatformCode: true로 표시해서
   * 사용자가 "이건 실제 쿠팡 코드"라는 걸 구분할 수 있게 한다. */
  async function fetchCoupangCategoryRecommendation(searchQuery?: string) {
    if (!listing) return;
    setCoupangCategoryFetching(true);
    // P0(Category Resolver 품질) — 쿠팡 predict API는 상품명 텍스트만 보고
    // 추측한다. 원본 제목에 나이/성별 신호가 없으면(예: "Bobo organic cotton
    // T-shirt | Pale Pink") 기본값(여성)으로 잘못 추측하는 게 실측으로
    // 확인됐다 — CartPilot이 이미 갖고 있는 신호(권장연령/브랜드/설명의
    // kids 키워드)로 먼저 판단해서, predict API에 보내는 질의문 자체를
    // "아동 상품"으로 보정한다. 사용자가 직접 검색어를 입력했으면(searchQuery)
    // 그건 이미 사람이 확정한 의도라 보정하지 않는다.
    const kidsSignal = detectKidsSignal(product);
    const baseQuery = searchQuery?.trim() || listing.title;
    const biasedQuery = !searchQuery?.trim() && kidsSignal.isKids ? `Kids ${baseQuery}` : baseQuery;
    setCategoryTraceLog((prev) => [
      ...prev,
      kidsSignal.isKids
        ? `추천 신호: 아동 상품으로 판단(${kidsSignal.reasons.join(", ")}) → 쿠팡 API 질의="${biasedQuery}"`
        : `추천 신호: 아동 상품 신호 없음 → 쿠팡 API 질의="${biasedQuery}"`,
    ]);
    try {
      const res = await fetch("/api/coupang/category-recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName: biasedQuery, brand: listing.brand }),
      });
      const data = (await res.json()) as {
        categoryCode?: number | null;
        categoryName?: string | null;
        unverified?: boolean;
      };
      if (data.categoryCode != null && data.categoryName) {
        setCoupangApiCandidate({
          id: String(data.categoryCode),
          name: data.categoryName,
          path: [data.categoryName],
          platform: "coupang",
          confidence: 1,
          reason: ["쿠팡 API가 상품명 기반으로 예측한 실제 카테고리 코드 — 등록 전 최종 확인이 필요합니다."],
          source: "ai",
          isVerifiedPlatformCode: true,
        });
        setCategoryTraceLog((prev) => [...prev, `검증 결과: "${data.categoryName}" (코드 ${data.categoryCode})`]);
      }
    } catch {
      // 조용히 실패 — 이 후보는 참고용 추가 옵션일 뿐, 실패해도 기존 AI 추천
      // 흐름(내부 카테고리 선택)은 그대로 쓸 수 있다.
    } finally {
      setCoupangCategoryFetching(false);
    }
  }

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
    const result = await LISTING_EXECUTORS[platform].execute(product, listing, mode);
    setListingResults((prev) => ({ ...prev, [platform]: result }));
    setRegistrationHistory((prev) => [
      {
        productName: listing.title,
        platform,
        executedAt: new Date().toISOString(),
        mode,
        result,
        listingKey,
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
    <section className="mt-8 space-y-4">
      <StageStepper product={product} categoryMappings={categoryMappings} onNavigate={setTab} />

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
          return (
            <TabButton
              key={platformId}
              active={tab === platformId}
              disabled={soon}
              onClick={() => setTab(platformId)}
            >
              {PLATFORM_ADAPTERS[platformId].label}
              {soon && <SoonBadge />}
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
          onUpdateField={updateField}
          onUpdateSalePriceKrw={updateSalePriceKrw}
          onUpdatePriceBreakdown={updatePriceBreakdown}
          exchangeRates={exchangeRates}
          exchangeRatesLoading={exchangeRatesLoading}
          onRefreshExchangeRates={fetchExchangeRates}
          onSelectCategory={(candidate) => selectCategory(tab, candidate)}
          onFixTextField={updateField}
          onFixNumberField={updateNumberField}
          onOpenListingModal={openListingModal}
          onRetryListing={retryListing}
          onFetchCoupangCategory={tab === "coupang" ? fetchCoupangCategoryRecommendation : undefined}
          coupangCategoryFetching={coupangCategoryFetching}
          categoryTraceLog={categoryTraceLog}
          categoryMeta={tab === "coupang" ? categoryMeta : null}
          categoryMetaLoading={tab === "coupang" && categoryMetaLoading}
          categoryMetaError={tab === "coupang" ? categoryMetaError : null}
          categoryFieldOverrides={product.categoryFieldOverrides}
          onUpdateCategoryFieldOverride={updateCategoryFieldOverride}
          resolvedCategoryFields={resolvedCategoryFields}
          productOptionGroups={product.optionGroups}
          settingsMissing={tab === "coupang" ? (coupangSettingsMissing ?? undefined) : undefined}
          developerMode={developerMode}
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
