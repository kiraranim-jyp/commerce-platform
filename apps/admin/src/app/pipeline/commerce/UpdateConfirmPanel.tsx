"use client";

import type { ListingResult } from "@commerce/listing";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-13(CEO 지시, 2026-09-26) — **셀러가 읽는 화면으로 바꾼다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 네이버 수정은 «전체 교체» 라, 무엇이 바뀌는지 보여주고 사람이 확인한 뒤에만
 * 보낸다 — 그 원칙은 그대로다. 바뀌는 것은 «말투» 다.
 *
 * ── 🔴 개발용 낱말을 앞면에서 걷어낸다 ─────────────────────────────────
 * ChangeSet · Data Loss Gate · preflight · GET/PUT · comparedEverything ·
 * NOT_COMPARED 는 우리가 쓰는 말이지 셀러가 쓰는 말이 아니다. 화면에 그대로
 * 두면 셀러는 「내가 모르는 일이 벌어지는구나」로 읽고, 정작 봐야 할 «무엇이
 * 바뀌는가» 를 놓친다.
 *
 * ── 🔴 그렇다고 «지우지» 않는다 ────────────────────────────────────────
 * 값이 같음을 확인한 축 · 손실검사만 지키는 축 · 아예 못 본 축의 구분은
 * 일이 잘못됐을 때 원인을 가르는 유일한 근거다. 앞면에서 빼되 «자세히» 안에
 * 그대로 둔다 — 접는 것과 없애는 것은 다르다.
 *
 * ── 앞면이 말하는 것은 셋뿐이다 ───────────────────────────────────────
 *     ① 무엇이 바뀌는가          (사용자가 고친 것만)
 *     ② 사라지는 것이 있는가      (한 줄)
 *     ③ 아직 보내지 않았다        (한 줄)
 */

export interface UpdateConfirmPanelProps {
  commerceLabel: string;
  request: NonNullable<ListingResult["needsConfirmation"]>;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function UpdateConfirmPanel({
  commerceLabel,
  request,
  busy = false,
  onConfirm,
  onCancel,
}: UpdateConfirmPanelProps) {
  const diff = request.diff;
  /* 🔴 사라지는 것이 있으면 실행 버튼을 «만들지 않는다». 비활성화가 아니라
     아예 없다 — 있으면 누군가 disabled 를 떼고 싶어진다. */
  const blocked = diff?.dataLossCheck === "BLOCKED";
  const changed = diff?.changed ?? [];

  return (
    <section
      data-testid="update-confirm"
      className="rounded-xl border border-sky-300 bg-sky-50 p-4 text-sm text-sky-950"
    >
      <h3 className="text-base font-semibold">상품을 수정하시겠습니까?</h3>
      <p className="mt-1 text-xs text-sky-800">
        {commerceLabel} · 상품번호 {request.currentExternalProductId ?? "확인 불가"}
      </p>

      {/* ── ① 무엇이 바뀌는가 ─────────────────────────────────────────── */}
      <div className="mt-3 rounded-lg border border-sky-200 bg-white/80 p-3">
        <p className="font-medium">변경 내용</p>
        {changed.length > 0 ? (
          <ul className="mt-1 space-y-1">
            {changed.map((item) => (
              <li key={item.label}>
                {item.label}
                {/* 🔴 값을 모르는 축(개수·이미지 등)은 「-」로 채우지 않는다.
                    빈 값으로 바뀐다고 읽히면 안 된다. */}
                {item.from !== undefined && item.to !== undefined ? (
                  <>
                    {" "}
                    {item.from} → <strong>{item.to}</strong>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          /* 🔴 「변경 없음」이라고 «단정하지» 않는다. 우리가 대조한 범위에서
             차이가 없었을 뿐이고, 이미지처럼 대조하지 못하는 축이 있다. */
          <p className="mt-1">대조한 항목 중에는 달라진 것이 없습니다. 수정을 보내면 지금 화면의 내용으로 다시 등록됩니다.</p>
        )}
        {diff?.category === "CHANGED" && <p className="mt-2">카테고리가 바뀝니다.</p>}
      </div>

      {/* ── ② 사라지는 것이 있는가 — 한 줄 ────────────────────────────── */}
      <p className="mt-3">
        {blocked ? (
          <>
            🔴 이대로 수정하면 <strong>{diff?.dataLossRisks?.map((r) => r.label).join(", ")}</strong>이(가)
            사라집니다. 그래서 보내지 않았습니다.
          </>
        ) : (
          "상품 정보가 사라지는 변경은 없는 것으로 확인되었습니다."
        )}
      </p>

      {/* ── ③ 아직 보내지 않았다 ──────────────────────────────────────── */}
      <p className="mt-1 text-xs text-sky-800">
        {blocked
          ? "부족한 값을 채운 뒤 다시 시도해주세요."
          : `아직 ${commerceLabel}에 아무것도 보내지 않았습니다.`}
      </p>

      {/* ── 🔴 근거는 «접어서» 남긴다 — 없애지 않는다 ─────────────────── */}
      <details className="mt-3 text-xs text-sky-800">
        <summary className="cursor-pointer select-none">확인한 내용 자세히 보기</summary>
        <div className="mt-2 space-y-2">
          <div>
            <p className="font-medium">그대로인 항목 (값이 같음을 확인)</p>
            <p>{diff?.unchanged?.length ? diff.unchanged.join(" · ") : "없음"}</p>
          </div>
          <div>
            <p className="font-medium">사라지지 않도록 지킨 항목</p>
            <p>{diff?.lossChecked?.length ? diff.lossChecked.join(" · ") : "없음"}</p>
          </div>
          <div>
            <p className="font-medium">대조하지 못한 항목</p>
            {/* 🔴 이유를 같이 남긴다 — 나중에 「왜 못 봤지」를 되짚는 유일한 근거다. */}
            <ul className="mt-1 list-disc pl-4">
              {(diff?.notCompared ?? []).map((item) => (
                <li key={item.label}>
                  {item.label}
                  {item.reason ? ` — ${item.reason}` : ""}
                </li>
              ))}
            </ul>
          </div>
          <p>
            카테고리:{" "}
            {diff?.category === "SAME"
              ? "그대로입니다"
              : diff?.category === "CHANGED"
                ? "바뀝니다"
                : "확인하지 못했습니다"}
          </p>
        </div>
      </details>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded-lg border border-sky-300 bg-white px-3 py-2 font-medium disabled:opacity-50"
        >
          취소
        </button>
        {!blocked && (
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-lg bg-sky-700 px-3 py-2 font-medium text-white disabled:opacity-50"
          >
            {busy ? "수정하는 중…" : "상품 수정"}
          </button>
        )}
      </div>
    </section>
  );
}
