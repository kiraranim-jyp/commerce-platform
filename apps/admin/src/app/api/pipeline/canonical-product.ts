import {
  extractAge,
  extractCareInstructions,
  extractColor,
  extractColorFromTitle,
  extractCountryOfOrigin,
  extractManufacturer,
  extractMaterial,
  extractProductCode,
  resolveBrandName,
} from "@commerce/crawler";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import type {
  CanonicalProduct,
  CanonicalProductImage,
  FieldSource,
  ProvenanceField,
} from "@commerce/shared";
import { resolveCareInstructions } from "@commerce/listing";
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
    /* ══ P2-1 D (CPO 확정, 2026-10-04) ═══════════════════════════════════════
       🔴 **대표 이미지도 상세설명에 들어간다.**

       여기 있던 기본값은 **대표 이미지만 상세설명에서 빼는 것** 이었다
       (「대표는 상세설명에서 또 반복할 필요가 적다」는 가정). CPO 가 그 가정을
       뒤집었다: 상품 이미지 전체(대표 + 추가)가 상세설명에 들어간다.

       🔴 옛 식을 주석에 그대로 적지 «않는다» — 적으면 「그 식이 남아 있지 않다」를
       재는 가드가 이 설명문에 걸려 거짓 실패한다(열 번째로 걸린 함정).

       🔴 이 한 줄이 **공통 지점** 이다. 세 채널의 상세설명 조립이 전부
       `useInDescription` 을 필터로 쓰므로(naver/build-payload.ts:589 ·
       coupang/build-payload.ts:1697 · lotteon/_lib/build-context.ts:128), 여기서
       정하면 SmartStore·Coupang·LotteON 이 **같은 집합** 을 받는다. 채널별로
       「대표 포함」 옵션을 다시 만들지 않는다.

       🔴 갤러리 축은 건드리지 않는다 — 세 채널 모두 이미 대표를 목록 맨 앞에
       싣는다(쿠팡 imageOrder 0 · 롯데ON gallery[0] rprtImgYn="Y" · 스마트스토어는
       representativeImage 칸이 따로 있다). 거기에 또 넣으면 «중복» 이다.

       사용자는 여전히 이미지 카드에서 끌 수 있다 — 자동 결정이 아니라 기본값이다. */
    useInProductGallery: true,
    useInDescription: true,
    classification: item.type,
  };
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * A-1 — **이미지가 있는데 대표가 없는 상태를 허용하지 않는다.** (CPO 확정 2026-10-06)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 🔴 회귀가 «아니다». 폴백이 처음부터 없었다 ────────────────────────────
 * git 추적 결과 `isRepresentative` 는 최초 도입(`6a13015`)부터 **thumbnail
 * selector 에 전적으로 의존** 했고, `images[0]` 폴백이 있던 이력이 «한 번도 없다»
 * (`setRepresentativeId(items[0]…)` 도 전수 0건). 그 의존은 이렇게 끊긴다:
 *
 *     AI 분류가 PRODUCT 를 하나도 못 냄(2중 실패·파싱·타임아웃·키 부재 → UNKNOWN)
 *       → thumbnailCandidates 0 → `thumbnail=""` → 전 이미지 isRepresentative=false
 *       → 「이미지 5장 있는데 대표 없음」
 *
 * 즉 고장난 것이 아니라 **방어선이 하나뿐이었다.** 그 하나가 멈추면 대표가 없다.
 *
 * ── 🔴 왜 「원소스 대표 계승」을 1순위로 넣지 않았는가 ────────────────────
 * 작업지시서 §2-3 이 「`JSON-LD image[0]` / `og:image[0]` «이라는 이유만으로»
 * 대표로 간주하지 않는다 — 대표라는 «의미» 가 확인되는 경우에만」이라고 못박았다.
 * 조사 결과 그 의미를 **확인하지 못했다**:
 *     og:image      「보통 대표 이미지 1~2장」 — 여러 장일 때 어느 것인지 미규정
 *     JSON-LD image 배열이고 «순서가 대표를 뜻한다는 보장이 스키마에 없다»
 * 🔴 그래서 §2-4(명시적 fallback)를 작동 규칙으로 쓴다. 확인되지 않은 의미를
 * 1순위로 올리면 그것이 곧 「임의 선택」이고, §14 가 금지한 것이다.
 *
 * 🟢 다만 재료는 크롤러에 이미 있다 — `ImageCandidate.source`(StrategySource)와
 * `scoring.ts` 의 `SOURCE_BASE_SCORE`(json-ld 90 · open-graph 60). 의미가 확인되면
 * **점수 체계를 새로 만들지 않고** 그것을 쓰면 된다(별도 트랙).
 *
 * ── 세 경우 ───────────────────────────────────────────────────────────────
 *     0장          그대로 — 대표 없음이 «정상» 이다
 *     정확히 1개   🔴 **그대로 둔다** — 셀러가 고른 것을 자동 판정이 덮지 않는다
 *     0개 / 2개+   첫 장을 대표로 / 첫 표시만 남기고 나머지를 끈다
 *
 * 🔴 「정확히 1개면 손대지 않는다」가 사용자 선택 보호의 전부다. 이 함수는 순수
 * 함수라 재분석 때 다시 돌아도, 이미 하나면 no-op 이다.
 */
