import {
  buildCoreTitleTokens,
  extractCodeLikeSlugSegment,
  extractFitPhrase,
  extractLabeledProductCode,
  extractUrlSlug,
  parseMaterialComposition,
  type ProductFacts,
} from "./product-facts";
import type { CanonicalProduct } from "./product-types";
import { getSelectedImageUrl } from "./product-types";

/**
 * N-4.18 후속(대표님 지시: "비교의 시작점은 검색사이트가 아니라 내 등록상품") —
 * "상품 식별 DNA". 국내/해외 동일상품 검색·매칭이 항상 같은 곳에서 같은 방식으로
 * 신호를 뽑도록, CanonicalProduct에 **이미 있는** 값만으로 이 구조체 하나를
 * 만든다 — 새 크롤링 로직이나 새 필드를 추가하지 않는다("이미 확보하고 있는
 * 정보부터 최대한 활용한다"는 지시 그대로). 아직 어떤 매처(classifyListingMatch/
 * scoreCandidateMatch)에도 연결하지 않은 순수 설계 단계다 — 다음 스프린트에서
 * 검색 쿼리 축소(품번 우선)와 다중 신호 스코어링 양쪽이 이 구조체를 입력으로
 * 받도록 배선할 예정이다.
 *
 * packages/shared는 의존성이 없는 최하위 레이어라 packages/crawler(비교검색)/
 * packages/pricing(국내 매칭) 양쪽에서 순환 참조 없이 가져다 쓸 수 있다.
 */
export type IdentifierTier = "SKU" | "MODEL_NAME" | "NONE";

/**
 * 대표님이 요청하신 우선순위(GTIN/EAN/UPC → 제조사 품번/Style Code → SKU →
 * 모델명 → 상품명) 중 GTIN/EAN/UPC는 CanonicalProduct 어디에도 없다(추출한
 * 적도 없음) — 억지로 필드를 만들지 않고 그냥 없는 채로 둔다. "제조사 품번/
 * Style Code"는 지금 SKU와 별도 필드가 없으므로 sku 필드가 그 역할까지 겸한다
 * (실제로 packages/crawler/comparison-search/looxloo.ts가 뽑는 "품번"도 이
 * 개념과 같다). SKU가 없으면 modelName으로 내려간다 — 둘 다 없으면 식별자
 * 없음(NONE)이다.
 */
export interface ProductIdentifier {
  value: string;
  tier: IdentifierTier;
}

export interface ProductCategorySignal {
  value: string;
  /** 어떤 원본 신호에서 왔는지 — 셋 다 "사이트 자신의 분류"라는 점에서 신뢰도가
   * 비슷하다(추측이 아니라 원본에 실제로 있던 값). 우선순위는 breadcrumb >
   * jsonLd > shopifyType 순(더 구체적인 경로 정보를 우선한다). */
  source: "BREADCRUMB" | "JSON_LD" | "SHOPIFY_TYPE";
}

export interface ProductIdentityDna {
  sourceUrl: string;
  /** brand.value를 그대로 옮긴다 — 이 단계에서는 정규화하지 않는다(정규화는
   * STEP3의 별도 동의어 테이블이 맡는다, 이 구조체는 "원본에 뭐가 있었는지"만
   * 담는다). confident는 brandResolution이 있고 confidence가 "HIGH"일 때만
   * true — 마케팅 문구 제거 등 정제를 거쳐 신뢰도가 검증된 값인지 구분한다. */
  brand: { value: string; confident: boolean };
  /** SKU 우선, 없으면 modelName, 둘 다 없으면 null. */
  identifier: ProductIdentifier | null;
  title: string;
  /** title에서 브랜드 단어/색상 단어/명백한 사이즈·시즌 토큰(8Y, SS26 같은
   * 패턴)을 뺀 나머지 토큰 — "핵심 상품명"의 원재료. 실제 유사도 계산(Jaccard 등)
   * 은 이 구조체를 쓰는 쪽(매처)의 몫이라 여기서는 토큰 집합까지만 만든다. */
  coreTitleTokens: string[];
  /** color.value가 비어있지 않을 때만 채운다 — 없으면 null(추측하지 않는다). */
  color: string | null;
  /** breadcrumbPath(가장 구체적) → jsonLdCategory → shopifyProductType 순으로
   * 첫 번째로 존재하는 것만 채운다. 셋 다 없으면 null — 이 상품은 카테고리
   * 신호가 아예 없다는 뜻이고, 매처는 이 경우 카테고리 불일치로 감점하면 안
   * 된다("정보 없음"과 "다름"을 구분해야 한다는 기존 원칙과 동일). */
  category: ProductCategorySignal | null;
  /** isRepresentative 이미지의 실제 사용 URL(getSelectedImageUrl, 배경제거
   * 여부 반영). 없으면 null. */
  representativeImageUrl: string | null;

