"use client";

import type { CanonicalProduct, FieldSource } from "@commerce/shared";
import { EditableText, EditableTextarea } from "./EditableField";
import { extractionSourceLabel, ProvenanceBadge } from "./provenance";

export function SourceDataView({
  product,
  onUpdateField,
  onUpdatePrice,
  onUpdateOptions,
}: {
  product: CanonicalProduct;
  onUpdateField: (
    key: "title" | "brand" | "sku" | "description" | "material",
    value: string,
  ) => void;
  onUpdatePrice: (amount: number, currency: string) => void;
  onUpdateOptions: (raw: string) => void;
}) {
  return (
    <section className="rounded-lg border border-border p-4 text-sm">
      <h3 className="text-base font-medium">Source Data</h3>
      <p className="mt-1 text-xs text-text-secondary">
        원본 사이트에서 추출한 상품 정보입니다. 값을 직접 수정할 수 있으며, 수정한 필드는
        &ldquo;수정됨&rdquo;으로 표시됩니다.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border text-xs text-text-secondary">
              <th className="w-24 py-2 pr-2 font-medium">필드</th>
              <th className="py-2 pr-2 font-medium">값</th>
              <th className="w-24 py-2 pr-2 font-medium">Source</th>
              <th className="w-20 py-2 pr-2 font-medium">Confidence</th>
              <th className="w-20 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            <Row label="상품명" field={product.title}>
              <EditableText value={product.title.value} onCommit={(v) => onUpdateField("title", v)} />
            </Row>
            <Row label="브랜드" field={product.brand}>
              <EditableText
                value={product.brand.value}
                onCommit={(v) => onUpdateField("brand", v)}
                placeholder="브랜드 미확인"
              />
            </Row>
            <Row label="가격" field={product.price}>
              <div className="flex items-center gap-2">
                <EditableText
                  value={String(product.price.value.amount)}
                  onCommit={(v) => onUpdatePrice(Number(v) || 0, product.price.value.currency)}
                  className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-border focus:border-primary focus:bg-surface focus:outline-none"
                />
                <EditableText
                  value={product.price.value.currency}
                  onCommit={(v) => onUpdatePrice(product.price.value.amount, v.toUpperCase())}
                  placeholder="통화"
                  className="w-16 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-border focus:border-primary focus:bg-surface focus:outline-none"
                />
              </div>
            </Row>
            <Row label="SKU" field={product.sku}>
              <EditableText
                value={product.sku.value}
                onCommit={(v) => onUpdateField("sku", v)}
                placeholder="SKU 없음"
              />
            </Row>
            <Row label="옵션" field={product.options}>
              <EditableText
                value={product.options.value.join(", ")}
                onCommit={onUpdateOptions}
                placeholder="옵션 없음 (쉼표로 구분)"
              />
            </Row>
            <Row label="소재" field={product.material}>
              <EditableText
                value={product.material.value}
                onCommit={(v) => onUpdateField("material", v)}
                placeholder="소재 미확인"
              />
            </Row>
            <Row label="상세설명" field={product.description}>
              <EditableTextarea
                value={product.description.value}
                onCommit={(v) => onUpdateField("description", v)}
                placeholder="상세설명 없음"
              />
            </Row>
            <tr className="border-b border-border align-top">
              <td className="py-2 pr-2 text-text-secondary">이미지</td>
              <td className="py-2 pr-2" colSpan={4}>
                {product.images.length === 0
                  ? "이미지 없음"
                  : `${product.images.length}장 (대표 ${product.images.filter((i) => i.isRepresentative).length}장 포함)`}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Row({
  label,
  field,
  children,
}: {
  label: string;
  field: { source: FieldSource; confidence: number };
  children: React.ReactNode;
}) {
  return (
    <tr className="border-b border-border align-top">
      <td className="py-2 pr-2 text-text-secondary">{label}</td>
      <td className="py-2 pr-2">{children}</td>
      <td className="py-2 pr-2 text-xs text-text-secondary">{extractionSourceLabel(field)}</td>
      <td className="py-2 pr-2 text-xs text-text-secondary">
        {field.source === "EDITED" ? "—" : `${Math.round(field.confidence * 100)}%`}
      </td>
      <td className="py-2">
        <ProvenanceBadge source={field.source} />
      </td>
    </tr>
  );
}
