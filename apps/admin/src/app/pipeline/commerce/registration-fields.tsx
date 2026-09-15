"use client";

import type { ReactNode } from "react";
import type { FieldSource } from "@commerce/shared";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { extractionSourceLabel, ProvenanceBadge } from "./provenance";

/**
 * REWORK-11 ①(CEO 판정, 2026-09-15: "섹션 순서가 같다를 통합 완료로 인정하지
 * 않는다") — **세 채널 등록 화면의 입력 한 줄을 그리는 곳은 여기 하나다.**
 *
 * ── 왜 생겼나 ────────────────────────────────────────────────────────────
 * REWORK-10까지 세 탭의 섹션 제목·순서는 같아졌는데 **안이 달랐다.** 같은
 * "라벨 + 입력칸 + 설명 한 줄"을 두 벌이 그리고 있었다:
 *
 *   PlatformPreview (스마트스토어·쿠팡)   LotteOnRegistrationPanel (롯데ON)
 *   ────────────────────────────────    ────────────────────────────────
 *   FieldRow                            TextField / TextAreaField
 *   label  text-xs text-text-secondary  span text-xs font-medium …
 *   input  rounded px-2 py-1            input rounded-md px-3 py-1.5
 *   배지   ProvenanceBadge / StatusBadge RequirementBadge(전용 🔴/⚪ span)
 *   설명   text-[11px] text-text-tertiary span text-[11px] …
 *
 * 그래서 "순서는 같은데 롯데ON만 다르게 생긴" 화면이 됐다 — CEO가 열한 번
 * 지적한 그 차이다. 이 파일은 그 두 벌을 **한 벌로** 만든다.
 *
 * 🔴 새 디자인을 만들지 않았다. 아래 클래스는 전부 PlatformPreview가 쓰던 값
 * 그대로이고(스마트스토어·쿠팡 화면은 한 픽셀도 바뀌지 않는다), 롯데ON이 그
 * 쪽으로 맞춰 온다.
 */

/** 입력칸 한 벌. 세 탭의 모든 input/textarea가 이 클래스를 쓴다. */
export const FIELD_INPUT_CLASS =
  "w-full rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none";

/**
 * Sprint A-3(작업1 — 모든 항목 Editable, 작업8 — Resolver Trace) 필드 라벨 행.
 * SourceDataView가 이미 쓰던 "라벨 + 값 + Source + Confidence" 패턴을 accordion
 * 안에서도 그대로 쓴다 — 새 렌더링 방식을 또 만들지 않는다.
 *
 * REWORK-11 — `badge`와 `note`가 붙었다. 롯데ON의 「🔴 필수 / ⚪ 선택」과 코드
 * 힌트(`공통코드 DV_CO_CD` 등)가 설 자리가 없어서 그 탭이 자기 행 컴포넌트를
 * 따로 갖고 있었기 때문이다. 슬롯 두 개를 여기 열어 주면 롯데ON이 이 행을
 * 그대로 쓸 수 있고, 스마트스토어·쿠팡은 두 슬롯을 안 쓰므로 렌더 결과가
 * 이전과 완전히 같다.
 */
export function FieldRow({
  label,
  labelSuffix,
  field,
  required,
  badge,
  note,
  children,
}: {
  label: string;
  /** 라벨 바로 뒤(ⓘ 툴팁 등). 라벨 글자 자체는 건드리지 않는다 — 테스트와
   *  스크롤 목적지가 라벨 문자열로 자리를 찾는다. */
  labelSuffix?: ReactNode;
  field?: { source: FieldSource; confidence: number };
  required?: boolean;
  /** 라벨 오른쪽. `field`(추출 출처)가 없을 때만 쓴다 — 두 개가 같이 서면 줄이 길어진다. */
  badge?: ReactNode;
  /** 입력칸 아래 한 줄(코드 체계 힌트 등). 문단이 아니라 **한 줄**이다. */
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        {/* labelSuffix(ⓘ)는 `<label>` **밖**이다 — 안에 넣으면 그 칸의 이름이
            "제조사 + 툴팁 전문"이 되어버린다(라벨 문자열로 자리를 찾는 검사와
            보조기술 양쪽이 다 어긋난다). */}
        <span className="flex min-w-0 items-center">
          <label className="text-xs text-text-secondary">
            {label}
            {required && <span className="ml-0.5 text-error">*</span>}
          </label>
          {labelSuffix}
        </span>
        {field ? (
          <span className="flex items-center gap-1 text-[11px] text-text-tertiary">
            {extractionSourceLabel(field)}
            <ProvenanceBadge source={field.source} />
          </span>
        ) : (
          badge
        )}
      </div>
      <div className="mt-0.5">{children}</div>
      {note && <p className="mt-0.5 text-[11px] leading-relaxed text-text-tertiary">{note}</p>}
    </div>
  );
}

/**
 * REWORK-11 — 값을 **읽기만** 하는 한 줄.
 *
 * 롯데ON의 ① 기본 상품정보 · ③ 옵션 · ④ 가격 · ⑨ 상세설명이 전부 이 모양이다
 * (공통값이라 그 탭에서 입력받지 않는다 — three-layer-realign.test.ts 증명 1).
 * 예전에는 `<dl>` 표였다: 같은 자리가 스마트스토어·쿠팡에서는 라벨+입력칸,
 * 롯데ON에서는 정의 목록이라 한눈에 다른 화면으로 보였다.
 *
 * 🔴 input을 만들지 않는다 — 그것이 이 컴포넌트의 계약이다. 대신 입력칸과
 * **같은 틀**(같은 테두리·여백·글자 크기)에 값을 얹어 자리만 맞춘다.
 */
