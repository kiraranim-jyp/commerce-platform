"use client";

import {
  editorFieldSchema,
  evaluateEditGate,
  type ChannelEditModel,
  type EditBaseline,
  type EditorField,
} from "./channel-edit-model";
import type { EditableField } from "./channel-field-capability";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-14-3(CEO 지시, 2026-09-26) — **기등록 상품을 고치는 화면.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 항목 목록을 «여기서 정하지 않는다». `editorFieldSchema(model)` 이 준 것을
 * 순서대로 그린다 — 화면이 자기 목록을 따로 만들면 capability 표가 바뀌어도
 * 화면은 옛말을 계속 하고, 셀러는 화면을 믿는다(F-14-2).
 *
 * ── 🔴 기준값을 이 화면이 «만들지» 않는다 ────────────────────────────────
 * `model` 은 채널에서 GET 한 것이고, 이 파일은 그것을 읽을 뿐이다. 수집
 * Snapshot 을 현재값으로 그리면 셀러가 스마트스토어 관리자에서 직접 고친 값이
 * 화면에서 사라진다.
 *
 * ── 🔴 초안을 «소유하지» 않는다 ──────────────────────────────────────────
 * `draft` 와 `touched` 를 props 로 받는다. 이 패널이 자기 초안을 들고 있으면
 * 등록 payload 를 만드는 값과 «두 벌» 이 되고, 화면에서 고친 것이 실제로는
 * 나가지 않는 상태가 된다 — 이 프로젝트가 계속 고쳐 온 모양이다.
 *
 * ── 🔴 버튼은 «있고», 꺼져 있다 ──────────────────────────────────────────
 * 변경이 0개면 disabled 다(숨기지 않는다). 손실 게이트와 다르다 — 그쪽은
 * 「보내면 사라진다」라서 버튼을 아예 만들지 않는다. 여기는 「보낼 것이 없다」다.
 */

export interface ChannelEditPanelProps {
  commerceLabel: string;
  /** 🔴 채널에서 GET 한 기준값. 수집 Snapshot 이 아니다. */
  model: ChannelEditModel;
  /** 지금 화면이 들고 있는 값. 🔴 등록 payload 를 만드는 «그» 값이어야 한다. */
  draft: Partial<Record<EditableField, unknown>>;
  /** 셀러가 손댄 항목. 🔴 대조하지 못하는 항목의 변경을 아는 유일한 근거다. */
  touched?: readonly EditableField[];
  busy?: boolean;
  onChange: (field: EditableField, value: unknown) => void;
  onSubmit: () => void;
}

/** 이 항목은 이 패널에서 «직접» 입력받는다. 나머지는 각자의 편집기에서 고친다. */
const INLINE_INPUT: Partial<Record<EditableField, "text" | "number">> = {
  name: "text",
  salePrice: "number",
  stockQuantity: "number",
};

/** 지금 채널에 나가 있는 값을 셀러의 말로. 🔴 못 읽은 것을 값으로 만들지 않는다. */
function baselineText(baseline: EditBaseline, field: EditableField): string {
  if (baseline.state === "UNREAD") return "읽지 못했습니다";
  if (baseline.state === "OBSERVED") {
    if (baseline.value === "") return "비어 있습니다";
    /* 상세설명은 길다 — 값을 그대로 쏟지 않고 길이만 말한다. */
    if (field === "detailContent") return `${baseline.value.length}자`;
    return baseline.value;
  }
  return baseline.unit === "COUNT" ? `${baseline.value}개` : baseline.value;
}