  /* ── MATCHING-2.0-CORE(CEO 지시, 2026-09-13)에서 추가된 축 ──────────────
   *
   * 아래 값들은 전부 CanonicalProduct에 **이미 들어와 있던** 것이다. 그런데
   * 이 구조체가 그것을 실어 나르지 않아서 ComparisonQuery에도, 결국
   * scoreCandidateMatch에도 한 번도 도달한 적이 없었다. 판매처가 서로 다른
   * SKU를 쓰는 상황에서 동일상품을 가릴 수 있는 근거가 바로 이 값들인데,
   * 가장 강한 증거가 파이프라인 중간에서 조용히 버려지고 있었다.
   *
   * 새로 크롤링하는 값은 하나도 없다 — 있는 것을 연결만 한다. */

  /** 브랜드가 부여한 품번(Article/Product code). identifier와 달리 판매처
   * 자신의 재고번호를 절대 담지 않는다 — 그 구분이 없으면 "SKU가 다르니 다른
   * 상품"이라는 틀린 규칙으로 되돌아간다. 현재 CanonicalProduct에는 이 둘을
   * 나눠 담는 칸이 없어서, sku가 브랜드 품번 모양일 때만(영문+숫자 혼합) 여기
   * 채운다 — 확신이 없으면 null이다. */
  brandModelCode: string | null;
  /** material.value 그대로. 비어 있으면 null. */
  material: string | null;
  /** 설명문에서 실제로 관측된 핏 표현만(없으면 null). */
  fit: string | null;
  /** recommendedAge.value 그대로("2-3 years" 등). */
  ageRange: string | null;
  /** optionGroups 중 사이즈 축의 값 목록. 사이즈 축이 없으면 빈 배열. */
  sizeRange: string[];
  /** 대상 연령/성별을 읽을 수 있는 원문 조각들(breadcrumb, Shopify 태그). */
  audienceSignals: string[];
  /** sourceUrl의 마지막 경로 조각. 판매처가 URL에 브랜드 품번을 그대로 넣는
   * 경우(bobochoses.com handle)가 있어 식별자 증거로 쓸 수 있다. */
  urlSlug: string | null;
  /** 등록에 실제로 쓰이는 이미지 URL 전체(대표 1장만이 아니라). 이미지 교차
   * 비교는 한 쌍이라도 강하게 일치하면 근거로 보기 때문에 여러 장이 필요하다. */
  imageUrls: string[];
}

/** brand/color/material의 각 단어를 title 토큰에서 제거한다 — 매처가 그 셋을
 * 이미 별도 축으로 세고 있어서, 핵심 상품명에 남겨두면 같은 근거를 두 번 세게
 * 된다(N-3.11 comparison-search의 stripBrandWords와 같은 이유). 실제 토큰화
 * 규칙은 product-facts.ts 한 곳에만 둔다 — 검색어를 만드는 쪽과 동일상품을
 * 판정하는 쪽이 다른 자를 쓰면 두 결과가 조용히 어긋난다. */
