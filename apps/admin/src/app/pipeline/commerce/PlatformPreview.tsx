"use client";

import type { ListingModel } from "@commerce/marketplace";
import { formatKrw } from "@commerce/pricing";
import { EditableText, EditableTextarea } from "./EditableField";
import { ValidationPanel } from "./ValidationPanel";

export function PlatformPreview({
  listing,
  onUpdateField,
  onUpdatePriceKrw,
}: {
  listing: ListingModel;
  onUpdateField: (key: "title" | "brand" | "description", value: string) => void;
  onUpdatePriceKrw: (amountKrw: number) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-lg border border-zinc-200 p-4 text-sm">
        <h3 className="text-base font-medium">{listing.platformLabel} 등록 미리보기</h3>

        <div className="mt-4 flex gap-4">
          <div className="h-40 w-40 flex-shrink-0 overflow-hidden rounded border border-zinc-200 bg-zinc-50">
            {listing.representativeImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={listing.representativeImage}
                alt="대표이미지"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                대표이미지 없음
              </div>
            )}
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <label className="text-xs text-zinc-500">상품명</label>
              <EditableText
                value={listing.title}
                onCommit={(v) => onUpdateField("title", v)}
                className="mt-0.5 w-full rounded border border-zinc-200 px-2 py-1 text-sm focus:border-zinc-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500">브랜드</label>
              <EditableText
                value={listing.brand ?? ""}
                onCommit={(v) => onUpdateField("brand", v)}
                placeholder="브랜드 미확인"
                className="mt-0.5 w-full rounded border border-zinc-200 px-2 py-1 text-sm focus:border-zinc-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500">
                판매가격{listing.priceIsEstimate ? " (환율 추정)" : ""}
              </label>
              <div className="mt-0.5 flex items-center gap-2">
                <EditableText
                  value={String(listing.priceKrw)}
                  onCommit={(v) => onUpdatePriceKrw(Number(v) || 0)}
                  className="w-32 rounded border border-zinc-200 px-2 py-1 text-sm focus:border-zinc-400 focus:outline-none"
                />
                <span className="text-xs text-zinc-500">{formatKrw(listing.priceKrw)}</span>
              </div>
            </div>
          </div>
        </div>

        {listing.additionalImages.length > 0 && (
          <div className="mt-4">
            <label className="text-xs text-zinc-500">
              추가이미지 ({listing.additionalImages.length})
            </label>
            <div className="mt-1 flex gap-2 overflow-x-auto">
              {listing.additionalImages.map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt=""
                  className="h-16 w-16 flex-shrink-0 rounded border border-zinc-200 object-cover"
                />
              ))}
            </div>
          </div>
        )}

        {listing.options.length > 0 && (
          <div className="mt-4">
            <label className="text-xs text-zinc-500">옵션</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {listing.options.map((opt) => (
                <span
                  key={opt}
                  className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700"
                >
                  {opt}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4">
          <label className="text-xs text-zinc-500">배송정보</label>
          <p className="mt-0.5 text-sm text-zinc-700">{listing.shippingInfo}</p>
        </div>

        <div className="mt-4">
          <label className="text-xs text-zinc-500">상세설명</label>
          <EditableTextarea
            value={listing.description}
            onCommit={(v) => onUpdateField("description", v)}
            placeholder="상세설명 없음"
            className="mt-0.5 w-full rounded border border-zinc-200 px-2 py-1 text-sm focus:border-zinc-400 focus:outline-none"
          />
        </div>
      </section>

      <ValidationPanel validations={listing.validations} score={listing.registrableScore} />
    </div>
  );
}
