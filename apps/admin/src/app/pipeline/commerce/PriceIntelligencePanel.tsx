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

export function PriceIntelligencePanel({ product }: { product: CanonicalProduct }) {
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
          body: JSON.stringify({ sourceUrl: product.sourceUrl, brand: product.brand?.value }),
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
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product.sourceUrl, product.brand?.value]);

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

  const diffPercent =
    data.originMarket && data.krMarket && data.convertedOriginToKrw
      ? Math.round(((data.krMarket.amount - data.convertedOriginToKrw.amount) / data.convertedOriginToKrw.amount) * 1000) / 10
      : null;

  const allMarkets = [data.originMarket, data.krMarket, ...data.additionalMarkets].filter(
    (m): m is PriceObservation => m !== null,
  );

  return (
    <div className="space-y-2">
      <MarketRow
        label={data.originMarketIsBrandCountryMarket ? "브랜드 본국 시장" : "원본 시장(사이트 기본)"}
        observation={data.originMarket}
      />
      <MarketRow label="한국 판매가격" observation={data.krMarket} />

      {data.convertedOriginToKrw && (
        <p className="text-[11px] text-text-tertiary">
          ≈ {formatKrw(data.convertedOriginToKrw.amount)} <span>단순 환율 환산값(실제 판매가격 아님)</span>
        </p>
      )}

      {diffPercent !== null && (
        <p className="rounded bg-background px-2 py-1.5 text-[11px] text-text-secondary">
          환율 환산가보다 한국 판매가격이 약 {diffPercent > 0 ? "+" : ""}
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
