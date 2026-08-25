"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { priceAgeTier } from "@commerce/pricing";
import type { PlatformId } from "@commerce/shared";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { RegistrationReadinessState } from "@/app/pipeline/commerce/readiness-state";

/**
 * N-3.56 STEP2-4/14(CPO 지시: "정보를 많이 보여주는 관리자 화면이 아니라
 * 오늘 등록할 상품을 골라주는 셀러 업무 화면") — /api/dashboard/readiness가
 * 이미 계산해 정렬해 준 결과를 그대로 렌더링만 한다(이 화면에서 새로운
 * 판정 로직을 만들지 않는다). "부족한 정보 해결" 버튼은 새 입력 UI를
 * 만들지 않고 기존 /pipeline?resume=<id>로 보낸다(STEP6) — 그 화면의
 * RegistrationStatusBanner/GuidedResolutionModal이 이어서 안내한다.
 */
interface DashboardPlatform {
  platform: PlatformId;
  supported: boolean;
  categoryConfirmed: boolean;
  state: RegistrationReadinessState;
  priorityItems: { key: string; label: string }[];
  kcStatus?: string;
  /** N-3.57 STEP9 — registration_attempts에 실제로 연결된 이력이 있으면
   * true. true면 state 배지 대신 "이미 등록됨"으로 보여준다. */
  registered: boolean;
}

type PriceLevel = "GREEN" | "YELLOW" | "RED" | "UNKNOWN";

interface DashboardProduct {
  id: string;
  sourceUrl: string;
  title: string | null;
  thumbnailUrl: string | null;
  status: "IN_PROGRESS" | "REGISTERED";
  priorityTier: 1 | 2 | 3 | 4 | 5;
  readiness: {
    priceValid: boolean;
    priceLevel?: PriceLevel;
    price?: {
      level: PriceLevel;
      marginPercent: number | null;
      currentSellingPriceKrw: number | null;
      domesticLowestPriceKrw: number | null;
      lastCheckedAt: string | null;
      reason: string;
    };
    platforms: DashboardPlatform[];
  };
  /** Sprint B-2(CPO 지시: "/today와도 연결해서 해당 작업을 추적할 수 있게") —
   * 마이그레이션 025 미실행/레거시 스냅샷은 null. */
  jobKey: string | null;
  error?: string;
}

interface DashboardResponse {
  totalCount: number;
  tierCounts: Record<string, number>;
  tierMeta: Record<string, { icon: string; label: string }>;
  headline: string;
  products: DashboardProduct[];
}

const PLATFORM_STATE_META: Record<RegistrationReadinessState, { icon: string; label: string }> = {
  BLOCKED: { icon: "🔴", label: "등록 불가" },
  SELLER_REVIEW: { icon: "🟠", label: "확인 필요" },
  NEEDS_REVIEW: { icon: "🟡", label: "정보 부족" },
  READY: { icon: "🟢", label: "등록 가능" },
};

/** N-4.07 Sprint(대표님 지시: "가격 데이터가 없다고 등록이 불가능한 게 아니다") —
 * UNKNOWN은 "확인 필요" 목록에 안 올린다(아래 필터 참고), 배지만 회색으로 둔다. */
const PRICE_LEVEL_META: Record<PriceLevel, { icon: string; label: string }> = {
  GREEN: { icon: "🟢", label: "가격 경쟁력 있음" },
  YELLOW: { icon: "🟡", label: "가격 확인 필요" },
  RED: { icon: "🔴", label: "마진 위험" },
  UNKNOWN: { icon: "⚪", label: "가격 판단 불가" },
};

