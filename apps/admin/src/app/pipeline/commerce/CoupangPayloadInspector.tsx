"use client";

import { useState } from "react";
import type { CoupangPayload } from "@commerce/listing";
import { formatKrw } from "@commerce/pricing";

/** base64 이미지처럼 아주 긴 문자열은 JSON 보기에서도 줄여서 보여준다. */
function payloadReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "string" && value.startsWith("data:") && value.length > 80) {
    return `${value.slice(0, 40)}…(${value.length}자)`;
  }
  return value;
}

export function CoupangPayloadInspector({ payload }: { payload: CoupangPayload }) {
  const [showJson, setShowJson] = useState(false);
  const item = payload.items[0];
  const representativeImage = item?.images.find((img) => img.imageType === "REPRESENTATION");
  const detailImages = item?.images.filter((img) => img.imageType === "DETAIL") ?? [];
  const description = item?.contents.flatMap((c) => c.contentDetails.map((d) => d.content)).join(" ") ?? "";

  return (
    <div className="space-y-3">
      <Section title="상품 정보">
        <Row label="상품명" value={payload.sellerProductName} />
        <Row label="브랜드" value={payload.brand || "미확인"} />
        <Row label="카테고리" value={payload.displayCategoryPath?.join(" > ") ?? "미지정"} />
        <Row label="옵션" value={item?.searchTags.join(", ") || "없음"} />
        <Row label="상세설명" value={description || "없음"} multiline />
      </Section>

      <Section title="이미지">
        <div className="flex flex-wrap gap-2">
          {representativeImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={representativeImage.vendorPath}
              alt="대표"
              className="h-14 w-14 rounded border-2 border-primary object-cover"
            />
          )}
          {detailImages.map((img) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={img.imageOrder}
              src={img.vendorPath}
              alt=""
              className="h-14 w-14 rounded border border-border object-cover"
            />
          ))}
        </div>
      </Section>

      <Section title="가격 / 재고">
        <Row
          label="판매가"
          value={`${formatKrw(item?.salePrice ?? 0)}${payload.priceIsEstimate ? " (환율 추정)" : ""}`}
        />
        <Row label="재고" value={`${item?.maximumBuyCount ?? 0}개`} />
      </Section>

      <Section title="배송 / 반품">
        <Row label="배송방법" value={payload.deliveryMethod} />
        <Row
          label="배송비"
          value={payload.deliveryChargeType === "FREE" ? "무료배송" : formatKrw(payload.deliveryCharge)}
        />
        <Row label="원산지" value={payload.countryOfOrigin || "미입력"} />
        <Row label="반품정책" value={payload.returnPolicy || "미입력"} />
      </Section>

      <button
        type="button"
        onClick={() => setShowJson((v) => !v)}
        className="text-xs font-medium text-text-secondary underline decoration-border hover:text-text-primary"
      >
        {showJson ? "Payload JSON 닫기" : "Payload JSON 보기"}
      </button>

      {showJson && (
        <pre className="max-h-64 overflow-auto rounded-md bg-background p-2 text-[11px] text-text-secondary">
          {JSON.stringify(payload, payloadReplacer, 2)}
        </pre>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border p-3">
      <h4 className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
        {title}
      </h4>
      <dl className="mt-2 space-y-1">{children}</dl>
    </div>
  );
}

function Row({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <dt className="w-16 shrink-0 text-text-secondary">{label}</dt>
      <dd className={`text-text-primary ${multiline ? "line-clamp-2" : ""}`}>{value}</dd>
    </div>
  );
}
