"use client";

import type { PlatformId } from "@commerce/shared";
import { readinessStateToLevel, type ReadinessLevel } from "./readiness-state";
import { channelActionLabel, type RegistrationChannel } from "./registration-channels";
import type { PanelMode } from "./stage-focus";

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
 *
 * ── UX 2.2(CEO 지시, 2026-09-11) — 화면에 **하나만** 존재한다 ─────────────
 * 이 컬럼은 이제 탭 분기 밖(CommerceWorkspace 껍데기)에서 한 번만 렌더된다.
 * 어느 탭이든, 어느 단계든 오른쪽 기둥은 이것 하나다.
 *
 * 그리고 **본문이 이미 갖고 있는 블록은 여기서 한 줄로 접는다**(checklistMode /
 * channelsMode). ③ 등록 준비에서는 본문이 그 체크리스트를 작업면으로 펼치고,
 * ④/채널 화면에서는 본문이 등록 행동을 갖는다 — 같은 목록을 오른쪽에 한 번 더
 * 두면 CEO가 지적한 "우측 Action 카드가 여러 곳에서 반복된다"가 그대로다.
 * 접어도 결론과 진행 상황은 남는다(지우는 것이 아니다).
 *
 * ── MI-POLISH-2(CEO 지시, 2026-09-12) — 새 규칙 하나 ──────────────────────
 * **MI 판단 화면에서는 작업 진행상태를 반복해서 보여주지 않는다.** 진행은 상단
 * workflow bar 하나의 것이다. 판단이 본문의 주인공인 동안(stage-focus의
 * PanelMode="DEFERRED") 이 기둥에 남는 **누를 수 있는 것은 판매 판단 하나**이고,
 * 등록 전 확인과 커머스 등록은 각각 한 줄로 접힌다. 그 한 줄이 진척 숫자를
 * 갖지 않는 것이 SUMMARY와의 차이다 — 숫자를 적는 순간 그게 곧 반복이다.
 */
