"use client";

import { useState } from "react";
// MI-COLLECTION-GUARD-1 — "이 상품은 이미 수집했다"는 사실이 사는 곳.
import { useCollectOnce } from "./market-collection";
// MI-UX-FINAL-4 — 「📊 시장 가격 비교」 안에서는 접힘을 한 겹 벗는다.
import { MarketEvidenceFrame, MARKET_EVIDENCE_EMPTY, type MarketEvidenceVariant } from "./market-evidence-frame";
// MATCHING-UNIFY-1 — 해외와 같은 라벨을 쓰기 위한 공통 매핑.
// MI-UX-9 — 기본 노출 등급/그룹 순서/유사상품 상한도 같은 곳에서 가져온다.
import {
  DEFAULT_TIER_ORDER,
  defaultLimitForTier,
  domesticMatchDisplay,
  isDefaultVisibleTier,
  tierGroupLabel,
  type MatchDisplayTier,
} from "./match-display";
// MI-UX-9 §4 — 통화 표시를 한 곳에서. §10 — 검색 상태 5종 구분.
import { formatMoney } from "@/lib/price-truth";
import { deriveSearchSourceStatus, searchSourceStatusDisplay } from "@/lib/search-source-status";

type MatchLevel = "very_high" | "high" | "medium" | "low";

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

/** P-19-B Sprint 6/9(CPO 지시, 2026-09-02) — "SKU·모델코드 등 식별자 근거 없이는
 * 동일상품 확인이라고 부르지 않는다" 원칙을 배지 문구 자체에도 고정한다.
 * TEXT_CONFIRMED/SIMILAR는 둘 다 식별자 증거가 없는(modelCode="unavailable")
 * 경우이므로(match-truth.ts의 deriveMatchTruth 참고) 텍스트 점수가 아무리 높아도
 * "동일상품"이라고 부르지 않고 동일하게 "비교상품"으로 표시한다 — 이전(P-7-B)
 * 버전은 TEXT_CONFIRMED를 "동일상품 가능성 높음"으로 불러 정책과 문구가
 * 어긋났다. matchTruth가 있으면 그걸 우선 배지로 쓰고, 없으면(구버전 응답 등)
 * 기존 matchLevel 배지로 그대로 폴백한다 — 하위호환, 회귀 없음. */
type MatchTruth = "EXACT_IDENTIFIER" | "STRONG_IDENTIFIER" | "TEXT_CONFIRMED" | "SIMILAR" | "CONFLICT" | "INSUFFICIENT_EVIDENCE";

/* MATCHING-UNIFY-1(CPO 지시, 2026-09-06) — 라벨 맵을 match-display.ts로
   통합했다. 기존에는 국내가 SIMILAR을 "🟡 비교상품"으로, 해외가 "⚪ 유사상품"
   으로 불러서 같은 판정이 화면마다 다른 신뢰도로 보였다. 판정값과 가격 반영
   정책(EXACT/STRONG만 동일상품 가격)은 변경 없이 문구만 통일한다. */


/**
 * P-24 Sprint 2(CPO 지시, 2026-09-02) — 실측(PèPè): 진짜 동일상품(포레포레,
 * matchTruth=STRONG_IDENTIFIER, SKU 일치)의 confidence는 0.42(matchLevel="low")인
 * 반면, 식별자 근거 없는 비교상품(듀베베, matchTruth=SIMILAR)은 confidence
 * 0.72(matchLevel="medium")였다 — 텍스트 유사도 점수는 식별자 매칭보다 항상
 * 낮게 나올 수 있다. 이 화면이 `matchLevel !== "low"`(구식 confidence 필터,
 * matchTruth 도입 이전 로직)로 기본 노출을 걸러서, 진짜 동일상품이 "매칭
 * 불확실 더보기" 뒤로 숨고 비교상품이 대표로 보이는 버그였다. priceTierFromLink()
 * (domestic-product-link.ts)와 동일한 6분기 판정을 그대로 재사용한다 — 새 매칭
 * 로직 아님, matchTruth가 없는(레거시) 응답만 기존 matchLevel 폴백을 쓴다. */
