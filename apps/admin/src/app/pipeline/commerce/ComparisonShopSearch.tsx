"use client";

import { useEffect, useRef, useState } from "react";
import { countryToFlagEmoji } from "@commerce/shared";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";

type MatchLevel = "very_high" | "high" | "medium" | "low";

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

interface Candidate {
  title: string;
  url: string;
  price: { amount: number; currency: string } | null;
  imageUrl: string | null;
  confidence: number;
  matchLevel?: MatchLevel;
  /** N-3.11 Part C — 왜 이 등급인지(브랜드/모델명/SKU/URL slug 신호) 사람이 읽는 근거.
   * match.ts가 이미 계산해서 내려준다 — 여기서는 title에만 노출한다(확정 표현 남발 방지). */
  matchReasons?: string[];
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
      {results && <ResultHeadline results={results} />}
      {results && <ResultTable results={results} krwRates={krwRates} />}
      {results && <ResultBreakdown results={results} />}
    </CollapsibleSection>
  );
}

/** Sprint P2(CPO 지시, 2026-08-19: "검색 사이트 12 / 정상 12 / 후보 없음 7 /
 * 매칭 성공 0" 같은 raw count가 셀러에게 의미 없다 — 결과중심 메시지로") —
 * "몇 개 사이트를 뒤졌는지"가 아니라 "비교할 만한 상품을 찾았는지"만 먼저
 * 보여준다. 임계값은 CPO 지시(90% 이상만 노출) 그대로 confidence>=0.9를
 * 쓴다 — matchLevel 버킷(0.95/0.8/0.6)과는 다른 값이라 별도로 필터링한다.
 * confidence 자체(match.ts scoreCandidateMatch)는 이미 모델명/색상/SKU/
 * URL slug/브랜드 다중 신호를 결합한 composite score다 — 카테고리/이미지/
 * 옵션/가격 신호는 아직 candidate 데이터 자체에 없어(추출한 적 없음) 이번
 * UI 정리 범위에서는 추가하지 않는다(새 데이터 추출 파이프라인이 필요한
 * 별도 스코프 — CPO 확인 필요, 임의로 추측 신호를 넣지 않는다는 이 파일의
 * 기존 원칙과 같은 이유). */
function ResultHeadline({ results }: { results: SearchResult[] }) {
  const highConfidence = results.flatMap((r) =>
    r.candidates.filter((c) => c.confidence >= 0.9).map((c) => ({ ...c, shopName: r.shopName })),
  );
  if (highConfidence.length === 0) {
    return (
      <p className="rounded-md border border-border bg-background px-3 py-2 text-xs text-text-secondary">
        비교 가능한 동일/유사 상품을 찾지 못했습니다 — 아래 상세 통계에서 사이트별 상태를 확인할 수 있습니다.
      </p>
    );
  }
  return (
    <p className="rounded-md border border-success/30 bg-success-soft px-3 py-2 text-xs text-success">
      비교 가능한 동일/유사 상품이 {highConfidence.length}건 발견되었습니다 (매칭 신뢰도 90% 이상).
    </p>
  );
}

/** N-3.13 P0(CPO 지시) — "0건이면 결과 없음이라고만 하지 말고, 검색이 아예
 * 안 된 건지/사이트가 미지원인지/후보가 없는 건지/매칭에 실패한 건지 구분해서
 * 보여준다." curl로 백엔드가 동작하는 걸 이미 여러 번 확인한 것과 "CEO가 화면
 * 보고 뭐가 문제인지 알 수 있는 것"은 다른 문제라는 지적을 반영 — 신규 API 호출
 * 없이 기존 results 배열만으로 5개 지표를 계산한다.
 * Sprint P2(CPO 지시, 2026-08-19) — 이 raw count 자체가 "셀러에게 의미
 * 없다"는 지적을 받아 기본 화면에서는 숨기고, 접었다 펼 수 있는 "상세 통계"로
 * 내렸다(완전히 지우지는 않는다 — 검색이 왜 0건이었는지 진단할 때는 여전히
 * 필요한 정보라 N-3.13 P0의 원래 목적은 유지). */
function ResultBreakdown({ results }: { results: SearchResult[] }) {
  const total = results.length;
  const ok = results.filter((r) => r.status === "ok").length;
  const unsupported = results.filter((r) => r.status === "unsupported").length;
  const errored = results.filter((r) => r.status === "error").length;
  const noCandidates = results.filter((r) => r.status === "ok" && r.candidates.length === 0).length;
  const matched = results.reduce(
    (sum, r) => sum + r.candidates.filter((c) => c.matchLevel === "very_high" || c.matchLevel === "high").length,
    0,
  );
  return (
    <CollapsibleSection title="상세 통계" defaultOpen={false}>
      <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-background p-2 text-[11px] sm:grid-cols-5">
        <Stat label="검색한 사이트" value={total} />
        <Stat label="정상 응답" value={ok} />
        <Stat label="미지원/오류" value={unsupported + errored} />
        <Stat label="후보 없음" value={noCandidates} />
        <Stat label="매칭 성공(🟢)" value={matched} highlight={matched > 0} />
      </div>
    </CollapsibleSection>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <div className={`text-sm font-semibold ${highlight ? "text-success" : "text-text-primary"}`}>{value}</div>
      <div className="text-text-tertiary">{label}</div>
    </div>
  );
}

