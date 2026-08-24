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

interface Candidate {
  title: string;
  url: string;
  price: { amount: number; currency: string } | null;
  imageUrl: string | null;
  confidence: number;
  matchLevel?: MatchLevel;
  matchReasons?: string[];
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
 * 배지 + 90% 미만 접기)을 그대로 따른다. 국내 소스는 이미 KRW로만 표시되므로 환율 변환
 * 컬럼이 없다는 것만 다르다. 여기도 "가장 싼 가격을 자동으로 원본가격에 반영" 금지 원칙은
 * 동일하게 적용 — 읽기 전용 조회다. */
export function DomesticShopSearch({
  title,
  brand,
  sourceUrl,
  sku,
}: {
  title: string;
  brand?: string;
  sourceUrl?: string;
  sku?: string;
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
        body: JSON.stringify({ title, brand, sourceUrl, sku }),
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

function ResultHeadline({ results }: { results: SearchResult[] }) {
  const highConfidence = results.flatMap((r) =>
    r.candidates.filter((c) => c.confidence >= 0.9).map((c) => ({ ...c, shopName: r.shopName })),
  );
  if (highConfidence.length === 0) {
    return (
      <p className="rounded-md border border-border bg-background px-3 py-2 text-xs text-text-secondary">
        비교 가능한 동일/유사 상품을 국내 편집샵에서 찾지 못했습니다.
      </p>
    );
  }
  return (
    <p className="rounded-md border border-success/30 bg-success-soft px-3 py-2 text-xs text-success">
      국내 편집샵에서 비교 가능한 동일/유사 상품이 {highConfidence.length}건 발견되었습니다 (매칭 신뢰도 90%
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
  const highConfidenceRows = allRows.filter((row) => (row.candidate?.confidence ?? 0) >= 0.9);
  if (highConfidenceRows.length === 0) return null;
  const rows = showAll ? allRows : highConfidenceRows;
  const hiddenCount = allRows.length - highConfidenceRows.length;
  return (
    <div className="space-y-1.5">
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="text-xs text-primary underline hover:text-primary-hover"
        >
          {showAll ? "90% 이상만 보기" : `90% 미만 매칭/미지원/오류 ${hiddenCount}건 더 보기`}
        </button>
      )}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[560px] border-collapse text-left text-[11px]">
          <thead>
            <tr className="border-b border-border bg-background text-text-secondary">
              <th className="px-2 py-1.5 font-medium">판매처</th>
              <th className="px-2 py-1.5 font-medium">상품</th>
              <th className="px-2 py-1.5 font-medium">가격</th>
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
                  <td className="px-2 py-1.5 whitespace-nowrap text-text-secondary">
                    {c?.price ? `₩${c.price.amount.toLocaleString("ko-KR")}` : "—"}
                  </td>
                  <td className="px-2 py-1.5">
                    {c?.matchLevel ? (
                      <span
                        className={`inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${MATCH_LEVEL_BADGE_CLASS[c.matchLevel]}`}
                        title={`신뢰도 ${Math.round(c.confidence * 100)}%${c.matchReasons?.length ? " — " + c.matchReasons.join(", ") : ""}`}
                      >
                        {MATCH_LEVEL_ICON[c.matchLevel]}{" "}
                        {c.matchLevel === "very_high" || c.matchLevel === "high"
                          ? "동일상품 확정"
                          : c.matchLevel === "medium"
                            ? "동일상품 가능성 높음"
                            : "확인 필요"}
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
