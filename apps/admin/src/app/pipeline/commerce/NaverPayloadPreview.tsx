"use client";

import { useEffect, useMemo, useState } from "react";
import { buildNaverProductPayload, validateNaverPayload } from "@commerce/listing";
import type { ListingModel } from "@commerce/marketplace";
import type { NaverCategoryCandidate } from "@commerce/listing";
import type { CanonicalProduct, CommerceCategoryPathResult } from "@commerce/shared";
import { formatKrw } from "@commerce/pricing";
import { PriceIntelligencePanel } from "./PriceIntelligencePanel";
import { PriceEditor } from "./PriceEditor";

/**
 * Sprint N-2.7/N-2.8 — 네이버 v2 상품등록 payload를 실제 POST 없이 미리 보여준다.
 * N-2.6에서 만든 buildNaverProductPayload/validateNaverPayload를 그대로 쓴다
 * (payload를 다시 만들지 않는다 — 화면에 보이는 값과 Raw Payload가 어긋나면
 * CP001과 같은 신뢰 문제가 재발한다).
 *
 * N-2.9 — 카테고리 자동 매칭. /api/naver/category-search가 상품유형(영문→한글
 * 번역 후 Naver 리프 카테고리 4999건과 대조)/연령/성별 신호로 후보를 점수화해서
 * 반환한다. HIGH 후보가 있으면 입력란에 자동으로 채우되(사용자가 이미 직접
 * 입력했으면 덮어쓰지 않는다), 근거 문장은 항상 후보 목록에 그대로 보여준다
 * (CPO 지시: "HIGH라도 사용자가 확인할 수 있게 근거를 보여주는 방향을
 * 우선"). MEDIUM/LOW는 자동 채움 없이 후보만 보여주고 클릭해야 선택된다.
 * 선택된 categoryId는 기존 /api/naver/resolve(N-2.8)로 그대로 이어져 고시/
 * 인증/배송 상태를 갱신한다 — 두 리졸버를 하나로 합치지 않는다(관심사 분리).
 */

interface NaverReturnDeliveryCompany {
  id: number;
  name: string;
  priorityType: string;
}

interface NaverOriginAreaMatch {
  status: "MATCHED" | "OTHER_MANUAL" | "NO_INPUT";
  code: string | null;
  matchedDisplayName: string | null;
  requiresImporter: boolean;
}

interface NaverResolveResponse {
  status: string;
  category: {
    categoryId: string;
    exceptionalCategories: string[];
    requiresChildCertification: boolean;
    childCertificationInfoId: number | null;
    hierarchy: CommerceCategoryPathResult | null;
  } | null;
  address: { releaseAddressBookNo: number | null; refundAddressBookNo: number | null };
  // N-3.6(개정 Part A) — value는 Settings(SellerProfile.naverDeliveryCompanyCode)에
  // 판매자가 직접 입력한 값. 공식 조회 API는 여전히 없다(reason은 available=false일 때만).
  courier: { available: boolean; value: string | null; source: "SELLER_PROFILE" | null; reason?: string };
  // N-3.3 — 반품 택배사/반품·교환 배송비. 출고 택배사(courier 위)는 별개로
  // 여전히 조회 API가 없어 BLOCKED 고정이다.
  delivery: {
    returnCompanies: NaverReturnDeliveryCompany[];
    returnCompaniesFetchFailed: boolean;
    primaryReturnCompany: NaverReturnDeliveryCompany | null;
    returnDeliveryFee: number | null;
    exchangeDeliveryFee: number | null;
  };
  // N-3.4 — GET /v1/product-origin-areas(535개 실제 코드) 매칭 결과.
  origin: {
    areaListFetchFailed: boolean;
    resolvedCountryText: string | null;
    match: NaverOriginAreaMatch;
  };
}

/** N-3.1 — leaf 이름 하나가 아니라 전체 경로(root→leaf)를 보여준다. hierarchy를
 * 아직 못 구했으면(로딩 중이거나 API가 조상 id를 못 준 경우) leaf 이름만이라도
 * 보여주되 "상위 경로 조회 중/불가"를 명확히 표시한다 — 추측으로 채우지 않는다. */
