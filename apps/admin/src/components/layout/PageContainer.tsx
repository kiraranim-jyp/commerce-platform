import type { HTMLAttributes } from "react";

const SIZE_CLASS = {
  md: "max-w-[1200px]",
  lg: "max-w-[1400px]",
  xl: "max-w-[1800px]",
  "2xl": "max-w-[1920px]",
} as const;

export interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: keyof typeof SIZE_CLASS;
}

export function PageContainer({ size = "xl", className, ...props }: PageContainerProps) {
  return (
    <div
      className={["mx-auto w-full px-8 py-6", SIZE_CLASS[size], className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
