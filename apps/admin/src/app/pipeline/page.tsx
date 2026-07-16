"use client";

import { useState } from "react";
import JSZip from "jszip";

interface ImageResult {
  fileName: string;
  dataUrl: string;
}

interface PipelineResponse {
  metadata: {
    title: string;
    sourceUrl: string;
    thumbnail: string;
    classifications: Array<{ file: string; type: string; confidence: number }>;
  };
  thumbnail: string | null;
  detailImages: ImageResult[];
  originalImages: ImageResult[];
  storageNote: string;
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

      const rawText = await response.text();
      let data: PipelineResponse;
      try {
        data = JSON.parse(rawText) as PipelineResponse;
      } catch {
        // 서버가 크래시하면 Next.js가 JSON이 아닌 에러 HTML 페이지를 대신 반환한다.
        setError(
          `서버에서 정상 응답을 받지 못했습니다 (HTTP ${response.status}). 이미지 처리 도중 서버가 ` +
            "죽었을 수 있습니다. 잠시 후 다시 시도하거나 이미지 수가 적은 상품 URL로 시도해보세요.",
        );
        return;
      }

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

  async function downloadZip() {
    if (!result) return;

    // 압축 해제 시 파일탐색기가 zip 파일명으로 폴더를 만들어주므로,
    // zip 내부에 같은 이름의 폴더를 또 넣으면 폴더가 이중으로 중첩된다.
    // 파일은 zip 루트에 바로 담고, zip 파일명 자체를 날짜+시각 폴더명으로 쓴다.
    const timestamp = formatTimestamp(new Date());
    const zip = new JSZip();

    const allImages: ImageResult[] = [
      ...(result.thumbnail
        ? [{ fileName: result.metadata.thumbnail || "0001", dataUrl: result.thumbnail }]
        : []),
      ...result.detailImages,
    ];

    const thumbnailFolder = zip.folder("thumbnail");
    const detailFolder = zip.folder("detail");
    const originalFolder = zip.folder("original");

    for (const image of allImages) {
      const baseName = image.fileName.replace(/\.\w+$/, "");

      // detail: 파이프라인이 만든 표준 규격(1500x2000) 그대로 저장
      detailFolder?.file(`${baseName}${extensionOf(image.dataUrl)}`, base64Of(image.dataUrl), {
        base64: true,
      });

      // thumbnail: 800x800 정사각형으로 리사이즈해서 저장
      const squareDataUrl = await resizeToSquare(image.dataUrl, 800);
      thumbnailFolder?.file(`${baseName}.jpg`, base64Of(squareDataUrl), { base64: true });
    }

    // original: 가공 전 원본 다운로드 이미지
    for (const image of result.originalImages) {
      const baseName = image.fileName.replace(/\.\w+$/, "");
      originalFolder?.file(`${baseName}${extensionOf(image.dataUrl)}`, base64Of(image.dataUrl), {
        base64: true,
      });
    }

    zip.file("metadata.json", JSON.stringify(result.metadata, null, 2));

    const blob = await zip.generateAsync({ type: "blob" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${timestamp}.zip`;
    link.click();
    URL.revokeObjectURL(objectUrl);
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
          <button
            onClick={downloadZip}
            className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            결과 ZIP 다운로드 (thumbnail 800×800 + detail 1500×2000 + original)
          </button>

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

          <ImageGallery title="상세컷" images={result.detailImages} />

          <p className="rounded bg-amber-50 p-3 text-xs text-amber-800">{result.storageNote}</p>
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

function base64Of(dataUrl: string): string {
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

function extensionOf(dataUrl: string): string {
  const match = /^data:image\/(\w+);/.exec(dataUrl);
  const format = match?.[1] ?? "jpeg";
  return format === "jpeg" ? ".jpg" : `.${format}`;
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const timePart = `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
  return `${datePart}_${timePart}`;
}

/** 원본 비율을 유지한 채 흰 배경 위에 중앙 정렬해 size x size 정사각형으로 만든다 (잘림 없음). */
function resizeToSquare(dataUrl: string, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas context를 생성하지 못했습니다."));
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      const scale = Math.min(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
    img.src = dataUrl;
  });
}
