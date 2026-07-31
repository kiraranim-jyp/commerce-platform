"use client";

import type { CoupangCategoryMeta } from "@commerce/listing";
import { EditableText } from "./EditableField";

/**
 * Sprint A #1(가장 중요) — CPO가 실측으로 지적한 문제: "지금은 카테고리를
 * 선택해도 아무것도 안 생긴다. 그래서 등록하려고 하면 카테고리 코드 없음,
 * 속성 없음 같은 오류가 계속 발생한다." 원인은 카테고리 메타(필수 구매옵션/
 * 고시정보) API(/api/coupang/category-meta)가 지금까지 등록 시점(register
 * 라우트) 안에서만 호출되고, 사용자가 등록 전에 뭘 채워야 하는지 볼 방법이
 * 없었다는 것 — 이 컴포넌트가 그 공백을 메운다.
 *
 * 여기서 입력한 값(categoryFieldOverrides)은 build-payload.ts의
 * buildCoupangCompliance()에서 다른 어떤 자동 매칭(OPTION_MATCH/
 * PRODUCT_FIELD 등)보다 먼저 확인되는 USER_INPUT 소스로 등록 payload에
 * 그대로 반영된다 — 비워두면 기존처럼 자동 매칭/임시값으로 채워진다(필수
 * 항목이라고 전부 사용자가 입력해야 하는 건 아니다).
 */
export function CategoryRequirementsEditor({
  categoryMeta,
  loading,
  error,
  overrides,
  onUpdateOverride,
}: {
  categoryMeta: CoupangCategoryMeta | null;
  loading: boolean;
  error: string | null;
  overrides: Record<string, string> | undefined;
  onUpdateOverride: (fieldName: string, value: string) => void;
}) {
  if (loading) {
    return (
      <section className="rounded-lg border border-border p-4 text-sm">
        <h3 className="text-base font-medium">카테고리 필수 입력</h3>
        <p className="mt-2 text-xs text-text-secondary">쿠팡 카테고리 필수 항목을 불러오는 중…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm">
        <h3 className="text-base font-medium">카테고리 필수 입력</h3>
        <p className="mt-2 text-xs text-warning">{error}</p>
      </section>
    );
  }

  if (!categoryMeta) return null;

  const mandatoryAttributes = categoryMeta.attributes.filter((attr) => attr.required === "MANDATORY");
  const noticeCategory = [...categoryMeta.noticeCategories].sort(
    (a, b) => a.noticeCategoryDetailNames.length - b.noticeCategoryDetailNames.length,
  )[0];
  const mandatoryNotices = (noticeCategory?.noticeCategoryDetailNames ?? []).filter(
    (detail) => detail.required === "MANDATORY",
  );

  if (mandatoryAttributes.length === 0 && mandatoryNotices.length === 0) return null;

  return (
    <section className="rounded-lg border border-border p-4 text-sm">
      <h3 className="text-base font-medium">카테고리 필수 입력</h3>
      <p className="mt-1 text-xs text-text-secondary">
        이 카테고리에 등록하려면 쿠팡이 요구하는 항목입니다. 비워두면 상품 정보에서 자동으로 채우거나, 찾지 못하면
        임시값이 들어갑니다 — 정확한 값을 알고 있으면 직접 입력해주세요.
      </p>

      {mandatoryAttributes.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-text-tertiary">구매옵션</p>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3">
            {mandatoryAttributes.map((attr) => (
              <RequirementField
                key={attr.attributeTypeName}
                label={attr.attributeTypeName}
                unit={attr.basicUnit !== "없음" ? attr.basicUnit : undefined}
                inputValues={attr.inputValues}
                value={overrides?.[attr.attributeTypeName] ?? ""}
                onCommit={(v) => onUpdateOverride(attr.attributeTypeName, v)}
              />
            ))}
          </div>
        </div>
      )}

      {mandatoryNotices.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-text-tertiary">
            고시정보{noticeCategory ? ` · ${noticeCategory.noticeCategoryName}` : ""}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3">
            {mandatoryNotices.map((detail) => (
              <RequirementField
                key={detail.noticeCategoryDetailName}
                label={detail.noticeCategoryDetailName}
                inputValues={[]}
                value={overrides?.[detail.noticeCategoryDetailName] ?? ""}
                onCommit={(v) => onUpdateOverride(detail.noticeCategoryDetailName, v)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function RequirementField({
  label,
  unit,
  inputValues,
  value,
  onCommit,
}: {
  label: string;
  unit?: string;
  inputValues: string[];
  value: string;
  onCommit: (value: string) => void;
}) {
  // 쿠팡이 값을 정해진 목록으로 제한한 항목(색상 코드, 등급 등)은 자유 입력을
  // 받으면 오히려 "유효하지 않은 구매 옵션 값"으로 거부된다 — 목록이 있으면
  // select로 강제해서 잘못된 값을 아예 못 입력하게 막는다.
  const isEnum = inputValues.length > 0 && inputValues.length <= 100;
  return (
    <div>
      <label className="text-xs text-text-secondary">
        {label}
        <span className="ml-0.5 text-error">*</span>
        {unit && <span className="ml-1 text-text-tertiary">({unit})</span>}
      </label>
      <div className="mt-0.5">
        {isEnum ? (
          <select
            value={value}
            onChange={(e) => onCommit(e.target.value)}
            className="w-full rounded border border-border bg-surface px-2 py-1 text-sm focus:border-primary focus:outline-none"
          >
            <option value="">자동 매칭 사용</option>
            {inputValues.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        ) : (
          <EditableText
            value={value}
            onCommit={onCommit}
            placeholder="자동 매칭 사용"
            className="w-full rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
          />
        )}
      </div>
    </div>
  );
}
