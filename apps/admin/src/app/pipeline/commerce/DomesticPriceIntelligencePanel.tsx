"use client";

import { useEffect, useState } from "react";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";

interface SampleListing {
  sourceLabel: string | null;
  priceKrw: number;
  sourceProductUrl: string | null;
  checkedAt: string;
}

interface DomesticCompetition {
  tier: "PRIMARY" | "SECONDARY" | "NONE";
  lowestPriceKrw: number | null;
  highestPriceKrw: number | null;
  averagePriceKrw: number | null;
  sellerCount: number;
  sampleListings: SampleListing[];
  checkedAt: string | null;
}

interface Decision {
  verdict: "MAINTAIN" | "CONSIDER_LOWER" | "MARGIN_RISK";
  marginPercent: number;
  priceGapVsAveragePercent: number | null;
  reason: string;
}

interface Recommendation {
  minimumPrice: number;
  targetPrice: number;
  competitivePrice: number | null;
  recommendedPrice: number;
}

interface PriceHistoryResponse {
  ok: boolean;
  product: { title: string; brand: string; sourceUrl: string };
  currentPrice: { sellingPriceKrw: number | null; costPriceKrw: number | null };
  domesticCompetition: DomesticCompetition;
  priceHistory: {
    domesticShop: { trend7d: { changeRate: number | null } | null };
  };
  fx: { rate: number; isEstimate: boolean } | null;
  cost: { originalAmount: number; originalCurrency: string; landedCostKrw: number } | null;
  decision: Decision | null;
  recommendation: Recommendation | null;
}

const VERDICT_LABEL: Record<Decision["verdict"], { icon: string; label: string; className: string }> = {
  MAINTAIN: { icon: "🟢", label: "유지", className: "bg-success-soft text-success" },
  CONSIDER_LOWER: { icon: "🟡", label: "조정 검토", className: "bg-warning-soft text-warning" },
  MARGIN_RISK: { icon: "🔴", label: "마진 위험", className: "bg-error-soft text-error" },
};

/** N-4.07 2차(대표님 지시: "해외 원가 → 환율 → 국내 경쟁가 → 내 판매가 → 예상 마진을
 * 한 번에 판단") — /api/price-history/[snapshotId]가 이미 계산해둔 값(cost/
 * domesticCompetition/decision/recommendation)을 그대로 화면에 옮기기만 한다.
 * 새 판정 로직을 만들지 않는다 — computePriceDecision/computePriceRecommendation을
 * 그대로 재사용(이 프로젝트의 반복 원칙).
 *
 * 절대 금지(작업지시서 Part 14) — 여기서 판매가를 자동으로 바꾸지 않는다.
 * 읽기 전용 판단 화면이다. */
export function DomesticPriceIntelligencePanel({ snapshotId }: { snapshotId: string }) {
  const [data, setData] = useState<PriceHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/price-history/${snapshotId}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setData(json.ok ? json : null);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [snapshotId]);

  if (loading) return null;
  if (!data) return null;

  const { domesticCompetition, currentPrice, cost, fx, decision, recommendation } = data;
  const trend7d = data.priceHistory?.domesticShop?.trend7d ?? null;

  const hasAnyData =
    domesticCompetition.tier !== "NONE" || currentPrice.sellingPriceKrw != null || cost != null;
  if (!hasAnyData) return null;

  return (
    <CollapsibleSection title="가격 판단 (베타)" defaultOpen>
      <div className="space-y-2 text-xs">
        {cost && fx && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-text-secondary">
            <span>
              해외 원가 {cost.originalAmount.toLocaleString()} {cost.originalCurrency}
            </span>
            <span>·</span>
            <span>
              환율 ₩{Math.round(fx.rate).toLocaleString()}
              {fx.isEstimate ? "(추정)" : ""}
            </span>
            <span>·</span>
            <span>착지원가 ₩{Math.round(cost.landedCostKrw).toLocaleString()}</span>
          </div>
        )}

        {domesticCompetition.tier !== "NONE" && (
          <div className="rounded-md border border-border bg-background p-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-medium text-text-primary">
                국내 동일상품 ({domesticCompetition.sellerCount}곳
                {domesticCompetition.tier === "SECONDARY" ? " · 참고가격(검증 전)" : ""})
              </span>
              {trend7d?.changeRate != null && (
                <span className={trend7d.changeRate < 0 ? "text-success" : trend7d.changeRate > 0 ? "text-error" : "text-text-tertiary"}>
                  최근 7일 {trend7d.changeRate > 0 ? "▲" : trend7d.changeRate < 0 ? "▼" : ""}
                  {Math.abs(trend7d.changeRate)}%
                </span>
              )}
            </div>
            <ul className="space-y-0.5">
              {domesticCompetition.sampleListings.slice(0, 5).map((listing, i) => (
                <li key={i} className="flex items-center justify-between text-text-secondary">
                  <span>{listing.sourceLabel ?? "알 수 없음"}</span>
                  {listing.sourceProductUrl ? (
                    <a href={listing.sourceProductUrl} target="_blank" rel="noreferrer" className="text-text-primary underline">
                      ₩{listing.priceKrw.toLocaleString()}
                    </a>
                  ) : (
                    <span className="text-text-primary">₩{listing.priceKrw.toLocaleString()}</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-1.5 flex gap-3 border-t border-border pt-1.5 text-text-secondary">
              {domesticCompetition.lowestPriceKrw != null && (
                <span>국내 최저가 ₩{domesticCompetition.lowestPriceKrw.toLocaleString()}</span>
              )}
              {domesticCompetition.averagePriceKrw != null && (
                <span>국내 평균가 ₩{Math.round(domesticCompetition.averagePriceKrw).toLocaleString()}</span>
              )}
            </div>
            {domesticCompetition.checkedAt && (
              <p className="mt-1 text-[10px] text-text-tertiary">
                마지막 확인 {new Date(domesticCompetition.checkedAt).toLocaleString("ko-KR")}
              </p>
            )}
          </div>
        )}

        {currentPrice.sellingPriceKrw != null && (
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">내 판매가</span>
            <span className="font-medium text-text-primary">₩{currentPrice.sellingPriceKrw.toLocaleString()}</span>
          </div>
        )}

        {recommendation && (
          <div className="flex items-center justify-between text-text-secondary">
            <span>추천 판매가(참고용)</span>
            <span>₩{recommendation.recommendedPrice.toLocaleString()}</span>
          </div>
        )}

        {decision && (
          <div className="rounded-md border border-border p-2">
            <div className="mb-1 flex items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${VERDICT_LABEL[decision.verdict].className}`}
              >
                {VERDICT_LABEL[decision.verdict].icon} {VERDICT_LABEL[decision.verdict].label}
              </span>
              <span className="text-text-tertiary">예상 마진 {decision.marginPercent}%</span>
            </div>
            <p className="text-text-secondary">{decision.reason}</p>
          </div>
        )}

        <p className="text-[10px] text-text-tertiary">
          참고용 판단입니다 — 판매가는 자동으로 변경되지 않으며, 최종 결정은 직접 내려야 합니다.
        </p>
      </div>
    </CollapsibleSection>
  );
}
