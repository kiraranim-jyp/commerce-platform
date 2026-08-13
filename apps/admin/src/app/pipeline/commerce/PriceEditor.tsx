"use client";

import { useEffect, useState } from "react";
import type { CanonicalProduct } from "@commerce/shared";
import { countryToFlagEmoji } from "@commerce/shared";
import {
  computePriceBreakdown,
  convertToKrw,
  DEFAULT_PRICE_BREAKDOWN_INPUT,
  DEFAULT_PRICE_ROUNDING_UNIT,
  FIXED_RATES_TO_KRW,
  formatKrw,
  formatOriginalPrice,
} from "@commerce/pricing";
import type { PriceIntelligenceResult } from "@commerce/pricing";
import { EditableText } from "./EditableField";
import { ValueBadge } from "@/components/ui/ValueBadge";

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
  open,
  onUpdateSalePriceKrw,
  onUpdateOriginalPrice,
  onUpdatePriceBreakdown,
  exchangeRates,
  exchangeRatesLoading,
  onRefreshExchangeRates,
}: {
  product: CanonicalProduct;
  /** N-3.16 잔여3(CPO 지시: "가격 계산 Breakdown은 기본 접힘, 최종 판매가가
   * 가장 강하게 보여야 함") — 바깥 "가격" Accordion의 펼침 상태를 그대로
   * 받는다. 이 컴포넌트는 항상 마운트되어 있고(계산은 한 곳에서만 일어남),
   * open=false면 요약 한 줄만, open=true면 편집 UI 전체를 그린다 — 접혀
   * 있을 때 보이는 숫자와 펼쳤을 때 보이는 숫자가 서로 다른 계산에서 나올
   * 위험이 없다. */
  open: boolean;
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

  // N-3.13 Part H(CPO 지시) — "원본 사이트가 실제 제공하는 국가별 가격"과
  // "CartPilot이 환산한 가격"을 절대 섞지 않는다. 기본 조회(위 useEffect)는
  // 비용 때문에 origin+KR 2곳만 가져온다 — 나머지 후보 시장(US/GB/FR/DE/JP/
  // AU/CA)은 사용자가 버튼을 눌렀을 때만 추가로 조회한다(N-3.2 원래 설계
  // "국가별 가격 전체 조회는 펼쳤을 때만"을 그대로 따른다 — 자동 전체조회
  // 안 함). 이미 결과가 있으면 다시 조회하지 않는다(중복 호출 방지).
  const [expandedIntel, setExpandedIntel] = useState<PriceIntelligenceResult | null>(null);
  const [expandLoading, setExpandLoading] = useState(false);
  function loadExpandedMarkets() {
    if (expandedIntel || expandLoading) return;
    setExpandLoading(true);
    fetch("/api/price-intelligence?expand=true", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceUrl: product.sourceUrl }),
    })
      .then((res) => res.json())
      .then((json: PriceIntelligenceResult) => setExpandedIntel(json))
      .catch(() => {
        // 조회 실패해도 기존 원본가격 표시는 그대로 유지 — 조용히 무시.
      })
      .finally(() => setExpandLoading(false));
  }

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

  // N-3.17(CPO 지시: "27.200000 문제 — UI에서 덮지 말고 데이터 계층부터") —
  // 크롤링 시점 반올림(product-data-extractor.ts의 roundPriceAmount)은 새로
  // 추출하는 상품에만 적용된다. 이미 저장된 스냅샷 중에는 수정 전 크롤러가
  // 만든 부동소수점 잔여 오차(예: 27.200000000000003)가 남아있을 수 있어,
  // 이 화면에서 편집 가능한 원본값으로 읽어들일 때도 한 번 더 정리한다 —
  // product.price.value.amount 자체를 고치는 게 아니라(원본 데이터 변형
  // 금지), "사용자가 직접 고치지 않는 한" 표시/편집에 쓰는 로컬 값만 정리한다.
  const cleanOriginalAmount = Math.round(product.price.value.amount * 100) / 100;
  const [draftOriginalAmount, setDraftOriginalAmount] = useState(cleanOriginalAmount);
  const [syncedAmount, setSyncedAmount] = useState(cleanOriginalAmount);
  if (cleanOriginalAmount !== syncedAmount) {
    setSyncedAmount(cleanOriginalAmount);
    setDraftOriginalAmount(cleanOriginalAmount);
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

  const [detailOpen, setDetailOpen] = useState(false);

  // N-3.16 잔여3 — 바깥 "가격" Accordion이 접혀 있을 때는 배송비/수수료/마진
  // 편집 UI 전체를 그리지 않고, 지금 등록에 쓰일 숫자만 한눈에 보여준다.
  // finalPriceKrw/breakdown은 위에서 이미 계산이 끝난 값이라 펼쳤을 때와
  // 다른 숫자가 나올 수 없다.
  if (!open) {
    return <PriceSummaryStrip product={product} breakdown={breakdown} finalPriceKrw={finalPriceKrw} />;
  }

  return (
    <section className="rounded-lg border border-border p-4 text-sm">
      <h3 className="text-base font-medium">가격 계산</h3>
      <p className="mt-0.5 text-[11px] text-text-tertiary">
        배송비/수수료/마진/원본가격을 고치면 아래 값이 즉시 다시 계산됩니다 — 실제 등록에 쓰이는 최종 판매가격은 직접 입력하거나
        &ldquo;적용&rdquo; 버튼을 눌러야만 바뀝니다.
      </p>

      <div className="mt-3">
        <PriceSummaryStrip product={product} breakdown={breakdown} finalPriceKrw={finalPriceKrw} />
      </div>

      {/* N-3.16 잔여3(CPO 지시: "최종 판매가가 가장 강하게 보여야 함") — 편집
          컨트롤 중 최종 판매가격만 Breakdown 상세 밖으로 꺼내 가장 먼저,
          가장 크게 보여준다. */}
      <div className="mt-3 rounded-md border border-border bg-background p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
            최종 판매가격
            {product.priceOverrideKrw && <ValueBadge kind="userConfirmed" />}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-text-secondary">₩</span>
            <EditableText
              value={String(finalPriceKrw)}
              onCommit={(v) => onUpdateSalePriceKrw(Math.max(0, Number(v) || 0))}
              className="w-32 rounded border border-border px-2 py-1 text-base font-semibold focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={() => onUpdateSalePriceKrw(breakdown.suggestedPriceKrw)}
              className="rounded border border-primary px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
            >
              최종 판매가격에 적용
            </button>
          </div>
        </div>
        <p className="mt-1 text-[11px] text-text-tertiary">
          {product.priceOverrideKrw
            ? "직접 저장된 값입니다 — 아래 계산 값을 고쳐도 자동으로 바뀌지 않습니다. 다시 계산하려면 버튼을 누르세요."
            : "아직 저장된 값이 없어 권장 판매가격을 보여주고 있습니다 — 입력하거나 버튼을 눌러야 저장됩니다."}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setDetailOpen((v) => !v)}
        className="mt-3 text-xs font-medium text-primary hover:underline"
      >
        {detailOpen ? "▾ 가격 계산 상세 접기" : "▸ 가격 계산 상세 보기"}
      </button>

      {detailOpen && (
      <div className="mt-3 space-y-2.5 text-xs">
        <Row label="원본 가격" badge={<ValueBadge kind="original" />}>
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

        {sellerIntel?.status === "OK" && sellerIntel.sellerOriginPrice && (
          <div className="pl-[calc(6rem+0.5rem)]">
            {!expandedIntel ? (
              <button
                type="button"
                onClick={loadExpandedMarkets}
                disabled={expandLoading}
                className="text-[11px] text-primary hover:underline disabled:opacity-50"
              >
                {expandLoading ? "국가별 원본가격 조회 중..." : "국가별 원본가격 비교 보기 (추가 조회)"}
              </button>
            ) : (
              <CountryPriceTable intel={expandedIntel} liveRates={liveRates} />
            )}
          </div>
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
          <span className="flex items-center gap-1.5 font-medium text-text-primary">
            권장 판매가격
            <ValueBadge kind="aiSuggested" />
          </span>
          <span className="text-base font-semibold text-text-primary">{formatKrw(breakdown.suggestedPriceKrw)}</span>
        </div>

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
      )}
    </section>
  );
}

/** N-3.16 잔여3(CPO 지시: "최종 판매가 ₩235,300 / 원본 ₩109,620 · AI 추천
 * ₩235,300 · 사용자 확정 ₩235,300"과 같은 요약을 접힌 상태에서도 보여준다") —
 * 바깥 가격 Accordion이 접혀 있을 때 이 컴포넌트 하나만 그려지고, 펼쳐져
 * 있을 때는 상세 편집 UI 맨 위에 다시 한번 그려진다 — 두 경우 모두 호출부에서
 * 넘겨준 동일한 breakdown/finalPriceKrw를 그대로 표시만 하므로 숫자가 갈릴
 * 일이 없다. */
function PriceSummaryStrip({
  product,
  breakdown,
  finalPriceKrw,
}: {
  product: CanonicalProduct;
  breakdown: ReturnType<typeof computePriceBreakdown>;
  finalPriceKrw: number;
}) {
  return (
    <div className="space-y-1 text-xs">
      <div className="flex items-baseline gap-1.5">
        <span className="text-text-secondary">최종 판매가</span>
        <span className="text-base font-semibold text-text-primary">{formatKrw(finalPriceKrw)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-text-tertiary">
        <span className="inline-flex items-center gap-1">
          <ValueBadge kind="original" />
          {formatOriginalPrice(product.price.value.amount, product.price.value.currency)}
        </span>
        <span className="inline-flex items-center gap-1">
          <ValueBadge kind="aiSuggested" />
          {formatKrw(breakdown.suggestedPriceKrw)}
        </span>
        <span className="inline-flex items-center gap-1">
          <ValueBadge kind="userConfirmed" />
          {product.priceOverrideKrw ? formatKrw(product.priceOverrideKrw.value) : "미확정"}
        </span>
      </div>
    </div>
  );
}

/** N-3.16(CPO 지시: "ValueBadge 실제 연결") — 원본/AI추천/사용자확정 값이
 * 섞이기 쉬운 가격 화면에서, 어느 값이 지금 실제 등록에 쓰이는지 라벨 옆
 * ValueBadge로 표시한다. badge가 없으면(대부분의 Row) 기존과 동일하게 그린다 —
 * 이 Row 컴포넌트를 쓰는 다른 모든 곳(환율/원가/배송비 등)은 변경 없음. */
function Row({
  label,
  badge,
  children,
}: {
  label: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="w-24 shrink-0 pt-1.5 text-text-secondary">
        {label}
        {badge && <span className="ml-1.5">{badge}</span>}
      </span>
      <div className="min-w-0 flex-1 text-right">{children}</div>
    </div>
  );
}

/** N-3.13 Part H(CPO 지시) — "원본 사이트가 실제 제공하는 국가별 가격"과
 * "CartPilot이 환산한 가격"을 표로 분리해서 보여준다. sellerOriginPrice/
 * krMarket/additionalMarkets는 전부 실제로 fetch에 성공한 관측값(PriceObservation,
 * confidence:"HIGH")만 들어있다 — 이 컴포넌트는 새 값을 추측하거나 다른
 * 국가 가격을 복제하지 않고, API가 준 값을 그대로 나열만 한다. `≈`는
 * CartPilot 환산 열에만 붙이고 원본 가격 열에는 절대 붙이지 않는다(CPO
 * 지시). testedMarketCodes에는 있지만 additionalMarkets에 없는 코드는
 * "조회했지만 이 시장에서 가격을 제공하지 않음"으로 명시한다(추측으로
 * 빈 칸을 만들지 않는다). */
function CountryPriceTable({
  intel,
  liveRates,
}: {
  intel: PriceIntelligenceResult;
  liveRates?: Record<string, number>;
}) {
  interface Row {
    label: string;
    flag: string;
    observation: { amount: number; currency: string } | null;
    note: string;
  }

  const rows: Row[] = [];
  if (intel.sellerOriginPrice) {
    rows.push({
      label: intel.seller.country ?? "확인 불가",
      flag: countryToFlagEmoji(intel.seller.country) ?? "🌐",
      observation: intel.sellerOriginPrice,
      note: `원본 제공${intel.seller.name ? ` (${intel.seller.name})` : ""}`,
    });
  }
  if (intel.krMarket) {
    rows.push({ label: "KR", flag: countryToFlagEmoji("KR") ?? "🇰🇷", observation: intel.krMarket, note: "원본 제공" });
  }
  for (const m of intel.additionalMarkets) {
    rows.push({
      label: m.country ?? m.marketCode,
      flag: countryToFlagEmoji(m.country) ?? "🌐",
      observation: m,
      note: "원본 제공",
    });
  }
  // 실제로 조회했지만(testedMarketCodes) 값을 못 받은(additionalMarkets에 없는) 시장 —
  // "제공하지 않음"으로 명시한다. sellerOriginPrice/krMarket에 해당하는 ""/"en-kr"은
  // 위에서 이미 다뤘으니 제외한다. 국가 코드(label) 기준으로도 중복 제거한다 —
  // 판매처 원본 마켓("")과 명시적 en-gb 프로브가 같은 나라를 가리키는 경우
  // "실제 값"과 "원본 미제공"이 같은 나라로 동시에 뜨면 안 되기 때문이다.
  const returnedCodes = new Set([
    ...(intel.sellerOriginPrice ? [intel.sellerOriginPrice.marketCode] : []),
    ...(intel.krMarket ? [intel.krMarket.marketCode] : []),
    ...intel.additionalMarkets.map((m) => m.marketCode),
  ]);
  const returnedCountryLabels = new Set(rows.map((r) => r.label));
  for (const code of intel.testedMarketCodes) {
    if (code === "" || code === "en-kr" || returnedCodes.has(code)) continue;
    const match = /^[a-z]{2}-([a-z]{2})$/i.exec(code);
    const countryCode = match ? match[1].toUpperCase() : null;
    if (countryCode && returnedCountryLabels.has(countryCode)) continue;
    rows.push({
      label: countryCode ?? code,
      flag: countryToFlagEmoji(countryCode) ?? "🌐",
      observation: null,
      note: "원본 미제공",
    });
  }

  if (rows.length === 0) {
    return <p className="mt-1.5 text-[11px] text-text-tertiary">조회된 국가별 가격이 없습니다.</p>;
  }

  return (
    <div className="mt-1.5 overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse text-left text-[11px]">
        <thead>
          <tr className="border-b border-border text-text-tertiary">
            <th className="py-1 pr-2 font-medium">국가/지역</th>
            <th className="py-1 pr-2 font-medium">원본 가격</th>
            <th className="py-1 pr-2 font-medium">원본 통화</th>
            <th className="py-1 pr-2 font-medium">CartPilot 환산</th>
            <th className="py-1 font-medium">근거</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const currencyCode = row.observation?.currency.toUpperCase();
            // 알려진 환율(liveRates 또는 고정 폴백표)이 없는 통화는 절대 변환하지 않는다 —
            // convertToKrw는 모르는 통화를 금액 그대로 KRW 취급해 돌려주는데(추정치로
            // 표시하기 위한 최후 폴백), 이 표에서 그대로 쓰면 "80 AUD ≈ ₩80" 같은 조작된
            // 값처럼 보인다(CPO 지시 — 원본과 계산값을 절대 혼동시키지 않는다). 이 표에서는
            // 실제 환율을 아는 통화만 환산하고, 모르면 "환율 정보 없음"으로 명시한다.
            const hasKnownRate =
              currencyCode != null &&
              (currencyCode === "KRW" || liveRates?.[currencyCode] != null || FIXED_RATES_TO_KRW[currencyCode] != null);
            const krw = row.observation && currencyCode !== "KRW" && hasKnownRate
              ? convertToKrw(row.observation.amount, row.observation.currency, liveRates)
              : null;
            const convertedCell = row.observation == null
              ? "—"
              : currencyCode === "KRW"
                ? "—"
                : hasKnownRate && krw
                  ? `≈ ${formatKrw(krw.amountKrw)}`
                  : "환율 정보 없음";
            return (
              <tr key={`${row.label}-${i}`} className="border-b border-border last:border-b-0">
                <td className="py-1 pr-2 text-text-primary">
                  {row.flag} {row.label}
                </td>
                <td className="py-1 pr-2 text-text-primary">
                  {row.observation ? row.observation.amount.toLocaleString("en-US") : "—"}
                </td>
                <td className="py-1 pr-2 text-text-secondary">{row.observation?.currency ?? "—"}</td>
                <td className="py-1 pr-2 text-text-secondary">{convertedCell}</td>
                <td className="py-1 text-text-tertiary">{row.note}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
