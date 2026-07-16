import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { MarketplaceImagePolicy } from "../../config/marketplace-policy";
import { loadImagePolicy } from "../../config/marketplace-policy";
import { storagePaths } from "../../utils/storage-paths.util";
import type { ImageOptimizerProvider, OptimizedImage } from "../../types/provider.types";

/** PNG(투명)은 png+webp로, JPG는 jpg+webp로 압축 최적화하여 optimized/{format}/ 에 저장한다. */
export class SharpOptimizerProvider implements ImageOptimizerProvider {
  constructor(private readonly policy: MarketplaceImagePolicy = loadImagePolicy()) {}

  async optimize(inputPath: string): Promise<OptimizedImage[]> {
    const baseName = path.parse(inputPath).name;
    const isPng = path.extname(inputPath).toLowerCase() === ".png";
    const source = sharp(inputPath);
    const results: OptimizedImage[] = [];

    const webpDir = storagePaths.optimized("webp");
    fs.mkdirSync(webpDir, { recursive: true });
    const webpFile = path.join(webpDir, `${baseName}.webp`);
    await source
      .clone()
      .webp({ quality: Math.max(this.policy.jpegQuality - 5, 70) })
      .toFile(webpFile);
    results.push({
      fileName: `${baseName}.webp`,
      file: webpFile,
      format: "webp",
      bytes: fs.statSync(webpFile).size,
    });

    if (isPng) {
      const pngDir = storagePaths.optimized("png");
      fs.mkdirSync(pngDir, { recursive: true });
      const pngFile = path.join(pngDir, `${baseName}.png`);
      await source.clone().png({ compressionLevel: 9, quality: 90 }).toFile(pngFile);
      results.push({
        fileName: `${baseName}.png`,
        file: pngFile,
        format: "png",
        bytes: fs.statSync(pngFile).size,
      });
    } else {
      const jpgDir = storagePaths.optimized("jpg");
      fs.mkdirSync(jpgDir, { recursive: true });
      const jpgFile = path.join(jpgDir, `${baseName}.jpg`);
      await source
        .clone()
        .jpeg({ quality: this.policy.jpegQuality, mozjpeg: true })
        .toFile(jpgFile);
      results.push({
        fileName: `${baseName}.jpg`,
        file: jpgFile,
        format: "jpg",
        bytes: fs.statSync(jpgFile).size,
      });
    }

    return results;
  }
}
