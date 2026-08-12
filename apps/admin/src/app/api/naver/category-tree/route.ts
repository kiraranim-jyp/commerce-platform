import { NextResponse } from "next/server";
import type { CommerceCategoryTreeNode } from "@commerce/shared";
import type { NaverCategoryTreeNode } from "@commerce/listing";
import { getNaverCredentials } from "../_lib/env";
import { issueNaverAccessToken } from "../_lib/client";
import { fetchNaverAllCategories } from "../_lib/category";

/**
 * N-3.10 Part C — 쿠팡은 이미 대분류→소분류 드릴다운(카테고리 목록에서 직접
 * 찾기)이 있는데 네이버는 없다(CEO 피드백: "AI 추천이 어려우면 직접
 * 선택하면 되는데"). 네이버 API 자체엔 트리 엔드포인트가 없지만, N-3.1에서
 * 이미 확인한 전체 flat 목록(leaf+non-leaf, wholeCategoryName 포함)을
 * ">"로 쪼개서 트리로 재구성할 수 있다 — fetchNaverAllCategories는 이미
 * 30분 캐시가 있어 새 API 호출을 늘리지 않는다. 응답은 CommerceCategoryTreeNode
 * 공통 모양으로 변환해서 돌려준다 — CategoryTreeBrowser가 쿠팡과 똑같은
 * 컴포넌트로 이 트리를 그린다(플랫폼별 트리 UI를 따로 만들지 않는다).
 */
export async function GET() {
  const credentials = getNaverCredentials();
  if (!credentials) {
    return NextResponse.json({ status: "NOT_CONFIGURED", error: "네이버 인증 정보가 설정되어 있지 않습니다." });
  }

  const tokenResult = await issueNaverAccessToken(credentials);
  if (!tokenResult.ok) {
    return NextResponse.json({ status: "AUTH_FAILED", error: tokenResult.message });
  }

  const allCategories = await fetchNaverAllCategories(tokenResult.accessToken);
  if (!allCategories) {
    return NextResponse.json({ status: "CATEGORY_FETCH_FAILED", error: "네이버 카테고리 목록을 가져오지 못했습니다." });
  }

  const tree = buildTree(allCategories);
  return NextResponse.json({ status: "OK", tree });
}

function buildTree(allCategories: NaverCategoryTreeNode[]): CommerceCategoryTreeNode {
  const childrenByParentPrefix = new Map<string, NaverCategoryTreeNode[]>();
  for (const category of allCategories) {
    const parts = category.wholeCategoryName.split(">");
    const parentPrefix = parts.slice(0, -1).join(">");
    const siblings = childrenByParentPrefix.get(parentPrefix) ?? [];
    siblings.push(category);
    childrenByParentPrefix.set(parentPrefix, siblings);
  }

  function toNode(category: NaverCategoryTreeNode): CommerceCategoryTreeNode {
    const kids = childrenByParentPrefix.get(category.wholeCategoryName);
    return {
      id: category.id,
      name: category.name,
      children: kids && kids.length > 0 ? kids.map(toNode) : undefined,
    };
  }

  const topLevel = childrenByParentPrefix.get("") ?? [];
  return { id: "root", name: "전체", children: topLevel.map(toNode) };
}
