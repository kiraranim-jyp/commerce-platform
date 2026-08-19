"use client";

import type { CanonicalProductVariant, FieldSource } from "@commerce/shared";
import { computeVariantFinalPriceKrw } from "@commerce/pricing";
import { ValueBadge, type ValueBadgeKind } from "@/components/ui/ValueBadge";
import { EditableText } from "./EditableField";

// N-3.18(CPO 지시: "가격/재고/SKU/사용자가 수정할 수 있는 값에는 적극적으로 표시한다") —
// variant의 skuSource/priceSource/stockQuantitySource는 "ORIGINAL"/"USER_EDITED" 둘만
// 쓴다(AI가 채우는 경로가 없음, 타입 주석 참고). undefined면(마이그레이션 이전 데이터)
// 출처를 모른다는 뜻이라 배지를 아예 그리지 않는다 — 추측 금지.
function variantSourceBadge(source: FieldSource | undefined) {
  if (!source) return null;
  const kind: ValueBadgeKind | null = source === "ORIGINAL" ? "original" : source === "USER_EDITED" ? "userConfirmed" : null;
  if (!kind) return null;
  return <ValueBadge kind={kind} className="mt-0.5" />;
}

/**
 * Sprint A-12(작업6 — CPO 지시: "옵션 품질 개선 — SKU 자동/재고 자동/가격추가
 * 편집까지 가능해야 한다") — CanonicalProductVariant는 Sprint A(P0-2 Option
 * 모델 설계)부터 sku?/stockQuantity?/price?를 이미 갖고 있었지만 편집 UI가
 * 없어서 항상 비어 있었다. 여기서 새 필드를 만들지 않고 그 필드를 그대로
 * 노출·편집한다(CP001류 중복 모델 방지). 값이 비어 있으면 등록 시점에
 * build-payload.ts가 상품 대표값(SKU 없음/재고 기본치/상품 기본가)으로
 * 자동 폴백하므로, 이 표는 "다르게 하고 싶을 때만" 채우면 된다.
 *
 * Sprint A-4(CPO 지시: "옵션별 가격 표는 옵션 | 원본가격 | 가격차이 |
 * 최종판매가로 보여준다") — "가격차이"/"최종판매가" 두 열은 실제 등록
 * payload가 쓰는 것과 동일한 함수(computeVariantFinalPriceKrw)로 미리
 * 계산해서 보여준다 — 화면에 보이는 값과 실제 등록되는 값이 다른 계산식을
 * 쓰면 안 된다는 원칙(CP001과 같은 종류의 재발 방지). build-payload.ts와
 * 마찬가지로 liveRates 없이(고정 환율) 계산한다 — 실제 등록 시점 계산과
 * 동일해야 미리보기가 의미 있다.
 */
