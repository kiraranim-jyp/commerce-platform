import type { ReactNode } from "react";
import { PageContainer } from "./PageContainer";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  size?: "lg" | "xl" | "2xl";
}

export function PageHeader({ title, subtitle, actions, size = "xl" }: PageHeaderProps) {
  return (
    <div className="border-b border-border bg-surface">
      <PageContainer size={size} className="flex items-start justify-between gap-4 py-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </PageContainer>
    </div>
  );
}
