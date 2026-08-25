import { NextResponse } from "next/server";
import { listDomesticProductLinks } from "../_lib/domestic-product-link";

/** N-4.18-D(대표님 지시, 2026-08-25: "동일상품 못 찾음 → 비교가격 없음"으로 끝내면
 * 안 된다. 95% 미만이어도 후보를 셀러에게 보여줘야 한다") — domestic_product_links는
 * 이미 HIGH_CONFIDENCE(85~94%)/REVIEW_REQUIRED(70~84%) 링크를 verified=false로
 * 만들어 저장해 왔지만(STEP6), 그걸 화면에 보여주는 API가 없어서 실제로는 아무데도
 * 쓰이지 않았다 — 이 라우트가 그 gap을 메운다. 새 매칭 로직/저장 로직은 추가하지
 * 않는다(이미 있는 데이터를 읽기만 한다).
 *
 * N-4.18-F STEP1/2(대표님 지시, 2026-08-25: "95%가 나왔다고 단순히 배지만 보여주지
 * 말고 왜 같은 상품인지 근거를 보여줘야 한다") — EXACT(95%+, 이미 verified=true로
 * 자동확정된 링크)까지 포함해서 전부 돌려준다(예전에는 verified=false만 돌려줬음).
 * id/matchReasons/verified를 추가로 노출한다 — id는 STEP4 승격 버튼(PATCH
 * /api/domestic-price-sources/links/[id])이 쓰고, matchReasons는 match.ts가 이미
 * 계산해 저장해 둔 근거 문자열을 그대로 화면에 옮기기 위함이다(새 판정 로직 없음). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const snapshotId = searchParams.get("snapshotId");
  if (!snapshotId) {
    return NextResponse.json({ ok: false, error: "snapshotId가 필요합니다." }, { status: 400 });
  }

  const links = await listDomesticProductLinks(snapshotId);
  const candidates = links
    .filter((l) => l.status === "ACTIVE" && l.matchType !== "NOT_MATCHED")
    .map((l) => ({
      id: l.id,
      matchType: l.matchType,
      matchConfidence: l.matchConfidence,
      matchedTitle: l.matchedTitle,
      matchedBrand: l.matchedBrand,
      matchReasons: l.matchReasons,
      verified: l.verified,
      externalUrl: l.externalUrl,
    }));

  return NextResponse.json({ ok: true, candidates });
}
