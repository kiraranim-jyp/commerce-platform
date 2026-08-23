"use client";

import { useEffect, useMemo, useState } from "react";
import { buildNaverProductPayload, validateNaverPayload } from "@commerce/listing";
import { isVerifiedCategorySelected } from "@commerce/marketplace";
import type { ListingModel } from "@commerce/marketplace";
import type { CoupangDescriptionTemplate, DetailPageBlock, NaverPayloadValidationResult } from "@commerce/listing";
import type { CanonicalProduct, CommerceCategoryPathResult } from "@commerce/shared";
import { formatKrw } from "@commerce/pricing";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";

/**
 * Sprint N-2.7/N-2.8 — 네이버 v2 상품등록 payload를 실제 POST 없이 미리 보여준다.
 * N-2.6에서 만든 buildNaverProductPayload/validateNaverPayload를 그대로 쓴다
 * (payload를 다시 만들지 않는다 — 화면에 보이는 값과 Raw Payload가 어긋나면
 * CP001과 같은 신뢰 문제가 재발한다).
 *
 * N-2.9 — 카테고리 자동 매칭. /api/naver/category-search가 상품유형(영문→한글
 * 번역 후 Naver 리프 카테고리 4999건과 대조)/연령/성별 신호로 후보를 점수화해서
 * 반환한다. HIGH 후보가 있으면 입력란에 자동으로 채우되(사용자가 이미 직접
 * 입력했으면 덮어쓰지 않는다), 근거 문장은 항상 후보 목록에 그대로 보여준다
 * (CPO 지시: "HIGH라도 사용자가 확인할 수 있게 근거를 보여주는 방향을
 * 우선"). MEDIUM/LOW는 자동 채움 없이 후보만 보여주고 클릭해야 선택된다.
 * 선택된 categoryId는 기존 /api/naver/resolve(N-2.8)로 그대로 이어져 고시/
 * 인증/배송 상태를 갱신한다 — 두 리졸버를 하나로 합치지 않는다(관심사 분리).
 */

interface NaverReturnDeliveryCompany {
  id: number;
  name: string;
  priorityType: string;
}

interface NaverOriginAreaMatch {
  status: "MATCHED" | "OTHER_MANUAL" | "NO_INPUT";
  code: string | null;
  matchedDisplayName: string | null;
  requiresImporter: boolean;
}

/** N-3.27 — CommerceWorkspace가 RegistrationReadinessCard용 validateNaverPayload를
 * 이 컴포넌트와 똑같은 입력으로 계산하기 위해 이 응답 shape를 그대로 재사용한다
 * (export만 추가, 이 파일의 나머지 로직은 그대로 둔다). */
export interface NaverResolveResponse {
  status: string;
  category: {
    categoryId: string;
    exceptionalCategories: string[];
    requiresChildCertification: boolean;
    childCertificationInfoId: number | null;
    hierarchy: CommerceCategoryPathResult | null;
  } | null;
  address: { releaseAddressBookNo: number | null; refundAddressBookNo: number | null };
  // N-3.6(개정 Part A) — value는 Settings(SellerProfile.naverDeliveryCompanyCode)에
  // 판매자가 직접 입력한 값. 공식 조회 API는 여전히 없다(reason은 available=false일 때만).
  courier: { available: boolean; value: string | null; source: "SELLER_PROFILE" | null; reason?: string };
  // N-3.3 — 반품 택배사/반품·교환 배송비. 출고 택배사(courier 위)는 별개로
  // 여전히 조회 API가 없어 BLOCKED 고정이다.
  delivery: {
    returnCompanies: NaverReturnDeliveryCompany[];
    returnCompaniesFetchFailed: boolean;
    primaryReturnCompany: NaverReturnDeliveryCompany | null;
    deliveryFee: number | null;
    returnDeliveryFee: number | null;
    exchangeDeliveryFee: number | null;
  };
  // N-3.4 — GET /v1/product-origin-areas(535개 실제 코드) 매칭 결과.
  origin: {
    areaListFetchFailed: boolean;
    resolvedCountryText: string | null;
    match: NaverOriginAreaMatch;
  };
  // N-3.13 Part E-12 — SellerProfile.qualityGuarantee/asContactNumber 재사용
  // (Coupang "판매자 정보" 탭과 같은 값).
  // N-3.51 STEP2 — companyContactNumber는 afterServiceDirector(고시용
  // 자유 텍스트)와 별개로, afterServiceInfo.afterServiceTelephoneNumber
  // (엄격한 전화번호 포맷)에 쓰인다.
  // N-3.83 — brandProfile.manufacturer/sellerProfile.manufacturer 3단계
  // 우선순위 폴백 결과(Coupang register/route.ts와 동일 소스). product.
  // manufacturer.value(원문 추출)가 있으면 그게 항상 우선이고, 없을 때만
  // build-payload.ts가 이 값으로 보충한다.
  notice: {
    warrantyPolicy: string | null;
    afterServiceDirector: string | null;
    companyContactNumber: string | null;
    manufacturer: string | null;
  };
  // N-3.13 Part J — detailContent 조립에 필요한 재료. Coupang용으로 이미 있는
  // DescriptionTemplate/SellerProfile 공통이미지/BrandProfile.brandIntro를
  // 그대로 재사용한다(Naver 전용 템플릿을 새로 만들지 않는다).
  // N-3.86 STEP3(대표님 지시: "Preview와 실제 등록이 동일 소스") — detailBlocks도
  // 이제 서버(resolve-context.ts)가 resolveDetailBlocks()로 계산해서 내려준다.
  // 클라이언트는 더 이상 자기만의 detailBlocks 상태를 갖지 않는다.
  detailPage: {
    descriptionTemplate: CoupangDescriptionTemplate | null;
    commonImages: {
      topCommonImageUrl: string | null;
      topCommonImageEnabled: boolean;
      bottomCommonImageUrl: string | null;
      bottomCommonImageEnabled: boolean;
    };
    brandIntro: string | null;
    detailBlocks: DetailPageBlock[];
  };
}

