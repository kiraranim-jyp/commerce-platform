import { NextResponse } from "next/server";
import { getAttemptsSummaryBySnapshot } from "./_lib/attempts-summary";
import { listRecentSnapshots, saveSnapshot } from "./_lib/snapshot";
import type { SnapshotWorkspaceState } from "./_lib/types";

/** Sprint B-2(CPO 지시) — 목록 자체는 기존 listRecentSnapshots() 그대로 두고
 * (스냅샷 목록 조회 로직을 여기서 다시 만들지 않는다), registration_attempts
 * 집계만 한 번의 추가 쿼리로 얹는다. */
export async function GET() {
  const snapshots = await listRecentSnapshots();
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

  const result = await saveSnapshot({
    id: body.id,
    sourceUrl: body.sourceUrl,
    title: body.title ?? null,
    thumbnailUrl: body.thumbnailUrl ?? null,
    workspace: body.workspace,
  });
  return NextResponse.json(result);
}
