import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { deleteSnapshot, getSnapshot } from "../_lib/snapshot";

/**
 * BETA-SECURITY-2 §11/§18(CPO 지시, 2026-09-07) — 이전 버전은 인증도 소유권
 * 검사도 없어서 id만 알면 누구나 조회/삭제할 수 있었다.
 *
 * 남의 스냅샷을 요청하면 403이 아니라 404를 준다. 403은 "그 리소스는 존재하고
 * 네 것이 아니다"라는 사실을 알려주는 셈이라, 남의 데이터 존재 여부를 확인하는
 * 도구가 된다. 소유권 검사는 getSnapshot/deleteSnapshot의 쿼리 조건 자체에
 * 들어 있으므로, 이 라우트가 검사를 깜빡할 수 있는 구조가 아니다.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const snapshot = await getSnapshot(id, auth.user.workspaceId);
  if (!snapshot) {
    return NextResponse.json({ ok: false, error: "스냅샷을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, snapshot });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const result = await deleteSnapshot(id, auth.user.workspaceId);
  if (!result.ok) {
    return NextResponse.json(result, { status: 404 });
  }
  return NextResponse.json(result);
}
