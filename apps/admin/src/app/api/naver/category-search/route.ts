import { NextResponse } from "next/server";
import type { CanonicalProduct } from "@commerce/shared";
import { generateNaverCategoryCandidates } from "@commerce/listing";
import { getNaverCredentials } from "../_lib/env";
import { issueNaverAccessToken } from "../_lib/client";
import { fetchNaverLeafCategories } from "../_lib/category";

/**
 * Sprint N-2.9 — CartPilot product → Naver leaf category 후보 생성. 실제
 * category ID를 만들어내는 건 여전히 CartPilot의 매칭 로직(순수 함수,
 * category-match.ts)이지 이 라우트가 지어내는 게 아니다 — 이 라우트는 인증된
 * 서버에서만 가능한 두 가지(access token 발급, 전체 leaf category 목록 조회)만
 * 담당한다.
 */
export async function POST(request: Request) {
  let product: CanonicalProduct;
  try {
    product = (await request.json()) as CanonicalProduct;
  } catch {
    return NextResponse.json({ status: "INVALID_BODY", message: "요청 본문이 올바른 JSON이 아닙니다." }, { status: 400 });
  }

  const credentials = getNaverCredentials();
  if (!credentials) {
    return NextResponse.json({ status: "NOT_CONFIGURED", message: "네이버 인증 정보가 설정되어 있지 않습니다." });
  }

  const tokenResult = await issueNaverAccessToken(credentials);
  if (!tokenResult.ok) {
    return NextResponse.json({ status: "AUTH_FAILED", message: tokenResult.message });
  }

  const leafCategories = await fetchNaverLeafCategories(tokenResult.accessToken);
  if (!leafCategories) {
    return NextResponse.json({ status: "CATEGORY_FETCH_FAILED", message: "네이버 카테고리 목록을 가져오지 못했습니다." });
  }

  const candidates = generateNaverCategoryCandidates(product, leafCategories, 5);
  return NextResponse.json({ status: "OK", candidates, totalLeafCategories: leafCategories.length });
}
