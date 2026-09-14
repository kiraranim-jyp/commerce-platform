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

/**
 * REWORK-7 ①(CEO 지시, 2026-09-15) — 판정 한 줄. 세 채널이 같은 네 문구만
 * 쓴다. 상태 자체(4단계)는 resolveRegistrationReadinessState가 정하던 그대로다 —
 * 여기서 바뀐 것은 **문구뿐**이다.
 */
const STATE_META: Record<
  RegistrationReadinessState,
  { icon: string; title: string; className: string }
> = {
  BLOCKED: { icon: "🔴", title: "등록 불가", className: "bg-error-soft" },
  SELLER_REVIEW: { icon: "🟠", title: "판매 전 확인 필요", className: "bg-warning-soft" },
  NEEDS_REVIEW: { icon: "🟡", title: "등록 전 확인 필요", className: "bg-warning-soft" },
  READY: { icon: "🟢", title: "등록 가능", className: "bg-success-soft" },
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
  /**
   * 필수 항목 전체. **개수를 세는 데에만 쓴다** — 이름을 나열하지 않는다.
   *
   * REWORK-7 ① — 여기 있던 "그 외 확인 항목 6개 ✓ 상품명 ✓ 브랜드 ✓ 대표이미지
   * ✓ 이미지 형식 ✓ 판매가격 ✓ 상세설명"이 사라졌다. 바로 아래 카드가 같은
   * 목록을 한 번 더 그리고 있었고(BEFORE 덤프로 확인), 둘 다 좌측 상세가 이미
   * 섹션마다 보여주는 필드였다. 무엇이 끝났는지는 아래 「필수 확인」이 자리
   * 단위로 말한다.
   */
  checkedItems?: ReadinessItem[];
}) {
  const meta = STATE_META[state];
  const [first] = priorityItems;
  const remaining = (checkedItems ?? []).filter((i) => !i.passed).length;

  return (
    <>
      {/* ① 등록 준비 상태 — 판정 한 줄. */}
      <section className={`px-4 py-3 text-sm ${meta.className}`}>
        <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">등록 준비 상태</p>
        <p className="mt-1 flex items-center gap-1.5 text-base font-semibold text-text-primary">
          <span aria-hidden>{meta.icon}</span>
          {meta.title}
        </p>
      </section>

      {/* ③ 남은 항목 — 지금 등록을 막는 것 하나. 전부 통과했으면 이 블록 자체가
          서지 않는다(빈 목록을 "0개"라고 적어 두면 읽을 것이 하나 더 는다). */}
      {state !== "READY" && first && (
        <section className="border-t border-border px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
            남은 항목 {Math.max(remaining, 1)}개
          </p>
          <div className="mt-1.5">
            <FirstPriorityBlock item={first} onItemClick={onItemClick} />
          </div>
        </section>
      )}
    </>
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
        {item.retryable && <span className="shrink-0 text-text-tertiary">⚠️</span>}
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
