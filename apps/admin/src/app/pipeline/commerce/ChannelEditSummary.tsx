"use client";

import {
  describeChange,
  editorFieldSchema,
  evaluateEditGate,
  type ChannelEditModel,
} from "./channel-edit-model";
import type { EditableField } from "./channel-field-capability";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-14-5(CTO 작업지시서, 2026-09-26) — **우측 수정 요약.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 «새 판단을 만들지 않는다». F-14-2(capability) · F-14-3(기준값) ·
 * F-14-4(변경 감지)가 이미 정한 결과를 화면에 «연결» 할 뿐이다. 요약이 자기
 * 판정을 하나 더 만들면 「요약은 수정 가능이라는데 실제로는 막히는」 상태가
 * 된다 — 이 프로젝트가 CP001 로 겪은 그 모양이다.
 *
 * ── 셀러에게 말하는 것은 셋뿐이다 ────────────────────────────────────────
 *     ① 지금 어느 상품을 고치고 있는가
 *     ② 이 커머스에서 무엇을 고칠 수 있는가
 *     ③ 지금 무엇이 바뀌는가            → 그리고 [상품 수정]
 *
 * ── 🔴 기준값은 Editor 와 «같은 것» 이다 ─────────────────────────────────
 *     Channel GET → ChannelEditModel ┬→ Editor(좌)
 *                                    └→ Summary(우)
 * 요약이 Snapshot 이나 별도 API 를 읽으면 왼쪽과 오른쪽이 다른 말을 한다.
 * 그래서 이 파일에는 fetch 가 없다 — `model` 을 받아서만 그린다.
 *
 * ── 🔴 개발용 낱말은 «접힘 안에» 만 둔다 ─────────────────────────────────
 * OBSERVED·PARTIAL·UNREAD 는 우리 말이지 셀러 말이 아니다. 앞면에서 걷어내되
 * «없애지» 않는다 — 일이 잘못됐을 때 원인을 가르는 유일한 근거이기 때문이다.
 */

export interface ChannelEditSummaryProps {
  commerceLabel: string;
  model: ChannelEditModel;
  draft: Partial<Record<EditableField, unknown>>;
  touched?: readonly EditableField[];
  busy?: boolean;
  onSubmit: () => void;
}

export function ChannelEditSummary({
  commerceLabel,
  model,
  draft,
  touched = [],
  busy = false,
  onSubmit,
}: ChannelEditSummaryProps) {
  /* 🔴 순수함수를 왼쪽 화면과 «같은 입력» 으로 부른다. 같은 입력이면 항상 같은
     결과라 두 화면이 어긋날 수 없다(readiness.ts 가 같은 이유로 그렇게 한다). */
  const fields = editorFieldSchema(model);
  const gate = evaluateEditGate(model, draft, touched);
  const editable = fields.filter((field) => field.editable);
  const others = fields.filter((field) => !field.editable);

  return (
    <div
      data-summary="channel-edit"
      className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface text-sm shadow-elevated"
    >
      {/* ── ① 지금 어느 상품을 고치는가 ───────────────────────────────── */}
      <div className="p-3">
        <p className="font-semibold text-slate-900">등록된 상품 수정</p>
        <p className="mt-1 text-xs text-slate-600">
          {commerceLabel} · 상품번호 {model.source.externalProductId}
        </p>
      </div>

      {/* ── ② 무엇을 고칠 수 있는가 ───────────────────────────────────── */}
      <div className="p-3">
        <p className="font-medium text-slate-900">수정할 수 있는 항목</p>
        {editable.length > 0 ? (
          <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
            {editable.map((field) => (
              <li key={field.field}>✓ {field.label}</li>
            ))}
          </ul>
        ) : (
          /* 🔴 「수정할 수 없습니다」라고 말하지 않는다 — Coupang·LotteON 은
             확인되지 «않았을» 뿐이다. 문구는 capability 가 준 것을 쓴다. */
          <p className="mt-1 text-xs text-slate-600">{others[0]?.note}</p>
        )}
        {editable.length > 0 && others.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
            {others.map((field) => (
              <li key={field.field}>
                {field.label} — {field.note}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── ③ 무엇이 바뀌는가 ────────────────────────────────────────── */}
      <div className="p-3">
        {gate.changes.length > 0 ? (
          <>
            <p className="font-medium text-slate-900">변경사항 {gate.changes.length}건</p>
            <ul className="mt-1 space-y-2 text-xs">
              {gate.changes.map((change) => {
                const shown = describeChange(change);
                return (
                  <li key={change.field}>
                    <span className="text-slate-600">{shown.label}</span>
                    {/* 🔴 값 없음을 「-」로 채우지 않는다 — 빈 값으로 바뀐다고 읽힌다. */}
                    {shown.from !== undefined && shown.to !== undefined ? (
                      <p className="text-slate-900">
                        {shown.from} → <strong>{shown.to}</strong>
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="font-medium text-slate-600">변경사항 없음</p>
        )}

        {/* 🔴 대조하지 못한 항목을 손댔다면 «그렇다고만» 말한다. 무엇이
            달라졌는지는 우리가 모른다 — 「바뀝니다」로 단정하지 않는다. */}
        {gate.touched.length > 0 && (
          <p className="mt-2 text-xs text-slate-600">
            {gate.touched.map((field) => fields.find((f) => f.field === field)?.label).join(" · ")}
            을(를) 고치셨습니다. 바뀐 내용을 미리 보여드리지는 못하지만 그대로 반영됩니다.
          </p>
        )}

        <button
          type="button"
          /* 🔴 게이트가 정한다. 요약이 다시 세지 않는다 — 변경 1개 이상이어야
             열리고, 고칠 수 «없는» 항목의 변화는 세지 않는다(F-14-4). */
          disabled={busy || !gate.canSubmit}
          onClick={onSubmit}
          className="mt-3 w-full rounded-lg bg-slate-900 px-3 py-2 font-medium text-white disabled:opacity-40"
        >
          {busy ? "수정하는 중…" : "상품 수정"}
        </button>
        <p className="mt-1 text-xs text-slate-500">
          {gate.canSubmit
            ? `아직 ${commerceLabel}에 아무것도 보내지 않았습니다.`
            : "고친 내용이 있으면 버튼이 열립니다."}
        </p>
      </div>

      {/* ── 🔴 근거는 «접어서» 남긴다 — 없애지 않는다 ─────────────────── */}
      <details className="p-3 text-xs text-slate-600">
        <summary className="cursor-pointer select-none">자세히 보기</summary>
        <div className="mt-2 space-y-2">
          <p>
            아래는 {commerceLabel}에서 읽어 온 값과, 그것을 어떻게 대조했는지입니다. 수정이 뜻대로 되지 않을 때
            원인을 찾는 근거입니다.
          </p>
          <ul className="space-y-1">
            {fields.map((field) => (
              <li key={field.field}>
                <span className="font-medium">{field.label}</span> —{" "}
                {field.baseline.state === "UNREAD"
                  ? field.baseline.reason
                  : field.baseline.state === "PARTIAL"
                    ? `지금 ${field.baseline.value} · ${field.baseline.blind}`
                    : `지금 ${describeChange({ field: field.field, label: field.label, from: field.baseline.value }).from ?? "비어 있음"}`}
              </li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}