function coreTitleTokensOf(title: string, brand: string, color: string | null, material: string | null): string[] {
  // 소재는 원문 전체가 아니라 **읽어낸 성분 이름**만 노이즈로 쓴다. 원문을 통째로
  // 넣으면 설명문에 우연히 들어 있던 상품명 단어까지 같이 깎여 나간다.
  const fabrics = parseMaterialComposition(material).map((c) => c.fabric).join(" ");
  return buildCoreTitleTokens(title, [brand, color, fabrics]);
}

function resolveIdentifier(product: CanonicalProduct): ProductIdentifier | null {
  const sku = product.sku.value.trim();
  if (sku) return { value: sku, tier: "SKU" };
  const modelName = product.modelName.value.trim();
  if (modelName) return { value: modelName, tier: "MODEL_NAME" };
  return null;
}

/**
 * 브랜드가 부여한 품번은 sku 필드에서 **가져오지 않는다**.
 *
 * CanonicalProduct에는 "브랜드 품번"과 "판매처 재고번호"를 나눠 담는 칸이 없고,
 * 둘 다 sku 한 칸으로 들어온다. 모양으로 가르려는 시도는 실측에서 실패했다 —
 * Bobo 품번 B226AC114(영문 3자+숫자 6자)와 Smallable 재고번호 AAA1804922(영문
 * 3자+숫자 7자)는 글자 구성이 사실상 같다. 모양으로는 못 가른다.
 *
 * 대신 **어디에 적혀 있었는지**로 가른다. 브랜드 품번은 원문이 스스로 그렇게
 * 부르는 자리에만 있다: 설명문의 "Product code" / "Article code" 라벨(실측:
 * junioredition/bobochoses), 또는 브랜드 공식몰이 URL 앞머리에 그대로 붙여둔
 * 조각(실측: `b226ac114-bobo-choses-bolder-half-zipped-sweatshirt`). 두 곳 중
 * 어디에도 없으면 null이다 — 그리고 null은 "품번 충돌 없음"으로 읽힌다.
 * 이것이 "SKU가 다르니 다른 상품"이라는 규칙으로 되돌아가지 않는 유일한 길이다.
 */
function resolveBrandModelCode(product: CanonicalProduct): string | null {
  const labeled = extractLabeledProductCode(product.description?.value);
  if (labeled) return labeled;
  return extractCodeLikeSlugSegment(extractUrlSlug(product.sourceUrl));
}

/** optionGroups 중 "사이즈 축"의 값 목록. 축 이름은 판매처마다 다르므로
 * (Size / Clothing size / 사이즈) 이름에 사이즈라는 말이 들어있는지로만 고른다 —
 * 없으면 빈 배열이고, 빈 배열은 "사이즈 정보 없음"이다. */
function resolveSizeRange(product: CanonicalProduct): string[] {
  const group = product.optionGroups?.find((g) => /size|사이즈|치수/i.test(g.name));
  return group ? [...group.values] : [];
}

/** 대상 연령/성별을 읽을 수 있는 원문 조각. 사이트 자신의 분류(breadcrumb)와
 * Shopify 태그는 제목보다 훨씬 신뢰할 만한 신호인데(실측: 제목에는 "여성"
 * 표기가 없고 태그에만 "adult","Woman"이 있다) 지금까지 매칭에 한 번도
 * 쓰이지 않았다. */
function resolveAudienceSignals(product: CanonicalProduct): string[] {
  return [
    ...(product.breadcrumbPath ?? []),
    ...(product.shopifyTags ? product.shopifyTags.split(/[,;]/) : []),
    ...(product.shopifyProductType ? [product.shopifyProductType] : []),
    ...(product.recommendedAge?.value ? [product.recommendedAge.value] : []),
  ].filter((s) => s.trim().length > 0);
}

