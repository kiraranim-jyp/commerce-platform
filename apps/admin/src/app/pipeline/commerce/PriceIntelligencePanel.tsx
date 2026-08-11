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
 *
 * Sprint N-3.7 — 원본가격 기준을 "브랜드 본국"에서 "판매처(편집샵) 원본 시장"
 * 으로 전면 전환(CPO 지시). seller.country가 null(=확인 불가, UNKNOWN)이면
 * sellerOriginPrice도 항상 null이다 — 브랜드 국가나 URL locale로 몰래
 * 대체하지 않는다(Part 11 원칙). 이 화면은 그 경우를 "가격을 몰랐다"가 아니라
 * "국가를 확인 못해서 원본가격을 조회하지 않았다"고 정직하게 표시한다.
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
  onApplySellerOriginPrice,
}: {
  product: CanonicalProduct;
  /** N-3.7 — Coupang PriceEditor의 "원본" 입력칸에 판매처 원본가격을 반영하고
   * 싶을 때만 넘긴다. 절대 자동으로(사용자 클릭 없이) 호출하지 않는다(CPO 지시
   * — "현재 URL의 가격을 몰래 원본가격으로 승격하지 않는다"는 원칙을 여기도
   * 그대로 적용한다). Naver Preview처럼 원본가격을 편집하는 필드 자체가 없으면
   * 넘기지 않는다. */
  onApplySellerOriginPrice?: (amount: number, currency: string) => void;
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
          body: JSON.stringify({ sourceUrl: product.sourceUrl }),
        });
        const json = (await res.json()) as PriceIntelligenceResult;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) {
          setData({
            status: "FETCH_FAILED",
            message: "가격 정보 조회 중 오류가 발생했습니다.",
            seller: { name: null, country: null, source: null },
            sellerOriginPrice: null,
            convertedSellerOriginToKrw: null,
            krMarket: null,
            additionalMarkets: [],
            testedMarketCodes: [],
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product.sourceUrl]);

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
      body: JSON.stringify({ sourceUrl: product.sourceUrl }),
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

  // N-3.7 Part 11 — 판매처 국가(seller.country)를 확인 못하면 sellerOriginPrice는
  // 항상 null이다(route.ts가 이미 그렇게 만든다). diff 계산도 sellerOriginPrice
  // 환산값 기준으로만 하고, 없으면 계산하지 않는다 — originMarket 같은 걸로
  // 몰래 대체하지 않는다.
  const diffPercent =
    data.krMarket && data.convertedSellerOriginToKrw
      ? Math.round(
          ((data.krMarket.amount - data.convertedSellerOriginToKrw.amount) / data.convertedSellerOriginToKrw.amount) *
            1000,
        ) / 10
      : null;

  const allMarkets = [data.sellerOriginPrice, data.krMarket, ...data.additionalMarkets].filter(
    (m): m is PriceObservation => m !== null,
  );

  const sellerCountryUnknown = !data.seller.country;

  return (
    <div className="space-y-2">
      {/* N-3.7 — 판매처(편집샵) 실제 등록 국가(/meta.json 실측)에서 확인한
          원본가격. 브랜드 본국이나 URL locale이 아니라 "이 상품을 실제로
          판매하는 사이트 자신의 기본 시장 가격"이 원본가격의 유일한 기준이다. */}
      {data.sellerOriginPrice ? (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-2">
          <p className="text-[11px] font-medium text-text-secondary">
            판매처 원본가격{data.seller.name ? ` — ${data.seller.name}` : ""}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-text-primary">
            {flagFor(data.seller.country)} {formatOriginalPrice(data.sellerOriginPrice.amount, data.sellerOriginPrice.currency)}
          </p>
          {data.convertedSellerOriginToKrw && (
            <p className="mt-0.5 text-[11px] text-text-tertiary">
              → 환율 적용 약 {formatKrw(data.convertedSellerOriginToKrw.amount)}
            </p>
          )}
          <p className="mt-1 text-[10px] text-text-tertiary">
            판매처({data.seller.country ?? "확인불가"}) 원본가격을 기준으로 환산한 참고가격입니다. 실제 판매가격은
            국가/시장별 가격정책에 따라 다를 수 있습니다.
          </p>
          {onApplySellerOriginPrice && (
            <button
              type="button"
              onClick={() =>
                onApplySellerOriginPrice(data.sellerOriginPrice!.amount, data.sellerOriginPrice!.currency)
              }
              className="mt-1.5 rounded border border-primary px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10"
            >
              이 값을 원본가격으로 적용
            </button>
          )}
        </div>
      ) : (
        <p className="rounded-md bg-background px-2 py-1.5 text-[11px] text-warning">
          ⚠{" "}
          {sellerCountryUnknown
            ? "편집샵 원본 국가를 확인할 수 없어 원본가격을 조회하지 못했습니다."
            : "판매처 원본가격을 확인하지 못했습니다."}
        </p>
      )}

      <MarketRow label="한국 판매가격" observation={data.krMarket} />

      {diffPercent !== null && (
        <p className="rounded bg-background px-2 py-1.5 text-[11px] text-text-secondary">
          판매처 원본가격 환산가보다 한국 판매가격이 약 {diffPercent > 0 ? "+" : ""}
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
