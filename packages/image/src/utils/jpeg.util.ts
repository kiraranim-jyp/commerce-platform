import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

/**
 * CartPilot의 모든 최종 산출 이미지(original/thumbnail/detail, 플랫폼 등록 payload에
 * 들어가는 이미지)는 원본 포맷(WEBP/PNG/AVIF/JPEG 등)과 무관하게 JPG로 통일한다 —
 * 나중에 실제 쿠팡/스마트스토어 API 인증을 붙였을 때 이미지 포맷 때문에 등록이
 * 실패하는 문제를 미리 차단하기 위해서다. 투명 배경은 흰 배경에 합성한 뒤 인코딩한다
 * (JPEG는 투명도를 지원하지 않는다).
 */
export const JPEG_QUALITY_DEFAULT = 90;

export interface JpegConversionResult {
  file: string;
  fileName: string;
  width: number;
  height: number;
  bytes: number;
}

/** outputPath는 반드시 .jpg 확장자여야 한다 — 파일명과 실제 인코딩 포맷이 항상 일치해야 한다. */
export async function ensureJpeg(
  inputPath: string,
  outputPath: string,
  quality: number = JPEG_QUALITY_DEFAULT,
): Promise<JpegConversionResult> {
  if (path.extname(outputPath).toLowerCase() !== ".jpg") {
    throw new Error(`ensureJpeg: 출력 경로는 .jpg 확장자여야 합니다 (받은 값: ${outputPath})`);
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const info = await sharp(inputPath)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality, progressive: true })
    .toFile(outputPath);

  return {
    file: outputPath,
    fileName: path.basename(outputPath),
    width: info.width,
    height: info.height,
    bytes: info.size,
  };
}

export interface JpegValidationResult {
  isJPEG: boolean;
  width?: number;
  height?: number;
  bytes?: number;
  failureReason?: string;
}

/**
 * 등록 직전 이미지 검증: 파일 존재 -> 확장자 .jpg -> 실제 디코딩 가능한 JPEG인지
 * (sharp가 인식한 format이 "jpeg") -> width/height -> 파일 크기 순으로 확인한다.
 * 파일명과 실제 인코딩 포맷이 다른 경우(예: 내용은 PNG인데 이름만 .jpg)를 여기서 잡는다.
 */
export async function validateJpegFile(filePath: string): Promise<JpegValidationResult> {
  if (!fs.existsSync(filePath)) {
    return { isJPEG: false, failureReason: "파일이 존재하지 않습니다." };
  }
  if (path.extname(filePath).toLowerCase() !== ".jpg") {
    return { isJPEG: false, failureReason: "확장자가 .jpg가 아닙니다." };
  }

  try {
    const metadata = await sharp(filePath).metadata();
    if (metadata.format !== "jpeg") {
      return {
        isJPEG: false,
        failureReason: `실제 파일 형식이 JPEG가 아닙니다 (감지된 형식: ${metadata.format ?? "알 수 없음"}).`,
      };
    }
    if (!metadata.width || !metadata.height) {
      return { isJPEG: false, failureReason: "이미지 크기를 확인할 수 없습니다." };
    }
    const bytes = fs.statSync(filePath).size;
    if (bytes === 0) {
      return { isJPEG: false, failureReason: "파일 크기가 0바이트입니다." };
    }
    return { isJPEG: true, width: metadata.width, height: metadata.height, bytes };
  } catch (error) {
    return {
      isJPEG: false,
      failureReason: `JPEG 디코딩에 실패했습니다: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
