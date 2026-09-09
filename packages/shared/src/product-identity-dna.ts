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
}

const SEASON_CODE_RE = /^(ss|aw|fw)\d{2}$/i;
const SIZE_LIKE_RE = /^\d{1,3}(y|m|cm|호)$/i;
const STOPWORDS = new Set(["the", "a", "an", "for", "and", "with", "by", "in", "of"]);

function normalizeText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/[^a-z0-9가-힣]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t) && !SEASON_CODE_RE.test(t) && !SIZE_LIKE_RE.test(t));
}

/** brand.value/color.value의 각 단어를 title 토큰에서 제거한다 — 매처가
 * "브랜드 일치"/"색상 일치"를 이미 별도 신호로 볼 것이므로, 핵심 상품명
 * 토큰에 중복으로 남아 union을 부풀리지 않게 한다(N-3.11 comparison-search의
 * stripBrandWords와 같은 이유, 여기서는 색상까지 같이 뺀다). */
function coreTitleTokensOf(title: string, brand: string, color: string | null): string[] {
  const noiseWords = new Set([...tokenize(brand), ...(color ? tokenize(color) : [])]);
  return tokenize(title).filter((t) => !noiseWords.has(t));
}

function resolveIdentifier(product: CanonicalProduct): ProductIdentifier | null {
  const sku = product.sku.value.trim();
  if (sku) return { value: sku, tier: "SKU" };
  const modelName = product.modelName.value.trim();
  if (modelName) return { value: modelName, tier: "MODEL_NAME" };
  return null;
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
  const representative = product.images.find((img) => img.isRepresentative);
  return {
    sourceUrl: product.sourceUrl,
    brand: { value: brandValue, confident: product.brandResolution?.confidence === "HIGH" },
    identifier: resolveIdentifier(product),
    title: product.title.value,
    coreTitleTokens: coreTitleTokensOf(product.title.value, brandValue, colorValue),
    color: colorValue,
    category: resolveCategory(product),
    representativeImageUrl: representative ? getSelectedImageUrl(representative) : null,
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
}): string {
  const brandValue = (input.brand ?? "").trim();
  const sku = input.sku?.trim();
  return buildDomesticShopQuery({
    sourceUrl: input.sourceUrl ?? "",
    brand: { value: brandValue, confident: false },
    identifier: sku ? { value: sku, tier: "SKU" } : null,
    title: input.title,
    coreTitleTokens: coreTitleTokensOf(input.title, brandValue, null),
    color: null,
    category: null,
    representativeImageUrl: null,
  });
}
