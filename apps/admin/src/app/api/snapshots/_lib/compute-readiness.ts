import { PLATFORM_ADAPTERS, isVerifiedCategorySelected } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY, type CategorySelection } from "@commerce/category";
import { buildNaverProductPayload, validateNaverPayload } from "@commerce/listing";
import type { CanonicalProduct, PlatformId } from "@commerce/shared";
import {
  computePriceDecision,
  computeSellability,
  priceLevelFromVerdict,
  summarizeDomesticMarketSplit,
  type PriceLevel,
  type PriceObservationRecord,
  type SellabilityResult,
} from "@commerce/pricing";
import { listDomesticProductLinks, priceTierFromLink } from "../../domestic-price-sources/_lib/domestic-product-link";
import { resolveNaverContext } from "../../naver/_lib/resolve-context";
import { getRegisteredPlatforms } from "./registration-status";
import { getPriceHistory, selectCostBasisOriginObservations } from "../../price-history/_lib/price-observations";
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

/** N-4.11 STEP3(대표님 지시: "대시보드에서 마진율/판매가/최저가/확인시간으로
 * 정렬") — priceLevel 하나만으로는 정렬이 안 돼서 값 자체를 같이 내려준다.
 * 새 계산이 아니다 — computePriceDecision/summarizeDomesticMarket이 이미 낸
 * 숫자를 그대로 옮긴다. */
export interface SnapshotPriceSummary {
  level: PriceLevel;
  marginPercent: number | null;
  currentSellingPriceKrw: number | null;
  domesticLowestPriceKrw: number | null;
  lastCheckedAt: string | null;
  /** N-4.17 STEP1(대표님 지시: "가격데이터없음/매칭실패/매칭확인필요/오래됨/정상이
   * ⚪ 하나로 뭉쳐 있지 않은지") — computePriceDecision()의 reason 문장을 그대로
   * 옮긴다(새 판정 문구를 만들지 않는다). UNKNOWN일 때는 판매가 미설정과 원가
   * 데이터 없음을 구분한다 — 둘 다 지금까지 "⚪ 가격 판단 불가"로만 보였다. */
  reason: string;
  /** N-4.18-Q3(대표님 지시, 2026-08-26: "이 상품을 등록해도 되는가?") — "가격
   * 유지/조정" 판단(level/reason 위)과 별개로, 판매가가 아직 없는(등록 전)
   * 상품도 다룬다. computeSellability()가 이미 낸 값을 그대로 옮긴다(새 판정
   * 없음) — DomesticPriceIntelligencePanel의 "🧠 판매 판단" 카드와 같은 값. */
  sellability: SellabilityResult;
}

export interface SnapshotReadiness {
  priceValid: boolean;
  /** N-4.07 Sprint(대표님 지시: "대시보드에서도 가격경쟁력을 컬럼으로") —
   * DomesticPriceIntelligencePanel과 완전히 같은 계산(computePriceDecision)을
   * 재사용한다. 여기서는 실시간 환율 조회(fetchLiveExchangeRates)까지는 하지
   * 않는다 — price_observations는 이미 KRW로 저장돼 있어 원가 비교에 필요
   * 없고, 상품 최대 30개를 매번 외부 환율 API까지 불러 계산하면 대시보드가
   * 느려진다(이 파일 상단 주석과 같은 비용 판단). */
  priceLevel: PriceLevel;
  price: SnapshotPriceSummary;
  platforms: PlatformReadiness[];
}

const SUPPORTED_PLATFORMS: PlatformId[] = ["smartstore", "coupang", "elevenst"];

export const UNKNOWN_SELLABILITY: SellabilityResult = {
  level: "UNKNOWN",
  title: "원가 확인 필요",
  reason: "실제 구매 가능 가격을 아직 확인하지 못했습니다.",
  estimatedMarginPercent: null,
};

const EMPTY_PRICE_SUMMARY: SnapshotPriceSummary = {
  level: "UNKNOWN",
  marginPercent: null,
  currentSellingPriceKrw: null,
  domesticLowestPriceKrw: null,
  lastCheckedAt: null,
  reason: "판매가가 아직 설정되지 않았습니다.",
  sellability: UNKNOWN_SELLABILITY,
};

