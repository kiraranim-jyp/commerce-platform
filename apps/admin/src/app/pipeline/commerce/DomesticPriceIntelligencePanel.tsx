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

interface PriceHistoryRecord {
  checkedAt: string;
  priceKrw: number;
}

interface PriceTrend {
  changeRate: number | null;
}

interface PriceHistoryResponse {
  ok: boolean;
  product: { title: string; brand: string; sourceUrl: string };
  currentPrice: { sellingPriceKrw: number | null; costPriceKrw: number | null };
  domesticCompetition: DomesticCompetition;
  priceHistory: {
    domesticShop: { records: PriceHistoryRecord[]; trend7d: PriceTrend | null; trend30d: PriceTrend | null };
  };
  fx: { rate: number; isEstimate: boolean } | null;
  cost: { originalAmount: number; originalCurrency: string; landedCostKrw: number } | null;
  decision: Decision | null;
  recommendation: Recommendation | null;
}

const VERDICT_LABEL: Record<Decision["verdict"], { icon: string; label: string; className: string; title: string; action: string }> = {
  MAINTAIN: {
    icon: "🟢",
    label: "유지",
    className: "bg-success-soft text-success",
    title: "적정 가격입니다",
    action: "→ 현재 가격 유지",
  },
  CONSIDER_LOWER: {
    icon: "🟡",
    label: "조정 검토",
    className: "bg-warning-soft text-warning",
    title: "국내 최저가 대비 판매가가 높습니다",
    action: "→ 가격 조정 검토",
  },
  MARGIN_RISK: {
    icon: "🔴",
    label: "마진 위험",
    className: "bg-error-soft text-error",
    title: "예상 마진이 낮습니다",
    action: "→ 원가/판매가 재검토 필요",
  },
};

function TrendBadge({ label, trend }: { label: string; trend: PriceTrend | null }) {
  if (!trend || trend.changeRate == null) return null;
  const rate = trend.changeRate;
  return (
    <span className={rate < 0 ? "text-success" : rate > 0 ? "text-error" : "text-text-tertiary"}>
      {label} {rate > 0 ? "▲" : rate < 0 ? "▼" : ""}
      {Math.abs(rate)}%
    </span>
  );
}

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
  const [showHistory, setShowHistory] = useState(false);

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
  const domesticShopHistory = data.priceHistory?.domesticShop ?? null;
  const trend7d = domesticShopHistory?.trend7d ?? null;
  const trend30d = domesticShopHistory?.trend30d ?? null;
  const historyRecords = domesticShopHistory?.records ?? [];

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
              <div className="flex items-center gap-2">
                <TrendBadge label="7일" trend={trend7d} />
                <TrendBadge label="30일" trend={trend30d} />
              </div>
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
            {historyRecords.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowHistory((v) => !v)}
                  className="mt-1.5 text-[11px] text-primary hover:underline"
                >
                  {showHistory ? "가격 변동 이력 접기" : `가격 변동 이력 보기 (${historyRecords.length}건)`}
                </button>
                {showHistory && (
                  <ul className="mt-1.5 space-y-0.5 border-t border-border pt-1.5">
                    {historyRecords.slice(0, 30).map((r, i) => (
                      <li key={i} className="flex items-center justify-between text-text-secondary">
                        <span>{new Date(r.checkedAt).toLocaleDateString("ko-KR")}</span>
                        <span className="text-text-primary">₩{r.priceKrw.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}

        {!decision && currentPrice.sellingPriceKrw != null && (
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
          <div className={`rounded-md border border-border p-2.5 ${VERDICT_LABEL[decision.verdict].className}`}>
            <p className="font-medium">
              {VERDICT_LABEL[decision.verdict].icon} {VERDICT_LABEL[decision.verdict].title}
            </p>
            <ul className="mt-1.5 space-y-0.5 text-text-secondary">
              {domesticCompetition.lowestPriceKrw != null && (
                <li>현재 국내 최저가 ₩{domesticCompetition.lowestPriceKrw.toLocaleString()}</li>
              )}
              {currentPrice.sellingPriceKrw != null && (
                <li>내 판매가 ₩{currentPrice.sellingPriceKrw.toLocaleString()}</li>
              )}
              <li>예상 마진 {decision.marginPercent}%</li>
            </ul>
            <p className="mt-1.5 font-medium">{VERDICT_LABEL[decision.verdict].action}</p>
            <p className="mt-1 text-[11px] text-text-tertiary">{decision.reason}</p>
          </div>
        )}

        <p className="text-[10px] text-text-tertiary">
          참고용 판단입니다 — 판매가는 자동으로 변경되지 않으며, 최종 결정은 직접 내려야 합니다.
        </p>
      </div>
    </CollapsibleSection>
  );
}
