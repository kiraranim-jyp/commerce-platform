"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { countryToFlagEmoji } from "@commerce/shared";
// MI-COLLECTION-GUARD-1 — "이 상품은 이미 수집했다"는 사실이 사는 곳.
import { useCollectOnce } from "./market-collection";
// MI-UX-FINAL-4 — 「📊 시장 가격 비교」 안에서는 접힘을 한 겹 벗는다.
import { MarketEvidenceFrame, MARKET_EVIDENCE_EMPTY, type MarketEvidenceVariant } from "./market-evidence-frame";
import { deriveComparisonResultState, getComparisonResultHeadline, type ComparisonResultState } from "@/lib/comparison-result-status";
import { computeFxLine, computeKrwAmount, formatMoney, isOnSale, isPriceDisplayable } from "@/lib/price-truth";
// MATCHING-UNIFY-1 — 국내/해외가 같은 문구를 쓰도록 라벨 매핑을 한 곳에서 가져온다.
// MI-UX-9 — 기본 노출 등급/그룹 순서/유사상품 상한도 국내와 같은 곳에서 가져온다.
import {
  DEFAULT_TIER_ORDER,
  defaultLimitForTier,
  isDefaultVisibleTier,
  // MI-MATCHING-INTEGRATION-2 — "애초에 목록에 설 수 있는 후보인가". 국내 표와
  // 같은 함수를 쓴다(두 화면이 다른 기준으로 후보를 거르지 않는다).
  mayShowCandidate,
  overseasMatchDisplay,
  tierGroupLabel,
  type MatchDisplayTier,
} from "./match-display";
// MI-MARKET-EVIDENCE-1 — 이 조회 결과를 MI 본문의 🌎 해외 시장 요약으로 옮기는
// 유일한 함수. 개수·등급·가격대를 여기서 직접 만들지 않는다(요약 규칙이 두 벌이
// 되면 요약과 이 표가 다른 말을 하게 된다).
import {
  buildOverseasMarketEvidence,
  type MarketEvidenceSummary,
  type OverseasMarketCandidateInput,
} from "./market-evidence";
// MI-UX-9 §10 — 검색 상태 5종(자동지원/수동필요/검색실패/결과없음/확인불가) 구분.
import { searchSourceStatusDisplay } from "@/lib/search-source-status";
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

/* MATCHING-UNIFY-1(CPO 지시, 2026-09-06) — 라벨 맵을 match-display.ts 하나로
   합쳤다. 국내/해외가 각자 맵을 들고 있어 같은 뜻이 화면마다 다르게 보였다
   (예: SIMILAR을 국내는 "🟡 비교상품", 해외는 "⚪ 유사상품"). 판정값과 가격
   반영 정책은 그대로이고 표시 문구만 통일한다. */

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

/** MI-UX-9(CPO 지시, 2026-09-07 §5) — 국내와 같은 등급 축으로 표를 묶기 위한 매핑.
 *
 * 이전 기본 필터는 `matchLevel !== "low"`(텍스트 유사도)였다. 이건 P-11에서
 * 이미 밝혀진 문제를 표 필터에 그대로 남겨둔 것이다 — productMatchTruth가
 * CONFLICT("식별자가 실제로 다름")인 후보도 텍스트 점수만 높으면 기본 노출에
 * 남았다. 여기서는 판정값(productMatchTruth)을 우선 기준으로 삼고, 없을 때만
 * 기존 matchLevel로 폴백한다 — 판정 알고리즘은 그대로다. */
