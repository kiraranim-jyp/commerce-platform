"use client";

import { useEffect, useRef, useState } from "react";
import { countryToFlagEmoji } from "@commerce/shared";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { deriveComparisonResultState, getComparisonResultHeadline, type ComparisonResultState } from "@/lib/comparison-result-status";
import { computeFxLine, computeKrwAmount, isOnSale, isPriceDisplayable } from "@/lib/price-truth";
import {
  computePriceDifference,
  deriveSellerDecisionState,
  pickBestAcceptableCandidate,
  SELLER_DECISION_LABEL,
} from "@/lib/seller-decision";

type MatchLevel = "very_high" | "high" | "medium" | "low";

/** P-11 STEP 4(대표님/CPO 지시, 2026-08-30) — "동일상품 90%"류 오판정(Ezra가 Bruno와
 * 다른 상품인데 confidence 90%만으로 동일상품 취급됨) 수정. matchLevel/confidence는
 * 그대로 텍스트 유사도만 말하고, 이 값이 있으면(product-identity.ts가 판정) 실제
 * "같은 상품인가"는 이 값이 결정한다 — 없으면(구버전 응답 등) 기존 matchLevel 로직으로
 * 폴백한다(하위호환). */
type ProductMatchTruth =
  | "EXACT_PRODUCT"
  | "CONFIRMED_PRODUCT"
  | "SAME_MODEL_VARIANT"
  | "VERY_SIMILAR"
  | "SIMILAR"
  | "CONFLICT"
  | "INSUFFICIENT_EVIDENCE";

const PRODUCT_MATCH_TRUTH_DISPLAY: Record<ProductMatchTruth, { icon: string; text: string; badgeClass: string }> = {
  EXACT_PRODUCT: { icon: "🟢", text: "동일상품 확인", badgeClass: "bg-success-soft text-success" },
  CONFIRMED_PRODUCT: { icon: "🟢", text: "동일상품 확인", badgeClass: "bg-success-soft text-success" },
  SAME_MODEL_VARIANT: { icon: "🔵", text: "동일 모델 · 옵션 다름", badgeClass: "bg-primary/10 text-primary" },
  VERY_SIMILAR: { icon: "🟡", text: "매우 유사한 상품", badgeClass: "bg-warning-soft text-warning" },
  SIMILAR: { icon: "⚪", text: "유사상품", badgeClass: "bg-background text-text-tertiary" },
  CONFLICT: { icon: "🔴", text: "다른 상품", badgeClass: "bg-error/10 text-error" },
  INSUFFICIENT_EVIDENCE: { icon: "⚪", text: "매칭 불확실", badgeClass: "bg-background text-text-tertiary" },
};

/** P-11 CPO 2차 검증 지시(2026-08-30, 조건 2) — "EXACT_PRODUCT/CONFIRMED_PRODUCT만
 * 실제 동일상품으로 집계", "SAME_MODEL_VARIANT는 직접 가격 반영이 아니라 참고
 * 후보로 처리". 이전 버전은 SAME_MODEL_VARIANT까지 "동일상품 개수"에 포함시켜서
 * 가격 반영 정책(STEP 3에서 확정한 표: EXACT/CONFIRMED만 직접반영, SAME_MODEL_
 * VARIANT는 참고가격)과 어긋났다 — 여기서 EXACT_PRODUCT/CONFIRMED_PRODUCT만으로
 * 좁힌다. SAME_MODEL_VARIANT는 이제 isSimilarOnly=true(참고용 취급/가격 캡션)로
 * 넘어간다 — 배지 자체(🔵 "동일 모델 · 옵션 다름")는 그대로 별도 표시된다. */
function isConfirmedSameProduct(truth: ProductMatchTruth): boolean {
  return truth === "EXACT_PRODUCT" || truth === "CONFIRMED_PRODUCT";
}

const MATCH_LEVEL_LABEL: Record<MatchLevel, string> = {
  very_high: "동일상품 가능성 매우 높음",
  high: "동일상품 가능성 높음",
  medium: "유사상품 · 확인 필요",
  low: "매칭 불확실",
};

