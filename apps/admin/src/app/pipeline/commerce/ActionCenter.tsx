"use client";

import type { PlatformId } from "@commerce/shared";
import { readinessStateToLevel, type PriorityItem, type ReadinessLevel, type RegistrationReadinessState } from "./readiness-state";
import { buildRegistrationChannels, channelActionLabel, type RegistrationChannel } from "./registration-channels";

/**
 * MI-FLOW-2(CEO 지시, 2026-09-11) — 상품정보 화면 오른쪽 기둥.
 *
 * ── 이 컬럼이 아닌 것 ────────────────────────────────────────────────────
 * 왼쪽 정보의 두 번째 사본이 아니다. 기존 "등록 전 확인" 블록은 판정·채널 상태·
 * 부족 항목을 본문 폭 전체로 다시 한 번 나열하고 있었고, 그 아래로 판단 카드가
 * 밀려 있었다 — 같은 내용을 두 번 읽게 만들면서 결론을 뒤로 보내는 구조였다.
 *
 * ── 이 컬럼이 하는 일 ────────────────────────────────────────────────────
 * 셋뿐이다: ① 지금의 판매 판단 ② 등록 전에 걸리는 것 ③ 등록 버튼.
 * 전부 이미 계산된 값을 읽기만 한다 — 새 판정도, 새 등록 게이트도 만들지 않는다.
 *
 * ── 등록 버튼이 모달을 직접 열지 않는 이유 ───────────────────────────────
 * 실제 등록 진입점(openListingModal)은 "지금 열려 있는 채널 탭"의 listing과
 * effectiveListingStatus(카테고리 확정·검증 통과)를 보고 게이트한다. 여기서
 * 채널을 인자로 받아 그 게이트를 다시 계산하게 만들면, 게이트가 두 벌이 되어
 * 한쪽만 고쳐지는 순간 register API가 CP001로 거부하는 과거 버그가 그대로
 * 돌아온다. 그래서 이 버튼은 기존 진입점으로 **데려다 줄** 뿐이다 —
 * 채널 탭으로 전환하고 등록 카드로 스크롤한다. 등록 판정과 실행은 지금까지와
 * 똑같이 그 화면 하나가 책임진다.
 */
