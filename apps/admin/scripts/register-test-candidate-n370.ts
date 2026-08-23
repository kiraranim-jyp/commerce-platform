/**
 * Sprint N-3.70 STEP4/6 — CPO 지시: "가짜 KC 후보 중 하나를 [TEST] 라벨로
 * SUSPENSION 등록". 최근 스냅샷 30개를 자동 스캔한 결과 SmartStore READY
 * 후보 3개가 전부 childCertification에 명백한 테스트용 가짜 값
 * (companyName:"검사소"/"00테스트 발급", certificationNumber:"TEST010101" 등,
 * USER_EDITED)이 들어 있어 "실제 판매용" 등록으로는 쓸 수 없었다 — CPO가
 * 이 스크립트의 접근(TEST 라벨 + 비공개)을 승인했다.
 *
 * channelProductDisplayStatusType은 이미 build-payload.ts에서 항상
 * "SUSPENSION"으로 고정돼 있다(N-3.5부터, "WAIT가 아니라 유효한 값을 쓴다"는
 * 이유로 도입됐고 그 이후 한 번도 값을 바꾼 적 없음) — 이 파이프라인을 거치는
 * 모든 등록은 처음부터 판매자 화면에서만 보이고 실제 구매자에게는 노출되지
 * 않는다. 이 스크립트는 거기에 title만 "[TEST] " 접두어로 추가로 표시해서,
 * Wing에서 이 상품을 봤을 때 실제 판매 목적이 아니라 파이프라인 검증용임을
 * 명확히 하고 삭제 대상임을 알 수 있게 한다.
 *
 * 실제 프로덕션 코드 경로를 그대로 재사용한다(로컬 재구현 없음, N-3.69
 * feedback_direct_production_api_over_dom_clicking 패턴):
 *  - @commerce/shared의 backfillCanonicalProduct (대시보드 readiness 계산과 동일)
 *  - @commerce/marketplace의 smartstoreAdapter.toListingModel (CommerceWorkspace가
 *    실제로 등록 버튼을 누를 때 쓰는 것과 동일한 함수)
 *  - POST https://ttaejyo.vercel.app/api/smartstore/register (실제 프로덕션
 *    라우트, register/route.ts 전체 파이프라인 — resolveNaverContext →
 *    buildNaverProductPayload → validateNaverPayload → 이미지 업로드 →
 *    실제 Naver POST /v2/products)
 *
 * STEP5(Payload vs Actual Request 비교) — 이 스크립트는 별도로 payload를
 * 재구성하지 않는다. register/route.ts 자체가 이미 Preview와 물리적으로
 * 같은 buildNaverProductPayload를 쓰므로(Sprint B-7 원칙, N-3.69에서 재확인),
 * 이 스크립트가 보내는 product+listing이 곧 "실제 요청이 쓸 원본 데이터"다.
 */
import { backfillCanonicalProduct } from "@commerce/shared";
import { smartstoreAdapter } from "@commerce/marketplace";

const SNAPSHOT_ID = "8fa8b176-c129-437a-b420-2b9737949fe2";
const BASE_URL = "https://ttaejyo.vercel.app";

async function main() {
  console.log(`[1/5] 스냅샷 조회: ${SNAPSHOT_ID}`);
  const snapRes = await fetch(`${BASE_URL}/api/snapshots/${SNAPSHOT_ID}`);
  if (!snapRes.ok) throw new Error(`snapshot fetch failed: ${snapRes.status}`);
  const snapData = (await snapRes.json()) as { snapshot: { workspace: any; sourceUrl: string; jobKey?: string } };
  const ws = snapData.snapshot.workspace;

  const product = backfillCanonicalProduct(ws.canonicalProduct);
  const originalTitle = product.title.value;
  // [TEST] 접두어 — 실제 판매 목적이 아님을 Wing에서 바로 알 수 있게 한다.
  product.title = { ...product.title, value: `[TEST] ${originalTitle}` };

  const categorySelection = ws.categoryMappings?.smartstore;
  if (!categorySelection) throw new Error("categoryMappings.smartstore가 스냅샷에 없습니다.");

  const listing = smartstoreAdapter.toListingModel(product, categorySelection);
  console.log(`[2/5] ListingModel 생성 완료 — title="${listing.title}", category=${listing.category.candidate?.id}`);
  console.log(
    `      validations: ${listing.validations.map((v) => `${v.field}=${v.status}`).join(", ")}`,
  );

  // N-3.52 STEP14 게이트 — register/route.ts는 "판매 전 최종 확인" 기록이
  // snapshotId+categoryCode+policyVersion 일치로 없으면 실제 Naver 호출
  // 전에 항상 막는다(실제 UI에서 판매자가 확인 버튼을 누르는 것과 동일한
  // 서버측 기록). 이 스크립트는 그 버튼을 대신 누르는 게 아니라, 그 화면이
  // 실제로 하는 것과 같은 API를 그대로 호출한다.
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
