import fs from "node:fs";
import path from "node:path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { IMAGE_TYPES, type ImageType } from "@commerce/shared";
import type { ClassificationResult, ImageClassifierProvider } from "../../types/provider.types";

const PROMPT = `너는 이커머스 상품 이미지를 분류하는 전문가다. 아래 카테고리 중 정확히 하나를 선택하고,
반드시 JSON만 출력한다 (설명 문장 금지).

- MODEL: 사람(모델)이 착용/사용하는 사진
- PRODUCT: 제품 단독 컷 (모델 없음)
- DETAIL: 제품의 부분/재질/디테일 확대컷
- SIZE_CHART: 사이즈표, 치수 안내 이미지
- PACKAGE: 포장, 박스, 구성품 사진
- UNKNOWN: 위 어디에도 해당하지 않음

출력 형식: {"type": "PRODUCT", "confidence": 0.95}
confidence는 0과 1 사이의 소수로, 분류 확신도를 의미한다.`;

/** Gemini Vision(무료 티어) 기반 1차 분류기. */
export class GeminiClassifierProvider implements ImageClassifierProvider {
  private readonly apiKey: string;
  private readonly client: GoogleGenerativeAI;
  private readonly modelName: string;

  constructor(
    apiKey: string = process.env.GEMINI_API_KEY ?? "",
    modelName: string = process.env.GEMINI_MODEL ?? "gemini-flash-latest",
  ) {
    // 생성자에서 던지지 않는다: CompositeClassifierProvider가 classify() 호출 단위로
    // 실패를 감지해 RuleBase로 폴백해야 하기 때문이다.
    this.apiKey = apiKey;
    this.client = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
  }

  async classify(filePath: string): Promise<ClassificationResult> {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");
    }

    const model = this.client.getGenerativeModel({
      model: this.modelName,
      generationConfig: { responseMimeType: "application/json" },
    });

    const base64 = fs.readFileSync(filePath).toString("base64");
    const mimeType = path.extname(filePath).toLowerCase() === ".png" ? "image/png" : "image/jpeg";

    const result = await model.generateContent([
      PROMPT,
      { inlineData: { data: base64, mimeType } },
    ]);

    return parseResult(result.response.text());
  }
}

function parseResult(text: string): ClassificationResult {
  try {
    const parsed = JSON.parse(text) as { type?: string; confidence?: number };
    const type = isImageType(parsed.type) ? parsed.type : "UNKNOWN";
    const confidence = typeof parsed.confidence === "number" ? clamp01(parsed.confidence) : 0;
    return { type, confidence };
  } catch {
    return { type: "UNKNOWN", confidence: 0 };
  }
}

function isImageType(value: unknown): value is ImageType {
  return typeof value === "string" && (IMAGE_TYPES as readonly string[]).includes(value);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