export function ensureRepresentativeImage(
  images: CanonicalProductImage[],
  sourceRepresentativeId?: string | null,
): CanonicalProductImage[] {
  if (images.length === 0) return images;

  const firstMarked = images.findIndex((image) => image.isRepresentative);
  const markedCount = images.reduce((sum, image) => sum + (image.isRepresentative ? 1 : 0), 0);

  /* 🔴 이미 하나면 건드리지 않는다 — 배열 자체를 그대로 돌려준다(참조까지 동일). */
  if (markedCount === 1) return images;

  /* ══ A-1 ① 원소스가 «명시한» 대표가 최우선이다 (CPO 확정 2026-10-06) ═══
     🔴 `markedCount === 1` 보호 «뒤» 에 둔다. 셀러가 이미 고른 것이 있으면
     위에서 그대로 반환되므로, 원소스 대표가 그것을 덮지 않는다 — 순서가
     계약이다(Case D).
     🔴 id 는 `downloader.service.ts` 의 파일명 규칙(`0000`…)에서 온다.
     그 id 가 실제 목록에 «없으면» 무시하고 기존 로직으로 내려간다 —
     없는 것을 가리키는 대표를 만들지 않는다. */
  const sourceIndex = sourceRepresentativeId
    ? images.findIndex((image) => image.id === sourceRepresentativeId)
    : -1;
  if (sourceIndex >= 0) {
    return images.map((image, index) =>
      index === sourceIndex
        ? { ...image, isRepresentative: true }
        : image.isRepresentative
          ? { ...image, isRepresentative: false }
          : image,
    );
  }

  if (markedCount === 0) {
    /* §2-4 — 원소스 대표를 식별하지 못했을 때의 «명시적» fallback. */
    return images.map((image, index) => (index === 0 ? { ...image, isRepresentative: true } : image));
  }

  /* 2개 이상 — 첫 표시만 남긴다. 🔴 id 로 고르지 않는다(중복 id 에 흔들린다). */
  return images.map((image, index) =>
    index === firstMarked || !image.isRepresentative ? image : { ...image, isRepresentative: false },
  );
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
  /** A-1 — 원소스가 명시한 대표 이미지의 id(`0000`…). 없으면 기존 로직. */
  sourceRepresentativeId?: string | null,
): CanonicalProduct {
  /* 🔴 대표 보장은 «여기 한 곳» 에서만 한다 — images 가 조립되는 유일한 지점이다.
     채널 어댑터에 두면 채널마다 다른 대표가 생긴다(LotteON 이 이미 gallery[0]
     폴백을 따로 갖고 있는 것이 그 증상이다). */
  const images = ensureRepresentativeImage(
    items.map(toCanonicalProductImage).filter((image): image is CanonicalProductImage => image !== null),
    sourceRepresentativeId,
  );
  const resolvedCountryOfOrigin = extractCountryOfOrigin(productData.description);
  // Sprint A-7(작업2) — 실측 확인(allbirds.com): 설명문엔 색상 라벨이 없어도
  // 제목에 "- Anthracite (Dark Gum Sole)"처럼 색상이 그대로 들어있는 경우가
  // 흔하다. 설명문에서 못 찾았을 때만 제목에서 찾는다(설명문 라벨이 더
  // 명시적이라 우선순위가 높다).
  const resolvedColor = extractColor(productData.description) ?? extractColorFromTitle(productData.title);
  const resolvedAge = extractAge(productData.description);
  /* REWORK-13A(CEO 지시, 2026-09-15) — 제조사 자동 추정 5단계의 ①과 ②를 여기서
     가른다. 예전에는 ②(설명문 문구)만 있었다.
       ① 원본 URL 이 구조화 데이터로 «제조사»라고 명시한 값(crawler 가 채운다)
       ② 상품정보 원문에서 "Manufactured by X" / "제조자: X" 로 확인된 값
     🔴 브랜드명은 어느 쪽에도 오지 않는다 — «추출» 단계에서 브랜드를 제조사
     칸에 적지 않는다는 뜻이고, 이건 지금도 그대로다. 둘 다 없으면 값을
     지어내지 않고 REQUIRED 로 남긴다.

     🔴 PIVOT NEXT-04c-2(CPO 확정, 2026-09-23) — 그 «뒤» 의 순서가 바뀌었다.
     여기 적혀 있던 「④판매자 기본값」 단계는 사라졌다(판매 사업자는 제조사가
     아니다). 지금은 ③브랜드 프로필 → ④브랜드명 → 확인 필요이고, 3커머스가
     같은 규칙을 쓴다. 그 순서는 여전히 resolveManufacturer() 하나가 정한다. */
  const sourceUrlManufacturer = (productData.manufacturer ?? "").trim();
  const productInfoManufacturer = sourceUrlManufacturer ? "" : (extractManufacturer(productData.description) ?? "");
  const resolvedManufacturer = sourceUrlManufacturer || productInfoManufacturer;
  const resolvedCareInstructions = extractCareInstructions(productData.description);
  // P1-1(Brand Resolver) — 크롤러가 뽑아온 브랜드 문자열에 시즌/세일 문구가
  // 섞여 오는 경우(실측: "Bobo Choses SS26 Baby 50% Off Sale")가 있어 정제한다.
  // 규칙에 안 걸리면 원본 그대로 — 지어내지 않는다.
  const brandResolution = resolveBrandName(productData.brand);
  const resolvedBrandName = brandResolution?.cleaned ?? productData.brand ?? "";

  return {
    sourceUrl,
    title: field(productData.title ?? sourceUrl, "title", sources),
    /* REWORK-12 ④(CEO 실측 + DB 실측, 2026-09-15) — 브랜드가 **빈 값**이 될 수
       있게 됐다(문자열 전체가 시즌코드인 경우 — bobochoses.com vendor="AW26",
       스냅샷 32건 실측). 그때는 color/manufacturer와 같은 규칙을 쓴다: 원본에
       없는 값을 "원본"이라고 적지 않고 REQUIRED로 시작한다. 그래야 화면이
       「브랜드 · 입력 필요」라고 사실대로 말하고, 셀러가 고칠 수 있다. */
    brand: resolvedBrandName
      ? field(resolvedBrandName, "brand", sources)
      : { value: "", source: "REQUIRED" as const, confidence: 0 },
    brandResolution:
      brandResolution?.changed && brandResolution.confidence
        ? {
            raw: brandResolution.raw,
            ruleApplied: brandResolution.ruleApplied,
            confidence: brandResolution.confidence,
          }
        : undefined,
    // N-3.54(CPO 지시: "원본 가격을 못 읽었으면 가격을 계산하지 말고") — 예전엔
    // productData.price가 없으면 조용히 {amount:0,currency:""}로 채웠다 —
    // 이게 "Source Data 가격=0.00인데 아래 가격 계산은 배송비만으로 ₩15,400을
    // 만들어내는" 모순의 근본 원인이었다(0을 "진짜 0원"과 구분할 방법이 없어
    // 하위 computePriceBreakdown이 그대로 계산을 진행했다). 이제 값이 없으면
    // 0을 지어내지 않고, priceValidity로 그 이유(MISSING/INVALID)를 남긴다 —
    // PriceEditor/등록 게이트가 이 필드로 "계산해도 되는 값인지"를 판단한다.
    price: field(
      productData.price ?? { amount: 0, currency: "" },
      "price",
      sources,
    ),
    priceValidity: productData.priceValidity ?? (productData.price ? "VALID" : "MISSING"),
    priceRawText: productData.priceRawText,
    // N-4.18-Q2 P0-1 — 크롤러가 실제로 정가(compare_at_price)를 찾았을 때만
    // 그대로 전달한다(지어내지 않음, field()로 감싸지 않는 이유는 이 값이
    // provenance 추적/사용자 수정 대상이 아니라 원본 참고 정보이기 때문).
    regularPrice: productData.regularPrice ?? null,
    // N-4.19 — 크롤러가 sku를 안 주면(대부분의 Shopify 상품은 variant별 sku만
    // 있고 대표 품번이 없다) 설명문의 "Product code XXX" 패턴에서 찾아본다
    // (extractMaterial/extractManufacturer 등과 같은 폴백 원칙 — 원문에 실제로
    // 있는 값만, 못 찾으면 빈 값).
    sku: field(productData.sku || extractProductCode(productData.description) || "", "sku", sources),
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
      ? {
          value: resolvedManufacturer,
          source: "ORIGINAL",
          /* ①은 구조화 데이터라 그 소스의 신뢰도를 그대로 쓰고(json-ld 0.9 …),
             ②는 문장에서 긁어낸 값이라 다른 정규식 추출값과 같은 0.7이다. */
          confidence: sourceUrlManufacturer
            ? (sources.manufacturer ? CONFIDENCE_BY_SOURCE[sources.manufacturer] : 0.7)
            : 0.7,
        }
      : { value: "", source: "REQUIRED", confidence: 0 },
    /* REWORK-13A — ①인지 ②인지는 여기서만 알 수 있다. 화면·payload가 나중에
       다시 추론하지 않도록 판정 결과를 그대로 들려 보낸다. */
    manufacturerOrigin: sourceUrlManufacturer
      ? ("SOURCE_URL" as const)
      : productInfoManufacturer
        ? ("PRODUCT_INFO" as const)
        : undefined,
    // P0 Epic 4(Notice Resolver) — 세탁방법은 브랜드가 있어도 상품마다 다르고
    // 설명문에 없는 경우가 흔하다 → REQUIRED가 아니라 DEFAULT(등록은 막지 않되
    // 확인 필요)로 시작한다. countryOfOrigin/color/manufacturer와 달리 고시정보의
    // "필수" 항목이 아닌 카테고리도 많다.
    /* ══ CARE-LABEL-REFERENCE (CPO 확정, 2026-10-01) ═══════════════════════
       🔴 여기 있던 것: 원본에 세탁정보가 없으면 «빈 문자열» 로 두었다. 그래서
       셀러가 상품마다 손으로 적어야 했다 — 그것이 없애려는 반복 작업이다.
       이제 빈 자리에 「케어라벨 참조」를 넣는다(source: DEFAULT).
       🔴 「상품 상세페이지 참조」와 «다른 문구» 다. 세탁정보는 상세페이지가
       아니라 옷에 달린 라벨에 있고, 상세페이지를 가리키면 거짓이 된다.
       🔴 원본이 있으면 원본이 이긴다 — 판정은 resolveCareInstructions 한 곳이다. */
    careInstructions: resolveCareInstructions(resolvedCareInstructions),
    options: field(productData.options ?? [], "options", sources),
    optionGroups: productData.optionGroups ?? [],
    variants: productData.variants ?? [],
    /* P0-A.29-E ㉮ — 원본 URL 이 가리킨 옵션. 🔴 이 값이 있으면 위 price 는
       «그 옵션의» 가격이다. 화면이 「어느 옵션의 가격인가」를 말할 수 있어야
       하므로 판정 결과를 버리지 않고 여기까지 들고 온다. */
    selectedVariant: productData.selectedVariant,
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
