import { PLATFORM_ADAPTERS, isVerifiedCategorySelected } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY, type CategorySelection } from "@commerce/category";
import { buildNaverProductPayload, defaultDetailBlocks, validateNaverPayload, type DetailPageBlock } from "@commerce/listing";
import type { CanonicalProduct, PlatformId } from "@commerce/shared";
import { resolveNaverContext } from "../../naver/_lib/resolve-context";
import { getRegisteredPlatforms } from "./registration-status";
import { computeChecklistReadiness, computeNaverPayloadReadiness } from "../../../pipeline/commerce/readiness";
import {
  buildPriorityItems,
  resolveRegistrationReadinessState,
  type PriorityItem,
  type RegistrationReadinessState,
} from "../../../pipeline/commerce/readiness-state";

/**
 * N-3.56 STEP1/5(CPO 지시: "각 플랫폼의 기존 validator를 그대로 사용한다 —
 * 한 플랫폼의 validation 결과를 다른 플랫폼에 재사용하지 않는다") — 대시보드가
 * 스냅샷 하나의 플랫폼별 등록 준비 상태를 계산할 때, PlatformPreview.tsx가
 * 실제 등록 화면에서 쓰는 것과 완전히 같은 함수(computeNaverPayloadReadiness/
 * computeChecklistReadiness, resolveRegistrationReadinessState/buildPriorityItems)를
 * 그대로 호출한다 — 여기서 새 판정 로직을 만들지 않는다.
 *
 * 조사 결과(a5a47ac266b49b160) — Naver는 카테고리 상세/주소록/배송사 등을
 * 실제 Naver API에서 매번 다시 조회해야 KC 상태(BLOCKED/SELLER_REVIEW_REQUIRED/
 * CERTIFIED_REFERENCE/NOT_APPLICABLE)를 정확히 계산할 수 있다 — 스냅샷에는
 * canonicalProduct만 저장돼 있고 이 조회 결과 자체는 저장되지 않는다(고의 —
 * 카테고리 API 상태가 바뀔 수 있는 파생 데이터를 중복 저장하지 않는다는
 * 기존 원칙, types.ts 주석 참고). Coupang/11번가는 same reason으로 카테고리
 * 메타(고시정보/KC) 조회가 필요하지만, 그 조회는 Coupang API 크레덴셜+
 * 카테고리 코드당 API 호출이 필요해 다중 상품 대시보드에서 매번 돌리면
 * 비용이 커진다 — 이번 스프린트는 그 비용 판단에 따라 Coupang/11번가는
 * "가격+카테고리 확정 여부+마켓플레이스 필수 필드 검증"까지만 계산하고
 * (컴플라이언스 리포트는 제외), SmartStore만 실제 등록 게이트와 완전히
 * 동일한 전체 계산을 한다 — 이 범위 제한은 CPO STEP18 최종 보고에서
 * 명시적으로 알린다(추측으로 조용히 축소하지 않는다).
 */
export interface PlatformReadiness {
  platform: PlatformId;
  supported: boolean;
  categoryConfirmed: boolean;
  state: RegistrationReadinessState;
  priorityItems: PriorityItem[];
  /** SmartStore만 채워진다(위 주석 참고) — 채워지지 않으면 undefined. */
  kcStatus?: string;
  /** N-3.57 STEP0/STEP9 — registration_attempts(snapshot_id로 실제 연결된
   * 기록, status='SUBMITTED')에 이 플랫폼 등록 이력이 있으면 true. 이 값이
   * true면 대시보드는 위 state 대신 "이미 등록됨"으로 표시한다 — state 자체는
   * 그대로 두어서(등록 후에도 값이 바뀌면 안 되는 감사용 계산이 아니라
   * "지금 다시 등록하면 통과하는가"를 보여주는 값이기 때문) 재등록/타 플랫폼
   * 판단에 계속 쓸 수 있다. */
  registered: boolean;
}

export interface SnapshotReadiness {
  priceValid: boolean;
  platforms: PlatformReadiness[];
}

const SUPPORTED_PLATFORMS: PlatformId[] = ["smartstore", "coupang", "elevenst"];

