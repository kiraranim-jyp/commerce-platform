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
}

export function Tabs({ items, value, onChange, className }: TabsProps) {
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
