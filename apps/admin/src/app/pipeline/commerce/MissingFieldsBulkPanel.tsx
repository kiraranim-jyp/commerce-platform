"use client";

import { useState } from "react";
import type { CanonicalProduct } from "@commerce/shared";
import { NOTICE_REFERENCE_ELIGIBLE_FIELDS, type NoticeReferenceEligibleField } from "@commerce/listing";

/** P-6 P1(CEO 지시, 2026-08-29) — "기본정보에서 값을 불러오지 못한 항목들을
 * 셀러가 하나씩 처리하지 않도록" 개선. 기존에는 이 9개 필드(N-3.45 화이트리스트,
 * reference-eligibility.ts) 각각의 "상세페이지 참조로 등록" 버튼이 스마트스토어
 * 탭 안에 개별로만 있었다 — 누락 항목이 여러 개면 사용자가 그 탭까지 가서
 * 하나씩 눌러야 했다. 이 패널은 "기본정보" 탭(SourceDataView 바로 아래)에서
 * 누락 항목을 한 번에 모아 보여주고, 체크한 항목만 일괄로 참조 처리한다.
 *
 * "누락"의 기준은 PlatformPreview.tsx의 ReferenceEligibleFieldRow가 이미 쓰는
 * 기준과 동일하다 — source==="REQUIRED"(값이 아직 없다는 뜻, emptyField()의
 * 기본값). 새 판단 기준을 만들지 않는다(단일 소스 원칙 유지).
 *
 * KC 인증정보(certificationType/childCertification)는 NOTICE_REFERENCE_ELIGIBLE_FIELDS
 * 화이트리스트에 애초에 없으므로 이 패널에는 절대 나타나지 않는다(N-3.45 STEP10
 * 영구 가드가 여기서도 그대로 적용된다 — 별도 체크 불필요, 화이트리스트를
 * 벗어난 필드를 순회하지 않는다). */

const FIELD_LABEL: Record<NoticeReferenceEligibleField, string> = {
  itemName: "품명",
  modelName: "모델명",
  weight: "중량",
  material: "소재",
  color: "색상",
  manufacturer: "제조사",
  careInstructions: "세탁방법/취급주의",
  recommendedAge: "사용연령",
  importer: "수입사명",
};

export function MissingFieldsBulkPanel({
  product,
  onBulkApply,
}: {
  product: CanonicalProduct;
  onBulkApply: (fields: NoticeReferenceEligibleField[]) => void;
}) {
  const missingFields = NOTICE_REFERENCE_ELIGIBLE_FIELDS.filter((key) => product[key].source === "REQUIRED");
  const [checked, setChecked] = useState<Set<NoticeReferenceEligibleField>>(new Set());

  // 누락 항목이 없으면(전부 값이 있거나 이미 참조 처리됨) 패널 자체를 숨긴다 —
  // "처리할 게 없는데 빈 패널이 보이는" 혼란을 막는다.
  if (missingFields.length === 0) return null;

  const allChecked = missingFields.every((f) => checked.has(f));

  function toggle(field: NoticeReferenceEligibleField) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }

  function toggleAll() {
    setChecked(allChecked ? new Set() : new Set(missingFields));
  }

  function apply() {
    if (checked.size === 0) return;
    onBulkApply(Array.from(checked));
    setChecked(new Set());
  }

  return (
    <section className="rounded-lg border border-border p-4 text-sm">
      <h3 className="text-base font-medium">불러오지 못한 항목 ({missingFields.length}개)</h3>
      <p className="mt-1 text-xs text-text-secondary">
        원본 페이지에서 값을 확인하지 못한 등록 정보입니다. 상품 상세페이지에 이미 나와 있는 정보라면
        &ldquo;상세페이지 참조로 등록&rdquo;을 선택해 한 번에 처리할 수 있습니다 — 값을 임의로 만들어내지 않고,
        등록 시점에 &ldquo;상품 상세페이지 참조&rdquo;로 표시됩니다. 나중에 개별 항목에서 직접 입력으로 되돌릴 수
        있습니다.
      </p>

      <div className="mt-3 space-y-1.5">
        <label className="flex items-center gap-2 border-b border-border pb-1.5 text-xs font-medium text-text-secondary">
          <input type="checkbox" checked={allChecked} onChange={toggleAll} />
          전체 선택
        </label>
        {missingFields.map((field) => (
          <label key={field} className="flex items-center gap-2 py-0.5 text-sm">
            <input type="checkbox" checked={checked.has(field)} onChange={() => toggle(field)} />
            {FIELD_LABEL[field]}
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={apply}
        disabled={checked.size === 0}
        className="mt-3 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        선택 {checked.size}건 상세페이지 참조로 일괄 등록
      </button>
    </section>
  );
}
