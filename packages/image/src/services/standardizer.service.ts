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
 * 타입별 표준화 규칙
 * - PRODUCT: 표준 캔버스에 중앙정렬, 흰배경(JPG) + 투명배경(PNG) 둘 다 생성
 * - MODEL: 누끼 없이 표준 캔버스에 흰 여백 추가 (JPG), Crop 금지
 * - DETAIL: 원본 비율 유지, 표준 규격 이내로 리사이즈만 (캔버스 없음)
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

  const metadata = await sharp(inputPath).metadata();
  const baseName = baseNameOverride ?? path.parse(inputPath).name;

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

  let outputs: StandardizedImage[];
  switch (type) {
    case "PRODUCT":
      outputs = [
        await placeOnCanvas(workingPath, outputDir, baseName, policy, "transparent"),
        await placeOnCanvas(workingPath, outputDir, baseName, policy, "white"),
      ];
      break;
    case "MODEL":
      outputs = [await placeOnCanvas(workingPath, outputDir, baseName, policy, "white")];
      break;
    case "DETAIL":
      outputs = [await resizeWithinBounds(workingPath, outputDir, baseName, policy)];
      break;
    default:
      outputs = [await keepOriginalSharpened(workingPath, outputDir, baseName, policy)];
      break;
  }

  if (tempUpscaledPath && fs.existsSync(tempUpscaledPath)) {
    fs.rmSync(tempUpscaledPath);
  }

  return outputs;
}

async function placeOnCanvas(
  inputPath: string,
  outputDir: string,
  baseName: string,
  policy: MarketplaceImagePolicy,
  mode: "white" | "transparent",
): Promise<StandardizedImage> {
  const resized = await sharp(inputPath)
    .resize(policy.width, policy.height, { fit: "inside", withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });

  const background =
    mode === "transparent" ? { r: 0, g: 0, b: 0, alpha: 0 } : { r: 255, g: 255, b: 255, alpha: 1 };

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
