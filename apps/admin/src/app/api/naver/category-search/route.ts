import { NextResponse } from "next/server";
import type { CanonicalProduct } from "@commerce/shared";
import { buildNaverCategoryPath, generateNaverCategoryCandidates } from "@commerce/listing";
import { getNaverCredentials } from "../_lib/env";
import { issueNaverAccessToken } from "../_lib/client";
import { fetchNaverAllCategories } from "../_lib/category";

/**
 * Sprint N-2.9 — CartPilot product → Naver leaf category 후보 생성. 실제
 * category ID를 만들어내는 건 여전히 CartPilot의 매칭 로직(순수 함수,
 * category-match.ts)이지 이 라우트가 지어내는 게 아니다 — 이 라우트는 인증된
 * 서버에서만 가능한 두 가지(access token 발급, 전체 leaf category 목록 조회)만
 * 담당한다.
 *
 * Sprint N-3.1 — leaf 전용 목록 대신 전체 목록(fetchNaverAllCategories)을
 * 한 번만 받아서, 후보 채점용 leaf 목록은 여기서 filter로 파생하고 같은
 * 전체 목록으로 각 후보의 hierarchy(상위 카테고리 id 체인)까지 채운다 —
 * 별도 API 호출을 늘리지 않는다.
 */
export async function POST(request: Request) {
  let product: CanonicalProduct;
  try {
    product = (await request.json()) as CanonicalProduct;
  } catch {
    return NextResponse.json({ status: "INVALID_BODY", message: "요청 본문이 올바른 JSON이 아닙니다." }, { status: 400 });
  }

  const credentials = await getNaverCredentials();
  if (!credentials) {
    return NextResponse.json({ status: "NOT_CONFIGURED", message: "네이버 인증 정보가 설정되어 있지 않습니다." });
  }

  const tokenResult = await issueNaverAccessToken(credentials);
  if (!tokenResult.ok) {
    return NextResponse.json({ status: "AUTH_FAILED", message: tokenResult.message });
  }

  const allCategories = await fetchNaverAllCategories(tokenResult.accessToken);
  if (!allCategories) {
    return NextResponse.json({ status: "CATEGORY_FETCH_FAILED", message: "네이버 카테고리 목록을 가져오지 못했습니다." });
  }

  const leafCategories = allCategories.filter((c) => c.last);
  const rawCandidates = generateNaverCategoryCandidates(product, leafCategories, 5);
  const candidates = rawCandidates.map((c) => ({
    ...c,
    hierarchy: buildNaverCategoryPath(c.categoryId, allCategories),
  }));

  return NextResponse.json({ status: "OK", candidates, totalLeafCategories: leafCategories.length });
}
