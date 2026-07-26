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
    // 크롤러는 한국어 AI 콘텐츠를 만들지 않는다 — 항상 빈 값으로 시작해서
    // CommerceWorkspace의 AI 콘텐츠 생성 버튼을 눌러야 채워진다.
    titleKo: { value: "", source: "ORIGINAL", confidence: 0 },
    descriptionKo: { value: "", source: "ORIGINAL", confidence: 0 },
    keywords: { value: [], source: "ORIGINAL", confidence: 0 },
    seoTitle: { value: "", source: "ORIGINAL", confidence: 0 },
    seoDescription: { value: "", source: "ORIGINAL", confidence: 0 },
    // 원산지/반품정보는 원본 사이트에서 신뢰성 있게 뽑아낼 방법이 없다 — 항상
    // REQUIRED로 시작해서 사용자가 직접 채워야 등록 가능 상태가 된다. 배송비/재고는
    // "일단 등록은 되지만 확인이 필요한" 합리적 기본값으로 시작한다(DEFAULT).
    countryOfOrigin: { value: "", source: "REQUIRED", confidence: 0 },
    returnPolicy: { value: "", source: "REQUIRED", confidence: 0 },
    shippingFee: { value: 0, source: "DEFAULT", confidence: 0.5 },
    stockQuantity: { value: 999, source: "DEFAULT", confidence: 0.5 },
    certification: { value: "", source: "DEFAULT", confidence: 1 },
  };
}
