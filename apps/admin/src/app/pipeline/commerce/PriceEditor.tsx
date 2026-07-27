"use client";

import type { CanonicalProduct } from "@commerce/shared";
import { convertToKrw, formatKrw, formatOriginalPrice } from "@commerce/pricing";
import { EditableText } from "./EditableField";

/**
 * "원본 가격"(product.price, 원본 통화 그대로)은 절대 건드리지 않는다 — 판매가만
 * 따로 입력받아 product.priceOverrideKrw에 저장한다(onUpdateSalePriceKrw). 저장
 * 버튼이 없다: 입력 → state 업데이트 → 이 화면 아래 등록 Preview까지 즉시
 * 반영되는 controlled input이다.
 */
export function PriceEditor({
  product,
  onUpdateSalePriceKrw,
}: {
  product: CanonicalProduct;
  onUpdateSalePriceKrw: (amountKrw: number) => void;
}) {
  const estimated = convertToKrw(product.price.value.amount, product.price.value.currency);
  const salePriceKrw = product.priceOverrideKrw?.value ?? estimated.amountKrw;
  // 아주 대략적인 참고용 마진이다 — 배송비/관세/부가세/쿠팡 수수료를 전혀
  // 반영하지 않는다(가격 자동계산 자체는 이번 범위 밖). "정확한 마진"이 아니라
  // "판매가가 원가 대비 얼마나 남는지" 감을 잡는 용도로만 보여준다.
  const roughMargin = salePriceKrw - estimated.amountKrw;

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
          <p className="text-xs text-text-secondary">현재 환율 기준 예상 원가{estimated.isEstimate ? " (추정)" : ""}</p>
          <p className="mt-0.5 text-sm text-text-secondary">약 {formatKrw(estimated.amountKrw)}</p>
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
    </section>
  );
}
