import {
  extractAge,
  extractCareInstructions,
  extractColor,
  extractColorFromTitle,
  extractCountryOfOrigin,
  extractManufacturer,
  extractMaterial,
  resolveBrandName,
} from "@commerce/crawler";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import type {
  CanonicalProduct,
  CanonicalProductImage,
  FieldSource,
  ProvenanceField,
} from "@commerce/shared";
import type { WorkspaceItem } from "./response.types";

const CONFIDENCE_BY_SOURCE: Record<ProductDataSource, number> = {
  "shopify-json": 0.95,
  "json-ld": 0.9,
  microdata: 0.85,
  "open-graph": 0.7,
  dom: 0.4,
};

function field<T>(
  value: T,
  key: string,
  sources: Record<string, ProductDataSource>,
): ProvenanceField<T> {
  const detected = sources[key];
  const source: FieldSource = "ORIGINAL";
  return { value, source, confidence: detected ? CONFIDENCE_BY_SOURCE[detected] : 0 };
}

/**
 * WorkspaceItem 하나(이미지 파이프라인이 만든 원본/배경제거 후보 정보)를
 * CanonicalProductImage로 변환한다. usedOriginal/alternateKind로 "지금 detailDataUrl에
 * 들어있는 게 원본인지 누끼 후보인지"를 역산해서 originalUrl/processedUrl 두 필드로
 * 나눈다 — MODEL/LIFESTYLE/DETAIL/SIZE_CHART처럼 변형이 없는 타입은 usedOriginal이
 * undefined이므로 항상 ORIGINAL로 취급한다.
 *
 * page.tsx의 이미지 카드에서 사용자가 원본/누끼 후보를 전환할 때도 이 함수와 같은
 * 규칙으로 selectedVariant를 다시 계산한다(app/pipeline/page.tsx의 swapVariant 참고) —
 * 두 곳이 다른 규칙을 쓰면 카드에 보이는 것과 실제 등록 payload가 어긋난다.
 */
