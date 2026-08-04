"use client";

import { useEffect, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface ImageAssetOption {
  id: string;
  url: string;
  fileName: string | null;
  tags: string[];
  createdAt: string;
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<ImageAssetOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagFilter, setTagFilter] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadTags, setUploadTags] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadAssets(tag?: string) {
    setLoading(true);
    try {
      const res = await fetch(tag ? `/api/assets?tag=${encodeURIComponent(tag)}` : "/api/assets");
      const data = (await res.json()) as { assets?: ImageAssetOption[] };
      setAssets(data.assets ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAssets();
  }, []);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("tags", uploadTags);
      const res = await fetch("/api/assets", { method: "POST", body });
      const data = (await res.json()) as { ok: boolean; asset?: ImageAssetOption };
      if (data.ok && data.asset) {
        setAssets((prev) => [data.asset as ImageAssetOption, ...prev]);
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/assets/${id}`, { method: "DELETE" });
      setAssets((prev) => prev.filter((a) => a.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="이미지"
        subtitle="여러 상품·프로필에서 재사용할 이미지를 한 곳에서 관리합니다."
      />
      <PageContainer size="lg">
        <Card padding="md" className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-secondary">새 이미지 업로드</label>
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
                e.target.value = "";
              }}
              className="text-xs text-text-secondary file:mr-2 file:rounded file:border file:border-border file:bg-background file:px-2 file:py-1 file:text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-secondary">태그(쉼표로 구분)</label>
            <input
              type="text"
              value={uploadTags}
              onChange={(e) => setUploadTags(e.target.value)}
              placeholder="예: 브랜드A, 2026SS"
              className="rounded-md border border-border px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          {uploading && <span className="text-xs text-text-tertiary">업로드 중...</span>}
          <div className="ml-auto flex flex-col gap-1">
            <label className="text-xs font-medium text-text-secondary">태그 필터</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                placeholder="태그로 검색"
                className="rounded-md border border-border px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
              />
              <Button variant="secondary" size="sm" onClick={() => void loadAssets(tagFilter || undefined)}>
                검색
              </Button>
            </div>
          </div>
        </Card>

        {loading ? (
          <p className="mt-4 text-sm text-text-secondary">불러오는 중...</p>
        ) : assets.length === 0 ? (
          <Card className="mt-4 text-center text-sm text-text-secondary" padding="lg">
            아직 저장된 이미지가 없습니다. 위에서 업로드하거나, 설정 페이지에서 공통 이미지를
            업로드하면 여기에 자동으로 쌓입니다.
          </Card>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {assets.map((asset) => (
              <Card key={asset.id} padding="sm">
                <img
                  src={asset.url}
                  alt={asset.fileName ?? "자산"}
                  className="h-32 w-full rounded-[var(--radius-sm)] border border-border object-cover"
                />
                <p className="mt-2 truncate text-xs text-text-secondary" title={asset.fileName ?? undefined}>
                  {asset.fileName ?? "이름 없음"}
                </p>
                {asset.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {asset.tags.map((tag) => (
                      <Badge key={tag} size="sm" variant="default">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full"
                  disabled={busyId === asset.id}
                  onClick={() => handleDelete(asset.id)}
                >
                  삭제
                </Button>
              </Card>
            ))}
          </div>
        )}
      </PageContainer>
    </>
  );
}