export type PriceTier = "EXACT" | "COMPARISON" | "EXCLUDED";
export function tierForCandidate(c: Pick<Candidate, "matchTruth" | "matchLevel">): PriceTier {
  if (c.matchTruth === "EXACT_IDENTIFIER" || c.matchTruth === "STRONG_IDENTIFIER") return "EXACT";
  if (c.matchTruth === "TEXT_CONFIRMED" || c.matchTruth === "SIMILAR") return "COMPARISON";
  if (c.matchTruth === "CONFLICT" || c.matchTruth === "INSUFFICIENT_EVIDENCE") return "EXCLUDED";
  if (c.matchLevel === "very_high" || c.matchLevel === "high") return "EXACT";
  if (c.matchLevel === "medium") return "COMPARISON";
  return "EXCLUDED";
}

/** MI-UX-9(CPO 지시, 2026-09-07 §5) — 표를 3분류(EXACT/COMPARISON/EXCLUDED)가
 * 아니라 셀러가 실제로 보는 매칭 등급(동일상품 / 동일상품 추정 / 유사상품)으로
 * 묶기 위한 매핑. tierForCandidate()는 "가격 반영 정책"을 말하는 축이라 그대로
 * 두고(회귀 테스트가 있다), 여기서는 "화면에서 어느 그룹에 넣을지"만 정한다.
 * 판정값 자체는 변환하지 않는다 — domesticMatchDisplay가 이미 하는 매핑을 쓴다. */
function displayTierForCandidate(c: Pick<Candidate, "matchTruth" | "matchLevel">): MatchDisplayTier {
  if (c.matchTruth) return domesticMatchDisplay(c.matchTruth).tier;
  // 구버전 응답(matchTruth 없음) 폴백 — 기존 배지 폴백과 같은 기준을 쓴다.
  if (c.matchLevel === "very_high" || c.matchLevel === "high") return "SAME";
  if (c.matchLevel === "medium") return "PRESUMED_SAME";
  return "UNKNOWN";
}

export interface Candidate {
  title: string;
  url: string;
  price: { amount: number; currency: string } | null;
  regularPrice?: { amount: number; currency: string } | null;
  imageUrl: string | null;
  confidence: number;
  matchLevel?: MatchLevel;
  matchReasons?: string[];
  matchTruth?: MatchTruth;
  /** N-4.18-Q3 PART E-2 — 매칭 신뢰도와 완전히 분리된 축. true=품절 확인,
   * false=판매중 확인, null/undefined=그 사이트에서 확인할 방법이 없음(임의로
   * 판매중/품절 어느 쪽으로도 해석하지 않는다). */
  soldOut?: boolean | null;
}

/** N-4.18-Q3 PART E-4 — 재고 상태는 매칭 배지와 완전히 별도의 배지로 표시한다
 * (하나로 합치지 않는다). null/undefined는 "확인불가"이지 "판매중"이 아니다. */
function StockBadge({ soldOut }: { soldOut?: boolean | null }) {
  if (soldOut === true) {
    return (
      <span className="inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-error-soft text-error">
        🔴 품절
      </span>
    );
  }
  if (soldOut === false) {
    return (
      <span className="inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-success-soft text-success">
        🟢 판매중
      </span>
    );
  }
  return (
    <span className="inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-background text-text-tertiary">
      ⚪ 재고 확인불가
    </span>
  );
}

/** N-4.18-Q3 PART E-5 — 할인이 있을 때만(정가 > 현재가) 정상가/현재가를 둘 다
 * 보여준다. 할인이 없으면 "판매가" 한 줄만 — 정상가를 중복 표시하지 않는다. */
