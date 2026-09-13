import { attachProductMatchTruth, searchComparisonShops, verifySourcePriceDirect } from "@commerce/crawler";
import { identityDnaFromFields, productFactsFromIdentityDna } from "@commerce/shared";
import { NextResponse } from "next/server";
import { listComparisonShops } from "../../comparison-shops/_lib/comparison-shop";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        title?: string;
        brand?: string;
        sourceUrl?: string;
        sku?: string;
        description?: string;
        /** MATCHING-2.0-CORE — 화면이 이미 갖고 있던 값인데 여태 보내지 않던 두 칸.
         * 보내주면 색상/소재 축이 살아나고, 안 보내주면 예전과 똑같이 동작한다. */
        color?: string;
        material?: string;
      }
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

  // MATCHING-2.0-CORE(CEO 지시, 2026-09-13) — 화면이 보내주는 필드로 "내 상품의
  // 사실 묶음"을 만들어 함께 넘긴다. 이게 없으면 후보 쪽에서 색상·소재·핏·대상
  // 연령을 아무리 잘 읽어내도 짝지을 상대가 없어서 교차판매처 판정이 돌지 않는다.
  // 없는 값은 지어내지 않는다 — 화면이 안 보내준 축은 그냥 근거에서 빠진다.
  const facts = productFactsFromIdentityDna(
    identityDnaFromFields({
      title: body.title,
      brand: body.brand,
      sku: body.sku,
      sourceUrl: body.sourceUrl,
      color: body.color,
      material: body.material,
      description: body.description,
    }),
  );
  const query = {
    title: body.title,
    brand: body.brand,
    sourceUrl: body.sourceUrl,
    sku: body.sku,
    description: body.description,
    facts,
  };
  const shops = (await listComparisonShops()).filter((s) => s.isActive);
  const [results, sourceVerification] = await Promise.all([
    searchComparisonShops(
      query,
      shops.map((s) => ({ id: s.id, name: s.name, domain: s.domain, currency: s.currency })),
    ),
    sourceVerificationPromise,
  ]);

  // N-3.10 Part L — 비교 UI가 판매처 국가(country flag)를 보여줘야 해서, crawler
  // 패키지의 검색 로직(country를 모르는 순수 검색 함수)은 그대로 두고 여기서
  // shopId 기준으로 comparison_shops의 country만 붙여준다(패키지 경계 존중).
  const countryByShopId = new Map(shops.map((s) => [s.id, s.country]));
  const withCountry = results.map((r) => ({ ...r, shopCountry: countryByShopId.get(r.shopId) ?? null }));
  // P-11 STEP 4(대표님/CPO 지시, 2026-08-30) — "동일상품 90%" 오판정 수정. confidence/
  // matchLevel은 재계산하지 않고(searchComparisonShops가 이미 계산한 값을 그대로 둠),
  // 이 계층에서 productMatchTruth만 얹는다.
  const enrichedResults = attachProductMatchTruth(query, withCountry);
  return NextResponse.json({ ok: true, results: enrichedResults, sourceVerification });
}