function resolveCategory(product: CanonicalProduct): ProductCategorySignal | null {
  if (product.breadcrumbPath && product.breadcrumbPath.length > 0) {
    return { value: product.breadcrumbPath.join(" > "), source: "BREADCRUMB" };
  }
  if (product.jsonLdCategory) {
    return { value: product.jsonLdCategory, source: "JSON_LD" };
  }
  if (product.shopifyProductType) {
    return { value: product.shopifyProductType, source: "SHOPIFY_TYPE" };
  }
  return null;
}

export function buildProductIdentityDna(product: CanonicalProduct): ProductIdentityDna {
  const brandValue = product.brand.value.trim();
  const colorValue = product.color.value.trim() || null;
  const materialValue = product.material?.value.trim() || null;
  const descriptionValue = product.description?.value ?? "";
  const representative = product.images.find((img) => img.isRepresentative);
  const identifier = resolveIdentifier(product);
  return {
    sourceUrl: product.sourceUrl,
    brand: { value: brandValue, confident: product.brandResolution?.confidence === "HIGH" },
    identifier,
    title: product.title.value,
    coreTitleTokens: coreTitleTokensOf(product.title.value, brandValue, colorValue, materialValue),
    color: colorValue,
    category: resolveCategory(product),
    representativeImageUrl: representative ? getSelectedImageUrl(representative) : null,
    brandModelCode: resolveBrandModelCode(product),
    // 소재는 전용 필드가 비어 있으면 설명문을 그대로 넘긴다 — 성분 목록을
    // 읽어내는 일(parseMaterialComposition)은 비교 시점에 하므로, 여기서는
    // "원문에 뭐가 있었는지"만 옮긴다(이 구조체의 기존 원칙 그대로).
    material: materialValue ?? (descriptionValue.trim() ? descriptionValue : null),
    fit: extractFitPhrase(materialValue ? `${materialValue} ${descriptionValue}` : descriptionValue),
    ageRange: product.recommendedAge?.value.trim() || null,
    sizeRange: resolveSizeRange(product),
    audienceSignals: resolveAudienceSignals(product),
    urlSlug: extractUrlSlug(product.sourceUrl),
    imageUrls: product.images.map(getSelectedImageUrl),
  };
}

/**
 * DNA를 그대로 비교 가능한 사실 묶음으로 옮긴다. 새 값을 만들지 않는다 —
 * 칸 이름만 바꿔 담는다. 이 함수가 있는 이유는 "등록상품"과 "검색 후보"가
 * 같은 타입으로 비교대에 올라와야 방향 대칭이 성립하기 때문이다.
 */
export function productFactsFromIdentityDna(dna: ProductIdentityDna): ProductFacts {
  return {
    sourceUrl: dna.sourceUrl,
    urlSlug: dna.urlSlug,
    brand: dna.brand.value || null,
    brandModelCode: dna.brandModelCode,
    sellerSku: dna.identifier?.tier === "SKU" ? dna.identifier.value : null,
    title: dna.title,
    coreTitleTokens: dna.coreTitleTokens,
    categoryText: dna.category?.value ?? null,
    colorText: dna.color,
    materialText: dna.material,
    fitText: dna.fit,
    ageRangeText: dna.ageRange,
    sizeLabels: dna.sizeRange,
    audienceSignals: dna.audienceSignals,
    imageUrls: dna.imageUrls,
  };
}

/** N-4.18-C STEP3(대표님 지시) — "검색 횟수보다 매칭 정확도를 우선한다." 국내
 * 편집샵 검색 1회에 보낼 검색어 하나를 DNA 우선순위로 고른다(SKU/Style Code
 * 단독 → 브랜드+모델명 → 브랜드+핵심 상품명 → 핵심 상품명 단독). 이 함수가
 * 리턴하는 문자열은 "검색 API에 보낼 키워드"일 뿐이다 — 동일상품 판정(매칭
 * 스코어링)은 여전히 원본 title/brand/sku를 그대로 쓴다(둘을 섞으면 매칭
 * 정확도가 오히려 떨어진다 — 검색어는 좁게, 매칭 신호는 넓게).
 *
 * SKU가 있으면 브랜드 없이 SKU만 보낸다 — 대표님 예시("B126AC050" 단독
 * 검색이 1순위) 그대로다. coreTitleTokens는 이미 브랜드/색상/사이즈·시즌
 * 토큰을 제거한 상태라 추가 정제 없이 그대로 쓴다(토큰 6개로 제한 — 검색
 * 사이트 키워드 파라미터가 너무 길어지면 오히려 결과가 0건이 되는 경우가
 * 실측으로 확인됨, LOOXLOO/CHOCO.EL 등 Cafe24 계열 공통). */
