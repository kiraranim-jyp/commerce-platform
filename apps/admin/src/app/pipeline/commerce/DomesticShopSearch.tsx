"use client";

import { useEffect, useRef, useState } from "react";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";

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

const MATCH_TRUTH_BADGE: Record<MatchTruth, { icon: string; label: string; className: string; disclaimer?: string }> = {
  EXACT_IDENTIFIER: { icon: "🟢", label: "동일상품 확인", className: "bg-success-soft text-success" },
  STRONG_IDENTIFIER: { icon: "🟢", label: "동일상품 확인", className: "bg-success-soft text-success" },
  TEXT_CONFIRMED: {
    icon: "🟡",
    label: "비교상품",
    className: "bg-warning-soft text-warning",
    disclaimer: "동일 모델 식별자가 확인되지 않았습니다 — 국내 유사 시장가격(참고용)으로만 사용됩니다.",
  },
  SIMILAR: {
    icon: "🟡",
    label: "비교상품",
    className: "bg-warning-soft text-warning",
    disclaimer: "동일 모델 식별자가 확인되지 않았습니다 — 국내 유사 시장가격(참고용)으로만 사용됩니다.",
  },
  CONFLICT: {
    icon: "🔴",
    label: "다른상품 가능성",
    className: "bg-error-soft text-error",
    disclaimer: "상품코드가 원본과 일치하지 않습니다 — 동일상품이 아닐 가능성이 높습니다.",
  },
  INSUFFICIENT_EVIDENCE: { icon: "⚪", label: "매칭 불확실", className: "bg-background text-text-tertiary" },
};

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
        <div className="text-text-tertiary line-through">₩{candidate.regularPrice.amount.toLocaleString("ko-KR")}</div>
        <div className="font-medium text-text-primary">₩{candidate.price.amount.toLocaleString("ko-KR")}</div>
      </div>
    );
  }
  return <div>₩{candidate.price.amount.toLocaleString("ko-KR")}</div>;
}

interface SearchResult {
  shopId: string;
  shopName: string;
  domain: string;
  status: "ok" | "unsupported" | "error";
  candidates: Candidate[];
  error?: string;
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
}: {
  title: string;
  brand?: string;
  sourceUrl?: string;
  sku?: string;
  /** P-7-B(CPO 지시, 2026-08-29) — 설명문에서 뽑은 상품코드(예: "Article code:
   * 01195-VERNICE-NERO")를 국내 후보의 modelCode와 비교해 matchTruth를 계산하는
   * 데 쓴다. 없어도(undefined) 기존처럼 matchLevel 배지만 보여준다(하위호환). */
  description?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queriedAt, setQueriedAt] = useState<string | null>(null);
  const autoSearchedRef = useRef(false);

  async function runSearch() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/domestic-price-sources/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, brand, sourceUrl, sku, description }),
      });
      const data = (await res.json()) as { ok: boolean; results?: SearchResult[]; error?: string };
      if (!data.ok) {
        setError(data.error ?? "검색에 실패했습니다.");
        return;
      }
      setResults(data.results ?? []);
      setQueriedAt(new Date().toLocaleString("ko-KR"));
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
    <CollapsibleSection title="국내 가격비교 (베타)" defaultOpen>
      <p className="text-xs text-text-tertiary">
        기본 등록된 국내 수입아동복 편집샵에서 유사 상품을 검색합니다 — 참고용 조회이며, 어떤 가격도 자동으로
        원본가격/판매가에 반영되지 않습니다. 검색 대상 사이트는 설정 &gt; 국내 가격비교에서 추가 관리할 수
        있습니다.
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
      {results && <ResultHeadline results={results} />}
      {results && <ResultTable results={results} />}
    </CollapsibleSection>
  );
}

/** P-24 Sprint 2(CPO 지시, 2026-09-02) — "동일상품이 있으면 항상 대표"다.
 * matchLevel(구식 confidence) 기준을 버리고 tierForCandidate()(matchTruth
 * 우선)로 EXACT 존재 여부를 판단한다. */
