"use client";

import { useState } from "react";

interface ImageResult {
  fileName: string;
  dataUrl: string;
}

interface PipelineResponse {
  metadata: {
    title: string;
    sourceUrl: string;
    classifications: Array<{ file: string; type: string; confidence: number }>;
  };
  thumbnail: string | null;
  productImages: ImageResult[];
  modelImages: ImageResult[];
  detailImages: ImageResult[];
  sizeChartImages: ImageResult[];
  error?: string;
}

export default function PipelinePage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PipelineResponse | null>(null);

  async function runPipeline() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await response.json()) as PipelineResponse;

      if (!response.ok) {
        setError(data.error ?? "파이프라인 실행에 실패했습니다.");
        return;
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-semibold">Image Pipeline 테스트</h1>
      <p className="mt-2 text-sm text-zinc-500">
        상품 URL을 입력하면 이미지 수집 → 분류(Gemini) → 배경제거 → 표준화 → 압축까지 전체
        파이프라인을 실행합니다.
      </p>

      <div className="mt-6 flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/product/123"
          className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm"
        />
        <button
          onClick={runPipeline}
          disabled={loading || !url}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {loading ? "실행 중..." : "실행"}
        </button>
      </div>

      {loading && (
        <p className="mt-4 text-sm text-zinc-500">
          첫 실행은 배경제거 모델 다운로드 때문에 1~2분 정도 걸릴 수 있습니다...
        </p>
      )}

      {error && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {result && (
        <div className="mt-8 space-y-8">
          <section>
            <h2 className="text-lg font-medium">분류 결과</h2>
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="py-1">파일</th>
                  <th className="py-1">타입</th>
                  <th className="py-1">신뢰도</th>
                </tr>
              </thead>
              <tbody>
                {result.metadata.classifications.map((c) => (
                  <tr key={c.file} className="border-t border-zinc-100">
                    <td className="py-1">{c.file}</td>
                    <td className="py-1">{c.type}</td>
                    <td className="py-1">{c.confidence.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {result.thumbnail && (
            <section>
              <h2 className="text-lg font-medium">대표 이미지</h2>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.thumbnail}
                alt="thumbnail"
                className="mt-2 h-64 w-auto rounded border"
              />
            </section>
          )}

          <ImageGallery title="제품컷 (PRODUCT)" images={result.productImages} />
          <ImageGallery title="모델컷 (MODEL)" images={result.modelImages} />
          <ImageGallery title="상세컷 (DETAIL)" images={result.detailImages} />
          <ImageGallery title="사이즈표 (SIZE_CHART)" images={result.sizeChartImages} />
        </div>
      )}
    </main>
  );
}

function ImageGallery({ title, images }: { title: string; images: ImageResult[] }) {
  if (images.length === 0) return null;

  return (
    <section>
      <h2 className="text-lg font-medium">
        {title} ({images.length})
      </h2>
      <div className="mt-2 flex flex-wrap gap-3">
        {images.map((image) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={image.fileName}
            src={image.dataUrl}
            alt={image.fileName}
            className="h-48 w-auto rounded border bg-[repeating-conic-gradient(#eee_0_25%,white_0_50%)_0_0/16px_16px]"
          />
        ))}
      </div>
    </section>
  );
}
