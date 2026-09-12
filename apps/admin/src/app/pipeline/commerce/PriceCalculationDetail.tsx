"use client";

import { useState } from "react";
import type { CanonicalProduct } from "@commerce/shared";
import {
  computePriceBreakdown,
  DEFAULT_PRICE_BREAKDOWN_INPUT,
  DEFAULT_PRICE_ROUNDING_UNIT,
  formatKrw,
  formatOriginalPrice,
} from "@commerce/pricing";
// MI/PRICE-1 — 라벨 어휘는 판단 카드의 ④ 수익성 사슬과 같은 표에서 가져온다.
// 같은 숫자를 두 화면이 다른 이름으로 부르던 것이 이 저장소가 반복해서 고쳐 온
// 라벨 표류다(price-hierarchy.ts의 "의미 하나당 라벨 하나" 주석 참고).
import { PRICE_LINE_LABEL, PRICE_SECTION_TITLE } from "./price-hierarchy";
import { ValueBadge } from "@/components/ui/ValueBadge";

/**
 * MI/PRICE-1(CEO 지시, 2026-09-12) — **상세 계산은 제품 전체에서 여기 하나뿐이다.**
 *
 * ── 무엇이 문제였나 ──────────────────────────────────────────────────────
 * 가격 정보가 두 번 계산되는 것처럼 보였다. 계산이 실제로 두 번 돈 적은 없다 —
 * 갈라져 있던 것은 **정보의 소유권**이었다:
 *
 *   MI        국내 시장 가격 비교 · 수익성(판매가격·원가·예상수익·마진) · 판매 판단
 *   가격 계산  원가 · 배송비 · 수수료 · 마진 · 권장 판매가격 · 최종 판매가격
 *
 * 셀러는 MI에서 가격을 다 읽고 내려왔는데 그 아래에서 같은 숫자를 다시 계산하는
 * 카드를 만났다. 그래서 되돌아오는 질문이 "아까 위에서 본 가격은 뭐였지?"였다.
 *
 * ── 이 파일이 정한 소유권 ────────────────────────────────────────────────
 *   MI 가격 비교    국내 시장에서 얼마에 팔리고 있는가
 *   MI 수익성       내 원가 기준 얼마에 팔면 수익이 나는가
 *   MI 상세 계산    왜 그 가격이 나왔는가          ← **이 컴포넌트, 한 곳뿐**
 *   등록 준비 가격   그래서 실제 얼마로 팔 것인가    ← PriceEditor(확정만)
 *   채널 가격       네이버/쿠팡에 실제 등록할 가격  ← ChannelPriceSection
 *
 * 그래서 이 컴포넌트는 PriceEditor(예전 "가격 계산" 카드)의 접힘 상세를 통째로
 * 들고 나온 것이다. 줄도, 순서도, 산식도 한 줄 바뀌지 않았다 — 바뀐 것은 이
 * 사슬이 **어느 카드 안에서 그려지는가**뿐이고, 그 자리는 MI ④ 💰 수익성의
 * 접힘 하나다. 셀러가 "왜 143,500원인가"를 묻는 자리와 답하는 자리가 같아진다.
 *
 * ── 계산은 여전히 하나다 ─────────────────────────────────────────────────
 * computePriceBreakdown() 하나가 유일한 산식이고, 사슬의 항목·순서·feePercent의
 * 의미(최종 판매가 기준 비율)는 그대로다. 새로 계산하는 숫자가 없다.
 *
 * ── 이 컴포넌트는 서버를 부르지 않는다 ───────────────────────────────────
 * 예전 PriceEditor는 판매자 기본값(반올림 단위·국내 배송원가)을 스스로 조회했다.
 * 그런데 CommerceWorkspace는 같은 엔드포인트를 이미 부르고 있었고(등록가 계산에
 * 같은 반올림 단위가 필요하다), 두 곳이 각자 조회하면 언젠가 한쪽만 실패해서
 * 화면의 권장가와 등록가가 10원 단위로 갈린다. 이제 값은 props로 내려온다 —
 * 이 파일에 fetch가 하나도 없다는 것이 곧 "가격을 고쳐도 MI는 돌지 않는다"의
 * 가장 짧은 증명이다.
 */
const SELECTABLE_CURRENCIES = ["USD", "EUR", "JPY", "GBP", "SEK", "CNY", "HKD", "KRW"];