export function ActionCenter({
  verdict,
  verdictPending,
  checklist,
  checklistMode = "LIST",
  channels,
  channelsMode = "LIST",
  currentStageLabel,
  currentTodo,
  onOpenVerdict,
  onGoToChannel,
}: {
  /** 서버가 낸 판매 판단 3단계. 아직 분석 중이거나 근거가 없으면 null. */
  verdict: { icon: string; title: string; tone: "GOOD" | "CAUTION" | "STOP" } | null;
  /** 분석이 아직 끝나지 않았는가. null verdict를 "나쁨"으로 읽지 않게 구분한다. */
  verdictPending: boolean;
  checklist: ChecklistItem[];
  /** LIST = 목록 그대로. SUMMARY = 본문이 이 목록을 갖고 있으므로 한 줄로. */
  checklistMode?: PanelMode;
  /**
   * 채널 목록. UX 2.2에서 호출부(CommerceWorkspace)가 buildRegistrationChannels()로
   * **한 번만** 만들어 이 컬럼과 ④ 본문에 같은 배열을 넘긴다 — 예전처럼 여기서
   * 또 만들면 같은 채널 상태가 두 벌 계산되고, 한쪽만 바뀌는 순간 오른쪽과
   * 본문이 서로 다른 준비 상태를 말한다.
   */
  channels: RegistrationChannel[];
  /** LIST = 채널 버튼 그대로. SUMMARY = 본문/채널 화면이 이미 그 행동을 갖고 있다. */
  channelsMode?: PanelMode;
  /** 지금 단계 이름. 접힌 블록이 "왜 접혀 있는지"를 이 한 줄이 설명한다. */
  currentStageLabel?: string;
  /** 지금 해야 하는 한 가지. workflow.ts의 currentSubStep에서 그대로 온다. */
  currentTodo?: string | null;
  onOpenVerdict: () => void;
  onGoToChannel: (id: PlatformId) => void;
}) {
  /** 접힌 체크리스트가 보여주는 유일한 숫자. 목록과 같은 배열에서 센다. */
  const doneCount = checklist.filter((item) => item.ok).length;

  /**
   * P2-3(CEO 지시, 2026-09-12) — 아직 등록을 못 하는 채널과 지금 누를 수 있는
   * 채널을 가른다.
   *
   * 지금까지는 셋 다 같은 크기의 버튼이었다. 그래서 오른쪽 기둥에서 가장 큰
   * 덩어리가 **누를 수 없는 버튼**("11번가 준비중", disabled)이었고, 채널이
   * 늘 때마다 이 기둥이 그만큼 더 길어지는 구조였다.
   *
   * 목록에서 빼지는 않는다 — "없는 것"과 "아직인 것"은 셀러에게 다른 사실이고
   * (registration-channels.test.ts가 고정하는 계약), 숨기면 "따조는 11번가를
   * 지원 안 하나?"가 된다. 대신 행동이 없는 채널은 행동의 모양(버튼)을 갖지
   * 않고 한 줄 안에 이름으로만 남는다.
   */
  const actionableChannels = channels.filter((channel) => channel.availability !== "COMING_SOON");
  const soonChannels = channels.filter((channel) => channel.availability === "COMING_SOON");

  return (
    <aside className="space-y-2 lg:sticky lg:top-4">
      {/* ① 판매 판단 — 왼쪽 카드와 같은 값이다. 여기서는 결론 한 줄만 두고
          근거는 반복하지 않는다(누르면 왼쪽 판단 카드로 데려간다). */}
      <section className="rounded-lg border border-border bg-surface px-3 py-2.5 shadow-subtle">
        {/* P2-4 — 세 카드의 머리말은 globals.css의 Label 규약(text-[11px]
            font-medium tertiary)을 그대로 쓴다. leading-4를 붙이는 이유는
            읽기 문제가 아니라 길이 문제다: 이 기둥은 text-sm 컨테이너 밖이라
            11px 한 줄이 24px을 차지하고 있었다. */}
        <p className="text-[11px] font-medium leading-4 text-text-tertiary">판매 판단</p>
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
        {/* P2-4 — 10px은 실제 화면에서 읽히지 않는다. 판단의 기준을 말하는
            문장이라 지울 수 없고, 지울 수 없으면 읽히게 둬야 한다(text-xs). */}
        <p className="mt-0.5 text-xs text-text-secondary">
          {verdict
            ? "🇰🇷 대한민국 시장 기준 · 근거 보기 →"
            : verdictPending
              ? "한국 시장 가격을 조회하고 있습니다"
              : "가격 근거가 아직 없어 판단을 세우지 못했습니다"}
        </p>
      </section>

      {/* ② 등록 전 확인 — 판단과 등록 사이에서 실제로 걸리는 것만. 새 판정이
          아니라 이미 계산된 상품정보 레벨/채널별 priorityItems를 옮긴다. */}
      <section className="rounded-lg border border-border bg-surface px-3 py-2.5 shadow-subtle">
        <p className="mb-1 text-[11px] font-medium leading-4 text-text-tertiary">등록 전 확인</p>
        {checklistMode === "DEFERRED" ? (
          // MI-POLISH-2 — 판단 화면에서는 진척(N/M · 지금 할 일)을 적지 않는다.
          // 그 숫자는 상단 workflow bar가 이미 갖고 있고, 여기 한 번 더 적으면
          // 아직 팔지 말지도 정하지 않은 셀러가 등록 준비부터 읽게 된다.
          <p className="text-xs text-text-secondary">판매 판단이 끝나면 여기서 확인합니다.</p>
        ) : checklistMode === "SUMMARY" ? (
          // 본문이 같은 목록을 작업면으로 펼치고 있다 — 여기서는 진척만 남긴다.
          <>
            <p className="text-xs font-medium text-text-primary">
              {doneCount}/{checklist.length} 확인 완료
            </p>
            <p className="mt-0.5 text-xs text-text-secondary">
              {currentTodo
                ? `지금 할 일: ${currentTodo}`
                : `${currentStageLabel ?? "등록 준비"} 화면에서 하나씩 확인하고 있습니다`}
            </p>
          </>
        ) : (
          // P2-4 — 항목 이름은 누를 수 있는 행동이라 primary 크기(text-xs)로,
          // 그 옆 부연은 한 단계 아래로 둔다. 예전에는 둘 다 11px/10px이라
          // 기둥 전체가 "작은 회색 글씨 덩어리"로 보였다.
          <ul className="space-y-0.5 text-xs">
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
                    {item.detail && <span className="ml-1 text-[11px] text-text-tertiary">— {item.detail}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ③ 커머스 등록 — 채널 목록은 PLATFORM_ORDER 하나에서만 나온다.
          채널이 늘어도 이 파일은 고치지 않는다.

          P2-3(CEO 지시, 2026-09-12) — 등록 기능도, 채널별 행동도 그대로다.
          줄인 것은 **반복**뿐이다: ① 행동이 없는 채널(준비중)은 버튼 모양을
          갖지 않고 한 줄로 내려간다 ② "준비중"이라는 말이 채널 수만큼 반복되던
          것을 한 번만 적는다 ③ 버튼 자체의 위아래 여백을 줄인다.
          채널을 하나로 합치지 않는다 — 등록은 여전히 채널마다 따로 간다. */}
      <section className="rounded-lg border border-border bg-surface px-3 py-2.5 shadow-subtle">
        <p className="mb-1 text-[11px] font-medium leading-4 text-text-tertiary">커머스 등록</p>
        {channelsMode === "DEFERRED" ? (
          // 채널 이름은 남긴다 — 목록에서 빼면 "따조는 이 채널을 지원 안 하나?"가
          // 된다(registration-channels.ts의 판단 그대로). 접는 것은 버튼과 준비
          // 상태 점이다: 판단이 끝나지 않았는데 "준비됨/확인 3건"을 세어 봐야
          // 셀러가 지금 할 수 있는 일이 없다.
          <p className="text-xs text-text-secondary">
            {channels.map((channel) => channel.label).join(" · ")} — 판단 뒤에 등록합니다.
          </p>
        ) : channelsMode === "SUMMARY" ? (
          // 본문(④ 채널 카드) 또는 채널 화면 자체가 등록 행동을 갖고 있다.
          // 같은 버튼을 여기 한 번 더 두면 어느 쪽이 진짜인지 알 수 없어진다.
          // 상태는 남긴다 — 접는 것은 행동이지 사실이 아니다.
          <>
            <ul className="space-y-0.5 text-xs text-text-secondary">
              {actionableChannels.map((channel) => {
                const level = channel.state ? readinessStateToLevel(channel.state) : null;
                return (
                  <li key={channel.id} className="flex items-center gap-1.5">
                    {level ? (
                      <span className={`h-2 w-2 rounded-full ${LEVEL_DOT_CLASS[level]}`} aria-label={level} />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-border" aria-hidden />
                    )}
                    {channel.label}
                  </li>
                );
              })}
            </ul>
            <p className="mt-1 text-xs text-text-secondary">지금 보고 있는 화면에서 등록을 진행합니다.</p>
            <SoonChannelNote channels={soonChannels} />
          </>
        ) : (
          <>
            <div className="space-y-1">
              {actionableChannels.map((channel) => (
                <ChannelButton key={channel.id} channel={channel} onClick={() => onGoToChannel(channel.id)} />
              ))}
            </div>
            <p className="mt-1.5 text-xs text-text-secondary">
              {/* 이 버튼이 바로 등록하는 것이 아니라는 사실을 숨기지 않는다 —
                  "등록"이라고 쓰고 확인 화면으로 보내면 그 자체가 거짓말이 된다. */}
              채널 화면으로 이동합니다 — 최종 확인 후 등록됩니다.
            </p>
            <SoonChannelNote channels={soonChannels} />
          </>
        )}
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

/**
 * P2-3 — 아직 등록을 못 하는 채널 한 줄.
 *
 * 채널마다 disabled 버튼을 세우는 대신 이름만 모아 한 번 적는다. "준비중"이
 * 채널 수만큼 반복되던 것이 한 번으로 줄고, 누를 수 없는 것이 누를 수 있는
 * 것과 같은 크기를 차지하지 않는다. 목록에서 사라지지는 않는다(빼면 "지원을
 * 안 하는 것"으로 읽힌다 — registration-channels.ts의 판단 그대로).
 */
function SoonChannelNote({ channels }: { channels: RegistrationChannel[] }) {
  if (channels.length === 0) return null;
  return (
    <p className="mt-1 text-[11px] leading-4 text-text-tertiary">
      {channels.map((channel) => channel.label).join(" · ")} 준비중
    </p>
  );
}

/**
 * 지금 누를 수 있는 채널 하나. COMING_SOON은 여기 오지 않는다(SoonChannelNote가
 * 맡는다) — 그래서 이 버튼은 "비활성 모양"을 그릴 이유가 없어졌다.
 */
function ChannelButton({ channel, onClick }: { channel: RegistrationChannel; onClick: () => void }) {
  const level = channel.state ? readinessStateToLevel(channel.state) : null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        level === "GREEN"
          ? "bg-primary text-white hover:bg-primary-hover"
          : "border border-primary text-primary hover:bg-primary-soft"
      }`}
    >
      <span className="flex items-center gap-1.5">
        {level && <span className={`h-2 w-2 rounded-full ${LEVEL_DOT_CLASS[level]}`} aria-label={level} />}
        {channelActionLabel(channel)}
      </span>
      {/* 아직 확인이 필요한 항목 수는 버튼에서 바로 보여준다 — 눌러 들어가서야
          "뭐가 빠졌지"를 찾게 하지 않는다. 탭을 아직 안 연 채널은 사전 점검
          값이라 그렇다고 밝힌다(확정으로 읽게 하면 안 된다).
          P2-4 — 10px → 11px. 같은 버튼 안에서 "확인 3건"이 라벨보다 두 단계
          작으면 정작 읽어야 할 숫자가 안 읽힌다. */}
      {channel.blockingCount > 0 && (
        <span className="text-[11px] font-normal">
          확인 {channel.blockingCount}건{channel.provisional ? " (사전 점검)" : ""}
        </span>
      )}
      {channel.blockingCount === 0 && channel.state === "READY" && (
        <span className="text-[11px] font-normal">준비됨</span>
      )}
    </button>
  );
}
