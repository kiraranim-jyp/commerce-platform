import { comparisonShopCollectability } from "@commerce/crawler";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createComparisonShop, listComparisonShops } from "./_lib/comparison-shop";

export const runtime = "nodejs";

/**
 * SOURCE-POLICY-01 후속(CEO 승인, 2026-09-16) — 이 라우트 4개(GET/POST/PATCH/DELETE)에는
 * 인증이 **아예 없었다**. `requireUser` import 조차 없어서 로그인하지 않은 누구나
 * 해외 조사 소스 28곳을 켜고 끄고 지울 수 있었다. 국내 쌍(`/api/domestic-price-sources`)은
 * 처음부터 requireUser()를 쓰고 있었다 — 해외만 빠져 있었다.
 *
 * 🔴 workspace로 «좁히지» 않는다. comparison_shops는 workspace_id가 없는 공용
 *    카탈로그이고(051이 국내에만 넣었다), 여기서 워크스페이스 필터를 새로 만들면
 *    28행이 전부 안 보이게 된다. 이번에 닫는 것은 «인증»이지 «인가 범위»가 아니다.
 */

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
 * 조건을 그대로 읽는다. DB 컬럼으로 두지 않는 이유도 같다: 파서는 코드에 있지
 * DB에 있지 않고, 둘을 따로 적는 순간 다시 어긋난다.
 *
 * GOLF-01.5 축 C(CEO 지시, 2026-09-16) — Rakuten 어댑터가 생기면서
 * parserAvailable 한 칸으로는 부족해졌다. 이제 세 가지 서로 다른 사실이 있다:
 *
 *   accessStatus           그 사이트가 열리는가        (DB · 051/053)
 *   parserAvailable        우리가 읽을 어댑터가 있는가  (코드 · 등록부)
 *   credentialsConfigured  그 어댑터를 부를 열쇠가 있는가 (환경변수)
 *
 * 🔴 셋을 한 칸에 합치지 않는다. Rakuten 은 오늘 «열리고 · 어댑터도 있고 ·
 *    키만 없다» — 이 상태를 "파서 없음"이라고 말하면 앞으로 해야 할 일이
 *    "파서를 만드는 것"으로 잘못 읽힌다.
 * 🔴 missingCredentials 에는 환경변수 **이름**만 담긴다. 값은 담지 않는다.
 */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const shops = (await listComparisonShops()).map((shop) => ({
    ...shop,
    ...comparisonShopCollectability(shop.domain),
  }));
  return NextResponse.json({ shops });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

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