function CategoryHierarchyLine({
  hierarchy,
  fallbackPath,
}: {
  hierarchy: CommerceCategoryPathResult | null | undefined;
  fallbackPath?: string[];
}) {
  if (hierarchy?.resolved) {
    return (
      <span className="text-text-primary">
        {hierarchy.nodes.map((n, i) => (
          <span key={n.id}>
            {i > 0 && <span className="text-text-tertiary"> {">"} </span>}
            <span className={i === hierarchy.nodes.length - 1 ? "font-medium" : "text-text-secondary"}>{n.name}</span>
          </span>
        ))}
      </span>
    );
  }
  if (fallbackPath && fallbackPath.length > 0) {
    return (
      <span className="text-text-primary">
        {fallbackPath.join(" > ")}
        <span className="ml-1 text-[10px] text-text-tertiary">(상위 경로 id 조회 불가)</span>
      </span>
    );
  }
  return <span className="text-text-tertiary">상위 경로 조회 중...</span>;
}

const FIELD_SECTION: Record<string, string> = {
  "originProduct.leafCategoryId": "naver-section-category",
  "originProduct.name": "naver-section-basic",
  "originProduct.images.representativeImage": "naver-section-images",
  "originProduct.salePrice": "naver-section-pricing",
  "originProduct.stockQuantity": "naver-section-pricing",
  "claimDeliveryInfo.shippingAddressId": "naver-section-shipping",
  "claimDeliveryInfo.returnAddressId": "naver-section-shipping",
  "deliveryInfo.deliveryCompany": "naver-section-shipping",
  "claimDeliveryInfo.returnDeliveryCompanyPriorityType": "naver-section-shipping",
  "claimDeliveryInfo.returnDeliveryFee": "naver-section-shipping",
  "claimDeliveryInfo.exchangeDeliveryFee": "naver-section-shipping",
  productCertificationInfos: "naver-section-certification",
  "productCertificationInfos[].certificationNumber": "naver-section-certification",
  "detailAttribute.optionInfo": "naver-section-options",
  "detailAttribute.optionInfo.optionCombinations[].optionName": "naver-section-options",
  "detailAttribute.originAreaInfo.originAreaCode": "naver-section-origin",
  "detailAttribute.originAreaInfo.importer": "naver-section-origin",
};

function payloadReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "string" && value.startsWith("data:") && value.length > 80) {
    return `${value.slice(0, 40)}…(${value.length}자)`;
  }
  return value;
}