const MAX_CORE_TITLE_TOKENS_IN_QUERY = 6;

export function buildDomesticShopQuery(dna: ProductIdentityDna): string {
  if (dna.identifier?.tier === "SKU") {
    return dna.identifier.value;
  }
  if (dna.identifier?.tier === "MODEL_NAME") {
    return dna.brand.value ? `${dna.brand.value} ${dna.identifier.value}` : dna.identifier.value;
  }
  const coreTitle = dna.coreTitleTokens.slice(0, MAX_CORE_TITLE_TOKENS_IN_QUERY).join(" ");
  if (dna.brand.value && coreTitle) return `${dna.brand.value} ${coreTitle}`;
  if (coreTitle) return coreTitle;
  if (dna.brand.value) return dna.brand.value;
  return dna.title;
}

/**
 * MI-DOMESTIC-FIX-1(CPO 지시, 2026-09-09) — 화면의 실시간 국내 검색이
 * buildDomesticShopQuery를 우회하던 것을 잇는 어댑터.
 *
 * 배치(run-domestic-price-check)는 CanonicalProduct 전체가 있어서
 * buildProductIdentityDna로 DNA를 만든 뒤 검색어를 뽑는데, 실시간 route는
 * 화면이 보내주는 title/brand/sku/sourceUrl만 갖고 있어서 그 경로를 쓰지
 * 못했다. 그 결과 10단어짜리 영문 원제목이 그대로 국내 편집샵 검색창에
 * 들어가 0건이 나왔다 — 정작 이 파일의 MAX_CORE_TITLE_TOKENS_IN_QUERY
 * 주석이 "검색어가 길면 0건이 된다"는 실측을 이미 기록하고 있었다.
 *
 * 검색어 정책은 새로 만들지 않는다. 있는 필드로 DNA를 채우고 기존
 * buildDomesticShopQuery에 그대로 위임한다 — 그래서 배치와 실시간이
 * 같은 우선순위(SKU 단독 > 브랜드+핵심 상품명 > ...)를 쓰게 된다.
 *
 * 배치 경로와 다른 점은 색상/모델명 신호가 없다는 것뿐이다(화면이 보내주지
 * 않는다). 없는 값을 지어내지 않고 null로 두면 coreTitleTokensOf가 색상
 * 토큰만 덜 걷어낼 뿐, 검색어가 원제목으로 되돌아가지는 않는다.
 */
export function buildDomesticShopQueryFromFields(input: {
  title: string;
  brand?: string;
  sku?: string;
  sourceUrl?: string;
  color?: string;
  material?: string;
}): string {
  return buildDomesticShopQuery(identityDnaFromFields(input));
}

/** 화면이 보내주는 몇 개 필드만으로 DNA 모양을 갖춘다. 없는 값은 지어내지 않고
 * null/빈 배열로 둔다 — 그러면 그 축은 근거에서 빠질 뿐이고, 검색어가 원제목으로
 * 되돌아가지는 않는다. */
