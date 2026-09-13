"use client";

import type { CanonicalProduct } from "@commerce/shared";
import { formatKrw } from "@commerce/pricing";
import { EditableText } from "./EditableField";
import { PRICE_SECTION_TITLE } from "./price-hierarchy";
import { ValueBadge } from "@/components/ui/ValueBadge";

/**
 * MI/PRICE-1(CEO 지시, 2026-09-12) — 이 카드는 **확정만 한다**.
 *
 * ── 무엇이 문제였나 ──────────────────────────────────────────────────────
 * 셀러 눈에 가격이 두 번 계산되는 것처럼 보였다. 계산이 두 번 돈 적은 없다 —
 * 갈라져 있던 것은 정보의 소유권이었다. MI가 "국내 시세 · 원가 · 예상 수익 ·
 * 마진"을 이미 말한 다음, 바로 아래에서 이 카드가 "원가 · 배송비 · 수수료 ·
 * 마진 · 권장 판매가격"을 처음부터 다시 말했다. 그래서 나온 질문이
 * "아까 MI에서 가격 봤는데, 아래에서 왜 또 가격을 계산하지?"였다.
 *
 * ── 이번에 정한 규칙 ─────────────────────────────────────────────────────
 *   계산은 한 번, 표현은 두 번 이하.
 *   MI = 판단("왜 143,500원인가?")   ·   등록 준비 = 확정("143,500원으로 할 것인가?")
 *
 * 그래서 이 카드에서 계산 사슬(원본가 → 환율 → 환산 → 국제배송비 → 착지원가 →
 * 수수료 → 마진 → 권장 판매가격)이 통째로 빠졌다. 지운 것이 아니라 소유자가
 * 바뀐 것이다 — 그 사슬은 이제 MI ③ 💰 수익성의 접힘 안, PriceCalculationDetail
 * 하나에서만 그려진다. 남는 질문은 여기서 하나뿐이다: **그래서 얼마로 팔 것인가.**
 *
 * ── UX 2.5(2026-09-11)에서 지킨 것은 그대로 지킨다 ────────────────────────
 * 이 컴포넌트는 여전히 화면 전체에서 **유일한 최종 판매가격 편집기**이고,
 * 상품정보 ③ 등록 준비 안에만 있다. 채널 화면은 등록에 쓰일 값을 읽기전용으로
 * 보여주고 [가격 수정하기]로 여기 데려온다. "어느 채널에서 고친 게 진짜인가"
 * 라는 질문 자체가 생기지 않는다는 그때의 성질이 이번 변경으로 깨지지 않았다.
 *
 * ── "자동 적용 금지"(N-3.9/N-3.10 CPO 지시) ──────────────────────────────
 * 권장 판매가격이 바뀌어도 최종 판매가격을 조용히 덮어쓰지 않는다. 실제 등록에
 * 쓰이는 값(priceOverrideKrw)이 바뀌는 길은 여전히 둘뿐이다: 최종 판매가격
 * 입력칸을 직접 고치거나 [최종 판매가격에 적용]을 누르는 것.
 *
 * ── 이 카드는 아무것도 계산하지 않는다 ───────────────────────────────────
 * 권장 판매가격은 props로 내려온다. CommerceWorkspace가 resolveListingPrice()
 * — 등록에 쓰일 판매가를 정하는 그 함수 하나 — 를 "확정값이 없다고 가정하고"
 * 한 번 부른 결과다. 이 카드가 스스로 computePriceBreakdown을 부르면 상세
 * 사슬과 이 카드가 각자 산술을 갖게 되고, 그때부터 같은 상품이 화면 위아래에서
 * 다른 권장가를 말한다(이 저장소에서 반복된 버그다).
 *
 * ── MI-UX-FINAL-4(CEO 지시, 2026-09-13) — 제목을 뗐다 ────────────────────
 * 이 카드는 자기 제목으로 「💰 판매가격 확정」을 그리고 있었는데, 이 카드가 서는
 * 자리는 **두 곳 다 이미 같은 이름의 제목을 갖고 있다**: ③ 등록 준비의 하위 항목
 * 버튼(판매가격)과, 그 밖 접힘 목록의 CollapsibleSection(💰 판매가격 확정).
 * 그래서 화면에는 언제나 「판매가격 확정 › 판매가격 확정」 두 층이 떠 있었다.
 *
 * 한 기능 = 한 제목 = 한 진입점. 제목은 이 카드를 **담는 자리**가 갖고(접었을
 * 때도 보여야 하므로 거기여야 한다), 이 카드는 내용만 갖는다. 이름 자체는
 * 그대로다(PREPARE_SURFACE_LABEL.PRICE) — 없앤 것은 이름이 아니라 중복이다.
 */
