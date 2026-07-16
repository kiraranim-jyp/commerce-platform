import sharp from "sharp";
import type { ImageEnhancerProvider } from "../../types/provider.types";

/** 무료 1차 구현. 추후 진짜 Super Resolution(Real-ESRGAN 등)으로 교체 가능하다. */
export class SharpEnhancerProvider implements ImageEnhancerProvider {
  async enhance(inputPath: string, outputPath: string): Promise<void> {
    await sharp(inputPath)
      .median(3) // 노이즈 제거
      .normalize() // 밝기/대비 자동 보정
      .modulate({ saturation: 1.05 }) // 색감 보정
      .sharpen({ sigma: 1 }) // 선명도 향상
      .toFile(outputPath);
  }

  async upscale(
    inputPath: string,
    outputPath: string,
    targetWidth: number,
    targetHeight: number,
  ): Promise<void> {
    await sharp(inputPath)
      .resize(targetWidth, targetHeight, {
        kernel: "lanczos3",
        fit: "inside",
        withoutEnlargement: false,
      })
      .sharpen({ sigma: 0.8 })
      .toFile(outputPath);
  }
}