/**
 * N-3.13 Part E-10(CPO 지시: "Naver 등록 준비 상태를 섹션별로 한눈에") — 이 맵을
 * scroll target(sectionId)뿐 아니라 사람이 읽는 그룹 라벨까지 함께 들고 있게
 * 확장했다. 기존엔 "naver-section-pricing"으로 잘못 적혀 있어(실제 DOM id는
 * "naver-section-price") 가격 관련 이슈를 클릭해도 스크롤이 전혀 안 되는
 * 버그가 있었다 — 이번에 같이 고쳤다. detailContent/naverShoppingRegistration은
 * 이 파일에 전용 섹션이 없어(전자는 Naver 상세페이지 에디터 자체가 아직
 * 없음 — Part J로 분리) 가장 가까운 "기본 상품정보" 섹션으로 보낸다(추측으로
 * 새 섹션을 만들지 않는다).
 */
const FIELD_SECTION: Record<string, { sectionId: string; group: string }> = {
  // N-3.15 Phase 3(STEP 2-B/2-C) — 기본정보/카테고리/가격/상세설명은 이제
  // NaverPayloadPreview 전용 섹션이 없다 — PlatformPreview 공유 Accordion의
  // section id(section-basic/section-category/section-price/section-shipping/
  // section-description)로 스크롤한다(같은 상품에 두 개의 "카테고리" 섹션이
  // 있던 예전 구조와 다르다).
  "originProduct.leafCategoryId": { sectionId: "section-category", group: "카테고리" },
  "originProduct.name": { sectionId: "section-basic", group: "상품정보" },
  "originProduct.detailContent": { sectionId: "section-description", group: "상세페이지" },
  "originProduct.images.representativeImage": { sectionId: "naver-section-images", group: "이미지" },
  "originProduct.salePrice": { sectionId: "section-price", group: "가격" },
  "originProduct.stockQuantity": { sectionId: "section-shipping", group: "가격" },
  "claimDeliveryInfo.shippingAddressId": { sectionId: "naver-section-shipping", group: "배송/반품" },
  "claimDeliveryInfo.returnAddressId": { sectionId: "naver-section-shipping", group: "배송/반품" },
  "deliveryInfo.deliveryCompany": { sectionId: "naver-section-shipping", group: "배송/반품" },
  "claimDeliveryInfo.returnDeliveryCompanyPriorityType": { sectionId: "naver-section-shipping", group: "배송/반품" },
  "claimDeliveryInfo.returnDeliveryFee": { sectionId: "naver-section-shipping", group: "배송/반품" },
  "claimDeliveryInfo.exchangeDeliveryFee": { sectionId: "naver-section-shipping", group: "배송/반품" },
  productCertificationInfos: { sectionId: "naver-section-certification", group: "인증(KC)" },
  "productCertificationInfos[].certificationNumber": { sectionId: "naver-section-certification", group: "인증(KC)" },
  "detailAttribute.optionInfo": { sectionId: "naver-section-options", group: "옵션" },
  "detailAttribute.optionInfo.optionCombinations[].optionName": { sectionId: "naver-section-options", group: "옵션" },
  "detailAttribute.originAreaInfo.originAreaCode": { sectionId: "naver-section-origin", group: "원산지" },
  "detailAttribute.originAreaInfo.importer": { sectionId: "naver-section-origin", group: "원산지" },
  "smartstoreChannelProduct.naverShoppingRegistration": { sectionId: "section-basic", group: "상품정보" },
};

/** N-3.13 Part E-12 — productInfoProvidedNotice(KIDS)/productInfoProvidedNotice(WEAR)
 * 두 타입 이름이 붙어서 field 문자열이 동적이라(예: "productInfoProvidedNotice(WEAR).material")
 * FIELD_SECTION에 KIDS/WEAR 조합마다 따로 넣는 대신 접두어로 매칭한다 —
 * 두 타입 모두 같은 "naver-section-notice" 섹션/"고시정보" 그룹으로 간다. */
function resolveFieldMeta(field: string): { sectionId: string; group: string } | undefined {
  if (field.startsWith("productInfoProvidedNotice")) {
    return { sectionId: "naver-section-notice", group: "고시정보" };
  }
  return FIELD_SECTION[field];
}

function payloadReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "string" && value.startsWith("data:") && value.length > 80) {
    return `${value.slice(0, 40)}…(${value.length}자)`;
  }
  return value;
}

