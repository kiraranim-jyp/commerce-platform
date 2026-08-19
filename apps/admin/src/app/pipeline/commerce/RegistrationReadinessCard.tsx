"use client";

import type { ListingStatus } from "@commerce/listing";
import type { ReadinessItem } from "./readiness";
import type { RegistrationReadinessState } from "./readiness-state";

const BUTTON_LABEL: Record<ListingStatus, string> = {
  DRAFT: "필수 항목을 채워주세요",
  READY: "등록하기",
  USER_CONFIRMED: "등록 대기 중...",
  SUBMITTING: "등록 중...",
  SUBMITTED: "등록 완료 ✓",
  FAILED: "등록 실패 — 아래에서 다시 시도",
  // N-3.50 STEP7 — Wing 확인 없이 바로 재시도 버튼을 누르면 중복 등록 위험이
  // 있어 문구로 먼저 막는다.
  UNKNOWN: "등록 결과 확인 필요 — Wing에서 먼저 확인해주세요",
};

/** N-3.57 STEP6(CPO 지시: "등록 버튼 상태를 의미 있게 변경 — 왜 버튼을 못
 * 누르는지 바로 이해") — status(ListingStatus, 등록 API 호출 자체의 진행
 * 상태: DRAFT/READY/SUBMITTING/...)와 registrationReadinessState(N-3.55/56이
 * 이미 계산해둔 등록 "가능성" 4단계: BLOCKED/NEEDS_REVIEW/SELLER_REVIEW/READY)는
 * 서로 다른 축이다. status가 아직 클릭 전(DRAFT/READY)일 때만
 * registrationReadinessState로 문구를 세분화하고, 이미 클릭했거나(USER_CONFIRMED)
 * API 응답을 기다리는/받은 상태는 기존 BUTTON_LABEL을 그대로 쓴다(그 흐름은
 * 이번 스텝 범위가 아니다 — STEP7이 그 결과 화면을 다룬다). */
const READINESS_BUTTON_LABEL: Record<RegistrationReadinessState, string> = {
  BLOCKED: "🔴 등록 불가",
  NEEDS_REVIEW: "⚠ 부족한 정보 해결하기",
  SELLER_REVIEW: "🟠 판매 가능 여부 확인하기",
  READY: "판매 전 최종 확인",
};

/**
 * P0-UI Epic 2(등록 준비 카드) → Sprint A-3(Registration Editor) — 우측에
 * 고정(sticky)돼서 스크롤해도 항상 보이는 단일 등록 진입점.
 *
 * Sprint A-3 CPO 요구사항: "가능/불가능이 아니라 95%처럼, 그리고 왜 95%인지 —
 * 무엇이 부족한지 — 어떻게 채워지는지까지 보여야 한다." 필수/선택을 분리하고,
 * 통과 못 한 항목엔 hint(readiness.ts가 채워준 이유/CTA 문구)를 보여주고, 항목을
 * 클릭하면 해당 accordion 섹션으로 스크롤+펼침(onItemClick)한다.
 *
 * percent/items 계산은 여기서 하지 않는다 — computeChecklistReadiness /
 * computeReadinessScoreSummary(readiness.ts) 결과를 그대로 받아 표시만 한다. 판정
 * 로직이 여러 곳에 있으면 CP001 버그(카드는 100%인데 실제 등록은 실패)가 재발한다.
 */