export function ChannelEditPanel({
  commerceLabel,
  model,
  draft,
  touched = [],
  busy = false,
  onChange,
  onSubmit,
}: ChannelEditPanelProps) {
  const fields = editorFieldSchema(model);
  const gate = evaluateEditGate(model, draft, touched);

  return (
    <section
      data-testid="channel-edit"
      className="rounded-xl border border-slate-300 bg-white p-4 text-sm text-slate-900"
    >
      <h3 className="text-base font-semibold">등록된 상품 수정</h3>
      <p className="mt-1 text-xs text-slate-600">
        {commerceLabel} · 상품번호 {model.source.externalProductId}
      </p>
      {/* 🔴 「지금 값」이 어디서 온 것인지 밝힌다 — 셀러가 스마트스토어에서 직접
          고쳤다면 그 값이 여기 보이는 것이 맞고, 그것이 이 화면의 근거다. */}
      <p className="mt-1 text-xs text-slate-500">
        아래 「지금 값」은 {commerceLabel}에서 방금 읽어 온 것입니다.
      </p>

      <ul className="mt-3 divide-y divide-slate-200">
        {fields.map((field) => (
          <EditorRow
            key={field.field}
            field={field}
            draftValue={draft[field.field]}
            busy={busy}
            onChange={onChange}
          />
        ))}
      </ul>

      {/* ── 무엇이 바뀌는가 ───────────────────────────────────────────── */}
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="font-medium">바뀌는 내용</p>
        {gate.changes.length > 0 ? (
          <ul className="mt-1 space-y-1">
            {gate.changes.map((change) => (
              <li key={change.field}>
                {change.label}
                {/* 🔴 값 없음을 「-」로 채우지 않는다 — 빈 값으로 바뀐다고 읽힌다. */}
                {change.from !== undefined && change.to !== undefined ? (
                  <>
                    {" "}
                    {change.from} → <strong>{change.to}</strong>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-slate-600">아직 바뀐 것이 없습니다.</p>
        )}
        {/* 🔴 대조하지 못한 항목을 손댔다면 «그렇다고 말한다». 「바뀝니다」라고
            단정하지 않는다 — 우리는 무엇이 달라졌는지 모르고, 아는 것은
            셀러가 그 항목을 고쳤다는 사실뿐이다. */}
        {gate.touched.length > 0 && (
          <p className="mt-2 text-slate-600">
            {gate.touched.map((field) => fields.find((f) => f.field === field)?.label).join(" · ")}
            을(를) 고치셨습니다. 바뀐 내용을 미리 보여드리지는 못하지만 그대로 반영됩니다.
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          /* 🔴 변경 1개 이상일 때만 열린다. 무변경 수정을 보내면 네이버 수정은
             전체 교체라 «아무 이유 없이» 상품 전체가 다시 등록된다. */
          disabled={busy || !gate.canSubmit}
          onClick={onSubmit}
          className="rounded-lg bg-slate-900 px-3 py-2 font-medium text-white disabled:opacity-40"
        >
          {busy ? "수정하는 중…" : "상품 수정"}
        </button>
        <span className="text-xs text-slate-500">
          {gate.canSubmit
            ? `아직 ${commerceLabel}에 아무것도 보내지 않았습니다.`
            : "고친 내용이 있으면 버튼이 열립니다."}
        </span>
      </div>
    </section>
  );
}

function EditorRow({
  field,
  draftValue,
  busy,
  onChange,
}: {
  field: EditorField;
  draftValue: unknown;
  busy: boolean;
  onChange: (field: EditableField, value: unknown) => void;
}) {
  const inputKind = field.editable ? INLINE_INPUT[field.field] : undefined;
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium">{field.label}</span>
        <span className="text-xs text-slate-500">
          지금 값 {baselineText(field.baseline, field.field)}
        </span>
      </div>
      {inputKind ? (
        <input
          type={inputKind}
          disabled={busy}
          value={draftValue === undefined || draftValue === null ? "" : String(draftValue)}
          onChange={(event) =>
            /* 🔴 숫자 칸은 숫자로 넘긴다 — 문자열로 넘기면 대조가 「157100」과
               「157100 」을 다르게 볼 수 있고, 그것이 거짓 변경이 된다. */
            onChange(
              field.field,
              inputKind === "number"
                ? event.target.value === ""
                  ? undefined
                  : Number(event.target.value)
                : event.target.value,
            )
          }
          className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 disabled:bg-slate-100"
        />
      ) : null}
      {/* 🔴 한 줄 설명은 schema 가 준 것을 그대로 쓴다. 화면이 다시 쓰면
          「수정할 수 있습니다」와 capability 가 갈라진다. */}
      <p className="mt-1 text-xs text-slate-500">{field.note}</p>
    </li>
  );
}
