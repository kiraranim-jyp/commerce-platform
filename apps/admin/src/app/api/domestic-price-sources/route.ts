import { NextResponse } from "next/server";
import { createDomesticPriceSource, listDomesticPriceSources } from "./_lib/domestic-price-source";

export async function GET() {
  const sources = await listDomesticPriceSources();
  return NextResponse.json({ sources });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        url?: string;
        name?: string;
        categoryScope?: string[];
        priority?: "P0" | "P1" | "P2";
        collectionStrategy?: "AUTO_API" | "AUTO_SCRAPE" | "MANUAL" | "NOT_AVAILABLE";
      }
    | null;
  if (!body?.url) {
    return NextResponse.json({ ok: false, error: "URL이 필요합니다." }, { status: 400 });
  }
  const result = await createDomesticPriceSource({ ...body, url: body.url });
  return NextResponse.json(result);
}
