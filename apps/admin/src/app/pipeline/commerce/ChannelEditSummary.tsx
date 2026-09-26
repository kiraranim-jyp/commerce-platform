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
 * ── 셀러에게 말하는 것은 둘뿐이다(F-14-7 에서 하나 줄었다) ───────────────
 *     ① 지금 어느 상품을 고치고 있는가
 *     ② 지금 무엇이 바뀌는가            → 그리고 [상품 수정]
 *
 * 🔴 「수정할 수 있는 항목」 목록은 «지웠다». 같은 사실이 왼쪽 편집 영역에 이미
 * 있고, 두 번 말하면 정작 봐야 할 변경사항이 아래로 밀린다. capability 는 그대로
 * 쓴다 — 지운 것은 목록 UI 뿐이다.
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

/**
 * 「불러오기 전」 — 아직 채널을 읽지 않은 상태.
 *
 * 🔴 불러온 뒤와 «같은 자리»(우측 고정 기둥)에 선다. 버튼만 다른 곳에 두면 셀러는
 * 수정 기능을 두 군데서 찾는다. 그리고 🔴 열기만 해서는 채널을 부르지 않는다 —
 * 셀러가 누를 때만 판매자 계정으로 GET 이 나간다.
 */
export function ChannelEditLoaderCard({
  commerceLabel,
  loading = false,
  note,
  onLoad,
}: {
  commerceLabel: string;
  loading?: boolean;
  note?: string | null;
  onLoad: () => void;
}) {
  return (
    <div
      data-summary="channel-edit-loader"
      className="overflow-hidden rounded-lg border border-border bg-surface p-4 text-sm shadow-elevated"
    >
      {/* 머리글 «격» 은 등록 준비와 같다 — 등록 후 관리는 별도 작업이다. */}
      <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">등록 후 관리</p>
      <p className="mt-1 text-base font-semibold text-text-primary">등록된 상품 수정</p>
      <p className="mt-2 text-xs text-slate-600">
        {commerceLabel}에 지금 등록돼 있는 내용을 불러와, 무엇이 바뀌는지 보고 수정할 수 있습니다.
      </p>
      <button
        type="button"
        disabled={loading}
        onClick={onLoad}
        className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium disabled:opacity-50"
      >
        {loading ? "불러오는 중…" : "등록된 내용 불러오기"}
      </button>
      {/* 🔴 실패한 이유를 남긴다 — 「아무 일도 안 일어남」이 되면 셀러는 다시
          등록을 눌러 중복을 만든다. */}
      {note && <p className="mt-2 text-xs text-slate-700">{note}</p>}
    </div>
  );
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * Commerce-3B(CPO 지시, 2026-09-26) — **「수정할 수 있는지 모른다」도 말한다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 무엇이 문제였나 ───────────────────────────────────────────────────────
 * Core 는 이 문장을 «이미 갖고 있었다»(`editUnavailableNote`). 그런데 프로덕션
 * 호출부가 0건이라, 쿠팡·롯데ON 을 연 셀러는 「등록된 상품을 수정할 수 있는가」에
 * 대해 **아무 말도 듣지 못했다** — 「확인되지 않았습니다」조차 못 들었다.
 * 그 자리에는 빈 칸이 있었고, 빈 칸은 「없다」가 아니라 「아무 말도 안 한 것」이다.
 *
 * ── 🔴 새 UX 를 «만들지» 않는다 ──────────────────────────────────────────
 * 자리는 이미 있다 — 우측 요약의 `editSummary` 슬롯이고, SmartStore 는 그 자리에
 * 「등록된 내용 불러오기」 카드를 세운다. 어댑터가 없는 채널은 «같은 자리에»
 * 같은 격의 카드로 사실만 적는다. 화면을 하나 더 만들면 셀러는 수정 관련 정보를
 * 두 군데서 찾게 된다(ChannelEditLoaderCard 주석과 같은 이유).
 *
 * ── 🔴 문구를 여기서 «지어내지» 않는다 ──────────────────────────────────
 * `note` 를 그대로 받는다. capability 계층(`editUnavailableNote` ·
 * `fieldCapabilityNote`)이 이미 정한 문장이고, 여기서 다시 쓰면 같은 사실이 두
 * 목소리로 갈라진다. 「안 됩니다」가 아니라 「확인되지 않았습니다」인 것도 그
 * 계층의 결정이다.
 *
 * 🔴 버튼이 없다. 누를 것이 없는 상태이므로 누를 수 있는 것처럼 보이면 안 된다.
 *
 * 🔴 「무엇이 확인되면 열리는가」(예: 「등록 상품 GET 실측 후 지원 범위 확정」)는
 * 이 카드가 «받지 않는다». 그 문장은 채널마다 다른 사실이고, 화면이 그것을 알면
 * 채널 지식이 UI 로 새어 나온다 — 있어야 할 자리는 `CHANNEL_CAPABILITY` 표다
 * (지금은 그 표의 «주석» 에만 있어서 화면까지 못 온다). 필드로 올릴지는 CPO
 * 결정이므로 여기서 미리 인자를 만들어 두지 않는다.
 */
export function ChannelEditUnavailableCard({
  commerceLabel,
  note,
}: {
  commerceLabel: string;
  /**
   * 🔴 `undefined` 면 «아무것도 그리지 않는다». `editUnavailableNote()` 는 어댑터가
   * 있는 채널에서 undefined 를 내므로, 호출부는 채널을 가려낼 조건을 따로 쓰지
   * 않고 그 결과를 그대로 넘기면 된다 — 조건이 두 곳에 생기면 갈라진다.
   */
  note: string | undefined;
}) {
  if (!note) return null;
  return (
    <div
      data-summary="channel-edit-unavailable"
      className="overflow-hidden rounded-lg border border-border bg-surface p-4 text-sm shadow-elevated"
    >
      {/* 머리글은 SmartStore 의 수정 카드와 «같은 격» 이다 — 같은 일의 다른 상태다. */}
      <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">등록 후 관리</p>
      <p className="mt-1 text-base font-semibold text-text-primary">등록된 상품 수정</p>
      <p className="mt-2 text-xs text-slate-600">
        {commerceLabel} — <span className="font-medium text-text-primary">확인되지 않음</span>
      </p>
      <p className="mt-2 text-xs text-slate-700">{note}</p>
    </div>
  );
}

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
      {/* ── ① 지금 어느 상품을 고치는가 ─────────────────────────────────
          🔴 F-14-7(CTO 지시 §2) — 머리글 «격» 을 등록 준비와 같게 맞춘다.
          (RegistrationStatusBanner 의 「등록 준비 상태」와 같은 형식이다.)
          등록 후 «관리» 는 등록 준비의 부속 정보가 아니라 별도 작업이다. */}
      <section className="px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">등록 후 관리</p>
        <p className="mt-1 text-base font-semibold text-text-primary">등록된 상품 수정</p>
        <p className="mt-1 text-xs text-slate-600">
          {commerceLabel} · 상품번호 {model.source.externalProductId}
        </p>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          🔴 F-14-7(CTO 지시 §1) — 「수정할 수 있는 항목」 목록이 «있던 자리» 다.

          지웠다. 같은 사실이 두 군데 있었다 — 항목마다 고칠 수 있는지는 왼쪽
          편집 영역이 이미 말하고 있고(schema 의 note), 우측이 그것을 한 번 더
          나열하면 화면이 길어지는 만큼 «정작 봐야 할» 변경사항이 밀린다.

          🔴 capability 자체는 «그대로» 쓴다. 지운 것은 목록 UI 뿐이고, 무엇을
          고칠 수 있는지는 여전히 editorFieldSchema 가 정하며 아래 게이트도
          그 판단을 따른다(고칠 수 없는 항목의 변화는 세지 않는다).

          🔴 고칠 수 «있는 항목이 하나도 없는» 채널은 그 사실만 한 줄로 말한다 —
          Coupang·LotteON 이 그렇다. 목록을 지웠다고 「수정할 수 있다」로 보이면
          안 된다. */}
      {editable.length === 0 && (
        <div className="p-3">
          {/* 🔴 「수정할 수 없습니다」가 아니다 — 확인되지 «않았을» 뿐이고,
              문구는 capability 가 준 것을 그대로 쓴다. */}
          <p className="text-xs text-slate-600">{others[0]?.note}</p>
        </div>
      )}

      {/* ── ② 무엇이 바뀌는가 ────────────────────────────────────────── */}
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
