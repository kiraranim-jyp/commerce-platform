import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { ImageType } from "@commerce/shared";
import {
  loadImagePolicy,
  needsUpscale,
  type MarketplaceImagePolicy,
} from "../config/marketplace-policy";
import { storagePaths } from "../utils/storage-paths.util";
import type { ImageEnhancerProvider, StandardizedImage } from "../types/provider.types";

/**
 * 타입별 표준화 규칙 (TASK-IMG-105)
 * - PRODUCT: 배경제거된 제품이 캔버스 면적의 88~92%를 차지하도록 자동 확대,
 *   상하좌우 여백 균등(중앙 정렬), 흰배경(JPG) + 투명배경(PNG), Crop 금지
 * - MODEL: 원본 구도/비율 유지. 1500x2000보다 이미 크면 원본 그대로 사용,
 *   작을 때만 긴 변 기준으로 확대. 강제 캔버스/패딩 없음, 색감 변경·자동 샤프닝 금지
 * - DETAIL: 원본 유지, 리사이즈는 규격을 초과할 때만(최소화), 텍스트 선명도 유지
 * - SIZE_CHART / 기타: 원본 유지 + 선명도 강화, 고품질 압축
 *
 * baseName을 명시하지 않으면 inputPath의 파일명(확장자 제외)을 사용한다.
 * 파이프라인에서 임시 보정 파일(.enhanced.png 등)을 입력으로 넘길 때는
 * 최종 출력 파일명이 임시 파일명과 겹치지 않도록 baseName을 원본 파일명으로 명시해야 한다.
 */
export async function standardizeImage(
  inputPath: string,
  outputDir: string,
  type: ImageType,
  enhancer: ImageEnhancerProvider,
  policy: MarketplaceImagePolicy = loadImagePolicy(),
  baseNameOverride?: string,
): Promise<StandardizedImage[]> {
  fs.mkdirSync(outputDir, { recursive: true });
  const baseName = baseNameOverride ?? path.parse(inputPath).name;

  switch (type) {
    case "PRODUCT":
      return standardizeProduct(inputPath, outputDir, baseName, policy, enhancer);
    case "MODEL":
      return [await standardizeModel(inputPath, outputDir, baseName, policy)];
    case "DETAIL":
      return [await resizeWithinBounds(inputPath, outputDir, baseName, policy)];
    default:
      return [await keepOriginalSharpened(inputPath, outputDir, baseName, policy)];
  }
}

async function standardizeProduct(
  inputPath: string,
  outputDir: string,
  baseName: string,
  policy: MarketplaceImagePolicy,
  enhancer: ImageEnhancerProvider,
): Promise<StandardizedImage[]> {
  const metadata = await sharp(inputPath).metadata();

  let workingPath = inputPath;
  let tempUpscaledPath: string | null = null;

  if (needsUpscale(metadata.width ?? 0, metadata.height ?? 0, policy)) {
    const scaleFactor = Math.max(
      policy.width / (metadata.width || policy.width),
      policy.height / (metadata.height || policy.height),
    );
    if (scaleFactor > 2) {
      console.warn(
        `[standardizer] ${baseName}: 원본이 너무 작아 ${scaleFactor.toFixed(1)}배 업스케일합니다 ` +
          `(${metadata.width}x${metadata.height} -> ${policy.width}x${policy.height}). 화질 열화 가능성이 있습니다.`,
      );
    }

    fs.mkdirSync(storagePaths.tmp, { recursive: true });
    tempUpscaledPath = path.join(storagePaths.tmp, `${baseName}-upscaled.png`);
    await enhancer.upscale(inputPath, tempUpscaledPath, policy.width, policy.height);
    workingPath = tempUpscaledPath;
  }

  const outputs = [
    await placeOnCanvasWithFillRatio(workingPath, outputDir, baseName, policy, "transparent"),
    await placeOnCanvasWithFillRatio(workingPath, outputDir, baseName, policy, "white"),
  ];

  if (tempUpscaledPath && fs.existsSync(tempUpscaledPath)) {
    fs.rmSync(tempUpscaledPath);
  }

  return outputs;
}

/**
 * 제품 Bounding Box(트림된 이미지 전체)가 캔버스 면적의 policy.productFillRatio를
 * 차지하도록 스케일을 계산한다. 단, 캔버스를 벗어나(Crop 필요) 버리지 않도록
 * "잘리지 않는 최대 스케일(maxScale)"을 절대 넘지 않는다 — 종횡비가 캔버스와
 * 크게 다른 제품은 목표 비율에 못 미칠 수 있지만 Crop 금지가 우선한다.
 */
