import { NextResponse } from "next/server";
import { listRecentSnapshots, saveSnapshot } from "./_lib/snapshot";
import type { SnapshotWorkspaceState } from "./_lib/types";

export async function GET() {
  const snapshots = await listRecentSnapshots();
  return NextResponse.json({ snapshots });
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
