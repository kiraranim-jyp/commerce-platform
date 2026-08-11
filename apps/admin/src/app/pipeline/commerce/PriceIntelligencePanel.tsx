"use client";

import { useEffect, useState } from "react";
import type { CanonicalProduct } from "@commerce/shared";
import type { PriceIntelligenceResult, PriceObservation } from "@commerce/pricing";
import { formatKrw, formatOriginalPrice } from "@commerce/pricing";

/**
 * Sprint N-3.2 — Global Price Intelligence Preview. 실제 Naver 등록 가격
 * (payload.originProduct.salePrice, 판매가격 Row)과는 완전히 별개다(PART J —
 * "가격 Preview와 실제 payload가 사용하는 가격을 혼동하지 않는다"). 이 패널은
 * "이 상품이 원본 사이트에서 실제로 얼마에 팔리는지"만 보여주는 참고 정보다.
 *
 * 기본 로드는 원본(사이트 기본)+KR market 2곳만 조회한다(PART H 비용 최적화).
 * "국가별 가격 보기"를 눌렀을 때만 추가 market을 조회한다.
 */
function flagFor(country: string | null): string {
  if (!country) return "🌐";
  const codePoints = [...country.toUpperCase()].map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function MarketRow({ label, observation }: { label: string; observation: PriceObservation | null }) {
  if (!observation) {
    return (
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-secondary">{label}</span>
        <span className="text-text-tertiary">MISSING — 이 market 가격을 확인하지 못했습니다</span>
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-secondary">
          {flagFor(observation.country)} {label}
        </span>
        <span className="font-medium text-text-primary">
          {formatOriginalPrice(observation.amount, observation.currency)}
        </span>
      </div>
      {observation.caveat && <p className="mt-0.5 text-[10px] text-warning">⚠ {observation.caveat}</p>}
    </div>
  );
}

export function PriceIntelligencePanel({
  product,
  onApplyBrandOriginPrice,
}: {
  product: CanonicalProduct;
  /** N-3.6(개정 Part J) — Coupang PriceEditor의 "원본" 입력칸에 브랜드 본국
   * 원본가격을 반영하고 싶을 때만 넘긴다. 절대 자동으로(사용자 클릭 없이)
   * 호출하지 않는다(CPO 지시 Part K — "현재 URL의 가격을 몰래 원본가격으로
   * 승격하지 않는다"는 원칙을 여기도 그대로 적용한다). Naver Preview처럼
   * 원본가격을 편집하는 필드 자체가 없으면 넘기지 않는다. */
  onApplyBrandOriginPrice?: (amount: number, currency: string) => void;
}) {
  const [data, setData] = useState<PriceIntelligenceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showExpanded, setShowExpanded] = useState(false);
  const [expandLoading, setExpandLoading] = useState(false);
  const [expandFetched, setExpandFetched] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/price-intelligence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceUrl: product.sourceUrl, brand: product.brand?.value, title: product.title?.value }),
        });
        const json = (await res.json()) as PriceIntelligenceResult;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) {
          setData({
            status: "FETCH_FAILED",
            message: "가격 정보 조회 중 오류가 발생했습니다.",
            brandCountry: null,
            originMarket: null,
            originMarketIsBrandCountryMarket: false,
            krMarket: null,
            additionalMarkets: [],
            testedMarketCodes: [],
            convertedOriginToKrw: null,
            brandOriginPrice: null,
            brandOriginPriceStatus: "MISSING",
            brandOriginPriceReason: "가격 정보 조회 중 오류가 발생했습니다.",
            convertedBrandOriginToKrw: null,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product.sourceUrl, product.brand?.value, product.title?.value]);

  function toggleExpand() {
    if (showExpanded) {
      setShowExpanded(false);
      return;
    }
    setShowExpanded(true);
    if (expandFetched) return;
    setExpandLoading(true);
    fetch("/api/price-intelligence?expand=true", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceUrl: product.sourceUrl, brand: product.brand?.value }),
    })
      .then((res) => res.json())
      .then((json: PriceIntelligenceResult) => {
        setData(json);
        setExpandFetched(true);
      })
      .catch(() => {})
      .finally(() => setExpandLoading(false));
  }

  if (loading) {
    return <p className="text-[11px] text-text-tertiary">해외 가격 정보 조회 중...</p>;
  }
  if (!data || data.status !== "OK") {
    return (
      <p className="text-[11px] text-text-tertiary">
        {data?.message ?? "가격 정보를 조회하지 못했습니다."}
      </p>
    );
  }

  // N-3.6 GAP CLOSURE(Part 3) — 기준을 브랜드 본국 원본가격으로 전환한다. 예전에는
  // originMarket(URL locale로 고른 "사이트 기본" 시장)을 기준으로 diff를 계산했는데,
  // 이건 CPO가 지적한 "URL의 국가 ≠ 가격의 시장" 원칙을 diff 계산에서는 아직
  // 안 지키고 있던 부분이었다. brandOriginPrice가 없으면(MISSING/BLOCKED) diff를
  // 계산하지 않는다 — originMarket으로 몰래 대체하지 않는다(Part K 원칙).
  const diffPercent =
    data.krMarket && data.convertedBrandOriginToKrw
      ? Math.round(
          ((data.krMarket.amount - data.convertedBrandOriginToKrw.amount) / data.convertedBrandOriginToKrw.amount) *
            1000,
        ) / 10
      : null;

  const allMarkets = [data.originMarket, data.krMarket, ...data.additionalMarkets].filter(
    (m): m is PriceObservation => m !== null,
  );

  return (
    <div className="space-y-2">
      {/* N-3.6(개정 Part G/K) — 브랜드 본국 "공식 사이트"에서 확인한 원본가격.
          아래 originMarket(원본 시장)과는 다른 개념이다 — originMarket은 상품이
          실제로 팔리는 그 사이트 안에서 브랜드 국가와 일치하는 market을 고른
          것뿐이라, 브랜드가 완전히 다른 판매처를 통해 팔리면(예: 덴마크 브랜드가
          영국 편집샵에서 팔리는 경우) 브랜드 본국 가격 자체를 절대 보여줄 수
          없다. */}
      {data.brandOriginPrice ? (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-2">
          <p className="text-[11px] font-medium text-text-secondary">브랜드 본국 원본가격</p>
          <p className="mt-0.5 text-sm font-semibold text-text-primary">
            {formatOriginalPrice(data.brandOriginPrice.amount, data.brandOriginPrice.currency)}
          </p>
          {data.convertedBrandOriginToKrw && (
            <p className="mt-0.5 text-[11px] text-text-tertiary">
              → 환율 적용 약 {formatKrw(data.convertedBrandOriginToKrw.amount)}
            </p>
          )}
          <p className="mt-1 text-[10px] text-text-tertiary">{data.brandOriginPriceReason}</p>
          <p className="mt-1 text-[10px] text-text-tertiary">
            브랜드 본국 가격을 기준으로 환산한 참고가격입니다. 실제 판매가격은 국가/시장별 가격정책에 따라 다를 수
            있습니다.
          </p>
          {onApplyBrandOriginPrice && (
            <button
              type="button"
              onClick={() => onApplyBrandOriginPrice(data.brandOriginPrice!.amount, data.brandOriginPrice!.currency)}
              className="mt-1.5 rounded border border-primary px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10"
            >
              이 값을 원본가격으로 적용
            </button>
          )}
        </div>
      ) : (
        <p className="rounded-md bg-background px-2 py-1.5 text-[11px] text-warning">
          ⚠ 브랜드 본국 원본가격을 확인하지 못했습니다 — {data.brandOriginPriceReason}
        </p>
      )}

      {/* N-3.6 GAP CLOSURE(Part 3) — 이 아래는 전부 "판매처 시장가격 참고 정보"다.
          originMarket은 더 이상 "원본가격"이라고 부르지 않는다(URL locale로 고른
          사이트 기본 시장일 뿐 — Part H 원칙: URL의 국가 ≠ 가격의 시장). */}
      <p className="text-[10px] font-medium text-text-tertiary">판매처별 실제 가격(참고 — 원본가격 아님)</p>
      <MarketRow
        label={data.originMarketIsBrandCountryMarket ? "판매처 시장가(브랜드 본국과 일치)" : "판매처 시장가(사이트 기본)"}
        observation={data.originMarket}
      />
      {data.convertedOriginToKrw && (
        <p className="text-[11px] text-text-tertiary">
          → 위 판매처 시장가를 환율 적용하면 약 {formatKrw(data.convertedOriginToKrw.amount)}(참고용 환산값)
        </p>
      )}
      <MarketRow label="한국 판매가격" observation={data.krMarket} />

      {diffPercent !== null && (
        <p className="rounded bg-background px-2 py-1.5 text-[11px] text-text-secondary">
          브랜드 본국 원본가격 환산가보다 한국 판매가격이 약 {diffPercent > 0 ? "+" : ""}
          {diffPercent}% {diffPercent >= 0 ? "높습니다" : "낮습니다"}.
          <br />※ 현지 세금, 시장별 가격정책, 반올림, 배송비 등 정확한 원인은 원본 사이트의 가격정책을 확인해야
          합니다.
        </p>
      )}

      <button
        type="button"
        onClick={toggleExpand}
        className="text-[11px] font-medium text-text-secondary underline decoration-border hover:text-text-primary"
      >
        {showExpanded ? "국가별 가격 접기 ▲" : "국가별 가격 보기 ▼"}
      </button>

      {showExpanded && (
        <div className="rounded-md bg-background p-2">
          {expandLoading && <p className="text-[11px] text-text-tertiary">추가 market 조회 중...</p>}
          {!expandLoading && (
            <div className="space-y-1">
              {allMarkets.map((m) => (
                <MarketRow key={m.marketCode} label={m.country ? `${m.country} market` : m.currency} observation={m} />
              ))}
              <p className="pt-1 text-[10px] text-text-tertiary">
                실제로 조회에 성공한 market만 표시합니다(존재하지 않는 국가는 만들어내지 않습니다).
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
