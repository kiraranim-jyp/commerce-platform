"use client";

import { useEffect, useState } from "react";
import type { CanonicalProduct } from "@commerce/shared";
import {
  computePriceBreakdown,
  DEFAULT_PRICE_BREAKDOWN_INPUT,
  DEFAULT_PRICE_ROUNDING_UNIT,
  formatKrw,
  formatOriginalPrice,
} from "@commerce/pricing";
import { EditableText } from "./EditableField";

/**
 * Sprint N-3.8/N-3.9(가격 계산 모델 통일 — CPO 지시) — 예전에는 화면 상단
 * 요약("최종 판매가")과 아래 "가격 계산 Breakdown"이 서로 다른 공식을 썼다
 * (요약은 마크업 cost×(1+마진%), Breakdown은 마진율 역산 landedCost/(1-fee%-
 * margin%)) — 같은 "마진 20%" 라벨인데 숫자가 달라지는 버그였다. 이제는
 * computePriceBreakdown() 하나만 화면 전체에서 쓰고, Naver/Coupang도 이
 * 컴포넌트를 그대로 재사용한다(NaverPayloadPreview.tsx도 이 컴포넌트를
 * import — Commerce별로 다른 가격 컴포넌트를 만들지 않는다).
 *
 * "자동 적용 금지"(CPO 지시) — 예전에는 마진/환율이 바뀔 때마다 useEffect가
 * 조용히 product.priceOverrideKrw를 덮어썼다. 이제는 사용자가 "최종
 * 판매가격" 입력칸을 직접 고치거나 "최종 판매가격에 적용" 버튼을 눌러야만
 * 실제 등록에 쓰이는 값이 바뀐다 — 권장 판매가격은 항상 최신 계산값을
 * 보여주기만 하고, 아무것도 자동으로 쓰지 않는다(coupang.adapter.ts가
 * priceOverrideKrw==null일 때 이미 자체 환율 추정치로 안전하게 폴백하므로,
 * 초기 부트스트랩도 필요 없다).
 */
const SELECTABLE_CURRENCIES = ["USD", "EUR", "JPY", "GBP", "SEK", "CNY", "HKD", "KRW"];

