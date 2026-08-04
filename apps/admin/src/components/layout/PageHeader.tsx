import type { ReactNode } from "react";
import Link from "next/link";
import { PageContainer } from "./PageContainer";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumb?: BreadcrumbItem[];
  actions?: ReactNode;
  size?: "lg" | "xl" | "2xl";
}

export function PageHeader({ title, subtitle, breadcrumb, actions, size = "xl" }: PageHeaderProps) {
  return (
    <div className="border-b border-border bg-surface">
      <PageContainer size={size} className="flex items-start justify-between gap-4 py-5">
        <div>
          {breadcrumb && breadcrumb.length > 0 && (
            <nav className="mb-1 flex items-center gap-1.5 text-xs text-text-tertiary">
              {breadcrumb.map((item, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <span>/</span>}
                  {item.href ? (
                    <Link href={item.href} className="hover:text-text-secondary">
                      {item.label}
                    </Link>
                  ) : (
                    <span>{item.label}</span>
                  )}
                </span>
              ))}
            </nav>
          )}
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </PageContainer>
    </div>
  );
}