export function toCanonicalProductImage(item: WorkspaceItem): CanonicalProductImage | null {
  if (item.status !== "success" || !item.detailDataUrl) return null;

  // 마켓플레이스 등록 payload(vendorPath)는 공개 HTTP(S) URL이어야 한다 — data URI를
  // 그대로 보내면 실제 쿠팡 API가 200자 제한으로 거부한다(실등록 시도로 확인).
  // detailPublicUrl/alternatePublicUrl(Supabase Storage 업로드 결과)이 있으면 그걸
  // 쓰고, 업로드가 실패했을 때만 data URI로 폴백한다(등록은 다시 실패하겠지만
  // 브라우저 미리보기 자체는 계속 동작해야 하므로 여기서 null을 반환하지 않는다).
  const detailUrl = item.detailPublicUrl ?? item.detailDataUrl;
  const alternateUrl = item.alternatePublicUrl ?? item.alternateDataUrl;

  const usedOriginal = item.usedOriginal ?? true;
  const originalUrl = usedOriginal
    ? detailUrl
    : (item.alternateKind === "ORIGINAL" ? alternateUrl : null) ?? detailUrl;
  const processedUrl = usedOriginal
    ? (item.alternateKind === "PROCESSED" ? (alternateUrl ?? undefined) : undefined)
    : detailUrl;

  return {
    id: item.id,
    originalUrl,
    processedUrl,
    selectedVariant: usedOriginal ? "ORIGINAL" : "PROCESSED",
    isRepresentative: item.isRepresentative,
    // 기본값: 대표 이미지가 아닌 모든 이미지는 추가 갤러리/상세설명 둘 다에
    // 자연스럽게 쓰인다고 가정한다. 대표 이미지는 상세설명에서 또 반복해서
    // 보여줄 필요가 적어 기본 off — 둘 다 사용자가 이미지 카드에서 언제든
    // 켜고 끌 수 있다(자동 결정이 아니라 기본값일 뿐).
    useInProductGallery: true,
    useInDescription: !item.isRepresentative,
    classification: item.type,
  };
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
  sources: Record<string, ProductDataSource>,
  items: WorkspaceItem[],
): CanonicalProduct {
  const images = items
    .map(toCanonicalProductImage)
    .filter((image): image is CanonicalProductImage => image !== null);
  const resolvedCountryOfOrigin = extractCountryOfOrigin(productData.description);
  // Sprint A-7(작업2) — 실측 확인(allbirds.com): 설명문엔 색상 라벨이 없어도
  // 제목에 "- Anthracite (Dark Gum Sole)"처럼 색상이 그대로 들어있는 경우가
  // 흔하다. 설명문에서 못 찾았을 때만 제목에서 찾는다(설명문 라벨이 더
  // 명시적이라 우선순위가 높다).
  const resolvedColor = extractColor(productData.description) ?? extractColorFromTitle(productData.title);
  const resolvedAge = extractAge(productData.description);
  const resolvedManufacturer = extractManufacturer(productData.description);
  const resolvedCareInstructions = extractCareInstructions(productData.description);
  // P1-1(Brand Resolver) — 크롤러가 뽑아온 브랜드 문자열에 시즌/세일 문구가
  // 섞여 오는 경우(실측: "Bobo Choses SS26 Baby 50% Off Sale")가 있어 정제한다.
  // 규칙에 안 걸리면 원본 그대로 — 지어내지 않는다.
  const brandResolution = resolveBrandName(productData.brand);

  return {
    sourceUrl,
    title: field(productData.title ?? sourceUrl, "title", sources),
    brand: field(brandResolution?.cleaned ?? productData.brand ?? "", "brand", sources),
    brandResolution:
      brandResolution?.changed && brandResolution.confidence
        ? {
            raw: brandResolution.raw,
            ruleApplied: brandResolution.ruleApplied,
            confidence: brandResolution.confidence,
          }
        : undefined,
    price: field(
      productData.price ?? { amount: 0, currency: "" },
      "price",
      sources,
    ),
    sku: field(productData.sku ?? "", "sku", sources),
    description: field(productData.description ?? "", "description", sources),
    // Sprint C(Compliance Resolver) — 크롤러가 구조화된 material을 안 주면(대부분의
    // 경우) 상품 설명 원문에서 "88% Polyester, 12% Elastane" 같은 표준 표기를
    // 정규식으로 찾아본다. 못 찾으면 그대로 빈 값 — 지어내지 않는다.
    material: field(
      productData.material || extractMaterial(productData.description) || "",
      "material",
      sources,
    ),
    // P0 Epic 1(Resolver 확장) — color/recommendedAge/manufacturer도 material과 같은
    // 규칙: 크롤러가 구조화된 값을 안 주면 설명문 원문에서 정규식으로 찾아보고,
    // 못 찾으면 REQUIRED/DEFAULT로 시작해서 지어내지 않는다.
    color: resolvedColor
      ? { value: resolvedColor, source: "ORIGINAL", confidence: 0.7 }
      : { value: "", source: "REQUIRED", confidence: 0 },
    recommendedAge: resolvedAge
      ? { value: resolvedAge, source: "ORIGINAL", confidence: 0.7 }
      : { value: "", source: "REQUIRED", confidence: 0 },
    manufacturer: resolvedManufacturer
      ? { value: resolvedManufacturer, source: "ORIGINAL", confidence: 0.7 }
      : { value: "", source: "REQUIRED", confidence: 0 },
    // P0 Epic 4(Notice Resolver) — 세탁방법은 브랜드가 있어도 상품마다 다르고
    // 설명문에 없는 경우가 흔하다 → REQUIRED가 아니라 DEFAULT(등록은 막지 않되
    // 확인 필요)로 시작한다. countryOfOrigin/color/manufacturer와 달리 고시정보의
    // "필수" 항목이 아닌 카테고리도 많다.
    careInstructions: resolvedCareInstructions
      ? { value: resolvedCareInstructions, source: "ORIGINAL", confidence: 0.7 }
      : { value: "", source: "DEFAULT", confidence: 0 },
    options: field(productData.options ?? [], "options", sources),
    optionGroups: productData.optionGroups ?? [],
    variants: productData.variants ?? [],
    breadcrumbPath: productData.breadcrumbPath,
    jsonLdCategory: productData.jsonLdCategory,
    shopifyTags: productData.shopifyTags,
    shopifyProductType: productData.shopifyProductType,
    images,
    // 크롤러는 한국어 AI 콘텐츠를 만들지 않는다 — 항상 빈 값으로 시작해서
    // CommerceWorkspace의 AI 콘텐츠 생성 버튼을 눌러야 채워진다.
    titleKo: { value: "", source: "ORIGINAL", confidence: 0 },
    descriptionKo: { value: "", source: "ORIGINAL", confidence: 0 },
    keywords: { value: [], source: "ORIGINAL", confidence: 0 },
    seoTitle: { value: "", source: "ORIGINAL", confidence: 0 },
    seoDescription: { value: "", source: "ORIGINAL", confidence: 0 },
    // 원산지/반품정보는 원본 사이트에서 신뢰성 있게 뽑아낼 방법이 거의 없다 —
    // "Made in China"처럼 설명문에 표준 문구로 적혀있을 때만(Sprint C) 그 값을
    // 쓰고, 못 찾으면 그대로 REQUIRED로 시작해서 사용자가 직접 채워야 한다.
    // 배송비/재고는 "일단 등록은 되지만 확인이 필요한" 합리적 기본값으로
    // 시작한다(DEFAULT).
    countryOfOrigin: resolvedCountryOfOrigin
      ? { value: resolvedCountryOfOrigin, source: "ORIGINAL", confidence: 0.75 }
      : { value: "", source: "REQUIRED", confidence: 0 },
    returnPolicy: { value: "", source: "REQUIRED", confidence: 0 },
    shippingFee: { value: 0, source: "DEFAULT", confidence: 0.5 },
    stockQuantity: { value: 999, source: "DEFAULT", confidence: 0.5 },
    certification: { value: "", source: "DEFAULT", confidence: 1 },
    // N-3.29 — 수입사명/어린이제품 인증정보는 원본 사이트에 나오는 정보가
    // 아니라 항상 사용자가 Editor에서 직접 입력해야 한다(추출 소스 없음).
    importer: { value: "", source: "REQUIRED", confidence: 0 },
    childCertification: { value: null, source: "REQUIRED", confidence: 0 },
    // N-3.44 — Naver KIDS 고시정보 필수 필드 4개(품명/모델명/중량/KC 인증
    // 유형). importer/childCertification과 동일하게 원본 사이트에서 신뢰성
    // 있게 뽑아낼 방법이 없어 항상 사용자가 Editor에서 직접 입력해야 한다.
    itemName: { value: "", source: "REQUIRED", confidence: 0 },
    modelName: { value: "", source: "REQUIRED", confidence: 0 },
    weight: { value: "", source: "REQUIRED", confidence: 0 },
    certificationType: { value: "", source: "REQUIRED", confidence: 0 },
  };
}
