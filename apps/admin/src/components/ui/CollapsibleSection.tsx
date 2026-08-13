"use client";

import { useState } from "react";

/**
 * P0-UI Epic 4(Accordion 구조) — 개별 useState(boolean) + "펼치기 ▼/접기 ▲" 토글
 * 패턴을 하나로 통일한 컴포넌트. N-3.13 Part A-2에서 pipeline/commerce 전용
 * 위치(app/pipeline/commerce/CollapsibleSection.tsx)에서 components/ui로 승격했다
 * — Settings 페이지도 동일한 아코디언 패턴을 써야 하는데, 페이지 전용 폴더 밑
 * 컴포넌트를 다른 라우트에서 import하는 건 "페이지는 UI를 소유하지 않는다"
 * 원칙에 어긋나기 때문이다.
 */
export function CollapsibleSection({
  title,
  defaultOpen = false,
  badge,
  summary,
  children,
  id,
  open: openProp,
  onToggle,
  alwaysRenderChildren = false,
}: {
  title: string;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  /** N-3.16 잔여3(CPO 지시: "섹션 제목 → 상태 → 요약 → 펼침" 공통 골격) —
   * 접혀 있을 때도 보이는 한 줄 요약(예: "자동 입력 6개 · 확인 필요 2개").
   * children(필드 목록 전체)은 그대로 펼쳐야만 보인다 — summary는 "지금 뭘
   * 확인해야 하는지"를 미리 보여주는 용도지 필드 목록의 대체가 아니다. */
  summary?: React.ReactNode;
  children: React.ReactNode;
  /** Sprint A-3(Auto Scroll) — Sticky Summary에서 이 섹션으로 스크롤할 때
   * anchor로 쓴다(scrollIntoView 대상). */
  id?: string;
  /** open/onToggle을 둘 다 주면 controlled 모드로 동작한다 — 부모(RegistrationEditor)가
   * "Summary에서 클릭 → 이 섹션을 펼친다"를 제어해야 하기 때문이다. 안 주면 기존처럼
   * 내부 state로 독립 동작한다(하위 호환 — Compliance/개발 로그 등 기존 사용처는
   * 그대로 둔다). */
  open?: boolean;
  onToggle?: (open: boolean) => void;
  /** N-3.16 잔여3(가격 섹션) — 가격처럼 "접혀 있어도 최종 판매가/원본/AI추천/
   * 사용자확정 숫자를 보여줘야 하는" 경우, 그 숫자 계산(useState/useEffect)이
   * children(PriceEditor) 내부에만 있다. summary prop으로 숫자를 복제해서
   * 넘기면 계산이 두 곳에 생겨 "화면마다 다른 숫자"(이 프로젝트에서 반복됐던
   * 버그 유형)로 이어질 수 있다. 대신 children을 항상 마운트해서 계산은 한
   * 곳에서만 하고, 펼침 여부에 따라 무엇을 그릴지는 children이 open prop을
   * 넘겨받아 스스로 판단하게 한다. */
  alwaysRenderChildren?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;

  function toggle() {
    const next = !open;
    onToggle?.(next);
    if (!isControlled) setInternalOpen(next);
  }

  return (
    <section id={id} className="scroll-mt-4 rounded-lg border border-border bg-surface shadow-subtle">
      <button type="button" onClick={toggle} className="flex w-full flex-col gap-1 px-4 py-3 text-left">
        <span className="flex w-full items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
            {title}
            {badge}
          </span>
          <span className="text-xs text-text-tertiary">{open ? "접기 ▲" : "펼치기 ▼"}</span>
        </span>
        {summary && <span className="text-xs font-normal text-text-secondary">{summary}</span>}
      </button>
      {(open || alwaysRenderChildren) && <div className="space-y-3 border-t border-border p-4">{children}</div>}
    </section>
  );
}
