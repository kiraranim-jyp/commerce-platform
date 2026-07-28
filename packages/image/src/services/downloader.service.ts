import fs from "node:fs";
import path from "node:path";
import type { ExtractedImage } from "@commerce/shared";
import { storagePaths } from "../utils/storage-paths.util";
import { hashBuffer, hashString } from "../utils/hash.util";
import { ImageCache } from "./cache.service";

export interface DownloadedImage {
  index: number;
  file: string;
  fileName: string;
  sourceUrl: string;
  contentHash: string;
  bytes: number;
  fromCache: boolean;
}

export class ImageDownloader {
  constructor(private readonly outputDir: string = storagePaths.downloadsOriginal) {
    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  async downloadAll(
    images: ExtractedImage[],
    onEach?: (current: number, total: number, fileName: string) => void,
  ): Promise<DownloadedImage[]> {
    const cache = new ImageCache();
    const results: DownloadedImage[] = [];

    let index = 1;
    for (const image of images) {
      const urlHash = hashString(image.url);
      const cached = cache.get(urlHash);

      if (cached && fs.existsSync(cached.file)) {
        results.push({ ...cached, index, fromCache: true });
        onEach?.(index, images.length, cached.fileName);
        index += 1;
        continue;
      }

      const buffer = await this.fetchBuffer(image.url);
      const contentHash = hashBuffer(buffer);
      const extension = detectExtension(image.url, buffer);
      const fileName = `${String(index).padStart(4, "0")}.${extension}`;
      const filePath = path.join(this.outputDir, fileName);
      fs.writeFileSync(filePath, buffer);

      const record = {
        file: filePath,
        fileName,
        sourceUrl: image.url,
        contentHash,
        bytes: buffer.length,
      };
      cache.set(urlHash, record);
      results.push({ ...record, index, fromCache: false });
      onEach?.(index, images.length, fileName);
      index += 1;
    }

    cache.persist();
    return results;
  }

  /** 429/5xx나 네트워크 예외(타임아웃 등)는 일시적일 가능성이 높아 최대 3회(최초
   * 포함)까지 지수 백오프로 재시도한다 — 400/403/404 같은 영구 실패는 재시도해도
   * 똑같이 실패하므로 즉시 던지고 루프를 빠져나간다(permanent 플래그로 구분 —
   * 이 throw까지 같은 try/catch에 걸리면 영구 실패도 재시도해버리는 버그가 난다). */
  private async fetchBuffer(url: string): Promise<Buffer> {
    const maxAttempts = 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let permanentError: Error | null = null;
      try {
        const response = await fetch(url);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          return Buffer.from(arrayBuffer);
        }
        const error = new Error(`이미지 다운로드 실패 (${response.status}): ${url}`);
        if (response.status !== 429 && response.status < 500) {
          permanentError = error;
        } else {
          lastError = error;
        }
      } catch (error) {
        lastError = error;
      }
      if (permanentError) throw permanentError;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(500 * 2 ** (attempt - 1), 4000)));
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`이미지 다운로드 실패: ${url}`);
  }
}

function detectExtension(url: string, buffer: Buffer): string {
  const fromUrl = getUrlExtension(url);
  if (fromUrl) return fromUrl;

  if (buffer.subarray(0, 3).toString("hex") === "ffd8ff") return "jpg";
  if (buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return "png";
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return "jpg";
}

function getUrlExtension(url: string): string | undefined {
  try {
    const ext = path.extname(new URL(url).pathname).replace(".", "").toLowerCase();
    if (ext === "jpeg") return "jpg";
    if (["jpg", "png", "webp"].includes(ext)) return ext;
    return undefined;
  } catch {
    return undefined;
  }
}
