"use client";

/**
 * N-3.55(CPO 지시: "67~71%라는 점수와 오른쪽의 수십 개 MISSING 항목이 셀러에게
 * 무엇을 먼저 해야 하는지 알려주지 못한다") — 이 파일은 판정 로직을 새로
 * 만들지 않는다. readiness.ts가 이미 계산해둔 ReadinessSummary(percent/
 * required/group/sourceStatus)와 N-3.52의 KcStatus, N-3.54의 priceValidity를
 * 그대로 읽어서 "지금 뭘 하면 되는지" 우선순위 4단계로 재구성만 한다 — 판정
 * 기준이 두 곳에 생기면 CP001류(카드는 100%인데 실제 등록은 실패) 버그가
 * 재발한다는 게 이 코드베이스에서 이미 여러 번 확인된 교훈이다.
 *
 * N-3.56(버그 수정) — 판정 로직(resolveRegistrationReadinessState/
 * buildPriorityItems) 자체는 "use client"가 없는 ./readiness-state.ts로
 * 옮겼다. 대시보드 서버 라우트가 같은 로직을 호출하려다 "client 함수를
 * 서버에서 호출할 수 없다"는 Next.js 런타임 에러를 실제로 만났다 —
 * 이 파일은 UI 컴포넌트만 갖고, 로직은 re-export해서 기존 import 경로
 * (PlatformPreview.tsx 등)를 그대로 유지한다.
 */
export {
  resolveRegistrationReadinessState,
  buildPriorityItems,
  type RegistrationReadinessState,
  type PriorityItem,
} from "./readiness-state";
import type { RegistrationReadinessState, PriorityItem } from "./readiness-state";

const STATE_META: Record<
  RegistrationReadinessState,
  { icon: string; title: string; className: string }
> = {
  BLOCKED: { icon: "🔴", title: "현재 등록할 수 없습니다", className: "border-error bg-error-soft" },
  SELLER_REVIEW: { icon: "🟠", title: "판매 전 확인이 필요한 상품입니다", className: "border-warning bg-warning-soft" },
  NEEDS_REVIEW: { icon: "🟡", title: "등록 전 확인이 필요합니다", className: "border-warning bg-warning-soft" },
  READY: { icon: "🟢", title: "등록 준비 완료", className: "border-success bg-success-soft" },
};

export function RegistrationStatusBanner({
  state,
  priorityItems,
  onItemClick,
  onOpenGuide,
}: {
  state: RegistrationReadinessState;
  priorityItems: PriorityItem[];
  onItemClick?: (item: PriorityItem) => void;
  onOpenGuide?: () => void;
}) {
  const meta = STATE_META[state];
  return (
    <section className={`rounded-lg border p-4 text-sm ${meta.className}`}>
      <p className="flex items-center gap-1.5 text-base font-semibold text-text-primary">
        <span>{meta.icon}</span>
        {meta.title}
      </p>

      {state !== "READY" && priorityItems.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs font-medium text-text-tertiary">먼저 해결할 항목 {priorityItems.length}개</p>
          <ol className="space-y-1">
            {priorityItems.map((item, index) => {
              const clickable = Boolean(item.sectionId && onItemClick);
              return (
                <li key={item.key} className="text-sm">
                  {clickable ? (
                    <button
                      type="button"
                      onClick={() => onItemClick!(item)}
                      className="flex w-full items-start gap-1.5 rounded px-1 py-0.5 text-left hover:bg-background/60"
                    >
                      <span className="shrink-0 font-medium text-text-tertiary">{index + 1}.</span>
                      <span>
                        <span className="font-medium text-text-primary underline decoration-dotted">{item.label}</span>
                        {item.detail && <span className="block text-[11px] text-text-tertiary">{item.detail}</span>}
                      </span>
                    </button>
                  ) : item.externalHref ? (
                    <a
                      href={item.externalHref}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start gap-1.5 rounded px-1 py-0.5 hover:bg-background/60"
                    >
                      <span className="shrink-0 font-medium text-text-tertiary">{index + 1}.</span>
                      <span>
                        <span className="font-medium text-text-primary underline decoration-dotted">{item.label}</span>
                        {item.detail && <span className="block text-[11px] text-text-tertiary">{item.detail}</span>}
                      </span>
                    </a>
                  ) : (
                    <span className="flex items-start gap-1.5 px-1 py-0.5">
                      <span className="shrink-0 font-medium text-text-tertiary">{item.retryable ? "⚠️" : `${index + 1}.`}</span>
                      <span>
                        <span className="font-medium text-text-primary">{item.label}</span>
                        {item.detail && <span className="block text-[11px] text-text-tertiary">{item.detail}</span>}
                      </span>
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
          {onOpenGuide && (
            <button
              type="button"
              onClick={onOpenGuide}
              className="mt-2 w-full rounded-md border border-primary bg-surface px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
            >
              부족한 정보 한 번에 해결하기
            </button>
          )}
        </div>
      )}

      {state === "READY" && (
        <p className="mt-1 text-xs text-text-secondary">필수 정보가 모두 확인됐습니다 — 아래에서 바로 등록할 수 있습니다.</p>
      )}
    </section>
  );
}
