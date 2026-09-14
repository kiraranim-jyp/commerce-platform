"use client";

import type { ReactNode } from "react";
import type { ListingStatus } from "@commerce/listing";
import { RegistrationReadinessCard } from "./RegistrationReadinessCard";
import { RegistrationStatusBanner } from "./RegistrationStatusBanner";
import type { ReadinessItem } from "./readiness";
import type { PriorityItem, RegistrationReadinessState } from "./readiness-state";

/**
 * REWORK-2 커머스 탭 UX 최종 정렬(CEO 지시, 2026-09-14) — **세 채널이 공유하는
 * 등록 화면의 골격.**
 *
 * ── 왜 만들었나 ──────────────────────────────────────────────────────────
 * 직전 작업은 "기존 우측 기둥(ActionCenter)을 재사용한다"로 끝냈다. 그런데
 * 렌더 덤프로 재보니 화면은 하나도 안 바뀌어 있었다(BEFORE 덤프):
 *
 *   · 세 탭 모두 등록 상태·등록 가능성·섹션·버튼이 **한 줄로 쌓인 세로 문서**
 *   · 그 오른쪽에 선 기둥은 채널 등록 요약이 아니라 **상품 수준 Action 카드**
 *     ("등록 전 확인 / 커머스 등록" — 상품정보 탭에서 보던 그것)
 *
 * 즉 "컴포넌트가 이미 있다"는 사실은 화면이 바뀌었다는 근거가 못 됐다. 그래서
 * 이번에는 **정보 구조 자체**를 옮긴다: 등록 판정·부족정보·등록 행동은 전부
 * 오른쪽 요약으로 가고, 왼쪽에는 입력·확인할 상세만 남는다.
 *
 * ── 그럼에도 새 판정은 하나도 만들지 않는다 ───────────────────────────────
 * 오른쪽 요약이 그리는 것은 전부 기존 컴포넌트다 —
 *   · 등록 상태 · 부족정보 · [부족정보 해결] → RegistrationStatusBanner
 *   · 등록 가능성 · 필수항목 · [채널 등록]  → RegistrationReadinessCard
 * 새로 생긴 것은 **두 카드를 세 채널이 같은 순서로 쓰게 하는 자리**뿐이고,
 * percent/state/priorityItems는 각 채널이 **이미 계산해 두었던 값**을 그대로
 * 넘겨받는다. 판정이 여기서 한 벌 더 생기면 CP001류(카드는 100%인데 등록은
 * 실패) 버그가 그대로 돌아온다.
 *
 * ── 🔴 여기에 오지 않는 것 ───────────────────────────────────────────────
 * 판매 판단 · 예상 마진 · 국내 경쟁력 · 시장 수요 · MI Radar · MI 근거.
 * 커머스 탭이 묻는 질문은 하나다 — **"이 상품을 이 채널에 지금 등록할 수
 * 있는가?"** "팔 만한가"는 상품정보 탭 하나의 질문이다(7cb31c5).
 */
export function ChannelRegistrationFrame({ detail, summary }: { detail: ReactNode; summary: ReactNode }) {
  return (
    /* data-frame은 테스트가 좌/우를 **렌더 결과에서** 가르기 위한 표식이다.
       클래스 이름으로 찾으면 Tailwind 유틸리티를 하나 바꾸는 순간 "좌우가
       갈렸는지"를 확인하던 검사가 조용히 무력해진다. */
    <div data-frame="channel-registration" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      {/* 좌측 · 등록 상세 — 카테고리 / 상품정보 / 옵션·가격·배송 / 고시·인증·
          상세설명 / 채널 고유정보. lg 미만에서는 요약이 먼저 온다(결론과 행동이
          스크롤 아래에 묻히지 않도록 — 기존 워크스페이스 기둥과 같은 규칙). */}
      <div className="order-2 min-w-0 space-y-4 lg:order-1">{detail}</div>
      {/* 우측 · 등록 요약 */}
      <div className="order-1 lg:order-2">{summary}</div>
    </div>
  );
}

/**
 * 우측 · 등록 요약. 세 채널이 **같은 컴포넌트**를 쓴다 — 그래야 "SmartStore와
 * 같은 등록 화면"이 코드에서 참이 된다.
 */
export function ChannelRegistrationSummary({
  state,
  priorityItems,
  onPriorityItemClick,
  onResolveMissing,
  statusRows,
  percent,
  required,
  recommended,
  allRequiredPassed,
  isCalculating,
  errorMessage,
  onRetry,
  platformLabel,
  status,
  registrationEnabled,
  registrationReadinessState,
  onRegister,
  onItemClick,
  settingsMissing,
  autoFillStats,
  percentUnavailable,
  verifyAction,
}: {
  state: RegistrationReadinessState;
  priorityItems: PriorityItem[];
  onPriorityItemClick?: (item: PriorityItem) => void;
  onResolveMissing?: () => void;
  /** 채널 연결 상태·직전 등록 결과처럼 그 채널에만 있는 사실. 판정이 아니다. */
  statusRows?: ReactNode;
  percent: number;
  required: ReadinessItem[];
  recommended: ReadinessItem[];
  allRequiredPassed: boolean;
  isCalculating?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  platformLabel: string;
  status: ListingStatus;
  registrationEnabled?: boolean;
  registrationReadinessState?: RegistrationReadinessState;
  onRegister: () => void;
  onItemClick?: (sectionId: string) => void;
  settingsMissing?: string[];
  autoFillStats?: { total: number; autoFilled: number; userInput: number };
  percentUnavailable?: ReactNode;
  verifyAction?: ReactNode;
}) {
  return (
    <div className="space-y-3 lg:sticky lg:top-4">
      {/* ① 등록 상태 + 부족정보 + [부족정보 해결] */}
      <RegistrationStatusBanner
        state={state}
        priorityItems={priorityItems}
        onItemClick={onPriorityItemClick}
        onOpenGuide={onResolveMissing}
      />
      {statusRows}
      {/* ② 등록 가능성 + 필수항목 + [등록 정보 확인] + [채널 등록] */}
      <RegistrationReadinessCard
        isCalculating={isCalculating}
        errorMessage={errorMessage}
        onRetry={onRetry}
        percent={percent}
        required={required}
        recommended={recommended}
        allRequiredPassed={allRequiredPassed}
        platformLabel={platformLabel}
        status={status}
        registrationEnabled={registrationEnabled}
        registrationReadinessState={registrationReadinessState}
        onRegister={onRegister}
        onItemClick={onItemClick}
        settingsMissing={settingsMissing}
        autoFillStats={autoFillStats}
        percentUnavailable={percentUnavailable}
        verifyAction={verifyAction}
      />
    </div>
  );
}
