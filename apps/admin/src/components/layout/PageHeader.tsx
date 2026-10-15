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
  /**
   * 🔴🔴 WU-029 — **머리글을 화면에 붙여 둔다(기본은 꺼짐).**
   *
   * 왜 생겼나: 「새 상품 분석」 버튼은 **처음부터 여기 있었다**(`pipeline/page.tsx`
   * 의 `actions`). 그런데 분석 결과 화면이 세로로 매우 길어서, 셀러가 결과를 다
   * 읽고 나면 그 버튼이 **화면 밖으로 스크롤돼 사라진다** — 그래서 「새 상품
   * 분석이 없다」로 읽혔다(CPO Production 화면 검토 ①).
   *
   * 🔴 **버튼을 새로 만들지 않았다.** 행동 통로는 하나여야 한다 — 두 개면 어느
   *    것이 진짜인지 알 수 없고 상태가 갈린다. 있는 것을 **닿게** 만든다.
   * 🟢 기본값 `false` — 켠 화면만 바뀐다(다른 페이지 영향 0).
   */
  sticky?: boolean;
}

export function PageHeader({ title, subtitle, breadcrumb, actions, size = "xl", sticky = false }: PageHeaderProps) {
  return (
    <div
      className={`border-b border-border bg-surface${sticky ? " sticky top-0 z-30" : ""}`}
      data-testid={sticky ? "page-header-sticky" : undefined}
    >
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
