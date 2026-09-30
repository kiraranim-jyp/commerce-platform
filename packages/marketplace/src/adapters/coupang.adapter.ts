import type { CanonicalProduct, PlatformId } from "@commerce/shared";
import { blocksRegistration, getRegistrationImageUrl, getSelectedImageUrl, resolveSourceStock } from "@commerce/shared";
import type { CategorySelection } from "@commerce/category";
import { resolveChannelListingPrice } from "../channel-price";
import { categoryFieldRule } from "../category-field";
import { effectiveDescription, effectiveTitle } from "../content-field";
import { imageFormatFieldRule } from "../image-field";
import { runValidation, scoreValidations, type FieldRule } from "../validation";
import type { ListingModel, ListingPricingContext, PlatformAdapter } from "../types";

/** 쿠팡 실제 등록 한도 — 대표 1장 + 추가 최대 9장(총 10장). product.images에는
 * 커머스별 제한을 저장하지 않는다 — 사용자가 몇 장을 선택했든 이 어댑터가 등록
 * 시점에 쿠팡 한도만큼만 잘라서 쓴다. 다른 커머스(스마트스토어/11번가)를 추가해도
 * 이미지 선택 상태나 product.images 구조를 다시 손댈 필요가 없다. */
const MAX_ADDITIONAL_IMAGES = 9;

/**
 * 쿠팡은 브랜드 미기재 상품에 대한 규제가 스마트스토어보다 엄격해서(상표권 이슈로
 * 반려되는 경우가 실제로 흔하다) 브랜드 누락을 ERROR로 잡는다 — 스마트스토어
 * 어댑터와 같은 필드라도 플랫폼마다 요구 강도가 다르다는 걸 보여주는 대표 사례.
 */
