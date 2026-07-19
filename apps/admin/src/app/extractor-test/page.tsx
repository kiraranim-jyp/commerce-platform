"use client";

import { useState } from "react";

interface ExtractedImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

interface ExtractionTrace {
  url: string;
  sources: string[];
  score: number;
  included: boolean;
  reason: string;
}

interface ExtractResult {
  images: ExtractedImage[];
  trace?: ExtractionTrace[];
  strategyCounts?: Record<string, number>;
}

export default function ExtractorTestPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/extractor-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await response.json()) as ExtractResult & { error?: string };
      if (!response.ok) {
        setError(data.error ?? `요청에 실패했습니다 (HTTP ${response.status}).`);
        return;
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const included = result?.trace?.filter((t) => t.included) ?? [];
  const excluded = result?.trace?.filter((t) => !t.included) ?? [];

  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="text-2xl font-semibold">Extractor Test</h1>
      <p className="mt-2 text-sm text-zinc-500">
        상품 URL의 이미지 추출 과정을 전략별로 확인합니다 — 어떤 Strategy가 이미지를
        찾았는지, 왜 포함/제외됐는지 표시합니다.
      </p>

      <div className="mt-6 flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/product/123"
          disabled={loading}
          className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm disabled:opacity-60"
        />
        <button
          onClick={run}
          disabled={loading || !url}
          className="flex items-center gap-2 rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {loading && (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          )}
          {loading ? "추출 중..." : "실행"}
        </button>
      </div>

      {error && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {result && (
        <div className="mt-8 space-y-6">
          <section>
            <h2 className="text-base font-medium">전략별 발견 개수</h2>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
              {Object.entries(result.strategyCounts ?? {}).map(([source, count]) => (
                <div key={source} className="rounded border border-zinc-200 p-2">
                  <dt className="text-xs text-zinc-500">{source}</dt>
                  <dd className="font-medium text-zinc-800">{count}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h2 className="text-base font-medium">최종 이미지 ({included.length})</h2>
            <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {included.map((item) => (
                <div key={item.url} className="rounded-lg border border-zinc-200 bg-white">
                  <div className="flex h-40 items-center justify-center overflow-hidden bg-zinc-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url} alt="" className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="p-2 text-xs text-zinc-600">
                    <p className="font-medium text-zinc-800">{item.score}점</p>
                    <p className="truncate">{item.sources.join(", ")}</p>
                    <p className="line-clamp-2 text-zinc-400" title={item.reason}>
                      {item.reason}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-base font-medium">제외된 이미지 ({excluded.length})</h2>
            <table className="mt-2 w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="py-1 pr-2">URL</th>
                  <th className="py-1 pr-2">점수</th>
                  <th className="py-1 pr-2">사유</th>
                </tr>
              </thead>
              <tbody>
                {excluded.map((item) => (
                  <tr key={item.url} className="border-b border-zinc-100">
                    <td className="max-w-xs truncate py-1 pr-2" title={item.url}>
                      {item.url}
                    </td>
                    <td className="py-1 pr-2">{item.score}</td>
                    <td className="py-1 pr-2 text-zinc-500">{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </main>
  );
}
