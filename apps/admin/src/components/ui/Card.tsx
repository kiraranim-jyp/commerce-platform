import type { HTMLAttributes } from "react";

const PADDING_CLASS = {
  none: "",
  sm: "p-3",
  md: "p-5",
  lg: "p-8",
} as const;

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: keyof typeof PADDING_CLASS;
  hover?: boolean;
}

export function Card({ className, padding = "md", hover = false, ...props }: CardProps) {
  return (
    <div
      className={[
        "rounded-[var(--radius-lg)] border border-border bg-surface shadow-[var(--shadow-subtle)]",
        "transition-[transform,box-shadow] duration-[var(--transition-fast)]",
        hover && "hover:-translate-y-px hover:shadow-[var(--shadow-elevated)]",
        PADDING_CLASS[padding],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
