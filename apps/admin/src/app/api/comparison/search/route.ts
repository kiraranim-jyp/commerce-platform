import { attachProductMatchTruth, searchComparisonShops, verifySourcePriceDirect } from "@commerce/crawler";
import { selectedMarketSourceScopes, sourceFitsScopes } from "@commerce/category";
import { identityDnaFromFields, productFactsFromIdentityDna } from "@commerce/shared";
import { NextResponse } from "next/server";
import { resolveCategoryScopes } from "../../domestic-price-sources/_lib/category-scope";
import { isCollectableAccess, listComparisonShops } from "../../comparison-shops/_lib/comparison-shop";

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
        /** GOLF-01 축 A(CEO 지시, 2026-09-15) — 셀러가 상품 검색 시작 시 고른
         * 시장조사 카테고리(MARKET-CATEGORY-1). 국내 경로가
         * resolveMarketCategoryScopes로 이미 쓰고 있는 그 값이다.
         * 안 보내면 자동 추정으로 내려가고, 자동 추정도 못 하면 필터가 걸리지
         * 않는다 = 오늘과 완전히 같은 동작(하위호환). */
        marketCategoryProfileId?: string | null;
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
  /**
   * GOLF-01 축 A(CEO 지시, 2026-09-15) — 해외 조사 대상을 두 가지로 좁힌다.
   * 지금까지 이 줄은 `isActive`만 봤다. 그래서 골프용품을 조사해도 아동복
   * 편집샵 25곳을 전부 뒤졌다(국내는 TTAEJYO 2.0에서 이미 고친 문제인데
   * 해외에는 카테고리라는 개념 자체가 없었다).
   *
   * ① 카테고리 적합도 — 국내와 **같은 함수**(sourceFitsScopes)를 쓴다.
   *    판정을 두 번 구현하면 두 화면이 언젠가 다른 말을 한다. 우선순위도
   *    국내(resolveMarketCategoryScopes)와 같다: 셀러가 고른 값이 이기고,
   *    없으면 자동 추정, 그것도 없으면 필터 없음.
   * ② 🔴 접근이 막힌 판매처는 부르지 않는다(CEO 명시: "막힌 사이트를 반복
   *    호출하지 않는다"). 실측으로 403/로그인요구가 확인된 사이트는
   *    access_status에 그 사실이 적혀 있다 — 매 검색마다 다시 두드려서
   *    다시 차단당하지 않는다. 화면은 그 사이트를 "접근 차단"이라고 말한다.
   */
  const categoryScopes =
    selectedMarketSourceScopes(body.marketCategoryProfileId) ??
    resolveCategoryScopes({
      title: body.title,
      description: body.description,
      brand: body.brand,
      sourceUrl: body.sourceUrl,
    });
  const shops = (await listComparisonShops()).filter(
    (s) => s.isActive && isCollectableAccess(s.accessStatus) && sourceFitsScopes(s.categoryScope, categoryScopes),
  );
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
