import sharp from "sharp";
import type { DownloadedImage } from "./downloader.service";

/**
 * dHash(difference hash): 인접 픽셀 간 밝기 증감(gradient)을 비교한다.
 * 평균해시(aHash)는 전체 밝기 분포만 보기 때문에, 같은 흰 배경에 비슷한 톤의
 * 제품(예: 같은 카키 바지의 서로 다른 각도 사진들)을 서로 다른 사진인데도
 * "똑같다"고 오판하는 경우가 있었다. 인접 픽셀 구조(경계선/윤곽)를 비교하는
 * dHash는 이런 케이스에서 실측으로 훨씬 잘 구분됨을 확인했다.
 */
export async function computeDifferenceHash(filePath: string, size = 16): Promise<string> {
  const { data } = await sharp(filePath)
    .grayscale()
    .resize(size + 1, size, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let hash = "";
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const left = data[row * (size + 1) + col];
      const right = data[row * (size + 1) + col + 1];
      hash += left < right ? "1" : "0";
    }
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

/**
 * 16x16 dHash = 256 bits. 실측 결과 진짜 동일 사진(다른 해상도)은 거리 1~6,
 * 실제로 다른 사진(같은 배경/톤)은 최소 14 이상으로 나뉘어서 10을 임계값으로 둔다.
 */
const DEFAULT_THRESHOLD = 10;

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
      const hash = await computeDifferenceHash(image.file);
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
