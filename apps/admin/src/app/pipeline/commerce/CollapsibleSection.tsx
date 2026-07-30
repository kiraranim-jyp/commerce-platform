"use client";

import { useState } from "react";

/**
 * P0-UI Epic 4(Accordion 구조) — "추가정보"(AI/상품고시/Compliance/Developer)를
 * 전부 이 컴포넌트로 감싼다. 기존 코드 곳곳에 있던 개별 useState(boolean) +
 * "펼치기 ▼/접기 ▲" 토글 패턴(ImageCard/page.tsx/StageStepper/
 * CategoryRecommendationPanel)을 하나로 통일한 것 — 새 Accordion 하나 추가할 때마다
 * 매번 같은 토글 로직을 새로 짜지 않는다.
 */
export function CollapsibleSection({
  title,
  defaultOpen = false,
  badge,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-lg border border-border bg-surface shadow-subtle">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
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
