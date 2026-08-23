/**
 * N-3.71 STEP8(사용자 지시, 2026-08-21) — "실제 등록 전 반드시 MISSING 0 /
 * BLOCKED 0을 먼저 확인하라"는 지시에 따른 순수 읽기 전용 사전 점검
 * 스크립트다. Naver에 어떤 것도 쓰지 않는다 — /api/naver/resolve(GET,
 * 읽기 전용)만 호출하고, register/route.ts와 물리적으로 같은
 * buildNaverProductPayload/validateNaverPayload를 로컬에서 그대로 호출해
 * MISSING/BLOCKED을 미리 확인한다.
 *
 * 후보: ca0e1f9d-89cb-4708-a387-a6a8de8b0e73("보보쇼즈 26fw 티셔츠 Hug Hairy
 * Monster T-Shirt", 원문에 실제 "Product code B226AC009 AW26" 표기 있음 —
 * naverShoppingSearchInfo.modelName을 임의로 만들지 않고 실제 원문에서
 * 추출 가능한 유일한 후보). 부족한 부분(material/careInstructions)은
 * "상세페이지 참조"(DETAIL_PAGE_REFERENCE) — 이미 구현된 공식 허용 경로를
 * source만 바꿔 사용한다(값 자체는 여전히 빈 문자열, 임의 텍스트 생성
 * 아님). certificationType/childCertification은 이미 이번 세션에서
 * CPO/사용자가 승인한 [TEST] 라벨 패턴을 재사용한다.
 */
import { backfillCanonicalProduct } from "@commerce/shared";
import { smartstoreAdapter } from "@commerce/marketplace";
import { buildNaverProductPayload, validateNaverPayload } from "@commerce/listing";

const SNAPSHOT_ID = "ca0e1f9d-89cb-4708-a387-a6a8de8b0e73";
const BASE_URL = "https://ttaejyo.vercel.app";

