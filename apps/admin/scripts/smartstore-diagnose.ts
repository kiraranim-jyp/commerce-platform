/**
 * N-3.73 STEP10(사용자 지시) — "대표님이 매번 브라우저에서 직접 확인하지
 * 않도록" 읽기 전용 진단 스크립트. Naver에 아무것도 쓰지 않는다 —
 * GET /api/naver/resolve(읽기 전용)만 호출하고, register/route.ts와 물리적으로
 * 같은 buildNaverProductPayload/validateNaverPayload를 로컬에서 그대로 호출해
 * READY/MISSING/BLOCKED를 미리 보여준다. 새 판정 로직을 만들지 않는다(STEP7과
 * 같은 원칙) — 이 스크립트가 보여주는 숫자는 validateNaverPayload()가 이미
 * 계산한 값 그대로다. [1]~[10] 체크리스트는 그 결과를 field 접두어로 묶어
 * "어디가 문제인지" 보기 쉽게 나눈 것일 뿐, 별도로 pass/fail을 판단하지 않는다.
 *
 * 사용법: npx tsx scripts/smartstore-diagnose.ts [snapshotId] [baseUrl]
 *   기본값: N-3.71 골든 후보 스냅샷 / https://ttaejyo.vercel.app
 */
import { backfillCanonicalProduct } from "@commerce/shared";
import { smartstoreAdapter } from "@commerce/marketplace";
import { resolveProductSignals } from "@commerce/category";
import {
  buildNaverProductPayload,
  validateNaverPayload,
  resolveNaverProductAttributes,
  getNaverCategoryAttributeMeta,
} from "@commerce/listing";

const DEFAULT_SNAPSHOT_ID = "ca0e1f9d-89cb-4708-a387-a6a8de8b0e73";
const DEFAULT_BASE_URL = "https://ttaejyo.vercel.app";

const SNAPSHOT_ID = process.argv[2] || DEFAULT_SNAPSHOT_ID;
const BASE_URL = process.argv[3] || DEFAULT_BASE_URL;

interface CheckResult {
  label: string;
  status: "PASS" | "FAIL" | "SKIP";
  detail?: string;
}

function printChecklist(results: CheckResult[]) {
  console.log("\nTTAEJYO SmartStore Diagnostic\n");
  results.forEach((r, i) => {
    const icon = r.status === "PASS" ? "PASS" : r.status === "FAIL" ? "FAIL" : "SKIP";
    const line = `[${i + 1}] ${r.label.padEnd(16, " ")} ${icon}`;
    console.log(r.detail && r.status !== "PASS" ? `${line}\n    ${r.detail}` : line);
  });
}

