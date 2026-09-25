"use client";

import type { ListingResult } from "@commerce/listing";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-12(CTO 지시, 2026-09-25) — **PUT 직전 보고서.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 네이버 수정은 PATCH 가 아니라 «전체 교체» 다(공식: 「포함하지 않은 정보는
 * 제거하는 행동으로 동작」). `detectUpdateDataLoss()` 가 「사라지는 것」은
 * 막지만 「의도하지 않은 변경」은 막지 못한다 — 그것은 사람만 알아본다.
 * 이 패널이 그 사람의 눈이다.
 *
 * 🔴 이 패널이 보이는 동안 스마트스토어로 나간 요청은 «0건» 이다.
 *
 * ── 🔴 「유지됨」을 한 덩어리로 적지 않는다 ───────────────────────────────
 * 보장의 «종류» 가 다르고, 섞으면 확인하지 않은 것을 확인했다고 말하게 된다:
 *
 *     그대로입니다        값이 같음을 «대조해서 확인했다»
 *     사라지지 않습니다   값은 모르지만 손실검사가 «없어지지 않음» 을 지킨다
 *     확인하지 못했습니다 아예 보지 못했다 — 이유를 같이 적는다
 *
 * 「상세설명: 유지」라고 적으면 셀러는 내용이 같다고 읽는다. 실제로 우리가 아는
 * 것이 「비어 있지는 않다」뿐이면 그것은 거짓이다. 그래서 세 칸으로 나눈다.
 *
 * 🔴 화면이 «다시 계산하지 않는다». 서버가 실제로 보낼 payload 를 놓고 만든
 * diff 를 그대로 보여준다 — 미리보기와 실제가 갈라질 길을 만들지 않는다.
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
  /* 🔴 손실검사가 BLOCKED 면 실행 버튼을 «만들지 않는다». 비활성화가 아니라
     아예 없다 — 있으면 누군가 disabled 를 떼고 싶어진다. */
  const blocked = diff?.dataLossCheck === "BLOCKED";

  return (
    <section
      data-testid="update-confirm"
      className="rounded-xl border border-sky-300 bg-sky-50 p-4 text-sm text-sky-950"
    >
      <h3 className="text-base font-semibold">{commerceLabel} — 등록된 상품을 이렇게 수정합니다</h3>
      <p className="mt-1 text-xs text-sky-800">
        상품번호 {request.currentExternalProductId ?? "확인 불가"} · {request.reason}
      </p>

      {/* ── 바뀌는 것 ──────────────────────────────────────────────────── */}
      <div className="mt-3 rounded-lg border border-sky-200 bg-white/80 p-3">
        <p className="font-medium">바뀝니다</p>
        {diff && diff.changed.length > 0 ? (
          <ul className="mt-1 space-y-1">
            {diff.changed.map((item) => (
              <li key={item.label}>
                <span className="font-medium">{item.label}</span>
                {/* 🔴 from/to 가 «없을 수도» 있다(개수 축·값 없음). 없으면
                    「-」로 채우지 않고 그 사실을 말한다 — 「빈 값으로 바뀐다」로
                    읽히면 안 된다. */}
                {item.from !== undefined && item.to !== undefined ? (
                  <>
                    : {item.from} → <strong>{item.to}</strong>
                  </>
                ) : item.to !== undefined ? (
                  <> : 새로 채웁니다 → <strong>{item.to}</strong></>
                ) : item.from !== undefined ? (
                  <> : 지금 있는 값({item.from})을 이번에 보내지 않습니다</>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1">대조한 범위에서 달라진 항목이 없습니다.</p>
        )}
        <p className="mt-2 text-xs text-sky-800">
          카테고리:{" "}
          {diff?.category === "SAME"
            ? "그대로입니다"
            : diff?.category === "CHANGED"
              ? "🔴 바뀝니다"
              : "확인하지 못했습니다"}
        </p>
      </div>

      {/* ── 🔴 보장의 종류를 나눠서 ────────────────────────────────────── */}
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-sky-200 bg-white/60 p-3">
          <p className="font-medium">그대로입니다</p>
          <p className="text-xs text-sky-700">값이 같음을 대조해서 확인했습니다.</p>
          <ul className="mt-1 list-disc pl-4">
            {(diff?.unchanged ?? []).map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-sky-200 bg-white/60 p-3">
          <p className="font-medium">사라지지 않습니다</p>
          <p className="text-xs text-sky-700">값은 대조하지 못했지만 손실검사가 지킵니다.</p>
          <ul className="mt-1 list-disc pl-4">
            {(diff?.lossChecked ?? []).map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-sky-200 bg-white/60 p-3">
          <p className="font-medium">확인하지 못했습니다</p>
          <p className="text-xs text-sky-700">보지 못한 항목입니다 — 이유를 함께 적었습니다.</p>
          <ul className="mt-1 list-disc pl-4">
            {(diff?.notCompared ?? []).map((item) => (
              <li key={item.label} title={item.reason}>
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── 손실 검사 ──────────────────────────────────────────────────── */}
      <p className="mt-3">
        데이터 손실 검사:{" "}
        <strong>{diff?.dataLossCheck === "PASS" ? "PASS" : diff?.dataLossCheck === "BLOCKED" ? "BLOCKED" : "확인 불가"}</strong>
        {blocked && diff?.dataLossRisks ? (
          <span> — 사라지는 항목: {diff.dataLossRisks.map((r) => r.label).join(", ")}</span>
        ) : null}
      </p>

      <p className="mt-3 text-xs text-sky-800">
        아직 {commerceLabel}에 아무것도 보내지 않았습니다.
        {blocked
          ? " 사라지는 항목이 있어 실행할 수 없습니다 — 부족한 값을 채운 뒤 다시 시도해주세요."
          : " 아래를 누르셔야 수정 요청이 나갑니다."}
      </p>

      <div className="mt-3 flex gap-2">
        {/* 🔴 BLOCKED 면 실행 버튼 자체가 없다. */}
        {!blocked && (
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-lg bg-sky-700 px-3 py-2 font-medium text-white disabled:opacity-50"
          >
            {busy ? "수정하는 중…" : "이대로 수정"}
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded-lg border border-sky-300 bg-white px-3 py-2 font-medium disabled:opacity-50"
        >
          그만두기
        </button>
      </div>
    </section>
  );
}
