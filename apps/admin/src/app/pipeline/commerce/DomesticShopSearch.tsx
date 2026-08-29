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

/** P-7-B(CPO 지시, 2026-08-29) — 실측 골든케이스(Pepe Shoes): 텍스트 유사도만으로는
 * 진짜 동일상품(포레포레 71%)과 실제로는 다른 상품(듀베베 72%)이 똑같은 "유사상품"
 * 배지로 보였다. matchTruth(상품코드/모델번호 증거로 보강된 판정)가 있으면 그걸
 * 우선 배지로 쓰고, 없으면(구버전 응답 등) 기존 matchLevel 배지로 그대로 폴백한다 —
 * 하위호환, 회귀 없음. */
type MatchTruth = "EXACT_IDENTIFIER" | "STRONG_IDENTIFIER" | "TEXT_CONFIRMED" | "SIMILAR" | "CONFLICT" | "INSUFFICIENT_EVIDENCE";

const MATCH_TRUTH_BADGE: Record<MatchTruth, { icon: string; label: string; className: string; disclaimer?: string }> = {
  EXACT_IDENTIFIER: { icon: "🟢", label: "동일상품 확인", className: "bg-success-soft text-success" },
  STRONG_IDENTIFIER: { icon: "🟢", label: "동일상품 확인", className: "bg-success-soft text-success" },
  TEXT_CONFIRMED: { icon: "🟢", label: "동일상품 가능성 높음", className: "bg-success-soft text-success" },
  SIMILAR: {
    icon: "🟡",
    label: "유사상품",
    className: "bg-warning-soft text-warning",
    disclaimer: "동일 상품이 아닐 수 있습니다 — 가격은 참고용으로만 사용하세요.",
  },
  CONFLICT: {
    icon: "⚠️",
    label: "다른 상품일 가능성",
    className: "bg-error-soft text-error",
    disclaimer: "상품코드가 원본과 일치하지 않습니다 — 동일상품이 아닐 가능성이 높습니다.",
  },
  INSUFFICIENT_EVIDENCE: { icon: "⚪", label: "매칭 불확실", className: "bg-background text-text-tertiary" },
};

interface Candidate {
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

/** N-4.21(대표님 지시, 2026-08-26: "유사 상품까진 인정") — ComparisonShopSearch(해외)와
 * 같은 이유로 기본 노출 기준을 confidence>=0.9에서 matchLevel!=="low"(70% 경계,
 * match.ts 기존 승인 기준)로 낮춘다. */
function ResultHeadline({ results }: { results: SearchResult[] }) {
  const acceptable = results.flatMap((r) =>
    r.candidates.filter((c) => c.matchLevel && c.matchLevel !== "low").map((c) => ({ ...c, shopName: r.shopName })),
  );
  if (acceptable.length === 0) {
    return (
      <p className="rounded-md border border-border bg-background px-3 py-2 text-xs text-text-secondary">
        비교 가능한 동일/유사 상품을 국내 편집샵에서 찾지 못했습니다.
      </p>
    );
  }
  return (
    <p className="rounded-md border border-success/30 bg-success-soft px-3 py-2 text-xs text-success">
      국내 편집샵에서 비교 가능한 동일/유사 상품이 {acceptable.length}건 발견되었습니다 (매칭 신뢰도 70%
      이상).
    </p>
  );
}

function ResultTable({ results }: { results: SearchResult[] }) {
  const [showAll, setShowAll] = useState(false);
  type Row = { shopId: string; shopName: string; candidate: Candidate | null; note?: string };
  const allRows: Row[] = [];
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
  const acceptableRows = allRows.filter((row) => row.candidate?.matchLevel && row.candidate.matchLevel !== "low");
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
          {showAll ? "매칭 불확실 항목 접기" : `매칭 불확실/미지원/오류 ${hiddenCount}건 더 보기`}
        </button>
      )}
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
                          title={c.matchReasons?.length ? c.matchReasons.join(", ") : undefined}
                        >
                          {MATCH_TRUTH_BADGE[c.matchTruth].icon} {MATCH_TRUTH_BADGE[c.matchTruth].label}{" "}
                          {Math.round(c.confidence * 100)}%
                        </span>
                        {MATCH_TRUTH_BADGE[c.matchTruth].disclaimer && (
                          <p className="text-[10px] text-text-tertiary">※ {MATCH_TRUTH_BADGE[c.matchTruth].disclaimer}</p>
                        )}
                      </div>
                    ) : c?.matchLevel ? (
                      <span
                        className={`inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${MATCH_LEVEL_BADGE_CLASS[c.matchLevel]}`}
                        title={c.matchReasons?.length ? c.matchReasons.join(", ") : undefined}
                      >
                        {MATCH_LEVEL_ICON[c.matchLevel]}{" "}
                        {c.matchLevel === "very_high" || c.matchLevel === "high"
                          ? "동일상품"
                          : c.matchLevel === "medium"
                            ? "유사상품"
                            : "매칭 불확실"}{" "}
                        {Math.round(c.confidence * 100)}%
                      </span>
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
    </div>
  );
}