async function main() {
  const results: CheckResult[] = [];

  // [1] Naver Auth — categoryId 없이 호출해도 토큰 발급 단계는 항상 거친다.
  // AUTH_FAILED면 이후 모든 항목이 무의미하므로 여기서 즉시 중단한다.
  const authRes = await fetch(`${BASE_URL}/api/naver/resolve`);
  const authData = (await authRes.json()) as { status: string; message?: string; debug?: { step: string } };
  if (authData.status === "AUTH_FAILED") {
    results.push({
      label: "Naver Auth",
      status: "FAIL",
      detail: `NETWORK_ERROR/AUTH_FAILED — ${authData.message ?? "원인 불명"} (Fixie 프록시 등 외부 인프라 문제일 수 있음, 코드 문제 아님)`,
    });
    printChecklist(results);
    console.log("\nREGISTRATION TEST SKIPPED — Naver 연결 자체가 실패했습니다.\n");
    return;
  }
  if (authData.status === "NOT_CONFIGURED") {
    results.push({ label: "Naver Auth", status: "FAIL", detail: "네이버 인증 정보가 Settings에 설정되어 있지 않습니다." });
    printChecklist(results);
    console.log("\nREGISTRATION TEST SKIPPED — Settings에서 네이버 계정을 먼저 연결해주세요.\n");
    return;
  }
  results.push({ label: "Naver Auth", status: "PASS" });

  console.log(`스냅샷 조회: ${SNAPSHOT_ID}`);
  const snapRes = await fetch(`${BASE_URL}/api/snapshots/${SNAPSHOT_ID}`);
  if (!snapRes.ok) throw new Error(`snapshot fetch failed: ${snapRes.status}`);
  const snapData = (await snapRes.json()) as { snapshot: { workspace: any; sourceUrl: string; jobKey?: string } };
  const ws = snapData.snapshot.workspace;
  const product = backfillCanonicalProduct(ws.canonicalProduct);

  const categorySelection = ws.categoryMappings?.smartstore;
  const leafCategoryId = categorySelection?.candidate?.id ?? null;
  results.push({
    label: "Category",
    status: leafCategoryId ? "PASS" : "FAIL",
    detail: leafCategoryId ? undefined : "SmartStore 카테고리가 이 스냅샷에서 확정되지 않았습니다.",
  });
  if (!leafCategoryId) {
    printChecklist(results);
    console.log("\nREGISTRATION TEST SKIPPED — 카테고리 확정 후 다시 실행하세요.\n");
    return;
  }

  const listing = smartstoreAdapter.toListingModel(product, categorySelection);

  const resolveRes = await fetch(
    `${BASE_URL}/api/naver/resolve?categoryId=${leafCategoryId}&countryOfOrigin=${encodeURIComponent(product.countryOfOrigin.value || "")}&brand=${encodeURIComponent(product.brand.value || "")}`,
  );
  const context = await resolveRes.json();
  results.push({
    label: "Naver Resolve",
    status: context.status === "OK" ? "PASS" : "FAIL",
    detail: context.status === "OK" ? undefined : `status=${context.status}`,
  });
  if (context.status !== "OK") {
    printChecklist(results);
    console.log("\nREGISTRATION TEST SKIPPED\n");
    return;
  }

  results.push({
    label: "Seller Profile",
    status: context.delivery.deliveryFee != null && context.notice.warrantyPolicy ? "PASS" : "FAIL",
    detail: "Settings의 배송/판매자 정보가 비어있으면 등록이 막힙니다 — Settings에서 확인하세요.",
  });

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
    resolvedManufacturer: context.notice.manufacturer,
    resolvedAttributes: (() => {
      const meta = getNaverCategoryAttributeMeta(leafCategoryId);
      return meta ? resolveNaverProductAttributes(product, resolveProductSignals(product), meta).attributes : undefined;
    })(),
  });

  // N-3.73 STEP10 — validateNaverPayload()가 이 스냅샷의 실제 seller 확정
  // 상태를 모르므로(스크립트는 DB의 seller_compliance_confirmations를 읽지
  // 않는다), KC가 SELLER_REVIEW_REQUIRED인 카테고리에서는 "확정됨"으로
  // 가정하고 계산한다 — 실제 배포 화면에서는 사용자가 실제로 확정해야
  // 이 상태가 된다. 이 스크립트의 목적은 "코드/데이터 레벨에서 막히는 게
  // 있는지"이지 "판매자가 확정 버튼을 눌렀는지"가 아니다.
  const validation = validateNaverPayload(
    payload,
    {
      product,
      ...payloadInputCommon,
      returnCompaniesFetchFailed: context.delivery.returnCompaniesFetchFailed,
      originAreaRequiresImporter: context.origin.match.requiresImporter,
    },
    categoryRequiresChildCertification,
    {
      categoryVerified: true,
      sellerComplianceConfirmation: {
        confirmed: true,
        kcStatus: "SELLER_REVIEW_REQUIRED",
        policyVersion: "2026-08-19",
        categoryCode: leafCategoryId,
      },
    },
  );

  const issueField = (prefix: string) => validation.issues.filter((i) => i.field.startsWith(prefix));
  const kcIssues = [...issueField("productCertificationInfos"), ...issueField("detailAttribute.originAreaInfo.importer")];
  const noticeIssues = issueField("productInfoProvidedNotice");
  const priceIssues = validation.issues.filter((i) => i.field.includes("salePrice") || i.field.includes("optionCombinations[].price"));
  const optionIssues = validation.issues.filter((i) => i.field.startsWith("detailAttribute.optionInfo") && !i.field.includes("price"));
  const deliveryIssues = [
    ...issueField("detailAttribute.afterServiceInfo"),
    ...issueField("deliveryInfo"),
    ...issueField("returnInfo"),
    ...issueField("exchangeInfo"),
  ];

  results.push({
    label: "KC",
    status: kcIssues.length === 0 ? "PASS" : "FAIL",
    detail: kcIssues.map((i) => `${i.field}: ${i.reason}`).join(" / "),
  });
  results.push({
    label: "Notice Fields",
    status: noticeIssues.length === 0 ? "PASS" : "FAIL",
    detail: noticeIssues.map((i) => `${i.field}: ${i.reason}`).join(" / "),
  });
  results.push({
    label: "Price",
    status: priceIssues.length === 0 ? "PASS" : "FAIL",
    detail: priceIssues.map((i) => `${i.field}: ${i.reason}`).join(" / "),
  });
  results.push({
    label: "Options",
    status: optionIssues.length === 0 ? "PASS" : "FAIL",
    detail: optionIssues.map((i) => `${i.field}: ${i.reason}`).join(" / "),
  });
  results.push({
    label: "Delivery",
    status: deliveryIssues.length === 0 ? "PASS" : "FAIL",
    detail: deliveryIssues.map((i) => `${i.field}: ${i.reason}`).join(" / "),
  });
  results.push({
    label: "Payload",
    status: validation.ok ? "PASS" : "FAIL",
    detail: validation.ok ? undefined : `READY=${validation.readyCount} MISSING=${validation.missingCount} BLOCKED=${validation.blockedCount}`,
  });

  printChecklist(results);
  console.log(`\nMISSING  ${validation.missingCount}`);
  console.log(`BLOCKED  ${validation.blockedCount}\n`);
  if (validation.ok) {
    console.log("READY FOR REGISTRATION\n");
  } else {
    console.log("NOT READY — 위 FAIL 항목을 먼저 해결하세요.\n");
    console.log("전체 issue 목록:");
    for (const issue of validation.issues) {
      console.log(`  - [${issue.severity}] ${issue.field}: ${issue.reason}`);
    }
  }
}

main().catch((err) => {
  console.error("스크립트 실행 오류:", err);
  process.exit(1);
});
