import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { storagePaths } from "../utils/storage-paths.util";
import type { BackgroundRemoverProvider } from "../types/provider.types";

export interface ProcessedProductImage {
  fileName: string;
  file: string;
}

/** 이미지 1장을 배경제거 -> 투명 여백 트림까지 처리한다. */
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
  await sharp(tmpFile).trim().png().toFile(outFile);
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