async function placeOnCanvasWithFillRatio(
  inputPath: string,
  outputDir: string,
  baseName: string,
  policy: MarketplaceImagePolicy,
  mode: "white" | "transparent",
): Promise<StandardizedImage> {
  const metadata = await sharp(inputPath).metadata();
  const w0 = metadata.width ?? policy.width;
  const h0 = metadata.height ?? policy.height;

  const maxScale = Math.min(policy.width / w0, policy.height / h0);
  const idealScale = Math.sqrt(
    (policy.productFillRatio * policy.width * policy.height) / (w0 * h0),
  );
  const scale = Math.min(idealScale, maxScale);

  const targetWidth = Math.max(1, Math.round(w0 * scale));
  const targetHeight = Math.max(1, Math.round(h0 * scale));

  const resized = await sharp(inputPath)
    .resize(targetWidth, targetHeight, { fit: "fill" })
    .toBuffer({ resolveWithObject: true });

  const background =
    mode === "transparent" ? { r: 0, g: 0, b: 0, alpha: 0 } : { r: 255, g: 255, b: 255, alpha: 1 };

  // 상하좌우 여백을 균등(중앙 정렬)하게 배치한다.
  const left = Math.round((policy.width - resized.info.width) / 2);
  const top = Math.round((policy.height - resized.info.height) / 2);

  const canvas = sharp({
    create: { width: policy.width, height: policy.height, channels: 4, background },
  }).composite([{ input: resized.data, left, top }]);

  if (mode === "transparent") {
    const file = path.join(outputDir, `${baseName}.png`);
    await canvas.png().toFile(file);
    return {
      fileName: `${baseName}.png`,
      file,
      format: "png",
      width: policy.width,
      height: policy.height,
    };
  }

  const file = path.join(outputDir, `${baseName}.jpg`);
  await canvas
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: policy.jpegQuality })
    .toFile(file);
  return {
    fileName: `${baseName}.jpg`,
    file,
    format: "jpg",
    width: policy.width,
    height: policy.height,
  };
}

/**
 * 원본 구도/비율을 그대로 유지한다. 이미 규격(1500x2000) 이상이면 손대지 않고,
 * 작을 때만 긴 변 기준으로 확대한다. 강제 캔버스/패딩과 샤프닝, 색감 보정은 하지 않는다.
 */
async function standardizeModel(
  inputPath: string,
  outputDir: string,
  baseName: string,
  policy: MarketplaceImagePolicy,
): Promise<StandardizedImage> {
  const metadata = await sharp(inputPath).metadata();
  const w0 = metadata.width ?? 0;
  const h0 = metadata.height ?? 0;
  const file = path.join(outputDir, `${baseName}.jpg`);

  if (w0 >= policy.width && h0 >= policy.height) {
    const info = await sharp(inputPath).jpeg({ quality: policy.jpegQuality }).toFile(file);
    return {
      fileName: `${baseName}.jpg`,
      file,
      format: "jpg",
      width: info.width,
      height: info.height,
    };
  }

  const info = await sharp(inputPath)
    .resize(policy.width, policy.height, { fit: "inside", withoutEnlargement: false })
    .jpeg({ quality: policy.jpegQuality })
    .toFile(file);
  return {
    fileName: `${baseName}.jpg`,
    file,
    format: "jpg",
    width: info.width,
    height: info.height,
  };
}

/** DETAIL: 규격을 초과할 때만 축소하고, 작은 이미지는 확대하지 않는다(리사이즈 최소화). */
async function resizeWithinBounds(
  inputPath: string,
  outputDir: string,
  baseName: string,
  policy: MarketplaceImagePolicy,
): Promise<StandardizedImage> {
  const file = path.join(outputDir, `${baseName}.jpg`);
  const info = await sharp(inputPath)
    .resize(policy.width, policy.height, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: policy.jpegQuality })
    .toFile(file);
  return {
    fileName: `${baseName}.jpg`,
    file,
    format: "jpg",
    width: info.width,
    height: info.height,
  };
}

async function keepOriginalSharpened(
  inputPath: string,
  outputDir: string,
  baseName: string,
  policy: MarketplaceImagePolicy,
): Promise<StandardizedImage> {
  const file = path.join(outputDir, `${baseName}.jpg`);
  const info = await sharp(inputPath)
    .sharpen({ sigma: 1.2 })
    .jpeg({ quality: Math.max(policy.jpegQuality, 95) })
    .toFile(file);
  return {
    fileName: `${baseName}.jpg`,
    file,
    format: "jpg",
    width: info.width,
    height: info.height,
  };
}
