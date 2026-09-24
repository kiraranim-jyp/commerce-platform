"use client";

import type {
  CommerceId,
  CommerceLastAttempts,
  CommerceMissingByChannel,
  CommerceMissingItem,
  CommerceOutcomes,
} from "./commerce-registry";
import { missingKindLabel } from "./commerce-registry";
import type { RegistrationChannel } from "./registration-channels";
import { readinessStateToLevel, type ReadinessLevel } from "./readiness-state";
import { kcStatusNote } from "./kc-status-note";
import type { KcStatus } from "@commerce/listing";

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

/** 줄마다 몇 개까지 이름을 적을지. 나머지는 「외 N건」으로 말한다 — 숨기지 않는다. */
const MISSING_PREVIEW_COUNT = 3;

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

/**
 * ════════════════════════════════════════════════════════════════════════════
 * N-06-D(CPO 확정, 2026-09-24) — **고른 것들이 지금 등록 가능한가.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 새 판정을 만들지 않는다. 각 채널이 이미 보고한 `state` 를 세기만 한다.
 *
 * 세 갈래로만 나눈다 — 이 이상은 지금 데이터가 말해 주지 않는다:
 *   등록 가능    state === "READY"
 *   확인 필요    state 는 있는데 READY 가 아니다
 *   확인 전      state 가 아직 «없다»(보고된 적 없음) → 0 을 「준비됨」으로 읽지 않기 위해
 */
export interface SelectionReadinessCounts {
  selected: number;
  ready: number;
  needsReview: number;
  unknown: number;
}

export function countSelectionReadiness(
  channels: RegistrationChannel[],
  selected: readonly CommerceId[],
): SelectionReadinessCounts {
  const picked = channels.filter((channel) => selected.includes(channel.id));
  return {
    selected: picked.length,
    ready: picked.filter((channel) => channel.state === "READY").length,
    needsReview: picked.filter((channel) => channel.state && channel.state !== "READY").length,
    unknown: picked.filter((channel) => !channel.state).length,
  };
}

/** 위 숫자를 사람이 읽는 한 줄로. 0 인 갈래는 아예 적지 않는다(없는 것을 세지 않는다). */
export function selectionReadinessSummary(counts: SelectionReadinessCounts): string {
  if (counts.selected === 0) return "";
  const parts: string[] = [];
  if (counts.ready > 0) parts.push(`등록 가능 ${counts.ready}`);
  if (counts.needsReview > 0) parts.push(`확인 필요 ${counts.needsReview}`);
  if (counts.unknown > 0) parts.push(`확인 전 ${counts.unknown}`);
  return parts.join(" · ");
}

/** 결과가 나온 뒤에는 준비 상태 대신 «결과» 를 적는다. */
const OUTCOME_NOTE: Record<"SUBMITTED" | "FAILED" | "SKIPPED", string> = {
  SUBMITTED: "✓ 등록 완료",
  FAILED: "✕ 등록 실패",
  SKIPPED: "— 실행하지 않음",
};

/**
 * N-06-B — 등록 «이력» 한 줄. 준비 상태와 다른 축이라 따로 적는다.
 *
 * 🔴 체크(선택)와 등록은 다른 개념이다. 「☑ 쿠팡」은 «이번에 등록할 곳» 이고,
 * 「✓ 등록됨」은 «이미 올라가 있다» 이다. 한 줄에 섞어 쓰면 셀러가 체크만 하고
 * 등록된 줄로 읽는다.
 *
 * 🔴 이력이 없으면 «미등록» 이라고만 말한다. 「등록 실패」가 아니다 — 시도한
 * 적이 없다. 없는 사실을 지어내지 않는다.
 */
export function registrationNote(attempt: CommerceLastAttempts[CommerceId]): string {
  if (!attempt) return "○ 미등록";
  const when = formatAttemptTime(attempt.at);
  if (attempt.status === "SUBMITTED") {
    return attempt.externalProductId
      ? `✓ 등록됨 · ${when} · 상품번호 ${attempt.externalProductId}`
      : `✓ 등록됨 · ${when}`;
  }
  return attempt.errorCode ? `✕ 최근 등록 실패 · ${when} · ${attempt.errorCode}` : `✕ 최근 등록 실패 · ${when}`;
}

/** 「2026-09-22 14:32」. 지어낸 상대시간("3일 전")을 쓰지 않는다 — 대조할 때 쓰는 값이다. */
function formatAttemptTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * N-06 C-5(CPO 확정, 2026-09-24) — **아는 것만 적는다.**
 *
 * 필수 항목 전체 수를 알면 「필수 21 · 확인 2건」처럼 «몇 개 중 몇 개» 인지
 * 말한다. 그 수를 모르면(아직 보고 전이거나 롯데ON 이 카테고리 전) 예전처럼
 * 「확인 2건」만 적는다.
 *
 * 🔴 「자동 해결 19」를 적지 «않는다». 21 − 2 = 19 는 산수로는 맞지만, 그 19가
 * 「자동으로 해결됐다」는 뜻인지 「애초에 요구되지 않았다」는 뜻인지 지금
 * 데이터로는 가를 수 없다. 가르는 축은 N-07 Requirement Engine 에서 만든다 —
 * 추정한 숫자를 화면에 적으면 그때부터 이 화면의 모든 숫자를 의심하게 된다.
 */
