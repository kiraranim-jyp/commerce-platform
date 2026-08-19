"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
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

interface DashboardProduct {
  id: string;
  sourceUrl: string;
  title: string | null;
  thumbnailUrl: string | null;
  status: "IN_PROGRESS" | "REGISTERED";
  priorityTier: 1 | 2 | 3 | 4 | 5;
  readiness: { priceValid: boolean; platforms: DashboardPlatform[] };
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
  }, []);

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
              <p className="text-base font-semibold text-text-primary">{data.headline}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
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
              </div>
            </Card>

            <div className="space-y-3">
              {data.products.map((product) => (
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
