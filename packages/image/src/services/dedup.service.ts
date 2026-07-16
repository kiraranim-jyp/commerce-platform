import sharp from "sharp";
import type { DownloadedImage } from "./downloader.service";

export async function computeAverageHash(filePath: string, size = 8): Promise<string> {
  const { data } = await sharp(filePath)
    .grayscale()
    .resize(size, size, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const average = data.reduce((sum, value) => sum + value, 0) / data.length;

  let hash = "";
  for (const value of data) {
    hash += value >= average ? "1" : "0";
  }
  return hash;
}

export function hammingDistance(a: string, b: string): number {
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) distance += 1;
  }
  return distance;
}

export interface DedupResult {
  kept: DownloadedImage[];
  removed: Array<{ image: DownloadedImage; duplicateOf: string }>;
}

/** 8x8 average-hash = 64 bits. 6 bits 이하 차이는 동일 이미지의 다른 해상도로 간주한다. */
const DEFAULT_THRESHOLD = 6;

interface HashedImage {
  image: DownloadedImage;
  hash: string;
  pixels: number;
}

export async function deduplicateImages(
  images: DownloadedImage[],
  threshold = DEFAULT_THRESHOLD,
): Promise<DedupResult> {
  const hashed: HashedImage[] = await Promise.all(
    images.map(async (image) => {
      const hash = await computeAverageHash(image.file);
      const metadata = await sharp(image.file).metadata();
      const pixels = (metadata.width ?? 0) * (metadata.height ?? 0);
      return { image, hash, pixels };
    }),
  );

  const groups: HashedImage[][] = [];
  for (const item of hashed) {
    const group = groups.find(
      (candidate) => hammingDistance(candidate[0].hash, item.hash) <= threshold,
    );
    if (group) {
      group.push(item);
    } else {
      groups.push([item]);
    }
  }

  const kept: DownloadedImage[] = [];
  const removed: Array<{ image: DownloadedImage; duplicateOf: string }> = [];

  for (const group of groups) {
    const best = group.reduce((a, b) => (b.pixels > a.pixels ? b : a));
    kept.push(best.image);
    for (const item of group) {
      if (item !== best) {
        removed.push({ image: item.image, duplicateOf: best.image.fileName });
      }
    }
  }

  return { kept, removed };
}
