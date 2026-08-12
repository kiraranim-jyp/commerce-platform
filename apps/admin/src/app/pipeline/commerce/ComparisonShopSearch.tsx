"use client";

import { useState } from "react";
import { CollapsibleSection } from "./CollapsibleSection";

type MatchLevel = "very_high" | "high" | "medium" | "low";

const MATCH_LEVEL_LABEL: Record<MatchLevel, string> = {
  very_high: "동일상품 가능성 매우 높음",
  high: "동일상품 가능성 높음",
  medium: "유사상품 · 확인 필요",
  low: "관련상품 · 매칭 불확실",
};

/** N-3.10 Part K — "상품명만 같다고 동일상품 태그 금지" 원칙에 따라, high 이상만
 * "동일상품"으로 부르고 medium/low는 "유사상품"/"참고"로만 표시한다(색상도 다르게
 * 구분 — 초록=동일상품, 노랑=유사상품, 회색=참고). matchLevel 자체는 packages/
 * crawler의 match.ts(브랜드/모델명/SKU/URL slug 신호 기반 규칙 스코어러, AI 아님)가
 * 이미 계산해서 내려준다 — 이 컴포넌트는 등급을 색으로 옮기기만 한다. */
const MATCH_LEVEL_BADGE_CLASS: Record<MatchLevel, string> = {
  very_high: "bg-success-soft text-success",
  high: "bg-success-soft text-success",
  medium: "bg-warning-soft text-warning",
  low: "bg-background text-text-tertiary",
};

function flagFor(country: string | null | undefined): string {
  if (!country) return "🌐";
  const codePoints = [...country.toUpperCase()].map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

interface Candidate {
  title: string;
  url: string;
  price: { amount: number; currency: string } | null;
  imageUrl: string | null;
  confidence: number;
  matchLevel?: MatchLevel;
  priceSource?: "detail" | "search" | null;
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
}: {
  title: string;
  brand?: string;
  sourceUrl?: string;
  sku?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [krwRates, setKrwRates] = useState<Record<string, number> | null>(null);
  const [queriedAt, setQueriedAt] = useState<string | null>(null);

  async function runSearch() {
    setLoading(true);
    setError(null);
    try {
      const [searchRes, ratesRes] = await Promise.all([
        fetch("/api/comparison/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, brand, sourceUrl, sku }),
        }),
        // N-3.10 Part L — 원본가격 옆에 KRW 환산도 같이 보여준다. PriceEditor가
        // 이미 쓰는 것과 같은 /api/exchange-rates를 그대로 재사용한다(별도
        // 환율 로직을 새로 만들지 않는다).
        fetch("/api/exchange-rates").catch(() => null),
      ]);
      const data = (await searchRes.json()) as { ok: boolean; results?: SearchResult[]; error?: string };
      if (!data.ok) {
        setError(data.error ?? "검색에 실패했습니다.");
        return;
      }
      setResults(data.results ?? []);
      setQueriedAt(new Date().toLocaleString("ko-KR"));
      if (ratesRes?.ok) {
        const ratesData = (await ratesRes.json()) as { rates?: Record<string, number> };
        if (ratesData.rates) setKrwRates(ratesData.rates);
      }
    } catch {
      setError("검색 요청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <CollapsibleSection title="해외 가격비교 (베타)">
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
      {results && (
        <div className="space-y-3">
          {results.map((r) => (
            <div key={r.shopId} className="rounded-md border border-border p-2">
              <div className="text-xs font-medium text-text-primary">
                {flagFor(r.shopCountry)} {r.shopName}
                {!r.shopCountry && (
                  <span className="ml-1 text-[10px] font-normal text-text-tertiary">(원본 국가 확인 불가)</span>
                )}
              </div>
              {r.status === "unsupported" && (
                <p className="text-[11px] text-text-tertiary">지원되지 않는 사이트입니다.</p>
              )}
              {r.status === "error" && <p className="text-[11px] text-error">검색 실패: {r.error}</p>}
              {r.status === "ok" && r.candidates.length === 0 && (
                <p className="text-[11px] text-text-tertiary">일치하는 후보가 없습니다.</p>
              )}
              {r.status === "ok" && r.candidates.length > 0 && (
                <ul className="mt-1 space-y-1">
                  {r.candidates.map((c) => {
                    const krwRate = c.price ? krwRates?.[c.price.currency] : undefined;
                    const krwAmount = c.price && krwRate ? Math.round(c.price.amount * krwRate) : null;
                    return (
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
                            {krwAmount != null && (
                              <span className="ml-1 text-text-tertiary">(약 ₩{krwAmount.toLocaleString("ko-KR")})</span>
                            )}
                            {c.priceSource === "detail" && (
                              <span className="ml-1 text-[10px] text-success" title="상품 상세 페이지에서 확인한 가격">
                                ✓ 상품 상세 확인
                              </span>
                            )}
                            {c.priceSource === "search" && (
                              <span className="ml-1 text-[10px] text-text-tertiary" title="검색 결과에서 가져온 가격(참고용)">
                                검색 결과 가격
                              </span>
                            )}
                          </span>
                        )}
                        {c.matchLevel && (
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${MATCH_LEVEL_BADGE_CLASS[c.matchLevel]}`}
                            title={`신뢰도 ${Math.round(c.confidence * 100)}%`}
                          >
                            {c.matchLevel === "very_high" || c.matchLevel === "high" ? "🟢 동일상품" : c.matchLevel === "medium" ? "🟡 유사상품" : "참고"}
                            {" · "}
                            {MATCH_LEVEL_LABEL[c.matchLevel]}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