export function ReadOnlyFieldRow({
  label,
  value,
  placeholder,
  origin,
  note,
  children,
}: {
  label: string;
  value: string;
  /** 값이 없을 때 그 자리에서 할 말(예: "상품정보에서 채워주세요"). */
  placeholder: string;
  /** 어디서 온 값인가 — 라벨 오른쪽의 작은 글자. */
  origin?: string;
  note?: ReactNode;
  children?: ReactNode;
}) {
  const filled = value.trim().length > 0;
  return (
    <FieldRow
      label={label}
      badge={origin ? <span className="text-[11px] text-text-tertiary">{origin}</span> : undefined}
      note={note}
    >
      <div
        data-readonly-field="true"
        className={`${FIELD_INPUT_CLASS} min-h-[1.875rem] break-words bg-background ${
          filled ? "text-text-primary" : "text-warning"
        }`}
      >
        {filled ? value : placeholder}
      </div>
      {children}
    </FieldRow>
  );
}

/**
 * REWORK-11 ④(CEO 지시: "🔴 필수 / ⚪ 선택") — 공용 StatusBadge로 그린다.
 *
 * 🔴 **판정을 여기서 만들지 않는다.** 롯데ON 서버 검증(validateLotteOnPayload)은
 * `ok = missingCount === 0 && blockedCount === 0`이다 — 검증이 한 번이라도
 * 들여다본 필드는 전부 등록을 막는다. 그래서 "그 필드가 검증 결과에 이름으로
 * 올라와 있는가"가 그대로 필수/선택이 된다. 검증 전에는 undefined —
 * 모르는 것을 필수라고도 선택이라고도 적지 않는다.
 */
export type FieldRequirement = "REQUIRED" | "OPTIONAL" | undefined;

export function RequirementBadge({ requirement }: { requirement: FieldRequirement }) {
  if (!requirement) return null;
  /* 글자는 REWORK-7 ④가 정한 그대로다. 달라진 것은 **그리는 컴포넌트**뿐 —
     전용 span 두 개가 공용 StatusBadge로 바뀌면서 ⚪가 ○(neutral의 글리프)가
     됐다. 상태 색·글리프의 의미는 이제 화면 전체에서 한 벌이다. */
  return requirement === "REQUIRED" ? (
    <StatusBadge status="error" label="필수" />
  ) : (
    <StatusBadge status="neutral" label="선택 — 없어도 등록 가능" />
  );
}

/**
 * 채널 고유 코드 입력 한 줄(롯데ON의 owhpNo · oplcCd 등).
 *
 * 값이 바뀌는 즉시 onChange를 부른다(EditableText의 blur-commit이 아니다) —
 * 롯데ON 폼은 입력이 바뀌는 순간 직전 검증 결과를 stale로 표시해야 하고,
 * blur까지 기다리면 "고쳤는데 여전히 통과로 보이는" 창이 생긴다.
 */
export function ChannelCodeField({
  label,
  note,
  value,
  onChange,
  requirement,
  placeholder,
}: {
  label: string;
  note?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  requirement?: FieldRequirement;
  placeholder?: string;
}) {
  return (
    <FieldRow label={label} badge={<RequirementBadge requirement={requirement} />} note={note}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={FIELD_INPUT_CLASS}
      />
    </FieldRow>
  );
}

export function ChannelCodeTextArea({
  label,
  note,
  value,
  onChange,
  requirement,
  placeholder,
  rows = 4,
}: {
  label: string;
  note?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  requirement?: FieldRequirement;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <FieldRow label={label} badge={<RequirementBadge requirement={requirement} />} note={note}>
      <textarea
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`${FIELD_INPUT_CLASS} font-mono`}
      />
    </FieldRow>
  );
}

/**
 * REWORK-11 ⑤(CEO 지시, 2026-09-15: "설명으로 화면을 채우지 마라") — **장문
 * 안내가 가는 곳.**
 *
 * 지금까지 정책 설명은 화면에 문단으로 눌러 있었다(제조사 3줄 · 모델명 4줄 ·
 * 불러오지 못한 항목 5줄). 셀러가 읽어야 할 한 줄이 그 안에 묻힌다.
 *
 * 🔴 **정보를 지우지 않는다.** 글자는 `title`(브라우저 툴팁)과 화면에 보이지
 * 않는 `sr-only` 텍스트 두 군데에 그대로 남는다 — 스크린리더·검색·테스트는
 * 계속 읽을 수 있고, 눈에 보이는 것은 ⓘ 하나뿐이다. 설명을 "없앴다"가 아니라
 * "접었다"이고, 그 차이가 중요하다(없애면 셀러가 왜 막혔는지 알 길이 사라진다).
 */
export function InfoTip({ text, label = "자세히" }: { text: string; label?: string }) {
  return (
    <span className="inline-flex items-center align-middle">
      <button
        type="button"
        title={text}
        aria-label={`${label} — ${text}`}
        data-info-tip="true"
        className="ml-1 rounded-full px-1 text-[11px] leading-none text-text-tertiary hover:text-text-secondary"
      >
        ⓘ
      </button>
      {/* 화면에는 없고 문서에는 있다 — 보조기술과 검사가 읽는 자리. */}
      <span className="sr-only">{text}</span>
    </span>
  );
}
