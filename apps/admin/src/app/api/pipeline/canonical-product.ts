import type { ExtractedProductData } from "@commerce/crawler";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import type { WorkspaceItem } from "./response.types";

const CONFIDENCE_BY_SOURCE: Record<"json-ld" | "open-graph" | "dom", number> = {
  "json-ld": 0.9,
  "open-graph": 0.7,
  dom: 0.4,
};

function field<T>(
  value: T,
  key: string,
  sources: Record<string, "json-ld" | "open-graph" | "dom">,
): ProvenanceField<T> {
  const detected = sources[key];
  const source: FieldSource = "ORIGINAL";
  return { value, source, confidence: detected ? CONFIDENCE_BY_SOURCE[detected] : 0 };
}

/**
 * universalExtract()가 이미지 추출과 같은 페이지 방문에서 뽑아온 상품 정보
 * (title/brand/price/...)와, 그 뒤 이미지 파이프라인이 실제로 처리한 이미지
 * 목록을 하나의 CanonicalProduct로 합친다. 이게 모든 플랫폼 Preview의 유일한
 * 입력이다 — 플랫폼별로 데이터를 따로 만들지 않는다.
 */
export function buildCanonicalProduct(
  sourceUrl: string,
  productData: ExtractedProductData,
  sources: Record<string, "json-ld" | "open-graph" | "dom">,
  items: WorkspaceItem[],
): CanonicalProduct {
  const images = items
    .filter((item) => item.status === "success" && item.detailDataUrl)
    .map((item) => ({
      url: item.detailDataUrl as string,
      isRepresentative: item.isRepresentative,
    }));

  return {
    sourceUrl,
    title: field(productData.title ?? sourceUrl, "title", sources),
    brand: field(productData.brand ?? "", "brand", sources),
    price: field(
      productData.price ?? { amount: 0, currency: "" },
      "price",
      sources,
    ),
    sku: field(productData.sku ?? "", "sku", sources),
    description: field(productData.description ?? "", "description", sources),
    material: field(productData.material ?? "", "material", sources),
    options: field(productData.options ?? [], "options", sources),
    images,
  };
}
