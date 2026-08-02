"use client";

import type { CanonicalProductVariant } from "@commerce/shared";
import { EditableText } from "./EditableField";

/**
 * Sprint A-12(작업6 — CPO 지시: "옵션 품질 개선 — SKU 자동/재고 자동/가격추가
 * 편집까지 가능해야 한다") — CanonicalProductVariant는 Sprint A(P0-2 Option
 * 모델 설계)부터 sku?/stockQuantity?/price?를 이미 갖고 있었지만 편집 UI가
 * 없어서 항상 비어 있었다. 여기서 새 필드를 만들지 않고 그 필드를 그대로
 * 노출·편집한다(CP001류 중복 모델 방지). 값이 비어 있으면 등록 시점에
 * build-payload.ts가 상품 대표값(SKU 없음/재고 기본치/상품 기본가)으로
 * 자동 폴백하므로, 이 표는 "다르게 하고 싶을 때만" 채우면 된다.
 */
export function OptionVariantEditor({
  variants,
  onUpdateVariant,
}: {
  variants: CanonicalProductVariant[];
  onUpdateVariant: (
    variantId: string,
    patch: Partial<{ sku: string; stockQuantity: number; price: { amount: number; currency: string } | undefined }>,
  ) => void;
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
            <th className="py-1.5 font-medium">가격(비워두면 상품 기본가)</th>
          </tr>
        </thead>
        <tbody>
          {variants.map((v) => (
            <VariantRow key={v.id} variant={v} onUpdateVariant={onUpdateVariant} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VariantRow({
  variant,
  onUpdateVariant,
}: {
  variant: CanonicalProductVariant;
  onUpdateVariant: (
    variantId: string,
    patch: Partial<{ sku: string; stockQuantity: number; price: { amount: number; currency: string } | undefined }>,
  ) => void;
}) {
  const combo = Object.values(variant.optionValues).join(" / ") || "-";

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
      <td className="py-1.5 pr-2">
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
      </td>
      <td className="py-1.5 pr-2">
        <EditableText
          value={variant.stockQuantity != null ? String(variant.stockQuantity) : ""}
          onCommit={(v) => {
            const n = Number(v);
            onUpdateVariant(variant.id, { stockQuantity: Number.isFinite(n) && n >= 0 ? n : undefined });
          }}
          placeholder="기본값"
          className="w-16 rounded border border-border px-1.5 py-1 focus:border-primary focus:outline-none"
        />
      </td>
      <td className="py-1.5">
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
      </td>
    </tr>
  );
}
