import sharp from "sharp";
import type { ClassificationResult, ImageClassifierProvider } from "../../types/provider.types";

/**
 * AI 없이 동작하는 최종 폴백 분류기. 비전 모델 호출이 실패했을 때만 사용된다.
 * 정확도가 낮으므로 항상 낮은 confidence를 부여해 사람 검수 모드에서
 * 우선적으로 재확인 대상이 되도록 한다.
 */
export class RuleBaseClassifierProvider implements ImageClassifierProvider {
  async classify(filePath: string): Promise<ClassificationResult> {
    const metadata = await sharp(filePath).metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    const ratio = width && height ? width / height : 1;

    if (ratio > 2.2 || ratio < 0.45) {
      // 매우 가늘고 긴 이미지는 사이즈표/배너일 가능성이 높다.
      return { type: "SIZE_CHART", confidence: 0.3 };
    }

    // 상품 갤러리에 남아있는 이미지는 대부분 제품 사진이라는 약한 사전 확률을 사용한다.
    return { type: "PRODUCT", confidence: 0.3 };
  }
}
