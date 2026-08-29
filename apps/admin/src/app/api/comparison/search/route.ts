import { searchComparisonShops, verifySourcePriceDirect } from "@commerce/crawler";
import { NextResponse } from "next/server";
import { listComparisonShops } from "../../comparison-shops/_lib/comparison-shop";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { title?: string; brand?: string; sourceUrl?: string; sku?: string }
    | null;
  if (!body?.title) {
    return NextResponse.json({ ok: false, error: "title이 필요합니다." }, { status: 400 });
  }

  // P-4-DATA-4 STEP 4(CPO 지시) — 타 판매처 검색과 별개로, 원본 sourceUrl 자체를
  // 직접 재조회한다(다른 사이트 검색보다 신뢰도가 높은 1차 경로 — 실측 100% 성공률).
  // 검색 결과와 독립적으로 병렬 실행한다(서로 막지 않는다).
  const sourceVerificationPromise = body.sourceUrl
    ? verifySourcePriceDirect(body.sourceUrl)
    : Promise.resolve({ status: "NOT_APPLICABLE" as const, price: null, regularPrice: null });

  const shops = (await listComparisonShops()).filter((s) => s.isActive);
  const [results, sourceVerification] = await Promise.all([
    searchComparisonShops(
      { title: body.title, brand: body.brand, sourceUrl: body.sourceUrl, sku: body.sku },
      shops.map((s) => ({ id: s.id, name: s.name, domain: s.domain, currency: s.currency })),
    ),
    sourceVerificationPromise,
  ]);

  // N-3.10 Part L — 비교 UI가 판매처 국가(country flag)를 보여줘야 해서, crawler
  // 패키지의 검색 로직(country를 모르는 순수 검색 함수)은 그대로 두고 여기서
  // shopId 기준으로 comparison_shops의 country만 붙여준다(패키지 경계 존중).
  const countryByShopId = new Map(shops.map((s) => [s.id, s.country]));
  const enrichedResults = results.map((r) => ({ ...r, shopCountry: countryByShopId.get(r.shopId) ?? null }));
  return NextResponse.json({ ok: true, results: enrichedResults, sourceVerification });
}
