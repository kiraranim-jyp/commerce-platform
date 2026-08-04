import { NextResponse } from "next/server";
import { deleteSnapshot, getSnapshot } from "../_lib/snapshot";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const snapshot = await getSnapshot(id);
  if (!snapshot) {
    return NextResponse.json({ ok: false, error: "스냅샷을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, snapshot });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await deleteSnapshot(id);
  return NextResponse.json(result);
}