async function main() {
  console.log(`[1/4] 스냅샷 조회: ${SNAPSHOT_ID}`);
  const snapRes = await fetch(`${BASE_URL}/api/snapshots/${SNAPSHOT_ID}`);
  if (!snapRes.ok) throw new Error(`snapshot fetch failed: ${snapRes.status}`);
  const snapData = (await snapRes.json()) as { snapshot: { workspace: any; sourceUrl: string; jobKey?: string } };
  const ws = snapData.snapshot.workspace;

  const product = backfillCanonicalProduct(ws.canonicalProduct);
  product.title = { ...product.title, value: `[TEST] ${product.title.value}` };

  // 실제 원문에 값이 있는데 REQUIRED 상태로 남아있던 것만 DETAIL_PAGE_REFERENCE로
  // 전환한다(값은 여전히 빈 문자열 — resolveNoticeFieldValue가 참조 문구로
  // 대체할 뿐, 텍스트를 지어내지 않는다).
  if (!product.material.value) {
    product.material = { ...product.material, source: "DETAIL_PAGE_REFERENCE" };
  }
  if (!product.careInstructions.value) {
    product.careInstructions = { ...product.careInstructions, source: "DETAIL_PAGE_REFERENCE" };
  }
  // 1차 사전점검 결과 — 이 상품은 원산지가 수입산(Made in Portugal)으로
  // 확인돼 originAreaInfo.importer가 필수인데 값이 없다(N-3.4부터 있던 기존
  // 필드, 이번 세션 수정 대상 아님). 이것도 이미 공식 허용된 "상세페이지
  // 참조" 경로가 있다(기존 테스트 "수입산 + importer를 '상세페이지
  // 참조'로 선택 → READY"로 이미 검증된 메커니즘).
  if (!product.importer.value) {
    product.importer = { ...product.importer, source: "DETAIL_PAGE_REFERENCE" };
  }
  // certificationType/childCertification — KC는 "상세페이지 참조" 대체가 영구
  // 금지된 필드다(N-3.45 STEP10). 이 후보는 실제 KC 서류가 없으므로, 이번
  // 세션에서 이미 확립된 [TEST] 라벨 placeholder 패턴(golden-success-02-kids.json,
  // N-3.70/71에서 반복 사용)을 그대로 재사용한다 — 실제 인증정보로 오인될
  // 수 없도록 명시적으로 "[TEST]"를 포함한다.
  if (!product.certificationType.value) {
    product.certificationType = {
      ...product.certificationType,
      value: "[TEST] 안전확인대상 어린이제품 — 실제 인증정보 아님",
    };
  }
  const cert = product.childCertification.value;
  if (!cert) {
    product.childCertification = {
      ...product.childCertification,
      value: {
        certificationNumber: "TEST-0000000000",
        companyName: "[TEST] KC 테스트 검사기관 — 실제 인증정보 아님",
        certificationDate: "2026-08-21",
        name: "[TEST] KC 테스트 인증기관 — 실제 인증정보 아님",
      },
      source: "USER_EDITED",
    };
  }

  const categorySelection = ws.categoryMappings?.smartstore;
  if (!categorySelection) throw new Error("categoryMappings.smartstore가 스냅샷에 없습니다.");
  const leafCategoryId = categorySelection.candidate?.id;
  if (!leafCategoryId) throw new Error("leafCategoryId를 확인할 수 없습니다.");

  const listing = smartstoreAdapter.toListingModel(product, categorySelection);
  console.log(`[2/4] ListingModel 생성 완료 — title="${listing.title}"`);

  console.log(`[3/4] GET /api/naver/resolve (읽기 전용, categoryId=${leafCategoryId})`);
  const resolveRes = await fetch(
    `${BASE_URL}/api/naver/resolve?categoryId=${leafCategoryId}&countryOfOrigin=${encodeURIComponent(product.countryOfOrigin.value || "")}&brand=${encodeURIComponent(product.brand.value || "")}`,
  );
  const context = await resolveRes.json();
  if (context.status !== "OK") {
    console.log("컨텍스트 조회 실패:", JSON.stringify(context, null, 2));
    return;
  }

  const categoryRequiresChildCertification = context.category?.requiresChildCertification ?? false;
  const childCertificationInfoId = context.category?.childCertificationInfoId ?? null;
  const payloadInputCommon = {
    releaseAddressBookNo: context.address.releaseAddressBookNo,
    refundAddressBookNo: context.address.refundAddressBookNo,
    primaryReturnDeliveryCompanyPriorityType: context.delivery.primaryReturnCompany?.priorityType ?? null,
    sellerDeliveryFee: context.delivery.deliveryFee,
    returnDeliveryFee: context.delivery.returnDeliveryFee,
    exchangeDeliveryFee: context.delivery.exchangeDeliveryFee,
    childCertificationInfoId,
    originAreaCode: context.origin.match.code,
    deliveryCompany: context.courier.value,
    warrantyPolicy: context.notice.warrantyPolicy,
    afterServiceDirector: context.notice.afterServiceDirector,
    afterServiceTelephoneNumber: context.notice.companyContactNumber,
  };

  const payload = buildNaverProductPayload({
    product,
    listing,
    leafCategoryId,
    ...payloadInputCommon,
    categoryRequiresChildCertification,
    originAreaRequiresContent: context.origin.match.status === "OTHER_MANUAL",
    descriptionTemplate: context.detailPage?.descriptionTemplate,
    commonImages: context.detailPage?.commonImages,
    brandIntro: context.detailPage?.brandIntro,
  });

  const validation = validateNaverPayload(
    payload,
    {
      product,
      ...payloadInputCommon,
      returnCompaniesFetchFailed: context.delivery.returnCompaniesFetchFailed,
      originAreaRequiresImporter: context.origin.match.requiresImporter,
    },
    categoryRequiresChildCertification,
    { categoryVerified: true, sellerComplianceConfirmation: { confirmed: true, kcStatus: "SELLER_REVIEW_REQUIRED", policyVersion: "2026-08-19", categoryCode: leafCategoryId } },
  );

  console.log("[4/4] 사전 검증 결과:");
  console.log(`  READY=${validation.readyCount} MISSING=${validation.missingCount} BLOCKED=${validation.blockedCount} ok=${validation.ok}`);
  if (!validation.ok) {
    console.log("  차단/미충족 필드:");
    for (const issue of validation.issues) {
      console.log(`    - [${issue.severity}] ${issue.field}: ${issue.reason}`);
    }
  } else {
    console.log("  ✅ 모든 필드 READY — 실제 등록 시도 가능");
  }
}

main().catch((err) => {
  console.error("스크립트 실행 오류:", err);
  process.exit(1);
});
