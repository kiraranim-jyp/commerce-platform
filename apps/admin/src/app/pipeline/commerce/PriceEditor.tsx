"use client";

import { useEffect, useState } from "react";
import type { CanonicalProduct } from "@commerce/shared";
import { countryToFlagEmoji } from "@commerce/shared";
import {
  computePriceBreakdown,
  DEFAULT_PRICE_BREAKDOWN_INPUT,
  DEFAULT_PRICE_ROUNDING_UNIT,
  formatKrw,
  formatOriginalPrice,
} from "@commerce/pricing";
import type { PriceIntelligenceResult } from "@commerce/pricing";
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
 * N-3.10 Part D-H(CPO 지시) — "상단 요약 / 가격 설정 / 접힌 Breakdown" 3분할이
 * "중복 가격 UI"로 지적됐다. 이제 하나의 리스트로 합쳤고, 수수료/마진/배송비/
 * 원본가격을 고치면 Blur 없이 타이핑 즉시 권장 판매가격·수수료 금액·예상
 * 이익이 재계산된다(LiveNumberField — 입력 중에는 로컬 draft만 갱신해
 * 화면을 다시 그리고, 실제 저장은 여전히 blur 시점에만 일어난다).
 *
 * "자동 적용 금지"(CPO 지시, N-3.9/N-3.10 재확인) — 최종 판매가격은 이
 * 실시간 재계산과 별개다: 사용자가 "최종 판매가격" 입력칸을 직접 고치거나
 * "최종 판매가격에 적용" 버튼을 눌러야만 실제 등록에 쓰이는 값(priceOverrideKrw)이
 * 바뀐다 — 권장 판매가격이 바뀌어도 최종 판매가격을 조용히 덮어쓰지 않는다.
 */
const SELECTABLE_CURRENCIES = ["USD", "EUR", "JPY", "GBP", "SEK", "CNY", "HKD", "KRW"];

/** 타이핑 중에는 로컬 draft만 갱신(onLiveChange — 화면 재계산용, 저장 안 함),
 * blur에서만 실제 커밋(onCommit) — "입력 중 상태/확정값 분리"는 허용하되
 * "Tab을 눌러야만 적용되는 구조는 금지"라는 CPO 지시를 그대로 구현한다. */