export function identityDnaFromFields(input: {
  title: string;
  brand?: string;
  sku?: string;
  sourceUrl?: string;
  color?: string;
  material?: string;
  description?: string;
}): ProductIdentityDna {
  const brandValue = (input.brand ?? "").trim();
  const sku = input.sku?.trim();
  const color = input.color?.trim() || null;
  const material = input.material?.trim() || null;
  const slug = extractUrlSlug(input.sourceUrl);
  return {
    sourceUrl: input.sourceUrl ?? "",
    brand: { value: brandValue, confident: false },
    identifier: sku ? { value: sku, tier: "SKU" } : null,
    title: input.title,
    coreTitleTokens: coreTitleTokensOf(input.title, brandValue, color, material),
    color,
    category: null,
    representativeImageUrl: null,
    brandModelCode: extractLabeledProductCode(input.description) ?? extractCodeLikeSlugSegment(slug),
    material: material ?? (input.description?.trim() ? input.description : null),
    fit: extractFitPhrase(input.description ?? null),
    ageRange: null,
    sizeRange: [],
    audienceSignals: [],
    urlSlug: slug,
    imageUrls: [],
  };
}

/**
 * MATCHING-2.0-CORE — "브랜드 + 명사 하나"로 검색하던 것을 그만둔다.
 *
 * 기존 buildDomesticShopQuery는 검색어를 **하나만** 만든다. 그 하나가 브랜드와
 * 핵심 명사 하나로 끝나면(예: "Bobo Choses sweatshirt") 그 브랜드의 스웨트셔츠가
 * 전부 딸려 나오고, 목표 상품은 판매처별 상위 5건 한도 밖으로 밀려난다 —
 * 후보가 아예 만들어지지 않으니 뒤에 아무리 좋은 판정기를 붙여도 소용이 없다.
 *
 * 그래서 **좁은 것부터 넓은 것 순서로** 여러 개를 만들어 돌려준다. 호출부는
 * 결과가 나올 때까지 순서대로 시도하면 된다(먼저 성공한 것을 쓰고 멈춘다).
 *
 * 판매처 자신의 재고번호는 절대 첫 줄에 두지 않는다. Smallable의 AAA1804922로
 * Bobo 공식몰을 검색하면 언제나 0건이고, 그 0건이 "이 상품은 없다"로 읽혀 왔다.
 * 브랜드 품번(원문이 Product/Article code라고 부른 것, 혹은 공식몰 URL 앞머리)이
 * 있을 때만 단독 검색이 의미가 있다.
 */
const MAX_CROSS_SELLER_QUERIES = 4;

export function buildCrossSellerSearchQueries(dna: ProductIdentityDna): string[] {
  const brand = dna.brand.value.trim();
  const core = dna.coreTitleTokens.slice(0, MAX_CORE_TITLE_TOKENS_IN_QUERY);
  const colorToken = dna.color ? dna.color.trim() : "";
  const materialToken = dna.material ? (parseMaterialComposition(dna.material)[0]?.fabric ?? "") : "";

  const candidates = [
    // ① 브랜드 품번 단독 — 있으면 이것만으로 정확히 한 상품을 가리킨다.
    dna.brandModelCode ?? "",
    // ② 브랜드 + 핵심 상품명 + 색상 — 같은 라인의 다른 색을 걸러내는 가장 좁은 말.
    [brand, ...core, colorToken].filter(Boolean).join(" "),
    // ③ 브랜드 + 핵심 상품명 — 색상 표기가 판매처마다 달라 ②가 0건일 때.
    [brand, ...core].filter(Boolean).join(" "),
    // ④ 브랜드 + 소재 + 핵심 명사 하나 — 상품명 어휘가 아예 다른 판매처를 위한
    //    마지막 그물. 그래도 "브랜드 + 명사 하나"보다는 좁다.
    [brand, materialToken, core[0] ?? ""].filter(Boolean).join(" "),
  ];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= MAX_CROSS_SELLER_QUERIES) break;
  }
  // 브랜드도 상품명도 없으면 기존 정책(buildDomesticShopQuery)으로 되돌아간다 —
  // 여기서 빈 배열을 돌려주면 호출부가 검색을 아예 못 하게 된다.
  return out.length > 0 ? out : [buildDomesticShopQuery(dna)];
}
