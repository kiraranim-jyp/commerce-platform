"use client";

import type { CanonicalProduct } from "@commerce/shared";
import { EditableText } from "./EditableField";

/**
 * P0-3(등록 필수 정보 Editor) — Compliance/Source Data가 지금까지 "보여주기만"
 * 했던 필드들(SKU/제조자/제조국/재고/인증정보) 중 등록 시 실제로 쓰이는 것들을
 * 한 카드에 모아 직접 고칠 수 있게 한다. 배송비/재고/SKU/제조자/제조국은 이미
 * CanonicalProduct에 있던 필드다 — 새 스키마가 아니라 "흩어져 있던 걸 한 곳에
 * 모아 편집 가능하게" 만드는 작업이다.
 *
 * 출고지/반품지/배송방법은 여기 없다 — 그건 상품 단위가 아니라 판매자 계정
 * 단위 설정(SellerProfile, Settings 페이지)이라 상품마다 다시 입력받는 게
 * 오히려 혼란을 준다. 대신 미설정 시 "설정 필요" 배너(settingsMissing)로
 * 이미 막고 있다 — 이 카드는 그 배너를 대체하지 않고 함께 존재한다.
 *
 * 필드 색상(빨간 "필수" 표시)은 실제 등록 검증(coupang.adapter.ts의
 * FieldRule)에서 ERROR로 잡는 것과 정확히 일치시킨다 — 여기서 "필수"라고
 * 표시해놓고 실제로는 안 막으면(또는 반대로) CP001과 같은 종류의 신뢰 문제가
 * 생긴다.
 */
export function RequiredFieldsEditor({
  product,
  onUpdateField,
  onUpdateNumberField,
}: {
  product: CanonicalProduct;
  onUpdateField: (
    field: "brand" | "sku" | "manufacturer" | "countryOfOrigin" | "certification",
    value: string,
  ) => void;
  onUpdateNumberField: (field: "shippingFee" | "stockQuantity", value: number) => void;
}) {
  return (
    <section className="rounded-lg border border-border p-4 text-sm">
      <h3 className="text-base font-medium">등록 필수 정보</h3>
      <p className="mt-1 text-xs text-text-secondary">
        Resolver가 자동으로 채운 값입니다 — 실제 상품과 다르면 직접 고쳐주세요.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
        <FieldRow label="브랜드" required>
          <EditableText
            value={product.brand.value}
            onCommit={(v) => onUpdateField("brand", v)}
            placeholder="브랜드 미확인"
            className="w-full rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
          />
        </FieldRow>
        <FieldRow label="SKU">
          <EditableText
            value={product.sku.value}
            onCommit={(v) => onUpdateField("sku", v)}
            placeholder="SKU 없음"
            className="w-full rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
          />
        </FieldRow>
        <FieldRow label="제조자">
          <EditableText
            value={product.manufacturer.value}
            onCommit={(v) => onUpdateField("manufacturer", v)}
            placeholder="제조자 미확인"
            className="w-full rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
          />
        </FieldRow>
        <FieldRow label="제조국">
          <EditableText
            value={product.countryOfOrigin.value}
            onCommit={(v) => onUpdateField("countryOfOrigin", v)}
            placeholder="제조국 미확인"
            className="w-full rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
          />
        </FieldRow>
        <FieldRow label="인증정보(KC 등)">
          <EditableText
            value={product.certification.value}
            onCommit={(v) => onUpdateField("certification", v)}
            placeholder="해당 없음"
            className="w-full rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
          />
        </FieldRow>
        <FieldRow label="재고">
          <div className="flex items-center gap-1">
            <EditableText
              value={String(product.stockQuantity.value)}
              onCommit={(v) => onUpdateNumberField("stockQuantity", Math.max(0, Number(v) || 0))}
              className="w-full rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
            />
            <span className="text-xs text-text-secondary">개</span>
          </div>
        </FieldRow>
        <FieldRow label="배송비">
          <div className="flex items-center gap-1">
            <span className="text-xs text-text-secondary">₩</span>
            <EditableText
              value={String(product.shippingFee.value)}
              onCommit={(v) => onUpdateNumberField("shippingFee", Math.max(0, Number(v) || 0))}
              className="w-full rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </FieldRow>
      </div>
    </section>
  );
}

function FieldRow({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-text-secondary">
        {label}
        {required && <span className="ml-0.5 text-error">*</span>}
      </label>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
