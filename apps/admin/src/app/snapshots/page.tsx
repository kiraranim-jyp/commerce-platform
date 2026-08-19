"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { ProductSnapshotSummary } from "@/app/api/snapshots/_lib/types";

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

export default function SnapshotsPage() {
  const router = useRouter();
  const [snapshots, setSnapshots] = useState<ProductSnapshotSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadSnapshots() {
    setLoading(true);
    try {
      const res = await fetch("/api/snapshots");
      const data = (await res.json()) as { snapshots?: ProductSnapshotSummary[] };
      setSnapshots(data.snapshots ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSnapshots();
  }, []);

  async function handleDuplicate(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/snapshots/${id}/duplicate`, { method: "POST" });
      const data = (await res.json()) as { ok: boolean; snapshot?: { id: string } };
      if (data.ok && data.snapshot) {
        router.push(`/pipeline?resume=${data.snapshot.id}`);
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/snapshots/${id}`, { method: "DELETE" });
      setSnapshots((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader title="최근 작업" subtitle="분석했던 상품을 이어서 작업하거나 복제할 수 있습니다." />
      <PageContainer size="lg">
        {loading ? (
          <p className="text-sm text-text-secondary">불러오는 중...</p>
        ) : snapshots.length === 0 ? (
          <Card className="text-center text-sm text-text-secondary" padding="lg">
            아직 저장된 작업이 없습니다. 상품 URL을 분석하면 여기에 자동으로 남습니다.
          </Card>
        ) : (
          <div className="space-y-3">
            {snapshots.map((snapshot) => (
              <Card key={snapshot.id} padding="md" className="flex items-center gap-4">
                {snapshot.thumbnailUrl ? (
                  <img
                    src={snapshot.thumbnailUrl}
                    alt={snapshot.title ?? "상품 이미지"}
                    className="h-16 w-16 shrink-0 rounded-[var(--radius-md)] border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-border text-[10px] text-text-tertiary">
                    없음
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {snapshot.title || snapshot.sourceUrl}
                    </p>
                    <Badge variant={snapshot.status === "REGISTERED" ? "success" : "default"} size="sm">
                      {snapshot.status === "REGISTERED" ? "등록 완료" : "작업 중"}
                    </Badge>
                    {/* Sprint B-2(CPO 지시: "오류 여부") — 가장 최근 시도가
                     * 실패한 플랫폼이 있으면 눈에 띄게 표시한다. */}
                    {snapshot.hasRegistrationError && (
                      <Badge variant="warning" size="sm">
                        ⚠ 등록 오류
                      </Badge>
                    )}
                  </div>
                  {/* Sprint B-2 — 작업번호. 마이그레이션 025 실행 전 스냅샷은
                   * jobKey가 없을 수 있다(레거시) — 그 경우 표시하지 않는다. */}
                  {snapshot.jobKey && (
                    <p className="mt-0.5 font-mono text-[11px] text-text-tertiary">{snapshot.jobKey}</p>
                  )}
                  <p className="mt-0.5 truncate text-xs text-text-tertiary">{snapshot.sourceUrl}</p>
                  {snapshot.registeredPlatforms && snapshot.registeredPlatforms.length > 0 && (
                    <p className="mt-0.5 flex flex-wrap gap-1 text-xs text-text-tertiary">
                      {snapshot.registeredPlatforms.map((platform) => (
                        <span key={platform} className="rounded-full bg-background px-2 py-0.5">
                          {PLATFORM_ADAPTERS[platform]?.label ?? platform} 등록됨
                        </span>
                      ))}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-text-tertiary">
                    {/* Sprint B-2(CPO 지시: "마지막 작업시간") — 실제 등록
                     * 시도가 있으면 그 시각이 "마지막 작업"에 더 가깝다.
                     * 없으면(아직 등록 시도 전) 최근 열람 시각으로 대체한다 —
                     * 값을 지어내지 않는다. */}
                    마지막 작업 {formatRelativeTime(snapshot.lastAttemptAt ?? snapshot.lastOpenedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => router.push(`/pipeline?resume=${snapshot.id}`)}
                    disabled={busyId === snapshot.id}
                  >
                    이어서 작업
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDuplicate(snapshot.id)}
                    disabled={busyId === snapshot.id}
                  >
                    복제
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(snapshot.id)}
                    disabled={busyId === snapshot.id}
                  >
                    삭제
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </PageContainer>
    </>
  );
}
