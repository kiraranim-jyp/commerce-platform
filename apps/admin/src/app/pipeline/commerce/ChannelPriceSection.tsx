"use client";

import { useState } from "react";
import { CHANNEL_PRICE_ORIGIN_LABEL, type ChannelPriceOrigin } from "@commerce/marketplace";
import { formatKrw } from "@commerce/pricing";

/**
 * PHASE 3.2(CPO 확정, 2026-09-11) — 채널 화면의 "최종 등록가격" 한 칸.
 *
 * 기본은 읽기 전용이다:
 *
 *   스마트스토어
 *   판매가격  ₩143,500
 *   상품정보 가격을 사용합니다.
 *   [ 수정 ]
 *
 * [수정]을 눌러야만 이 채널 전용 값을 만든다. 편집창을 처음부터 펼쳐두면
 * 셀러는 "채널마다 가격을 따로 정해야 하는구나"로 읽고, 그건 UX 2.5가 없앤
 * 바로 그 오해다 — 가격을 **정하는 곳**은 여전히 상품정보 하나다.
 *
 * 이 컴포넌트는 어떤 가격도 계산하지 않는다. 화면에 보이는 숫자는 어댑터가
 * 이미 해석해 넘겨준 listing.priceKrw이고, 여기서 하는 일은 "이 채널에만
 * 적용할 금액"을 위로 올려보내는 것뿐이다. 상품정보 가격을 건드리는 경로는
 * 이 파일에 존재하지 않는다.
 */
export function ChannelPriceSection({
  platformLabel,
  priceKrw,
  priceOrigin,
  productPriceKrw,
  onUpdateChannelPrice,
  onRequestPriceReview,
}: {
  platformLabel: string;
  priceKrw: number;
  priceOrigin: ChannelPriceOrigin;
  /** 채널 최종가가 없을 때 이 채널이 쓰게 될 값(= 상품정보 최종 판매가격). */
  productPriceKrw: number | null;
  onUpdateChannelPrice?: (amountKrw: number | null) => void;
  onRequestPriceReview?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const hasChannelPrice = priceOrigin === "CHANNEL_OVERRIDE";
  const unresolved = priceOrigin === "UNRESOLVED";

  // 천단위 쉼표를 붙여 붙여넣어도(₩143,500 복사) 숫자로 읽힌다 — 셀러가 다른
  // 화면에서 그대로 복사해오는 게 가장 흔한 입력 방식이다.
  const parsedDraft = Number(draft.replace(/[^0-9.-]/g, ""));
  const draftValid = Number.isFinite(parsedDraft) && parsedDraft > 0;

  function startEditing() {
    // 편집을 시작할 때 지금 화면에 보이는 값을 그대로 넣는다 — 빈 칸에서
    // 시작하면 "수정"이 아니라 "처음부터 다시 입력"이 된다.
    setDraft(String(priceKrw));
    setEditing(true);
  }

  function apply() {
    if (!draftValid || !onUpdateChannelPrice) return;
    // 소수점은 등록가로 존재할 수 없다 — 반올림 규칙을 여기서 새로 만들지
    // 않고(쿠팡 10원 단위 검증은 기존 validateCoupangPricing이 그대로 잡는다)
    // 정수로만 자른다.
    onUpdateChannelPrice(Math.round(parsedDraft));
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-text-secondary" htmlFor="channel-price-input">
            판매가격
          </label>
          <div className="flex items-center gap-1">
            <span className="text-sm text-text-secondary">₩</span>
            <input
              id="channel-price-input"
              type="text"
              inputMode="numeric"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") apply();
                if (e.key === "Escape") setEditing(false);
              }}
              className="w-36 rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </div>
        <p className="text-[11px] text-text-tertiary">
          ※ 이 채널({platformLabel})에만 적용되는 최종 등록가격입니다. 상품정보의 최종 판매가격은 바뀌지 않습니다.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={apply}
            disabled={!draftValid}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            적용
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-background"
          >
            취소
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-1.5 text-sm text-text-secondary">
          판매가격
          <span className="text-base font-semibold text-text-primary">
            {unresolved ? "미확정" : formatKrw(priceKrw)}
          </span>
          {hasChannelPrice && (
            <span className="rounded-full bg-selected-soft px-2 py-0.5 text-[11px] text-selected">이 채널만</span>
          )}
        </p>
        {/* 이 화면이 보여주는 숫자가 그대로 등록 payload의 판매가로 들어간다
            (listing.priceKrw). 여기서 따로 계산하지 않으므로 갈릴 수 없다. */}
        <p className="mt-0.5 text-[11px] text-text-tertiary">
          {unresolved
            ? "원본 상품 가격을 확인할 수 없어 등록가를 계산하지 못했습니다 — 상품정보에서 원본 가격을 먼저 확인해주세요."
            : hasChannelPrice
              ? `상품정보 가격(${productPriceKrw != null ? formatKrw(productPriceKrw) : "미확정"}) 대신 이 채널에만 적용됩니다.`
              : `상품정보 가격을 사용합니다(${CHANNEL_PRICE_ORIGIN_LABEL[priceOrigin]}).`}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {/* 원본 가격을 못 읽은 상태에서는 채널 최종가를 제안하지 않는다 —
            그 값을 넣어도 등록은 여전히 PRICE_UNRESOLVED로 막히므로
            (validateCoupangPricing/validateNaverPayload), 고칠 수 있는 것처럼
            보여주면 셀러를 막다른 길로 보내는 셈이다. */}
        {onUpdateChannelPrice && !unresolved && (
          <button
            type="button"
            onClick={startEditing}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-background"
          >
            수정
          </button>
        )}
        {onUpdateChannelPrice && hasChannelPrice && (
          <button
            type="button"
            onClick={() => onUpdateChannelPrice(null)}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-background"
          >
            상품정보 가격 사용
          </button>
        )}
        {/* MI/PRICE-1(CEO 지시, 2026-09-12) — 도착지 이름이 바뀌었다. 이 버튼이
            데려가는 ③의 카드는 이제 계산하지 않고 확정만 한다(상세 계산은 MI ④
            한 곳으로 올라갔다). 버튼 이름과 도착지 제목이 다르면 눌렀을 때
            "여기가 맞나?"가 된다 — 이 저장소가 반복해서 고쳐 온 문제다. */}
        {onRequestPriceReview && (
          <button
            type="button"
            onClick={onRequestPriceReview}
            className="rounded-md border border-primary px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary-soft"
          >
            상품정보 판매가격 확정 →
          </button>
        )}
      </div>
    </div>
  );
}
