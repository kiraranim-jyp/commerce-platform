"use client";

import type { CanonicalProduct } from "@commerce/shared";
import { EditableText, EditableTextarea } from "./EditableField";
import { ProvenanceBadge } from "./provenance";

export function AIContentPanel({
  product,
  onGenerate,
  onUpdateField,
  onUpdateKeywords,
}: {
  product: CanonicalProduct;
  onGenerate: () => void;
  onUpdateField: (
    key: "titleKo" | "descriptionKo" | "seoTitle" | "seoDescription",
    value: string,
  ) => void;
  onUpdateKeywords: (raw: string) => void;
}) {
  const hasContent = product.titleKo.value.trim().length > 0;

  if (!hasContent) {
    return (
      <section className="rounded-lg border border-border bg-surface p-8 text-center shadow-subtle">
        <p className="text-2xl">✨</p>
        <h3 className="mt-3 text-base font-semibold tracking-tight text-text-primary">
          AI 상품 콘텐츠를 아직 만들지 않았습니다
        </h3>
        <p className="mt-1.5 text-sm text-text-secondary">
          추출된 상품명·브랜드·소재·카테고리를 바탕으로 한국어 상품명, 상세설명,
          검색 키워드, SEO 정보를 한 번에 만들어 드립니다.
        </p>
        <button
          type="button"
          onClick={onGenerate}
          className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-subtle transition-colors hover:bg-primary-hover"
        >
          AI 콘텐츠 생성
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-surface p-4 text-sm shadow-subtle">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-text-primary">
              AI 상품 콘텐츠
            </h3>
            <p className="mt-0.5 text-xs text-ai">✨ AI가 상품 정보를 분석해 만들었습니다</p>
          </div>
          <button
            type="button"
            onClick={onGenerate}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-background"
          >
            다시 생성
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <Field label="상품명" field={product.titleKo}>
            <EditableText
              value={product.titleKo.value}
              onCommit={(v) => onUpdateField("titleKo", v)}
              className="w-full rounded-md border border-border px-2 py-1.5 text-sm text-text-primary focus:border-primary focus:outline-none"
            />
          </Field>

          <Field label="상세설명" field={product.descriptionKo}>
            <EditableTextarea
              value={product.descriptionKo.value}
              onCommit={(v) => onUpdateField("descriptionKo", v)}
              className="w-full whitespace-pre-line rounded-md border border-border px-2 py-1.5 text-sm text-text-primary focus:border-primary focus:outline-none"
            />
          </Field>

          <Field label="검색 키워드" field={product.keywords}>
            <EditableText
              value={product.keywords.value.join(", ")}
              onCommit={onUpdateKeywords}
              placeholder="쉼표로 구분"
              className="w-full rounded-md border border-border px-2 py-1.5 text-sm text-text-primary focus:border-primary focus:outline-none"
            />
            {product.keywords.value.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {product.keywords.value.map((kw) => (
                  <span
                    key={kw}
                    className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </Field>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 text-sm shadow-subtle">
        <h4 className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
          SEO
        </h4>
        <div className="mt-3 space-y-4">
          <Field label="SEO 제목" field={product.seoTitle}>
            <EditableText
              value={product.seoTitle.value}
              onCommit={(v) => onUpdateField("seoTitle", v)}
              className="w-full rounded-md border border-border px-2 py-1.5 text-sm text-text-primary focus:border-primary focus:outline-none"
            />
          </Field>
          <Field label="SEO 설명" field={product.seoDescription}>
            <EditableText
              value={product.seoDescription.value}
              onCommit={(v) => onUpdateField("seoDescription", v)}
              className="w-full rounded-md border border-border px-2 py-1.5 text-sm text-text-primary focus:border-primary focus:outline-none"
            />
          </Field>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  field,
  children,
}: {
  label: string;
  field: { source: "ORIGINAL" | "GENERATED" | "EDITED" };
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <label className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
          {label}
        </label>
        <ProvenanceBadge source={field.source} />
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
