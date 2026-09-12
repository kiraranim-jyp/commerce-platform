import { backfillCanonicalProduct, buildProductIdentityDna, type CanonicalProduct } from "@commerce/shared";
import { resolveCategoryScopesFromProduct } from "../../domestic-price-sources/_lib/category-scope";
import { runDomesticPriceCheck, type DomesticPriceCheckResult } from "./run-domestic-price-check";

/**
 * DOMESTIC-PRICE-TRIGGER-1(CEO 지시, 2026-09-12) — "분석 직후 1회 저장".
 *
 * ── 왜 이 파일이 생겼나 ──────────────────────────────────────────────────
 * 2026-09-11에 일 1회 가격 재확인 배치를 없앴다(51758aa). 등록 여부와 무관하게
 * 모든 스냅샷을 매일 다시 훑는 건 실효 대비 비효율이라는 판단은 지금도 맞다.
 * 다만 그 배치는 "매일 다시 훑는 일"만 하던 게 아니라 **국내 가격 조사를
 * 실제로 돌리고 그 결과를 DB에 남기던 유일한 서버측 경로**이기도 했다. 배치를
 * 걷어낸 뒤 남은 트리거는 브라우저가 쏘는 fetch 하나뿐이었고, 그건 탭을 닫거나
 * 함수 실행시간 상한에 걸리면 그대로 사라진다.
 *
 * Production 실측(CEO 확인, snapshot 0767b19b-…): domestic_product_links 0행,
 * price_observations에 DOMESTIC_SHOP 0행. 검색 자체가 호출된 적이 없다
 * (SEARCH_NOT_CALLED). 화면은 그 상태를 "국내 비교상품 없음"이라고 말했는데,
 * 사실은 "아무 데도 안 뒤졌다"였다.
 *
 * ── 왜 배치가 아니라 상품 하나짜리인가 ───────────────────────────────────
 * 없앤 배치를 되살리지 않는다. 국내 가격이 필요한 순간은 "매일 밤 전부"가 아니라
 * **셀러가 방금 이 상품을 분석한 그 순간 한 번**이다. 그래서 이 함수는 스냅샷
 * 하나만 받고, 기존 스냅샷을 훑지 않으며, workspace 경계를 넘지 않는다
 * (listAllSnapshotsForBatch가 사라지면서 닫힌 그 예외를 다시 열지 않는다 —
 * snapshot.ts의 제거 주석 참고).
 *
 * ── 쓰기 경로를 새로 만들지 않는다 ───────────────────────────────────────
 * 저장은 전부 runDomesticPriceCheck()가 한다(domestic_product_links 업서트 +
 * price_observations 기록). 여기서 하는 일은 그 함수가 요구하는 입력을
 * "가격 다시 확인" 라우트와 **똑같은 방식으로** 만들어 넘기는 것뿐이다.
 * 판정·매칭·카테고리 규칙은 한 줄도 여기서 다시 만들지 않는다.
 */
export interface NewSnapshotDomesticCheckInput {
  snapshotId: string;
  /** GLOBAL-MARKET ③-2 — 어느 판매자가 켜 둔 편집샵으로 뒤질지. 선택 인자가 아닌
   * 이유는 runDomesticPriceCheck 쪽 주석 그대로다(안 넘기면 판매자가 꺼 둔 샵까지
   * 크롤링된다). 호출부는 requireUser()가 정한 값만 넘긴다. */
  workspaceId: string;
  /** 방금 저장된 스냅샷의 canonicalProduct. 스냅샷을 다시 읽지 않고 이미 손에
   * 있는 값을 그대로 쓴다 — 저장 직후라 DB를 한 번 더 읽어봐야 같은 값이다. */
  canonicalProduct: CanonicalProduct;
}

/**
 * 분석 직후 딱 한 번 도는 국내 가격 조사. **절대 throw하지 않는다.**
 *
 * 상품 분석은 이 단계와 별개의 일이다. 국내 편집샵이 하나도 안 열리든, 크롤러가
 * 터지든, Supabase가 없든, 그 사실이 "상품 분석이 실패했다"로 번지면 안 된다 —
 * 실패하면 국내 비교 데이터만 비어 있고(오늘과 같은 상태), 셀러는 기존 "재확인"
 * 버튼으로 언제든 다시 시도할 수 있다. 실패를 조용히 삼키지는 않고 로그 한 줄로
 * 남긴다(어느 스냅샷이 왜 비었는지 Vercel 로그에서 바로 가려낼 수 있게).
 */
export async function runDomesticPriceCheckForNewSnapshot(
  input: NewSnapshotDomesticCheckInput,
): Promise<DomesticPriceCheckResult | null> {
  try {
    // 오래된 스냅샷/부분 저장된 product도 같은 방식으로 보정한다 — 가격 확인
    // 라우트가 쓰는 그 함수 그대로다(두 경로가 서로 다른 product를 보면 안 된다).
    const product = backfillCanonicalProduct(input.canonicalProduct);
    const result = await runDomesticPriceCheck({
      snapshotId: input.snapshotId,
      workspaceId: input.workspaceId,
      dna: buildProductIdentityDna(product),
      description: product.description.value || undefined,
      // TTAEJYO 2.0 — 이 상품 카테고리에 맞는 편집샵만 뒤진다. 스냅샷 전체를
      // 손에 쥔 경로라 breadcrumb/권장연령까지 근거로 쓸 수 있다(가격 확인
      // 라우트와 동일 — 판정 함수는 둘이 같은 것을 쓴다).
      categoryScopes: resolveCategoryScopesFromProduct(product),
      // 멱등성 — 새 정책을 만들지 않고 이미 있는 것을 쓴다. 같은 스냅샷에
      // 오늘자 DOMESTIC_SHOP 관측이 이미 있으면(셀러가 "재확인"을 먼저 눌렀거나,
      // 이 트리거가 재시도로 두 번 불렸거나) 검색도 저장도 하지 않고 끝낸다.
      // 링크 쪽은 upsertDomesticProductLink가 (snapshot_id, source_id) 충돌로
      // 업서트하므로 중복 행이 생길 수 없다.
      skipIfCheckedToday: true,
    });
    console.log("[DOMESTIC-PRICE-TRIGGER-1] 분석 직후 국내 가격 조사 완료", {
      snapshotId: input.snapshotId,
      links: result.linksCreatedOrUpdated,
      prices: result.pricesRecorded,
      sourceErrors: result.sourceErrors.length,
    });
    return result;
  } catch (error) {
    console.warn(
      "[DOMESTIC-PRICE-TRIGGER-1] 분석 직후 국내 가격 조사 실패(상품 분석에는 영향 없음)",
      input.snapshotId,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
