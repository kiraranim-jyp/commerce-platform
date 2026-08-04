import { NextResponse } from "next/server";
import { duplicateSnapshot } from "../../_lib/snapshot";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await duplicateSnapshot(id);
  return NextResponse.json(result);
}
