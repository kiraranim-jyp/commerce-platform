"use client";

import { useState } from "react";
import type { CanonicalProduct } from "@commerce/shared";
import { NOTICE_REFERENCE_ELIGIBLE_FIELDS, type NoticeReferenceEligibleField } from "@commerce/listing";
import { InfoTip } from "./registration-fields";

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
  /* DELTA-B(CEO 판정, 2026-09-15) — 이 패널이 다루는 것은 **고시정보** 쪽
     모델명뿐이다. 여기서 «상세페이지 참조»로 채워지는 자리가 정확히 그것이고,
     「네이버 쇼핑 카탈로그 모델명」은 이 패널로는 끝내 채워지지 않는다. 그냥
     "모델명"이라고 적어 두면 셀러는 체크 한 번으로 둘 다 끝났다고 믿는다. */
  modelName: "고시정보 모델명",
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
  manufacturerResolution,
}: {
  product: CanonicalProduct;
  onBulkApply: (fields: NoticeReferenceEligibleField[]) => void;
  /**
   * REWORK-11 ②(CEO 지시, 2026-09-15: "네 화면 실제 표시값을 전부 확인하라") —
   * **상품정보 화면이 네 번째 화면이다.**
   *
   * 브랜드 프로필이 제조사를 채워 주는 상품에서 세 커머스 탭은 그 값을 보여주는데,
   * 이 패널만 `product.manufacturer.source === "REQUIRED"`를 보고 「불러오지 못한
   * 항목」에 **제조사**를 계속 세우고 있었다. 같은 상품에 대해 화면 두 곳이
   * 반대로 말하는 상태다 — 셀러는 채워져 있는 값을 또 채우러 간다.
   *
   * 🔴 판정을 여기서 만들지 않는다. 세 탭이 받는 그 resolver 결과를 그대로
   * 받아서, **이미 답이 있는 항목만 목록에서 뺀다.**
   */
  manufacturerResolution?: { resolved: boolean; loading: boolean };
}) {
  const manufacturerAutoFilled =
    Boolean(manufacturerResolution?.resolved) && !manufacturerResolution?.loading;
  const missingFields = NOTICE_REFERENCE_ELIGIBLE_FIELDS.filter(
    (key) =>
      product[key].source === "REQUIRED" && !(key === "manufacturer" && manufacturerAutoFilled),
  );
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
      {/* REWORK-11 ⑤(CEO 지시, 2026-09-15: "설명으로 화면을 채우지 마라") —
          제목 + **한 줄** + 항목 목록. 여기 있던 4줄짜리 정책 설명(값을 지어내지
          않는다 · 등록 시점 표기 · 되돌리는 법)은 지워진 것이 아니라 ⓘ로 접혔다. */}
      <h3 className="text-base font-medium">
        불러오지 못한 항목 ({missingFields.length}개)
        <InfoTip text="상품 상세페이지에 이미 나와 있는 정보라면 «상세페이지 참조로 등록»을 선택해 한 번에 처리할 수 있습니다. 값을 임의로 만들어내지 않고, 등록 시점에 «상품 상세페이지 참조»로 표시됩니다. 나중에 개별 항목에서 직접 입력으로 되돌릴 수 있습니다." />
      </h3>
      <p className="mt-1 text-xs text-text-secondary">원본 페이지에서 값을 확인하지 못한 등록 정보입니다.</p>

      <div className="mt-3 space-y-1.5">
        <label className="flex items-center gap-2 border-b border-border pb-1.5 text-xs font-medium text-text-secondary">
          <input type="checkbox" checked={allChecked} onChange={toggleAll} />
          전체 선택
        </label>
        {missingFields.map((field) => (
          <div key={field}>
            <label className="flex items-center gap-2 py-0.5 text-sm">
              <input type="checkbox" checked={checked.has(field)} onChange={() => toggle(field)} />
              {FIELD_LABEL[field]}
            </label>
            {/* REWORK-8 ①(CEO 지시, 2026-09-15) — 이 패널에서 «참조»가 **절반만**
                통하는 필드가 하나 있다. 모델명은 고시정보 쪽만 대체되고 네이버
                쇼핑 카탈로그 모델명은 비어 있는 채로 남아 등록을 계속 막는다
                (REWORK-6 확정). 지금까지 이 줄은 다른 8개와 똑같이 생겨서,
                체크하고 적용한 셀러는 "처리했다"고 믿은 채 막다른 길로 갔다.
                🔴 문구만 고치는 게 아니다 — 같은 화면의 「Source Data」에 실제
                입력칸을 만들었고(SourceDataView), 이 줄은 그리로 보낸다. */}
            {/* REWORK-11 ⑤ — 여기 있던 4줄짜리 경고가 ⓘ로 접혔다. 화면에 남는
                것은 한 줄과 ⓘ 하나이고, 글자는 툴팁에 그대로 있다. */}
            {field === "modelName" && (
              <p className="ml-6 text-[11px] text-warning">
                ⚠ 이 체크로는 「고시정보 모델명」만 채워집니다
                <InfoTip text="모델명은 두 가지입니다 — 여기서 참조로 채워지는 것은 「고시정보 모델명」뿐이고, 스마트스토어 등록을 막고 있는 「네이버 쇼핑 카탈로그 모델명」은 별도 값이라 채워지지 않습니다. 같은 화면의 「Source Data」에 있는 «네이버 쇼핑 카탈로그 모델명» 칸에 실제 값을 직접 입력해주세요." />
              </p>
            )}
          </div>
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
