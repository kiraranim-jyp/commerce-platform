import { NextResponse } from "next/server";
import { createComparisonShop, listComparisonShops } from "./_lib/comparison-shop";

export async function GET() {
  const shops = await listComparisonShops();
  return NextResponse.json({ shops });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        url?: string;
        name?: string;
        isActive?: boolean;
        country?: string | null;
        currency?: string | null;
        /** GOLF-01 축 A — 설정 화면에서 고른 카테고리. 안 보내면 예전 그대로다. */
        categoryScope?: string[];
      }
    | null;
  if (!body?.url) {
    return NextResponse.json({ ok: false, error: "URL이 필요합니다." }, { status: 400 });
  }
  const result = await createComparisonShop(
    body.url,
    body.name,
    body.isActive,
    body.country,
    body.currency,
    body.categoryScope,
  );
  return NextResponse.json(result);
}