/** N-3.10/N-3.11 Part C — "상품명만 같다고 동일상품 태그 금지" 원칙에 따라, high
 * 이상만 "동일상품"으로 부르고 medium은 "유사상품", low는 "매칭 불확실"로만
 * 표시한다(색상도 다르게 구분 — 초록=동일상품, 노랑=유사상품, 회색=매칭불확실).
 * 확정할 수 없으면 확정 표현을 쓰지 않는다는 CPO 지시를 그대로 반영한 것 —
 * "관련상품"처럼 관계를 확정하는 단어 대신 "불확실"이라고만 말한다. matchLevel
 * 자체는 packages/crawler의 match.ts(브랜드/모델명/SKU/URL slug 신호 기반 규칙
 * 스코어러, AI 아님)가 이미 계산해서 내려준다 — 이 컴포넌트는 등급을 배지로
 * 옮기기만 한다. */
const MATCH_LEVEL_BADGE_CLASS: Record<MatchLevel, string> = {
  very_high: "bg-success-soft text-success",
  high: "bg-success-soft text-success",
  medium: "bg-warning-soft text-warning",
  low: "bg-background text-text-tertiary",
};

const MATCH_LEVEL_ICON: Record<MatchLevel, string> = {
  very_high: "🟢",
  high: "🟢",
  medium: "🟡",
  low: "⚪",
};

type PriceStatus = "VERIFIED_CURRENT" | "UNVERIFIED_SEARCH" | "PRICE_UNAVAILABLE";

/** P-4-DATA-4(CPO 지시, 2026-08-29, 원칙 1/2) — 매칭 신뢰도(matchLevel)와 가격
 * 신뢰도(priceStatus)는 완전히 분리된 축이다. "동일상품 100%"라도 가격이
 * VERIFIED_CURRENT가 아니면 숫자를 절대 보여주지 않는다 — 실측 확인된 사고
 * 3건(Booty Ghosts £59→£35, Misha & Puff Mink £270→£159, Hug Hairy Monster
 * £62→£37, 셋 다 이 원칙이 없어서 생겼다)의 재발을 코드 레벨에서 막는다. */
const PRICE_STATUS_LABEL: Record<PriceStatus, string> = {
  VERIFIED_CURRENT: "현재 가격 확인됨",
  UNVERIFIED_SEARCH: "가격 확인 필요 — 상품 페이지에서 직접 확인",
  PRICE_UNAVAILABLE: "현재 가격을 확인하지 못했습니다",
};

interface Candidate {
  title: string;
  url: string;
  price: { amount: number; currency: string } | null;
  regularPrice?: { amount: number; currency: string } | null;
  imageUrl: string | null;
  confidence: number;
  matchLevel?: MatchLevel;
  /** N-3.11 Part C — 왜 이 등급인지(브랜드/모델명/SKU/URL slug 신호) 사람이 읽는 근거.
   * match.ts가 이미 계산해서 내려준다 — 여기서는 title에만 노출한다(확정 표현 남발 방지). */
  matchReasons?: string[];
  priceSource?: "detail" | "search" | null;
  priceStatus?: PriceStatus;
  verificationAttempted?: boolean;
  /** P-11 STEP 4 — 없으면(undefined) 구버전 응답이라는 뜻, 기존 matchLevel 배지로 폴백. */
  productMatchTruth?: ProductMatchTruth;
}

interface SearchResult {
  shopId: string;
  shopName: string;
  domain: string;
  /** N-3.10 Part L — comparison_shops.country를 API가 join해서 내려준다. */
  shopCountry?: string | null;
  status: "ok" | "unsupported" | "error";
  candidates: Candidate[];
  error?: string;
  errorKind?: "RATE_LIMITED" | "TEMPORARY_ERROR";
}

interface SourceVerification {
  status: "VERIFIED_CURRENT" | "PRICE_UNAVAILABLE" | "NOT_APPLICABLE";
  price: { amount: number; currency: string } | null;
  regularPrice: { amount: number; currency: string } | null;
}

/** Sprint B-1 Phase 1 — 해외 편집샵 가격비교. 기존 등록 흐름과 완전히 분리된 추가 조회 기능이라
 * 필수/선택 입력 Accordion(sectionProps/sectionCompletionBadge) 체계에는 엮지 않는다.
 *
 * N-3.10 Part M(CPO 지시, 절대 금지) — "가격비교 결과 중 가장 싼 가격을 자동으로
 * 원본가격으로 바꾸면 안 됩니다." 이 컴포넌트는 조회 결과를 읽기 전용으로만
 * 보여준다 — PriceEditor의 어떤 state도 여기서 쓰거나 갱신하지 않는다(props로
 * product를 받지도 않는다). */
