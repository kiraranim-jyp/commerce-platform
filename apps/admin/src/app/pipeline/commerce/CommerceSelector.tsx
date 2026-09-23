"use client";

import type { CommerceId } from "./commerce-registry";
import type { RegistrationChannel } from "./registration-channels";
import { readinessStateToLevel, type ReadinessLevel } from "./readiness-state";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * N-05-A(CPO 지시, 2026-09-23) — **등록할 커머스를 Master 에서 고른다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 이 화면이 하는 일 ─────────────────────────────────────────────────────
 * 고르기만 한다. 고르는 것은 등록이 아니다:
 *
 *     선택  →  준비 상태 확인  →  payload  →  등록
 *
 * 네 단계를 한 버튼에 합치지 않는다. 체크를 켰다고 상품이 나가면 셀러는
 * 체크박스를 무서워서 못 누른다.
 *
 * ── 🔴 여기서 판정하지 않는다 ─────────────────────────────────────────────
 * 각 줄의 상태 점과 「확인 N건」은 이미 계산된 값(`RegistrationChannel`)을
 * 그대로 옮긴 것이다. 오른쪽 Action Center · ④ 커머스 등록과 **같은 배열**을
 * 본다 — 목록이 두 벌이 되는 순간 「카드에는 있는데 선택기에는 없는」 채널이
 * 생긴다.
 *
 * ── 🔴 준비가 안 된 채널도 «고를 수 있다» ─────────────────────────────────
 * 체크박스를 잠그지 않는다. 한 채널이 부족하다고 나머지를 못 고르게 하면
 * 「쿠팡 때문에 스마트스토어도 못 넣는」 상태가 된다 — CPO 가 명시한 채널
 * 독립성이 화면에서 먼저 깨진다. 대신 그 줄에 무엇이 부족한지 적는다.
 */

const LEVEL_DOT_CLASS: Record<ReadinessLevel, string> = {
  GREEN: "bg-success",
  YELLOW: "bg-warning",
  RED: "bg-error",
};

/** 아직 등록 기능이 없는 채널은 고를 수 없다 — 고르면 갈 곳이 없다. */
export function isSelectableCommerce(channel: RegistrationChannel): boolean {
  return channel.availability !== "COMING_SOON";
}

/** 선택 결과 한 줄 요약. 화면과 테스트가 같은 문장을 쓴다. */
export function selectionSummary(count: number): string {
  return count === 0 ? "선택된 커머스가 없습니다" : `선택 ${count}개`;
}

function statusNote(channel: RegistrationChannel): string {
  if (channel.availability === "COMING_SOON") return "준비중";
  if (!channel.state) return "아직 확인하지 않았습니다";
  if (channel.blockingCount > 0) {
    return `확인 ${channel.blockingCount}건${channel.provisional ? " (사전 점검)" : ""}`;
  }
  return channel.state === "READY" ? "준비됨" : "확인 필요";
}

export function CommerceSelector({
  channels,
  selected,
  onToggle,
  onConfirm,
}: {
  channels: RegistrationChannel[];
  selected: readonly CommerceId[];
  onToggle: (id: CommerceId, next: boolean) => void;
  /** 선택을 확정하고 준비 상태를 확인하러 간다. 여기서 등록하지 «않는다». */
  onConfirm?: () => void;
}) {
  const selectable = channels.filter(isSelectableCommerce);
  const selectedCount = selected.length;

  return (
    <section className="rounded-lg border border-border bg-surface px-3 py-2.5 shadow-subtle">
      <p className="mb-1.5 text-[11px] font-medium leading-4 text-text-tertiary">등록할 커머스</p>
      <ul className="space-y-1">
        {selectable.map((channel) => {
          const checked = selected.includes(channel.id);
          const level = channel.state ? readinessStateToLevel(channel.state) : null;
          return (
            <li key={channel.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-background">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => onToggle(channel.id, event.target.checked)}
                  className="h-4 w-4 shrink-0 accent-primary"
                />
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  {level ? (
                    <span className={`h-2 w-2 shrink-0 rounded-full ${LEVEL_DOT_CLASS[level]}`} aria-label={level} />
                  ) : (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-border" aria-hidden />
                  )}
                  <span className="truncate text-sm font-medium text-text-primary">{channel.label}</span>
                </span>
                <span className="shrink-0 text-[11px] text-text-tertiary">{statusNote(channel)}</span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-text-secondary">{selectionSummary(selectedCount)}</span>
        {onConfirm && (
          <button
            type="button"
            onClick={onConfirm}
            /* 🔴 하나도 고르지 않으면 다음 단계가 성립하지 않는다. 버튼을
               숨기지 않고 잠근다 — 사라지면 셀러는 기능이 없다고 읽는다. */
            disabled={selectedCount === 0}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-border disabled:text-text-tertiary"
          >
            등록 준비 확인
          </button>
        )}
      </div>
      {/* 고르는 것과 등록하는 것을 화면이 직접 갈라 말한다. */}
      <p className="mt-1 text-[11px] text-text-tertiary">
        고른 커머스의 준비 상태를 확인합니다 — 여기서 바로 등록되지 않습니다.
      </p>
    </section>
  );
}
