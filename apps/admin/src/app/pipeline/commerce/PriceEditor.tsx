"use client";

import { useEffect, useRef, useState } from "react";
import type { CanonicalProduct } from "@commerce/shared";
import {
  computeMarginPrice,
  computePriceBreakdown,
  DEFAULT_MARGIN_PERCENT,
  DEFAULT_PRICE_BREAKDOWN_INPUT,
  DEFAULT_PRICE_ROUNDING_UNIT,
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
 *
 * Sprint A-11(작업1 — CPO 지시: "판매가 = 환율변환가격 × (1+기본마진)") — 위
 * 상세 Breakdown과는 별개로, 화면 최상단에는 항상 "원가 → 환율 → 마진 → 최종
 * 판매가" 자동계산이 보인다. 마진율은 SellerProfile 기본값(Settings에서 설정)
 * 으로 시작하고, 사용자가 마진율을 고치면 판매가가 즉시 재계산된다 — 판매가
 * 입력칸을 직접 고치면 그 순간부터는(linkedRef=false) 마진 재계산이 판매가를
 * 덮어쓰지 않는다("자동계산 해제"). 최종값은 항상 SellerProfile의 반올림
 * 단위(기본 10원)로 맞춘다 — 쿠팡이 1원 단위 입력을 거부하기 때문이다(실제
 * LIVE 등록에서 확인된 제약).
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

  // Sprint A-11(작업1/2) — Settings의 "가격 정책"(기본 마진율/배송비 포함여부/
  // 반올림 단위)을 읽어온다. SellerProfileSummaryCard와 같은 이유로(CP001류
  // 중복 판정 방지) 여기서도 자체 fetch로만 읽고 수정은 Settings 한 곳에서만.
  const [sellerDefaults, setSellerDefaults] = useState<{
    defaultMarginPercent: number | null;
    includeShippingInPrice: boolean;
    priceRoundingUnit: number;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/coupang/profiles")
      .then((res) => res.json())
      .then(
        (data: {
          profiles?: Array<{
            isDefault: boolean;
            defaultMarginPercent: number | null;
            includeShippingInPrice: boolean;
            priceRoundingUnit: number;
          }>;
        }) => {
          if (cancelled) return;
          const list = data.profiles ?? [];
          const p = list.find((x) => x.isDefault) ?? list[0] ?? null;
          if (p) {
            setSellerDefaults({
              defaultMarginPercent: p.defaultMarginPercent,
              includeShippingInPrice: p.includeShippingInPrice,
              priceRoundingUnit: p.priceRoundingUnit,
            });
          }
        },
      )
      .catch(() => {
        // 조회 실패해도 아래에서 전역 기본값(22%, 10원)으로 폴백하므로 조용히 무시한다.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const roundingUnit = sellerDefaults?.priceRoundingUnit ?? DEFAULT_PRICE_ROUNDING_UNIT;
  const includeShipping = sellerDefaults?.includeShippingInPrice ?? false;

  const [marginPercent, setMarginPercent] = useState(DEFAULT_MARGIN_PERCENT);
  const marginTouchedRef = useRef(false);
  useEffect(() => {
    if (!marginTouchedRef.current && sellerDefaults?.defaultMarginPercent != null) {
      setMarginPercent(sellerDefaults.defaultMarginPercent);
    }
  }, [sellerDefaults]);

  const costBasis = includeShipping ? breakdown.costKrw + breakdownInput.shippingKrw : breakdown.costKrw;
  const autoPriceKrw = computeMarginPrice(costBasis, marginPercent, roundingUnit);

  // linked=true인 동안은 마진/환율/반올림 단위가 바뀔 때마다 판매가를 자동
  // 재계산해서 priceOverrideKrw에 그대로 반영한다(등록 Payload가 읽는 값은
  // 항상 priceOverrideKrw 하나뿐이므로 — CP001류 이중 판정 방지). 판매가
  // 입력칸을 사용자가 직접 고치면 linked를 끊어 더 이상 덮어쓰지 않는다.
  // (useState로 관리 — ref는 렌더 중 읽을 수 없어 "자동계산으로 되돌리기"
  // 버튼의 조건부 렌더링에 못 쓴다.)
  const [isLinked, setIsLinked] = useState(true);
  useEffect(() => {
    if (isLinked && product.priceOverrideKrw?.value !== autoPriceKrw) {
      onUpdateSalePriceKrw(autoPriceKrw);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPriceKrw, isLinked]);

  const salePriceKrw = product.priceOverrideKrw?.value ?? autoPriceKrw;
  const roughMargin = salePriceKrw - breakdown.costKrw;

  function commitBreakdown(patch: Partial<typeof breakdownInput>) {
    onUpdatePriceBreakdown({ ...breakdownInput, ...patch });
  }

  return (
    <section className="rounded-lg border border-border p-4 text-sm">
      <h3 className="text-base font-medium">판매가격</h3>

      {/* Sprint A-10(작업4 — CEO 지시: "가격 계산 과정이 한눈에 보여야 한다,
          보는 위치가 너무 깊다") — A-9까지는 환율/자동계산이 "환율" 한 항목 안에
          문단으로 뭉쳐 있었다. 원본/실시간 환율/자동 계산/판매가를 각각 독립된
          행으로 분리해서 Breakdown을 펼치지 않아도 4줄만 보면 계산 과정 전체가
          보이게 한다. */}
      <div className="mt-3 space-y-2.5">
        <div>
          <p className="text-xs text-text-secondary">원본</p>
          <p className="mt-0.5 text-sm font-medium text-text-primary">
            {formatOriginalPrice(product.price.value.amount, product.price.value.currency)}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-secondary">실시간 환율</p>
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
            1 {product.price.value.currency} = {Math.round(breakdown.exchangeRate).toLocaleString("ko-KR")}원
            {breakdown.isRateEstimate
              ? " (추정 고정환율)"
              : exchangeRates?.source === "frankfurter"
                ? " (출처: ECB)"
                : ""}
          </p>
          {exchangeRates && !breakdown.isRateEstimate && (
            <p className="mt-0.5 text-[11px] text-text-tertiary">
              {new Date(exchangeRates.fetchedAt).toLocaleString("ko-KR")} 기준
            </p>
          )}
        </div>

        <div>
          <p className="text-xs text-text-secondary">환율 적용 가격</p>
          <p className="mt-0.5 text-sm font-medium text-text-primary">≈ {formatKrw(breakdown.costKrw)}</p>
          <p className="mt-0.5 text-[11px] text-text-tertiary">
            {product.price.value.amount} {product.price.value.currency} × {breakdown.exchangeRate.toFixed(2)}
            {includeShipping ? ` + 배송비 ${formatKrw(breakdownInput.shippingKrw)}` : ""}
          </p>
        </div>

        <div>
          <p className="text-xs text-text-secondary">마진</p>
          <div className="mt-0.5 flex items-center gap-1">
            <EditableText
              value={String(marginPercent)}
              onCommit={(v) => {
                marginTouchedRef.current = true;
                setMarginPercent(Math.max(0, Number(v) || 0));
              }}
              className="w-14 rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
            />
            <span className="text-sm text-text-secondary">%</span>
            <span className="ml-1 text-[11px] text-text-tertiary">
              (설정의 기본 마진율 — <a href="/settings" className="text-primary hover:underline">Settings에서 변경</a>)
            </span>
          </div>
        </div>

        <div className="border-t border-border pt-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-text-secondary">최종 판매가</label>
            {!isLinked && (
              <button
                type="button"
                onClick={() => {
                  setIsLinked(true);
                  onUpdateSalePriceKrw(autoPriceKrw);
                }}
                className="text-[11px] text-primary hover:underline"
              >
                자동계산으로 되돌리기
              </button>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-sm text-text-secondary">₩</span>
            <EditableText
              value={String(salePriceKrw)}
              onCommit={(v) => {
                setIsLinked(false);
                onUpdateSalePriceKrw(Number(v) || 0);
              }}
              className="w-32 rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
            />
            <span className="text-xs text-text-secondary">{formatKrw(salePriceKrw)}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-text-tertiary">
            {isLinked
              ? `환율 적용 가격 × (1+${marginPercent}%), ${roundingUnit}원 단위로 반올림 — 마진을 고치면 자동으로 다시 계산됩니다`
              : "직접 입력한 값입니다 — 마진을 고쳐도 이 값은 바뀌지 않습니다"}
          </p>
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
