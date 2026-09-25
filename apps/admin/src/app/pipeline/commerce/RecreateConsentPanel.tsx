"use client";

import type { ListingResult } from "@commerce/listing";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-10(CTO 지시, 2026-09-25) — **되묻는 자리.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 서버가 `resolveLifecycle()` 로 RECREATE 라고 «정했지만» 실행하지 않고 돌아온
 * 상태다. 이 패널이 뜬 시점에 채널로 나간 요청은 «0건» 이다.
 *
 * ── 🔴 말을 정확히 한다 ──────────────────────────────────────────────────
 * 「재등록」·「교체」·「기존 상품 삭제」처럼 읽히는 표현을 쓰지 않는다(CTO 명시).
 * 실제로 일어나는 일은 이것뿐이다:
 *
 *     · 이 커머스에 상품이 «하나 더» 생긴다
 *     · 기존 상품은 «그대로 남는다» — 우리가 지우지도 내리지도 않는다
 *     · 우리 쪽 「현재 연결」만 새 상품을 가리키게 바뀐다
 *
 * 「기존 상품을 새것으로 바꿉니다」라고 쓰면 셀러는 옛 상품이 사라진다고 읽고,
 * 실제로는 남아 있으니 그대로 두 개를 팔게 된다 — 지금 Production 에 있는
 * 중복 9건이 만들어진 방식과 같은 오해다. 그래서 문장으로 막는다.
 *
 * 🔴 옛 상품을 내릴지는 «셀러의 사업 판단» 이다. 그 버튼을 여기 두지 않는다 —
 * 우리에게 외부 상품을 내리는 코드 경로가 아예 없고, 만들지도 않았다.
 */

export interface RecreateConsentPanelProps {
  commerceLabel: string;
  request: NonNullable<ListingResult["needsConfirmation"]>;
  /** 진행 중이면 두 버튼 다 잠근다 — 두 번 눌러 두 개 만들지 않게. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RecreateConsentPanel({
  commerceLabel,
  request,
  busy = false,
  onConfirm,
  onCancel,
}: RecreateConsentPanelProps) {
  const current = request.currentExternalProductId;
  return (
    <section
      data-testid="recreate-consent"
      className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
    >
      <h3 className="text-base font-semibold">{commerceLabel} — 새 상품으로 다시 등록할까요?</h3>

      {/* 🔴 서버가 말한 이유를 그대로 옮긴다 — 화면이 지어내지 않는다. */}
      <p className="mt-2">{request.reason}</p>

      <div className="mt-3 rounded-lg border border-amber-200 bg-white/70 p-3">
        <p className="font-medium">진행하면 실제로 이렇게 됩니다</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>
            이 커머스에 상품이 <strong>하나 더</strong> 생깁니다.
          </li>
          <li>
            기존 상품{current ? ` ${current}` : ""}은 <strong>그대로 남습니다</strong> — 저희가 지우거나 판매중지로
            바꾸지 않습니다.
          </li>
          <li>기존 상품을 내릴지는 판매자센터에서 직접 정하시면 됩니다.</li>
        </ul>
      </div>

      {/* 🔴 아직 아무것도 나가지 않았다는 사실을 말한다 — 셀러가 「이미 만들어졌나」를
          걱정하지 않게. 실패 메시지처럼 보이면 안 되는 자리다. */}
      <p className="mt-3 text-xs text-amber-800">
        아직 {commerceLabel}에 아무것도 보내지 않았습니다. 아래를 누르셔야 등록 요청이 나갑니다.
      </p>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="rounded-lg bg-amber-600 px-3 py-2 font-medium text-white disabled:opacity-50"
        >
          {busy ? "등록하는 중…" : "새 상품으로 등록"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded-lg border border-amber-300 bg-white px-3 py-2 font-medium disabled:opacity-50"
        >
          그만두기
        </button>
      </div>
    </section>
  );
}