export function ActionCenter({
  verdict,
  verdictPending,
  checklist,
  channelOrder,
  channelLabelOf,
  isComingSoon,
  isPreviewOnly,
  readiness,
  onOpenVerdict,
  onGoToChannel,
}: {
  /** 서버가 낸 판매 판단 3단계. 아직 분석 중이거나 근거가 없으면 null. */
  verdict: { icon: string; title: string; tone: "GOOD" | "CAUTION" | "STOP" } | null;
  /** 분석이 아직 끝나지 않았는가. null verdict를 "나쁨"으로 읽지 않게 구분한다. */
  verdictPending: boolean;
  checklist: ChecklistItem[];
  channelOrder: readonly PlatformId[];
  channelLabelOf: (id: PlatformId) => string;
  isComingSoon: (id: PlatformId) => boolean;
  isPreviewOnly: (id: PlatformId) => boolean;
  readiness: Partial<
    Record<PlatformId, { state: RegistrationReadinessState; priorityItems: PriorityItem[]; provisional: boolean }>
  >;
  onOpenVerdict: () => void;
  onGoToChannel: (id: PlatformId) => void;
}) {
  const channels = buildRegistrationChannels({
    order: channelOrder,
    labelOf: channelLabelOf,
    isComingSoon,
    isPreviewOnly,
    readiness,
  });

  return (
    <aside className="space-y-3 lg:sticky lg:top-4">
      {/* ① 판매 판단 — 왼쪽 카드와 같은 값이다. 여기서는 결론 한 줄만 두고
          근거는 반복하지 않는다(누르면 왼쪽 판단 카드로 데려간다). */}
      <section className="rounded-lg border border-border bg-surface p-3 shadow-subtle">
        <p className="text-[11px] text-text-tertiary">판매 판단</p>
        <button type="button" onClick={onOpenVerdict} className="mt-0.5 text-left hover:underline">
          {verdict ? (
            <span className={`text-base font-bold ${VERDICT_TONE_CLASS[verdict.tone]}`}>
              {verdict.icon} {verdict.title}
            </span>
          ) : (
            <span className="text-sm font-semibold text-text-secondary">
              {verdictPending ? "⏳ 시장 분석 중" : "⚪ 판단 불가"}
            </span>
          )}
        </button>
        <p className="mt-0.5 text-[10px] text-text-tertiary">
          {verdict
            ? "🇰🇷 대한민국 시장 기준 · 근거 보기 →"
            : verdictPending
              ? "한국 시장 가격을 조회하고 있습니다"
              : "가격 근거가 아직 없어 판단을 세우지 못했습니다"}
        </p>
      </section>

      {/* ② 등록 전 확인 — 판단과 등록 사이에서 실제로 걸리는 것만. 새 판정이
          아니라 이미 계산된 상품정보 레벨/채널별 priorityItems를 옮긴다. */}
      <section className="rounded-lg border border-border bg-surface p-3 shadow-subtle">
        <p className="mb-1.5 text-[11px] text-text-tertiary">등록 전 확인</p>
        <ul className="space-y-1 text-[11px]">
          {checklist.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                onClick={item.onClick}
                className="flex w-full items-start gap-1.5 text-left hover:underline"
              >
                <span className={item.ok ? "text-success" : "text-warning"}>{item.ok ? "✓" : "⚠"}</span>
                <span className={item.ok ? "text-text-secondary" : "font-medium text-text-primary"}>
                  {item.label}
                  {item.detail && <span className="ml-1 text-[10px] text-text-tertiary">— {item.detail}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* ③ 커머스 등록 — 채널 목록은 PLATFORM_ORDER 하나에서만 나온다.
          채널이 늘어도 이 파일은 고치지 않는다. */}
      <section className="rounded-lg border border-border bg-surface p-3 shadow-subtle">
        <p className="mb-1.5 text-[11px] text-text-tertiary">커머스 등록</p>
        <div className="space-y-1.5">
          {channels.map((channel) => (
            <ChannelButton key={channel.id} channel={channel} onClick={() => onGoToChannel(channel.id)} />
          ))}
        </div>
        <p className="mt-2 text-[10px] text-text-tertiary">
          {/* 이 버튼이 바로 등록하는 것이 아니라는 사실을 숨기지 않는다 —
              "등록"이라고 쓰고 확인 화면으로 보내면 그 자체가 거짓말이 된다. */}
          채널 화면으로 이동합니다 — 최종 확인 후 등록됩니다.
        </p>
      </section>
    </aside>
  );
}

export interface ChecklistItem {
  key: string;
  label: string;
  detail?: string;
  ok: boolean;
  onClick: () => void;
}

const VERDICT_TONE_CLASS: Record<"GOOD" | "CAUTION" | "STOP", string> = {
  GOOD: "text-success",
  CAUTION: "text-warning",
  STOP: "text-error",
};

const LEVEL_DOT_CLASS: Record<ReadinessLevel, string> = {
  GREEN: "bg-success",
  YELLOW: "bg-warning",
  RED: "bg-error",
};

function ChannelButton({ channel, onClick }: { channel: RegistrationChannel; onClick: () => void }) {
  const soon = channel.availability === "COMING_SOON";
  const level = channel.state ? readinessStateToLevel(channel.state) : null;
  return (
    <button
      type="button"
      onClick={soon ? undefined : onClick}
      disabled={soon}
      title={soon ? "다음 스프린트에 제공될 예정입니다" : undefined}
      className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
        soon
          ? "cursor-not-allowed border border-border text-text-tertiary"
          : level === "GREEN"
            ? "bg-primary text-white hover:bg-primary-hover"
            : "border border-primary text-primary hover:bg-primary-soft"
      }`}
    >
      <span className="flex items-center gap-1.5">
        {level && !soon && <span className={`h-2 w-2 rounded-full ${LEVEL_DOT_CLASS[level]}`} aria-label={level} />}
        {channelActionLabel(channel)}
      </span>
      {/* 아직 확인이 필요한 항목 수는 버튼에서 바로 보여준다 — 눌러 들어가서야
          "뭐가 빠졌지"를 찾게 하지 않는다. 탭을 아직 안 연 채널은 사전 점검
          값이라 그렇다고 밝힌다(확정으로 읽게 하면 안 된다). */}
      {!soon && channel.blockingCount > 0 && (
        <span className="text-[10px] font-normal">
          확인 {channel.blockingCount}건{channel.provisional ? " (사전 점검)" : ""}
        </span>
      )}
      {!soon && channel.blockingCount === 0 && channel.state === "READY" && (
        <span className="text-[10px] font-normal">준비됨</span>
      )}
    </button>
  );
}
