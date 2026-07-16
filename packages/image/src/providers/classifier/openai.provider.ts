import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { IMAGE_TYPES, type ImageType } from "@commerce/shared";
import type { ClassificationResult, ImageClassifierProvider } from "../../types/provider.types";

const SYSTEM_PROMPT = `너는 이커머스 상품 이미지를 분류하는 전문가다. 아래 카테고리 중 정확히 하나를 선택하고,
반드시 JSON만 출력한다 (설명 문장 금지).

- MODEL: 사람(모델)이 착용/사용하는 사진
- PRODUCT: 제품 단독 컷 (모델 없음)
- DETAIL: 제품의 부분/재질/디테일 확대컷
- SIZE_CHART: 사이즈표, 치수 안내 이미지
- PACKAGE: 포장, 박스, 구성품 사진
- UNKNOWN: 위 어디에도 해당하지 않음

출력 형식: {"type": "PRODUCT", "confidence": 0.95}
confidence는 0과 1 사이의 소수로, 분류 확신도를 의미한다.`;

/** 유료 옵션. Gemini 무료 티어로 부족할 때 교체용으로 사용한다. */
export class OpenAIClassifierProvider implements ImageClassifierProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(client?: OpenAI, model: string = process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini") {
    this.client = client ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.model = model;
  }

  async classify(filePath: string): Promise<ClassificationResult> {
    const base64 = fs.readFileSync(filePath).toString("base64");
    const mime = path.extname(filePath).toLowerCase() === ".png" ? "image/png" : "image/jpeg";

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "이 이미지를 분류해줘." },
            { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 100,
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    return parseResult(content);
  }
}

function parseResult(content: string): ClassificationResult {
  try {
    const parsed = JSON.parse(content) as { type?: string; confidence?: number };
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
