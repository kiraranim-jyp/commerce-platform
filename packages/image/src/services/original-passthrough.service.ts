import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const JPEG_QUALITY_STEPS = [90, 80, 70, 60, 50, 40];

export interface PassthroughResult {
  file: string;
  fileName: string;
  format: "jpg" | "png";
  bytes: number;
  width: number;
  height: number;
}

/**
 * 기본 상품 등록 흐름의 PRODUCT 이미지 처리 정책 — AI 배경제거/강제 캔버스 없이
 * 원본 구도와 비율을 그대로 보존한다.
 *
 * JPG/PNG이고 10MB 이하면 원본 바이트를 그대로 복사한다(재인코딩하지 않음 —
 * 화질 저하나 구도 변경이 전혀 없다). 그 외 확장자거나 10MB를 넘으면 JPG로
 * 변환한다(투명 배경은 흰색으로 합성) — 10MB 이하가 될 때까지 품질을 단계적으로
 * 낮춘다.
 */
export async function preserveOriginalForCommerce(
  inputPath: string,
  outputDir: string,
  baseName: string,
): Promise<PassthroughResult> {
  fs.mkdirSync(outputDir, { recursive: true });
  const metadata = await sharp(inputPath).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const stat = fs.statSync(inputPath);
  const sourceFormat = metadata.format;

  const isPassthroughFormat = sourceFormat === "jpeg" || sourceFormat === "png";
  if (isPassthroughFormat && stat.size <= MAX_BYTES) {
    const format = sourceFormat === "jpeg" ? "jpg" : "png";
    const fileName = `${baseName}.${format}`;
    const file = path.join(outputDir, fileName);
    fs.copyFileSync(inputPath, file);
    return { file, fileName, format, bytes: stat.size, width, height };
  }

  const fileName = `${baseName}.jpg`;
  const file = path.join(outputDir, fileName);
  let buffer: Buffer = Buffer.alloc(0);
  for (const quality of JPEG_QUALITY_STEPS) {
    buffer = await sharp(inputPath)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality, progressive: true, mozjpeg: true })
      .toBuffer();
    if (buffer.byteLength <= MAX_BYTES) break;
  }
  fs.writeFileSync(file, buffer);
  return { file, fileName, format: "jpg", bytes: buffer.byteLength, width, height };
}
