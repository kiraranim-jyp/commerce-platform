import type { ClassificationResult, ImageClassifierProvider } from "../../types/provider.types";

/**
 * 1차 Provider(Gemini 등) 호출 실패 시 2차 Provider(RuleBase)로 폴백하고,
 * 그마저 실패하면 UNKNOWN을 반환한다.
 */
export class CompositeClassifierProvider implements ImageClassifierProvider {
  constructor(
    private readonly primary: ImageClassifierProvider,
    private readonly fallback: ImageClassifierProvider,
  ) {}

  async classify(filePath: string): Promise<ClassificationResult> {
    try {
      return await this.primary.classify(filePath);
    } catch (error) {
      console.warn(`[classifier] 1차 분류 실패, RuleBase로 폴백: ${(error as Error).message}`);
      try {
        return await this.fallback.classify(filePath);
      } catch {
        return { type: "UNKNOWN", confidence: 0 };
      }
    }
  }
}
