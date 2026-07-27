import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { storagePaths } from "../utils/storage-paths.util";
import type { BackgroundRemoverProvider } from "../types/provider.types";
import {
  componentsAboveRelativeSize,
  labelComponents,
  MIN_COMPONENT_AREA_RATIO,
} from "../utils/connected-components.util";
import { scoreSegmentation, type QualityScore } from "./quality-score.service";

export interface ProcessedProductImage {
  fileName: string;
  file: string;
  quality: QualityScore;
}

/**
 * 배경제거 모델(특히 가벼운 "small" 모델)은 완전한 배경 영역 곳곳에 산발적인
 * 잔류 알파값을 남긴다. 원본 해상도에서는 눈에 안 띄지만, 이후 Standardizer가
 * 1500x2000으로 확대하면 이 얼룩들이 흐릿한 노이즈로 확대되어 보인다.
 *
 * median 필터 + 단순 threshold만으로는 부족하다 — 제품과 배경의 색 대비가
 * 약한 이미지(예: 크림색 니트)에서는 모델이 배경 일부를 어느 정도 크기가 있는
 * 뭉텅이(알파 100~200대)로 오인식하는데, 이 뭉텅이가 9x9 median보다 크면
 * 살아남고 threshold(128)보다 높은 알파값을 가지면 그대로 통과해버린다.
 *
 * 그래서 "얼마나 흐릿한가"가 아니라 "제품 실루엣과 붙어 있는가"로 판단한다.
 * 얼룩은 정의상 제품 몸통과 떨어진 섬(connected component)이므로, 이진화된
 * 마스크에서 덩어리별 크기를 비교해 지운다.
 *
 * 다만 "가장 큰 덩어리 1개만" 남기면 안 된다 — 신발 한 켤레처럼 서로 붙어있지
 * 않은 두 개의 실제 상품이 한 사진에 있는 경우, 둘 중 작은 쪽(다른 한 짝)까지
 * 통째로 지워지는 회귀가 있었다. 그래서 가장 큰 덩어리 대비 상대 크기가
 * MIN_COMPONENT_AREA_RATIO 이상인 덩어리는 모두 유지한다 — 진짜 노이즈 얼룩은
 * 보통 실루엣보다 훨씬 작아서 이 기준에 걸리지 않는다.
 *
 * sharp의 median()은 단일 채널 raw 버퍼를 내부적으로 3채널 sRGB로 승격시키는
 * 것으로 보여서, 처리 후 toColourspace("b-w")로 명시적으로 1채널로 되돌려야
 * 채널 수가 어긋나지 않는다.
 */
const ALPHA_MEDIAN_KERNEL_SIZE = 9;
const ALPHA_THRESHOLD = 128;

async function cleanAlphaNoise(
  inputPath: string,
): Promise<{ buffer: Buffer; quality: QualityScore }> {
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

  const binary = new Uint8Array(medianed.length);
  for (let i = 0; i < medianed.length; i++) binary[i] = medianed[i] >= ALPHA_THRESHOLD ? 1 : 0;

  const quality = scoreSegmentation({ rawAlpha: alpha, binary, width, height });

  const { labels, sizes } = labelComponents(binary, width, height);
  const keptLabels = componentsAboveRelativeSize(sizes, MIN_COMPONENT_AREA_RATIO);

  for (let i = 0, p = 3; i < labels.length; i++, p += channels) {
    if (!keptLabels.has(labels[i])) data[p] = 0;
  }

  const buffer = await sharp(data, { raw: { width, height, channels } }).png().toBuffer();
  return { buffer, quality };
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
  const { buffer: cleaned, quality } = await cleanAlphaNoise(tmpFile);
  await sharp(cleaned).trim().png().toFile(outFile);
  fs.rmSync(tmpFile);

  return { fileName: `${baseName}.png`, file: outFile, quality };
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
