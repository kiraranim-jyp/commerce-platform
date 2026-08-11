import { NextResponse } from "next/server";
import {
  EXPAND_CANDIDATE_MARKET_CODES,
  probeAdditionalMarkets,
  probeOriginAndKrMarkets,
  resolveBrandOriginPrice,
  type ShopifyMarketProbeResult,
} from "@commerce/crawler";
import { convertToKrw } from "@commerce/pricing";
import type { ConvertedPriceKrw, PriceIntelligenceResult, PriceObservation } from "@commerce/pricing";
import { fetchLiveExchangeRates } from "../../../lib/exchange-rates";
import { findBrandProfileByName } from "../coupang/_lib/brand-profile";

/**
 * Sprint N-3.2 — Global Price Intelligence. 기존 크롤러 로직(fetchShopifyProductJson
 * 기반 shopify-market-probe.ts)만 재사용하고, 새 사이트별 하드코딩은 만들지
 * 않는다. 기본 호출은 원본(사이트 기본) + KR market 2곳만 조회한다(PART H —
 * "국가별 가격 전체 조회는 펼쳤을 때만"). `?expand=true`일 때만 추가 후보
 * market을 probe한다.
 */

/** 로케일 프리픽스("en-kr" 등)에서 국가 코드를 뽑는다 — URL 구조 자체가
 * 알려주는 사실이라 추측이 아니다. */
function countryFromMarketCode(marketCode: string): string | null {
  const match = /^[a-z]{2}-([a-z]{2})$/i.exec(marketCode);
  return match ? match[1].toUpperCase() : null;
}

/** 사실상 한 국가에서만 쓰이는 통화만 국가로 매핑한다(GBP→GB, KRW→KR 등).
 * EUR/USD/CNY처럼 여러 나라가 공유하는 통화는 국가를 추측하지 않고 null로
 * 둔다(CPO 지시: 존재하지 않는 국가를 임의로 생성하지 않는다 — 통화만으로
 * 특정 국가라고 단정하는 것도 같은 원칙 위반이다). */
const UNAMBIGUOUS_CURRENCY_COUNTRY: Record<string, string> = {
  GBP: "GB",
  KRW: "KR",
  JPY: "JP",
  SEK: "SE",
  DKK: "DK",
  NOK: "NO",
  CHF: "CH",
  AUD: "AU",
  CAD: "CA",
  NZD: "NZ",
};

/** N-3.2 실측(2026-08-10) — 같은 상품을 로컬(한국 IP)에서 조회하면 GBP 35였는데,
 * 이 라우트(Vercel 서버, 미국 리전)에서 조회하면 같은 GBP 라벨로 74가 나왔다
 * (재현 확인 — 우연이 아니라 서버 위치에 매인 값). marketCode=""(로케일
 * 프리픽스 없는 기본 요청)는 Shopify Markets의 geo 기반 presentment 때문에
 * 이런 일이 생긴다 — 통화 라벨(shopCurrency override)은 고정되지만 금액은
 * 아니다. 로케일이 명시된 요청(en-kr 등)은 이 문제가 없다(방문자 로케일에
 * 고정된 가격을 그대로 준다). "확인됐다"고 조용히 넘기지 않고 UI에 그대로
 * 노출한다. */
const DEFAULT_MARKET_GEO_CAVEAT =
  "이 값은 서버 요청 위치에 따라 달라질 수 있습니다(Shopify Markets geo 기반 presentment, N-3.2 실측 확인) — 통화 라벨은 고정되지만 금액은 고정되지 않습니다.";

