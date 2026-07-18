import JSZip from "jszip";
import type { ProductMetadata } from "@commerce/shared";
import type { ProcessingReport, WorkspaceItem } from "./types";

export function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const timePart = `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
  return `${datePart}_${timePart}`;
}

function base64Of(dataUrl: string): string {
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

function extensionOf(dataUrl: string): string {
  const match = /^data:image\/(\w+);/.exec(dataUrl);
  const format = match?.[1] ?? "jpeg";
  return format === "jpeg" ? ".jpg" : `.${format}`;
}

/** 원본 비율을 유지한 채 흰 배경 위에 중앙 정렬해 size x size 정사각형으로 만든다 (잘림 없음). */
export function resizeToSquare(dataUrl: string, size: number): Promise<string> {
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

/**
 * original/ + thumbnail/(800x800) + detail/ + metadata.json + report.json로 ZIP을 만든다.
 * 제외 표시된 이미지는 세 폴더 모두에서 빠진다. detail/thumbnail은 처리에 성공한
 * 이미지만 대상(실패한 이미지는 detailDataUrl이 없다) — original은 처리 성공 여부와
 * 무관하게 다운로드에는 항상 성공하므로 제외되지 않은 모든 이미지를 담는다.
 */
export async function downloadWorkspaceZip(
  items: WorkspaceItem[],
  excludedIds: Set<string>,
  metadata: ProductMetadata,
  report: ProcessingReport,
): Promise<void> {
  const timestamp = formatTimestamp(new Date());
  const zip = new JSZip();

  const thumbnailFolder = zip.folder("thumbnail");
  const detailFolder = zip.folder("detail");
  const originalFolder = zip.folder("original");

  const notExcluded = items.filter((item) => !excludedIds.has(item.id));

  for (const item of notExcluded) {
    if (item.status !== "success" || !item.detailDataUrl) continue;
    detailFolder?.file(
      `${item.id}${extensionOf(item.detailDataUrl)}`,
      base64Of(item.detailDataUrl),
      {
        base64: true,
      },
    );
    const squareDataUrl = await resizeToSquare(item.detailDataUrl, 800);
    thumbnailFolder?.file(`${item.id}.jpg`, base64Of(squareDataUrl), { base64: true });
  }

  for (const item of notExcluded) {
    if (!item.originalDataUrl) continue;
    originalFolder?.file(
      `${item.id}${extensionOf(item.originalDataUrl)}`,
      base64Of(item.originalDataUrl),
      { base64: true },
    );
  }

  zip.file("metadata.json", JSON.stringify(metadata, null, 2));
  zip.file("report.json", JSON.stringify(report, null, 2));

  const blob = await zip.generateAsync({ type: "blob" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `${timestamp}.zip`;
  link.click();
  URL.revokeObjectURL(objectUrl);
}
