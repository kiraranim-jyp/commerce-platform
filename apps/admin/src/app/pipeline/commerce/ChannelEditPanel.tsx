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
 * ── 🔴 변경 목록·수정 버튼은 «여기에 없다»(F-14-5) ───────────────────────
 * 우측 요약 하나에만 있다. 같은 것을 두 자리에 그리면 하나는 반드시 옛말을
 * 하게 되고, 셀러는 가까운 쪽을 믿는다. 이 화면이 답하는 질문은 하나다 —
 * 「항목마다 지금 값과 보낼 값이 무엇인가」.
 */

export interface ChannelEditPanelProps {
  commerceLabel: string;
  /** 🔴 채널에서 GET 한 기준값. 수집 Snapshot 이 아니다. */
  model: ChannelEditModel;
  /** 보낼 payload 를 투영한 값. 🔴 등록 payload 를 만드는 «그» 값이어야 한다. */
  draft: Partial<Record<EditableField, unknown>>;
  /** 셀러가 손댄 항목. 🔴 대조하지 못하는 항목의 변경을 아는 유일한 근거다. */
  touched?: readonly EditableField[];
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
}: ChannelEditPanelProps) {
  const fields = editorFieldSchema(model);
  /* 🔴 우측 요약과 «같은 입력으로 같은 순수함수» 를 부른다. 같은 입력이면 항상
     같은 결과라 좌우가 어긋날 수 없다(readiness.ts 가 같은 이유로 그렇게 한다).
     여기서 쓰는 것은 「어느 항목이 바뀌는가」 하나뿐이다 — 목록과 버튼은 우측. */
  const changed = new Set(evaluateEditGate(model, draft, touched).changes.map((change) => change.field));

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

      {/* 🔴 변경 목록과 [상품 수정]은 «여기에 없다» — 우측 요약(F-14-5)에
          하나만 있다. 두 자리에 두면 하나는 반드시 옛말을 하게 되고, 셀러는
          가까운 쪽을 믿는다. */}
      <p className="mt-3 text-xs text-slate-500">
        바뀌는 내용과 [상품 수정]은 오른쪽 요약에 있습니다.
      </p>
    </section>
  );
}
