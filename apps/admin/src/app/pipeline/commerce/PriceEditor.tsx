"use client";

import type { CanonicalProduct } from "@commerce/shared";
import {
  computePriceBreakdown,
  DEFAULT_PRICE_BREAKDOWN_INPUT,
  formatKrw,
  formatOriginalPrice,
} from "@commerce/pricing";
import { EditableText } from "./EditableField";

/**
 * P0-1(가격 계산 투명화) — "원가 → 최종 판매가"만 보여주던 걸 원본가격→환율→
 * 상품원가→배송비→수수료→마진→제안가 단계별로 전부 노출한다(CPO가 실측에서
 * "가격 계산 과정이 전혀 안 보인다"고 지적한 문제). 계산기(배송비/수수료율/
 * 마진율)와 실제 등록에 쓰이는 "판매가격"은 분리돼 있다 — "적용" 버튼을 눌러야만
 * 제안가가 판매가격에 반영된다. "원본 가격"(product.price)은 절대 건드리지
 * 않는다.
 */
export function PriceEditor({
  product,
  onUpdateSalePriceKrw,
  onUpdatePriceBreakdown,
  exchangeRates,
  exchangeRatesLoading,
  onRefreshExchangeRates,
}: {
  product: CanonicalProduct;
  onUpdateSalePriceKrw: (amountKrw: number) => void;
  onUpdatePriceBreakdown: (breakdown: { shippingKrw: number; feePercent: number; marginPercent: number }) => void;
  exchangeRates: { rates: Record<string, number>; fetchedAt: string; source: "frankfurter" | "fallback" } | null;
  exchangeRatesLoading: boolean;
  onRefreshExchangeRates: () => void;
}) {
  const breakdownInput = product.priceBreakdown ?? DEFAULT_PRICE_BREAKDOWN_INPUT;
  const liveRates = exchangeRates?.rates;
  const breakdown = computePriceBreakdown(
    {
      originalAmount: product.price.value.amount,
      originalCurrency: product.price.value.currency,
      ...breakdownInput,
    },
    liveRates,
  );
  const salePriceKrw = product.priceOverrideKrw?.value ?? breakdown.costKrw;
  const roughMargin = salePriceKrw - breakdown.costKrw;

  function commitBreakdown(patch: Partial<typeof breakdownInput>) {
    onUpdatePriceBreakdown({ ...breakdownInput, ...patch });
  }

  return (
    <section className="rounded-lg border border-border p-4 text-sm">
      <h3 className="text-base font-medium">판매가격</h3>

      <div className="mt-3 space-y-2.5">
        <div>
          <p className="text-xs text-text-secondary">원본 가격</p>
          <p className="mt-0.5 text-sm font-medium text-text-primary">
            {formatOriginalPrice(product.price.value.amount, product.price.value.currency)}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-secondary">
              환율 · {product.price.value.currency} {breakdown.exchangeRate.toFixed(2)}
              {breakdown.isRateEstimate ? " (추정 고정환율)" : ""}
            </p>
            <button
              type="button"
              onClick={onRefreshExchangeRates}
              disabled={exchangeRatesLoading}
              className="text-[11px] text-primary hover:underline disabled:opacity-50"
            >
              {exchangeRatesLoading ? "불러오는 중…" : "새로고침"}
            </button>
          </div>
          {exchangeRates && !breakdown.isRateEstimate && (
            <p className="mt-0.5 text-[11px] text-text-tertiary">
              {new Date(exchangeRates.fetchedAt).toLocaleString("ko-KR")} 기준
            </p>
          )}
          <p className="mt-0.5 text-sm text-text-secondary">
            {product.price.value.amount} {product.price.value.currency} × {breakdown.exchangeRate.toFixed(2)} ={" "}
            {formatKrw(breakdown.costKrw)}
          </p>
        </div>

        <div className="border-t border-border pt-2.5">
          <label className="text-xs text-text-secondary">판매가격</label>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-sm text-text-secondary">₩</span>
            <EditableText
              value={String(salePriceKrw)}
              onCommit={(v) => onUpdateSalePriceKrw(Number(v) || 0)}
              className="w-32 rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
            />
            <span className="text-xs text-text-secondary">{formatKrw(salePriceKrw)}</span>
          </div>
        </div>

        <div>
          <p className="text-xs text-text-secondary">예상 마진(참고용 — 배송비/관세/수수료 미반영)</p>
          <p className={`mt-0.5 text-sm font-medium ${roughMargin >= 0 ? "text-success" : "text-error"}`}>
            {roughMargin >= 0 ? "+" : ""}
            {formatKrw(roughMargin)}
          </p>
        </div>
      </div>

      <details className="mt-4 border-t border-border pt-3">
        <summary className="cursor-pointer text-xs font-medium text-text-secondary hover:text-text-primary">
          가격 계산 Breakdown — 왜 이 금액인지 보기
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
          <BreakdownRow label="예상 국제배송비">
            <EditableAmount
              valueKrw={breakdownInput.shippingKrw}
              onCommit={(v) => commitBreakdown({ shippingKrw: v })}
            />
          </BreakdownRow>
          <BreakdownRow label="랜디드 원가(원가+배송비)">{formatKrw(breakdown.landedCostKrw)}</BreakdownRow>
          <BreakdownRow label="예상 수수료">
            <EditablePercent
              valuePercent={breakdownInput.feePercent}
              onCommit={(v) => commitBreakdown({ feePercent: v })}
            />
          </BreakdownRow>
          <BreakdownRow label="목표 마진">
            <EditablePercent
              valuePercent={breakdownInput.marginPercent}
              onCommit={(v) => commitBreakdown({ marginPercent: v })}
            />
          </BreakdownRow>
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="font-medium text-text-primary">제안 판매가</span>
            <span className="flex items-center gap-2">
              <span className="font-medium text-text-primary">{formatKrw(breakdown.suggestedPriceKrw)}</span>
              <button
                type="button"
                onClick={() => onUpdateSalePriceKrw(breakdown.suggestedPriceKrw)}
                className="rounded border border-primary px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10"
              >
                판매가격에 적용
              </button>
            </span>
          </div>
          <p className="pt-1 text-[11px] text-text-tertiary">
            배송비/수수료율/마진율은 실제 물류·정산 데이터가 없어 추정치입니다 — 직접 아는 값으로 고쳐서 다시 계산할 수
            있습니다.
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

function EditableAmount({ valueKrw, onCommit }: { valueKrw: number; onCommit: (v: number) => void }) {
  return (
    <span className="inline-flex items-center gap-1">
      ₩
      <EditableText
        value={String(valueKrw)}
        onCommit={(v) => onCommit(Math.max(0, Number(v) || 0))}
        className="w-20 rounded border border-border px-1 py-0.5 text-right text-xs focus:border-primary focus:outline-none"
      />
    </span>
  );
}

function EditablePercent({ valuePercent, onCommit }: { valuePercent: number; onCommit: (v: number) => void }) {
  return (
    <span className="inline-flex items-center gap-1">
      <EditableText
        value={String(valuePercent)}
        onCommit={(v) => onCommit(Math.min(99, Math.max(0, Number(v) || 0)))}
        className="w-12 rounded border border-border px-1 py-0.5 text-right text-xs focus:border-primary focus:outline-none"
      />
      %
    </span>
  );
}
