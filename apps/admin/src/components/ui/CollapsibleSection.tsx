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
  children,
  id,
  open: openProp,
  onToggle,
}: {
  title: string;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
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
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
          {title}
          {badge}
        </span>
        <span className="text-xs text-text-tertiary">{open ? "접기 ▲" : "펼치기 ▼"}</span>
      </button>
      {open && <div className="space-y-3 border-t border-border p-4">{children}</div>}
    </section>
  );
}
