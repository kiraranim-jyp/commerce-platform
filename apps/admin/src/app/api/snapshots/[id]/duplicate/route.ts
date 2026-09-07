import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { duplicateSnapshot } from "../../_lib/snapshot";

/** BETA-SECURITY-2 §11 — 복제는 자기 workspace의 스냅샷만 가능하다. 소유권
 * 검사가 없으면 남의 스냅샷 id로 그 데이터를 자기 쪽으로 복사해올 수 있다. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const result = await duplicateSnapshot(id, auth.user.workspaceId);
  if (!result.ok) return NextResponse.json(result, { status: 404 });
  return NextResponse.json(result);
}
