"use client";

import { useEffect, useState } from "react";
import { priceAgeTier, priceLevelFromVerdict, type PriceAgeTier, type PriceLevel } from "@commerce/pricing";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";

interface SampleListing {
  mallName: string | null;
  priceKrw: number;
  productUrl: string | null;
  checkedAt: string;
}

/** N-4.07 Sprint(대표님 지시: "출처 + 가격 + 확인시간을 보여준다") — "2시간 전"/
 * "3일 전" 형태. 절대시각은 옆의 오래된 가격 배지/전체 마지막확인 문구가 이미
 * 보여주므로, 리스팅 한 줄에는 상대시간만 짧게 붙인다. */
function relativeTimeFromNow(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

/** N-4.11 STEP1(대표님 지시: "오늘 확인/1~6일/7~30일/30일+를 명확하게") — packages/pricing의
 * priceAgeTier(계산)를 화면 문구로만 옮긴다(새 판정 없음). */
const PRICE_AGE_LABEL: Record<PriceAgeTier, string> = {
  TODAY: "오늘 확인",
  RECENT: "최근 확인",
  STALE: "7일 이상 경과",
  VERY_STALE: "30일 이상 경과",
};

interface RecheckResult {
  icon: string;
  message: string;
}

/** N-4.11 STEP2 — /api/price-history/check 응답(run-price-check.ts의
 * PriceCheckPipelineStatus + run-domestic-price-check.ts 결과)을 판매자가
 * 이해할 수 있는 한 줄로 요약한다. */
function summarizeRecheckResult(json: {
  status?: string;
  savedCount?: number;
  domesticStatus?: string;
  domesticListingCount?: number;
  errors?: string[];
  domesticShop?: { pricesRecorded: number; sourceErrors: string[] };
}): RecheckResult {
  const domesticSaved = json.domesticShop?.pricesRecorded ?? 0;
  const totalSaved = (json.savedCount ?? 0) + domesticSaved;

  if (json.status === "SUCCESS") {
    return { icon: "🟢", message: `가격을 확인해 ${totalSaved}건 저장했습니다.` };
  }
  if (json.status === "PARTIAL") {
    if (json.domesticStatus === "NO_RESULTS" || (totalSaved > 0 && json.domesticListingCount === 0)) {
      return { icon: "🟡", message: "원가는 확인했지만, 일치하는 국내 판매처를 찾지 못했습니다(매칭 실패)." };
    }
    return { icon: "🟡", message: `일부만 확인됐습니다(${totalSaved}건 저장) — 나머지는 아래 이유로 실패했습니다.` };
  }
  if (json.status === "NOT_CONFIGURED") {
    return { icon: "⚪", message: "국내 가격 검색 설정이 아직 안 되어 있어 확인하지 못했습니다." };
  }
  if (json.status === "NO_RESULT") {
    return { icon: "⚪", message: "일치하는 가격 정보를 찾지 못했습니다(가격 없음)." };
  }
  return { icon: "🔴", message: json.errors?.[0] ?? "가격 확인 중 오류가 발생했습니다." };
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

/** N-4.07 Sprint(대표님 지시: "가격 위치 🟡 다소 높음"처럼 요약표 한 줄로) —
 * 새 판정을 만들지 않는다. computePriceDecision()이 이미 낸 verdict/gap을
 * 짧은 한 줄로만 다시 표현한다(자세한 문장은 decision.reason이 이미 있다). */
function priceLevelSummary(decision: Decision): string {
  if (decision.verdict === "MARGIN_RISK") return "🔴 마진 위험";
  if (decision.verdict === "CONSIDER_LOWER") {
    return `🟡 국내 평균보다 ${decision.priceGapVsAveragePercent}% 높음`;
  }
  return decision.priceGapVsAveragePercent != null ? "🟢 경쟁력 있음" : "🟢 적정 마진";
}

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
export type { PriceLevel };

export function DomesticPriceIntelligencePanel({
  snapshotId,
  onPriceLevelChange,
}: {
  snapshotId: string;
  /** N-4.08 STEP6-4와 같은 패턴(onReadinessChange) — 이 패널이 계산한 값을
   * CommerceWorkspace가 탭 배지/상태 요약에 캐싱해서 쓸 수 있게 보고한다. */
  onPriceLevelChange?: (level: PriceLevel) => void;
}) {
  const [data, setData] = useState<PriceHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [recheckResult, setRecheckResult] = useState<RecheckResult | null>(null);

  function loadPriceHistory(): Promise<void> {
    return fetch(`/api/price-history/${snapshotId}`)
      .then((res) => res.json())
      .then((json) => {
        setData(json.ok ? json : null);
      })
      .catch(() => {
        setData(null);
      });
  }

  useEffect(() => {
    setLoading(true);
    void loadPriceHistory().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotId]);

  useEffect(() => {
    if (loading) return;
    onPriceLevelChange?.(priceLevelFromVerdict(data?.decision?.verdict ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, data]);

  /** N-4.07 Sprint(대표님 지시: "상품 화면 [가격 다시 확인] 버튼") —
   * /api/price-history/check(기존, UI 연결처 없었음)를 그대로 호출한다.
   * skipIfCheckedToday는 이 경로에서는 안 준다 — 사용자가 명시적으로 "지금
   * 확인"을 눌렀으므로 오늘 이미 확인했어도 다시 시도하는 게 맞다.
   *
   * N-4.11 STEP2(대표님 지시: "검색→매칭→저장을 판매자가 알 수 있게, 성공/
   * 실패/가격없음/매칭실패를 구분") — run-price-check.ts/run-domestic-
   * price-check.ts가 이미 계산해 돌려주는 status/domesticStatus/savedCount/
   * domesticListingCount를 그대로 문장으로 옮긴다. 새 판정을 만들지 않는다 —
   * 서버가 이미 낸 결론을 화면에 정직하게 보여주기만 한다(가짜 진행률 애니
   * 메이션을 만들지 않는다 — 실제로는 서버가 한 번에 처리하는 요청이다). */
  async function recheckNow() {
    if (rechecking) return; // 중복 클릭 방지 — 버튼도 disabled지만 방어적으로 한 번 더 막는다.
    setRechecking(true);
    setRecheckResult(null);
    try {
      const res = await fetch("/api/price-history/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId }),
      });
      if (!res.ok) {
        setRecheckResult({ icon: "🔴", message: "가격 확인 요청이 실패했습니다(서버 오류)." });
      } else {
        const json = (await res.json()) as {
          status?: string;
          savedCount?: number;
          domesticStatus?: string;
          domesticListingCount?: number;
          errors?: string[];
          domesticShop?: { pricesRecorded: number; sourceErrors: string[] };
        };
        setRecheckResult(summarizeRecheckResult(json));
      }
      await loadPriceHistory();
    } catch {
      setRecheckResult({ icon: "🔴", message: "가격 확인 요청이 실패했습니다(네트워크 오류)." });
    } finally {
      setRechecking(false);
    }
  }

  if (loading) return null;
  if (!data) return null;

  const { domesticCompetition, currentPrice, cost, fx, decision, recommendation } = data;
  const domesticShopHistory = data.priceHistory?.domesticShop ?? null;
  const trend7d = domesticShopHistory?.trend7d ?? null;
  const trend30d = domesticShopHistory?.trend30d ?? null;
  const historyRecords = domesticShopHistory?.records ?? [];

  const hasAnyData =
    domesticCompetition.tier !== "NONE" || currentPrice.sellingPriceKrw != null || cost != null;

  return (
    <CollapsibleSection title="가격 판단 (베타)" defaultOpen>
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-text-tertiary">{hasAnyData ? "" : "아직 확인된 가격 정보가 없습니다."}</span>
          <button
            type="button"
            onClick={() => void recheckNow()}
            disabled={rechecking}
            className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-text-secondary hover:bg-background disabled:opacity-50"
          >
            {rechecking ? "확인 중..." : "가격 다시 확인"}
          </button>
        </div>
        {recheckResult && (
          <p className="rounded-md border border-border bg-background px-2 py-1 text-[11px] text-text-secondary">
            {recheckResult.icon} {recheckResult.message}
          </p>
        )}
        {!hasAnyData && (
          <p className="text-[10px] text-text-tertiary">
            원본 사이트/등록된 국내 편집샵에서 가격을 조회합니다 — 몇 초 걸릴 수 있습니다.
          </p>
        )}
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

        {/* N-4.07 Sprint(대표님 지시: "국내최저가/평균가/내판매가/예상마진/가격위치를
            표로 한눈에") — 새 계산이 아니라 이미 위/아래에서 쓰는 domesticCompetition/
            currentPrice/decision 값을 요약표 형태로만 다시 배치한다. */}
        {(domesticCompetition.tier !== "NONE" || currentPrice.sellingPriceKrw != null) && (
          <table className="w-full border-collapse overflow-hidden rounded-md border border-border">
            <tbody>
              {domesticCompetition.lowestPriceKrw != null && (
                <tr className="border-b border-border">
                  <td className="bg-background px-2 py-1 text-text-tertiary">국내 최저가</td>
                  <td className="px-2 py-1 text-right font-medium text-text-primary">
                    ₩{domesticCompetition.lowestPriceKrw.toLocaleString()}
                  </td>
                </tr>
              )}
              {domesticCompetition.averagePriceKrw != null && (
                <tr className="border-b border-border">
                  <td className="bg-background px-2 py-1 text-text-tertiary">국내 평균가</td>
                  <td className="px-2 py-1 text-right font-medium text-text-primary">
                    ₩{Math.round(domesticCompetition.averagePriceKrw).toLocaleString()}
                  </td>
                </tr>
              )}
              {currentPrice.sellingPriceKrw != null && (
                <tr className="border-b border-border">
                  <td className="bg-background px-2 py-1 text-text-tertiary">내 판매가</td>
                  <td className="px-2 py-1 text-right font-medium text-text-primary">
                    ₩{currentPrice.sellingPriceKrw.toLocaleString()}
                  </td>
                </tr>
              )}
              {decision && (
                <tr className="border-b border-border">
                  <td className="bg-background px-2 py-1 text-text-tertiary">예상 마진</td>
                  <td className="px-2 py-1 text-right font-medium text-text-primary">{decision.marginPercent}%</td>
                </tr>
              )}
              {decision && (
                <tr>
                  <td className="bg-background px-2 py-1 text-text-tertiary">가격 위치</td>
                  <td className="px-2 py-1 text-right font-medium text-text-primary">
                    {priceLevelSummary(decision)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
              {domesticCompetition.sampleListings.slice(0, 5).map((listing, i) => {
                const tier = priceAgeTier(listing.checkedAt);
                return (
                  <li key={i} className="flex items-center justify-between text-text-secondary">
                    <span className="flex items-center gap-1">
                      {listing.mallName ?? "알 수 없음"}
                      {(tier === "STALE" || tier === "VERY_STALE") && (
                        <span className="rounded bg-warning-soft px-1 py-0.5 text-[9px] font-medium text-warning">
                          🟡 {PRICE_AGE_LABEL[tier]}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {listing.productUrl ? (
                        <a href={listing.productUrl} target="_blank" rel="noreferrer" className="text-text-primary underline">
                          ₩{listing.priceKrw.toLocaleString()}
                        </a>
                      ) : (
                        <span className="text-text-primary">₩{listing.priceKrw.toLocaleString()}</span>
                      )}
                      <span className="text-[10px] text-text-tertiary">· {relativeTimeFromNow(listing.checkedAt)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-1.5 flex gap-3 border-t border-border pt-1.5 text-text-secondary">
              {domesticCompetition.lowestPriceKrw != null && (
                <span>국내 최저가 ₩{domesticCompetition.lowestPriceKrw.toLocaleString()}</span>
              )}
              {domesticCompetition.averagePriceKrw != null && (
                <span>국내 평균가 ₩{Math.round(domesticCompetition.averagePriceKrw).toLocaleString()}</span>
              )}
            </div>
            {domesticCompetition.checkedAt &&
              (() => {
                const overallTier = priceAgeTier(domesticCompetition.checkedAt);
                return (
                  <>
                    <p className="mt-1 text-[10px] text-text-tertiary">
                      마지막 확인 {new Date(domesticCompetition.checkedAt).toLocaleString("ko-KR")} (
                      {PRICE_AGE_LABEL[overallTier]})
                    </p>
                    {(overallTier === "STALE" || overallTier === "VERY_STALE") && (
                      <p className="mt-1 rounded-md bg-warning-soft px-2 py-1 text-[11px] font-medium text-warning">
                        ⚠️ 최근 가격이 아닙니다. 다시 확인하세요.
                      </p>
                    )}
                  </>
                );
              })()}
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
          참고용 판단입니다 — 판매가는 자동으로 변경되지 않으며, 최종 결정은 직접 내려야 합니다. 가격경쟁력은
          등록 가능 여부와 무관합니다 — 마진이 낮거나 가격이 높아도 등록 자체는 막히지 않습니다.
        </p>
      </div>
    </CollapsibleSection>
  );
}