function toPriceObservation(probe: ShopifyMarketProbeResult): PriceObservation {
  const country = countryFromMarketCode(probe.marketCode) ?? UNAMBIGUOUS_CURRENCY_COUNTRY[probe.currency] ?? null;
  return {
    amount: probe.amount,
    currency: probe.currency,
    country,
    marketCode: probe.marketCode,
    caveat: probe.marketCode === "" ? DEFAULT_MARKET_GEO_CAVEAT : undefined,
    sourceUrl: probe.sourceUrl,
    sourceType: "SHOPIFY_JSON",
    capturedAt: new Date().toISOString(),
    confidence: "HIGH",
  };
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const expand = searchParams.get("expand") === "true";

  const body = (await request.json().catch(() => null)) as { sourceUrl?: string; brand?: string; title?: string } | null;
  if (!body?.sourceUrl) {
    const result: PriceIntelligenceResult = {
      status: "FETCH_FAILED",
      message: "sourceUrl이 필요합니다.",
      brandCountry: null,
      originMarket: null,
      originMarketIsBrandCountryMarket: false,
      krMarket: null,
      additionalMarkets: [],
      testedMarketCodes: [],
      convertedOriginToKrw: null,
      brandOriginPrice: null,
      brandOriginPriceStatus: "MISSING",
      brandOriginPriceReason: "sourceUrl이 없어 확인하지 않았습니다.",
      convertedBrandOriginToKrw: null,
    };
    return NextResponse.json(result, { status: 400 });
  }

  const basic = await probeOriginAndKrMarkets(body.sourceUrl);
  if (!basic) {
    const result: PriceIntelligenceResult = {
      status: "NOT_SUPPORTED",
      message: "이 사이트는 아직 가격 시장 조회를 지원하지 않습니다(Shopify 상품 URL 형식이 아닙니다).",
      brandCountry: null,
      originMarket: null,
      originMarketIsBrandCountryMarket: false,
      krMarket: null,
      additionalMarkets: [],
      testedMarketCodes: [],
      convertedOriginToKrw: null,
      brandOriginPrice: null,
      brandOriginPriceStatus: "MISSING",
      brandOriginPriceReason: "원본 사이트가 Shopify 형식이 아니어서 확인하지 않았습니다.",
      convertedBrandOriginToKrw: null,
    };
    return NextResponse.json(result);
  }

  // brandCountry는 참고 정보일 뿐 — 이 값으로 어떤 market을 원본으로 쓸지
  // 강제하지 않는다(CPO 지시: 브랜드 국가 ≠ 가격 시장).
  const brandProfile = body.brand ? await findBrandProfileByName(body.brand) : null;
  const brandCountry = brandProfile?.countryOfOrigin || null;

  // N-3.6(개정 Part C/D) — 브랜드 본국 "공식 사이트"에서 실제 원본가격을 확인한다.
  // title이 없으면(호출부가 아직 안 넘겼거나) 검색 자체가 불가능하므로 MISSING.
  const brandOriginResult = body.title
    ? await resolveBrandOriginPrice(brandProfile?.officialWebsite ?? null, body.title, brandProfile?.name ?? body.brand ?? null)
    : {
        status: "MISSING" as const,
        price: null,
        reason: "상품명이 없어 브랜드 공식 사이트 검색을 시도하지 않았습니다.",
      };

  const originObservation = basic.origin ? toPriceObservation(basic.origin) : null;
  const krObservation = basic.kr ? toPriceObservation(basic.kr) : null;

  let additionalMarkets: PriceObservation[] = [];
  if (expand) {
    const extra = await probeAdditionalMarkets(body.sourceUrl, ["", "en-kr"]);
    additionalMarkets = extra.map(toPriceObservation);
  }

  // Priority 1(브랜드 본국 시장) — 실제로 확인된 market 중 국가가 brandCountry와
  // 일치하는 게 있을 때만 채택한다. 없으면 Priority 2(사이트 기본 시장).
  const allKnownMarkets = [originObservation, krObservation, ...additionalMarkets].filter(
    (m): m is PriceObservation => m !== null,
  );
  const brandCountryMarket =
    brandCountry != null ? allKnownMarkets.find((m) => m.country === brandCountry) ?? null : null;

  const finalOriginMarket = brandCountryMarket ?? originObservation;
  const originMarketIsBrandCountryMarket = brandCountryMarket !== null;

  let convertedOriginToKrw: ConvertedPriceKrw | null = null;
  if (finalOriginMarket && finalOriginMarket.currency !== "KRW") {
    const rates = await fetchLiveExchangeRates();
    const converted = convertToKrw(finalOriginMarket.amount, finalOriginMarket.currency, rates.rates);
    convertedOriginToKrw = {
      amount: converted.amountKrw,
      currency: "KRW",
      exchangeRate: rates.rates[finalOriginMarket.currency.toUpperCase()] ?? 0,
      rateSource: rates.source,
      calculatedAt: rates.fetchedAt,
      confidence: "CALCULATED",
    };
  }

  const testedMarketCodes = ["", "en-kr", ...(expand ? EXPAND_CANDIDATE_MARKET_CODES : [])];

  // N-3.6(개정 Part E) — brandOriginPrice와 convertedOriginToKrw는 완전히 별도
  // 계산이다(같은 rates 객체를 굳이 재조회하지 않고 재사용한다).
  let convertedBrandOriginToKrw: ConvertedPriceKrw | null = null;
  if (brandOriginResult.price && brandOriginResult.price.currency !== "KRW") {
    const rates = await fetchLiveExchangeRates();
    const converted = convertToKrw(brandOriginResult.price.amount, brandOriginResult.price.currency, rates.rates);
    convertedBrandOriginToKrw = {
      amount: converted.amountKrw,
      currency: "KRW",
      exchangeRate: rates.rates[brandOriginResult.price.currency.toUpperCase()] ?? 0,
      rateSource: rates.source,
      calculatedAt: rates.fetchedAt,
      confidence: "CALCULATED",
    };
  }

  const result: PriceIntelligenceResult = {
    status: "OK",
    brandCountry,
    originMarket: finalOriginMarket,
    originMarketIsBrandCountryMarket,
    krMarket: krObservation,
    additionalMarkets,
    testedMarketCodes,
    convertedOriginToKrw,
    brandOriginPrice: brandOriginResult.price,
    brandOriginPriceStatus: brandOriginResult.status,
    brandOriginPriceReason: brandOriginResult.reason,
    convertedBrandOriginToKrw,
  };
  return NextResponse.json(result);
}