export function ComparisonShopSearch({
  title,
  brand,
  sourceUrl,
  sku,
  description,
  onRequestPriceReview,
}: {
  title: string;
  brand?: string;
  sourceUrl?: string;
  sku?: string;
  /** P-11 STEP 4 — product-identity.ts가 sku가 비어있을 때 "Article code: XXX"
   * 텍스트를 직접 뽑아내는 폴백 소스로 쓴다(STEP 1 실측: product.sku.value가
   * 비어있어도 설명문에는 Article code가 그대로 있는 경우가 흔함). */
  description?: string;
  /** P-5(CPO 지시, 2026-08-29) — 판단 카드의 "가격 재검토" 버튼이 누를 때 쓴다.
   * CommerceWorkspace.tsx가 DomesticPriceIntelligencePanel에 이미 쓰고 있는
   * handleRequestPriceReview를 그대로 전달받는다(탭 전환 + 스크롤만 하는 안전한
   * 함수 — 여기서 새 네비게이션 로직을 만들지 않는다). */
  onRequestPriceReview?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [sourceVerification, setSourceVerification] = useState<SourceVerification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [krwRates, setKrwRates] = useState<Record<string, number> | null>(null);
  // P-4-DATA-6 P0-3(CPO 지시, 2026-08-29) — "환율로 계산했다"고만 말하지 않고 어떤
  // 환율을 썼는지 그대로 보여준다("기준 환율 1 GBP = ₩1,852 · frankfurter"). rate는
  // 이 페이지가 표시할 후보들과 같은 순간에 딱 한 번 조회한 krwRates에서 그대로
  // 가져온다 — 후보마다 다른 환율을 쓰지 않는다(P0-3: 단일 FX 엔진 원칙).
  const [fxSource, setFxSource] = useState<"frankfurter" | "fallback" | null>(null);
  const [queriedAt, setQueriedAt] = useState<string | null>(null);
  // N-3.13 P0 — CPO 지시: "해외가격비교가 하나도 없음이면 기능 구현 완료로 인정하지
  // 않는다." 원인은 버그가 아니라 UX였다 — 이 섹션은 기본 접힘(defaultOpen=false)이고
  // 검색도 버튼을 눌러야만 실행됐다(useState(null)만 있고 자동 실행 트리거가 없었음).
  // CEO가 상세 화면을 열어도 "빈 화면"처럼 보였던 이유. title이 준비되면 마운트 시
  // 한 번 자동 검색한다(수동 재검색 버튼은 그대로 남겨 재조회 가능하게 한다).
  const autoSearchedRef = useRef(false);

  async function runSearch() {
    setLoading(true);
    setError(null);
    try {
      const [searchRes, ratesRes] = await Promise.all([
        fetch("/api/comparison/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, brand, sourceUrl, sku, description }),
        }),
        // N-3.10 Part L — 원본가격 옆에 KRW 환산도 같이 보여준다. PriceEditor가
        // 이미 쓰는 것과 같은 /api/exchange-rates를 그대로 재사용한다(별도
        // 환율 로직을 새로 만들지 않는다).
        fetch("/api/exchange-rates").catch(() => null),
      ]);
      const data = (await searchRes.json()) as {
        ok: boolean;
        results?: SearchResult[];
        sourceVerification?: SourceVerification;
        error?: string;
      };
      if (!data.ok) {
        setError(data.error ?? "검색에 실패했습니다.");
        return;
      }
      setResults(data.results ?? []);
      setSourceVerification(data.sourceVerification ?? null);
      setQueriedAt(new Date().toLocaleString("ko-KR"));
      if (ratesRes?.ok) {
        const ratesData = (await ratesRes.json()) as {
          rates?: Record<string, number>;
          source?: "frankfurter" | "fallback";
        };
        if (ratesData.rates) setKrwRates(ratesData.rates);
        setFxSource(ratesData.source ?? null);
      }
    } catch {
      setError("검색 요청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (autoSearchedRef.current || !title) return;
    autoSearchedRef.current = true;
    void runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  return (
    <CollapsibleSection title="해외 가격비교 (베타)" defaultOpen>
      <p className="text-xs text-text-tertiary">
        활성화된 해외 편집샵에서 유사 상품을 검색합니다 — 참고용 조회이며, 어떤 가격도 자동으로 원본가격/판매가에
        반영되지 않습니다.
      </p>
      <button
        type="button"
        onClick={() => void runSearch()}
        disabled={loading || !title}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        {loading ? "검색 중..." : "가격비교 검색"}
      </button>
      {error && <p className="text-xs text-error">{error}</p>}
      {queriedAt && <p className="text-[10px] text-text-tertiary">조회 시점: {queriedAt}</p>}
      {sourceVerification && (
        <SourceVerificationCard verification={sourceVerification} krwRates={krwRates} fxSource={fxSource} />
      )}
      {results && (
        <SellerDecisionCard
          sourceVerification={sourceVerification}
          results={results}
          krwRates={krwRates}
          onRequestPriceReview={onRequestPriceReview}
        />
      )}
      {results && <ResultHeadline results={results} />}
      {results && <ResultTable results={results} krwRates={krwRates} fxSource={fxSource} />}
    </CollapsibleSection>
  );
}

/** P-4-DATA-4 STEP 4(CPO 지시, 2026-08-29) — 원본 sourceUrl 자체를 직접 재조회한
 * 결과. 다른 판매처 검색보다 신뢰도가 높은 1차 경로(P-4-DATA-3 실측: 적용 가능한
 * 60%에서 100% 성공)라 화면 맨 위에 별도로 보여준다 — 비교 검색 결과 표와 섞지
 * 않는다(원본 재확인과 "타 판매처 발견"은 목적이 다르다). */
function SourceVerificationCard({
  verification,
  krwRates,
  fxSource,
}: {
  verification: SourceVerification;
  krwRates: Record<string, number> | null;
  fxSource: "frankfurter" | "fallback" | null;
}) {
  if (verification.status === "NOT_APPLICABLE") return null;
  if (verification.status === "PRICE_UNAVAILABLE") {
    return (
      <p className="rounded-md border border-border bg-background px-3 py-2 text-xs text-text-secondary">
        원본 상품 페이지에서 현재 가격을 확인하지 못했습니다.
      </p>
    );
  }
  const { price, regularPrice } = verification;
  const krwAmount = price ? computeKrwAmount(price.amount, price.currency, krwRates) : null;
  const fxLine = price ? computeFxLine(price.currency, krwRates, fxSource) : null;
  const onSale = isOnSale(price, regularPrice);
  return (
    <div className="space-y-1 rounded-md border border-success/30 bg-success-soft px-3 py-2 text-xs">
      <div className="font-medium text-success">✓ 원본 상품 현재 판매가 확인됨</div>
      <div className="flex flex-wrap items-baseline gap-x-2 text-text-primary">
        <span className="font-semibold">
          {price?.amount.toFixed(2)} {price?.currency}
        </span>
        {krwAmount != null && <span className="text-text-secondary">약 ₩{krwAmount.toLocaleString("ko-KR")}</span>}
        {onSale && (
          <>
            <span className="text-text-tertiary line-through">
              {regularPrice!.amount.toFixed(2)} {regularPrice!.currency}
            </span>
            <span className="rounded bg-warning-soft px-1.5 py-0.5 text-[10px] font-medium text-warning">
              현재 할인 판매 중
            </span>
          </>
        )}
      </div>
      {fxLine && <p className="text-[10px] text-text-tertiary">{fxLine}</p>}
      {onSale && (
        <p className="text-[10px] text-text-tertiary">
          ⚠ 세일 가격은 일시적일 수 있습니다 — 가격 책정 기준으로 사용할 경우 정가도 함께 확인하세요.
        </p>
      )}
    </div>
  );
}

const RESULT_TONE_CLASS: Record<"success" | "warning" | "neutral", string> = {
  success: "border-success/30 bg-success-soft text-success",
  warning: "border-warning/30 bg-warning-soft text-warning",
  neutral: "border-border bg-background text-text-secondary",
};

const SELLER_DECISION_CARD_CLASS: Record<"READY_TO_LIST" | "REVIEW_PRICE" | "NEEDS_RECHECK" | "HOLD", string> = {
  READY_TO_LIST: "border-success/30 bg-success-soft",
  REVIEW_PRICE: "border-warning/30 bg-warning-soft",
  NEEDS_RECHECK: "border-warning/30 bg-warning-soft",
  HOLD: "border-error/30 bg-error/5",
};

/** P-5(CPO 지시, 2026-08-29 STEP6) — "카드 = 판단, 표 = 근거" 구조. 이 카드는
 * 아래 ResultTable(표)이 이미 보여주는 원자료를 다시 나열하지 않는다 — 그 자료를
 * 종합해서 "그래서 지금 무엇을 해야 하는가" 하나만 요약한다.
 *
 * STEP7 하드 경계(CPO 지시, 절대 금지) — 이 카드는 어떤 가격도, 등록 상태도
 * 자동으로 바꾸지 않는다. "가격 재검토" 버튼은 CommerceWorkspace.tsx의 기존
 * handleRequestPriceReview(탭 전환 + 스크롤만 함, 가격 미변경)를 그대로 호출할
 * 뿐이다. "등록 진행" 액션 버튼은 의도적으로 넣지 않았다 — 이 화면에는 이미
 * 등록을 트리거하는 별도 버튼(ListingConfirmationModal 경로)이 있고, 여기서
 * 중복 등록 트리거를 새로 만들면 이중 클릭/이중 등록 위험만 늘어난다(P-5 완료
 * 보고서에서 이 설계 판단을 명시적으로 알린다). */
function SellerDecisionCard({
  sourceVerification,
  results,
  krwRates,
  onRequestPriceReview,
}: {
  sourceVerification: SourceVerification | null;
  results: SearchResult[];
  krwRates: Record<string, number> | null;
  onRequestPriceReview?: () => void;
}) {
  const searchState: ComparisonResultState = deriveComparisonResultState(results);
  const acceptableCandidates = results.flatMap((r) => r.candidates.filter((c) => c.matchLevel && c.matchLevel !== "low"));
  // P-11 STEP 4(대표님/CPO 지시, 2026-08-30) — "비교 가능한 동일상품" 카운트가
  // matchLevel(텍스트 유사도)만으로 세면 Ezra(confidence 90%, 실제로는 다른 상품)
  // 같은 오판정이 그대로 카운트에 남는다. productMatchTruth가 있으면 그 값으로
  // "진짜 동일상품"만 센다 — 없으면(구버전 응답) 기존 matchLevel 기준 유지.
  const sameProductCount = acceptableCandidates.filter((c) =>
    c.productMatchTruth ? isConfirmedSameProduct(c.productMatchTruth) : c.matchLevel === "very_high" || c.matchLevel === "high",
  ).length;
  const sourceVerificationStatus = sourceVerification?.status ?? "NOT_APPLICABLE";

  const decision = deriveSellerDecisionState({
    sourceVerificationStatus,
    searchState,
    candidates: acceptableCandidates.map((c) => ({ matchLevel: c.matchLevel, priceStatus: c.priceStatus })),
  });

  const bestCandidate = pickBestAcceptableCandidate(acceptableCandidates);
  const priceDiff = computePriceDifference(
    sourceVerification
      ? { status: sourceVerification.status === "VERIFIED_CURRENT" ? "VERIFIED_CURRENT" : "PRICE_UNAVAILABLE", price: sourceVerification.price }
      : null,
    bestCandidate ? { status: bestCandidate.priceStatus, price: bestCandidate.price } : null,
    krwRates,
  );

  const { icon, title: stateTitle } = SELLER_DECISION_LABEL[decision.state];

  return (
    <div className={`space-y-1.5 rounded-md border px-3 py-2.5 text-xs ${SELLER_DECISION_CARD_CLASS[decision.state]}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-semibold text-text-primary">
          <span>{icon}</span>
          <span>{stateTitle}</span>
        </div>
        {onRequestPriceReview && decision.state !== "READY_TO_LIST" && (
          <button
            type="button"
            onClick={onRequestPriceReview}
            className="rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-text-primary hover:bg-background"
          >
            가격 재검토
          </button>
        )}
      </div>
      <p className="text-text-secondary">{decision.reason}</p>
      {/* P-8 STEP 1-3(대표님 지시, 2026-08-30) — 이 카드가 "최종 등록 판단"으로
          오해되지 않도록, 이 데이터의 역할이 근거(해외 가격/매칭 검증)라는 것을
          명시한다. 최종 판단은 Market Intelligence의 대표 판단 카드 하나뿐이다. */}
      <p className="text-[10px] text-text-tertiary">
        해외 원본 상품과의 가격/매칭 검증 결과입니다 — 최종 등록 판단은 아래 국내 시장 분석을 따릅니다.
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-text-secondary">
        <span>
          원본 확인가:{" "}
          {sourceVerification?.status === "VERIFIED_CURRENT" && sourceVerification.price
            ? `${sourceVerification.price.amount.toFixed(2)} ${sourceVerification.price.currency}`
            : "확인 안 됨"}
        </span>
        <span>비교 가능한 동일상품: {sameProductCount}건</span>
      </div>
      <p className="text-text-tertiary">
        {priceDiff.status === "COMPUTED"
          ? `가격 차이: 약 ₩${Math.abs(priceDiff.diffKrw!).toLocaleString("ko-KR")}(${priceDiff.diffPercent! >= 0 ? "+" : ""}${priceDiff.diffPercent!.toFixed(1)}%)`
          : `가격 차이 계산 불가 — ${priceDiff.reason}`}
      </p>
    </div>
  );
}

/** Sprint P2(CPO 지시, 2026-08-19) — "몇 개 사이트를 뒤졌는지"가 아니라 "비교할
 * 만한 상품을 찾았는지"만 먼저 보여준다. N-4.21(대표님 지시) — matchLevel이
 * "low"가 아닌 것(70% 경계)만 기본 노출.
 *
 * P-4-DATA-8(CPO 지시, 2026-08-29) — 상태 판단(deriveComparisonResultState)과
 * 문구(getComparisonResultHeadline)를 이 컴포넌트 밖으로 뽑았다. F4(429가
 * "찾지 못함"과 구분 없이 보였던 사고) 재발 방지가 목적 — RATE_LIMITED/ERROR/
 * PARTIAL_FAILURE/NO_RESULTS를 코드 레벨에서 구분해서 강제한다(comparison-
 * result-status.ts의 6개 불변조건 테스트 참고). 이 컴포넌트는 이제 상태를
 * 판단하지 않고 렌더링만 한다. */
function ResultHeadline({ results }: { results: SearchResult[] }) {
  const acceptableCount = results.reduce(
    (sum, r) => sum + r.candidates.filter((c) => c.matchLevel && c.matchLevel !== "low").length,
    0,
  );
  const state = deriveComparisonResultState(results);
  const { tone, message } = getComparisonResultHeadline(state, acceptableCount);
  return <p className={`rounded-md border px-3 py-2 text-xs ${RESULT_TONE_CLASS[tone]}`}>{message}</p>;
}

/** N-3.13 P0(CPO 지시) — "판매처/국가/상품/원본가격/통화/KRW/매칭상태" 컬럼의
 * 표로 재구성. P-4-DATA-4(CPO 지시, 2026-08-29 STEP 7) — "매칭 불확실/미지원/오류
 * N건 더보기" 같은 개발자용 raw count 문구를 셀러 화면에서 제거한다. 데이터
 * 자체는 지우지 않는다(진단 목적으로는 여전히 필요) — 문구만 셀러 언어로 바꾼다. */
function ResultTable({
  results,
  krwRates,
  fxSource,
}: {
  results: SearchResult[];
  krwRates: Record<string, number> | null;
  fxSource: "frankfurter" | "fallback" | null;
}) {
  const [showAll, setShowAll] = useState(false);
  type Row = {
    shopId: string;
    shopName: string;
    shopCountry?: string | null;
    candidate: Candidate | null;
    note?: string;
  };
  const allRows: Row[] = [];
  for (const r of results) {
    if (r.status === "unsupported") {
      allRows.push({
        shopId: r.shopId,
        shopName: r.shopName,
        shopCountry: r.shopCountry,
        candidate: null,
        note: "지원되지 않는 사이트",
      });
    } else if (r.status === "error") {
      const note =
        r.errorKind === "RATE_LIMITED"
          ? "요청이 많아 확인하지 못함 — 잠시 후 다시 시도"
          : "일시적인 오류로 확인하지 못함";
      allRows.push({ shopId: r.shopId, shopName: r.shopName, shopCountry: r.shopCountry, candidate: null, note });
    } else if (r.candidates.length === 0) {
      allRows.push({
        shopId: r.shopId,
        shopName: r.shopName,
        shopCountry: r.shopCountry,
        candidate: null,
        note: "일치하는 후보 없음",
      });
    } else {
      for (const c of r.candidates) {
        allRows.push({ shopId: r.shopId, shopName: r.shopName, shopCountry: r.shopCountry, candidate: c });
      }
    }
  }
  const acceptableRows = allRows.filter((row) => row.candidate?.matchLevel && row.candidate.matchLevel !== "low");
  // CEO 지시(2026-08-19: "매칭성공 0이면 조회를 하지마") — 참고 가능한 매칭이
  // 하나도 없으면 "더 보기" 토글 자체를 그리지 않는다(위 ResultHeadline이 이미
  // 안내 — 아래 토글이 "그래도 27건 보러가기"처럼 보이는 것을 막는다는 기존 원칙 유지).
  if (acceptableRows.length === 0) return null;
  const rows = showAll ? allRows : acceptableRows;
  const hiddenCount = allRows.length - acceptableRows.length;
  return (
    <div className="space-y-1.5">
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="text-xs text-primary underline hover:text-primary-hover"
        >
          {showAll ? "참고용 항목 접기" : "참고용 검색 결과 더 보기"}
        </button>
      )}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[640px] border-collapse text-left text-[11px]">
          <thead>
            <tr className="border-b border-border bg-background text-text-secondary">
              <th className="px-2 py-1.5 font-medium">판매처</th>
              <th className="px-2 py-1.5 font-medium">국가</th>
              <th className="px-2 py-1.5 font-medium">상품</th>
              <th className="px-2 py-1.5 font-medium">가격</th>
              <th className="px-2 py-1.5 font-medium">매칭상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const c = row.candidate;
              // P-5(CPO 지시, 2026-08-29 STEP5) — 동일상품(very_high/high)과
              // 유사상품(medium)을 표에서도 시각적으로 분리한다. 유사상품 행은
              // 옅은 배경을 줘서 "참고용"임을 표에서도 한 번 더 드러낸다(배지
              // 색상만으로는 스캔할 때 놓치기 쉽다는 게 STEP5의 근거).
              // P-11 STEP 4 — productMatchTruth가 있으면 그 값으로 판단한다(Ezra처럼
              // matchLevel="high"인데 실제로는 다른 상품인 행도 옅은 배경 + 가격 셀
              // 주의 문구를 받아야 한다).
              const isSimilarOnly = c?.productMatchTruth
                ? !isConfirmedSameProduct(c.productMatchTruth)
                : c?.matchLevel === "medium";
              return (
                <tr
                  key={`${row.shopId}-${i}`}
                  className={`border-b border-border align-top last:border-b-0 ${isSimilarOnly ? "bg-warning-soft/30" : ""}`}
                >
                  <td className="px-2 py-1.5 text-text-primary">
                    {countryToFlagEmoji(row.shopCountry) ?? "🌐"} {row.shopName}
                  </td>
                  <td className="px-2 py-1.5 text-text-secondary">{row.shopCountry ?? "확인 불가"}</td>
                  <td className="px-2 py-1.5">
                    {c ? (
                      <a href={c.url} target="_blank" rel="noreferrer" className="text-text-primary underline">
                        {c.title}
                      </a>
                    ) : (
                      <span className="text-text-tertiary">{row.note}</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <PriceCell candidate={c} krwRates={krwRates} fxSource={fxSource} isSimilarOnly={isSimilarOnly} />
                  </td>
                  <td className="px-2 py-1.5">
                    {c ? <MatchBadge candidate={c} /> : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** P-19-B Sprint 9(CPO 지시, 2026-09-02) — "42%/72%/95% 같은 raw score를 판매자
 * 화면에서 전부 제거한다"에 따라 텍스트 유사도 %를 배지 어디에도 더 이상
 * 붙이지 않는다(확정 여부와 무관하게 전면 제거 — 이전 P-11 버전은 비확정
 * 케이스에만 남겨뒀었다). productMatchTruth가 있으면 그 판정 배지 + 근거
 * 문구(matchReasons)로 표시하고, 없으면(구버전 응답) 기존 matchLevel 배지로
 * 폴백한다. score는 내부 랭킹(정렬)에는 계속 쓰이지만 화면에는 노출하지 않는다. */
function MatchBadge({ candidate: c }: { candidate: Candidate }) {
  if (c.productMatchTruth) {
    const { icon, text, badgeClass } = PRODUCT_MATCH_TRUTH_DISPLAY[c.productMatchTruth];
    return (
      <div className="space-y-0.5">
        <span className={`inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${badgeClass}`}>
          {icon} {text}
        </span>
        {c.matchReasons?.length ? <p className="text-[10px] text-text-tertiary">근거: {c.matchReasons.join(" · ")}</p> : null}
      </div>
    );
  }
  if (!c.matchLevel) return <>—</>;
  return (
    <div className="space-y-0.5">
      <span className={`inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${MATCH_LEVEL_BADGE_CLASS[c.matchLevel]}`}>
        {MATCH_LEVEL_ICON[c.matchLevel]}{" "}
        {c.matchLevel === "very_high" || c.matchLevel === "high"
          ? "동일상품"
          : c.matchLevel === "medium"
            ? "비교상품"
            : "매칭 불확실"}
      </span>
      {c.matchReasons?.length ? <p className="text-[10px] text-text-tertiary">근거: {c.matchReasons.join(" · ")}</p> : null}
    </div>
  );
}

/** P-4-DATA-4(CPO 지시, 원칙 1) — priceStatus가 VERIFIED_CURRENT일 때만 숫자를
 * 보여준다. UNVERIFIED_SEARCH/PRICE_UNAVAILABLE은 candidate.price 필드에 값이
 * 있어도(검색 인덱스가 뭔가 반환했어도) 절대 숫자를 노출하지 않는다 — 매칭
 * 신뢰도(matchLevel)와 무관하게 이 규칙은 예외 없이 적용된다("동일상품 100%"인
 * Hug Hairy Monster도 검증 실패 시 이 셀에서 숫자가 빠진다). */
function PriceCell({
  candidate,
  krwRates,
  fxSource,
  isSimilarOnly,
}: {
  candidate: Candidate | null;
  krwRates: Record<string, number> | null;
  fxSource: "frankfurter" | "fallback" | null;
  /** P-5 STEP5 — medium(유사상품) 매칭일 때만 true. 가격이 검증되었어도 "동일
   * 상품이 아닐 수 있다"는 걸 가격 숫자 바로 옆에서 한 번 더 알려준다 — 매칭상태
   * 열의 배지만으로는 표를 훑어볼 때 놓치기 쉽다는 게 이 파라미터를 추가한 이유. */
  isSimilarOnly?: boolean;
}) {
  if (!candidate) return <span className="text-text-tertiary">—</span>;
  const status = candidate.priceStatus ?? "UNVERIFIED_SEARCH";
  if (!isPriceDisplayable(status, candidate.price)) {
    return (
      <span className="text-text-tertiary" title={PRICE_STATUS_LABEL[status]}>
        {status === "PRICE_UNAVAILABLE" ? "가격 확인 실패" : "가격 확인 필요"}
      </span>
    );
  }
  const krwAmount = computeKrwAmount(candidate.price!.amount, candidate.price!.currency, krwRates);
  const fxLine = computeFxLine(candidate.price!.currency, krwRates, fxSource);
  const onSale = isOnSale(candidate.price, candidate.regularPrice);
  return (
    <div className="whitespace-nowrap">
      <span className="text-text-primary">
        {candidate.price!.amount.toFixed(2)} {candidate.price!.currency}
      </span>
      {onSale && (
        <span className="ml-1 text-text-tertiary line-through">
          {candidate.regularPrice!.amount.toFixed(2)}
        </span>
      )}
      {krwAmount != null && (
        <div className="text-text-secondary">
          약 ₩{krwAmount.toLocaleString("ko-KR")}
          {fxLine && <span className="ml-1 text-[10px] text-text-tertiary">· {fxLine}</span>}
        </div>
      )}
      <div className="text-[10px] text-success">✓ 현재 가격 확인됨</div>
      {isSimilarOnly && (
        <div className="text-[10px] text-warning">※ 동일 상품이 아닐 수 있습니다(참고용)</div>
      )}
    </div>
  );
}
