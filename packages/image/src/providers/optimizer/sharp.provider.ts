import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { MarketplaceImagePolicy } from "../../config/marketplace-policy";
import { loadImagePolicy } from "../../config/marketplace-policy";
import { storagePaths } from "../../utils/storage-paths.util";
import type { ImageOptimizerProvider, OptimizedImage } from "../../types/provider.types";
import { JPEG_QUALITY_DEFAULT } from "../../utils/jpeg.util";

/**
 * 최종 산출물은 항상 JPG로 통일한다(원본 확장자와 무관, 투명 배경은 흰 배경에
 * 합성) — 커머스 플랫폼 등록 payload와 ZIP export 어디에도 PNG/WEBP가 "최종
 * 파일"로 노출되지 않는다. WEBP는 참고용 보조 산출물로만 별도 생성한다.
 */
export class SharpOptimizerProvider implements ImageOptimizerProvider {
  constructor(private readonly policy: MarketplaceImagePolicy = loadImagePolicy()) {}

  async optimize(inputPath: string): Promise<OptimizedImage[]> {
    const baseName = path.parse(inputPath).name;
    const source = sharp(inputPath);
    const results: OptimizedImage[] = [];

    const webpDir = storagePaths.optimized("webp");
    fs.mkdirSync(webpDir, { recursive: true });
    const webpFile = path.join(webpDir, `${baseName}.webp`);
    await source
      .clone()
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .webp({ quality: Math.max(this.policy.jpegQuality - 5, 70) })
      .toFile(webpFile);
    results.push({
      fileName: `${baseName}.webp`,
      file: webpFile,
      format: "webp",
      bytes: fs.statSync(webpFile).size,
    });

    const jpgDir = storagePaths.optimized("jpg");
    fs.mkdirSync(jpgDir, { recursive: true });
    const jpgFile = path.join(jpgDir, `${baseName}.jpg`);
    await source
      .clone()
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: JPEG_QUALITY_DEFAULT, progressive: true, mozjpeg: true })
      .toFile(jpgFile);
    results.push({
      fileName: `${baseName}.jpg`,
      file: jpgFile,
      format: "jpg",
      bytes: fs.statSync(jpgFile).size,
    });

    return results;
  }
}
