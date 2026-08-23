import { NextResponse } from "next/server";
import { deleteDomesticPriceSource, updateDomesticPriceSource } from "../_lib/domestic-price-source";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const result = await updateDomesticPriceSource(id, body);
  return NextResponse.json(result);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await deleteDomesticPriceSource(id);
  return NextResponse.json(result);
}
