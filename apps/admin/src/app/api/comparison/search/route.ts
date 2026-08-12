import { searchComparisonShops } from "@commerce/crawler";
import { NextResponse } from "next/server";
import { listComparisonShops } from "../../comparison-shops/_lib/comparison-shop";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { title?: string; brand?: string; sourceUrl?: string; sku?: string }
    | null;
  if (!body?.title) {
    return NextResponse.json({ ok: false, error: "title이 필요합니다." }, { status: 400 });
  }

  const shops = (await listComparisonShops()).filter((s) => s.isActive);
  const results = await searchComparisonShops(
    { title: body.title, brand: body.brand, sourceUrl: body.sourceUrl, sku: body.sku },
    shops.map((s) => ({ id: s.id, name: s.name, domain: s.domain, currency: s.currency })),
  );

  // N-3.10 Part L — 비교 UI가 판매처 국가(country flag)를 보여줘야 해서, crawler
  // 패키지의 검색 로직(country를 모르는 순수 검색 함수)은 그대로 두고 여기서
  // shopId 기준으로 comparison_shops의 country만 붙여준다(패키지 경계 존중).
  const countryByShopId = new Map(shops.map((s) => [s.id, s.country]));
  const enrichedResults = results.map((r) => ({ ...r, shopCountry: countryByShopId.get(r.shopId) ?? null }));
  return NextResponse.json({ ok: true, results: enrichedResults });
}