export const coupangAdapter: PlatformAdapter = {
  platform: "coupang",
  label: "쿠팡",
  toListingModel(
    product: CanonicalProduct,
    categorySelection: CategorySelection,
    pricingContext: ListingPricingContext | undefined,
    platform: PlatformId,
  ): ListingModel {
    /* 🔴 MI-DATA-URI-FIX-01 — 등록 payload 는 «보낼 수 있는» URL 만 받는다.
       업로드 실패 시 originalUrl 에 data: URI 가 들어 있을 수 있고(실측 3건),
       그 3건은 전부 «비대표» 였다 — 그래서 대표만 보던 게이트가 못 잡았다.
       🔴 getSelectedImageUrl 은 그대로 둔다 — 미리보기가 그것을 쓴다. */
    const representativeImageEntry = product.images.find((img) => img.isRepresentative);
    const representativeImage = representativeImageEntry
      ? (getRegistrationImageUrl(representativeImageEntry) ?? undefined)
      : undefined;
    const additionalImages = product.images
      .filter((img) => !img.isRepresentative && img.useInProductGallery)
      .map((img) => getRegistrationImageUrl(img))
      /* 🔴 보낼 수 없는 것은 «버린다» — 대신 validate 가 그 사실을 말한다. */
      .filter((url): url is string => url !== null)
      .slice(0, MAX_ADDITIONAL_IMAGES);
    /* ══ MI-COUPANG-IMAGE-WARNING-03 (CPO 방향 승인, 2026-09-30) ══════════════
       🔴 바로 위 주석이 "대신 validate 가 그 사실을 말한다" 고 적어 두었는데
       실제로는 «아무도 말하지 않았다». 버린 장수를 여기서 센다.

       🔴 같은 조건·같은 공통 함수다 — naver/validate-payload.ts 의
       excludedOptionalImageCount 와 한 글자도 다르지 않다. 두 채널이 서로 다른
       숫자를 말하면 그것이 CP001 류 불일치다.
       🔴 `.slice()` «앞» 에서 센다. 쿠팡 한도(9장) 때문에 잘린 것은 「제외」가
       아니라 「한도」다 — 두 사실을 한 숫자에 섞지 않는다. */
    const excludedAdditionalImageCount = product.images.filter(
      (img) =>
        !img.isRepresentative &&
        img.useInProductGallery &&
        getRegistrationImageUrl(img) === null,
    ).length;
    // P-4-H1-2-2(대표님 지시) — override가 없을 때 원본가를 마진 0%로 그냥
    // 환산해서 쓰던 버그를 고친 지점. resolveListingPrice() 하나로 통일한다
    // (스마트스토어 어댑터도 동일하게 이 함수를 쓴다 — 각자 계산하지 않는다).
    // PHASE 3.2 — 그 호출을 resolveChannelListingPrice()로 감쌌다. 해석 순서에
    // "이 채널의 최종 등록가격"이 맨 앞에 한 단계 붙었을 뿐이고, 채널 값이
    // 없으면 결과는 이전과 완전히 동일하다(계산식은 그대로 resolveListingPrice).
    const resolution = resolveChannelListingPrice(product, platform, pricingContext);
    const amountKrw = resolution.priceKrw ?? 0;
    const isEstimate = resolution.isEstimate;
    /* C-2E — 원본 재고 «사실» 은 한 번만 해석하고 두 규칙이 같은 것을 본다. */
    const stockFact = resolveSourceStock(product);
    const title = effectiveTitle(product);
    const description = effectiveDescription(product);

    const rules: FieldRule[] = [
      {
        field: "title",
        label: "상품명",
        check: () => title.trim().length > 0,
        onFail: "ERROR",
        message: "상품명이 비어 있습니다.",
      },
      {
        field: "brand",
        label: "브랜드",
        check: () => product.brand.value.trim().length > 0,
        onFail: "ERROR",
        message: "쿠팡은 브랜드 미기재 시 등록이 반려될 수 있습니다.",
      },
      {
        field: "representativeImage",
        label: "대표이미지",
        check: () => Boolean(representativeImage),
        onFail: "ERROR",
        message: "대표 이미지가 지정되지 않았습니다.",
      },
      imageFormatFieldRule(product),
      {
        /* ══ MI-COUPANG-IMAGE-WARNING-03 (CPO 방향 승인, 2026-09-30) ══════════
           🔴 «등록 전» 에 말한다. ListingResult(등록 후)는 건드리지 않았다 —
           이미 나간 상품에 대한 사후 통보는 셀러가 고칠 기회를 주지 않는다.

           🔴 WARNING 인 이유: CEO 결정 2 — 추가 이미지 문제만으로 등록을 막지
           않는다. runValidation 이 WARNING 을 내면 readiness.ts:130 이
           `required: v.status !== "WARNING"` 로 받아 required:false 가 되고,
           등록 버튼 게이트(allRequiredPassed)와 「등록 가능성」 퍼센트(required
           분모)를 «둘 다» 움직이지 않는다. 선례는 같은 파일의 stockUnknown 이다
           — 「모르는 것을 품절이라고 말하지 않는다. 사실만 알린다.」

           🔴 공유 모듈(image-field.ts)에 넣지 «않았다». 그것은 3채널이 같이
           쓰므로 11번가·스마트스토어까지 동반 노출된다. 이번 승인 범위는 쿠팡
           하나다 — 지시서 3항(「의도하지 않은 동반 노출이 있다면 확대하지 말고
           보고」)에 따라 어댑터 안에 둔다.

           🔴 label 에 sectionId 가 없다(readiness.ts 의 LABEL_TO_SECTION 에
           「추가 이미지」가 없다). WARNING 은 required 가 아니므로 「required 면
           반드시 sectionId」 계약에 걸리지 않는다 — 이동 앵커 문제는
           MI-IMAGE-SECTION-NAVIGATION-PRECHECK-01 의 몫이다. */
        field: "excludedAdditionalImages",
        label: "추가 이미지",
        check: () => excludedAdditionalImageCount === 0,
        onFail: "WARNING",
        message: `추가 이미지 ${excludedAdditionalImageCount}건이 등록에서 제외됐습니다. 안전한 이미지 URL을 확인해 주세요.`,
      },
      categoryFieldRule(categorySelection),
      {
        field: "price",
        label: "판매가격",
        // N-3.55(CPO 지시: "필드가 몇 개 MISSING인가보다 사장님이 지금 무엇을
        // 하면 되는가") — amountKrw>0만 보면 register/route.ts의 실제 게이트
        // (validateCoupangPricing, N-3.54에서 priceValidity로 이미 고쳐짐)와
        // 어긋날 수 있다 — 화면 체크리스트는 100%인데 등록 버튼을 누르면
        // PRICE_UNRESOLVED로 막히는 CP001류 신뢰 불일치를 막기 위해 이 화면도
        // 같은 판정(priceValidity)을 본다.
        // P-4-H1-2-2 STEP 5(대표님 지시: "override 없음 ≠ 가격 없음") — resolution.source가
        // SELLER_OVERRIDE든 SYSTEM_SUGGESTED든 값이 있으면 통과시킨다. UNRESOLVED일 때만 막는다.
        check: () => resolution.source !== "UNRESOLVED" && amountKrw > 0,
        onFail: "ERROR",
        message: resolution.reason ?? "판매가격을 확인할 수 없습니다.",
      },
      {
        /* ══ Commerce-6 C-2D(CPO 지시, 2026-09-26) — 재고 검사가 «없었다» ══

           쿠팡 payload 는 `maximumBuyCount: variant?.stockQuantity ??
           product.stockQuantity.value` 로 재고를 그대로 실어 보내는데 그 값이
           0 이어도 막는 규칙이 한 곳도 없었다 — 재고 0 인 상품이 체크리스트
           100% 로 등록됐다. 스마트스토어는 같은 것을 MISSING 으로 막는다(막는
           «척» 만 하고 있었지만 — C-2D 에서 함께 고쳤다).

           🔴 옵션 상품을 잘못 막지 않는다. payload 와 «같은 해석» 을 쓴다 —
           단품은 상품 재고를, 옵션 상품은 옵션 중 하나라도 재고가 있으면 판다고
           본다. 여기서 다른 규칙을 만들면 화면과 등록이 어긋난다(CP001 류). */
        field: "stock",
        label: "재고",
        /* 🔴 C-2E — C-2D 에서 쓴 `product.stockQuantity.value > 0` 은 «무효» 였다.
           그 값은 사실상 언제나 999(파이프라인 DEFAULT)다. 사실은 옵션 레벨에
           있고, 해석은 shared/source-stock 한 곳에서만 한다. */
        check: () => !blocksRegistration(stockFact),
        onFail: "ERROR",
        message: stockFact.note,
      },
      {
        /* 🔴 모르는 것을 품절이라고 말하지 않는다(CEO 정책: UNKNOWN 은 막지
           않는다). 다만 999 를 「재고 있음」으로 보여주지도 않는다 — WARNING
           으로 사실만 알린다. 등록 가능성 퍼센트를 움직이지 않는다. */
        field: "stockUnknown",
        label: "원본 재고 확인",
        check: () => stockFact.state !== "UNKNOWN",
        onFail: "WARNING",
        message: stockFact.note,
      },
      {
        field: "options",
        label: "옵션",
        check: () => product.options.value.length > 0,
        onFail: "WARNING",
        message: "옵션 정보가 없습니다.",
      },
      {
        field: "shipping",
        label: "배송정보",
        check: () => true,
        onFail: "WARNING",
      },
      {
        field: "description",
        label: "상세설명",
        check: () => description.trim().length > 0,
        onFail: "WARNING",
        message: "상세설명이 비어 있습니다.",
      },
    ];
    const validations = runValidation(rules);

    return {
      platform: "coupang",
      platformLabel: "쿠팡",
      representativeImage,
      additionalImages,
      title,
      brand: product.brand.value || undefined,
      priceKrw: amountKrw,
      priceIsEstimate: isEstimate,
      priceSource: resolution.source,
      priceOrigin: resolution.origin,
      options: product.options.value,
      shippingInfo: "해외배송",
      description,
      category: categorySelection,
      validations,
      registrableScore: scoreValidations(validations),
    };
  },
};