export function NaverPayloadPreview({
  product,
  listing,
  sharedResolved,
  sharedResolving,
  sharedResolveError,
  sharedValidation,
}: {
  product: CanonicalProduct;
  /** N-3.15 Phase 3(STEP 2-B/2-C) — 기본정보/카테고리/가격 편집은 이제
   * PlatformPreview의 공유 Accordion에서만 일어난다(같은 listing을 읽는다).
   * 그래서 이 컴포넌트는 더 이상 가격 계산 핸들러(onUpdateSalePriceKrw 등)를
   * 받지 않는다 — PriceEditor를 여기서 또 그리지 않는다. */
  listing: ListingModel;
  /** N-3.73 STEP7(사용자 지시: "Payload Preview가 별도의 임의 BLOCKED 판정을
   * 만들지 못하게 한다") — CommerceWorkspace가 RegistrationReadinessCard용으로
   * 이미 fetch/계산해둔 결과. 이 3개 prop이 주어지면(undefined가 아니면) 이
   * 컴포넌트는 자기만의 /api/naver/resolve를 또 호출하지 않고 이 값만 쓴다 —
   * 두 화면이 서로 다른 네트워크 왕복에서 나온 데이터로 다른 판정을 보여줄 수
   * 없게 fetch 지점 자체를 하나로 합친다. undefined면(단독 사용/테스트 등)
   * 예전처럼 자체 fetch로 동작한다(하위 호환). */
  sharedResolved?: NaverResolveResponse | null;
  sharedResolving?: boolean;
  sharedResolveError?: string | null;
  /** validation 계산 자체도 같은 이유로 부모 값을 그대로 쓴다 — payload는
   * 여전히 이 컴포넌트가 만들지만(대표이미지/고시정보 등 표시용), 등록
   * 가능/불가 판정 숫자(READY/MISSING/BLOCKED)는 부모가 준 값이 있으면
   * 그것만 보여준다. */
  sharedValidation?: NaverPayloadValidationResult | null;
}) {
  const [showJson, setShowJson] = useState(false);
  const controlledByParent = sharedResolved !== undefined;
  const [localResolved, setLocalResolved] = useState<NaverResolveResponse | null>(null);
  const [localResolving, setLocalResolving] = useState(false);
  const [localResolveError, setLocalResolveError] = useState<string | null>(null);
  // N-3.15 Phase 3(STEP 2-C) — 예전엔 이 컴포넌트가 자기만의 categoryIdInput
  // state로 카테고리를 관리했다(별도 후보 검색+선택 UI 포함). 이제 카테고리
  // 선택은 공유 Accordion("카테고리" 섹션, PlatformPreview)에서만 이뤄지고,
  // 여기는 그 결과(listing.category)를 읽기만 한다 — 같은 상품에 카테고리가
  // 두 군데서 서로 다르게 보이는 버그(카테고리 선택했는데 미선택 판정)의
  // 원인이었다.
  //
  // N-3.73 STEP7(실제 코드에서 발견) — 이 줄이 지금까지 `isVerifiedPlatformCode`
  // 만 보고 있었다. AI가 추천만 했지 사용자가 "선택"을 누르지 않은 카테고리도
  // isVerifiedPlatformCode=true일 수 있어서(추천 자체가 검증된 Naver leaf
  // category id를 준다는 뜻이지, 사용자가 확정했다는 뜻이 아니다), 이
  // 컴포넌트만 카테고리를 "확정됨"으로 오판하고 우측 Readiness 카드는 "미확정"
  // 으로 보여주는 split-brain이 가능했다 — N-3.65가 CommerceWorkspace에서
  // 이미 고쳤던 것과 똑같은 버그 패턴이 여기 남아 있었다. isVerifiedCategorySelected()
  // 로 통일한다(CommerceWorkspace.tsx의 계산과 완전히 동일한 기준).
  const leafCategoryId =
    isVerifiedCategorySelected(listing.category) && listing.category.candidate?.platform === "smartstore"
      ? listing.category.candidate.id
      : "";

  // N-2.8 — leafCategoryId(공유 Accordion "카테고리" 섹션에서 확정된 값)가
  // 바뀔 때마다 나머지 필드를 실시간 조회한다. 500ms 디바운스로 짧은 시간에
  // 여러 번 바뀌어도 매번 호출하지 않는다.
  //
  // N-3.73 STEP7 — controlledByParent(부모가 이미 같은 조회를 해서 넘겨줬다)면
  // 이 fetch 자체를 건너뛴다. 두 번째 fetch가 존재하는 한, 그 결과가 어쩌다
  // 한 번이라도 부모와 달라질 가능성(Fixie 같은 외부 프록시가 두 요청 중 하나만
  // 실패하는 경우 등)을 완전히 없앨 수 없다 — fetch를 하나로 줄이는 것만이
  // 근본적인 해결책이다.
  useEffect(() => {
    if (controlledByParent) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLocalResolving(true);
      setLocalResolveError(null);
      const params = new URLSearchParams();
      if (leafCategoryId) params.set("categoryId", leafCategoryId);
      // N-3.4 — 상품추출 원산지 텍스트/브랜드명을 넘겨서 서버가 A-12-3과 동일한
      // 우선순위(상품추출 > 브랜드기본값 > Seller기본값)로 원산지 코드를 매칭한다.
      if (product.countryOfOrigin.value) params.set("countryOfOrigin", product.countryOfOrigin.value);
      if (product.brand.value) params.set("brand", product.brand.value);
      const query = params.toString() ? `?${params.toString()}` : "";
      fetch(`/api/naver/resolve${query}`)
        .then((res) => res.json())
        .then((data: NaverResolveResponse) => {
          if (cancelled) return;
          if (data.status !== "OK") {
            setLocalResolveError(
              data.status === "NOT_CONFIGURED"
                ? "네이버 인증 정보가 설정되어 있지 않습니다."
                : "네이버 API 조회에 실패했습니다.",
            );
            setLocalResolved(null);
            return;
          }
          setLocalResolved(data);
        })
        .catch(() => {
          if (!cancelled) setLocalResolveError("리졸버 호출 중 오류가 발생했습니다.");
        })
        .finally(() => {
          if (!cancelled) setLocalResolving(false);
        });
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [controlledByParent, leafCategoryId, product.countryOfOrigin.value, product.brand.value]);

  const resolved = controlledByParent ? (sharedResolved ?? null) : localResolved;
  const resolving = controlledByParent ? Boolean(sharedResolving) : localResolving;
  const resolveError = controlledByParent ? (sharedResolveError ?? null) : localResolveError;

  const releaseAddressBookNo = resolved?.address.releaseAddressBookNo ?? null;
  const refundAddressBookNo = resolved?.address.refundAddressBookNo ?? null;
  const childCertificationInfoId = resolved?.category?.childCertificationInfoId ?? null;
  const categoryRequiresChildCertification = resolved?.category?.requiresChildCertification ?? false;
  // N-3.3 — resolve API의 delivery 섹션을 그대로 쓴다(Preview에서 재계산하지 않는다).
  // resolved가 아직 없으면(초기 로딩) fetchFailed를 true로 간주해 BLOCKED로
  // 보이게 한다 — "값이 없다"와 "확인 실패"를 구분하되, 조회 전에는 낙관적으로
  // MISSING 취급하지 않는다.
  const returnCompaniesFetchFailed = resolved?.delivery?.returnCompaniesFetchFailed ?? true;
  const primaryReturnDeliveryCompanyPriorityType = resolved?.delivery?.primaryReturnCompany?.priorityType ?? null;
  const sellerDeliveryFee = resolved?.delivery?.deliveryFee ?? null;
  const returnDeliveryFee = resolved?.delivery?.returnDeliveryFee ?? null;
  const exchangeDeliveryFee = resolved?.delivery?.exchangeDeliveryFee ?? null;
  // N-3.4 — resolve API의 origin 섹션을 그대로 쓴다(Preview에서 재매칭하지 않는다).
  const originMatch = resolved?.origin?.match ?? { status: "NO_INPUT" as const, code: null, matchedDisplayName: null, requiresImporter: false };
  const originAreaCode = originMatch.code;
  const originAreaRequiresContent = originMatch.status === "OTHER_MANUAL";
  const originAreaRequiresImporter = originMatch.requiresImporter;
  // N-3.6(개정 Part A) — Settings에 판매자가 직접 입력한 값(공식 조회 API는
  // 없음, resolve route가 SellerProfile.naverDeliveryCompanyCode를 그대로 전달).
  const deliveryCompany = resolved?.courier?.value ?? null;
  // N-3.13 Part E-12 — resolve route가 SellerProfile.qualityGuarantee/
  // asContactNumber를 그대로 전달(Preview에서 재조회하지 않는다).
  const warrantyPolicy = resolved?.notice?.warrantyPolicy ?? null;
  const afterServiceDirector = resolved?.notice?.afterServiceDirector ?? null;
  // N-3.51 STEP2 — afterServiceDirector(고시용 자유 텍스트)와 다른 실제
  // 소스(SellerProfile.companyContactNumber, 이미 Coupang에서 쓰던 실제
  // 전화번호)를 쓴다 — afterServiceInfo.afterServiceTelephoneNumber는
  // 엄격한 전화번호 포맷만 허용한다(실제 등록 5차 시도로 확인).
  const afterServiceTelephoneNumber = resolved?.notice?.companyContactNumber ?? null;
  // N-3.83 — brandProfile/sellerProfile manufacturer 3단계 폴백(Coupang과 동일 소스).
  const resolvedManufacturer = resolved?.notice?.manufacturer ?? null;
  // N-3.13 Part J — resolve route가 내려준 재료(Coupang과 동일 소스)로
  // detailBlocks가 있을 때만 assembleContentsFromBlocks를 태운다. resolved가
  // 아직 없으면(초기 로딩) 안내문구/공통이미지 없이 조립하되, listing.description
  // 폴백은 detailBlocks 자체가 없을 때만 쓰이므로 로딩 중에도 값이 사라지지 않는다.
  const descriptionTemplate = resolved?.detailPage?.descriptionTemplate ?? null;
  const commonImages = resolved?.detailPage?.commonImages;
  const brandIntro = resolved?.detailPage?.brandIntro ?? null;
  // N-3.86 STEP3 — 더 이상 부모 컴포넌트의 detailBlocks state를 받지 않는다.
  // 서버(resolve-context.ts)가 resolveDetailBlocks()로 계산해서 내려준 값만 쓴다.
  const detailBlocks = resolved?.detailPage?.detailBlocks;

  const payload = useMemo(
    () =>
      buildNaverProductPayload({
        product,
        listing,
        leafCategoryId,
        releaseAddressBookNo,
        refundAddressBookNo,
        primaryReturnDeliveryCompanyPriorityType,
        sellerDeliveryFee,
        returnDeliveryFee,
        exchangeDeliveryFee,
        childCertificationInfoId,
        categoryRequiresChildCertification,
        originAreaCode,
        originAreaRequiresContent,
        deliveryCompany,
        warrantyPolicy,
        afterServiceDirector,
        afterServiceTelephoneNumber,
        detailBlocks,
        descriptionTemplate,
        commonImages,
        brandIntro,
        resolvedManufacturer,
      }),
    [
      product,
      listing,
      leafCategoryId,
      releaseAddressBookNo,
      refundAddressBookNo,
      primaryReturnDeliveryCompanyPriorityType,
      sellerDeliveryFee,
      returnDeliveryFee,
      exchangeDeliveryFee,
      childCertificationInfoId,
      categoryRequiresChildCertification,
      originAreaCode,
      originAreaRequiresContent,
      deliveryCompany,
      warrantyPolicy,
      afterServiceDirector,
      afterServiceTelephoneNumber,
      detailBlocks,
      descriptionTemplate,
      commonImages,
      brandIntro,
      resolvedManufacturer,
    ],
  );

  const locallyComputedValidation = useMemo(
    () =>
      validateNaverPayload(
        payload,
        {
          product,
          releaseAddressBookNo,
          refundAddressBookNo,
          primaryReturnDeliveryCompanyPriorityType,
          returnDeliveryFee,
          exchangeDeliveryFee,
          returnCompaniesFetchFailed,
          childCertificationInfoId,
          originAreaCode,
          originAreaRequiresImporter,
          deliveryCompany,
          warrantyPolicy,
          afterServiceDirector,
          afterServiceTelephoneNumber,
        },
        categoryRequiresChildCertification,
      ),
    [
      payload,
      product,
      releaseAddressBookNo,
      refundAddressBookNo,
      primaryReturnDeliveryCompanyPriorityType,
      returnDeliveryFee,
      exchangeDeliveryFee,
      returnCompaniesFetchFailed,
      childCertificationInfoId,
      categoryRequiresChildCertification,
      deliveryCompany,
      originAreaCode,
      originAreaRequiresImporter,
      warrantyPolicy,
      afterServiceDirector,
      afterServiceTelephoneNumber,
    ],
  );
  // N-3.73 STEP7 — sharedValidation(부모, CommerceWorkspace가 이미 계산한 값)이
  // 있으면 그걸 그대로 쓴다. 여기서 다시 계산한 locallyComputedValidation은
  // sharedValidation이 없을 때(단독 사용/테스트)만 폴백으로 쓰인다 — "같은
  // 함수를 부르지만 서로 다른 계산에서 나온 값"이라는 위험을 없앤다.
  const validation = sharedValidation ?? locallyComputedValidation;

  const hasOptions = product.optionGroups.length > 0;
  // N-3.5 — READY/MISSING/BLOCKED 개수는 validateNaverPayload()가 직접 계산해서
  // 돌려준다(Final Validator). Preview는 이 값을 그대로 쓰고 별도로 다시
  // 계산하지 않는다 — 이전의 countTotalCheckedFields() 근사 함수는 제거했다.
  const { readyCount, missingCount, blockedCount } = validation;
  const blockedIssues = validation.issues.filter((i) => i.severity === "BLOCKED");
  const missingIssues = validation.issues.filter((i) => i.severity === "MISSING");

  const notice = payload.originProduct.detailAttribute?.productInfoProvidedNotice;
  const representative = payload.originProduct.images.representativeImage.url;
  const optionalImages = payload.originProduct.images.optionalImages ?? [];

  function goToSection(field: string) {
    const sectionId = resolveFieldMeta(field)?.sectionId;
    if (!sectionId) return;
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // N-3.13 Part E-10(CPO 지시: "Naver 등록 준비 상태를 섹션별로 한눈에 —
  // [카테고리] 🟢 [상품정보] 🟢 ... 형태") — validate-payload.ts가 검사한
  // 모든 필드(validation.fields, READY 포함)를 그룹별로 묶어 그룹당 최악
  // 상태 하나만 배지로 보여준다. 이 화면이 새로 계산하지 않고 Final
  // Validator가 이미 낸 결과만 집계한다(N-3.5 원칙 유지 — "Preview에서
  // 별도 판단 로직을 만들지 않는다").
  // N-3.13 Part I — advisory 필드(등록 가능 여부와 무관, CPO 결정)는 여기서도
  // 뺀다. 안 빼면 다른 모든 값이 채워진 상품도 이 그룹만 영원히 🟡로 남아
  // Registration Gate(🟢)와 섹션 배지가 서로 다른 그림을 보여주는 모순이
  // 생긴다 — Gate와 같은 기준을 쓴다는 원칙(I-3)을 섹션 요약에도 그대로
  // 적용한다.

  // N-3.17(CPO 지시: "SmartStore Preview/Workspace 중복 제거 — 등록 가능
  // 여부/등록 버튼은 우측 RegistrationReadinessCard 하나로만 판단한다") —
  // 예전엔 이 컴포넌트가 자기만의 "등록 가능 여부 + 등록하기 버튼 +
  // [카테고리]🟢 요약"을 화면 맨 위에 따로 그렸다. 우측에 이미 같은 질문("등록
  // 가능한가?")에 답하는 RegistrationReadinessCard가 있어서, 두 판정이 서로
  // 다른 계산식(validateNaverPayload vs computeReadinessScoreSummary)에서
  // 나오면 두 곳이 다른 답을 보여줄 위험이 있다(CP001과 같은 종류) — 화면에
  // 등록 CTA/상태를 하나만 남기고, 이 컴포넌트는 "고급 검증 정보"(payload
  // 필드 단위 상세, 우측 카드가 안 보여주는 정보)만 담당한다.
  return (
    <CollapsibleSection
      title="Payload Preview"
      summary="원산지 · 고시정보 · KC · 배송/반품 등 SmartStore 전용 항목입니다. 등록 가능 여부는 우측 등록 준비도 카드를 확인하세요."
    >
      {(blockedIssues.length > 0 || missingIssues.length > 0) && (
        <CollapsibleSection title="고급 검증 정보(필드 단위)">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-success">🟢 READY {readyCount}</span>
            <span className="text-warning">🟡 MISSING {missingCount}</span>
            <span className="text-error">🔴 BLOCKED {blockedCount}</span>
          </div>
          {blockedIssues.length > 0 && (
            <div className="mt-2">
              <p className="text-[11px] font-semibold text-error">BLOCKED</p>
              <ul className="mt-1 space-y-1">
                {blockedIssues.map((issue, i) => (
                  <li key={`blocked-${issue.field}-${i}`} className="flex items-start gap-1.5 text-[11px]">
                    <span className="text-error">🔴</span>
                    <button
                      type="button"
                      onClick={() => goToSection(issue.field)}
                      className="min-w-0 flex-1 text-left text-text-secondary hover:text-text-primary hover:underline"
                    >
                      <span className="font-medium text-text-primary">{issue.field}</span> — {issue.reason}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {missingIssues.length > 0 && (
            <div className="mt-2">
              <p className="text-[11px] font-semibold text-warning">MISSING</p>
              <ul className="mt-1 space-y-1">
                {missingIssues.map((issue, i) => (
                  <li key={`missing-${issue.field}-${i}`} className="flex items-start gap-1.5 text-[11px]">
                    <span className="text-warning">🟡</span>
                    <button
                      type="button"
                      onClick={() => goToSection(issue.field)}
                      className="min-w-0 flex-1 text-left text-text-secondary hover:text-text-primary hover:underline"
                    >
                      <span className="font-medium text-text-primary">{issue.field}</span> — {issue.reason}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CollapsibleSection>
      )}
      {/* N-3.13 Part I(CPO 결정, 2026-08-12) — 등록 가능 여부와는 무관하지만
       * 판매자가 알아야 하는 참고 정보. "차단"이나 "입력 필요" 목록에 섞이면
       * 등록을 막는 원인처럼 오해할 수 있어 별도 블록으로 분리한다. */}
      {validation.advisoryNotes.length > 0 && (
        <div className="rounded-md bg-background p-3">
          <p className="text-[11px] font-semibold text-text-tertiary">참고(등록 가능 여부와 무관)</p>
          <ul className="mt-1 space-y-1">
            {validation.advisoryNotes.map((note, i) => (
              <li key={`advisory-${note.field}-${i}`} className="flex items-start gap-1.5 text-[11px]">
                <span className="text-text-tertiary">ℹ️</span>
                <span className="min-w-0 flex-1 text-text-secondary">
                  <span className="font-medium text-text-primary">{note.field}</span> — {note.reason}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* N-3.15 Phase 3(STEP 2-B/2-C) — 기본정보/카테고리/가격은 더 이상 여기서
       * 따로 그리지 않는다. PlatformPreview의 공유 Accordion("기본정보"/
       * "카테고리"/"가격" 섹션)이 스마트스토어/쿠팡 양쪽에 이미 동일하게
       * 렌더링되고 있고, 카테고리는 이제 이 파일이 아니라 CommerceWorkspace의
       * categoryCandidates/onSelectCategory를 통해서만 확정된다(leafCategoryId는
       * 그 결과를 읽기만 한다) — 여기서 또 그리면 "같은 상품인데 두 군데서 다른
       * 카테고리/가격이 보이는" 예전 버그가 재발한다. */}

      {resolving && <p className="text-[11px] text-text-tertiary">네이버 카테고리 조회 중...</p>}
      {resolveError && <p className="text-[11px] text-error">{resolveError}</p>}

      <Section id="naver-section-images" title="이미지">
        <div className="flex flex-wrap gap-2">
          {representative && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={representative} alt="대표" className="h-14 w-14 rounded border-2 border-primary object-cover" />
          )}
          {optionalImages.map((img, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={img.url} alt="" className="h-14 w-14 rounded border border-border object-cover" />
          ))}
          {!representative && <p className="text-xs text-text-tertiary">MISSING — 대표 이미지 없음</p>}
        </div>
      </Section>

      <Section id="naver-section-options" title="옵션">
        {hasOptions ? (
          <>
            {product.variants.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-text-tertiary">
                      {Object.keys(product.variants[0].optionValues).map((k) => (
                        <th key={k} className="pb-1 pr-3 font-medium">
                          {k}
                        </th>
                      ))}
                      <th className="pb-1 pr-3 font-medium">최종판매가</th>
                      <th className="pb-1 font-medium">재고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.variants.map((v, i) => {
                      // N-3.27/N-3.47(CPO 지시: "Preview와 실제 Register가 서로
                      // 다른 값을 계산하지 않도록") — 여기서 가격을 다시 계산하지
                      // 않는다. build-payload.ts가 실제로 만든 optionCombinations
                      // (index가 product.variants와 1:1 대응 — buildOptionCombinations의
                      // product.variants.map 순서 그대로)의 price(salePrice 대비
                      // 추가금액, N-3.47 공식 확인)를 그대로 읽어 salePrice에 더한
                      // "이 옵션이 실제로 등록될 최종가"만 보여준다. 예전엔 여기서
                      // variant.price(원본 통화, 대부분 비어 있어 "—"로만 보였다)를
                      // 직접 찍어서 옵션 Accordion(OptionVariantEditor)의 최종판매가
                      // 열과 다른 값(공백)을 보여주는 불일치가 있었다.
                      const combo = payload.originProduct.detailAttribute?.optionInfo?.optionCombinations?.[i];
                      const finalPriceKrw = combo ? payload.originProduct.salePrice + combo.price : null;
                      return (
                        <tr key={v.id} className="border-t border-border">
                          {Object.values(v.optionValues).map((val, idx) => (
                            <td key={idx} className="py-1 pr-3 text-text-primary">
                              {val}
                            </td>
                          ))}
                          <td className="py-1 pr-3 text-text-primary">
                            {finalPriceKrw != null ? formatKrw(finalPriceKrw) : "—"}
                          </td>
                          <td className="py-1 text-text-primary">{v.stockQuantity ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-text-tertiary">옵션 그룹은 있으나 조합(variant) 정보가 없습니다.</p>
            )}
            {/* N-3.72(사용자 지시: "실제로는 안 막는데 화면이 계속 BLOCKED라고
             * 말한다") — 이 배너는 N-3.47에서 옵션가(price)가 salePrice 대비
             * 추가금액(delta)이라는 게 Naver 공식 계정 답변(GitHub Discussion
             * #2312)으로 이미 확정된 뒤에도 그대로 하드코딩돼 남아 있었다 —
             * validation 결과와 무관하게 항상 떠서, 실제로는 READY인 상품도
             * "🔴 BLOCKED"로 보이게 만들었다(이번 스프린트에서 실제로 옵션
             * 있는 상품을 여러 번 실등록 성공시켰는데도 이 배너만 그대로
             * 남아 있었던 게 그 증거). 진짜 BLOCKED 사유(최종가가 0원 미만이
             * 되는 조합)만 validate-payload.ts의 실제 판정(validation.issues)을
             * 그대로 보여준다 — 새 판정을 만들지 않는다. */}
            {validation.issues.some(
              (i) => i.field === "detailAttribute.optionInfo.optionCombinations[].price",
            ) && (
              <p className="rounded bg-error-soft px-2 py-1 text-[11px] text-error">
                🔴 BLOCKED —{" "}
                {
                  validation.issues.find(
                    (i) => i.field === "detailAttribute.optionInfo.optionCombinations[].price",
                  )?.reason
                }
              </p>
            )}
            {validation.issues.some(
              (i) => i.field === "detailAttribute.optionInfo.optionCombinations[].optionName",
            ) && (
              <p className="rounded bg-warning-soft px-2 py-1 text-[11px] text-warning">
                🟡 MISSING — 일부 옵션 조합에 값이 비어 있는 옵션 그룹이 있습니다. 원본 상품의 옵션 값을
                확인하세요.
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-text-tertiary">옵션 없음</p>
        )}
      </Section>

      <Section id="naver-section-origin" title="원산지">
        <Row
          label="원산지"
          value={
            resolved?.origin?.resolvedCountryText ??
            "MISSING — 상품 원본/브랜드 설정/판매자 기본값 중 어느 것도 없음"
          }
        />
        <Row
          label="원산지 코드"
          value={
            originMatch.status === "NO_INPUT"
              ? "MISSING — 원산지 텍스트 없음"
              : originMatch.status === "OTHER_MANUAL"
                ? `✓ 04(직접입력) — 원문 텍스트 그대로 표기`
                : `✓ ${originMatch.code} (${originMatch.matchedDisplayName})`
          }
        />
        <Row
          label="수입사명"
          value={
            originMatch.requiresImporter
              ? "MISSING — TTAEJYO에 소스 없음(수입산 필수 항목)"
              : "해당없음(수입산 아님)"
          }
        />
        <p className="text-[11px] text-text-tertiary">
          원산지 코드는 GET /v1/product-origin-areas(535개 실제 코드, N-3.4 실측 확인)에서 매칭합니다. 목록에
          없는 표현은 코드를 지어내지 않고 04(직접입력)로 대체합니다. 브랜드 국가를 원산지로 자동 추정하지
          않습니다.
        </p>
      </Section>

      <Section id="naver-section-notice" title="상품정보제공고시">
        {notice ? (
          <>
            {/* N-3.51 STEP1 — material/color 등은 WEAR/KIDS 타입에 따라
                notice.wear / notice.kids 하위 객체에 들어있다(실제 Naver 응답
                구조, types.ts 주석 참고) — 더 이상 notice에 직접 붙어있지
                않는다. */}
            <Row label="상품군" value={notice.productInfoProvidedNoticeType} />
            {"wear" in notice ? (
              <>
                <Row label="재질" value={notice.wear.material || "MISSING"} />
                <Row label="색상" value={notice.wear.color || "MISSING"} />
                <Row label="제조자" value={notice.wear.manufacturer || "MISSING"} />
                <Row label="주의사항" value={notice.wear.caution || "MISSING"} />
                {/* N-3.13 Part E-12 — 공식 스펙 required 필드로 새로 확인됨.
                    SellerProfile.qualityGuarantee/asContactNumber 재사용(Settings
                    "판매자 정보" 탭과 동일 값). */}
                <Row
                  label="품질보증기준"
                  value={notice.wear.warrantyPolicy || "MISSING — Settings 판매자 정보 탭에서 입력 필요"}
                />
                <Row
                  label="A/S 책임자·전화번호"
                  value={notice.wear.afterServiceDirector || "MISSING — Settings 판매자 정보 탭에서 입력 필요"}
                />
                <p className="text-[11px] text-text-tertiary">치수(사이즈)는 TTAEJYO에 아직 입력 경로가 없어 항상 MISSING입니다.</p>
              </>
            ) : (
              <>
                <Row label="재질" value={notice.kids.material || "MISSING"} />
                <Row label="색상" value={notice.kids.color || "MISSING"} />
                <Row label="제조자" value={notice.kids.manufacturer || "MISSING"} />
                <Row label="주의사항" value={notice.kids.caution || "MISSING"} />
                <Row label="권장연령" value={notice.kids.recommendedAge || "MISSING"} />
                {/* N-3.44(CPO 지시) — 이전엔 항상 MISSING이라는 안내 문구만
                    보여줬다. 이제 상품 정보 편집 화면에 입력 경로가 생겨서
                    실제 payload 값을 그대로 보여준다(추측/기본값 없음). */}
                <Row label="품명" value={notice.kids.itemName || "MISSING"} />
                <Row label="모델명" value={notice.kids.modelName || "MISSING"} />
                <Row label="중량" value={notice.kids.weight || "MISSING"} />
                <Row label="KC 인증정보(대상 여부)" value={notice.kids.certificationType || "MISSING"} />
                <Row
                  label="품질보증기준"
                  value={notice.kids.warrantyPolicy || "MISSING — Settings 판매자 정보 탭에서 입력 필요"}
                />
                <Row
                  label="A/S 책임자·전화번호"
                  value={notice.kids.afterServiceDirector || "MISSING — Settings 판매자 정보 탭에서 입력 필요"}
                />
              </>
            )}
          </>
        ) : (
          <p className="text-xs text-text-tertiary">고시정보 없음</p>
        )}
      </Section>

      <Section id="naver-section-certification" title="인증정보">
        {categoryRequiresChildCertification ? (
          <>
            <p className="text-xs font-medium text-warning">⚠ 어린이제품 인증 필요</p>
            <Row label="인증종류" value="CHILD_CERTIFICATION" />
            {/* N-3.44 — 이전엔 항상 "MISSING" 텍스트만 하드코딩돼 있었다(사용자가
                이미 인증정보를 입력해도 반영 안 됨). buildNaverProductPayload가
                실제로 만든 payload 값을 그대로 보여준다. */}
            <Row label="인증번호" value={payload.originProduct.detailAttribute?.productCertificationInfos?.[0]?.certificationNumber || "MISSING"} />
            <Row label="인증기관" value={payload.originProduct.detailAttribute?.productCertificationInfos?.[0]?.companyName || "MISSING"} />
            <Row label="인증일자" value={payload.originProduct.detailAttribute?.productCertificationInfos?.[0]?.certificationDate || "MISSING"} />
          </>
        ) : resolved?.category ? (
          <p className="text-xs text-text-tertiary">이 카테고리는 어린이제품 인증(CHILD_CERTIFICATION) 대상이 아닙니다.</p>
        ) : (
          <p className="text-xs text-text-tertiary">
            카테고리 미입력 — 위 카테고리 섹션에서 실제 Naver 카테고리 ID를 입력하면 인증요건을 실시간으로 조회합니다.
          </p>
        )}
      </Section>

      <Section id="naver-section-shipping" title="배송 / 반품">
        <Row
          label="출고지"
          value={
            releaseAddressBookNo !== null
              ? `✓ 판매자 등록 출고지 사용 (addressBookNo: ${releaseAddressBookNo})`
              : "MISSING — 판매자 주소록(Wing)에 출고지 등록 필요"
          }
        />
        <Row
          label="반품/교환지"
          value={
            refundAddressBookNo !== null
              ? `✓ 판매자 등록 반품지 사용 (addressBookNo: ${refundAddressBookNo})`
              : "MISSING — 판매자 주소록(Wing)에 반품지 등록 필요"
          }
        />
        <Row
          label="출고 택배사"
          value={
            resolved?.courier?.value
              ? `✓ ${resolved.courier.value}(Settings 수동 입력, 공식 조회 API는 없음)`
              : `MISSING — ${resolved?.courier?.reason ?? "Settings의 배송 프로필에서 네이버 택배사를 입력하면 해결됩니다(공식 조회 API 없음)."}`
          }
        />
        <Row
          label="반품 택배사"
          value={
            returnCompaniesFetchFailed
              ? "BLOCKED — 반품 택배사 목록 조회에 실패했습니다(네이버 API 오류)."
              : resolved?.delivery?.primaryReturnCompany
                ? `✓ ${resolved.delivery.primaryReturnCompany.name} (${resolved.delivery.primaryReturnCompany.priorityType})`
                : "MISSING — Wing에서 반품 택배사 등록 필요"
          }
        />
        <Row
          label="배송비"
          value={`${payload.originProduct.deliveryInfo?.deliveryFee?.deliveryFeeType === "FREE" ? "무료배송" : "미확정"} (기본값 — 실제 배송비 정책 미연동)`}
        />
        <Row
          label="반품배송비"
          value={returnDeliveryFee !== null ? formatKrw(returnDeliveryFee) : "MISSING — Settings에서 배송 정책 입력 필요"}
        />
        <Row
          label="교환배송비"
          value={exchangeDeliveryFee !== null ? formatKrw(exchangeDeliveryFee) : "MISSING — Settings에서 배송 정책 입력 필요"}
        />
        <p className="text-[11px] text-text-tertiary">
          출고지/반품지는 판매자 주소록(GET /v1/seller/addressbooks-for-page)에서, 반품 택배사는 GET
          /v2/product-delivery-info/return-delivery-companies에서 실시간 조회됩니다. addressBookNo →
          shippingAddressId/returnAddressId 매핑은 공식 OpenAPI 스펙(필드명 &ldquo;출고지 주소록 번호&rdquo;/
          &ldquo;반품/교환지 주소록 번호&rdquo;)으로 확인됐습니다(N-3.3). 출고 택배사(deliveryInfo.deliveryCompany)
          조회 API만 스펙에 없어 여전히 BLOCKED입니다.
        </p>
      </Section>

      {/* Sprint P1(CPO 지시, 2026-08-19: "SmartStore도 실제 등록 payload를
          확인할 수 있는 마지막 검증 지점이 필요") — Coupang의 별도
          "Payload Preview" 아코디언과 성격이 같다(같은 payload 상태를
          그대로 JSON.stringify — 여기서 새로 계산하지 않는다). SmartStore는
          이미 이 컴포넌트가 필드별 상세 + Raw Payload를 함께 보여주고
          있었으므로 새 섹션을 만들지 않고, Coupang과 같은 설명 문구로
          맞춰 "이게 그 마지막 확인 지점"이라는 걸 명확히 한다. */}
      <div className="space-y-1.5">
        <p className="text-xs text-text-tertiary">
          실제로 SmartStore에 전송될 데이터입니다 — 등록 버튼을 누르기 전에도 항상 최신 상태로
          계산되어 있습니다.
        </p>
        <button
          type="button"
          onClick={() => setShowJson((v) => !v)}
          className="text-xs font-medium text-text-secondary underline decoration-border hover:text-text-primary"
        >
          {showJson ? "Payload Preview 닫기" : "▶ Payload Preview (Naver v2 Request)"}
        </button>
      </div>
      {showJson && (
        <pre className="max-h-96 overflow-auto rounded-md bg-background p-2 text-[11px] text-text-secondary">
          {JSON.stringify(payload, payloadReplacer, 2)}
        </pre>
      )}
    </CollapsibleSection>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-4 rounded-md border border-border p-3">
      <h4 className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">{title}</h4>
      <dl className="mt-2 space-y-1">{children}</dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const isProblem = value === "MISSING" || value.startsWith("BLOCKED") || value === "미확정";
  return (
    <div className="flex items-start gap-2 text-xs">
      <dt className="w-20 shrink-0 text-text-secondary">{label}</dt>
      <dd className={isProblem ? "text-warning" : "text-text-primary"}>{value}</dd>
    </div>
  );
}