function PriceCell({ candidate }: { candidate: Candidate }) {
  if (!candidate.price) return <span className="text-text-tertiary">—</span>;
  if (candidate.regularPrice && candidate.regularPrice.amount > candidate.price.amount) {
    return (
      <div className="space-y-0.5">
        {/* MI-UX-9 §4 — 통화 포맷은 formatMoney 하나만 거친다(₩ 하드코딩 제거). */}
        <div className="text-text-tertiary line-through">
          {formatMoney(candidate.regularPrice.amount, candidate.regularPrice.currency)}
        </div>
        <div className="font-medium text-text-primary">{formatMoney(candidate.price.amount, candidate.price.currency)}</div>
      </div>
    );
  }
  return <div>{formatMoney(candidate.price.amount, candidate.price.currency)}</div>;
}

interface SearchResult {
  shopId: string;
  shopName: string;
  domain: string;
  status: "ok" | "unsupported" | "error";
  candidates: Candidate[];
  error?: string;
}

/** MI-COLLECTION-GUARD-1 — 한 번의 수집이 낳는 것 전부(해외 패널과 같은 규칙). */
interface DomesticCollection {
  results: SearchResult[];
  queriedAt: string;
}

/** 실제 조회. 부르는 곳은 상품당 최초 1회와 [가격비교 다시 검색] 둘뿐이다. */
async function collectDomesticPrices(input: {
  title: string;
  brand?: string;
  sourceUrl?: string;
  sku?: string;
  description?: string;
}): Promise<DomesticCollection> {
  let res: Response;
  try {
    res = await fetch("/api/domestic-price-sources/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error("검색 요청에 실패했습니다.");
  }
  const data = (await res.json().catch(() => null)) as {
    ok: boolean;
    results?: SearchResult[];
    error?: string;
  } | null;
  if (!data?.ok) throw new Error(data?.error ?? "검색에 실패했습니다.");
  return { results: data.results ?? [], queriedAt: new Date().toLocaleString("ko-KR") };
}

/** N-4.07(대표님 지시: "국내 키즈의류 수입아동복 편집샵 사이트를 기본 등록해서 비교해줘") —
 * ComparisonShopSearch(해외)와 완전히 같은 UX 패턴(자동 1회 검색 + 재검색 버튼 + 매칭등급
 * 배지 + 매칭 불확실(70% 미만) 접기)을 그대로 따른다. 국내 소스는 이미 KRW로만 표시되므로 환율 변환
 * 컬럼이 없다는 것만 다르다. 여기도 "가장 싼 가격을 자동으로 원본가격에 반영" 금지 원칙은
 * 동일하게 적용 — 읽기 전용 조회다. */
export function DomesticShopSearch({
  title,
  brand,
  sourceUrl,
  sku,
  description,
  open,
  onToggle,
  variant = "DRILL_DOWN",
}: {
  title: string;
  brand?: string;
  sourceUrl?: string;
  sku?: string;
  /** P-7-B(CPO 지시, 2026-08-29) — 설명문에서 뽑은 상품코드(예: "Article code:
   * 01195-VERNICE-NERO")를 국내 후보의 modelCode와 비교해 matchTruth를 계산하는
   * 데 쓴다. 없어도(undefined) 기존처럼 matchLevel 배지만 보여준다(하위호환). */
  description?: string;
  /**
   * MI-MARKET-EVIDENCE-1(CEO 지시, 2026-09-12) — 이 표는 이제 MI 🇰🇷 국내 시장
   * 요약의 **드릴다운 대상**이다.
   *
   * 그래서 기본 펼침(defaultOpen)을 버리고 바깥이 여는 접힘이 됐다. 요약이 위에
   * 있는데 표가 아래에서 함께 펼쳐져 있으면 같은 시장 사실이 한 화면에 두 벌
   * 서고, 그게 정확히 "MI를 짧게 만들면 근거가 사라지고, 근거를 되살리면 화면이
   * 길어진다"를 반복하게 만든 구조다. 조회는 그대로 마운트 시 자동으로 돈다 —
   * 접혀 있는 것은 표이지 데이터가 아니다(요약이 그 데이터 위에 서 있다).
   *
   * 둘 다 주지 않으면 예전처럼 스스로 여닫는다(CollapsibleSection의 비제어 모드).
   */
  open?: boolean;
  onToggle?: (open: boolean) => void;
  /** MI-UX-FINAL-4 — 해외 패널과 같은 규칙(market-evidence-frame.ts). */
  variant?: MarketEvidenceVariant;
}) {
  /**
   * MI-COLLECTION-GUARD-1(CEO 지시, 2026-09-13) — 해외 패널과 **같은 병, 같은 약**.
   *
   * 여기 있던 `autoSearchedRef`도 인스턴스 수명이라, 탭을 옮기거나 「📊 시장 가격
   * 비교」를 접었다 펴는 것만으로 `POST /api/domestic-price-sources/search`가
   * 다시 나갔다 — 등록된 국내 편집샵을 전부 다시 뒤지는 요청이다. 보호장치를
   * 상품 수명으로 옮긴다(market-collection.ts).
   */
  const collection = useCollectOnce<DomesticCollection>(
    title ? `domestic:${sourceUrl || title}` : null,
    () => collectDomesticPrices({ title, brand, sourceUrl, sku, description }),
  );
  const { loading, error } = collection;
  const results = collection.data?.results ?? null;
  const queriedAt = collection.data?.queriedAt ?? null;

  return (
    // UX 2.3(CEO 지시, 2026-09-11) — 제목이 이 블록의 **의미**를 말하게 한다.
    // 여기 있는 가격은 한국 편집샵이 파는 값(국내 비교상품)이고, 판매 판단이
    // 서 있는 한국 시장의 경쟁가 근거다. "국내 가격비교"라는 이름은 바로 아래
    // 해외 블록과 같은 층위로 읽혀서, 둘이 같은 종류의 가격처럼 보였다.
    <MarketEvidenceFrame
      variant={variant}
      title="🇰🇷 한국 시장 · 국내 비교상품 (베타)"
      summary="판매처 · 상품 · 가격 · 재고 · 매칭상태 — MI 🇰🇷 국내 시장 요약의 원자료"
      open={open}
      onToggle={onToggle}
    >
      {/* MI-UI-1(CEO 지시, 2026-09-11: "글이 너무 많다") — 세 줄을 한 줄로 줄인다.
          지우지 않고 남긴 두 가지는 셀러의 행동을 바꾸는 사실이다: ① 여기 가격이
          판매가에 자동 반영되지 않는다(반영된다고 오해하면 가격을 안 정한다),
          ② 검색 대상 사이트를 어디서 늘리는지(결과가 적을 때 할 일). 어느 샵을
          뒤지는지는 아래 결과 표의 "판매처" 열이 이미 실제 이름으로 말한다. */}
      <p className="text-xs text-text-tertiary">
        참고용 조회 — 어떤 가격도 원본가격/판매가에 자동 반영되지 않습니다. 검색 대상은 설정 &gt; 국내
        가격비교에서 관리합니다.
      </p>
      {/* MI-COLLECTION-GUARD-1 — 국내 편집샵을 다시 뒤지는 유일한 통로. */}
      <button
        type="button"
        onClick={collection.recollect}
        disabled={loading || !title}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        {loading ? "검색 중..." : "가격비교 다시 검색"}
      </button>
      {error && <p className="text-xs text-error">{error}</p>}
      {/* MI-UI-1 — "조회 시점:" 라벨은 🕒로 대신한다. 시각 값 자체는 그대로다
          (가격이 언제 기준인지는 판단에 직접 쓰이는 정보라 줄이지 않는다). */}
      {queriedAt && <p className="text-[10px] text-text-tertiary">🕒 {queriedAt}</p>}
      {results && <ResultHeadline results={results} title={title} brand={brand} />}
      {results && <ResultTable results={results} />}
      {results?.length === 0 && <p className="text-xs text-text-secondary">{MARKET_EVIDENCE_EMPTY}</p>}
    </MarketEvidenceFrame>
  );
}

/** P-24 Sprint 2(CPO 지시, 2026-09-02) — "동일상품이 있으면 항상 대표"다.
 * matchLevel(구식 confidence) 기준을 버리고 tierForCandidate()(matchTruth
 * 우선)로 EXACT 존재 여부를 판단한다. */
function ResultHeadline({ results, title, brand }: { results: SearchResult[]; title: string; brand?: string }) {
  // MI-UX-9 §14 — 부분/변형 응답에서 candidates가 없어도 화면이 죽지 않는다.
  const countBy = (tier: PriceTier) =>
    results.reduce((n, r) => n + (r.candidates ?? []).filter((c) => tierForCandidate(c) === tier).length, 0);
  const exactCount = countBy("EXACT");
  const comparisonCount = countBy("COMPARISON");
  if (exactCount === 0 && comparisonCount === 0) {
    // MI-DOMESTIC-FIX-2 §A(CPO 지시, 2026-09-10) — 여기가 서로 다른 네 가지
    // 사실을 한 문장으로 뭉개던 자리다. "찾지 못했습니다"는
    //   ① 검색해봤는데 정말 없었다
    //   ② 결과는 있었는데 동일상품이라고 부를 근거가 없었다
    //   ③ 애초에 자동 검색을 지원하는 판매처가 없었다
    //   ④ 이번 요청이 실패했다
    // 를 전부 같은 말로 만들었다. 셀러가 해야 할 행동은 넷 다 다르다 —
    // ③은 직접 사이트를 봐야 하고, ④는 잠시 후 다시 누르면 된다.
    //
    // 판정 근거는 새로 만들지 않는다. deriveSearchSourceStatus가 이미 샵별로
    // 같은 구분을 하고 있고(MI-UX-9 §10) 결과 표에서도 쓰고 있다 — 헤드라인만
    // 그걸 안 보고 있었을 뿐이다. API 계약도 그대로다: 서버는 후보를 버리지
    // 않고 다 보내므로 candidates.length가 곧 원시 검색 결과 수다.
    const statuses = results.map((r) => deriveSearchSourceStatus(r));
    const searchedCount = statuses.filter((s) => s === "AUTO_SUPPORTED" || s === "NO_RESULT").length;
    const failedCount = statuses.filter((s) => s === "SEARCH_FAILED").length;
    const rawCount = results.reduce((n, r) => n + (r.candidates?.length ?? 0), 0);

    let headline: string;
    let detail: string;
    if (searchedCount === 0) {
      headline = "⚪ 자동 검색을 지원하는 국내 판매처가 없습니다";
      detail =
        "연결된 판매처가 모두 자동 비교를 지원하지 않아 검색 자체를 하지 못했습니다 — 국내에 상품이 없다는 뜻이 아닙니다.";
    } else if (rawCount > 0) {
      headline = "🟡 검색 결과는 있었지만 동일상품으로 확인된 것은 없습니다";
      detail = `국내 ${searchedCount}곳에서 ${rawCount}건을 찾았지만, 같은 상품이라고 볼 근거가 부족해 가격 비교에 쓰지 않았습니다.`;
    } else {
      headline = "⚪ 국내 검색 결과가 없습니다";
      detail = `자동 검색을 지원하는 국내 ${searchedCount}곳에서 검색했고, 결과가 없었습니다.`;
    }

    // 검색은 새로 만들지 않는다 — 아래는 네이버 검색 결과 페이지로 가는 평범한
    // 링크(anchor)일 뿐이고, API 호출도 크롤러도 없다.
    const query = [brand, title].filter(Boolean).join(" ").trim();
    return (
      <div className="space-y-1.5 rounded-md border border-border bg-background px-3 py-2.5 text-xs">
        <p className="text-text-secondary">{headline}</p>
        <p className="text-[11px] text-text-tertiary">{detail}</p>
        {failedCount > 0 && (
          <p className="text-[11px] text-text-tertiary">
            {failedCount}곳은 이번 검색이 실패했습니다 — 다시 검색하면 결과가 달라질 수 있습니다.
          </p>
        )}
        {query && (
          <a
            href={`https://search.shopping.naver.com/search/all?query=${encodeURIComponent(query)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-block rounded-md border border-border bg-surface px-2.5 py-1.5 text-[11px] font-medium text-text-primary hover:bg-background"
          >
            네이버에서 상품명으로 확인 ↗
          </a>
        )}
      </div>
    );
  }
  // MI-DOMESTIC-FIX-1 §5(CPO 지시, 2026-09-09) — 여기서 "동일상품 확인"이라고만
  // 말하면 가격 패널이 동시에 "국내 가격 확인 불가"를 띄우는 모순이 생긴다.
  // tierForCandidate는 재고를 보지 않는 반면(그게 맞다 — 매칭 판정과 재고는
  // 별개 축이다), 가격 집계는 품절을 빼기 때문이다(price-history.ts summarizeFrom).
  // 그래서 찾은 게 전부 품절이면 그 사실을 그대로 말한다. 품절을 최저가에
  // 넣어서 해결하지 않는다 — 팔 수 없는 가격은 경쟁가격이 아니다.
  const matched = results.flatMap((r) => (r.candidates ?? []).filter((c) => tierForCandidate(c) !== "EXCLUDED"));
  if (matched.length > 0 && matched.every((c) => c.soldOut === true)) {
    return (
      <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-text-primary">
        ⚪ 국내에서 {matched.length}건을 확인했지만 모두 품절입니다 — 현재 판매중인 가격이 없어 국내 가격 비교는
        할 수 없습니다.
      </p>
    );
  }
  if (exactCount > 0) {
    return (
      <p className="rounded-md border border-success/30 bg-success-soft px-3 py-2 text-xs text-success">
        🟢 국내 편집샵에서 동일상품을 {exactCount}건 확인했습니다.
      </p>
    );
  }
  return (
    <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
      🟡 동일상품은 확인되지 않았습니다 — 비교 가능한 유사상품이 {comparisonCount}건 발견되었습니다.
    </p>
  );
}

type CandidateRow = { shopId: string; shopName: string; candidate: Candidate | null; note?: string };

function CandidateRowTable({ rows }: { rows: CandidateRow[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[560px] border-collapse text-left text-[11px]">
        <thead>
          <tr className="border-b border-border bg-background text-text-secondary">
            {/* MI-REDEFINE-1 ⑥(CPO 지시, 2026-09-06) — 국내/해외 표의 정렬
                체계를 통일한다. 가격은 자릿수를 눈으로 비교하는 값이라
                우측 정렬해야 하는데 표 전체가 text-left라 좌측에 붙어 있었다.
                컬럼 구성 자체(해외에는 재고 없음)는 데이터가 다르므로
                억지로 맞추지 않는다 — 없는 재고를 만들지 않는다. */}
            <th className="whitespace-nowrap px-2 py-1.5 font-medium">판매처</th>
            <th className="px-2 py-1.5 font-medium">상품</th>
            <th className="whitespace-nowrap px-2 py-1.5 text-right font-medium">상품가격</th>
            <th className="whitespace-nowrap px-2 py-1.5 font-medium">재고</th>
            <th className="whitespace-nowrap px-2 py-1.5 font-medium">매칭상태</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const c = row.candidate;
            return (
              <tr key={`${row.shopId}-${i}`} className="border-b border-border align-top last:border-b-0">
                <td className="px-2 py-1.5 text-text-primary">🇰🇷 {row.shopName}</td>
                <td className="px-2 py-1.5">
                  {c ? (
                    <a href={c.url} target="_blank" rel="noreferrer" className="text-text-primary underline">
                      {c.title}
                    </a>
                  ) : (
                    <span className="text-text-tertiary">{row.note}</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-text-secondary">
                  {c ? <PriceCell candidate={c} /> : "—"}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5">{c ? <StockBadge soldOut={c.soldOut} /> : "—"}</td>
                <td className="px-2 py-1.5">
                  {c?.matchTruth ? (
                    (() => {
                      const d = domesticMatchDisplay(c.matchTruth);
                      return (
                        <div className="space-y-0.5">
                          <span
                            className={`inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${d.className}`}
                          >
                            {d.icon} {d.label}
                          </span>
                          <p className="text-[10px] text-text-tertiary">{d.note}</p>
                          {/* MI-UX-9 §13 — "근거: A · B · C" 줄은 상세 정보라 기본
                              표에서 뺀다. 배지 + 한 줄 note까지가 기본, 상세 근거는
                              Market Intelligence의 "왜 동일상품인가?" 영역에서 본다.
                              matchReasons 데이터 자체는 응답에 그대로 남아 있다. */}
                        </div>
                      );
                    })()
                  ) : c?.matchLevel ? (
                    <div className="space-y-0.5">
                      <span
                        className={`inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${MATCH_LEVEL_BADGE_CLASS[c.matchLevel]}`}
                      >
                        {MATCH_LEVEL_ICON[c.matchLevel]}{" "}
                        {c.matchLevel === "very_high" || c.matchLevel === "high"
                          ? "동일상품"
                          : c.matchLevel === "medium"
                            ? "비교상품"
                            : "매칭 불확실"}
                      </span>
                      {/* MI-UX-9 §13 — 위 분기와 같은 이유로 상세 근거 줄 제거. */}
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** P-24 Sprint 2(CPO 지시, 2026-09-02) — 대표 노출 순서를 matchLevel(구식
 * confidence)이 아니라 tierForCandidate()(matchTruth 우선)로 그룹화한다.
 * EXACT 그룹을 항상 COMPARISON 그룹보다 먼저(위에) 렌더링한다 — "동일상품이
 * 있으면 비교상품보다 항상 먼저 보인다"는 절대 원칙을 컴포넌트 구조 자체로
 * 강제한다(정렬 순서에 기대지 않는다, CONFLICT/INSUFFICIENT_EVIDENCE/미지원/
 * 오류/후보없음은 전부 "더보기" 뒤로). */
function ResultTable({ results }: { results: SearchResult[] }) {
  const [showAll, setShowAll] = useState(false);
  const allRows: CandidateRow[] = [];
  for (const r of results) {
    // MI-UX-9 §14 — candidates가 배열이 아닌 응답(부분/변형 응답)에서도 죽지
    // 않는다. searchSourceStatusDisplay가 그 경우를 "확인 불가"로 처리한다.
    if (r.status === "ok" && Array.isArray(r.candidates) && r.candidates.length > 0) {
      for (const c of r.candidates) {
        allRows.push({ shopId: r.shopId, shopName: r.shopName, candidate: c });
      }
      continue;
    }
    // MI-UX-9 §10/§15 — 상태 문구를 여기서 만들지 않는다. 특히 이전 코드는
    // `검색 실패: ${r.error}`로 서버 예외 원문을 셀러에게 그대로 노출했다.
    allRows.push({ shopId: r.shopId, shopName: r.shopName, candidate: null, note: searchSourceStatusDisplay(r).note });
  }

  // MI-UX-9 §5/§6 — 기본 노출은 매칭 가능성이 있는 등급만. CONFLICT(다른 상품
  // 가능성)와 UNKNOWN(근거 부족)은 가격 판단 근거가 될 수 없으므로 "더 보기" 뒤로.
  const visibleRows = allRows.filter((row) => row.candidate && isDefaultVisibleTier(displayTierForCandidate(row.candidate)));
  const hiddenRows = allRows.filter((row) => !row.candidate || !isDefaultVisibleTier(displayTierForCandidate(row.candidate)));
  if (visibleRows.length === 0) return null;

  // §7 — 등급별로 묶고, 유사상품만 상위 N건으로 자른다. 잘린 나머지는 버리지
  // 않고 "더 보기" 묶음으로 넘어간다(데이터 삭제가 아니라 기본 노출량 제한).
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
      {/* §7 — 기본 화면은 "무엇이 몇 건 있는지"를 한 줄로 먼저 보여준다. */}
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
          <CandidateRowTable rows={g.shown} />
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
          {showAll && <CandidateRowTable rows={moreRows} />}
        </div>
      )}
    </div>
  );
}
