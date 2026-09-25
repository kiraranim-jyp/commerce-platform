"use client";

import {
  editorFieldSchema,
  evaluateEditGate,
  toComparable,
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
 * ── 🔴 여기에 입력칸을 두지 «않는다»(CEO 확정, 2026-09-26) ────────────────
 * 초안은 «보낼 payload» 에서 온다. 그 값을 이 패널에서 되받아 쓰면 상품명
 * 파생 규칙이 두 번 적용되고, 화면의 값과 실제로 나가는 값이 갈린다. 값은
 * 각자의 편집기(가격·이미지·옵션…)에서 고치고, 이 화면은 «지금 값과 보낼 값»
 * 을 나란히 보여주고 보낼지를 묻는다.
 *
 * ── 🔴 버튼은 «있고», 꺼져 있다 ──────────────────────────────────────────
 * 변경이 0개면 disabled 다(숨기지 않는다). 손실 게이트와 다르다 — 그쪽은
 * 「보내면 사라진다」라서 버튼을 아예 만들지 않는다. 여기는 「보낼 것이 없다」다.
 */

export interface ChannelEditPanelProps {
  commerceLabel: string;
  /** 🔴 채널에서 GET 한 기준값. 수집 Snapshot 이 아니다. */
  model: ChannelEditModel;
  /** 보낼 payload 를 투영한 값. 🔴 등록 payload 를 만드는 «그» 값이어야 한다. */
  draft: Partial<Record<EditableField, unknown>>;
  /** 셀러가 손댄 항목. 🔴 대조하지 못하는 항목의 변경을 아는 유일한 근거다. */
  touched?: readonly EditableField[];
  busy?: boolean;
  onSubmit: () => void;
}

/** 지금 채널에 나가 있는 값을 셀러의 말로. 🔴 못 읽은 것을 값으로 만들지 않는다. */
function baselineText(baseline: EditBaseline, field: EditableField): string {
  if (baseline.state === "UNREAD") return "읽지 못했습니다";
  if (baseline.state === "OBSERVED") return valueText(baseline.value, field);
  return baseline.unit === "COUNT" ? `${baseline.value}개` : baseline.value;
}

/** 보낼 값. 🔴 «대조하는 단위» 그대로 보여준다 — 화면과 판단이 같은 것을 본다. */
function draftText(field: EditorField, draft: Partial<Record<EditableField, unknown>>): string {
  const value = toComparable(field.compareUnit, draft[field.field]);
  /* 🔴 「값이 없다」가 아니라 «아직 정해지지 않았다» 다 — 「-」로 채우지 않는다. */
  if (value === undefined) return "아직 없습니다";
  if (field.compareUnit === "COUNT") return `${value}개`;
  return valueText(value, field.field);
}

function valueText(value: string, field: EditableField): string {
  if (value === "") return "비어 있습니다";
  /* 상세설명은 길다 — 값을 그대로 쏟지 않고 길이만 말한다. */
  if (field === "detailContent") return `${value.length}자`;
  return value;
}

export function ChannelEditPanel({
  commerceLabel,
  model,
  draft,
  touched = [],
  busy = false,
  onSubmit,
}: ChannelEditPanelProps) {
  const fields = editorFieldSchema(model);
  const gate = evaluateEditGate(model, draft, touched);
  const changed = new Set(gate.changes.map((change) => change.field));

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
        아래 「지금 값」은 {commerceLabel}에서 방금 읽어 온 것입니다. 값은 각 항목의 편집 화면에서 고치시면
        여기에 「보낼 값」으로 반영됩니다.
      </p>

      <ul className="mt-3 divide-y divide-slate-200">
        {fields.map((field) => (
          <li key={field.field} className="py-2">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium">{field.label}</span>
              {changed.has(field.field) && (
                <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white">바뀝니다</span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-600">
              지금 값 {baselineText(field.baseline, field.field)}
              {/* 🔴 고칠 수 없는 항목에는 「보낼 값」을 쓰지 않는다 — 나가지도
                  않는 값을 나란히 두면 반영된다고 읽힌다. */}
              {field.editable ? <> · 보낼 값 {draftText(field, draft)}</> : null}
            </p>
            {/* 🔴 한 줄 설명은 schema 가 준 것을 그대로 쓴다. 화면이 다시 쓰면
                「수정할 수 있습니다」와 capability 가 갈라진다. */}
            <p className="mt-1 text-xs text-slate-500">{field.note}</p>
          </li>
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