/**
 * P2-1(CEO 지시, 2026-09-12) — 계산 사슬의 입력 칸 하나의 모양.
 *
 * 상수로 빼는 이유는 취향이 아니다 — 지금까지 같은 문자열이 다섯 군데에
 * 복사돼 있었고, 다음에 높이를 손보는 사람은 그중 넷만 고칠 것이다. 그러면
 * 한 화면 안에서 입력 칸 높이가 두 가지가 된다.
 */
const FIELD_CLASS = "rounded border border-border px-2 py-0.5 text-sm focus:border-primary focus:outline-none";

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
      className={className ?? `w-24 ${FIELD_CLASS}`}
    />
  );
}

export function PriceCalculationDetail({
  product,
  onUpdateOriginalPrice,
  onUpdatePriceBreakdown,
  onUpdateCustomsCost,
  exchangeRates,
  exchangeRatesLoading,
  onRefreshExchangeRates,
  priceRoundingUnit,
  domesticShippingCostKrw,
  onOpenMarketComparison,
}: {
  product: CanonicalProduct;
  onUpdateOriginalPrice?: (patch: Partial<{ amount: number; currency: string }>) => void;
  onUpdatePriceBreakdown: (breakdown: { shippingKrw: number; feePercent: number; marginPercent: number }) => void;
  onUpdateCustomsCost: (patch: Partial<{ customsDutyKrw: number | null; customsVatKrw: number | null }>) => void;
  exchangeRates: { rates: Record<string, number>; fetchedAt: string; source: "frankfurter" | "fallback" } | null;
  exchangeRatesLoading: boolean;
  onRefreshExchangeRates: () => void;
  /** Settings의 "가격 정책"(반올림 단위). CommerceWorkspace가 이미 조회해 둔
   * 값을 그대로 받는다 — 등록가(resolveListingPrice)와 화면의 권장가가 같은
   * 단위로 반올림되지 않으면 두 숫자가 10원 단위로 갈린다. */
  priceRoundingUnit: number | null;
  /** P-3-1에서 확정: 국내배송원가는 Settings에서만 고치는 판매자 공통 기본값이라
   * 여기서는 읽기전용으로만 보여준다. */
  domesticShippingCostKrw: number | null;
  /** PHASE 3.2 추가지시(CPO, 2026-09-11) — 시장 관측 원본으로 가는 단 하나의
   * 통로. 값을 가져오는 함수가 아니라 화면 이동이다(여기서 시장 데이터를 다시
   * 조회하지 않는다 — 그러면 이 사슬이 다시 비교 카드가 된다). */
  onOpenMarketComparison?: () => void;
}) {
  const breakdownInput = product.priceBreakdown ?? DEFAULT_PRICE_BREAKDOWN_INPUT;
  const roundingUnit = priceRoundingUnit ?? DEFAULT_PRICE_ROUNDING_UNIT;

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

  // N-3.54(CPO 지시: "원본 가격을 못 읽었으면 가격을 계산하지 말고") —
  // product.priceValidity가 VALID가 아니면 위 breakdown.suggestedPriceKrw는
  // 배송비 등 나머지 입력값만으로 계산된 숫자라 진짜 가격이 아니다. 이 화면
  // 전체가 그 숫자를 "권장 판매가격"처럼 보여주지 않고, 대신 원본 가격을
  // 직접 확인/입력하라는 경고로 대체한다.
  const priceUnresolved = product.priceValidity !== "VALID";

  // 최종 판매가격 표시값 — 사용자가 아직 아무것도 커밋하지 않았으면(product.
  // priceOverrideKrw == null) 권장 판매가격을 그대로 미리 보여주기만 한다(자동
  // 커밋 아님 — 확정은 ③ 등록 준비의 [적용] 하나뿐이다). 예상 이익은 "실제로
  // 팔 값" 기준이어야 하므로 여기서도 같은 규칙으로 고른다.
  const finalPriceKrw = product.priceOverrideKrw?.value ?? breakdown.suggestedPriceKrw;
  const feeAmountKrw = Math.round((finalPriceKrw * draftInput.feePercent) / 100);
  const netProfitKrw = finalPriceKrw - breakdown.landedCostKrw - feeAmountKrw;

  if (priceUnresolved) {
    return (
      <div className="space-y-2.5 text-sm">
        <PriceUnresolvedBanner product={product} />
        {onUpdateOriginalPrice && (
          <div className="rounded-md border border-border bg-background px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-text-primary">원본 가격 직접 입력</span>
              <div className="flex items-center gap-1.5">
                <LiveNumberField
                  value={draftOriginalAmount}
                  onLiveChange={setDraftOriginalAmount}
                  onCommit={(n) => {
                    setDraftOriginalAmount(n);
                    onUpdateOriginalPrice({ amount: n });
                  }}
                />
                <select
                  value={product.price.value.currency}
                  onChange={(e) => onUpdateOriginalPrice({ currency: e.target.value })}
                  className={FIELD_CLASS}
                >
                  <option value="">통화 선택</option>
                  {SELECTABLE_CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {/* P2-4 — 이 문장은 "지금 무엇을 하면 화면이 다시 움직이는가"를
                알려주는 안내라 계산 설명(secondary)이다. */}
            <p className="mt-1 text-xs text-text-secondary">
              원본 가격과 통화를 모두 정확히 입력하면(0보다 큰 값) 자동으로 가격 계산이 다시 시작됩니다.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    /* P2-1 — 줄 간격 space-y-2.5(10px) → space-y-1.5(6px). 사슬은 열 줄이라
       줄 사이 여백만으로 36px이 줄어든다. 줄을 지우거나 합치지 않았다 —
       순서도 개수도 그대로다. */
    <div className="mt-2 space-y-1.5 text-xs">
      {/* 사슬의 순서 = 계산 순서다. 원본 가격 → 환율 → 원화 환산 →
          국제배송비 → 착지원가 → 수수료율/마진율 → 권장 판매가격 →
          수수료 금액 → 예상 이익. 순서가 흐트러지면 "무엇을 더해서 이 값이
          됐는지"를 읽을 수 없게 된다.

          라벨은 price-hierarchy.ts의 표에서만 가져온다(원화 환산 ·
          국제배송비 · 착지원가). 같은 숫자를 판단 카드의 ④ 수익성 요약은
          "착지원가"라 부르는데 이 사슬만 "상품 원가"라고 부르면, 셀러는 같은
          카드 안에서 서로 다른 값을 봤다고 읽는다 — 이 저장소가 반복해서
          고쳐 온 라벨 표류라 여기서 되살리지 않는다. */}
      <Row label="원본 가격" badge={<ValueBadge kind="original" />}>
        {onUpdateOriginalPrice ? (
          <div className="flex items-center justify-end gap-1.5">
            <LiveNumberField
              value={draftOriginalAmount}
              onLiveChange={setDraftOriginalAmount}
              onCommit={(n) => {
                setDraftOriginalAmount(n);
                onUpdateOriginalPrice({ amount: n });
              }}
              className={`w-24 ${FIELD_CLASS}`}
            />
            <select
              value={product.price.value.currency}
              onChange={(e) => onUpdateOriginalPrice({ currency: e.target.value })}
              className={FIELD_CLASS}
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

      {/* 환율은 가격이 아니라 "이 원화가 어디서 왔는지"를 밝히는 근거다 —
          그래서 원화 환산 바로 위에 자기 줄로 둔다(값 자체를 여기서 곱하지
          않는다, computePriceBreakdown이 이미 낸 값을 그대로 읽는다). */}
      <Row label="환율">
        <span className="flex items-center justify-end gap-1.5 text-text-secondary">
          1 {breakdown.originalCurrency} = ₩{Math.round(breakdown.exchangeRate).toLocaleString("ko-KR")}
          {breakdown.isRateEstimate
            ? " (추정 고정환율)"
            : exchangeRates?.source === "frankfurter"
              ? " (출처: ECB)"
              : ""}
          <button
            type="button"
            onClick={onRefreshExchangeRates}
            disabled={exchangeRatesLoading}
            className="text-primary hover:underline disabled:opacity-50"
          >
            {exchangeRatesLoading ? "불러오는 중…" : "새로고침"}
          </button>
        </span>
      </Row>

      <Row label={PRICE_LINE_LABEL.SOURCE_PRICE_KRW}>
        <span className="font-medium text-text-primary">{formatKrw(breakdown.costKrw)}</span>
      </Row>

      <Row label={PRICE_LINE_LABEL.INTERNATIONAL_SHIPPING}>
        <div className="flex items-center justify-end gap-1">
          <span className="text-text-secondary">₩</span>
          <LiveNumberField
            value={draftInput.shippingKrw}
            onLiveChange={(n) => liveUpdateBreakdown({ shippingKrw: n })}
            onCommit={(n) => commitBreakdown({ shippingKrw: n })}
            className={`w-24 ${FIELD_CLASS}`}
          />
        </div>
      </Row>

      <div className="flex items-center justify-between border-t border-border pt-1.5">
        <span className="font-medium text-text-primary">{PRICE_LINE_LABEL.LANDED_COST}</span>
        <span className="font-medium text-text-primary">{formatKrw(breakdown.landedCostKrw)}</span>
      </div>

      {/* 수수료율은 권장 판매가격 공식(landedCost/(1-fee%-margin%))에 그대로
          들어간다 — 고치면 아래 권장 판매가격이 즉시 다시 계산된다. ④ 수익성
          요약에는 올리지 않는다: 지금 활성 채널이 둘인데 "수수료 10%" 한 줄을
          결론 옆에 두면 그게 어느 채널의 요율인지 화면이 답할 수 없다. */}
      <Row label="예상 수수료">
        <div className="flex items-center justify-end gap-1">
          <LiveNumberField
            value={draftInput.feePercent}
            max={99}
            onLiveChange={(n) => liveUpdateBreakdown({ feePercent: n })}
            onCommit={(n) => commitBreakdown({ feePercent: n })}
            className={`w-14 ${FIELD_CLASS}`}
          />
          <span className="text-text-secondary">%</span>
        </div>
      </Row>

      {/* P2-1 — "(판매가 기준 목표 이익률 — Settings에서 기본값 변경)"이
          입력칸 옆에 붙어 두 줄로 접히면서 이 행 하나가 다른 행의 두 배를
          차지하고 있었다. 두 사실(마진의 기준 / 기본값을 어디서 바꾸나)은
          아래 추정치 문단으로 옮겨 붙였다 — 지운 것이 아니라 자리를 옮긴
          것이다(같은 문단이 이미 "이 값들은 추정치다"를 말하고 있어서,
          오히려 한 문단이 한 가지를 말하게 됐다). */}
      <Row label="목표 마진">
        <div className="flex items-center justify-end gap-1">
          <LiveNumberField
            value={draftInput.marginPercent}
            max={99}
            onLiveChange={(n) => liveUpdateBreakdown({ marginPercent: n })}
            onCommit={(n) => commitBreakdown({ marginPercent: n })}
            className={`w-14 ${FIELD_CLASS}`}
          />
          <span className="text-text-secondary">%</span>
        </div>
      </Row>

      {/* MI/PRICE-1 — 이 사슬이 답하는 마지막 질문이 여기서 끝난다: "그래서
          권장 판매가격이 왜 이 값인가." 그 값을 **실제로 팔 값으로 확정할
          것인가**는 ③ 등록 준비의 판매가격 확정 카드가 묻는다 — 두 질문을 한
          카드에 두면 셀러는 계산을 읽다 말고 결정을 요구받는다(그 화면이
          이번 지시의 출발점이다). 권장가와 최종가의 관계 문장도 확정 카드가
          갖는다: 두 값이 나란히 있는 자리가 거기 하나뿐이기 때문이다. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 border-t border-border pt-1.5">
        <span className="flex items-center gap-1.5 font-medium text-text-primary">
          권장 판매가격
          <ValueBadge kind="aiSuggested" />
        </span>
        <span className="text-sm font-semibold text-text-primary">{formatKrw(breakdown.suggestedPriceKrw)}</span>
      </div>

      <Row label="예상 수수료 금액">
        <span className="font-medium text-text-primary">{formatKrw(feeAmountKrw)}</span>
      </Row>

      <div className="flex items-center justify-between border-t border-border pt-1.5">
        <span className="font-medium text-text-primary">예상 이익(최종 판매가격 기준)</span>
        <span className={`font-medium ${netProfitKrw >= 0 ? "text-success" : "text-error"}`}>
          {netProfitKrw >= 0 ? "+" : ""}
          {formatKrw(netProfitKrw)}
        </span>
      </div>

      {/* P2-1/P2-4 — 위 "목표 마진" 행에 붙어 있던 괄호 설명이 여기로 합쳐졌다.
          같은 문단이 말하는 것은 하나다: "이 세 입력은 추정치이고, 아는
          값으로 고치면 즉시 다시 계산되며, 기본값은 Settings에 있다."
          계산을 설명하는 문장이라 tertiary가 아니라 secondary다. */}
      <p className="pt-0.5 text-xs text-text-secondary">
        국제배송비·예상 수수료·목표 마진은 실제 물류·정산 데이터가 없어 추정치입니다(목표 마진은 판매가 기준 이익률) —
        아는 값으로 고치면 즉시 다시 계산됩니다.{" "}
        <a href="/settings" className="text-primary hover:underline">
          Settings에서 기본값 변경
        </a>
      </p>

      {/* PHASE 3.2 추가지시 — 시장 정보는 이 사슬에 들어오지 않는다. 여기
          있던 국가별 원본가격 비교표/한국向 표시가는 ②·③으로 돌아갔고,
          남는 것은 그 관측 원본으로 가는 링크 한 줄뿐이다(블록이 아니라
          링크여야 한다 — 블록이 되는 순간 계산 사슬이 다시 비교 카드가 된다). */}
      {onOpenMarketComparison && (
        <p className="text-xs text-text-secondary">
          다른 나라 판매가·한국 시장 경쟁가격은{" "}
          <button type="button" onClick={onOpenMarketComparison} className="text-primary hover:underline">
            {PRICE_SECTION_TITLE.SELLER_GLOBAL_MARKET} / {PRICE_SECTION_TITLE.DOMESTIC_COMPETITION}
          </button>
          에서 확인하세요.
        </p>
      )}

      <CustomsCostSection
        domesticShippingCostKrw={domesticShippingCostKrw}
        customsDutyKrw={product.customsDutyKrw?.value ?? null}
        customsVatKrw={product.customsVatKrw?.value ?? null}
        onUpdateCustomsCost={onUpdateCustomsCost}
      />
    </div>
  );
}

/** P-3-2(대표님 지시, 2026-08-28) — 위 "가격 계산 Breakdown"(computePriceBreakdown,
 * 권장 판매가격 공식)과 완전히 별개다. 이 값들은 Market Intelligence의
 * computeUnifiedPriceDecision()에만 쓰이고, 권장 판매가격/예상 이익(위 계산)에는
 * 전혀 영향을 주지 않는다 — 기존 계산식을 건드리지 않는다는 원칙을 그대로
 * 지킨다. 국내 배송원가는 Settings에서만 고칠 수 있는 판매자 공통 기본값이라
 * 여기서는 읽기전용으로만 보여준다(P-3-1에서 확정: 국내배송원가=Settings
 * 기본값, 관세/부가세=상품별). */
function CustomsCostSection({
  domesticShippingCostKrw,
  customsDutyKrw,
  customsVatKrw,
  onUpdateCustomsCost,
}: {
  domesticShippingCostKrw: number | null;
  customsDutyKrw: number | null;
  customsVatKrw: number | null;
  onUpdateCustomsCost: (patch: Partial<{ customsDutyKrw: number | null; customsVatKrw: number | null }>) => void;
}) {
  const [dutyDraft, setDutyDraft] = useState(customsDutyKrw != null ? String(customsDutyKrw) : "");
  const [vatDraft, setVatDraft] = useState(customsVatKrw != null ? String(customsVatKrw) : "");
  // LiveNumberField와 같은 패턴 — 외부에서(스냅샷 전환 등) product.customsDutyKrw/
  // customsVatKrw가 바뀌면 로컬 draft를 다시 동기화한다.
  const [syncedDuty, setSyncedDuty] = useState(customsDutyKrw);
  const [syncedVat, setSyncedVat] = useState(customsVatKrw);
  if (customsDutyKrw !== syncedDuty) {
    setSyncedDuty(customsDutyKrw);
    setDutyDraft(customsDutyKrw != null ? String(customsDutyKrw) : "");
  }
  if (customsVatKrw !== syncedVat) {
    setSyncedVat(customsVatKrw);
    setVatDraft(customsVatKrw != null ? String(customsVatKrw) : "");
  }

  function commitDuty() {
    const n = dutyDraft.trim() === "" ? null : Number(dutyDraft);
    onUpdateCustomsCost({ customsDutyKrw: n != null && Number.isFinite(n) ? n : null });
  }
  function commitVat() {
    const n = vatDraft.trim() === "" ? null : Number(vatDraft);
    onUpdateCustomsCost({ customsVatKrw: n != null && Number.isFinite(n) ? n : null });
  }

  return (
    <div className="mt-2 space-y-1.5 border-t border-border pt-2 text-sm">
      {/* P2-4 — 제목(primary)과 그 제목이 무엇을 뜻하는지(secondary)를 한 단계로
          가른다. 이 문장이야말로 "왜 이 숫자가 권장 판매가격을 안 바꾸는가"에
          대한 답이다. */}
      <p className="text-xs font-medium text-text-primary">예상 구매 비용(판매 판단용)</p>
      <p className="text-xs text-text-secondary">
        위 권장 판매가격 계산에는 반영되지 않습니다 — 이 카드 맨 위의 판매 판단(예상 마진)에만 쓰입니다.
      </p>
      <Row label="국내 배송원가">
        {domesticShippingCostKrw != null ? (
          <span className="font-medium text-text-primary">{formatKrw(domesticShippingCostKrw)} (Settings 기본값)</span>
        ) : (
          <span className="text-text-tertiary">
            미확인 —{" "}
            <a href="/settings" className="text-primary hover:underline">
              Settings에서 입력
            </a>
          </span>
        )}
      </Row>
      <Row label="관세">
        <div className="flex items-center gap-1">
          <span className="text-text-secondary">₩</span>
          <input
            type="text"
            inputMode="decimal"
            value={dutyDraft}
            placeholder="미확인"
            onChange={(e) => setDutyDraft(e.target.value)}
            onBlur={commitDuty}
            className={`w-24 ${FIELD_CLASS}`}
          />
        </div>
      </Row>
      <Row label="부가세">
        <div className="flex items-center gap-1">
          <span className="text-text-secondary">₩</span>
          <input
            type="text"
            inputMode="decimal"
            value={vatDraft}
            placeholder="미확인"
            onChange={(e) => setVatDraft(e.target.value)}
            onBlur={commitVat}
            className={`w-24 ${FIELD_CLASS}`}
          />
        </div>
      </Row>
    </div>
  );
}

/** N-3.54(CPO 지시: "원본 가격을 못 읽었으면 가격을 계산하지 말고, 계산했으면
 * 그 가격의 근거가 무엇인지 보여줘야 한다") — product.priceValidity가 VALID가
 * 아닐 때만 렌더된다. CPO가 지정한 문구를 그대로 쓴다 — MISSING/INVALID/
 * UNRESOLVED를 화면에서 굳이 구분해 보여주지 않는다(내부 판정은 구분하되,
 * 사용자에게는 "원본 가격을 확인할 수 없다"는 동일한 다음 행동을 요구하기
 * 때문). priceRawText(INVALID일 때만 있음)가 있으면 원문을 그대로 보여준다 —
 * 값을 지어내지 않는다.
 *
 * MI/PRICE-1 — 이 배너는 상세 계산과 함께 여기로 내려왔다. ③ 등록 준비의
 * 확정 카드는 같은 배너를 한 벌 더 그리지 않고 "확정할 수 없다 + 여기로
 * 가라" 한 줄만 남긴다 — 같은 경고가 두 카드에 뜨면 셀러는 문제가 둘인 줄
 * 안다. */
function PriceUnresolvedBanner({ product }: { product: CanonicalProduct }) {
  return (
    <div className="rounded-md border border-warning bg-warning-soft p-3 text-sm text-warning">
      <p className="font-medium">⚠️ 원본 상품 가격을 확인할 수 없습니다. 해외 사이트의 가격을 확인한 후 등록할 수 있습니다.</p>
      {product.priceRawText && (
        <p className="mt-1 text-xs opacity-80">
          원본에서 찾은 텍스트: &ldquo;{product.priceRawText}&rdquo; — 숫자로 인식하지 못했습니다.
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <a
          href={product.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded border border-warning px-2 py-1 text-[11px] font-medium hover:bg-warning/10"
        >
          원본 페이지 다시 확인
        </a>
        <span className="rounded border border-warning px-2 py-1 text-[11px] font-medium">
          가격 직접 확인 — 아래 &ldquo;원본 가격 직접 입력&rdquo;에서 바로 수정할 수 있습니다.
        </span>
      </div>
    </div>
  );
}

/** N-3.16(CPO 지시: "ValueBadge 실제 연결") — 원본/AI추천/사용자확정 값이
 * 섞이기 쉬운 가격 화면에서, 어느 값이 지금 실제 등록에 쓰이는지 라벨 옆
 * ValueBadge로 표시한다. badge가 없으면(대부분의 Row) 기존과 동일하게 그린다. */
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
    // P2-1 — items-start + pt-1.5(라벨을 입력칸 첫 줄에 맞추려던 보정)를
    // items-center로 바꾼다. 이제 행 안에서 두 줄로 접히는 내용이 없어서
    // 보정이 필요 없고, 행마다 위쪽 6px이 그대로 사라진다.
    <div className="flex items-center justify-between gap-3">
      <span className="w-24 shrink-0 text-text-secondary">
        {label}
        {badge && <span className="ml-1.5">{badge}</span>}
      </span>
      <div className="min-w-0 flex-1 text-right">{children}</div>
    </div>
  );
}