export function PriceEditor({
  product,
  recommendedPriceKrw,
  onUpdateSalePriceKrw,
  onOpenPriceCalculation,
}: {
  product: CanonicalProduct;
  /**
   * 권장 판매가격 — CommerceWorkspace가 resolveListingPrice()로 낸 값(확정값을
   * 무시하고 계산한 결과). 원본 가격을 읽지 못했으면 null이고, 그때는 확정할
   * 것 자체가 없다.
   */
  recommendedPriceKrw: number | null;
  onUpdateSalePriceKrw: (amountKrw: number) => void;
  /** MI ③ 💰 수익성의 [ⓘ 가격 계산 기준]을 펼치고 그 자리로 데려간다.
   * 여기서 계산하지도, 조회하지도 않는다 — 화면 이동 하나뿐이다. */
  onOpenPriceCalculation?: () => void;
}) {
  // N-3.54(CPO 지시) — 원본 가격을 못 읽었으면 "얼마로 팔 것인가"를 물을 수
  // 없다. 경고 배너 원본과 원본 가격 입력칸은 상세 계산(PriceCalculationDetail)이
  // 갖는다 — 같은 경고를 두 카드가 각자 그리면 셀러는 문제가 둘인 줄 안다.
  const priceUnresolved = product.priceValidity !== "VALID" || recommendedPriceKrw == null;

  // 최종 판매가격 표시값 — 아직 아무것도 확정하지 않았으면(priceOverrideKrw ==
  // null) 권장 판매가격을 그대로 비춰 보여주기만 한다(자동 커밋 아님).
  const finalPriceKrw = product.priceOverrideKrw?.value ?? recommendedPriceKrw ?? 0;

  // P2-2(CEO 지시, 2026-09-12) — 권장가와 최종가가 같은 ₩143,500으로 나란히
  // 떠 있는데 화면이 그 둘의 **관계**를 말한 적이 없었다. 셀러가 실제로 묻는
  // 것은 "같은 값인가, 다른 값인가"이고 답은 셋뿐이다:
  //   ① 아직 저장 전이라 권장가를 그대로 비추고 있다(자동 적용된 것이 아니다)
  //   ② 저장했는데 마침 권장가와 같다
  //   ③ 저장한 값이 권장가와 다르다 — 그 차액이 곧 셀러가 내린 판단이다
  //
  // 여기서 새로 계산하는 가격은 없다. 이미 화면에 떠 있는 두 숫자의 차이를
  // 말로 옮길 뿐이다. 이 문장이 이 카드에 있는 이유는 두 값이 나란히 놓이는
  // 자리가 제품 전체에서 여기 하나이기 때문이다.
  const finalMinusRecommendedKrw = finalPriceKrw - (recommendedPriceKrw ?? 0);
  const recommendationRelation = !product.priceOverrideKrw
    ? "최종 판매가격을 아직 저장하지 않아 위 칸이 이 값을 그대로 비추고 있습니다 — [최종 판매가격에 적용]을 눌러야 실제 등록가가 됩니다."
    : finalMinusRecommendedKrw === 0
      ? "저장된 최종 판매가격과 같은 금액입니다."
      : `저장된 최종 판매가격이 ${formatKrw(Math.abs(finalMinusRecommendedKrw))} ${
          finalMinusRecommendedKrw > 0 ? "높습니다" : "낮습니다"
        }.`;

  if (priceUnresolved) {
    return (
      <section className="rounded-lg border border-border px-4 py-3 text-sm">
          <div className="mt-2.5 rounded-md border border-warning bg-warning-soft p-3 text-sm text-warning">
          <p className="font-medium">⚠️ 원본 상품 가격을 확인할 수 없어 판매가격을 확정할 수 없습니다.</p>
          {/* 여기서 원본 가격을 다시 묻지 않는다 — 입력칸은 상세 계산 한 곳에만
              있고, 그 자리로 데려가는 길만 남긴다. 같은 입력칸이 두 카드에
              생기면 어느 쪽이 실제로 저장되는지 화면이 답하지 못한다. */}
          <p className="mt-1 text-xs opacity-90">
            {PRICE_SECTION_TITLE.PROFITABILITY}의 [ⓘ 가격 계산 기준]에서 원본 가격을 직접 입력하면 계산이 다시
            시작됩니다.
          </p>
        </div>
        {onOpenPriceCalculation && (
          <button
            type="button"
            onClick={onOpenPriceCalculation}
            className="mt-2.5 rounded border border-primary px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
          >
            가격 계산 기준 열기 →
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border px-4 py-3 text-sm">

      <div className="mt-2.5 rounded-md border border-border bg-background px-3 py-2.5">
        {/* 권장 판매가격은 계산 **결과**이고 최종 판매가격은 실제 등록가다.
            둘이 같은 크기·같은 색으로 뜨면 화면이 "어느 쪽이 실제로 팔리는
            값인지"를 답하지 못한다 — 결론(아래 입력칸)은 크게, 계산 결과는 한
            단계 낮게 둔다(P2-2에서 정한 층위 그대로). */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="flex items-center gap-1.5 text-sm text-text-secondary">
            권장 판매가격
            <ValueBadge kind="aiSuggested" />
          </span>
          <span className="text-sm font-semibold text-text-secondary">{formatKrw(recommendedPriceKrw)}</span>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border pt-2">
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
              onClick={() => onUpdateSalePriceKrw(recommendedPriceKrw)}
              className="rounded border border-primary px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
            >
              최종 판매가격에 적용
            </button>
          </div>
        </div>

        <p className="mt-1.5 text-xs text-text-secondary">{recommendationRelation}</p>
      </div>

      {/* CPO 지시문의 한 줄 그대로. 이 카드가 답하는 마지막 사실이다 —
          "이 값이 어디까지 영향을 주는가". 계산을 여기서 다시 설명하지 않는다. */}
      <p className="mt-2 text-xs text-text-secondary">
        ※ 적용한 가격은 채널 등록가격의 기본값으로 사용됩니다 — 특정 채널만 다르게 등록하려면 그 채널 화면에서 고칩니다(그때도
        이 값은 그대로입니다).
      </p>

      {/* "왜 이 값인가"로 가는 단 하나의 통로. 답은 MI ④ 안에 있고, 이 카드는
          그 답을 복제하지 않는다(복제하는 순간 이번 지시 이전으로 돌아간다). */}
      {onOpenPriceCalculation && (
        <button
          type="button"
          onClick={onOpenPriceCalculation}
          className="mt-1.5 text-xs font-medium text-primary hover:underline"
        >
          가격 계산 기준 보기 →
        </button>
      )}
    </section>
  );
}
