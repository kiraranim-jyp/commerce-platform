"use client";

import { Badge } from "./Badge";

export interface TabItem {
  value: string;
  label: string;
  badge?: string;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** N-3.10(Part A) — 메뉴 수가 많아지면(설정처럼) 가로 탭은 좁은 화면에서
   * 글자가 줄바꿈되며 깨진다. "vertical"은 같은 items/value/onChange로 왼쪽
   * 사이드바 nav 형태를 렌더링한다 — 항목이 늘어나도(Commerce 추가 등) 세로
   * 스크롤만 늘어날 뿐 레이아웃이 깨지지 않는다. */
  orientation?: "horizontal" | "vertical";
}

export function Tabs({ items, value, onChange, className, orientation = "horizontal" }: TabsProps) {
  if (orientation === "vertical") {
    return (
      <div role="tablist" aria-orientation="vertical" className={["flex flex-col gap-0.5", className].filter(Boolean).join(" ")}>
        {items.map((item) => {
          const active = item.value === value;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={item.disabled}
              onClick={() => !item.disabled && onChange(item.value)}
              className={[
                "flex items-center justify-between gap-1.5 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors duration-[var(--transition-fast)]",
                active ? "bg-primary/10 text-primary" : "text-text-secondary hover:bg-background hover:text-text-primary",
                item.disabled && "cursor-not-allowed opacity-50",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span>{item.label}</span>
              {item.badge && (
                <Badge size="sm" variant="default">
                  {item.badge}
                </Badge>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      className={["flex items-center gap-1 border-b border-border", className]
        .filter(Boolean)
        .join(" ")}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            onClick={() => !item.disabled && onChange(item.value)}
            className={[
              "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-[var(--transition-fast)]",
              active
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary",
              item.disabled && "cursor-not-allowed opacity-50",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {item.label}
            {item.badge && (
              <Badge size="sm" variant="default">
                {item.badge}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