export function RegistrationReadinessCard({
  percent,
  required,
  recommended,
  allRequiredPassed,
  platformLabel,
  status,
  onRegister,
  onItemClick,
  settingsMissing,
  autoFillStats,
  registrationEnabled = true,
  registrationReadinessState,
}: {
  percent: number;
  required: ReadinessItem[];
  recommended: ReadinessItem[];
  allRequiredPassed: boolean;
  platformLabel: string;
  status: ListingStatus;
  onRegister: () => void;
  /** Sprint A-3(Auto Scroll) — 항목에 sectionId가 있을 때만 클릭 가능하게 렌더한다. */
  onItemClick?: (sectionId: string) => void;
  settingsMissing?: string[];
  /** Sprint N-2.7 — false면(smartstore) 등록 버튼을 항상 비활성화하고 "Preview 전용"
   * 문구로 대체한다. capabilities.registrationEnabled를 그대로 받는다(판정 로직을
   * 여기서 다시 만들지 않는다). 안 주면(기존 호출부 하위 호환) true로 취급한다. */
  registrationEnabled?: boolean;
  /** Sprint A-6(작업3 — Auto Fill KPI) — CPO 요구사항: "대표님이 가장 궁금한
   * 숫자." Compliance Report의 autoResolvedCount/userRequiredCount를 그대로
   * 옮겨온 값이라 이 카드가 다시 계산하지 않는다(판정 로직 중복 방지 원칙). */
  autoFillStats?: { total: number; autoFilled: number; userInput: number };
  /** N-3.57 STEP6 — 없으면(Coupang/11번가처럼 이 4-state 모델을 아직 안 쓰는
   * 플랫폼) 기존 BUTTON_LABEL[status] 문구를 그대로 쓴다(회귀 없음). */
  registrationReadinessState?: RegistrationReadinessState;
}) {
  const scoreClassName = percent >= 90 ? "text-success" : percent >= 60 ? "text-warning" : "text-error";
  const barClassName = percent >= 90 ? "bg-success" : percent >= 60 ? "bg-warning" : "bg-error";
  const canRegister = registrationEnabled && allRequiredPassed && status === "READY";
  const isTerminal = status === "SUBMITTED" || status === "FAILED";
  // A-12.3-P0(CPO 지시: "선택 → 미입력 → 감점 없음") — recommended는 required:false라
  // percent 계산(readiness.ts summarize)에서는 이미 빠져 있었지만, 이 카운터는
  // recommended까지 섞어서 "남은 작업 N개"로 보여줘 선택 항목도 감점처럼 느껴지는
  // UX 버그가 있었다. 필수 미완료만 남은 작업으로 센다 — recommended는 여전히
  // "선택 입력" 목록에는 그대로 보여준다(있으면 좋다는 안내는 유지, 압박감만 제거).
  const remaining = required.filter((i) => !i.passed).length;
  // Sprint P0(CPO 지시, 2026-08-19: "97% + 선택값 부족 → 등록 가능, 문구로
  // 명확히") — 필수 항목을 다 채웠는데도 선택 항목(치수 등)이 비어 있으면
  // "등록은 되지만 이런 선택 정보가 비어 있다"는 걸 한 줄로 알려준다.
  // DEFAULT_VALUE는 이미 값이 채워진(passed:true) 상태라 여기서 제외한다.
  const emptyOptionalCount = recommended.filter((i) => !i.passed).length;
  // A-10.1-②(CEO 지시: "남은 항목 N개 → 다음 입력하기 → 를 누르면 자동으로
  // 해당 Accordion이 열리고 포커스") — 필수 항목을 먼저, 그다음 선택 항목
  // 순서로 훑어서 아직 안 채워졌고 이동할 섹션이 있는 첫 항목을 다음 목표로
  // 삼는다(법적 필수가 가장 급하다는 기존 우선순위와 같은 방향).
  // A-12.3 — settingsMissing/settingsRecommended 항목은 sectionId 대신
  // externalHref(/settings)만 갖고 있어서, 이 페이지 안 스크롤 대상만 찾던
  // 기존 조건으로는 절대 다음 목표로 뽑히지 않았다(그 항목들은 영원히 "다음
  // 입력하기"에 안 걸림). 둘 중 하나라도 있으면 이동 가능한 항목으로 본다.
  const nextIncomplete = [...required, ...recommended].find((i) => !i.passed && (i.sectionId || i.externalHref));

  // Sprint A-6(개선4) — CPO 요구사항: "사용자는 왜 이것을 내가 입력해야 하지를
  // 바로 이해할 수 있어야 한다." 필수 목록을 하나로 뭉치지 않고 성격별로
  // 나눈다 — 법적 필수(KC 등, CartPilot이 절대 대신 못 채움)/비즈니스
  // 설정(배송지 등, Settings에서 한 번만 하면 됨)/상품 정보(Resolver가 아직
  // 못 찾은 값). 순서도 이 우선순위대로 — 법적 필수가 가장 급하다.
  const legalItems = required.filter((i) => i.group === "LEGAL");
  const businessItems = required.filter((i) => i.group === "BUSINESS_SETTINGS");
  const productInfoItems = required.filter((i) => i.group !== "LEGAL" && i.group !== "BUSINESS_SETTINGS");

  return (
    <aside className="space-y-4 rounded-lg border border-border bg-surface p-4 text-sm shadow-elevated lg:sticky lg:top-4 lg:self-start">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">등록 가능성</p>
        <p className={`mt-1 text-3xl font-semibold tabular-nums ${scoreClassName}`}>{percent}%</p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded bg-background">
          <div
            className={`h-full rounded transition-all duration-300 ${barClassName}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        {allRequiredPassed && emptyOptionalCount > 0 && (
          <p className="mt-1.5 text-[11px] text-text-tertiary">
            선택 정보 {emptyOptionalCount}건이 비어 있습니다 — 없어도 등록할 수 있습니다.
          </p>
        )}
        {/* Sprint A-6(개선3) — "대표님이 가장 궁금한 숫자"를 한눈에 — 자동입력/
            사용자입력 둘 다 %와 (N/M)을 같이 보여준다. */}
        {autoFillStats && autoFillStats.total > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-md bg-background p-2 text-center">
            <div>
              <p className="text-[10px] text-text-tertiary">자동 입력</p>
              <p className="text-lg font-semibold tabular-nums text-success">
                {Math.round((autoFillStats.autoFilled / autoFillStats.total) * 100)}%
              </p>
              <p className="text-[10px] text-text-tertiary">
                ({autoFillStats.autoFilled}/{autoFillStats.total})
              </p>
            </div>
            <div>
              <p className="text-[10px] text-text-tertiary">사용자 입력</p>
              <p className="text-lg font-semibold tabular-nums text-warning">
                {Math.round((autoFillStats.userInput / autoFillStats.total) * 100)}%
              </p>
              <p className="text-[10px] text-text-tertiary">
                ({autoFillStats.userInput}/{autoFillStats.total})
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {legalItems.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-text-tertiary">법적 필수 — TTAEJYO가 대신 채울 수 없음</p>
            <ItemList items={legalItems} onItemClick={onItemClick} />
          </div>
        )}
        {businessItems.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-text-tertiary">비즈니스 설정 — Settings에서 한 번만 하면 됨</p>
            <ItemList items={businessItems} onItemClick={onItemClick} />
          </div>
        )}
        {productInfoItems.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-text-tertiary">상품 정보</p>
            <ItemList items={productInfoItems} onItemClick={onItemClick} />
          </div>
        )}
      </div>

      {recommended.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-text-tertiary">선택 입력</p>
          <ItemList items={recommended} onItemClick={onItemClick} />
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border pt-2 text-xs text-text-secondary">
        <span>
          남은 작업 <span className="font-medium text-text-primary">{remaining}개</span>
        </span>
        {nextIncomplete && !isTerminal && nextIncomplete.sectionId && onItemClick && (
          <button
            type="button"
            onClick={() => onItemClick(nextIncomplete.sectionId!)}
            className="font-medium text-primary hover:underline"
          >
            다음 입력하기 →
          </button>
        )}
        {nextIncomplete && !isTerminal && !nextIncomplete.sectionId && nextIncomplete.externalHref && (
          <a
            href={nextIncomplete.externalHref}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary hover:underline"
          >
            다음 입력하기 →
          </a>
        )}
      </div>

      {settingsMissing && settingsMissing.length > 0 && !isTerminal && (
        <a
          href="/settings"
          className="block rounded-md border border-border px-3 py-1.5 text-center text-xs font-medium text-text-secondary transition-colors hover:bg-background"
        >
          설정하러 가기
        </a>
      )}

      <button
        type="button"
        onClick={onRegister}
        disabled={!canRegister}
        className={`w-full rounded-md px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
          status === "SUBMITTED"
            ? "bg-success-soft text-success"
            : status === "FAILED"
              ? "bg-error-soft text-error"
              : "bg-primary text-white hover:bg-primary-hover disabled:opacity-40"
        }`}
      >
        {!registrationEnabled
          ? "미리보기 전용 — 등록 기능은 준비 중입니다"
          : (status === "DRAFT" || status === "READY") && registrationReadinessState
            ? READINESS_BUTTON_LABEL[registrationReadinessState]
            : status === "READY"
              ? `${platformLabel}에 등록`
              : BUTTON_LABEL[status]}
      </button>
    </aside>
  );
}

/** A-12.3(CPO 지시: "자동입력됨/기본설정 사용/직접입력 필요 상태 표시") —
 * sourceStatus 하나당 배지 라벨/색을 한 곳에서만 정의한다(판정 로직처럼
 * 문구가 여러 곳에 흩어지면 나중에 말이 안 맞는 CP001류 문제가 재발한다). */
const SOURCE_STATUS_BADGE: Record<
  NonNullable<ReadinessItem["sourceStatus"]>,
  { label: string; className: string }
> = {
  AUTO: { label: "자동입력됨", className: "bg-success-soft text-success" },
  SETTINGS_DEFAULT: { label: "기본설정 사용", className: "bg-background text-text-tertiary" },
  MANUAL_REQUIRED: { label: "직접입력 필요", className: "bg-warning-soft text-warning" },
  // A-12.3-P0-3(CPO 2차 지시 — "⚠ KC 인증 → 기본값 적용") — 등록은 막지
  // 않지만(passed:true) "CartPilot이 관용적 기본값을 대신 채웠다"는 사실은
  // ✓ 로 조용히 넘기지 않고 별도로 드러낸다.
  DEFAULT_VALUE: { label: "기본값 적용", className: "bg-warning-soft text-warning" },
};

function ItemList({
  items,
  onItemClick,
}: {
  items: ReadinessItem[];
  onItemClick?: (sectionId: string) => void;
}) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, index) => {
        // A-12.3 — sectionId(이 페이지 안 스크롤)와 externalHref(/settings로
        // 이동)는 배타적이다. 둘 중 하나만 있어도 "부족항목 클릭 → 이동"이
        // 성립하도록 클릭 가능 여부를 두 경로 다 확인한다.
        const clickableSection = !item.passed && item.sectionId && onItemClick;
        const clickableExternal = !item.passed && item.externalHref && !item.sectionId;
        // A-12.3-P0-3 — DEFAULT_VALUE는 passed:true라 기존 조건(!item.passed)으로는
        // 배지가 안 보였다. 등록을 막지 않는다는 것과 "CartPilot이 대신 채운
        // 값이라는 걸 알아야 한다"는 것은 별개라 이 소스만 예외로 항상 보여준다.
        const isDefaultApplied = item.sourceStatus === "DEFAULT_VALUE";
        const statusBadge =
          (!item.passed || isDefaultApplied) && item.sourceStatus ? SOURCE_STATUS_BADGE[item.sourceStatus] : null;
        const content = (
          <>
            <span
              className={`shrink-0 ${isDefaultApplied ? "text-warning" : item.passed ? "text-success" : item.required ? "text-error" : "text-warning"}`}
            >
              {isDefaultApplied ? "⚠" : item.passed ? "✓" : item.required ? "✗" : "△"}
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="flex flex-wrap items-center gap-1">
                <span className={item.passed ? "text-text-primary" : "font-medium text-text-primary"}>
                  {item.label}
                </span>
                {statusBadge && (
                  <span className={`rounded px-1 py-0.5 text-[10px] font-medium ${statusBadge.className}`}>
                    {statusBadge.label}
                  </span>
                )}
              </span>
              {/* Sprint A-6(개선1) — CPO 지시: "AI가 추측하거나 기본값을 넣으면
                  안 된다. 대신 자동입력 불가/사유/사용자 확인 필요를 명확하게
                  표시하라." 문장 하나로 뭉치지 않고 구조화된 배지로 보여준다. */}
              {!item.passed && item.reasonCode === "CRITICAL" && (
                <span className="mt-0.5 flex flex-wrap items-center gap-1">
                  <span className="rounded bg-error-soft px-1 py-0.5 text-[10px] font-medium text-error">
                    자동입력 불가
                  </span>
                  <span className="rounded bg-background px-1 py-0.5 text-[10px] text-text-tertiary">
                    사유: 법적 필수정보
                  </span>
                  <span className="rounded bg-background px-1 py-0.5 text-[10px] text-text-tertiary">
                    사용자 확인 필요
                  </span>
                </span>
              )}
              {(isDefaultApplied || (!item.passed && item.reasonCode !== "CRITICAL")) && item.hint && (
                <span className="block text-[11px] text-text-tertiary">{item.hint}</span>
              )}
            </span>
          </>
        );
        const itemClassName = "flex w-full items-start gap-2 rounded px-1 py-0.5 text-left hover:bg-background";
        return (
          <li key={`${item.label}-${index}`} className="text-xs">
            {clickableSection ? (
              <button type="button" onClick={() => onItemClick!(item.sectionId!)} className={itemClassName}>
                {content}
              </button>
            ) : clickableExternal ? (
              <a href={item.externalHref} target="_blank" rel="noreferrer" className={itemClassName}>
                {content}
              </a>
            ) : (
              <div className="flex items-start gap-2 px-1 py-0.5">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