function LiveNumberField({
  value,
  onLiveChange,
  onCommit,
  className,
  min = 0,
  max,
}: {
  value: number;
  onLiveChange: (n: number) => void;
  onCommit: (n: number) => void;
  className?: string;
  min?: number;
  max?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setDraft(String(value));
  }

  function clamp(n: number): number {
    let v = Number.isFinite(n) ? n : 0;
    v = Math.max(min, v);
    if (max != null) v = Math.min(max, v);
    return v;
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = Number(e.target.value);
        if (!Number.isNaN(n)) onLiveChange(clamp(n));
      }}
      onBlur={() => onCommit(clamp(Number(draft)))}
      className={className ?? "w-24 rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"}
    />
  );
}

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

  // N-3.10 Part D — "판매처 원본가격 참고" 카드를 별도 섹션으로 두지 않고
  // N-3.7 데이터(판매처 실제 등록 국가 기준 원본가격)를 이 Breakdown의
  // "원본 가격" 행에 참고 문구로 직접 편입한다(CPO 지시 — 가격 UI를 하나로
  // 합친다는 원칙과 동일선상). 국가별 다중 시장 비교(구 PriceIntelligencePanel의
  // "국가별 가격 보기")는 Part I-M 해외 가격비교 Beta가 이어받는다.
  const [sellerIntel, setSellerIntel] = useState<PriceIntelligenceResult | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/price-intelligence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceUrl: product.sourceUrl }),
    })
      .then((res) => res.json())
      .then((json: PriceIntelligenceResult) => {
        if (!cancelled) setSellerIntel(json);
      })
      .catch(() => {
        // 조회 실패해도 원본 가격 입력 자체는 그대로 쓸 수 있으므로 조용히 무시한다.
      });
    return () => {
      cancelled = true;
    };
  }, [product.sourceUrl]);

  // 이 상품에 아직 가격 설정이 저장돼 있지 않을 때만(product.priceBreakdown ==
  // null) Settings 기본 마진율을 1회 반영한다 — 이미 저장된 값(상품별 수정분
  // 포함)은 절대 덮어쓰지 않는다.
  useEffect(() => {
    if (product.priceBreakdown == null && sellerDefaults?.defaultMarginPercent != null) {
      onUpdatePriceBreakdown({ ...DEFAULT_PRICE_BREAKDOWN_INPUT, marginPercent: sellerDefaults.defaultMarginPercent });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerDefaults]);

  // 타이핑 중 즉시 재계산을 위한 로컬 draft — product.priceBreakdown/price가
  // 외부(탭 전환, Settings 기본값 반영)에서 바뀌면 다시 동기화한다.
  const [draftInput, setDraftInput] = useState(breakdownInput);
  const breakdownInputKey = `${breakdownInput.shippingKrw}|${breakdownInput.feePercent}|${breakdownInput.marginPercent}`;
  const [syncedInputKey, setSyncedInputKey] = useState(breakdownInputKey);
  if (breakdownInputKey !== syncedInputKey) {
    setSyncedInputKey(breakdownInputKey);
    setDraftInput(breakdownInput);
  }

  const [draftOriginalAmount, setDraftOriginalAmount] = useState(product.price.value.amount);
  const [syncedAmount, setSyncedAmount] = useState(product.price.value.amount);
  if (product.price.value.amount !== syncedAmount) {
    setSyncedAmount(product.price.value.amount);
    setDraftOriginalAmount(product.price.value.amount);
  }

  function liveUpdateBreakdown(patch: Partial<typeof breakdownInput>) {
    setDraftInput((prev) => ({ ...prev, ...patch }));
  }
  function commitBreakdown(patch: Partial<typeof breakdownInput>) {
    const next = { ...draftInput, ...patch };
    setDraftInput(next);
    onUpdatePriceBreakdown(next);
  }

  const liveRates = exchangeRates?.rates;
  const breakdown = computePriceBreakdown(
    { originalAmount: draftOriginalAmount, originalCurrency: product.price.value.currency, ...draftInput },
    liveRates,
    roundingUnit,
  );

  // 최종 판매가격 표시값 — 사용자가 아직 아무것도 커밋하지 않았으면(product.
  // priceOverrideKrw == null) 권장 판매가격을 그대로 미리 보여주기만 한다(자동
  // 커밋 아님, 입력칸을 고치거나 "적용" 버튼을 눌러야 실제로 저장된다). 위
  // 배송비/수수료/마진/원본가격이 실시간 재계산돼도 이 값은 그대로 유지된다
  // (자동 적용 금지) — 다만 아직 override가 없는 경우엔 권장가를 보여주는
  // 중이므로 그 미리보기 자체는 실시간으로 따라간다.
  const finalPriceKrw = product.priceOverrideKrw?.value ?? breakdown.suggestedPriceKrw;
  const feeAmountKrw = Math.round((finalPriceKrw * draftInput.feePercent) / 100);
  const netProfitKrw = finalPriceKrw - breakdown.landedCostKrw - feeAmountKrw;

  return (
    <section className="rounded-lg border border-border p-4 text-sm">
      <h3 className="text-base font-medium">가격 계산</h3>
      <p className="mt-0.5 text-[11px] text-text-tertiary">
        배송비/수수료/마진/원본가격을 고치면 아래 값이 즉시 다시 계산됩니다 — 실제 등록에 쓰이는 최종 판매가격은 직접 입력하거나
        &ldquo;적용&rdquo; 버튼을 눌러야만 바뀝니다.
      </p>

      <div className="mt-3 space-y-2.5 text-xs">
        <Row label="원본 가격">
          {onUpdateOriginalPrice ? (
            <div className="flex items-center gap-1.5">
              <LiveNumberField
                value={draftOriginalAmount}
                onLiveChange={setDraftOriginalAmount}
                onCommit={(n) => {
                  setDraftOriginalAmount(n);
                  onUpdateOriginalPrice({ amount: n });
                }}
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
            <span className="font-medium text-text-primary">
              {formatOriginalPrice(product.price.value.amount, product.price.value.currency)}
            </span>
          )}
        </Row>
        {sellerIntel?.status === "OK" && (
          <p className="-mt-1.5 pl-[calc(6rem+0.5rem)] text-[11px] text-text-tertiary">
            {sellerIntel.sellerOriginPrice ? (
              <>
                판매처 원본가격{sellerIntel.seller.name ? ` — ${sellerIntel.seller.name}` : ""}:{" "}
                {countryToFlagEmoji(sellerIntel.seller.country) ?? "🌐"}{" "}
                {formatOriginalPrice(sellerIntel.sellerOriginPrice.amount, sellerIntel.sellerOriginPrice.currency)}
                {sellerIntel.convertedSellerOriginToKrw && (
                  <> (약 {formatKrw(sellerIntel.convertedSellerOriginToKrw.amount)})</>
                )}
                {onUpdateOriginalPrice && (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateOriginalPrice({
                        amount: sellerIntel.sellerOriginPrice!.amount,
                        currency: sellerIntel.sellerOriginPrice!.currency,
                      })
                    }
                    className="ml-1.5 text-primary hover:underline"
                  >
                    이 값을 원본가격으로 적용
                  </button>
                )}
              </>
            ) : (
              <>
                ⚠{" "}
                {sellerIntel.seller.country
                  ? "판매처 원본가격을 확인하지 못했습니다."
                  : "편집샵 원본 국가를 확인할 수 없어 원본가격을 조회하지 못했습니다."}
              </>
            )}
          </p>
        )}

        <Row label="환율">
          <div className="flex items-center gap-2">
            <span className="font-medium text-text-primary">
              1 {breakdown.originalCurrency} = ₩{Math.round(breakdown.exchangeRate).toLocaleString("ko-KR")}
              {breakdown.isRateEstimate
                ? " (추정 고정환율)"
                : exchangeRates?.source === "frankfurter"
                  ? " (출처: ECB)"
                  : ""}
            </span>
            <button
              type="button"
              onClick={onRefreshExchangeRates}
              disabled={exchangeRatesLoading}
              className="text-[11px] text-primary hover:underline disabled:opacity-50"
            >
              {exchangeRatesLoading ? "불러오는 중…" : "새로고침"}
            </button>
          </div>
        </Row>

        <Row label="상품 원가">
          <span className="font-medium text-text-primary">{formatKrw(breakdown.costKrw)}</span>
        </Row>

        <Row label="예상 배송비">
          <div className="flex items-center gap-1">
            <span className="text-text-secondary">₩</span>
            <LiveNumberField
              value={draftInput.shippingKrw}
              onLiveChange={(n) => liveUpdateBreakdown({ shippingKrw: n })}
              onCommit={(n) => commitBreakdown({ shippingKrw: n })}
              className="w-24 rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </Row>

        <div className="flex items-center justify-between border-t border-border pt-2.5">
          <span className="font-medium text-text-primary">랜드드 코스트(원가+배송비)</span>
          <span className="font-medium text-text-primary">{formatKrw(breakdown.landedCostKrw)}</span>
        </div>

        <Row label="예상 수수료">
          <div className="flex items-center gap-1">
            <LiveNumberField
              value={draftInput.feePercent}
              max={99}
              onLiveChange={(n) => liveUpdateBreakdown({ feePercent: n })}
              onCommit={(n) => commitBreakdown({ feePercent: n })}
              className="w-14 rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
            />
            <span className="text-text-secondary">%</span>
          </div>
        </Row>

        <Row label="목표 마진">
          <div className="flex items-center gap-1">
            <LiveNumberField
              value={draftInput.marginPercent}
              max={99}
              onLiveChange={(n) => liveUpdateBreakdown({ marginPercent: n })}
              onCommit={(n) => commitBreakdown({ marginPercent: n })}
              className="w-14 rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
            />
            <span className="text-text-secondary">%</span>
            <span className="ml-1 text-[11px] text-text-tertiary">
              (판매가 기준 목표 이익률 — <a href="/settings" className="text-primary hover:underline">Settings에서 기본값 변경</a>)
            </span>
          </div>
        </Row>

        <div className="flex items-center justify-between border-t border-border pt-2.5">
          <span className="font-medium text-text-primary">권장 판매가격</span>
          <span className="text-base font-semibold text-text-primary">{formatKrw(breakdown.suggestedPriceKrw)}</span>
        </div>

        <Row label="최종 판매가격">
          <div className="flex items-center gap-2">
            <span className="text-text-secondary">₩</span>
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
        </Row>
        <p className="-mt-1.5 pl-[calc(6rem+0.5rem)] text-[11px] text-text-tertiary">
          {product.priceOverrideKrw
            ? "직접 저장된 값입니다 — 위 값을 고쳐도 자동으로 바뀌지 않습니다. 다시 계산하려면 버튼을 누르세요."
            : "아직 저장된 값이 없어 권장 판매가격을 보여주고 있습니다 — 입력하거나 버튼을 눌러야 저장됩니다."}
        </p>

        <Row label="예상 수수료 금액">
          <span className="font-medium text-text-primary">{formatKrw(feeAmountKrw)}</span>
        </Row>

        <div className="flex items-center justify-between border-t border-border pt-2.5">
          <span className="font-medium text-text-primary">예상 이익(최종 판매가격 기준)</span>
          <span className={`font-medium ${netProfitKrw >= 0 ? "text-success" : "text-error"}`}>
            {netProfitKrw >= 0 ? "+" : ""}
            {formatKrw(netProfitKrw)}
          </span>
        </div>

        <p className="pt-1 text-[11px] text-text-tertiary">
          배송비/수수료율/마진율은 실제 물류·정산 데이터가 없어 추정치입니다 — 위에서 직접 아는 값으로 고쳐서 다시 계산할 수
          있습니다.
        </p>
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="w-24 shrink-0 pt-1.5 text-text-secondary">{label}</span>
      <div className="min-w-0 flex-1 text-right">{children}</div>
    </div>
  );
}