function statusNote(channel: RegistrationChannel): string {
  if (channel.availability === "COMING_SOON") return "준비중";
  if (!channel.state) return "아직 확인하지 않았습니다";
  const scope = channel.requiredTotal > 0 ? `필수 ${channel.requiredTotal} · ` : "";
  if (channel.blockingCount > 0) {
    return `${scope}확인 ${channel.blockingCount}건${channel.provisional ? " (사전 점검)" : ""}`;
  }
  return channel.state === "READY" ? `${scope}준비됨` : `${scope}확인 필요`;
}

export function CommerceSelector({
  channels,
  selected,
  onToggle,
  onConfirm,
  onRegisterSelected,
  running = null,
  outcomes,
  lastAttempts,
  checking = false,
  missingByCommerce,
  onFixRequest,
  smartstoreKcStatus,
}: {
  channels: RegistrationChannel[];
  selected: readonly CommerceId[];
  onToggle: (id: CommerceId, next: boolean) => void;
  /** 선택을 확정하고 준비 상태를 확인하러 간다. 여기서 등록하지 «않는다». */
  onConfirm?: () => void;
  /** N-05-C — 선택한 커머스에 차례로 등록한다. 누르면 최종 확인 화면이 뜬다. */
  onRegisterSelected?: () => void;
  /** 지금 등록 중인 커머스. 실행 중에는 선택을 바꿀 수 없다. */
  running?: CommerceId | null;
  /** N-05-D — 채널별 결과. 실패한 채널 때문에 성공한 채널을 지우지 않는다. */
  outcomes?: CommerceOutcomes;
  /** N-06-B — registration_attempts 에서 읽은 «채널별 마지막 시도». */
  lastAttempts?: CommerceLastAttempts;
  /** [등록 준비 확인] 이 도는 중. */
  checking?: boolean;
  /** N-06-C — 채널별로 «무엇이» 비었는가. 이름을 적어야 셀러가 찾아갈 수 있다. */
  missingByCommerce?: CommerceMissingByChannel;
  /** N-06-C — 그 항목을 고치러 «바로» 간다(채널 + 섹션까지). */
  onFixRequest?: (item: CommerceMissingItem) => void;
  /**
   * N-07-01 2차 — 스마트스토어 KC 상태(`resolveKcStatus()` 결과 그대로).
   * 🔴 여기서 판정하지 않는다. `null` 은 「해당 없음」이 아니라 «아직 판정이
   * 없다»(탭을 안 열었다)는 뜻이다.
   */
  smartstoreKcStatus?: KcStatus | null;
}) {
  const selectable = channels.filter(isSelectableCommerce);
  const selectedCount = selected.length;
  const busy = running !== null;
  const readinessSummaryText = selectionReadinessSummary(countSelectionReadiness(channels, selected));

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
                  disabled={busy}
                  onChange={(event) => onToggle(channel.id, event.target.checked)}
                  className="h-4 w-4 shrink-0 accent-primary"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-1.5">
                    {level ? (
                      <span className={`h-2 w-2 shrink-0 rounded-full ${LEVEL_DOT_CLASS[level]}`} aria-label={level} />
                    ) : (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-border" aria-hidden />
                    )}
                    <span className="truncate text-sm font-medium text-text-primary">{channel.label}</span>
                    {/* 🔴 결과가 있으면 결과가 이긴다 — 등록이 끝난 줄에 「준비됨」이
                        그대로 남으면 셀러는 아직 안 나간 줄로 읽는다. */}
                    <span className="ml-auto shrink-0 text-[11px] text-text-tertiary">
                      {running === channel.id
                        ? "등록 중…"
                        : outcomes?.[channel.id]
                          ? OUTCOME_NOTE[outcomes[channel.id]!.status]
                          : checked && checking && !channel.state
                            ? "확인 중…"
                            : statusNote(channel)}
                    </span>
                  </span>
                  {/* N-06-B — 준비 상태와 «다른 축». 이미 올라가 있는가. */}
                  <span className="pl-3.5 text-[11px] text-text-tertiary">
                    {registrationNote(lastAttempts?.[channel.id])}
                  </span>
                </span>
              </label>

              {/* ── N-06-C — 「확인 2건」에서 끝내지 않는다 ─────────────────
                  무엇이 비었는지 «이름» 을 적고, 그 자리로 데려간다. 이름 없이
                  개수만 적으면 셀러는 채널 화면을 처음부터 다시 읽어야 한다.

                  🔴 고를 때만 펼친다 — 고르지도 않은 채널의 부족 목록이 길게
                  늘어지면 정작 고른 채널이 묻힌다. */}
              {/* ── N-07-01 2차 — KC 한 줄 ────────────────────────────────
                  🔴 고른 채널에만, 그리고 스마트스토어에만 보여준다. 쿠팡·롯데ON
                  에는 이 4-state 가 «존재하지 않는다» — 조사 결과 각 커머스의
                  조건부 요구사항은 서로 다르고, 공통 UI 패턴만 재사용한다. */}
              {checked && channel.id === "smartstore" && (
                <div className="mb-1 ml-9 flex items-center gap-1.5 text-[11px]">
                  {(() => {
                    const note = kcStatusNote(smartstoreKcStatus);
                    return (
                      <>
                        <span className={note.tone === "OK" ? "text-success" : note.tone === "ATTENTION" ? "text-warning" : "text-text-tertiary"}>
                          {note.tone === "OK" ? "✓" : note.tone === "ATTENTION" ? "⚠" : "—"}
                        </span>
                        <span className="text-text-secondary">{note.text}</span>
                        {note.actionLabel && onFixRequest && (
                          <button
                            type="button"
                            onClick={() =>
                              onFixRequest({
                                commerceId: "smartstore",
                                key: "smartstore:kc",
                                label: "KC 인증",
                                sectionId: "section-kc",
                              })
                            }
                            className="text-primary underline underline-offset-2 hover:text-primary-hover"
                          >
                            {note.actionLabel}
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {checked && (missingByCommerce?.[channel.id]?.length ?? 0) > 0 && (
                <ul className="mb-1 ml-9 space-y-0.5">
                  {missingByCommerce![channel.id]!.slice(0, MISSING_PREVIEW_COUNT).map((item) => (
                    <li key={item.key} className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                      <span className="text-warning">•</span>
                      <span className="truncate">{item.label}</span>
                      {/* N-07-01 2차 — 「확인만 하면 되는 것」과 「직접 적어야 하는
                          것」은 셀러가 들이는 품이 다르다. 근거가 없으면 이 칸은
                          아예 나오지 않는다(missingKindLabel → null). */}
                      {missingKindLabel(item.kind) && (
                        <span
                          className={`shrink-0 rounded px-1 py-px text-[10px] ${
                            item.kind === "INPUT"
                              ? "bg-warning-soft text-warning"
                              : "bg-surface-hover text-text-tertiary"
                          }`}
                        >
                          {missingKindLabel(item.kind)}
                        </span>
                      )}
                      {onFixRequest && (
                        <button
                          type="button"
                          onClick={() => onFixRequest(item)}
                          className="shrink-0 text-primary underline underline-offset-2 hover:text-primary-hover"
                        >
                          바로 수정
                        </button>
                      )}
                    </li>
                  ))}
                  {missingByCommerce![channel.id]!.length > MISSING_PREVIEW_COUNT && (
                    <li className="text-[11px] text-text-tertiary">
                      외 {missingByCommerce![channel.id]!.length - MISSING_PREVIEW_COUNT}건 —{" "}
                      {channel.label} 화면에서 이어서 확인합니다
                    </li>
                  )}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-text-secondary">
          {selectionSummary(selectedCount)}
          {/* N-06-D — 고른 것들이 «지금» 등록 가능한지 한 줄로. 판정은 위 줄들과 같다. */}
          {readinessSummaryText && <span className="ml-1.5 text-text-tertiary">· {readinessSummaryText}</span>}
        </span>
        {onRegisterSelected && (
          <button
            type="button"
            onClick={onRegisterSelected}
            disabled={selectedCount === 0 || busy}
            className="rounded-md border border-primary px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary-soft disabled:cursor-not-allowed disabled:border-border disabled:text-text-tertiary"
          >
            {busy ? "등록 중…" : "선택한 커머스 등록"}
          </button>
        )}
        {onConfirm && (
          <button
            type="button"
            onClick={onConfirm}
            /* 🔴 하나도 고르지 않으면 다음 단계가 성립하지 않는다. 버튼을
               숨기지 않고 잠근다 — 사라지면 셀러는 기능이 없다고 읽는다. */
            disabled={selectedCount === 0 || checking}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-border disabled:text-text-tertiary"
          >
            {checking ? "확인 중…" : "등록 준비 확인"}
          </button>
        )}
      </div>
      {/* 고르는 것과 등록하는 것을 화면이 직접 갈라 말한다. */}
      <p className="mt-1 text-[11px] text-text-tertiary">
        {onRegisterSelected
          ? "선택한 커머스에 차례로 등록합니다 — 한 곳이 실패해도 나머지는 그대로 진행됩니다."
          : "고른 커머스의 준비 상태를 확인합니다 — 여기서 바로 등록되지 않습니다."}
      </p>
    </section>
  );
}