/** N-3.13 P0(CPO 지시) — "판매처/국가/상품/원본가격/통화/KRW/매칭상태" 컬럼의
 * 표로 재구성. 이전엔 사이트별 카드+리스트였는데, 여러 사이트 결과를 한눈에
 * 비교하기 어렵다는 지적을 반영해 후보 단위 한 행으로 펼친다(사이트에 후보가
 * 없거나 미지원/오류여도 그 사유가 보이는 한 행을 남긴다 — 조용히 사라지지 않게).
 * Sprint P2(CPO 지시, 2026-08-19: "90% 미만은 숨긴다") — 기본값은 confidence
 * >= 0.9인 행만 보여준다. 미지원/오류/후보없음/저매칭 행은 "전체 보기"를
 * 눌러야 보인다 — 완전히 삭제하지 않는다(N-3.13 P0가 이미 "조용히 사라지지
 * 않게"를 요구했었다, 그 원칙과 이번 CPO 지시를 둘 다 만족시키는 절충). */
function ResultTable({ results, krwRates }: { results: SearchResult[]; krwRates: Record<string, number> | null }) {
  const [showAll, setShowAll] = useState(false);
  type Row = { shopId: string; shopName: string; shopCountry?: string | null; candidate: Candidate | null; note?: string };
  const allRows: Row[] = [];
  for (const r of results) {
    if (r.status === "unsupported") {
      allRows.push({ shopId: r.shopId, shopName: r.shopName, shopCountry: r.shopCountry, candidate: null, note: "지원되지 않는 사이트" });
    } else if (r.status === "error") {
      allRows.push({ shopId: r.shopId, shopName: r.shopName, shopCountry: r.shopCountry, candidate: null, note: `검색 실패: ${r.error ?? ""}` });
    } else if (r.candidates.length === 0) {
      allRows.push({ shopId: r.shopId, shopName: r.shopName, shopCountry: r.shopCountry, candidate: null, note: "일치하는 후보 없음" });
    } else {
      for (const c of r.candidates) {
        allRows.push({ shopId: r.shopId, shopName: r.shopName, shopCountry: r.shopCountry, candidate: c });
      }
    }
  }
  const highConfidenceRows = allRows.filter((row) => (row.candidate?.confidence ?? 0) >= 0.9);
  const rows = showAll ? allRows : highConfidenceRows;
  const hiddenCount = allRows.length - highConfidenceRows.length;
  if (rows.length === 0 && !showAll) {
    return hiddenCount > 0 ? (
      <button
        type="button"
        onClick={() => setShowAll(true)}
        className="text-xs text-primary underline hover:text-primary-hover"
      >
        90% 미만 매칭/미지원/오류 {hiddenCount}건 보기
      </button>
    ) : null;
  }
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
      <table className="w-full min-w-[640px] border-collapse text-left text-[11px]">
        <thead>
          <tr className="border-b border-border bg-background text-text-secondary">
            <th className="px-2 py-1.5 font-medium">판매처</th>
            <th className="px-2 py-1.5 font-medium">국가</th>
            <th className="px-2 py-1.5 font-medium">상품</th>
            <th className="px-2 py-1.5 font-medium">원본가격</th>
            <th className="px-2 py-1.5 font-medium">KRW 환산</th>
            <th className="px-2 py-1.5 font-medium">매칭상태</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const c = row.candidate;
            const krwRate = c?.price ? krwRates?.[c.price.currency] : undefined;
            const krwAmount = c?.price && krwRate ? Math.round(c.price.amount * krwRate) : null;
            return (
              <tr key={`${row.shopId}-${i}`} className="border-b border-border align-top last:border-b-0">
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
                <td className="px-2 py-1.5 whitespace-nowrap text-text-secondary">
                  {c?.price ? `${c.price.amount.toFixed(2)} ${c.price.currency}` : "—"}
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap text-text-secondary">
                  {krwAmount != null ? `약 ₩${krwAmount.toLocaleString("ko-KR")}` : "—"}
                </td>
                <td className="px-2 py-1.5">
                  {c?.matchLevel ? (
                    <span
                      className={`inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${MATCH_LEVEL_BADGE_CLASS[c.matchLevel]}`}
                      title={`신뢰도 ${Math.round(c.confidence * 100)}%${c.matchReasons?.length ? " — " + c.matchReasons.join(", ") : ""}`}
                    >
                      {MATCH_LEVEL_ICON[c.matchLevel]}{" "}
                      {c.matchLevel === "very_high" || c.matchLevel === "high"
                        ? "동일상품"
                        : c.matchLevel === "medium"
                          ? "유사상품"
                          : "매칭 불확실"}
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
