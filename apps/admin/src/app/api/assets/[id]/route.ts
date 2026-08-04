import { NextResponse } from "next/server";
import { deleteAsset } from "../_lib/asset";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await deleteAsset(id);
  return NextResponse.json(result);
}
