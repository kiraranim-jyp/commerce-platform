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
  describePriorityItem,
  REGISTRATION_SECTION_LABEL,
  type RegistrationReadinessState,
  type PriorityItem,
} from "./readiness-state";
import { describePriorityItem, type RegistrationReadinessState, type PriorityItem } from "./readiness-state";
import type { ReadinessItem } from "./readiness";

const STATE_META: Record<
  RegistrationReadinessState,
  { icon: string; title: string; className: string }
> = {
  BLOCKED: { icon: "🔴", title: "현재 등록할 수 없습니다", className: "border-error bg-error-soft" },
  SELLER_REVIEW: { icon: "🟠", title: "판매 전 확인이 필요한 상품입니다", className: "border-warning bg-warning-soft" },
  NEEDS_REVIEW: { icon: "🟡", title: "등록 전 확인이 필요합니다", className: "border-warning bg-warning-soft" },
  READY: { icon: "🟢", title: "등록 준비 완료", className: "border-success bg-success-soft" },
};

/**
 * REWORK-4 §2(CEO 지시, 2026-09-14) — **지금 당장 해야 하는 1개를 먼저.**
 *
 * ── 없앤 것 ──────────────────────────────────────────────────────────────
 * 「부족한 정보 한 번에 해결하기」 버튼. 무엇을·어디를 고치는 것인지 문장에
 * 없었고, 눌러도 해결되지 않았다(모달이 같은 목록을 한 번 더 읽어줄 뿐이었다).
 *
 * ── 대신 서는 것 ─────────────────────────────────────────────────────────
 * 우선순위 첫 항목 하나가 네 가지를 다 달고 펼쳐진다:
 *   무엇이 부족한가 → 왜 필요한가 → 어디서 입력하는가 → [바로 이동]
 * 나머지는 "그 다음"으로 접어 둔다 — 첫 항목을 해결하면 다음이 올라온다.
 * 통과한 항목은 "그 외 확인 항목 N개"에 ✓로 남긴다(사라지지 않는다: 무엇이
 * 이미 끝났는지 보이지 않으면 셀러는 남은 하나가 전부인 줄 모른다).
 *
 * 🔴 판정은 여기서 하지 않는다. 순서는 buildPriorityItems가, 네 문장은
 * describePriorityItem이 이미 만든 값이다.
 */
export function RegistrationStatusBanner({
  state,
  priorityItems,
  onItemClick,
  checkedItems,
}: {
  state: RegistrationReadinessState;
  priorityItems: PriorityItem[];
  onItemClick?: (item: PriorityItem) => void;
  /** 이미 통과한 필수 항목들 — "그 외 확인 항목"에 ✓로 남는다. */
  checkedItems?: ReadinessItem[];
}) {
  const meta = STATE_META[state];
  const [first, ...rest] = priorityItems;
  const passed = (checkedItems ?? []).filter((i) => i.passed);

  return (
    <section className={`rounded-lg border p-4 text-sm ${meta.className}`}>
      <p className="flex items-center gap-1.5 text-base font-semibold text-text-primary">
        <span>{meta.icon}</span>
        {meta.title}
      </p>

      {state !== "READY" && first && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium text-text-tertiary">먼저 해결할 항목 1개</p>
          <FirstPriorityBlock item={first} onItemClick={onItemClick} />

          {rest.length > 0 && (
            <div className="rounded-md bg-background/50 px-2.5 py-2">
              <p className="text-[11px] font-medium text-text-tertiary">
                그 다음 {rest.length}개 — 위 항목을 해결하면 차례로 올라옵니다
              </p>
              <ul className="mt-1 space-y-0.5">
                {rest.map((item, index) => (
                  <li key={item.key} className="text-[11px] text-text-secondary">
                    {index + 2}. {item.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {state === "READY" && (
        <p className="mt-1 text-xs text-text-secondary">필수 정보가 모두 확인됐습니다 — 아래에서 바로 등록할 수 있습니다.</p>
      )}

      {passed.length > 0 && (
        <div className="mt-3 border-t border-border/60 pt-2">
          <p className="text-[11px] font-medium text-text-tertiary">그 외 확인 항목 {passed.length}개</p>
          <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">
            {passed.map((item) => `✓ ${item.label}`).join("  ")}
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * 지금 해야 하는 한 개. **네 가지가 전부 있어야 이 블록이 성립한다** —
 * 그중 [바로 이동]만은 갈 곳이 확실할 때만 그린다(없는 곳으로 보내는 버튼은
 * 이번에 없앤 추상 버튼과 같은 종류다).
 */
function FirstPriorityBlock({
  item,
  onItemClick,
}: {
  item: PriorityItem;
  onItemClick?: (item: PriorityItem) => void;
}) {
  const guide = describePriorityItem(item);
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2.5">
      <p className="flex items-start gap-1.5 text-sm font-semibold text-text-primary">
        <span className="shrink-0 text-text-tertiary">{item.retryable ? "⚠️" : "①"}</span>
        <span>{item.label}</span>
      </p>
      <p className="mt-1.5 text-xs text-text-secondary">{guide.what}</p>
      <p className="mt-0.5 text-[11px] text-text-tertiary">{guide.why}</p>
      <p className="mt-0.5 text-[11px] text-text-tertiary">{guide.where}</p>
      {guide.action?.kind === "SECTION" && onItemClick && (
        <button
          type="button"
          onClick={() => onItemClick(item)}
          className="mt-2 rounded-md border border-primary px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
        >
          {guide.action.label}
        </button>
      )}
      {guide.action?.kind === "EXTERNAL" && (
        <a
          href={guide.action.href}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block rounded-md border border-primary px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
        >
          {guide.action.label}
        </a>
      )}
    </div>
  );
}
