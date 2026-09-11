import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import {
  deleteDomesticPriceSource,
  setWorkspaceDomesticShopEnabled,
  updateDomesticPriceSource,
} from "../_lib/domestic-price-source";

/**
 * GLOBAL-MARKET ③-2(CPO 확정, 2026-09-11) — enabled와 나머지 필드는 이제
 * 저장되는 곳이 다르다.
 *
 *   enabled                  → workspace_domestic_shop_settings(이 판매자만)
 *   priority/strategy/status → domestic_price_sources(공용 카탈로그)
 *
 * 이전에는 enabled도 카탈로그에 직접 썼다. 그래서 한 판매자가 편집샵을 끄면
 * 모든 판매자의 목록에서 사라졌다(실사용자가 한 명이라 드러나지 않았을 뿐인
 * 구조적 결함). 어느 워크스페이스인지는 requireUser()만 정한다.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        priority?: "P0" | "P1" | "P2";
        collectionStrategy?: "AUTO_API" | "AUTO_SCRAPE" | "MANUAL" | "NOT_AVAILABLE";
        status?: "ACTIVE" | "PAUSED" | "NOT_AVAILABLE" | "ERROR";
        categoryScope?: string[];
        enabled?: boolean;
      }
    | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "요청 본문이 필요합니다." }, { status: 400 });
  }

  if (body.enabled !== undefined) {
    const toggled = await setWorkspaceDomesticShopEnabled(auth.user.workspaceId, id, body.enabled);
    // 토글이 실패했는데 200을 주면 화면은 껐다고 표시하고 실제로는 계속
    // 검색된다 — 실패는 그대로 돌려준다.
    if (!toggled.ok) return NextResponse.json(toggled);
  }

  const { priority, collectionStrategy, status, categoryScope } = body;
  const hasCatalogPatch =
    priority !== undefined || collectionStrategy !== undefined || status !== undefined || categoryScope !== undefined;
  if (!hasCatalogPatch) return NextResponse.json({ ok: true });

  const result = await updateDomesticPriceSource(id, { priority, collectionStrategy, status, categoryScope });
  return NextResponse.json(result);
}

/** 삭제 규칙은 이번 작업에서 바뀌지 않는다 — USER가 직접 추가한 편집샵만
 * 지울 수 있고, SYSTEM(조사 완료 후보)은 여전히 삭제 불가다. 카탈로그 행을
 * 지우면 판매자별 설정은 FK cascade로 함께 사라진다(마이그레이션 047). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const result = await deleteDomesticPriceSource(id);
  return NextResponse.json(result);
}
