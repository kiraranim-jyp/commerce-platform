import { NextResponse } from "next/server";
import { getCoupangCredentials } from "../_lib/env";
import { fetchCategoryTree } from "../_lib/category-tree";

/**
 * CEO 지시(2026-08-03) — AI 추천/검색이 부정확할 때를 위한 Wing 스타일 카테고리
 * 트리 드릴다운용. 트리 전체(수천 노드)를 한 번에 내려준다 — 클라이언트가
 * displayItemCategoryCode 기준으로 컬럼별 탐색을 직접 구현한다(서버는 원본
 * 트리 그대로 전달, 가공 없음).
 */
export async function GET() {
  const credentials = await getCoupangCredentials();
  if (!credentials) {
    return NextResponse.json(
      { error: "쿠팡 인증 정보가 설정되어 있지 않습니다.", status: "NOT_CONFIGURED" },
      { status: 200 },
    );
  }

  const tree = await fetchCategoryTree(credentials);
  if (!tree) {
    return NextResponse.json({ error: "카테고리 목록 조회에 실패했습니다.", status: "FETCH_FAILED" });
  }
  return NextResponse.json({ status: "OK", tree });
}
