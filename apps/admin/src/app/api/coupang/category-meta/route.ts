import { NextResponse } from "next/server";
import { getCoupangCredentials } from "../_lib/env";
import { fetchCategoryMeta } from "../_lib/category-meta";

/**
 * 디버그/점검용 — register 라우트가 등록 시점에 자동으로 호출하는 것과 같은
 * fetchCategoryMeta()를 사람이 브라우저/curl로 직접 확인할 수 있게 노출한다.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code || !Number.isFinite(Number(code))) {
    return NextResponse.json({ error: "code가 필요합니다." }, { status: 400 });
  }

  const credentials = await getCoupangCredentials();
  if (!credentials) {
    return NextResponse.json(
      { error: "쿠팡 인증 정보가 설정되어 있지 않습니다.", status: "NOT_CONFIGURED" },
      { status: 200 },
    );
  }

  const meta = await fetchCategoryMeta(credentials, Number(code));
  if (!meta) {
    return NextResponse.json({ error: "카테고리 메타정보 조회에 실패했습니다.", status: "FETCH_FAILED" });
  }
  return NextResponse.json({ status: 200, body: meta });
}