function sourceSiteName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function TodayPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [bulkChecking, setBulkChecking] = useState(false);
  const [bulkCheckProgress, setBulkCheckProgress] = useState<{ done: number; total: number } | null>(null);
  /** N-4.11 STEP3(대표님 지시: "오늘 어떤 상품 가격부터 손봐야 하는지 바로
   * 알 수 있어야 한다") — 새 판정이 아니라 이미 계산된 priceLevel/price 값을
   * 클라이언트에서 필터링/정렬만 한다(서버 재계산 없음, /api 재호출 없음). */
  const [priceFilter, setPriceFilter] = useState<PriceLevel | "ALL">("ALL");
  const [priceSort, setPriceSort] = useState<
    "NONE" | "RISK" | "MARGIN" | "SELLING_PRICE" | "LOWEST_PRICE" | "LAST_CHECKED"
  >("NONE");
  /** N-4.18-K STEP K-6/N-4.18-L STEP L-10(대표님 지시, 2026-08-26: "🔴 3 /
   * 🟡 7 / 💡 2 판매 기회 / 🔵 12 정도의 요약 + 우선순위 정렬") —
   * price_alerts가 없으면(마이그레이션 039 미실행) 전부 0으로 온다, 에러 아님. */
  const [alertCounts, setAlertCounts] = useState<
    { ACTION_REQUIRED: number; REVIEW: number; INFO: number; OPPORTUNITY: number } | null
  >(null);

  async function load() {
    setLoading(true);
    setErrored(false);
    try {
      const res = await fetch("/api/dashboard/readiness?limit=20");
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as DashboardResponse;
      setData(json);
    } catch {
      setErrored(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    fetch("/api/price-alerts/summary")
      .then((res) => res.json())
      .then((json) => setAlertCounts(json.ok ? json.counts : null))
      .catch(() => setAlertCounts(null));
  }, []);

  /** N-4.07 Sprint(대표님 지시: "대시보드 [가격 일괄 확인]") — 화면에 보이는
   * 상품 전부에 대해 /api/price-history/check를 순차 배치(동시성 3)로 호출한다
   * — /api/dashboard/readiness가 이미 쓰는 것과 같은 동시성 값이다(서버가
   * 이미 그 값으로 안전하다고 판단한 값을 클라이언트에서 또 다른 값으로
   * 새로 만들지 않는다). */
  async function bulkRecheck() {
    if (!data) return;
    const ids = data.products.filter((p) => p.status !== "REGISTERED").map((p) => p.id);
    if (ids.length === 0) return;
    setBulkChecking(true);
    setBulkCheckProgress({ done: 0, total: ids.length });
    const concurrency = 3;
    let done = 0;
    for (let i = 0; i < ids.length; i += concurrency) {
      const chunk = ids.slice(i, i + concurrency);
      await Promise.all(
        chunk.map((snapshotId) =>
          fetch("/api/price-history/check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ snapshotId }),
          }).catch(() => null),
        ),
      );
      done += chunk.length;
      setBulkCheckProgress({ done, total: ids.length });
    }
    setBulkChecking(false);
    setBulkCheckProgress(null);
    await load();
  }

  const RISK_ORDER: Record<PriceLevel, number> = { RED: 0, YELLOW: 1, UNKNOWN: 2, GREEN: 3 };
  const visibleProducts = (data?.products ?? [])
    .filter((p) => priceFilter === "ALL" || (p.readiness.priceLevel ?? "UNKNOWN") === priceFilter)
    .slice()
    .sort((a, b) => {
      if (priceSort === "NONE") return 0;
      const pa = a.readiness.price;
      const pb = b.readiness.price;
      if (priceSort === "RISK") {
        return RISK_ORDER[a.readiness.priceLevel ?? "UNKNOWN"] - RISK_ORDER[b.readiness.priceLevel ?? "UNKNOWN"];
      }
      if (priceSort === "MARGIN") {
        // 마진율 오름차순(위험한 것부터) — null(계산 불가)은 맨 뒤로.
        if (pa?.marginPercent == null) return 1;
        if (pb?.marginPercent == null) return -1;
        return pa.marginPercent - pb.marginPercent;
      }
      if (priceSort === "SELLING_PRICE") {
        if (pa?.currentSellingPriceKrw == null) return 1;
        if (pb?.currentSellingPriceKrw == null) return -1;
        return pb.currentSellingPriceKrw - pa.currentSellingPriceKrw;
      }
      if (priceSort === "LOWEST_PRICE") {
        if (pa?.domesticLowestPriceKrw == null) return 1;
        if (pb?.domesticLowestPriceKrw == null) return -1;
        return pa.domesticLowestPriceKrw - pb.domesticLowestPriceKrw;
      }
      // LAST_CHECKED — 오래된 것부터(먼저 확인해야 할 것을 위로).
      if (!pa?.lastCheckedAt) return -1;
      if (!pb?.lastCheckedAt) return 1;
      return pa.lastCheckedAt < pb.lastCheckedAt ? -1 : 1;
    });

  return (
    <>
      <PageHeader
        title="오늘의 등록 준비"
        subtitle="여러 상품 중 오늘 바로 등록할 수 있는 것부터 먼저 보여줍니다."
      />
      <PageContainer size="lg">
        {loading ? (
          <p className="text-sm text-text-secondary">불러오는 중...</p>
        ) : errored || !data ? (
          <Card className="text-center text-sm text-text-secondary" padding="lg">
            대시보드를 불러오지 못했습니다.
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => void load()}>
              다시 시도
            </Button>
          </Card>
        ) : data.totalCount === 0 ? (
          <Card className="text-center text-sm text-text-secondary" padding="lg">
            아직 저장된 작업이 없습니다. 상품 URL을 분석하면 여기에 자동으로 남습니다.
          </Card>
        ) : (
          <>
            <Card padding="md" className="mb-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-base font-semibold text-text-primary">{data.headline}</p>
                <Button variant="secondary" size="sm" onClick={() => void bulkRecheck()} disabled={bulkChecking}>
                  {bulkChecking
                    ? `가격 확인 중... (${bulkCheckProgress?.done ?? 0}/${bulkCheckProgress?.total ?? 0})`
                    : "가격 일괄 확인"}
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                {/* N-4.12 STEP8(대표님 지시: "전체N / 등록불가N / 확인필요N /
                    등록가능N / 가격위험N을 한눈에") — 새 집계가 아니라
                    data.totalCount(이미 API가 계산)와 아래 tierCounts 루프를
                    "전체" 항목 하나로만 앞에 추가한다. */}
                <span className="flex items-center gap-1 text-text-secondary">
                  <span>전체 {data.totalCount}개</span>
                </span>
                {(["1", "2", "3", "4", "5"] as const).map((tier) => {
                  const meta = data.tierMeta[tier];
                  const count = data.tierCounts[tier] ?? 0;
                  if (!meta || count === 0) return null;
                  return (
                    <span key={tier} className="flex items-center gap-1 text-text-secondary">
                      <span>{meta.icon}</span>
                      <span>
                        {meta.label} {count}개
                      </span>
                    </span>
                  );
                })}
                {/* N-4.07 Sprint(대표님 지시: "가격 확인 필요 N개") — 새 판정이
                    아니라 각 카드가 이미 갖고 있는 priceLevel을 그냥 센다. */}
                {(() => {
                  const priceAttentionCount = data.products.filter(
                    (p) => p.readiness.priceLevel === "YELLOW" || p.readiness.priceLevel === "RED",
                  ).length;
                  if (priceAttentionCount === 0) return null;
                  return (
                    <span className="flex items-center gap-1 text-text-secondary">
                      <span>🟡</span>
                      <span>가격 확인 필요 {priceAttentionCount}개</span>
                    </span>
                  );
                })()}
                {/* N-4.12 STEP8 — 마진위험(RED)만 따로 센다. 등록불가와 겹쳐도
                    이중집계 경고가 아니라 "이 상품은 등록도 막혀있고 가격도
                    위험하다"는 두 가지 별개 신호를 그대로 둘 다 보여준다. */}
                {(() => {
                  const priceRiskCount = data.products.filter((p) => p.readiness.priceLevel === "RED").length;
                  if (priceRiskCount === 0) return null;
                  return (
                    <span className="flex items-center gap-1 text-text-secondary">
                      <span>🔴</span>
                      <span>가격위험 {priceRiskCount}개</span>
                    </span>
                  );
                })()}
              </div>
            </Card>

            {alertCounts &&
              (alertCounts.ACTION_REQUIRED > 0 ||
                alertCounts.OPPORTUNITY > 0 ||
                alertCounts.REVIEW > 0 ||
                alertCounts.INFO > 0) && (
                <Card padding="md" className="mb-4">
                  <p className="text-xs font-medium text-text-tertiary">Market Intelligence</p>
                  {/* STEP L-10 — "셀러가 오늘 무엇부터 봐야 하는지" 우선순위
                      그대로 나열 순서를 고정한다(🔴 → 💡 → 🟡 → 🔵). */}
                  <div className="mt-1.5 flex flex-wrap gap-4 text-sm">
                    {alertCounts.ACTION_REQUIRED > 0 && (
                      <span className="text-error">🔴 가격 검토 필요 {alertCounts.ACTION_REQUIRED}</span>
                    )}
                    {alertCounts.OPPORTUNITY > 0 && (
                      <span className="text-success">💡 판매 기회 {alertCounts.OPPORTUNITY}</span>
                    )}
                    {alertCounts.REVIEW > 0 && <span className="text-warning">🟡 확인 필요 {alertCounts.REVIEW}</span>}
                    {alertCounts.INFO > 0 && <span className="text-text-secondary">🔵 참고 {alertCounts.INFO}</span>}
                  </div>
                </Card>
              )}

            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-text-tertiary">가격 필터</span>
                {(["ALL", "GREEN", "YELLOW", "RED", "UNKNOWN"] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setPriceFilter(level)}
                    className={`rounded-full border px-2 py-1 font-medium ${
                      priceFilter === level
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-text-secondary hover:bg-background"
                    }`}
                  >
                    {level === "ALL" ? "전체" : `${PRICE_LEVEL_META[level].icon} ${PRICE_LEVEL_META[level].label}`}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-1.5 text-text-tertiary">
                정렬
                <select
                  value={priceSort}
                  onChange={(e) => setPriceSort(e.target.value as typeof priceSort)}
                  className="rounded-md border border-border bg-surface px-2 py-1 text-text-secondary"
                >
                  <option value="NONE">기본(우선순위)</option>
                  <option value="RISK">가격 위험도</option>
                  <option value="MARGIN">마진율 낮은 순</option>
                  <option value="SELLING_PRICE">내 판매가 높은 순</option>
                  <option value="LOWEST_PRICE">국내 최저가 낮은 순</option>
                  <option value="LAST_CHECKED">확인시간 오래된 순</option>
                </select>
              </label>
              {visibleProducts.length !== data.products.length && (
                <span className="text-text-tertiary">
                  {visibleProducts.length}/{data.products.length}개 표시 중
                </span>
              )}
            </div>

            <div className="space-y-3">
              {visibleProducts.map((product) => (
                <Card key={product.id} padding="md" className="flex items-center gap-4">
                  {product.thumbnailUrl ? (
                    <img
                      src={product.thumbnailUrl}
                      alt={product.title ?? "상품 이미지"}
                      className="h-16 w-16 shrink-0 rounded-[var(--radius-md)] border border-border object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-border text-[10px] text-text-tertiary">
                      없음
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span>{data.tierMeta[String(product.priorityTier)]?.icon}</span>
                      <p className="truncate text-sm font-medium text-text-primary">
                        {product.title || product.sourceUrl}
                      </p>
                      {product.status === "REGISTERED" && (
                        <Badge variant="success" size="sm">
                          등록 완료
                        </Badge>
                      )}
                    </div>
                    {product.jobKey && (
                      <p className="mt-0.5 font-mono text-[11px] text-text-tertiary">{product.jobKey}</p>
                    )}
                    <p className="mt-0.5 truncate text-xs text-text-tertiary">{sourceSiteName(product.sourceUrl)}</p>

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                      <span className={product.readiness.priceValid ? "text-text-secondary" : "text-error"}>
                        {product.readiness.priceValid ? "✓ 가격 확인됨" : "⚠ 가격 확인 필요"}
                      </span>
                      {product.readiness.platforms.map((p) => {
                        if (p.registered) {
                          return (
                            <span key={p.platform} className="text-text-secondary">
                              {PLATFORM_ADAPTERS[p.platform].label} ✅ 등록됨
                            </span>
                          );
                        }
                        const meta = PLATFORM_STATE_META[p.state];
                        return (
                          <span key={p.platform} className="text-text-secondary">
                            {PLATFORM_ADAPTERS[p.platform].label} {meta.icon} {meta.label}
                          </span>
                        );
                      })}
                      {(() => {
                        const priceMeta = PRICE_LEVEL_META[product.readiness.priceLevel ?? "UNKNOWN"];
                        const price = product.readiness.price;
                        const ageTier = price?.lastCheckedAt ? priceAgeTier(price.lastCheckedAt) : null;
                        const isStale = ageTier === "STALE" || ageTier === "VERY_STALE";
                        return (
                          <span className="flex items-center gap-1 text-text-secondary" title={price?.reason}>
                            가격 {priceMeta.icon} {priceMeta.label}
                            {isStale && (
                              <span className="rounded bg-warning-soft px-1 py-0.5 text-[10px] font-medium text-warning">
                                ⚠️ 오래된 가격
                              </span>
                            )}
                          </span>
                        );
                      })()}
                      {product.error && <span className="text-error">계산 실패: {product.error}</span>}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {product.status !== "REGISTERED" && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => router.push(`/pipeline?resume=${product.id}`)}
                      >
                        {product.priorityTier === 1 ? "지금 등록하기" : "부족한 정보 해결"}
                      </Button>
                    )}
                    <Button variant="secondary" size="sm" onClick={() => router.push(`/pipeline?resume=${product.id}`)}>
                      상세 보기
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </PageContainer>
    </>
  );
}
