"use client";

import { useState } from "react";
import { CollapsibleSection } from "./CollapsibleSection";

interface Candidate {
  title: string;
  url: string;
  price: { amount: number; currency: string } | null;
  imageUrl: string | null;
  confidence: number;
}

interface SearchResult {
  shopId: string;
  shopName: string;
  domain: string;
  status: "ok" | "unsupported" | "error";
  candidates: Candidate[];
  error?: string;
}

/** Sprint B-1 Phase 1 — 해외 편집샵 가격비교. 기존 등록 흐름과 완전히 분리된 추가 조회 기능이라
 * 필수/선택 입력 Accordion(sectionProps/sectionCompletionBadge) 체계에는 엮지 않는다. */
export function ComparisonShopSearch({ title, brand }: { title: string; brand?: string }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runSearch() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/comparison/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, brand }),
      });
      const data = (await res.json()) as { ok: boolean; results?: SearchResult[]; error?: string };
      if (!data.ok) {
        setError(data.error ?? "검색에 실패했습니다.");
        return;
      }
      setResults(data.results ?? []);
    } catch {
      setError("검색 요청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <CollapsibleSection title="해외 가격비교 (베타)">
      <p className="text-xs text-text-tertiary">
        활성화된 해외 편집샵에서 유사 상품을 검색합니다. 등록 정보에는 영향을 주지 않습니다.
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
      {results && (
        <div className="space-y-3">
          {results.map((r) => (
            <div key={r.shopId} className="rounded-md border border-border p-2">
              <div className="text-xs font-medium text-text-primary">{r.shopName}</div>
              {r.status === "unsupported" && (
                <p className="text-[11px] text-text-tertiary">지원되지 않는 사이트입니다.</p>
              )}
              {r.status === "error" && <p className="text-[11px] text-error">검색 실패: {r.error}</p>}
              {r.status === "ok" && r.candidates.length === 0 && (
                <p className="text-[11px] text-text-tertiary">일치하는 후보가 없습니다.</p>
              )}
              {r.status === "ok" && r.candidates.length > 0 && (
                <ul className="mt-1 space-y-1">
                  {r.candidates.map((c) => (
                    <li key={c.url} className="flex items-center gap-2 text-[11px]">
                      {c.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.imageUrl} alt="" className="h-8 w-8 rounded object-cover" />
                      )}
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 truncate text-text-primary underline"
                      >
                        {c.title}
                      </a>
                      {c.price && (
                        <span className="text-text-secondary">
                          {c.price.amount.toFixed(2)} {c.price.currency}
                        </span>
                      )}
                      <span className="text-text-tertiary">신뢰도 {Math.round(c.confidence * 100)}%</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