function displayTierForCandidate(c: Pick<Candidate, "productMatchTruth" | "matchLevel">): MatchDisplayTier {
  if (c.productMatchTruth) return overseasMatchDisplay(c.productMatchTruth).tier;
  if (c.matchLevel === "very_high" || c.matchLevel === "high") return "SAME";
  if (c.matchLevel === "medium") return "PRESUMED_SAME";
  return "UNKNOWN";
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

/**
 * MI-COLLECTION-GUARD-1 — 한 번의 수집이 만들어 내는 것 전부.
 *
 * 예전에는 이 다섯 조각이 각자 `useState`로 흩어져 있었다. 한 덩어리로 묶은
 * 이유는 취향이 아니라 수명이다: 다섯 조각은 **같은 한 번의 조회**에서 나온
 * 사실이라 함께 태어나고 함께 늙어야 한다. 흩어져 있으면 "표는 새 결과인데
 * 환율은 이전 조회 것"이 언젠가 성립한다.
 */
interface OverseasCollection {
  results: SearchResult[];
  sourceVerification: SourceVerification | null;
  krwRates: Record<string, number> | null;
  fxSource: "frankfurter" | "fallback" | null;
  queriedAt: string;
}

/**
 * 실제 조회. **이 함수를 부르는 곳은 두 군데뿐이다** — 상품이 바뀌었을 때의
 * 최초 1회(useCollectOnce)와 셀러가 [가격비교 다시 검색]을 누를 때.
 * 마운트도, 탭도, 접힘도 여기로 오는 길이 없다.
 */
async function collectOverseasPrices(input: {
  title: string;
  brand?: string;
  sourceUrl?: string;
  sku?: string;
  description?: string;
}): Promise<OverseasCollection> {
  let searchRes: Response;
  let ratesRes: Response | null;
  try {
    [searchRes, ratesRes] = await Promise.all([
      fetch("/api/comparison/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
      // N-3.10 Part L — 원본가격 옆에 KRW 환산도 같이 보여준다. PriceEditor가
      // 이미 쓰는 것과 같은 /api/exchange-rates를 그대로 재사용한다(별도
      // 환율 로직을 새로 만들지 않는다).
      fetch("/api/exchange-rates").catch(() => null),
    ]);
  } catch {
    throw new Error("검색 요청에 실패했습니다.");
  }
  const data = (await searchRes.json().catch(() => null)) as {
    ok: boolean;
    results?: SearchResult[];
    sourceVerification?: SourceVerification;
    error?: string;
  } | null;
  if (!data?.ok) throw new Error(data?.error ?? "검색에 실패했습니다.");

  let krwRates: Record<string, number> | null = null;
  let fxSource: "frankfurter" | "fallback" | null = null;
  if (ratesRes?.ok) {
    const ratesData = (await ratesRes.json().catch(() => null)) as {
      rates?: Record<string, number>;
      source?: "frankfurter" | "fallback";
    } | null;
    if (ratesData?.rates) krwRates = ratesData.rates;
    fxSource = ratesData?.source ?? null;
  }
  return {
    results: data.results ?? [],
    sourceVerification: data.sourceVerification ?? null,
    krwRates,
    fxSource,
    queriedAt: new Date().toLocaleString("ko-KR"),
  };
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
  open,
  onToggle,
  onEvidenceChange,
  variant = "DRILL_DOWN",
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
  /**
   * MI-MARKET-EVIDENCE-1(CEO 지시, 2026-09-12) — 이 표는 MI 🌎 해외 시장 요약의
   * **드릴다운 대상**이다(국내 표와 같은 이유로 기본 펼침을 버렸다).
   */
  open?: boolean;
  onToggle?: (open: boolean) => void;
  /**
   * MI-MARKET-EVIDENCE-1 — 이 조회 결과로 만든 요약을 위로 올려보낸다.
   *
   * MI가 같은 조회를 한 번 더 하지 않게 하는 장치다. 해외 판매처 가격은
   * price-history 응답에 없고 이 컴포넌트만 갖고 있으므로, 여기서 만들어
   * 올려보내지 않으면 MI는 같은 질문을 별도 경로로 다시 물어야 하고 —
   * 그 순간 한 화면에 서로 다른 해외 가격이 두 벌 생긴다.
   *
   * 요약은 **아래 표가 기본으로 보여주는 행들**로만 만든다(같은 필터·같은 등급
   * 판정). 요약이 표보다 넓은 집합을 세면 "요약은 5곳인데 열어보니 3줄"이 된다.
   */
  onEvidenceChange?: (evidence: MarketEvidenceSummary | null) => void;
  /**
   * MI-UX-FINAL-4 — 이 패널이 어느 자리에 서 있는가(market-evidence-frame.ts).
   * FLAT은 「📊 시장 가격 비교」 안쪽이라 접힘을 한 겹 벗는다 — 이미 "시장 가격을
   * 보겠다"고 말하고 들어온 셀러에게 같은 질문을 한 번 더 하지 않는다.
   */
  variant?: MarketEvidenceVariant;
}) {
  /**
   * MI-COLLECTION-GUARD-1(CEO 지시, 2026-09-13) — 이 조회는 상품 하나에 한 번이다.
   *
   * 여기 있던 것은 `useState` 여섯 개와 `autoSearchedRef` 하나였다. 그 ref가
   * "한 번만"을 지키고 있었는데, ref의 수명은 **이 컴포넌트 인스턴스**여서
   * 탭 이동·접기/펼치기·단계 전환이 언마운트할 때마다 함께 사라졌다. 그러면
   * 다음 마운트는 자기가 처음인 줄 알고 `POST /api/comparison/search`를 다시
   * 쏜다 — 그건 표시용 조회가 아니라 판매자가 켜 둔 편집샵을 실제로 뒤지는
   * 크롤링이다. 자세한 경로는 market-collection.ts의 머리 주석에 있다.
   *
   * 상태를 통째로 그 모듈로 옮겼다. 수명이 상품과 같아지므로 재마운트가
   * 수집을 부르지 못하고, 돌아온 화면은 이미 채워진 채로 선다.
   */
  const collection = useCollectOnce<OverseasCollection>(
    // title이 아직 없으면 물어볼 것이 없다(예전 `!title` 가드와 같은 뜻이다).
    // 키는 상품의 정체다 — 셀러가 상품명을 손보는 것으로 크롤링이 다시 돌면 안 된다.
    title ? `overseas:${sourceUrl || title}` : null,
    () => collectOverseasPrices({ title, brand, sourceUrl, sku, description }),
  );
  const { loading, error } = collection;
  const results = collection.data?.results ?? null;
  const sourceVerification = collection.data?.sourceVerification ?? null;
  // P-4-DATA-6 P0-3(CPO 지시, 2026-08-29) — "환율로 계산했다"고만 말하지 않고 어떤
  // 환율을 썼는지 그대로 보여준다("기준 환율 1 GBP = ₩1,852 · frankfurter"). rate는
  // 이 페이지가 표시할 후보들과 같은 순간에 딱 한 번 조회한 krwRates에서 그대로
  // 가져온다 — 후보마다 다른 환율을 쓰지 않는다(P0-3: 단일 FX 엔진 원칙).
  const krwRates = collection.data?.krwRates ?? null;
  const fxSource = collection.data?.fxSource ?? null;
  const queriedAt = collection.data?.queriedAt ?? null;

  /**
   * MI-MARKET-EVIDENCE-1 — 위 요약이 아래 표와 **같은 행**을 센다.
   *
   * 필터도 등급 판정도 ResultTable이 쓰는 것 그대로다(isDefaultVisibleTier /
   * displayTierForCandidate). 여기서 조건을 한 글자라도 다르게 쓰면 요약과
   * 드릴다운이 다른 개수를 말하게 되고, 그러면 요약은 확인할 수 없는 주장이 된다.
   *
   * 가격도 같은 규칙을 따른다 — P-4-DATA-4의 절대 원칙대로 현재가로 검증된 건만
   * 숫자를 갖고, 나머지는 가격 없이 개수와 등급에만 들어간다(표의 PriceCell이
   * 숫자 대신 "가격 확인 필요"를 그리는 그 행들이다).
   */
  const evidence = useMemo<MarketEvidenceSummary | null>(() => {
    if (!results) return null;
    const candidates: OverseasMarketCandidateInput[] = [];
    for (const r of results) {
      if (r.status !== "ok" || !Array.isArray(r.candidates)) continue;
      for (const c of r.candidates) {
        const tier = displayTierForCandidate(c);
        if (!isDefaultVisibleTier(tier)) continue;
        const status = c.priceStatus ?? "UNVERIFIED_SEARCH";
        candidates.push({
          shopId: r.shopId,
          shopCountry: r.shopCountry ?? null,
          tier,
          price: isPriceDisplayable(status, c.price) ? c.price : null,
        });
      }
    }
    return buildOverseasMarketEvidence({ candidates });
  }, [results]);

  /** 콜백은 ref로 잡는다 — 부모가 매 렌더 새 함수를 넘겨도 보고가 무한히 돌지 않는다. */
  const onEvidenceChangeRef = useRef(onEvidenceChange);
  onEvidenceChangeRef.current = onEvidenceChange;
  useEffect(() => {
    onEvidenceChangeRef.current?.(evidence);
  }, [evidence]);

  return (
    // UX 2.3(CEO 지시, 2026-09-11) — 근거는 "위젯"이 아니라 "의미"로 묶는다.
    // "해외 가격비교"라는 제목은 이 블록이 무엇의 가격인지 말해주지 않아서,
    // 바로 위 국내 비교상품 목록의 연장으로 읽혔다. 이 안에 있는 것은 글로벌
    // 시장의 **다른 판매처** 가격과 **원본 판매자** 본인의 현재가 두 가지이고,
    // 둘 다 한국 경쟁가로 쓰이지 않는다.
    <MarketEvidenceFrame
      variant={variant}
      title="🌎 글로벌 시장 · 해외 판매처 가격 (베타)"
      summary="판매처 · 국가 · 상품 · 가격 · 매칭상태 — MI 🌎 해외 시장 요약의 원자료"
      open={open}
      onToggle={onToggle}
    >
      <p className="text-xs text-text-tertiary">
        활성화된 해외 편집샵에서 유사 상품을 검색합니다 — 참고용 조회이며, 어떤 가격도 자동으로 원본가격/판매가에
        반영되지 않습니다.
      </p>
      {/* MI-COLLECTION-GUARD-1 — 크롤링을 다시 돌리는 **유일한** 버튼이다.
          이름이 "다시"라고 말하는 이유가 그것이다: 첫 조회는 셀러가 부탁하지
          않아도 이미 끝나 있고(상품당 한 번), 이 버튼은 그 결과를 버리고 판매처를
          다시 뒤지겠다는 명시적 요청이다. */}
      <button
        type="button"
        onClick={collection.recollect}
        disabled={loading || !title}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        {loading ? "검색 중..." : "가격비교 다시 검색"}
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
      {/* 조회가 끝났는데 한 곳도 없었다 — "아직 조회 중"과 구분해서만 말한다. */}
      {results?.length === 0 && <p className="text-xs text-text-secondary">{MARKET_EVIDENCE_EMPTY}</p>}
    </MarketEvidenceFrame>
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
      {/* UX 2.3 — 이 카드는 "원본 판매자" 묶음이다. 아래 표(글로벌 시장의 다른
          판매처)와 목적이 달라서 제목으로 먼저 갈라 둔다. */}
      <div className="font-medium text-success">✓ 원본 판매자 · 원본 상품 현재 판매가 확인됨</div>
      <div className="flex flex-wrap items-baseline gap-x-2 text-text-primary">
        {/* MI-UX-9 §4 — `177900.00 KRW`를 만들던 자리. 통화별 소수 자릿수와
            천단위 구분은 formatMoney가 전담한다.
            UX 2.3 — 두 숫자에 각각 라벨을 붙인다. 예전에는 `£55.00  약 ₩99,928`
            처럼 뒤 숫자가 라벨 없이 붙어 있어서, 그 값이 환율로 만든 값인지
            한국에서 관측된 값인지 화면이 말해주지 않았다. */}
        <span className="text-[10px] text-text-tertiary">원본 판매가격</span>
        <span className="font-semibold">{formatMoney(price?.amount, price?.currency)}</span>
        {krwAmount != null && (
          <span className="text-text-secondary">
            <span className="text-[10px] text-text-tertiary">원화 환산</span> 약 {formatMoney(krwAmount, "KRW")}
          </span>
        )}
        {onSale && (
          <>
            <span className="text-text-tertiary line-through">
              {formatMoney(regularPrice!.amount, regularPrice!.currency)}
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
            ? formatMoney(sourceVerification.price.amount, sourceVerification.price.currency)
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
  const allRows: OverseasRow[] = [];
  for (const r of results) {
    // MI-UX-9 §14 — candidates가 배열이 아닌 응답에서도 죽지 않는다.
    if (r.status === "ok" && Array.isArray(r.candidates) && r.candidates.length > 0) {
      for (const c of r.candidates) {
        allRows.push({ shopId: r.shopId, shopName: r.shopName, shopCountry: r.shopCountry, candidate: c });
      }
      continue;
    }
    // MI-UX-9 §10 — "지원되지 않는 사이트"는 셀러에게 아무 행동도 알려주지 않는
    // 개발자 문구였다. 국내와 같은 상태 helper를 써서 "수동 확인 필요 / 검색 실패 /
    // 검색 결과 없음 / 확인 불가"를 구분한다.
    allRows.push({
      shopId: r.shopId,
      shopName: r.shopName,
      shopCountry: r.shopCountry,
      candidate: null,
      note: searchSourceStatusDisplay(r).note,
    });
  }

  // MI-UX-9 §5/§6 — 기본 노출은 판정값 기준. 이전 `matchLevel !== "low"` 필터는
  // CONFLICT(식별자 충돌)도 텍스트 점수만 높으면 통과시켰다.
  //
  // MI-MATCHING-INTEGRATION-2(CEO 지시, 2026-09-13) — 그 조건이 국내 표와 같은
  // 문 하나(mayShowCandidate)로 모였다: 등급 + 다섯 축 중 명시적 충돌 없음 +
  // 최소 유사도. 판정을 다시 하지 않는다 — 이미 계산된 값을 읽는다.
  const mayShow = (c: Candidate) =>
    mayShowCandidate({ tier: displayTierForCandidate(c), confidence: c.confidence });
  const visibleRows = allRows.filter((row) => row.candidate && mayShow(row.candidate));
  const hiddenRows = allRows.filter((row) => !row.candidate || !mayShow(row.candidate));
  // CEO 지시(2026-08-19: "매칭성공 0이면 조회를 하지마") — 참고 가능한 매칭이
  // 하나도 없으면 표 자체를 그리지 않는다(위 ResultHeadline이 이미 안내).
  if (visibleRows.length === 0) return null;

  // §7 — 확정되지 않은 등급(🔵/🟡/⚪)만 상위 3건으로 자르고, 나머지는 "더 보기"로
  // 넘긴다. 🟢 동일상품은 자르지 않는다(사실의 목록이지 후보가 아니다).
  const groups = DEFAULT_TIER_ORDER.map((tier) => {
    const rows = visibleRows.filter((row) => displayTierForCandidate(row.candidate!) === tier);
    const limit = defaultLimitForTier(tier);
    return {
      tier,
      shown: limit == null ? rows : rows.slice(0, limit),
      overflow: limit == null ? [] : rows.slice(limit),
      total: rows.length,
    };
  }).filter((g) => g.total > 0);

  const moreRows = [...groups.flatMap((g) => g.overflow), ...hiddenRows];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-text-secondary">
        {groups.map((g) => (
          <span key={g.tier}>
            {tierGroupLabel(g.tier)} {g.total}건
          </span>
        ))}
      </div>
      {groups.map((g) => (
        <div key={g.tier} className="space-y-1">
          <p className="text-[11px] font-medium text-text-primary">{tierGroupLabel(g.tier)}</p>
          <OverseasRowTable rows={g.shown} krwRates={krwRates} fxSource={fxSource} />
        </div>
      ))}
      {moreRows.length > 0 && (
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-xs text-primary underline hover:text-primary-hover"
          >
            {showAll ? "접기" : `더 보기 (${moreRows.length}건)`}
          </button>
          {showAll && <OverseasRowTable rows={moreRows} krwRates={krwRates} fxSource={fxSource} />}
        </div>
      )}
    </div>
  );
}

type OverseasRow = {
  shopId: string;
  shopName: string;
  shopCountry?: string | null;
  candidate: Candidate | null;
  note?: string;
};

/** MI-UX-9 §2/§12 — 국내(CandidateRowTable)와 같은 열 순서·정렬 규칙을 쓰는 표.
 * 그룹마다 이 표를 반복해서 그리기 위해 ResultTable 안에 있던 JSX를 그대로
 * 컴포넌트로 분리했다(마크업 변경 아님 — 감싸는 구조만 바뀐다). */
function OverseasRowTable({
  rows,
  krwRates,
  fxSource,
}: {
  rows: OverseasRow[];
  krwRates: Record<string, number> | null;
  fxSource: "frankfurter" | "fallback" | null;
}) {
  return (
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[640px] border-collapse text-left text-[11px]">
          <thead>
            <tr className="border-b border-border bg-background text-text-secondary">
              {/* MI-REDEFINE-1 ⑥ — 국내 표와 같은 정렬 규칙(가격 우측 정렬,
                  헤더 줄바꿈 방지). 해외는 재고 데이터가 없으므로 재고 컬럼을
                  만들지 않는다 — 컬럼 수를 맞추려고 빈 값을 넣지 않는다. */}
              {/* UX 2.3(CEO 지시, 2026-09-11) — 한 행이 시장 · 판매처 · 상품 ·
                  가격 · 통화 · 원화 환산 · 매칭 상태를 헷갈리지 않게 말해야 한다.
                  "국가"를 "판매처 국가"로 고친 것은 정확성 때문이다: 이 값은 그
                  상점이 스스로 신고한 국가(shopCountry)이지 관측된 시장이
                  아니다 — "시장"이라고 부르면 ES로 신고한 판매처의 en-kr 페이지
                  가격이 "스페인 시장 가격"으로 읽힌다. */}
              <th className="whitespace-nowrap px-2 py-1.5 font-medium">판매처</th>
              <th className="whitespace-nowrap px-2 py-1.5 font-medium">판매처 국가</th>
              <th className="px-2 py-1.5 font-medium">상품</th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-medium">원본 통화 가격 · 원화 환산</th>
              <th className="whitespace-nowrap px-2 py-1.5 font-medium">매칭상태</th>
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
                  <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
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
    const { icon, label, note, className } = overseasMatchDisplay(c.productMatchTruth);
    return (
      <div className="space-y-0.5">
        <span className={`inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${className}`}>
          {icon} {label}
        </span>
        <p className="text-[10px] text-text-tertiary">{note}</p>
        {/* MI-UX-9 §13 — 국내 표와 같은 이유로 "근거: A · B · C" 줄은 기본 표에서
            뺀다(상세 근거는 상세 영역의 관심사). matchReasons 데이터는 그대로 남는다. */}
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
      {/* MI-UX-9 §13 — 위 분기와 같은 이유로 상세 근거 줄 제거. */}
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
      {/* MI-UX-9 §4 — 표의 가격도 같은 포맷터를 쓴다(우측 정렬 + tabular-nums는
          이 셀을 감싸는 td가 이미 적용). */}
      <span className="text-text-primary">{formatMoney(candidate.price!.amount, candidate.price!.currency)}</span>
      {onSale && (
        <span className="ml-1 text-text-tertiary line-through">
          {formatMoney(candidate.regularPrice!.amount, candidate.regularPrice!.currency)}
        </span>
      )}
      {krwAmount != null && (
        <div className="text-text-secondary">
          {/* UX 2.3 — "약 ₩64,820"만 있으면 그 숫자가 한국에서 관측된 가격인지
              우리가 환율로 만든 값인지 알 수 없다. 라벨로 못박는다. */}
          <span className="text-[10px] text-text-tertiary">원화 환산</span> 약 {formatMoney(krwAmount, "KRW")}
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