async function computeSmartstoreReadiness(
  product: CanonicalProduct,
  category: CategorySelection,
  detailBlocks: DetailPageBlock[],
  registered: boolean,
): Promise<PlatformReadiness> {
  const categoryConfirmed = isVerifiedCategorySelected(category);
  const leafCategoryId = categoryConfirmed && category.candidate?.platform === "smartstore" ? category.candidate.id : "";

  const context = await resolveNaverContext({
    categoryId: leafCategoryId || null,
    countryOfOrigin: product.countryOfOrigin.value || null,
    brand: product.brand.value || null,
  });

  if (context.status !== "OK") {
    // Naver 인증정보 미설정/토큰 실패 — 이 상품만의 문제가 아니라 계정
    // 설정 문제이므로 BLOCKED로 표시하고 이유를 우선순위 항목에 남긴다.
    return {
      platform: "smartstore",
      supported: true,
      categoryConfirmed,
      state: "BLOCKED",
      priorityItems: [
        {
          key: "naver-account",
          label: "네이버 계정 연결 확인",
          detail: context.status === "NOT_CONFIGURED" ? context.message : context.message,
          sourceItems: [],
        },
      ],
      registered,
    };
  }

  const releaseAddressBookNo = context.address.releaseAddressBookNo;
  const refundAddressBookNo = context.address.refundAddressBookNo;
  const childCertificationInfoId = context.category?.childCertificationInfoId ?? null;
  const categoryRequiresChildCertification = context.category?.requiresChildCertification ?? false;
  const primaryReturnDeliveryCompanyPriorityType = context.delivery.primaryReturnCompany?.priorityType ?? null;
  const returnDeliveryFee = context.delivery.returnDeliveryFee;
  const exchangeDeliveryFee = context.delivery.exchangeDeliveryFee;
  const originAreaCode = context.origin.match.code;
  const originAreaRequiresContent = context.origin.match.status === "OTHER_MANUAL";
  const deliveryCompany = context.courier.value;
  const warrantyPolicy = context.notice.warrantyPolicy;
  const afterServiceDirector = context.notice.afterServiceDirector;
  const afterServiceTelephoneNumber = context.notice.companyContactNumber;

  const listing = PLATFORM_ADAPTERS.smartstore.toListingModel(product, category);
  const payload = buildNaverProductPayload({
    product,
    listing,
    leafCategoryId,
    releaseAddressBookNo,
    refundAddressBookNo,
    primaryReturnDeliveryCompanyPriorityType,
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
    descriptionTemplate: context.detailPage.descriptionTemplate,
    commonImages: context.detailPage.commonImages,
    brandIntro: context.detailPage.brandIntro,
  });
  const validation = validateNaverPayload(
    payload,
    {
      product,
      releaseAddressBookNo,
      refundAddressBookNo,
      primaryReturnDeliveryCompanyPriorityType,
      returnDeliveryFee,
      exchangeDeliveryFee,
      returnCompaniesFetchFailed: context.delivery.returnCompaniesFetchFailed,
      childCertificationInfoId,
      originAreaCode,
      originAreaRequiresImporter: context.origin.match.requiresImporter,
      deliveryCompany,
      warrantyPolicy,
      afterServiceDirector,
      afterServiceTelephoneNumber,
    },
    categoryRequiresChildCertification,
  );

  const summary = computeNaverPayloadReadiness(validation);
  const priceValid = product.priceValidity === "VALID";
  const state = resolveRegistrationReadinessState(summary, priceValid, validation.kcStatus);
  const priorityItems = buildPriorityItems(summary, priceValid, "section-price");

  return {
    platform: "smartstore",
    supported: true,
    categoryConfirmed,
    state,
    priorityItems,
    kcStatus: validation.kcStatus,
    registered,
  };
}

function computeMarketplaceReadiness(
  product: CanonicalProduct,
  category: CategorySelection,
  platform: "coupang" | "elevenst",
  registered: boolean,
): PlatformReadiness {
  const categoryConfirmed = isVerifiedCategorySelected(category);
  const listing = PLATFORM_ADAPTERS[platform].toListingModel(product, category);
  // N-3.56(이 파일 상단 주석 참고) — compliance report(고시/KC 등)는 카테고리
  // API 실시간 조회가 필요해 이번 대시보드 배치 계산에서는 제외한다. 가격/
  // 카테고리/마켓플레이스 필수 필드(상품명/이미지/옵션/배송정보 등)까지만
  // 계산한다 — 최종 등록 게이트(register route)는 이 계산을 그대로 쓰지
  // 않으므로, 이 카드는 "1차 판단"이지 최종 게이트와 100% 동일하지 않다.
  const summary = computeChecklistReadiness(listing.validations, listing.category);
  const priceValid = product.priceValidity === "VALID";
  const state = resolveRegistrationReadinessState(summary, priceValid);
  const priorityItems = buildPriorityItems(summary, priceValid, "section-price");

  return { platform, supported: true, categoryConfirmed, state, priorityItems, registered };
}

export async function computeSnapshotReadiness(
  snapshotId: string,
  product: CanonicalProduct,
  categoryMappings: Partial<Record<PlatformId, CategorySelection>> | undefined,
  detailBlocks: DetailPageBlock[] | undefined,
): Promise<SnapshotReadiness> {
  const blocks = detailBlocks && detailBlocks.length > 0 ? detailBlocks : defaultDetailBlocks();
  const priceValid = product.priceValidity === "VALID";
  const registeredPlatforms = await getRegisteredPlatforms(snapshotId);

  const platforms = await Promise.all(
    SUPPORTED_PLATFORMS.map(async (platform) => {
      const category = categoryMappings?.[platform] ?? UNRESOLVED_CATEGORY;
      const registered = registeredPlatforms.has(platform);
      if (platform === "smartstore") {
        return computeSmartstoreReadiness(product, category, blocks, registered);
      }
      return computeMarketplaceReadiness(product, category, platform, registered);
    }),
  );

  return { priceValid, platforms };
}
