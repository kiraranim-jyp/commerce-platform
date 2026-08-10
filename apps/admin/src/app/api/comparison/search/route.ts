import { searchComparisonShops } from "@commerce/crawler";
import { NextResponse } from "next/server";
import { listComparisonShops } from "../../comparison-shops/_lib/comparison-shop";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { title?: string; brand?: string } | null;
  if (!body?.title) {
    return NextResponse.json({ ok: false, error: "title이 필요합니다." }, { status: 400 });
  }

  const shops = (await listComparisonShops()).filter((s) => s.isActive);
  const results = await searchComparisonShops(
    { title: body.title, brand: body.brand },
    shops.map((s) => ({ id: s.id, name: s.name, domain: s.domain, currency: s.currency })),
  );
  return NextResponse.json({ ok: true, results });
}