export function OptionVariantEditor({
  variants,
  onUpdateVariant,
  baseProduct,
}: {
  variants: CanonicalProductVariant[];
  onUpdateVariant: (
    variantId: string,
    patch: Partial<{ sku: string; stockQuantity: number; price: { amount: number; currency: string } | undefined }>,
  ) => void;
  /** 등록 payload가 실제로 쓰는 기본 상품 원본가/최종 판매가(KRW) — 옵션별
   * "가격차이"/"최종판매가" 열을 계산하는 기준. 없으면 그 두 열을 그리지
   * 않는다(값을 지어내지 않는다). */
  baseProduct?: { amount: number; currency: string; finalKrw: number };
}) {
  if (variants.length === 0) return null;

  return (
    <div className="mt-3 overflow-x-auto">
      <p className="text-xs font-medium text-text-secondary">옵션 조합별 SKU · 재고 · 가격</p>
      <table className="mt-1.5 w-full min-w-[480px] border-collapse text-xs">
        <thead>
          <tr className="border-b border-border text-left text-text-tertiary">
            <th className="py-1.5 pr-2 font-medium">옵션 조합</th>
            <th className="py-1.5 pr-2 font-medium">SKU</th>
            <th className="py-1.5 pr-2 font-medium">재고</th>
            <th className="py-1.5 pr-2 font-medium">원본가격(비워두면 상품 기본가)</th>
            {baseProduct && (
              <>
                <th className="py-1.5 pr-2 font-medium">가격차이</th>
                <th className="py-1.5 font-medium">최종판매가</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {variants.map((v) => (
            <VariantRow key={v.id} variant={v} onUpdateVariant={onUpdateVariant} baseProduct={baseProduct} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VariantRow({
  variant,
  onUpdateVariant,
  baseProduct,
}: {
  variant: CanonicalProductVariant;
  onUpdateVariant: (
    variantId: string,
    patch: Partial<{ sku: string; stockQuantity: number; price: { amount: number; currency: string } | undefined }>,
  ) => void;
  baseProduct?: { amount: number; currency: string; finalKrw: number };
}) {
  const combo = Object.values(variant.optionValues).join(" / ") || "-";
  const priceResult =
    baseProduct && variant.price
      ? computeVariantFinalPriceKrw(baseProduct, { amount: variant.price.amount, currency: variant.price.currency, mode: variant.priceMode })
      : null;

  function autoSku() {
    // 결정론적 생성 — 옵션값을 그대로 슬러그화한다(무작위/AI 추측이 아니라
    // "재현 가능한 규칙"만 쓴다는 이 코드베이스의 DETERMINISTIC 소스 원칙과 같다).
    const slug = Object.values(variant.optionValues)
      .join("-")
      .replace(/\s+/g, "")
      .toUpperCase();
    onUpdateVariant(variant.id, { sku: slug || variant.id.slice(0, 8).toUpperCase() });
  }

  return (
    <tr className="border-b border-border/60">
      <td className="py-1.5 pr-2 text-text-primary">{combo}</td>
      <td className="py-1.5 pr-2 align-top">
        <div className="flex items-center gap-1">
          <EditableText
            value={variant.sku ?? ""}
            onCommit={(v) => onUpdateVariant(variant.id, { sku: v })}
            placeholder="자동"
            className="w-24 rounded border border-border px-1.5 py-1 focus:border-primary focus:outline-none"
          />
          {!variant.sku && (
            <button type="button" onClick={autoSku} className="shrink-0 text-[11px] text-primary hover:underline">
              생성
            </button>
          )}
        </div>
        {variantSourceBadge(variant.skuSource)}
      </td>
      <td className="py-1.5 pr-2 align-top">
        <EditableText
          value={variant.stockQuantity != null ? String(variant.stockQuantity) : ""}
          onCommit={(v) => {
            const n = Number(v);
            onUpdateVariant(variant.id, { stockQuantity: Number.isFinite(n) && n >= 0 ? n : undefined });
          }}
          placeholder="기본값"
          className="w-16 rounded border border-border px-1.5 py-1 focus:border-primary focus:outline-none"
        />
        {variantSourceBadge(variant.stockQuantitySource)}
      </td>
      <td className="py-1.5 align-top">
        <div className="flex items-center gap-1">
          <EditableText
            value={variant.price ? String(variant.price.amount) : ""}
            onCommit={(v) => {
              const n = Number(v);
              onUpdateVariant(
                variant.id,
                Number.isFinite(n) && n > 0 ? { price: { amount: n, currency: variant.price?.currency ?? "USD" } } : { price: undefined },
              );
            }}
            placeholder="상품 기본가"
            className="w-20 rounded border border-border px-1.5 py-1 focus:border-primary focus:outline-none"
          />
          {variant.price && <span className="text-[11px] text-text-tertiary">{variant.price.currency}</span>}
        </div>
        {variantSourceBadge(variant.priceSource)}
      </td>
      {baseProduct && (
        <>
          <td className="py-1.5 pr-2 align-top text-text-primary">
            {priceResult
              ? priceResult.applied
                ? `${priceResult.finalKrw - baseProduct.finalKrw >= 0 ? "+" : ""}${(priceResult.finalKrw - baseProduct.finalKrw).toLocaleString()}원`
                : "옵션가 통화 불일치 — 기본가 적용"
              : "옵션가 없음 — 기본가 적용"}
          </td>
          <td className="py-1.5 align-top font-medium text-text-primary">
            {(priceResult ? priceResult.finalKrw : baseProduct.finalKrw).toLocaleString()}원
          </td>
        </>
      )}
    </tr>
  );
}