export function NaverPayloadPreview({
  product,
  listing,
  onUpdateSalePriceKrw,
  onUpdateOriginalPrice,
  onUpdatePriceBreakdown,
  exchangeRates,
  exchangeRatesLoading,
  onRefreshExchangeRates,
}: {
  product: CanonicalProduct;
  listing: ListingModel;
  /** N-3.9(Part G — CPO 지시: "Naver/Coupang 동일 구조") — Coupang의
   * PlatformPreview가 이미 갖고 있는 가격 계산 핸들러를 그대로 받아서
   * PriceEditor를 재사용한다. 새 Naver 전용 가격 계산기를 만들지 않는다. */
  onUpdateSalePriceKrw: (amountKrw: number) => void;
  onUpdateOriginalPrice?: (patch: Partial<{ amount: number; currency: string }>) => void;
  onUpdatePriceBreakdown: (breakdown: { shippingKrw: number; feePercent: number; marginPercent: number }) => void;
  exchangeRates: { rates: Record<string, number>; fetchedAt: string; source: "frankfurter" | "fallback" } | null;
  exchangeRatesLoading: boolean;
  onRefreshExchangeRates: () => void;
}) {
  const [showJson, setShowJson] = useState(false);
  const [categoryIdInput, setCategoryIdInput] = useState("");
  const [resolved, setResolved] = useState<NaverResolveResponse | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<NaverCategoryCandidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesFetched, setCandidatesFetched] = useState(false);
  const [autoFilledFromCandidate, setAutoFilledFromCandidate] = useState(false);

  // N-2.9 — 상품이 바뀌면 후보를 한 번 새로 가져온다(카테고리 ID 입력값과는
  // 무관 — 후보 생성은 product 신호만 쓰지 입력값을 안 본다). settings/page.tsx와
  // 같은 이유로 async IIFE로 감싼다 — setState를 effect 본문에 직접 두면
  // react-hooks/set-state-in-effect에 걸린다.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setCandidatesLoading(true);
      setCandidatesFetched(false);
      try {
        const res = await fetch("/api/naver/category-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(product),
        });
        const data = (await res.json()) as { status: string; candidates?: NaverCategoryCandidate[] };
        if (cancelled) return;
        setCandidates(data.status === "OK" ? (data.candidates ?? []) : []);
      } catch {
        if (!cancelled) setCandidates([]);
      } finally {
        if (!cancelled) {
          setCandidatesLoading(false);
          setCandidatesFetched(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product]);

  // HIGH 후보가 있고 사용자가 아직 아무것도 입력/선택하지 않았으면 자동으로
  // 채운다 — 그래도 근거는 후보 목록에 항상 그대로 보여준다(자동 채움 =
  // 근거를 숨기는 게 아니다, CPO 지시).
  useEffect(() => {
    void (async () => {
      if (autoFilledFromCandidate || categoryIdInput.trim()) return;
      const topHigh = candidates.find((c) => c.confidence === "HIGH");
      if (topHigh) {
        setCategoryIdInput(topHigh.categoryId);
        setAutoFilledFromCandidate(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates]);

  function selectCandidate(categoryId: string) {
    setCategoryIdInput(categoryId);
    setAutoFilledFromCandidate(true);
  }

  // N-2.8 — 카테고리 ID는 수동 입력 또는 위 후보 자동/수동 선택, 나머지는 실시간 조회.
  // 500ms 디바운스로 입력 중 매 키 입력마다 호출하지 않는다.
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setResolving(true);
      setResolveError(null);
      const params = new URLSearchParams();
      if (categoryIdInput.trim()) params.set("categoryId", categoryIdInput.trim());
      // N-3.4 — 상품추출 원산지 텍스트/브랜드명을 넘겨서 서버가 A-12-3과 동일한
      // 우선순위(상품추출 > 브랜드기본값 > Seller기본값)로 원산지 코드를 매칭한다.
      if (product.countryOfOrigin.value) params.set("countryOfOrigin", product.countryOfOrigin.value);
      if (product.brand.value) params.set("brand", product.brand.value);
      const query = params.toString() ? `?${params.toString()}` : "";
      fetch(`/api/naver/resolve${query}`)
        .then((res) => res.json())
        .then((data: NaverResolveResponse) => {
          if (cancelled) return;
          if (data.status !== "OK") {
            setResolveError(
              data.status === "NOT_CONFIGURED"
                ? "네이버 인증 정보가 설정되어 있지 않습니다."
                : "네이버 API 조회에 실패했습니다.",
            );
            setResolved(null);
            return;
          }
          setResolved(data);
        })
        .catch(() => {
          if (!cancelled) setResolveError("리졸버 호출 중 오류가 발생했습니다.");
        })
        .finally(() => {
          if (!cancelled) setResolving(false);
        });
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [categoryIdInput, product.countryOfOrigin.value, product.brand.value]);

  const leafCategoryId = categoryIdInput.trim();
  const releaseAddressBookNo = resolved?.address.releaseAddressBookNo ?? null;
  const refundAddressBookNo = resolved?.address.refundAddressBookNo ?? null;
  const childCertificationInfoId = resolved?.category?.childCertificationInfoId ?? null;
  const categoryRequiresChildCertification = resolved?.category?.requiresChildCertification ?? false;
  // N-3.3 — resolve API의 delivery 섹션을 그대로 쓴다(Preview에서 재계산하지 않는다).
  // resolved가 아직 없으면(초기 로딩) fetchFailed를 true로 간주해 BLOCKED로
  // 보이게 한다 — "값이 없다"와 "확인 실패"를 구분하되, 조회 전에는 낙관적으로
  // MISSING 취급하지 않는다.
  const returnCompaniesFetchFailed = resolved?.delivery?.returnCompaniesFetchFailed ?? true;
  const primaryReturnDeliveryCompanyPriorityType = resolved?.delivery?.primaryReturnCompany?.priorityType ?? null;
  const returnDeliveryFee = resolved?.delivery?.returnDeliveryFee ?? null;
  const exchangeDeliveryFee = resolved?.delivery?.exchangeDeliveryFee ?? null;
  // N-3.4 — resolve API의 origin 섹션을 그대로 쓴다(Preview에서 재매칭하지 않는다).
  const originMatch = resolved?.origin?.match ?? { status: "NO_INPUT" as const, code: null, matchedDisplayName: null, requiresImporter: false };
  const originAreaCode = originMatch.code;
  const originAreaRequiresContent = originMatch.status === "OTHER_MANUAL";
  const originAreaRequiresImporter = originMatch.requiresImporter;
  // N-3.6(개정 Part A) — Settings에 판매자가 직접 입력한 값(공식 조회 API는
  // 없음, resolve route가 SellerProfile.naverDeliveryCompanyCode를 그대로 전달).
  const deliveryCompany = resolved?.courier?.value ?? null;

  const payload = useMemo(
    () =>
      buildNaverProductPayload({
        product,
        listing,
        leafCategoryId,
        releaseAddressBookNo,
        refundAddressBookNo,
        primaryReturnDeliveryCompanyPriorityType,
        returnDeliveryFee,
        exchangeDeliveryFee,
        childCertificationInfoId,
        categoryRequiresChildCertification,
        originAreaCode,
        originAreaRequiresContent,
        deliveryCompany,
      }),
    [
      product,
      listing,
      leafCategoryId,
      releaseAddressBookNo,
      refundAddressBookNo,
      primaryReturnDeliveryCompanyPriorityType,
      returnDeliveryFee,
      exchangeDeliveryFee,
      childCertificationInfoId,
      categoryRequiresChildCertification,
      originAreaCode,
      originAreaRequiresContent,
      deliveryCompany,
    ],
  );

  const validation = useMemo(
    () =>
      validateNaverPayload(
        payload,
        {
          product,
          releaseAddressBookNo,
          refundAddressBookNo,
          primaryReturnDeliveryCompanyPriorityType,
          returnDeliveryFee,
          exchangeDeliveryFee,
          returnCompaniesFetchFailed,
          childCertificationInfoId,
          originAreaCode,
          originAreaRequiresImporter,
          deliveryCompany,
        },
        categoryRequiresChildCertification,
      ),
    [
      payload,
      product,
      releaseAddressBookNo,
      refundAddressBookNo,
      primaryReturnDeliveryCompanyPriorityType,
      returnDeliveryFee,
      exchangeDeliveryFee,
      returnCompaniesFetchFailed,
      childCertificationInfoId,
      categoryRequiresChildCertification,
      deliveryCompany,
      originAreaCode,
      originAreaRequiresImporter,
    ],
  );

  const hasOptions = product.optionGroups.length > 0;
  // N-3.5 — READY/MISSING/BLOCKED 개수는 validateNaverPayload()가 직접 계산해서
  // 돌려준다(Final Validator). Preview는 이 값을 그대로 쓰고 별도로 다시
  // 계산하지 않는다 — 이전의 countTotalCheckedFields() 근사 함수는 제거했다.
  const { readyCount, missingCount, blockedCount } = validation;
  const blockedIssues = validation.issues.filter((i) => i.severity === "BLOCKED");
  const missingIssues = validation.issues.filter((i) => i.severity === "MISSING");

  const overallState = blockedCount > 0 || missingCount > 0 ? "등록 불가" : "등록 가능";
  const overallIcon = blockedCount > 0 ? "🔴" : missingCount > 0 ? "🟡" : "🟢";

  const notice = payload.originProduct.detailAttribute?.productInfoProvidedNotice;
  const representative = payload.originProduct.images.representativeImage.url;
  const optionalImages = payload.originProduct.images.optionalImages ?? [];

  function goToSection(field: string) {
    const sectionId = FIELD_SECTION[field];
    if (!sectionId) return;
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4 shadow-subtle">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">네이버 상품등록 미리보기</h3>
        <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">
          Preview 전용 — 실제 등록 API는 호출하지 않습니다
        </span>
      </div>

      {/* Naver Payload Validation — N-3.5 Final Validator 결과를 그대로 표시한다. */}
      <div className="rounded-md bg-background p-3">
        <h4 className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
          Naver Payload Validation
        </h4>
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs">
          <span className="text-success">🟢 READY {readyCount}</span>
          <span className="text-warning">🟡 MISSING {missingCount}</span>
          <span className="text-error">🔴 BLOCKED {blockedCount}</span>
        </div>
        <p className="mt-1.5 text-sm font-medium text-text-primary">
          등록 가능 여부: {overallIcon} {overallState}
        </p>
        {blockedIssues.length > 0 && (
          <div className="mt-2">
            <p className="text-[11px] font-semibold text-error">BLOCKED</p>
            <ul className="mt-1 space-y-1">
              {blockedIssues.map((issue, i) => (
                <li key={`blocked-${issue.field}-${i}`} className="flex items-start gap-1.5 text-[11px]">
                  <span className="text-error">🔴</span>
                  <button
                    type="button"
                    onClick={() => goToSection(issue.field)}
                    className="min-w-0 flex-1 text-left text-text-secondary hover:text-text-primary hover:underline"
                  >
                    <span className="font-medium text-text-primary">{issue.field}</span> — {issue.reason}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {missingIssues.length > 0 && (
          <div className="mt-2">
            <p className="text-[11px] font-semibold text-warning">MISSING</p>
            <ul className="mt-1 space-y-1">
              {missingIssues.map((issue, i) => (
                <li key={`missing-${issue.field}-${i}`} className="flex items-start gap-1.5 text-[11px]">
                  <span className="text-warning">🟡</span>
                  <button
                    type="button"
                    onClick={() => goToSection(issue.field)}
                    className="min-w-0 flex-1 text-left text-text-secondary hover:text-text-primary hover:underline"
                  >
                    <span className="font-medium text-text-primary">{issue.field}</span> — {issue.reason}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <Section id="naver-section-basic" title="기본 상품정보">
        <Row label="상품명" value={payload.originProduct.name || "MISSING"} />
        <Row label="재고" value={`${payload.originProduct.stockQuantity}개`} />
        <Row label="판매상태" value={payload.originProduct.statusType} />
      </Section>

      {/* N-3.9(Part G) — Coupang과 완전히 같은 PriceEditor 컴포넌트/계산 모델을
          쓴다. 등록 payload가 읽는 salePrice(listing.priceKrw)는 이 컴포넌트가
          onUpdateSalePriceKrw로 갱신하는 product.priceOverrideKrw를 그대로
          따라간다 — 별도로 다시 표시하지 않는다(CP001류 이중 판정 방지). */}
      <Section id="naver-section-price" title="판매가격">
        <PriceEditor
          product={product}
          onUpdateSalePriceKrw={onUpdateSalePriceKrw}
          onUpdateOriginalPrice={onUpdateOriginalPrice}
          onUpdatePriceBreakdown={onUpdatePriceBreakdown}
          exchangeRates={exchangeRates}
          exchangeRatesLoading={exchangeRatesLoading}
          onRefreshExchangeRates={onRefreshExchangeRates}
        />
      </Section>

      <Section id="naver-section-price-intelligence" title="해외 가격 정보 (참고 — 위 판매가격과 별개)">
        <PriceIntelligencePanel product={product} />
      </Section>

      <Section id="naver-section-category" title="카테고리">
        {candidatesLoading && <p className="text-[11px] text-text-tertiary">추천 카테고리 조회 중...</p>}
        {!candidatesLoading && candidatesFetched && candidates.length === 0 && (
          <p className="text-[11px] text-text-tertiary">
            자동 매칭 후보 없음 — 상품유형을 특정하지 못했거나 대조 기준이 아직 없는 유형입니다. 아래에 직접
            입력하세요.
          </p>
        )}
        {candidates.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-text-secondary">추천 카테고리</p>
            <ul className="space-y-1">
              {candidates.map((c) => {
                const badgeClass =
                  c.confidence === "HIGH"
                    ? "bg-success-soft text-success"
                    : c.confidence === "MEDIUM"
                      ? "bg-warning-soft text-warning"
                      : "bg-error-soft text-error";
                const isSelected = categoryIdInput.trim() === c.categoryId;
                return (
                  <li key={c.categoryId}>
                    <button
                      type="button"
                      onClick={() => selectCandidate(c.categoryId)}
                      className={`w-full rounded border px-2 py-1.5 text-left text-xs transition-colors ${
                        isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-background"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs">
                          <CategoryHierarchyLine hierarchy={c.hierarchy} fallbackPath={c.categoryPath} />
                        </span>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${badgeClass}`}>
                          {c.confidence} {c.score}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-text-tertiary">{c.reason}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div>
          <label className="text-xs text-text-secondary" htmlFor="naver-category-id-input">
            네이버 카테고리 ID(위 추천에서 선택하거나 직접 입력)
          </label>
          <input
            id="naver-category-id-input"
            type="text"
            value={categoryIdInput}
            onChange={(e) => {
              setCategoryIdInput(e.target.value);
              setAutoFilledFromCandidate(true);
            }}
            placeholder="예: 50000535"
            className="mt-0.5 w-full rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        {resolving && <p className="text-[11px] text-text-tertiary">네이버 카테고리 조회 중...</p>}
        {resolveError && <p className="text-[11px] text-error">{resolveError}</p>}
        {leafCategoryId ? (
          <div className="flex items-start gap-2 text-xs">
            <dt className="w-20 shrink-0 text-text-secondary">선택된 카테고리</dt>
            <dd>
              <CategoryHierarchyLine hierarchy={resolved?.category?.hierarchy} />
            </dd>
          </div>
        ) : (
          <Row label="네이버 카테고리" value="미확정 — 위 추천에서 선택하거나 직접 입력하세요" />
        )}
        {resolved?.category && (
          <Row
            label="어린이제품 인증"
            value={resolved.category.requiresChildCertification ? "필요(CHILD_CERTIFICATION)" : "불필요"}
          />
        )}
      </Section>

      <Section id="naver-section-images" title="이미지">
        <div className="flex flex-wrap gap-2">
          {representative && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={representative} alt="대표" className="h-14 w-14 rounded border-2 border-primary object-cover" />
          )}
          {optionalImages.map((img, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={img.url} alt="" className="h-14 w-14 rounded border border-border object-cover" />
          ))}
          {!representative && <p className="text-xs text-text-tertiary">MISSING — 대표 이미지 없음</p>}
        </div>
      </Section>

      <Section id="naver-section-options" title="옵션">
        {hasOptions ? (
          <>
            {product.variants.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-text-tertiary">
                      {Object.keys(product.variants[0].optionValues).map((k) => (
                        <th key={k} className="pb-1 pr-3 font-medium">
                          {k}
                        </th>
                      ))}
                      <th className="pb-1 pr-3 font-medium">가격</th>
                      <th className="pb-1 font-medium">재고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.variants.map((v) => (
                      <tr key={v.id} className="border-t border-border">
                        {Object.values(v.optionValues).map((val, i) => (
                          <td key={i} className="py-1 pr-3 text-text-primary">
                            {val}
                          </td>
                        ))}
                        <td className="py-1 pr-3 text-text-primary">
                          {v.price ? formatKrw(v.price.amount) : "—"}
                        </td>
                        <td className="py-1 text-text-primary">{v.stockQuantity ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-text-tertiary">옵션 그룹은 있으나 조합(variant) 정보가 없습니다.</p>
            )}
            <p className="rounded bg-error-soft px-2 py-1 text-[11px] text-error">
              🔴 BLOCKED — optionCombinations 필드명/구조는 확인됐지만(공식 OpenAPI) price 필드가 절대가인지
              추가금액인지는 실제 등록 성공 검증 전까지 확인되지 않았습니다.
            </p>
            {validation.issues.some(
              (i) => i.field === "detailAttribute.optionInfo.optionCombinations[].optionName",
            ) && (
              <p className="rounded bg-warning-soft px-2 py-1 text-[11px] text-warning">
                🟡 MISSING — 일부 옵션 조합에 값이 비어 있는 옵션 그룹이 있습니다. 원본 상품의 옵션 값을
                확인하세요.
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-text-tertiary">옵션 없음</p>
        )}
      </Section>

      <Section id="naver-section-origin" title="원산지">
        <Row
          label="원산지"
          value={
            resolved?.origin?.resolvedCountryText ??
            "MISSING — 상품 원본/브랜드 설정/판매자 기본값 중 어느 것도 없음"
          }
        />
        <Row
          label="원산지 코드"
          value={
            originMatch.status === "NO_INPUT"
              ? "MISSING — 원산지 텍스트 없음"
              : originMatch.status === "OTHER_MANUAL"
                ? `✓ 04(직접입력) — 원문 텍스트 그대로 표기`
                : `✓ ${originMatch.code} (${originMatch.matchedDisplayName})`
          }
        />
        <Row
          label="수입사명"
          value={
            originMatch.requiresImporter
              ? "MISSING — CartPilot에 소스 없음(수입산 필수 항목)"
              : "해당없음(수입산 아님)"
          }
        />
        <p className="text-[11px] text-text-tertiary">
          원산지 코드는 GET /v1/product-origin-areas(535개 실제 코드, N-3.4 실측 확인)에서 매칭합니다. 목록에
          없는 표현은 코드를 지어내지 않고 04(직접입력)로 대체합니다. 브랜드 국가를 원산지로 자동 추정하지
          않습니다.
        </p>
      </Section>

      <Section id="naver-section-notice" title="상품정보제공고시">
        {notice ? (
          <>
            <Row label="상품군" value={notice.productInfoProvidedNoticeType} />
            <Row label="재질" value={notice.material || "MISSING"} />
            <Row label="색상" value={notice.color || "MISSING"} />
            <Row label="제조자" value={notice.manufacturer || "MISSING"} />
            <Row label="주의사항" value={notice.caution || "MISSING"} />
            {notice.productInfoProvidedNoticeType === "KIDS" && (
              <Row label="권장연령" value={notice.recommendedAge || "MISSING"} />
            )}
          </>
        ) : (
          <p className="text-xs text-text-tertiary">고시정보 없음</p>
        )}
      </Section>

      <Section id="naver-section-certification" title="인증정보">
        {categoryRequiresChildCertification ? (
          <>
            <p className="text-xs font-medium text-warning">⚠ 어린이제품 인증 필요</p>
            <Row label="인증종류" value="CHILD_CERTIFICATION" />
            <Row label="인증번호" value="MISSING" />
            <Row label="인증기관" value="MISSING" />
            <Row label="인증일자" value="MISSING" />
          </>
        ) : resolved?.category ? (
          <p className="text-xs text-text-tertiary">이 카테고리는 어린이제품 인증(CHILD_CERTIFICATION) 대상이 아닙니다.</p>
        ) : (
          <p className="text-xs text-text-tertiary">
            카테고리 미입력 — 위 카테고리 섹션에서 실제 Naver 카테고리 ID를 입력하면 인증요건을 실시간으로 조회합니다.
          </p>
        )}
      </Section>

      <Section id="naver-section-shipping" title="배송 / 반품">
        <Row
          label="출고지"
          value={
            releaseAddressBookNo !== null
              ? `✓ 판매자 등록 출고지 사용 (addressBookNo: ${releaseAddressBookNo})`
              : "MISSING — 판매자 주소록(Wing)에 출고지 등록 필요"
          }
        />
        <Row
          label="반품/교환지"
          value={
            refundAddressBookNo !== null
              ? `✓ 판매자 등록 반품지 사용 (addressBookNo: ${refundAddressBookNo})`
              : "MISSING — 판매자 주소록(Wing)에 반품지 등록 필요"
          }
        />
        <Row
          label="출고 택배사"
          value={
            resolved?.courier?.value
              ? `✓ ${resolved.courier.value}(Settings 수동 입력, 공식 조회 API는 없음)`
              : `MISSING — ${resolved?.courier?.reason ?? "Settings의 배송 프로필에서 네이버 택배사를 입력하면 해결됩니다(공식 조회 API 없음)."}`
          }
        />
        <Row
          label="반품 택배사"
          value={
            returnCompaniesFetchFailed
              ? "BLOCKED — 반품 택배사 목록 조회에 실패했습니다(네이버 API 오류)."
              : resolved?.delivery?.primaryReturnCompany
                ? `✓ ${resolved.delivery.primaryReturnCompany.name} (${resolved.delivery.primaryReturnCompany.priorityType})`
                : "MISSING — Wing에서 반품 택배사 등록 필요"
          }
        />
        <Row
          label="배송비"
          value={`${payload.originProduct.deliveryInfo?.deliveryFee?.deliveryFeeType === "FREE" ? "무료배송" : "미확정"} (기본값 — 실제 배송비 정책 미연동)`}
        />
        <Row
          label="반품배송비"
          value={returnDeliveryFee !== null ? formatKrw(returnDeliveryFee) : "MISSING — Settings에서 배송 정책 입력 필요"}
        />
        <Row
          label="교환배송비"
          value={exchangeDeliveryFee !== null ? formatKrw(exchangeDeliveryFee) : "MISSING — Settings에서 배송 정책 입력 필요"}
        />
        <p className="text-[11px] text-text-tertiary">
          출고지/반품지는 판매자 주소록(GET /v1/seller/addressbooks-for-page)에서, 반품 택배사는 GET
          /v2/product-delivery-info/return-delivery-companies에서 실시간 조회됩니다. addressBookNo →
          shippingAddressId/returnAddressId 매핑은 공식 OpenAPI 스펙(필드명 &ldquo;출고지 주소록 번호&rdquo;/
          &ldquo;반품/교환지 주소록 번호&rdquo;)으로 확인됐습니다(N-3.3). 출고 택배사(deliveryInfo.deliveryCompany)
          조회 API만 스펙에 없어 여전히 BLOCKED입니다.
        </p>
      </Section>

      <button
        type="button"
        onClick={() => setShowJson((v) => !v)}
        className="text-xs font-medium text-text-secondary underline decoration-border hover:text-text-primary"
      >
        {showJson ? "Naver v2 Request Payload 닫기" : "▶ Naver v2 Request Payload"}
      </button>
      {showJson && (
        <pre className="max-h-96 overflow-auto rounded-md bg-background p-2 text-[11px] text-text-secondary">
          {JSON.stringify(payload, payloadReplacer, 2)}
        </pre>
      )}
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-4 rounded-md border border-border p-3">
      <h4 className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">{title}</h4>
      <dl className="mt-2 space-y-1">{children}</dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const isProblem = value === "MISSING" || value.startsWith("BLOCKED") || value === "미확정";
  return (
    <div className="flex items-start gap-2 text-xs">
      <dt className="w-20 shrink-0 text-text-secondary">{label}</dt>
      <dd className={isProblem ? "text-warning" : "text-text-primary"}>{value}</dd>
    </div>
  );
}
