import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { getAttemptsSummaryBySnapshot } from "./_lib/attempts-summary";
import { listRecentSnapshots, saveSnapshot } from "./_lib/snapshot";
import type { SnapshotWorkspaceState } from "./_lib/types";

/** Sprint B-2(CPO 지시) — 목록 자체는 기존 listRecentSnapshots() 그대로 두고
 * (스냅샷 목록 조회 로직을 여기서 다시 만들지 않는다), registration_attempts
 * 집계만 한 번의 추가 쿼리로 얹는다.
 *
 * BETA-SECURITY-2 §11(CPO 지시, 2026-09-07) — 이전 버전은 인증 없이 전체
 * 사용자의 스냅샷 목록을 반환했다. 이제 세션 사용자의 workspace로만 좁힌다. */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const snapshots = await listRecentSnapshots(auth.user.workspaceId);
  const summaries = await getAttemptsSummaryBySnapshot(snapshots.map((s) => s.id));
  const enriched = snapshots.map((s) => ({
    ...s,
    registeredPlatforms: summaries[s.id]?.registeredPlatforms ?? [],
    hasRegistrationError: summaries[s.id]?.hasError ?? false,
    lastAttemptAt: summaries[s.id]?.lastAttemptAt ?? null,
  }));
  return NextResponse.json({ snapshots: enriched });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    sourceUrl?: string;
    title?: string | null;
    thumbnailUrl?: string | null;
    workspace?: SnapshotWorkspaceState;
  } | null;

  if (!body?.sourceUrl || !body?.workspace) {
    return NextResponse.json({ ok: false, error: "sourceUrl과 workspace가 필요합니다." }, { status: 400 });
  }

  // BETA-SECURITY-2 §13 — body에 workspaceId/userId가 섞여 들어와도 읽지
  // 않는다. 소유자는 세션에서만 결정된다.
  const result = await saveSnapshot({
    id: body.id,
    sourceUrl: body.sourceUrl,
    title: body.title ?? null,
    thumbnailUrl: body.thumbnailUrl ?? null,
    workspace: body.workspace,
    workspaceId: auth.user.workspaceId,
  });
  return NextResponse.json(result);
}
