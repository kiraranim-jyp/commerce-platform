import { NextResponse } from "next/server";
import { createComparisonShop, listComparisonShops } from "./_lib/comparison-shop";

export async function GET() {
  const shops = await listComparisonShops();
  return NextResponse.json({ shops });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { url?: string; name?: string } | null;
  if (!body?.url) {
    return NextResponse.json({ ok: false, error: "URL이 필요합니다." }, { status: 400 });
  }
  const result = await createComparisonShop(body.url, body.name);
  return NextResponse.json(result);
}
