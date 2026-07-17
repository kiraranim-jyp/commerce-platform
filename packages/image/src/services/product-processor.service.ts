import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { storagePaths } from "../utils/storage-paths.util";
import type { BackgroundRemoverProvider } from "../types/provider.types";

export interface ProcessedProductImage {
  fileName: string;
  file: string;
}

/**
 * 배경제거 모델(특히 가벼운 "small" 모델)은 완전한 배경 영역 곳곳에 산발적인
 * 잔류 알파값(수십~수백 단위로 흩어진 작은 얼룩)을 남긴다. 원본 해상도에서는
 * 눈에 안 띄지만, 이후 Standardizer가 1500x2000으로 확대하면 이 얼룩들이
 * 흐릿한 노이즈로 확대되어 보인다.
 *
 * 단순 threshold(낮은 알파값을 0으로)만으로는 부족했다 — 실측해보니 노이즈
 * 얼룩의 알파값이 threshold=30 정도로는 못 잡을 만큼 높게(100~200대) 나오는
 * 경우가 있었다. 대신 median 필터로 먼저 "작고 고립된 얼룩"을 제거한다(제품
 * 실루엣처럼 크고 연결된 영역은 median에도 살아남고, 노이즈처럼 작은 점들은
 * 주변 배경값으로 뭉개진다). median 결과에 최종 threshold(128)를 적용해
 * 완전한 이진(배경/전경) 알파 매트를 만든다.
 *
 * sharp의 median()은 단일 채널 raw 버퍼를 내부적으로 3채널 sRGB로 승격시키는
 * 것으로 보여서, 처리 후 toColourspace("b-w")로 명시적으로 1채널로 되돌려야
 * 채널 수가 어긋나지 않는다.
 */
const ALPHA_MEDIAN_KERNEL_SIZE = 9;
const ALPHA_THRESHOLD = 128;

async function cleanAlphaNoise(inputPath: string): Promise<Buffer> {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const alpha = Buffer.alloc(width * height);
  for (let i = 0, p = 3; i < alpha.length; i++, p += channels) alpha[i] = data[p];

  const medianed = await sharp(alpha, { raw: { width, height, channels: 1 } })
    .median(ALPHA_MEDIAN_KERNEL_SIZE)
    .toColourspace("b-w")
    .raw()
    .toBuffer();

  for (let i = 0, p = 3; i < medianed.length; i++, p += channels) {
    if (medianed[i] < ALPHA_THRESHOLD) data[p] = 0;
  }

  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

/** 이미지 1장을 배경제거 -> 알파 노이즈 정리 -> 투명 여백 트림까지 처리한다. */
export async function processProductImage(
  file: string,
  remover: BackgroundRemoverProvider,
): Promise<ProcessedProductImage> {
  const outputDir = storagePaths.processed("product");
  fs.mkdirSync(outputDir, { recursive: true });

  const baseName = path.parse(file).name;
  const outFile = path.join(outputDir, `${baseName}.png`);
  const tmpFile = `${outFile}.tmp.png`;

  await remover.remove(file, tmpFile);
  const cleaned = await cleanAlphaNoise(tmpFile);
  await sharp(cleaned).trim().png().toFile(outFile);
  fs.rmSync(tmpFile);

  return { fileName: `${baseName}.png`, file: outFile };
}

/**
 * PRODUCT로 분류된 이미지만 배경제거 -> 투명 여백 트림을 거쳐
 * storage/processed/product/ 에 PNG로 저장한다.
 * 중앙 정렬 및 표준 캔버스 배치는 Standardizer가 담당한다.
 */
export async function processProductImages(
  files: string[],
  remover: BackgroundRemoverProvider,
): Promise<ProcessedProductImage[]> {
  const results: ProcessedProductImage[] = [];
  for (const file of files) {
    results.push(await processProductImage(file, remover));
  }
  return results;
}
