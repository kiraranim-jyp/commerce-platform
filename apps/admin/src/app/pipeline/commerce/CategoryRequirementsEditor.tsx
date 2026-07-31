"use client";

import type { ComplianceFieldSource, CoupangCategoryMeta } from "@commerce/listing";
import { EditableText } from "./EditableField";

/**
 * Sprint A #1(가장 중요) — CPO가 실측으로 지적한 문제: "지금은 카테고리를
 * 선택해도 아무것도 안 생긴다. 그래서 등록하려고 하면 카테고리 코드 없음,
 * 속성 없음 같은 오류가 계속 발생한다." 원인은 카테고리 메타(필수 구매옵션/
 * 고시정보) API(/api/coupang/category-meta)가 지금까지 등록 시점(register
 * 라우트) 안에서만 호출되고, 사용자가 등록 전에 뭘 채워야 하는지 볼 방법이
 * 없었다는 것 — 이 컴포넌트가 그 공백을 메운다.
 *
 * Sprint A-2(Auto Fill) — 처음 버전은 필수 항목을 전부 빈 입력으로 보여줘서
 * "AI가 이미 아는 값도 사람이 다시 입력해야 하는" 문제가 있었다(CPO 지적:
 * "88%가 나와도 실제로 입력할 게 많으면 의미 없다"). resolvedFields는
 * register 라우트가 실제 등록 때 쓰는 것과 같은 buildCoupangCompliance()
 * 계산 결과라, 이미 채워질 값은 미리 보여주고 진짜 모르는 것만 입력을 요청한다.
 *
 * 여기서 입력한 값(categoryFieldOverrides)은 build-payload.ts의
 * buildCoupangCompliance()에서 다른 어떤 자동 매칭(OPTION_MATCH/
 * PRODUCT_FIELD 등)보다 먼저 확인되는 USER_INPUT 소스로 등록 payload에
 * 그대로 반영된다.
 */
export function CategoryRequirementsEditor({
  categoryMeta,
  loading,
  error,
  overrides,
  onUpdateOverride,
  resolvedFields,
}: {
  categoryMeta: CoupangCategoryMeta | null;
  loading: boolean;
  error: string | null;
  overrides: Record<string, string> | undefined;
  onUpdateOverride: (fieldName: string, value: string) => void;
  resolvedFields: Record<string, { value: string; source: ComplianceFieldSource }> | undefined;
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

  const totalCount = mandatoryAttributes.length + mandatoryNotices.length;
  const needsInputCount = [
    ...mandatoryAttributes.map((a) => a.attributeTypeName),
    ...mandatoryNotices.map((d) => d.noticeCategoryDetailName),
  ].filter((fieldName) => needsUserInput(fieldName, overrides, resolvedFields)).length;

  return (
    <section className="rounded-lg border border-border p-4 text-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">카테고리 필수 입력</h3>
        <span className="text-xs text-text-secondary">
          {needsInputCount === 0 ? (
            <span className="text-success">전부 자동 채움</span>
          ) : (
            <>
              직접 입력 필요 <span className="font-medium text-warning">{needsInputCount}</span>개 (전체{" "}
              {totalCount}개)
            </>
          )}
        </span>
      </div>
      <p className="mt-1 text-xs text-text-secondary">
        브랜드/제조국/색상/소재처럼 CartPilot이 이미 아는 값은 자동으로 채워집니다 — KC 인증 같은 항목만 직접
        입력해주세요.
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
                override={overrides?.[attr.attributeTypeName]}
                resolved={resolvedFields?.[attr.attributeTypeName]}
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
                override={overrides?.[detail.noticeCategoryDetailName]}
                resolved={resolvedFields?.[detail.noticeCategoryDetailName]}
                onCommit={(v) => onUpdateOverride(detail.noticeCategoryDetailName, v)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/** OPTION_MATCH(사이즈/색상처럼 옵션마다 값이 다른 필드)는 등록 시 품목별로
 * 이미 채워지므로 "직접 입력 필요" 카운트에서 제외한다 — PLACEHOLDER만
 * 진짜 사람 입력이 필요한 상태다. */
function needsUserInput(
  fieldName: string,
  overrides: Record<string, string> | undefined,
  resolvedFields: Record<string, { value: string; source: ComplianceFieldSource }> | undefined,
): boolean {
  if (overrides?.[fieldName]) return false;
  const resolved = resolvedFields?.[fieldName];
  if (!resolved) return true;
  return resolved.source === "PLACEHOLDER";
}

function RequirementField({
  label,
  unit,
  inputValues,
  override,
  resolved,
  onCommit,
}: {
  label: string;
  unit?: string;
  inputValues: string[];
  override: string | undefined;
  resolved: { value: string; source: ComplianceFieldSource } | undefined;
  onCommit: (value: string) => void;
}) {
  // OPTION_MATCH는 값이 옵션(품목)마다 다르다 — 여기서 하나의 값으로 덮어쓰면
  // 등록 시 모든 품목에 그 한 값이 그대로 적용돼버린다(실제로는 품목별로
  // buildCoupangItem이 각자 옵션값을 넣는데, override가 있으면 그걸 무시하고
  // 전부 같은 값이 된다 — 옵션 조합이 여러 개인 상품에서 조용히 틀린 데이터가
  // 등록되는 사고로 이어진다). 그래서 이 소스는 입력을 아예 막고 정보만 보여준다.
  if (!override && resolved?.source === "OPTION_MATCH") {
    return (
      <div>
        <label className="text-xs text-text-secondary">
          {label} <span className="ml-0.5 text-success">✓ 자동</span>
        </label>
        <p className="mt-0.5 rounded border border-transparent px-1 py-0.5 text-sm text-text-tertiary">
          옵션별로 자동 반영됨 (예: {resolved.value})
        </p>
      </div>
    );
  }

  const isAutoFilled = !override && resolved && resolved.source !== "PLACEHOLDER";
  const displayValue = override ?? (isAutoFilled ? resolved.value : "");
  // 쿠팡이 값을 정해진 목록으로 제한한 항목(색상 코드, 등급 등)은 자유 입력을
  // 받으면 오히려 "유효하지 않은 구매 옵션 값"으로 거부된다 — 목록이 있으면
  // select로 강제해서 잘못된 값을 아예 못 입력하게 막는다.
  const isEnum = inputValues.length > 0 && inputValues.length <= 100;

  return (
    <div>
      <label className="text-xs text-text-secondary">
        {label}
        {isAutoFilled ? (
          <span className="ml-1 text-success">✓ 자동</span>
        ) : (
          <span className="ml-0.5 text-error">*</span>
        )}
        {unit && <span className="ml-1 text-text-tertiary">({unit})</span>}
      </label>
      <div className="mt-0.5">
        {isEnum ? (
          <select
            value={displayValue}
            onChange={(e) => onCommit(e.target.value)}
            className="w-full rounded border border-border bg-surface px-2 py-1 text-sm focus:border-primary focus:outline-none"
          >
            <option value="">직접 선택해주세요</option>
            {inputValues.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        ) : (
          <EditableText
            value={displayValue}
            onCommit={onCommit}
            placeholder="직접 입력해주세요"
            className="w-full rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
          />
        )}
      </div>
    </div>
  );
}
