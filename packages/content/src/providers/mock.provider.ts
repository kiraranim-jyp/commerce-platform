import type { CanonicalProduct, ProvenanceField } from "@commerce/shared";
import { classifyProductType } from "@commerce/category";
import { KOREAN_TYPE_LABELS } from "../korean-labels";
import type { ProductContentProvider } from "../provider";

/**
 * AI Safety: 이 파일이 참조하는 값은 CanonicalProduct에 이미 들어있는 확인된
 * 필드(brand/material/description/options)와 classifyProductType()이 키워드
 * 매칭으로 뽑아낸 상품 유형뿐이다. 성별/연령/원산지/배송기간/할인정보/인증
 * 여부처럼 원본 어디에도 없는 값은 이 파일 어디에서도 만들어내지 않는다 —
 * 실제 LLM Provider로 교체되더라도 이 원칙(입력에 없으면 출력하지 않는다)은
 * 프롬프트 설계에서도 그대로 지켜야 한다.
 */

/**
 * 🔴 P5.6 Phase 5 — 이름이 `safe` 인데 «안전하지 않았다». `value.trim()` 을 바로
 *    불러서, 필드가 없는 구형/부분 fixture 를 넘기면 터진다(실제로 터졌다:
 *    description-autowrite-ux05 가 잡았다). 이름대로 동작하게 고친다 —
 *    호출부가 `?.` 를 일일이 붙이는 것보다 여기 한 곳이 맞다.
 */
function safeTrim(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function topType(product: CanonicalProduct) {
  return classifyProductType(product)[0];
}

function generateTitle(product: CanonicalProduct): ProvenanceField<string> {
  const brand = safeTrim(product.brand.value);
  const top = topType(product);
  const koreanType = top ? KOREAN_TYPE_LABELS[top.type] : undefined;

  const parts = [brand, koreanType].filter(Boolean) as string[];
  if (parts.length === 0) {
    return {
      value: product.title.value || "상품명 미확인",
      source: "AI_GENERATED",
      confidence: 0.3,
    };
  }

  return {
    value: parts.join(" "),
    source: "AI_GENERATED",
    confidence: brand && koreanType ? 0.9 : 0.6,
  };
}

function generateDescription(product: CanonicalProduct): ProvenanceField<string> {
  const brand = safeTrim(product.brand.value);
  const material = safeTrim(product.material.value);
  const options = product.options.value;
  const originalDescription = safeTrim(product.description.value);
  const top = topType(product);
  const koreanType = top ? KOREAN_TYPE_LABELS[top.type] : undefined;

  /* ━━ P5.6 Phase 5(CPO 승인, 2026-10-09) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     🔴 결함 둘을 고친다.

     ① `product.options` 는 **deprecated** 필드다 — 옵션 «이름» 만 들어 있다
        (`product-types.ts:659`). 실제 선택지는 `optionGroups` 에 있다.
        그래서 지금까지 상세설명에 "옵션: Size" 처럼 «값이 없는» 줄이 나갔다.
        실측: Smallable Dalila 는 optionGroups=[{사이즈:[2·3·4·6·8·10 years]}] 다.
     ② 색상이 빠져 있었다. `product.color` 에 원문 값이 있는데 쓰지 않았다.

     🔴 **없는 사실은 만들지 않는다.** 아래 전부가 상품 필드에서 «그대로» 온다 —
        비어 있으면 그 줄 자체를 넣지 않는다. 추정·보간·기본값이 없다. */
  const color = safeTrim(product.color?.value);
  /* 🔴 값이 있는 축만 쓴다. 축 이름만 있고 값이 비면 셀러에게 줄 정보가 없다. */
  const optionLines = (product.optionGroups ?? [])
    .filter((g) => g.name?.trim() && g.values.length > 0)
    .map((g) => `${g.name.trim()}: ${g.values.join(", ")}`);

  const lines: string[] = [];
  if (brand) lines.push(`브랜드: ${brand}`);
  if (koreanType) lines.push(`상품 종류: ${koreanType}`);
  if (color) lines.push(`색상: ${color}`);
  if (material) lines.push(`소재: ${material}`);
  if (optionLines.length > 0) lines.push(...optionLines.map((l) => `옵션 ${l}`));
  /* 🔴 구형 데이터 폴백 — optionGroups 가 없던 시절 snapshot 은 이름이라도 남긴다.
     새 데이터에서는 위 optionLines 가 이미 채워져 이 줄이 돌지 않는다. */
  else if (options.length > 0) lines.push(`옵션: ${options.join(", ")}`);
  if (originalDescription) lines.push(`원문 설명: "${originalDescription}"`);

  if (lines.length === 0) {
    return { value: "", source: "AI_GENERATED", confidence: 0 };
  }

  return {
    value: lines.join("\n"),
    source: "AI_GENERATED",
    confidence: Math.min(0.95, 0.35 + lines.length * 0.15),
  };
}

function generateKeywords(product: CanonicalProduct): ProvenanceField<string[]> {
  const brand = safeTrim(product.brand.value);
  const material = safeTrim(product.material.value);
  const top = topType(product);
  const koreanType = top ? KOREAN_TYPE_LABELS[top.type] : undefined;

  const keywords: string[] = [];
  if (brand) keywords.push(brand);
  if (koreanType) keywords.push(koreanType);
  if (top) keywords.push(top.type.toLowerCase());
  if (material) keywords.push(material);
  if (brand && koreanType) keywords.push(`${brand} ${koreanType}`);

  const unique = Array.from(new Set(keywords.filter(Boolean)));
  const confidence = top ? Math.min(0.95, top.confidence) : brand ? 0.5 : 0.2;

  return { value: unique, source: "AI_GENERATED", confidence };
}

function generateSeo(product: CanonicalProduct): {
  title: ProvenanceField<string>;
  description: ProvenanceField<string>;
} {
  const titleField = generateTitle(product);
  const brand = safeTrim(product.brand.value);
  const top = topType(product);
  const koreanType = top ? KOREAN_TYPE_LABELS[top.type] : undefined;

  const seoTitle = truncate(`${titleField.value} | TTAEJYO`, 60);

  const summaryParts = [brand, koreanType].filter(Boolean) as string[];
  const seoDescriptionValue =
    summaryParts.length > 0
      ? truncate(`${summaryParts.join(" ")} — TTAEJYO에서 확인하세요.`, 150)
      : "";

  return {
    title: { value: seoTitle, source: "AI_GENERATED", confidence: titleField.confidence },
    description: {
      value: seoDescriptionValue,
      source: "AI_GENERATED",
      confidence: summaryParts.length > 0 ? 0.7 : 0,
    },
  };
}

export const mockProductContentProvider: ProductContentProvider = {
  generateTitle,
  generateDescription,
  generateKeywords,
  generateSeo,
};