async function computePriceSummaryForSnapshot(
  snapshotId: string,
  product: CanonicalProduct,
): Promise<SnapshotPriceSummary> {
  const currentSellingPriceKrw = product.priceOverrideKrw?.value ?? null;
  const [originRecords, domesticShopHistory, naverShoppingHistory, domesticLinks] = await Promise.all([
    getPriceHistory(snapshotId, "SELLER_ORIGIN"),
    getPriceHistory(snapshotId, "DOMESTIC_SHOP"),
    getPriceHistory(snapshotId, "NAVER_SHOPPING"),
    // 🔴 P0-D.3(CEO 지시, 2026-09-20) — 네 번째 조회가 늘었다. 이미 세 개가
    //    병렬로 도는 자리라 한 개 추가의 비용은 무시할 만하고, 이것 없이는
    //    EXACT/COMPARISON 을 가를 방법이 없다(아래 참고).
    listDomesticProductLinks(snapshotId),
  ]);
  // GLOBAL-MARKET ③(CPO 지시, 2026-09-11) — market-intelligence.ts와 같은 이유.
  // 원가는 여전히 "최신 원가 근거 관측 1건"이다. 추가로 확인만 해 둔 다른 시장
  // (en-de €75 / en-int €84 …) 행이 여기 섞이면 readiness의 원가·마진·판정이
  // 조용히 달라진다 — 입력을 예전과 동일하게 유지한다(판정 로직 변경 없음).
  //
  // GLOBAL-ORIGIN-PRICE-WIRING-1(CEO 지시, 2026-09-13) — market-intelligence.ts와
  // 같은 이유로 같은 헬퍼를 쓴다. readiness의 원가가 화면 원가와 다른 행을
  // 읽으면 "판매 가능"과 "마진"이 서로 다른 근거 위에 서게 된다.
  const originHistory = selectCostBasisOriginObservations(originRecords);
  const costPriceKrw = originHistory[0]?.priceKrw ?? null;
  const domesticRecords = [...domesticShopHistory, ...naverShoppingHistory];
  /**
   * 🔴 P0-D.3 STEP 1(CEO 지시, 2026-09-20) — **대시보드도 EXACT 와 COMPARISON 을
   * 가른다.** market-intelligence.ts 와 «같은» 분류를 쓴다(새 매칭 로직 아님).
   *
   * 여기 있던 한 줄은 `summarizeDomesticMarket(domesticRecords)` 였다. 두 등급을
   * 통째로 합산했고, 그래서 두 곳이 사실과 다르게 말했다:
   *
   *   ① computeSellability 의 `matched` — 그 함수는 !matched 일 때 제목을
   *      「국내 동일상품 확인 필요」로 낸다. COMPARISON 만 있는 상품이 합산으로
   *      sellerCount>0 이 되어 **「동일상품을 찾았다」** 가 됐다.
   *   ② computePriceDecision — P0-D.2 에서 정책 A 를 넣었는데 이 호출부만
   *      basis 를 안 넘겨 예전 동작(비교상품 가격으로 인하 권고)이 남아 있었다.
   *
   * 상품 상세와 대시보드가 같은 국내가격 의미를 쓰지 않으면 같은 상품에 대해
   * 서로 다른 메시지가 나간다 — 그것이 이번에 닫는 구멍이다.
   *
   * 🔴 NAVER_SHOPPING 은 예전과 «똑같이» 비교 버킷이다(동일상품 검증이 없는 검색
   *    후보 — market-intelligence 의 같은 판단을 그대로 따른다).
   */
  const tierBySourceId = new Map(domesticLinks.map((l) => [l.sourceId, priceTierFromLink(l)]));
  const exactShopRecords: PriceObservationRecord[] = [];
  const comparisonShopRecords: PriceObservationRecord[] = [...naverShoppingHistory];
  for (const record of domesticShopHistory) {
    const tier = record.sourceRefId ? tierBySourceId.get(record.sourceRefId) : undefined;
    if (tier === "EXACT") exactShopRecords.push(record);
    else if (tier === "COMPARISON") comparisonShopRecords.push(record);
    // EXCLUDED·링크 없음(레거시)은 어느 버킷에도 넣지 않는다 — 추측으로 분류하지 않는다.
  }
  const domesticSplit = summarizeDomesticMarketSplit(exactShopRecords, comparisonShopRecords);
  /**
   * 🔴 표시용은 예전처럼 `resolved` 다. COMPARISON 가격을 화면에서 «지우지»
   *    않는다(CEO 명시: 참고정보로 계속 제공). 바뀌는 것은 아래 두 곳에서
   *    그 값을 «판정 근거로 쓰는가» 뿐이다.
   */
  const domesticSummary = domesticSplit.resolved;
  // N-4.18-Q3(대표님 지시: "등록 전 상품도 판매 가능성을 판단해야 한다") — 판매가
  // (priceOverrideKrw)가 아직 없는 상품(대부분의 미등록 상품)도 sellability는
  // 계산한다 — 아래 level(가격 유지/조정 판단)과 달리 sellability는 판매가
  // 설정 여부와 무관하게 원가+국내동일상품만으로 판단 가능하다.
  const sellability = computeSellability({
    costPriceKrw,
    // 🔴 P0-D.3 — 「국내 동일상품을 찾았다」는 EXACT 버킷에서만 참이다.
    //    비교상품만 있는 상품에 「찾았다」고 말하면 그 문장이 거짓이 된다.
    domestic: {
      matched: domesticSplit.exact.sellerCount > 0,
      averagePriceKrw: domesticSplit.exact.averagePriceKrw,
    },
  });

  if (currentSellingPriceKrw == null) return { ...EMPTY_PRICE_SUMMARY, sellability };
  if (costPriceKrw == null) {
    return {
      ...EMPTY_PRICE_SUMMARY,
      currentSellingPriceKrw,
      reason: "원가 데이터가 아직 확인되지 않았습니다(가격 확인을 실행해주세요).",
      sellability,
    };
  }
  const decision = computePriceDecision({
    costPriceKrw,
    currentSellingPriceKrw,
    domesticAveragePriceKrw: domesticSummary.averagePriceKrw,
    domesticLowestPriceKrw: domesticSummary.lowestPriceKrw,
    // 🔴 P0-D.3 — P0-D.2 정책 A 를 이 호출부에도 연결한다. 이 줄이 없어서
    //    대시보드만 비교상품 가격으로 「가격을 낮추라」고 말하고 있었다.
    domesticBasis: domesticSplit.basis,
  });
  const lastCheckedAt = [...originHistory, ...domesticRecords].reduce<string | null>(
    (latest, r) => (!latest || r.checkedAt > latest ? r.checkedAt : latest),
    null,
  );
  return {
    level: priceLevelFromVerdict(decision.verdict),
    marginPercent: decision.marginPercent,
    currentSellingPriceKrw,
    domesticLowestPriceKrw: domesticSummary.lowestPriceKrw,
    lastCheckedAt,
    reason: decision.reason,
    sellability,
  };
}

