import { NextResponse } from "next/server";
import {
  EXPAND_CANDIDATE_MARKET_CODES,
  probeAdditionalMarkets,
  probeOriginAndKrMarkets,
  type ShopifyMarketProbeResult,
} from "@commerce/crawler";
import { convertToKrw } from "@commerce/pricing";
import type { ConvertedPriceKrw, PriceIntelligenceResult, PriceObservation, SellerInfo } from "@commerce/pricing";
import { fetchLiveExchangeRates } from "../../../lib/exchange-rates";

/**
 * Sprint N-3.2 — Global Price Intelligence. 기존 크롤러 로직(fetchShopifyProductJson
 * 기반 shopify-market-probe.ts)만 재사용하고, 새 사이트별 하드코딩은 만들지
 * 않는다. 기본 호출은 원본(사이트 기본) + KR market 2곳만 조회한다(PART H —
 * "국가별 가격 전체 조회는 펼쳤을 때만"). `?expand=true`일 때만 추가 후보
 * market을 probe한다.
 *
 * Sprint N-3.7 — 원본가격의 기준을 "브랜드 본국"에서 "판매처(편집샵) 원본
 * 시장"으로 전면 수정했다(CPO 지시, 근거: 실제로 상품을 판매하는 곳과 무관한
 * 브랜드 본국 가격을 원본으로 쓰면 안 되고, 이미 크롤링하는 판매처 사이트
 * 자신의 메타데이터가 더 싸고 더 정확하다). 브랜드 프로필/브랜드 국가 매칭
 * 로직(resolveBrandOriginPrice, brandCountryMarket 우선순위)은 전부 제거했다.
 * 판매처 국가는 오직 그 사이트의 실제 `/meta.json`에서만 가져온다 — URL
 * locale로 추정하지 않는다(Part 2/11 원칙).
 */

function toPriceObservation(probe: ShopifyMarketProbeResult, countryOverride?: string | null): PriceObservation {
  return {
    amount: probe.amount,
    currency: probe.currency,
    country: countryOverride ?? null,
    marketCode: probe.marketCode,
    sourceUrl: probe.sourceUrl,
    sourceType: "SHOPIFY_JSON",
    capturedAt: new Date().toISOString(),
    confidence: "HIGH",
  };
}

async function convertToKrwResult(amount: number, currency: string): Promise<ConvertedPriceKrw | null> {
  if (currency === "KRW") return null;
  const rates = await fetchLiveExchangeRates();
  const converted = convertToKrw(amount, currency, rates.rates);
  return {
    amount: converted.amountKrw,
    currency: "KRW",
    exchangeRate: rates.rates[currency.toUpperCase()] ?? 0,
    rateSource: rates.source,
    calculatedAt: rates.fetchedAt,
    confidence: "CALCULATED",
  };
}

function emptyResult(status: PriceIntelligenceResult["status"], message: string): PriceIntelligenceResult {
  return {
    status,
    message,
    seller: { name: null, country: null, source: null },
    sellerOriginPrice: null,
    convertedSellerOriginToKrw: null,
    krMarket: null,
    additionalMarkets: [],
    testedMarketCodes: [],
  };
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const expand = searchParams.get("expand") === "true";

  const body = (await request.json().catch(() => null)) as { sourceUrl?: string } | null;
  if (!body?.sourceUrl) {
    return NextResponse.json(emptyResult("FETCH_FAILED", "sourceUrl이 필요합니다."), { status: 400 });
  }

  const basic = await probeOriginAndKrMarkets(body.sourceUrl);
  if (!basic) {
    return NextResponse.json(
      emptyResult("NOT_SUPPORTED", "이 사이트는 아직 가격 시장 조회를 지원하지 않습니다(Shopify 상품 URL 형식이 아닙니다)."),
    );
  }

  // N-3.7 Part 2/3 — 판매처 국가는 origin(marketCode="") 요청이 이미 가져온
  // /meta.json 결과에서만 가져온다. URL locale이나 브랜드 국가로 대체하지 않는다.
  const shopMeta = basic.origin?.shopMeta ?? null;
  const seller: SellerInfo = {
    name: shopMeta?.name ?? null,
    country: shopMeta?.country ?? null,
    source: shopMeta ? "SHOPIFY_META_JSON" : null,
  };

  // sellerOriginPrice = 판매처 원본 시장(marketCode="") 가격, country는 반드시
  // seller.country(실측된 값)를 그대로 쓴다 — 통화 추측이나 locale 파싱을 쓰지 않는다.
  const sellerOriginPrice = basic.origin ? toPriceObservation(basic.origin, seller.country) : null;
  const krMarket = basic.kr ? toPriceObservation(basic.kr, "KR") : null;

  let additionalMarkets: PriceObservation[] = [];
  if (expand) {
    const extra = await probeAdditionalMarkets(body.sourceUrl, ["", "en-kr"]);
    // N-3.7 Part 2 — 이 market들의 marketCode(locale)는 "이 판매처가 그 시장에도
    // 서비스한다"는 사실일 뿐이라, locale 프리픽스에서만 국가를 뽑는다(원본가격
    // 판정에는 관여하지 않음 — 참고 표시용 country 라벨).
    additionalMarkets = extra.map((probe) => {
      const match = /^[a-z]{2}-([a-z]{2})$/i.exec(probe.marketCode);
      return toPriceObservation(probe, match ? match[1].toUpperCase() : null);
    });
  }

  const convertedSellerOriginToKrw = sellerOriginPrice
    ? await convertToKrwResult(sellerOriginPrice.amount, sellerOriginPrice.currency)
    : null;

  const testedMarketCodes = ["", "en-kr", ...(expand ? EXPAND_CANDIDATE_MARKET_CODES : [])];

  const result: PriceIntelligenceResult = {
    status: "OK",
    seller,
    sellerOriginPrice,
    convertedSellerOriginToKrw,
    krMarket,
    additionalMarkets,
    testedMarketCodes,
  };
  return NextResponse.json(result);
}
