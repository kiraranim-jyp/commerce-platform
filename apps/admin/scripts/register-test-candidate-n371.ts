/**
 * Sprint N-3.71 STEP8 — validate-payload.ts의 optional:true 버그(9개 KIDS
 * 고시필드가 REQUIRED+빈값인데도 등록을 막지 않던 문제)를 수정 후, 실제
 * 프로덕션에 정확히 1회 재등록을 시도한다.
 *
 * N-3.70에서 썼던 후보(snapshot 8fa8b176)는 이 수정으로 이제 정확히 이유대로
 * BLOCKED가 됐다 — material/color/manufacturer/careInstructions/
 * recommendedAge/itemName/modelName/weight가 전부 REQUIRED 소스에 실제값도
 * 없었기 때문이다(수정 전엔 이걸 무시하고 등록 가능하다고 잘못 보여줬었다 —
 * 그게 바로 이번에 고친 버그다). 그 후보로 다시 시도하는 건 "동일 payload
 * 반복 호출 금지" 원칙에도 맞지 않고, 애초에 데이터가 없어 임의로 채울 수도
 * 없다.
 *
 * /api/dashboard/readiness를 재스캔해 새로 찾은 후보
 * (871a5081-4fff-4841-a226-32999bba07df, "Max Hearts Recycled Fiber UV
 * Protection Swimsuit")는 8개 필드 중 6개가 실제 DETAIL_PAGE_REFERENCE 선택
 * (사용자가 명시적으로 "상세페이지 참조"를 골랐다는 뜻 — 이번 수정이 정확히
 * READY로 인정해야 하는 케이스), color/careInstructions는 실제 크롤링 값
 * ("Pink"/"Machine wash, Do not dry clean, tumble dry")이 있다. childCertification만
 * 여전히 명백한 테스트 값("00테스트 발급"/"12312312313123")이라 N-3.70과 같은
 * 이유로 실제 판매용으로 쓸 수 없다 — CPO가 승인한 것과 동일한 패턴대로
 * title에 "[TEST] " 접두어를 붙이고 SUSPENSION(비공개) 상태로 등록한다.
 *
 * 실제 프로덕션 코드 경로를 그대로 재사용한다(N-3.70과 동일 패턴,
 * feedback_direct_production_api_over_dom_clicking):
 *  - @commerce/shared의 backfillCanonicalProduct
 *  - @commerce/marketplace의 smartstoreAdapter.toListingModel
 *  - POST https://ttaejyo.vercel.app/api/smartstore/register (실제 배포된
 *    register/route.ts — 이번에 고친 validate-payload.ts를 그대로 통과한다)
 */
import { backfillCanonicalProduct } from "@commerce/shared";
import { smartstoreAdapter } from "@commerce/marketplace";

const SNAPSHOT_ID = "871a5081-4fff-4841-a226-32999bba07df";
const BASE_URL = "https://ttaejyo.vercel.app";

async function main() {
  console.log(`[1/5] 스냅샷 조회: ${SNAPSHOT_ID}`);
  const snapRes = await fetch(`${BASE_URL}/api/snapshots/${SNAPSHOT_ID}`);
  if (!snapRes.ok) throw new Error(`snapshot fetch failed: ${snapRes.status}`);
  const snapData = (await snapRes.json()) as { snapshot: { workspace: any; sourceUrl: string; jobKey?: string } };
  const ws = snapData.snapshot.workspace;

  const product = backfillCanonicalProduct(ws.canonicalProduct);
  const originalTitle = product.title.value;
  product.title = { ...product.title, value: `[TEST] ${originalTitle}` };

  // N-3.71 STEP8 — 이 스냅샷의 childCertification은 이미 명백한 테스트 값
  // ("00테스트 발급"/"12312312313123", N-3.70에서 CPO가 승인한 것과 같은
  // 패턴)이라 실제 KC 인증정보가 아니다. 이번 수정으로 새로 추가된
  // productCertificationInfos[].name 검사(N-3.67 스펙 근거, certificationInfoId
  // 1041/1040은 필수) 때문에 등록 전 게이트에서 막힌다 — 실제 값을 지어내는
  // 게 아니라, golden-success-02-kids.json이 이미 썼던 것과 정확히 같은
  // "[TEST] 라벨 placeholder" 패턴으로 이 필드 하나만 채운다(CEO 승인 선례,
  // 2026-08-20). 실제 KC 서류가 있는 상품이라면 이 스크립트를 쓸 필요 없이
  // Editor 화면에서 실제 값을 입력하면 된다.
  const cert = product.childCertification.value;
  if (cert && !cert.name) {
    product.childCertification = {
      ...product.childCertification,
      value: { ...cert, name: "[TEST] KC 테스트 인증기관 — 실제 인증정보 아님" },
    };
  }

  const categorySelection = ws.categoryMappings?.smartstore;
  if (!categorySelection) throw new Error("categoryMappings.smartstore가 스냅샷에 없습니다.");

  const listing = smartstoreAdapter.toListingModel(product, categorySelection);
  console.log(`[2/5] ListingModel 생성 완료 — title="${listing.title}", category=${listing.category.candidate?.id}`);
  console.log(
    `      validations: ${listing.validations.map((v) => `${v.field}=${v.status}`).join(", ")}`,
  );

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