function ResultHeadline({ results }: { results: SearchResult[] }) {
  const exactCount = results.reduce((n, r) => n + r.candidates.filter((c) => tierForCandidate(c) === "EXACT").length, 0);
  const comparisonCount = results.reduce((n, r) => n + r.candidates.filter((c) => tierForCandidate(c) === "COMPARISON").length, 0);
  if (exactCount === 0 && comparisonCount === 0) {
    return (
      <p className="rounded-md border border-border bg-background px-3 py-2 text-xs text-text-secondary">
        비교 가능한 동일/유사 상품을 국내 편집샵에서 찾지 못했습니다.
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
            <th className="px-2 py-1.5 font-medium">판매처</th>
            <th className="px-2 py-1.5 font-medium">상품</th>
            <th className="px-2 py-1.5 font-medium">가격</th>
            <th className="px-2 py-1.5 font-medium">재고</th>
            <th className="px-2 py-1.5 font-medium">매칭상태</th>
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
                <td className="px-2 py-1.5 whitespace-nowrap text-text-secondary">{c ? <PriceCell candidate={c} /> : "—"}</td>
                <td className="px-2 py-1.5">{c ? <StockBadge soldOut={c.soldOut} /> : "—"}</td>
                <td className="px-2 py-1.5">
                  {c?.matchTruth ? (
                    <div className="space-y-0.5">
                      <span
                        className={`inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${MATCH_TRUTH_BADGE[c.matchTruth].className}`}
                      >
                        {MATCH_TRUTH_BADGE[c.matchTruth].icon} {MATCH_TRUTH_BADGE[c.matchTruth].label}
                      </span>
                      {c.matchReasons?.length ? (
                        <p className="text-[10px] text-text-tertiary">근거: {c.matchReasons.join(" · ")}</p>
                      ) : null}
                      {MATCH_TRUTH_BADGE[c.matchTruth].disclaimer && (
                        <p className="text-[10px] text-text-tertiary">※ {MATCH_TRUTH_BADGE[c.matchTruth].disclaimer}</p>
                      )}
                    </div>
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
                      {c.matchReasons?.length ? (
                        <p className="text-[10px] text-text-tertiary">근거: {c.matchReasons.join(" · ")}</p>
                      ) : null}
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
    if (r.status === "unsupported") {
      allRows.push({ shopId: r.shopId, shopName: r.shopName, candidate: null, note: "아직 자동 검색을 지원하지 않는 사이트(수동 확인 필요)" });
    } else if (r.status === "error") {
      allRows.push({ shopId: r.shopId, shopName: r.shopName, candidate: null, note: `검색 실패: ${r.error ?? ""}` });
    } else if (r.candidates.length === 0) {
      allRows.push({ shopId: r.shopId, shopName: r.shopName, candidate: null, note: "일치하는 후보 없음" });
    } else {
      for (const c of r.candidates) {
        allRows.push({ shopId: r.shopId, shopName: r.shopName, candidate: c });
      }
    }
  }
  const exactRows = allRows.filter((row) => row.candidate && tierForCandidate(row.candidate) === "EXACT");
  const comparisonRows = allRows.filter((row) => row.candidate && tierForCandidate(row.candidate) === "COMPARISON");
  const hiddenRows = allRows.filter((row) => !row.candidate || tierForCandidate(row.candidate) === "EXCLUDED");
  if (exactRows.length === 0 && comparisonRows.length === 0) return null;
  const hiddenCount = hiddenRows.length;
  return (
    <div className="space-y-2">
      {exactRows.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-success">🟢 동일상품 확인</p>
          <CandidateRowTable rows={exactRows} />
        </div>
      )}
      {comparisonRows.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-warning">🟡 비교상품(참고용) — 식별자 근거 없이 상품명·브랜드만 유사</p>
          <CandidateRowTable rows={comparisonRows} />
        </div>
      )}
      {hiddenCount > 0 && (
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-xs text-primary underline hover:text-primary-hover"
          >
            {showAll ? "매칭 불확실 항목 접기" : `매칭 불확실/미지원/오류 ${hiddenCount}건 더 보기`}
          </button>
          {showAll && <CandidateRowTable rows={hiddenRows} />}
        </div>
      )}
    </div>
  );
}