export function PriceEditor({
  product,
  onUpdateSalePriceKrw,
  onUpdateOriginalPrice,
  onUpdatePriceBreakdown,
  exchangeRates,
  exchangeRatesLoading,
  onRefreshExchangeRates,
}: {
  product: CanonicalProduct;
  onUpdateSalePriceKrw: (amountKrw: number) => void;
  onUpdateOriginalPrice?: (patch: Partial<{ amount: number; currency: string }>) => void;
  onUpdatePriceBreakdown: (breakdown: { shippingKrw: number; feePercent: number; marginPercent: number }) => void;
  exchangeRates: { rates: Record<string, number>; fetchedAt: string; source: "frankfurter" | "fallback" } | null;
  exchangeRatesLoading: boolean;
  onRefreshExchangeRates: () => void;
}) {
  const breakdownInput = product.priceBreakdown ?? DEFAULT_PRICE_BREAKDOWN_INPUT;

  // Sprint A-11/N-3.9(Part I) — Settings의 "가격 정책"(기본 마진율/반올림
  // 단위)을 초기값으로만 쓴다. 상품별로 사용자가 breakdownInput.marginPercent를
  // 고치면 이 상품의 priceBreakdown에만 저장되고 Settings 기본값 자체는
  // 바뀌지 않는다(다른 상품에 영향 없음).
  const [sellerDefaults, setSellerDefaults] = useState<{
    defaultMarginPercent: number | null;
    priceRoundingUnit: number;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/coupang/profiles")
      .then((res) => res.json())
      .then(
        (data: {
          profiles?: Array<{ isDefault: boolean; defaultMarginPercent: number | null; priceRoundingUnit: number }>;
        }) => {
          if (cancelled) return;
          const list = data.profiles ?? [];
          const p = list.find((x) => x.isDefault) ?? list[0] ?? null;
          if (p) setSellerDefaults({ defaultMarginPercent: p.defaultMarginPercent, priceRoundingUnit: p.priceRoundingUnit });
        },
      )
      .catch(() => {
        // 조회 실패해도 아래에서 packages/pricing의 전역 기본값으로 폴백하므로 조용히 무시한다.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const roundingUnit = sellerDefaults?.priceRoundingUnit ?? DEFAULT_PRICE_ROUNDING_UNIT;

  // 이 상품에 아직 가격 설정이 저장돼 있지 않을 때만(product.priceBreakdown ==
  // null) Settings 기본 마진율을 1회 반영한다 — 이미 저장된 값(상품별 수정분
  // 포함)은 절대 덮어쓰지 않는다.
  useEffect(() => {
    if (product.priceBreakdown == null && sellerDefaults?.defaultMarginPercent != null) {
      onUpdatePriceBreakdown({ ...DEFAULT_PRICE_BREAKDOWN_INPUT, marginPercent: sellerDefaults.defaultMarginPercent });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerDefaults]);

  const liveRates = exchangeRates?.rates;
  const breakdown = computePriceBreakdown(
    { originalAmount: product.price.value.amount, originalCurrency: product.price.value.currency, ...breakdownInput },
    liveRates,
    roundingUnit,
  );

  function commitBreakdown(patch: Partial<typeof breakdownInput>) {
    onUpdatePriceBreakdown({ ...breakdownInput, ...patch });
  }

  // 최종 판매가격 표시값 — 사용자가 아직 아무것도 커밋하지 않았으면(product.
  // priceOverrideKrw == null) 권장 판매가격을 그대로 미리 보여주기만 한다(자동
  // 커밋 아님, 입력칸을 고치거나 "적용" 버튼을 눌러야 실제로 저장된다).
  const finalPriceKrw = product.priceOverrideKrw?.value ?? breakdown.suggestedPriceKrw;
  const feeAmountKrw = Math.round((finalPriceKrw * breakdownInput.feePercent) / 100);
  const netProfitKrw = finalPriceKrw - breakdown.landedCostKrw - feeAmountKrw;

  return (
    <section className="rounded-lg border border-border p-4 text-sm">
      <h3 className="text-base font-medium">판매가격</h3>

      {/* PART C — 결과 중심 상단: 권장 판매가격 + 직접 수정 가능한 최종
          판매가격 + 명시적 적용 버튼(자동 적용 없음). */}
      <div className="mt-3 rounded-md bg-background p-3">
        <p className="text-xs text-text-secondary">권장 판매가격</p>
        <p className="mt-0.5 text-lg font-semibold text-text-primary">{formatKrw(breakdown.suggestedPriceKrw)}</p>

        <div className="mt-2.5 border-t border-border pt-2.5">
          <label className="text-xs text-text-secondary">최종 판매가격</label>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-sm text-text-secondary">₩</span>
            <EditableText
              value={String(finalPriceKrw)}
              onCommit={(v) => onUpdateSalePriceKrw(Math.max(0, Number(v) || 0))}
              className="w-32 rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={() => onUpdateSalePriceKrw(breakdown.suggestedPriceKrw)}
              className="rounded border border-primary px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
            >
              최종 판매가격에 적용
            </button>
          </div>
          <p className="mt-0.5 text-[11px] text-text-tertiary">
            {product.priceOverrideKrw
              ? "직접 저장된 값입니다 — 아래 가격 설정을 고쳐도 자동으로 바뀌지 않습니다. 다시 계산하려면 버튼을 누르세요."
              : "아직 저장된 값이 없어 권장 판매가격을 보여주고 있습니다 — 입력하거나 버튼을 눌러야 저장됩니다."}
          </p>
        </div>
      </div>

      {/* PART C ② 가격 설정 — 수수료/마진을 고치면 위 권장 판매가격이 즉시
          재계산된다(단, 최종 판매가격은 자동으로 바뀌지 않는다). */}
      <div className="mt-3 space-y-2.5">
        <div>
          <p className="text-xs text-text-secondary">원본 가격</p>
          {onUpdateOriginalPrice ? (
            <div className="mt-0.5 flex items-center gap-1.5">
              <EditableText
                value={String(product.price.value.amount)}
                onCommit={(v) => onUpdateOriginalPrice({ amount: Math.max(0, Number(v) || 0) })}
                className="w-24 rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
              />
              <select
                value={product.price.value.currency}
                onChange={(e) => onUpdateOriginalPrice({ currency: e.target.value })}
                className="rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
              >
                {SELECTABLE_CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="mt-0.5 text-sm font-medium text-text-primary">
              {formatOriginalPrice(product.price.value.amount, product.price.value.currency)}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-secondary">환율 적용</p>
            <button
              type="button"
              onClick={onRefreshExchangeRates}
              disabled={exchangeRatesLoading}
              className="text-[11px] text-primary hover:underline disabled:opacity-50"
            >
              {exchangeRatesLoading ? "불러오는 중…" : "새로고침"}
            </button>
          </div>
          <p className="mt-0.5 text-sm font-medium text-text-primary">
            1 {breakdown.originalCurrency} = ₩{Math.round(breakdown.exchangeRate).toLocaleString("ko-KR")}
            {breakdown.isRateEstimate
              ? " (추정 고정환율)"
              : exchangeRates?.source === "frankfurter"
                ? " (출처: ECB)"
                : ""}
          </p>
          <p className="mt-0.5 text-[11px] text-text-tertiary">→ 상품 원가 {formatKrw(breakdown.costKrw)}</p>
        </div>

        <div>
          <p className="text-xs text-text-secondary">예상 배송비</p>
          <div className="mt-0.5 flex items-center gap-1">
            <span className="text-sm text-text-secondary">₩</span>
            <EditableText
              value={String(breakdownInput.shippingKrw)}
              onCommit={(v) => commitBreakdown({ shippingKrw: Math.max(0, Number(v) || 0) })}
              className="w-24 rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div>
          <p className="text-xs text-text-secondary">랜드드 코스트(원가+배송비)</p>
          <p className="mt-0.5 text-sm font-medium text-text-primary">{formatKrw(breakdown.landedCostKrw)}</p>
        </div>

        <div>
          <p className="text-xs text-text-secondary">수수료</p>
          <div className="mt-0.5 flex items-center gap-1">
            <EditableText
              value={String(breakdownInput.feePercent)}
              onCommit={(v) => commitBreakdown({ feePercent: Math.min(99, Math.max(0, Number(v) || 0)) })}
              className="w-14 rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
            />
            <span className="text-sm text-text-secondary">%</span>
          </div>
        </div>

        <div>
          <p className="text-xs text-text-secondary">목표 마진</p>
          <div className="mt-0.5 flex items-center gap-1">
            <EditableText
              value={String(breakdownInput.marginPercent)}
              onCommit={(v) => commitBreakdown({ marginPercent: Math.min(99, Math.max(0, Number(v) || 0)) })}
              className="w-14 rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
            />
            <span className="text-sm text-text-secondary">%</span>
            <span className="ml-1 text-[11px] text-text-tertiary">
              (판매가 기준 목표 이익률 — <a href="/settings" className="text-primary hover:underline">Settings에서 기본값 변경</a>)
            </span>
          </div>
        </div>
      </div>

      {/* PART D — 기본적으로 접혀 있는 Breakdown. 위와 같은 계산 결과를
          "왜 이 금액인지"로 다시 보여준다(편집은 위에서만, 여기는 읽기전용). */}
      <details className="mt-4 border-t border-border pt-3">
        <summary className="cursor-pointer text-xs font-medium text-text-secondary hover:text-text-primary">
          가격 계산 Breakdown
        </summary>
        <div className="mt-3 space-y-2 text-xs">
          <BreakdownRow label="원본 가격">
            {formatOriginalPrice(breakdown.originalAmount, breakdown.originalCurrency)}
          </BreakdownRow>
          <BreakdownRow label="환율">
            1 {breakdown.originalCurrency} = ₩{breakdown.exchangeRate.toFixed(2)}
            {breakdown.isRateEstimate ? " (추정 고정환율)" : ""}
          </BreakdownRow>
          <BreakdownRow label="상품 원가">{formatKrw(breakdown.costKrw)}</BreakdownRow>
          <BreakdownRow label="예상 배송비">{formatKrw(breakdownInput.shippingKrw)}</BreakdownRow>
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="font-medium text-text-primary">랜드드 코스트</span>
            <span className="font-medium text-text-primary">{formatKrw(breakdown.landedCostKrw)}</span>
          </div>
          <BreakdownRow label="예상 수수료">{breakdownInput.feePercent}%</BreakdownRow>
          <BreakdownRow label="목표 마진">{breakdownInput.marginPercent}%</BreakdownRow>
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="font-medium text-text-primary">권장 판매가격</span>
            <span className="font-medium text-text-primary">{formatKrw(breakdown.suggestedPriceKrw)}</span>
          </div>
          <BreakdownRow label="예상 수수료 금액">{formatKrw(feeAmountKrw)}</BreakdownRow>
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="font-medium text-text-primary">예상 이익(최종 판매가격 기준)</span>
            <span className={`font-medium ${netProfitKrw >= 0 ? "text-success" : "text-error"}`}>
              {netProfitKrw >= 0 ? "+" : ""}
              {formatKrw(netProfitKrw)}
            </span>
          </div>
          <p className="pt-1 text-[11px] text-text-tertiary">
            배송비/수수료율/마진율은 실제 물류·정산 데이터가 없어 추정치입니다 — 위 &ldquo;가격 설정&rdquo;에서 직접 아는 값으로
            고쳐서 다시 계산할 수 있습니다.
          </p>
        </div>
      </details>
    </section>
  );
}

function BreakdownRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-secondary">{label}</span>
      <span className="text-text-primary">{children}</span>
    </div>
  );
}
