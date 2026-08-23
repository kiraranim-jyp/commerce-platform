/**
 * Sprint N-3.71 STEP8(사용자 지시, 2026-08-21) — precheck-n371-candidate.ts로
 * 사전 검증(READY=40 MISSING=0 BLOCKED=0)까지 마친 후보에 대해 정확히 1회
 * 실제 프로덕션 등록을 시도한다. 후보 선정/필드 완성 근거는
 * precheck-n371-candidate.ts 상단 주석을 그대로 따른다:
 *  - 원문에 실제 "Product code B226AC009 AW26" 표기가 있어 naverShoppingSearchInfo.
 *    modelName을 임의로 만들지 않고 실제 추출한다(resolveModelNameFromDescription).
 *  - material/careInstructions/importer는 실제 원문값이 없어 이미 구현된 공식
 *    "상세페이지 참조"(DETAIL_PAGE_REFERENCE) 경로로 전환한다(값을 지어내지
 *    않는다, source만 전환).
 *  - certificationType/childCertification은 실제 KC 서류가 없어 이번 세션
 *    확립된 [TEST] 라벨 placeholder 패턴을 재사용한다(golden-success-02-kids.json,
 *    N-3.70/71에서 반복 사용, CPO/사용자 승인 선례).
 */
import { backfillCanonicalProduct } from "@commerce/shared";
import { smartstoreAdapter } from "@commerce/marketplace";

const SNAPSHOT_ID = "ca0e1f9d-89cb-4708-a387-a6a8de8b0e73";
const BASE_URL = "https://ttaejyo.vercel.app";

async function main() {
  console.log(`[1/5] 스냅샷 조회: ${SNAPSHOT_ID}`);
  const snapRes = await fetch(`${BASE_URL}/api/snapshots/${SNAPSHOT_ID}`);
  if (!snapRes.ok) throw new Error(`snapshot fetch failed: ${snapRes.status}`);
  const snapData = (await snapRes.json()) as { snapshot: { workspace: any; sourceUrl: string; jobKey?: string } };
  const ws = snapData.snapshot.workspace;

  const product = backfillCanonicalProduct(ws.canonicalProduct);
  product.title = { ...product.title, value: `[TEST] ${product.title.value}` };

  if (!product.material.value) {
    product.material = { ...product.material, source: "DETAIL_PAGE_REFERENCE" };
  }
  if (!product.careInstructions.value) {
    product.careInstructions = { ...product.careInstructions, source: "DETAIL_PAGE_REFERENCE" };
  }
  if (!product.importer.value) {
    product.importer = { ...product.importer, source: "DETAIL_PAGE_REFERENCE" };
  }
  if (!product.certificationType.value) {
    product.certificationType = {
      ...product.certificationType,
      value: "[TEST] 안전확인대상 어린이제품 — 실제 인증정보 아님",
    };
  }
  if (!product.childCertification.value) {
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

  const listing = smartstoreAdapter.toListingModel(product, categorySelection);
  console.log(`[2/5] ListingModel 생성 완료 — title="${listing.title}", category=${listing.category.candidate?.id}`);
  console.log(`      validations: ${listing.validations.map((v) => `${v.field}=${v.status}`).join(", ")}`);

  console.log("[3/5] POST /api/smartstore/seller-compliance (판매 전 최종 확인 기록)");
  const complianceRes = await fetch(`${BASE_URL}/api/smartstore/seller-compliance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      snapshotId: SNAPSHOT_ID,
      jobKey: snapData.snapshot.jobKey,
      categoryCode: listing.category.candidate?.id,
      kcStatus: "CERTIFIED_REFERENCE",
      confirmed: true,
    }),
  });
  console.log(`      status=${complianceRes.status}`, JSON.stringify(await complianceRes.json()));

  console.log("[4/5] POST /api/smartstore/register 실행 (실제 Production 호출, 정확히 1회)");
  const registerRes = await fetch(`${BASE_URL}/api/smartstore/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      product,
      listing,
      snapshotId: SNAPSHOT_ID,
      jobKey: snapData.snapshot.jobKey,
      detailBlocks: ws.detailBlocks,
    }),
  });
  const result = await registerRes.json();

  console.log("[5/5] 결과:");
  console.log(JSON.stringify(result, null, 2));

  if (result.status === "SUBMITTED") {
    console.log("\n✅ 등록 성공");
    console.log("originProductNo(externalProductId):", result.externalProductId);
  } else {
    console.log(`\n❌ 등록 실패/미확정 — status=${result.status}`);
    if (result.error) console.log("error:", JSON.stringify(result.error, null, 2));
  }
}

main().catch((err) => {
  console.error("스크립트 실행 오류:", err);
  process.exit(1);
});