async function computeSmartstoreReadiness(
  product: CanonicalProduct,
  category: CategorySelection,
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
    // N-4.12 STEP1 실측(대표님 지시: "Preview=Validation=Register 동일 소스인지
    // 실제 E2E로 확인") — 실제 프로덕션 대시보드 호출에서 NOT_CONFIGURED(계정
    // 설정 자체가 안 됨)와 AUTH_FAILED(토큰 발급 중 타임아웃 등 일시적 실패)가
    // 똑같이 "네이버 계정 연결 확인"으로 뭉뚱그려져 나오는 걸 실측으로 확인했다
    // — 사용자가 계정을 재연결해야 하는 것처럼 보이지만 실제로는 잠시 후
    // 다시 시도하면 해결될 수도 있는 문제라 원인이 다르다(STEP9 "데이터오류
    // vs API오류" 구분과 동일한 문제). NOT_CONFIGURED만 진짜 설정 문제이고,
    // AUTH_FAILED는 재시도 가능한 일시적 실패로 구분한다.
    const notConfigured = context.status === "NOT_CONFIGURED";
    return {
      platform: "smartstore",
      supported: true,
      categoryConfirmed,
      state: "BLOCKED",
      priorityItems: [
        {
          key: "naver-account",
          label: notConfigured ? "네이버 계정 연결 확인" : "네이버 서버 응답 확인",
          detail: notConfigured
            ? context.message
            : "네이버 서버 응답이 없어 일시적으로 확인할 수 없습니다 — 상품 정보에는 문제가 없습니다. 잠시 후 다시 시도해주세요.",
          sourceItems: [],
          retryable: !notConfigured,
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
  const sellerDeliveryFee = context.delivery.deliveryFee;
  const returnDeliveryFee = context.delivery.returnDeliveryFee;
  const exchangeDeliveryFee = context.delivery.exchangeDeliveryFee;
  const originAreaCode = context.origin.match.code;
  const originAreaRequiresContent = context.origin.match.status === "OTHER_MANUAL";
  const deliveryCompany = context.courier.value;
  const warrantyPolicy = context.notice.warrantyPolicy;
  const afterServiceDirector = context.notice.afterServiceDirector;
  const afterServiceTelephoneNumber = context.notice.companyContactNumber;

  const listing = PLATFORM_ADAPTERS.smartstore.toListingModel(product, category, undefined, "smartstore");
  const payload = buildNaverProductPayload({
    product,
    /* P0-KC-12 — 빌더에도 선언을 넘긴다. validator 호출부만 고치고
       여기를 빼서, 실제 payload 에 certificationTargetExcludeContent 와
       kids.certificationType 이 «둘 다 없는» 채로 나갔다(실측 400). */
    smartStoreKcDeclaration: product.smartStoreKcDeclaration,
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
    detailBlocks: context.detailPage.detailBlocks,
    descriptionTemplate: context.detailPage.descriptionTemplate,
    commonImages: context.detailPage.commonImages,
    brandIntro: context.detailPage.brandIntro,
    /* REWORK-13A(CEO 지시, 2026-09-15) — **이 한 줄이 빠져 있었다.**
       register route(smartstore/register/route.ts:392)는 이미
       `context.notice.manufacturer`(③브랜드 관리 → ④판매자 기본값 폴백 결과)를
       넘기는데, 대시보드 준비도는 같은 context를 손에 들고도 이 인자만 빼고
       payload를 만들었다. 그래서 브랜드 관리에 제조사를 등록해 둔 상품도
       대시보드에서는 「제조자 없음」으로 집계됐다 — 서버는 등록해 주는데 목록은
       못 한다고 말하는, N-3.56이 없애려던 그 두 벌 계산이다. */
    resolvedManufacturer: context.notice.manufacturer,
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
      /* P0-KC-11 — 판매자 «선언» 을 검증에도 넘긴다. 이걸 빼면 validator 가
         인자를 받아도 항상 undefined 라, 화면에서 「대상 아님」을 골라도 준비
         상태는 계속 「인증정보 없음」이라고 말한다(실제로 그랬다). */
      smartStoreKcDeclaration: product.smartStoreKcDeclaration,
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
  const listing = PLATFORM_ADAPTERS[platform].toListingModel(product, category, undefined, platform);
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
): Promise<SnapshotReadiness> {
  const priceValid = product.priceValidity === "VALID";
  const [registeredPlatforms, price] = await Promise.all([
    getRegisteredPlatforms(snapshotId),
    computePriceSummaryForSnapshot(snapshotId, product),
  ]);

  const platforms = await Promise.all(
    SUPPORTED_PLATFORMS.map(async (platform) => {
      const category = categoryMappings?.[platform] ?? UNRESOLVED_CATEGORY;
      const registered = registeredPlatforms.has(platform);
      if (platform === "smartstore") {
        return computeSmartstoreReadiness(product, category, registered);
      }
      return computeMarketplaceReadiness(product, category, platform, registered);
    }),
  );

  return { priceValid, priceLevel: price.level, price, platforms };
}
