import { supportsComparisonShopSearch } from "@commerce/crawler";
import { NextResponse } from "next/server";
import { createComparisonShop, listComparisonShops } from "./_lib/comparison-shop";

export const runtime = "nodejs";

/**
 * GOLF-01.5 축 A(CEO 지시, 2026-09-16) — 목록에 "자동 수집 파서가 있는가"를 같이
 * 내려준다.
 *
 * 🔴 왜 필요한가. 오늘 설정 화면은 Rakuten을 「🟢 수집 가능」이라고 말한다.
 *    access_status='OK'(=열린다)가 맞는 사실이기 때문이다. 그런데 실제로
 *    골프 상품을 조사하면 Rakuten에서 나오는 값은 **0건**이다 —
 *    packages/crawler에 rakuten.co.jp 파서가 없어서 searchOneShop이
 *    status="unsupported"로 떨어뜨리기 때문이다. 즉 화면은 "수집 가능"이라고
 *    말하는데 수집은 한 건도 되지 않는다. CEO가 이번에 지적한 «등록됐는데 값이
 *    없다»가 바로 이것이다.
 *
 * 값을 여기서 새로 정의하지 않는다 — searchOneShop이 실제로 분기하는 그
 * 조건(supportsComparisonShopSearch)을 그대로 읽는다. DB 컬럼으로 두지 않는
 * 이유도 같다: 파서는 코드에 있지 DB에 있지 않고, 둘을 따로 적는 순간 다시
 * 어긋난다.
 */
export async function GET() {
  const shops = (await listComparisonShops()).map((shop) => ({
    ...shop,
    parserAvailable: supportsComparisonShopSearch(shop.domain),
  }));
  return NextResponse.json({ shops });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        url?: string;
        name?: string;
        isActive?: boolean;
        country?: string | null;
        currency?: string | null;
        /** GOLF-01 축 A — 설정 화면에서 고른 카테고리. 안 보내면 예전 그대로다. */
        categoryScope?: string[];
      }
    | null;
  if (!body?.url) {
    return NextResponse.json({ ok: false, error: "URL이 필요합니다." }, { status: 400 });
  }
  const result = await createComparisonShop(
    body.url,
    body.name,
    body.isActive,
    body.country,
    body.currency,
    body.categoryScope,
  );
  return NextResponse.json(result);
}
