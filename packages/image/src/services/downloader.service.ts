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

  private async fetchBuffer(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`이미지 다운로드 실패 (${response.status}): ${url}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
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
