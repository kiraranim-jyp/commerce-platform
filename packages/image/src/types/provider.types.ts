import type { ImageType } from "@commerce/shared";

export interface ClassificationResult {
  type: ImageType;
  confidence: number;
}

/** 이미지 분류 Provider. Gemini/OpenAI/RuleBase 등으로 교체 가능하다. */
export interface ImageClassifierProvider {
  classify(filePath: string): Promise<ClassificationResult>;
}

/** 배경제거 Provider. 로컬 ONNX 모델 외에 rembg, remove.bg, PhotoRoom 등으로 교체 가능하다. */
export interface BackgroundRemoverProvider {
  remove(inputPath: string, outputPath: string): Promise<void>;
}

/** 화질 보정/업스케일 Provider. */
export interface ImageEnhancerProvider {
  enhance(inputPath: string, outputPath: string): Promise<void>;
  upscale(
    inputPath: string,
    outputPath: string,
    targetWidth: number,
    targetHeight: number,
  ): Promise<void>;
}

export interface OptimizedImage {
  fileName: string;
  file: string;
  format: "jpg" | "png" | "webp";
  bytes: number;
}

/** 압축/포맷 변환(JPG/PNG/WebP) Provider. */
export interface ImageOptimizerProvider {
  optimize(inputPath: string): Promise<OptimizedImage[]>;
}

export interface StandardizedImage {
  fileName: string;
  file: string;
  format: "jpg" | "png";
  width: number;
  height: number;
}
