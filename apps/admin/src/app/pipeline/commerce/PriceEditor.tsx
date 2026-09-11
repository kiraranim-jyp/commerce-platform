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
// UX 2.5 — 라벨 어휘는 판단 카드의 ④ 수익성 사슬과 같은 표에서 가져온다.
// 같은 숫자를 두 화면이 다른 이름으로 부르던 것이 이 저장소가 반복해서 고쳐 온
// 라벨 표류다(price-hierarchy.ts의 "의미 하나당 라벨 하나" 주석 참고).
// PHASE 3.2 추가지시 — 시장 비교로 나가는 링크 문구도 같은 표(PRICE_SECTION_TITLE)를
// 쓴다. 링크에 적힌 이름과 실제 도착지 제목이 다르면 셀러는 다른 화면으로 간 줄 안다.
import { PRICE_LINE_LABEL, PRICE_SECTION_TITLE } from "./price-hierarchy";
import { ValueBadge } from "@/components/ui/ValueBadge";

/**
 * Sprint N-3.8/N-3.9(가격 계산 모델 통일 — CPO 지시) — 예전에는 화면 상단
 * 요약("최종 판매가")과 아래 "가격 계산 Breakdown"이 서로 다른 공식을 썼다
 * (요약은 마크업 cost×(1+마진%), Breakdown은 마진율 역산 landedCost/(1-fee%-
 * margin%)) — 같은 "마진 20%" 라벨인데 숫자가 달라지는 버그였다. 이제는
 * computePriceBreakdown() 하나만 화면 전체에서 쓴다 — Commerce별로 다른 가격
 * 컴포넌트를 만들지 않는다.
 *
 * UX 2.5(CEO 지시, 2026-09-11) — 이 컴포넌트가 사는 곳이 바뀌었다. 예전에는
 * 채널 화면(PlatformPreview)의 "가격" Accordion 안에 있어서 스마트스토어 탭과
 * 쿠팡 탭에 각각 하나씩 떠 있었다. 그런데 등록에 쓰이는 판매가는 처음부터
 * resolveListingPrice()가 내는 **하나의 값**이었고(모든 어댑터가 같은 함수를
 * 부른다 — listing-price-contract.test.ts), 채널별 가격이라는 개념은 데이터에
 * 존재한 적이 없다. 화면만 그렇게 보였을 뿐이다. 이제 편집기는 상품정보 ③
 * 등록 준비 안에 하나만 있고, 채널 화면은 그 결과를 읽기전용으로 보여준다.
 *
 * 그래서 open prop도 없앴다 — 접기/펼치기는 이 카드를 담는 바깥 화면
 * (StageBody의 CollapsibleSection, ③ 체크리스트의 펼침)이 맡는다. 계산기가
 * 스스로 "요약만 그릴지"를 판단하던 분기가 사라지면서, 같은 숫자를 두 모양으로
 * 그릴 위험 자체가 없어졌다.
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

/**
 * P2-1(CEO 지시, 2026-09-12) — 계산 사슬의 입력 칸 하나의 모양.
 *
 * 값을 지우지 않고 카드를 짧게 만들라는 지시라, 가장 먼저 깎을 수 있는 것이
 * 줄마다 반복되는 높이다. py-1 → py-0.5(30px → 26px)는 한 줄에서는 티가 안
 * 나지만 입력 칸이 다섯 줄, 그 사이 여백이 아홉 줄인 화면에서는 그대로 카드
 * 길이가 된다.
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

export function PriceEditor({
  product,
  onUpdateSalePriceKrw,
  onUpdateOriginalPrice,
  onUpdatePriceBreakdown,
  onUpdateCustomsCost,
  exchangeRates,
  exchangeRatesLoading,
  onRefreshExchangeRates,
  onOpenMarketComparison,
}: {
  product: CanonicalProduct;
  onUpdateSalePriceKrw: (amountKrw: number) => void;
  onUpdateOriginalPrice?: (patch: Partial<{ amount: number; currency: string }>) => void;
  onUpdatePriceBreakdown: (breakdown: { shippingKrw: number; feePercent: number; marginPercent: number }) => void;
  onUpdateCustomsCost: (patch: Partial<{ customsDutyKrw: number | null; customsVatKrw: number | null }>) => void;
  exchangeRates: { rates: Record<string, number>; fetchedAt: string; source: "frankfurter" | "fallback" } | null;
  exchangeRatesLoading: boolean;
  onRefreshExchangeRates: () => void;
  /** PHASE 3.2 추가지시(CPO, 2026-09-11) — 이 카드에서 내려간 시장 정보로 가는
   * 단 하나의 통로. 값을 가져오는 함수가 아니라 화면 이동이다(여기서 시장
   * 데이터를 다시 조회하지 않는다 — 그러면 블록을 뺀 의미가 없다). */
  onOpenMarketComparison?: () => void;
}) {
  const breakdownInput = product.priceBreakdown ?? DEFAULT_PRICE_BREAKDOWN_INPUT;

  // Sprint A-11/N-3.9(Part I) — Settings의 "가격 정책"(반올림 단위) 등 판매자
  // 공통 기본값. 상품별로 사용자가 breakdownInput을 고치면 이 상품의
  // priceBreakdown에만 저장되고 Settings 기본값 자체는 바뀌지 않는다.
  //
  // UX 2.5 — "기본 마진율을 이 상품에 한 번 반영한다"는 일은 여기서 하지
  // 않는다. 그 일은 CommerceWorkspace로 올라갔다: 편집기가 채널 화면에 항상
  // 떠 있던 시절에는 여기 두어도 늘 실행됐지만, 이제는 셀러가 가격 화면을
  // 펼쳐야만 이 컴포넌트가 마운트된다 — 화면을 옮겼다는 이유로 실제 등록가가
  // 달라지면 안 된다(CommerceWorkspace의 해당 주석 참고).
  const [sellerDefaults, setSellerDefaults] = useState<{
    priceRoundingUnit: number;
    /** P-3-2(대표님 지시, 2026-08-28) — Settings에 저장된 국내 배송원가
     * 기본값. PriceEditor는 이 값을 읽기전용으로 보여주기만 한다(수정은
     * Settings에서만 — SellerProfile 필드라 상품별로 다르게 저장할 곳이
     * 없다, P-3-1에서 확정한 설계). */
    domesticShippingCostKrw: number | null;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/coupang/profiles")
      .then((res) => res.json())
      .then(
        (data: {
          profiles?: Array<{
            isDefault: boolean;
            priceRoundingUnit: number;
            domesticShippingCostKrw: number | null;
          }>;
        }) => {
          if (cancelled) return;
          const list = data.profiles ?? [];
          const p = list.find((x) => x.isDefault) ?? list[0] ?? null;
          if (p)
            setSellerDefaults({
              priceRoundingUnit: p.priceRoundingUnit,
              domesticShippingCostKrw: p.domesticShippingCostKrw,
            });
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

  // PHASE 3.2 추가지시(CPO, 2026-09-11) — "가격 계산 카드에서 시장 정보를 뺀다".
  //
  // 여기 있던 것: price-intelligence API 2회 조회(기본 + expand)와 그 결과로
  // 그리던 해외 원본가 · 원화 환산가 · 그 판매처의 한국 표시가 · 국가별 비교표.
  //
  // 왜 뺐나: 이 카드가 답해야 하는 질문은 "얼마에 팔면 얼마가 남는가" 하나다.
  // 같은 카드 안에서 다른 나라 표시가를 나열하면 셀러는 계산을 읽다 말고
  // 비교를 시작하고, 무엇보다 "원본 가격"(내가 치르는 값)과 "한국向 표시가"
  // (그 판매처가 한국에 파는 값)가 같은 화면에서 자리를 다툰다 — 라벨이 달라도
  // 나란히 놓이는 순간 하나로 읽힌다.
  //
  // 사실이 사라진 것이 아니라 자리를 옮겼다. 시장 근거는 이미 ② 🌎 판매자
  // 글로벌 시장 가격 / ③ 📊 한국 시장 경쟁가격이 책임지고 있고(price-hierarchy.ts의
  // PRICE_SECTION_TITLE), 아래 한 줄 링크가 거기로 데려간다. 조회 2회도 함께
  // 사라져서 이 카드는 이제 서버를 한 번도 부르지 않는다(판매자 기본값 조회 제외).

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
  // 커밋 아님, 입력칸을 고치거나 "적용" 버튼을 눌러야 실제로 저장된다). 위
  // 배송비/수수료/마진/원본가격이 실시간 재계산돼도 이 값은 그대로 유지된다
  // (자동 적용 금지) — 다만 아직 override가 없는 경우엔 권장가를 보여주는
  // 중이므로 그 미리보기 자체는 실시간으로 따라간다.
  const finalPriceKrw = product.priceOverrideKrw?.value ?? breakdown.suggestedPriceKrw;
  const feeAmountKrw = Math.round((finalPriceKrw * draftInput.feePercent) / 100);
  const netProfitKrw = finalPriceKrw - breakdown.landedCostKrw - feeAmountKrw;

  // P2-2(CEO 지시, 2026-09-12) — "권장 판매가격 ₩143,500"과 "최종 판매가격
  // ₩143,500"이 같은 숫자로 나란히 떠 있는데, 화면이 그 둘의 **관계**를 말한
  // 적이 없다. 셀러가 실제로 묻는 것은 "같은 값인가, 다른 값인가"이고 답은
  // 셋뿐이다:
  //   ① 아직 저장 전이라 권장가를 그대로 비추고 있다(자동 적용된 것이 아니다)
  //   ② 저장했는데 마침 권장가와 같다
  //   ③ 저장한 값이 권장가와 다르다 — 그 차액이 곧 셀러가 내린 판단이다
  //
  // 여기서 새로 계산하는 가격은 없다. 이미 화면에 떠 있는 두 숫자의 차이를
  // 말로 옮길 뿐이고, 최종 판매가격이 바뀌는 길은 여전히 입력칸과 [최종
  // 판매가격에 적용] 둘뿐이다 — 권장가가 최종가로 조용히 넘어가지 않는다.
  const recommendedPriceKrw = breakdown.suggestedPriceKrw;
  const finalMinusRecommendedKrw = finalPriceKrw - recommendedPriceKrw;
  const recommendationRelation = !product.priceOverrideKrw
    ? "최종 판매가격을 아직 저장하지 않아 위 칸이 이 값을 그대로 비추고 있습니다 — [최종 판매가격에 적용]을 눌러야 실제 등록가가 됩니다."
    : finalMinusRecommendedKrw === 0
      ? "저장된 최종 판매가격과 같은 금액입니다."
      : `저장된 최종 판매가격이 ${formatKrw(Math.abs(finalMinusRecommendedKrw))} ${
          finalMinusRecommendedKrw > 0 ? "높습니다" : "낮습니다"
        }.`;

  // PHASE 3.2 추가지시 — 기본으로 펼쳐 둔다(▾). 셀러는 ③ 등록 준비에서
  // "판매가격"을 골라 이 화면을 **보러** 온 것이라, 보러 온 것을 한 번 더
  // 접어두지 않는다(UX 2.5의 판단 그대로). 접을 수 있게만 남긴다.
  const [detailOpen, setDetailOpen] = useState(true);

  if (priceUnresolved) {
    return (
      <section className="rounded-lg border border-border px-4 py-3 text-sm">
        <h3 className="text-base font-medium">가격 계산</h3>
        <div className="mt-2.5">
          <PriceUnresolvedBanner product={product} />
        </div>
        {onUpdateOriginalPrice && (
          <div className="mt-2.5 rounded-md border border-border bg-background px-3 py-2.5">
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
                알려주는 안내라 계산 설명(secondary)이다. text-[11px]/tertiary는
                실제 화면에서 읽히지 않아 있으나 마나였다. */}
            <p className="mt-1 text-xs text-text-secondary">
              원본 가격과 통화를 모두 정확히 입력하면(0보다 큰 값) 자동으로 가격 계산이 다시 시작됩니다.
            </p>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border px-4 py-3 text-sm">
      {/* P2-1(CEO 지시, 2026-09-12) — 제목 바로 아래에 있던 두 줄짜리 안내문을
          없앴다. 내용이 틀려서가 아니라 **같은 말이 아래에 두 번 더 있었기**
          때문이다: "고치면 즉시 다시 계산된다"는 상세 맨 아래 추정치 문단이,
          "최종 판매가격은 직접 입력하거나 적용을 눌러야 바뀐다"는 바로 아래
          최종 판매가격 칸의 안내가 이미 말한다. 사실을 지운 것이 아니라 세
          벌이던 사본을 한 벌로 줄인 것이다(정보 삭제 아님). */}
      <h3 className="text-base font-medium">가격 계산</h3>

      {/* PHASE 3.2 추가지시(CPO, 2026-09-11) — 카드의 순서를 원래 모양으로 되돌린다.
       *
       * 맨 위는 **최종 판매가격**이다. UX 2.5에서는 계산 사슬을 먼저 펼쳐 놓고
       * 최종 판매가격을 그 아래에 뒀는데, 셀러가 이 카드에 오는 이유는 "그래서
       * 얼마에 팔 건가"이고 그 답이 스크롤 끝에 있으면 카드를 다 읽어야 답이
       * 나온다. 결론을 맨 위에 두고, 그 결론이 어떻게 나왔는지는 바로 아래
       * "가격 계산 상세"에 순서대로 둔다(기본으로 펼쳐 둔다 — 보러 온 것을 한 번
       * 더 접지 않는다는 UX 2.5의 판단은 그대로 유효하다).
       *
       * 계산은 한 줄도 바뀌지 않았다. computePriceBreakdown() 하나가 여전히
       * 유일한 산식이고 환율·착지원가·마진 역산도 그대로다 — 바뀐 것은 읽는
       * 순서뿐이다. */}
      <div className="mt-2.5 rounded-md border border-border bg-background px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
            최종 판매가격
            {product.priceOverrideKrw && (
              <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                ✎ 수정됨
              </span>
            )}
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
        {/* P2-1/P2-4 — 문단 둘을 하나로 합쳤다. 위 문단은 "이 값이 저장된
            값인가", 아래 문단은 "이 값이 채널에 어떻게 쓰이는가"였는데, 둘 다
            같은 한 숫자를 설명하는 말이라 두 덩어리로 떨어져 있을 이유가 없었다.
            사실은 셋 다 남는다: ① 저장 여부 ② 모든 채널의 기본값 ③ 채널에서
            고쳐도 이 값은 안 움직인다.
            크기는 한 단계 올린다(text-[11px]/tertiary → text-xs/secondary) —
            상태를 말하는 문장이 실제 화면에서 읽히지 않으면 없는 것과 같다. */}
        <p className="mt-1 text-xs text-text-secondary">
          {product.priceOverrideKrw
            ? "직접 저장한 값입니다 — 아래 계산 값이 바뀌어도 따라 움직이지 않습니다."
            : "아직 저장된 값이 없어 권장 판매가격을 보여주고 있습니다 — 입력하거나 버튼을 눌러야 저장됩니다."}{" "}
          모든 채널의 기본 등록가격이며, 특정 채널만 다르게 등록하려면 그 채널 화면에서 고칩니다(그때도 이 값은 그대로입니다).
        </p>
        <PriceProvenanceRow product={product} breakdown={breakdown} />
      </div>

      <button
        type="button"
        onClick={() => setDetailOpen((v) => !v)}
        className="mt-2.5 text-xs font-medium text-primary hover:underline"
      >
        {detailOpen ? "▾ 가격 계산 상세" : "▸ 가격 계산 상세"}
      </button>

      {/* P2-1 — 줄 간격 space-y-2.5(10px) → space-y-1.5(6px). 사슬은 열 줄이라
          줄 사이 여백만으로 36px이 줄어든다. 줄을 지우거나 합치지 않았다 —
          순서도 개수도 그대로다. */}
      {detailOpen && (
        <div className="mt-2 space-y-1.5 text-xs">
          {/* 사슬의 순서 = 계산 순서다. 원본 가격 → 환율 → 원화 환산 →
              국제배송비 → 착지원가 → 수수료율/마진율 → 권장 판매가격 →
              수수료 금액 → 예상 이익. 순서가 흐트러지면 "무엇을 더해서 이 값이
              됐는지"를 읽을 수 없게 된다.

              라벨은 price-hierarchy.ts의 표에서만 가져온다(원화 환산 ·
              국제배송비 · 착지원가). 같은 숫자를 판단 카드의 ④ 수익성 사슬은
              "원화 환산"이라 부르는데 이 카드만 "상품 원가"라고 부르면, 셀러는
              두 화면에서 서로 다른 값을 봤다고 읽는다 — 이 저장소가 반복해서
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
              들어간다 — 고치면 아래 권장 판매가격이 즉시 다시 계산된다. 카드
              맨 위 요약에는 올리지 않는다: 지금 활성 채널이 둘인데 "수수료 10%"
              한 줄을 결론 옆에 두면 그게 어느 채널의 요율인지 화면이 답할 수 없다. */}
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

          {/* P2-2(CEO 지시, 2026-09-12) — 권장 판매가격과 최종 판매가격이 같은
              ₩143,500으로 떠 있어도 둘은 다른 사실이다:
                권장 판매가격 = 이 사슬이 낸 **계산 결과**(AI 추천)
                최종 판매가격 = 실제 등록에 쓰일 **상품 기본 판매가격**
              지금까지 두 줄은 같은 크기(text-base font-semibold)·같은 색으로
              떠 있어서 어느 쪽이 실제로 팔리는 값인지 화면이 답하지 않았다.
              결론(위 칸)은 크기를 그대로 두고 여기를 한 단계 내린다(text-sm ·
              secondary) — 값을 감추는 것이 아니라 둘의 층위를 보이게 하는 것이다.
              그리고 관계를 한 줄로 직접 말한다(같은 금액인지, 얼마나 다른지). */}
          <div className="flex flex-wrap items-center justify-between gap-x-3 border-t border-border pt-1.5">
            <span className="flex items-center gap-1.5 font-medium text-text-primary">
              권장 판매가격
              <ValueBadge kind="aiSuggested" />
            </span>
            <span className="text-sm font-semibold text-text-secondary">{formatKrw(recommendedPriceKrw)}</span>
            <span className="w-full text-xs text-text-secondary">{recommendationRelation}</span>
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

          {/* PHASE 3.2 추가지시 — 시장 정보는 이 카드에 들어오지 않는다. 여기
              있던 국가별 원본가격 비교표/한국向 표시가는 ②·③으로 돌아갔고,
              남는 것은 거기로 가는 링크 한 줄뿐이다(블록이 아니라 링크여야
              한다 — 블록이 되는 순간 계산 카드가 다시 비교 카드가 된다). */}
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
            domesticShippingCostKrw={sellerDefaults?.domesticShippingCostKrw ?? null}
            customsDutyKrw={product.customsDutyKrw?.value ?? null}
            customsVatKrw={product.customsVatKrw?.value ?? null}
            onUpdateCustomsCost={onUpdateCustomsCost}
          />
        </div>
      )}
    </section>
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
          가른다. 설명 문장이 tertiary 11px이라 실제로는 읽히지 않았는데, 이
          문장이야말로 "왜 이 숫자가 권장 판매가격을 안 바꾸는가"에 대한 답이다. */}
      <p className="text-xs font-medium text-text-primary">예상 구매 비용(Market Intelligence 판단용)</p>
      <p className="text-xs text-text-secondary">
        위 권장 판매가격 계산에는 반영되지 않습니다 — 아래 &ldquo;Market Intelligence&rdquo;의 예상 마진/판매 판단에만
        쓰입니다.
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
 * 아닐 때만 렌더된다. CPO가 지정한 문구/버튼 2개를 그대로 쓴다 — MISSING/
 * INVALID/UNRESOLVED를 화면에서 굳이 구분해 보여주지 않는다(내부 판정은
 * 구분하되, 사용자에게는 "원본 가격을 확인할 수 없다"는 동일한 다음 행동을
 * 요구하기 때문). priceRawText(INVALID일 때만 있음)가 있으면 원문을 그대로
 * 보여준다 — 값을 지어내지 않는다. */
function PriceUnresolvedBanner({ product }: { product: CanonicalProduct }) {
  return (
    <div className="rounded-md border border-warning bg-warning-soft p-3 text-sm text-warning">
      <p className="font-medium">⚠️ 원본 상품 가격을 확인할 수 없습니다. 해외 사이트의 가격을 확인한 후 등록할 수 있습니다.</p>
      {product.priceRawText && (
        <p className="mt-1 text-[11px] opacity-80">
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

/**
 * N-3.16 잔여3(CPO 지시: "원본 ₩109,620 · AI 추천 ₩235,300 · 사용자 확정
 * ₩235,300"처럼 어느 값이 어디서 왔는지 배지로 보여준다) — 값의 출처 한 줄.
 *
 * UX 2.5 — 예전에는 이 줄 위에 "최종 판매가 ₩235,300" 헤드라인이 같이 붙어
 * 있었고(PriceSummaryStrip), 그래서 같은 숫자가 카드 맨 위와 아래 입력칸에서
 * 두 번 떴다. 이제 최종 판매가격은 입력칸 한 곳에서만 말하고, 이 줄은 출처만
 * 남는다 — 숫자는 여전히 호출부가 이미 계산해둔 breakdown/product를 그대로
 * 읽기만 하므로 갈릴 수가 없다.
 */
function PriceProvenanceRow({
  product,
  breakdown,
}: {
  product: CanonicalProduct;
  breakdown: ReturnType<typeof computePriceBreakdown>;
}) {
  return (
    // P2-4 — 여기 있는 것은 설명 문구가 아니라 **숫자 셋**이다(원본가 · 추천가 ·
    // 확정가). 숫자를 tertiary 회색으로 두면 배지만 보이고 값이 안 읽힌다 —
    // 라벨(배지)은 그대로 두고 숫자만 한 단계 올린다.
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-border pt-1.5 text-[11px] text-text-secondary">
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
