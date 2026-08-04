"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clock,
  HelpCircle,
  Home,
  Image as ImageIcon,
  Package,
  Settings,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { AppHeader } from "./AppHeader";
import { Badge } from "../ui/Badge";

type NavigationItem = {
  id: string;
  title: string;
  description?: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  soon?: boolean;
  beta?: boolean;
  visible?: boolean;
};

const NAV_ITEMS: NavigationItem[] = [
  { id: "dashboard", title: "Dashboard", href: "/admin/dashboard", icon: Home },
  { id: "pipeline", title: "상품등록", href: "/pipeline", icon: Package },
  { id: "recent", title: "최근 작업", href: "/snapshots", icon: Clock },
  { id: "images", title: "이미지", href: "#", icon: ImageIcon, soon: true },
  { id: "brand", title: "브랜드 관리", href: "/settings?tab=brand", icon: Tag },
  { id: "settings", title: "설정", href: "/settings", icon: Settings },
  { id: "help", title: "도움말", href: "#", icon: HelpCircle, soon: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen flex-col">
      <AppHeader />
      <div className="flex min-h-0 flex-1">
        <nav className="flex w-[220px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border bg-surface p-3">
          {NAV_ITEMS.filter((item) => item.visible !== false).map((item) => {
            const active = pathname === item.href.split("?")[0];
            const Icon = item.icon;
            const badgeLabel = item.badge ?? (item.soon ? "Soon" : item.beta ? "Beta" : undefined);
            const content = (
              <>
                <Icon size={16} className="shrink-0" />
                <span className="flex-1 truncate">{item.title}</span>
                {badgeLabel && (
                  <Badge size="sm" variant="default">
                    {badgeLabel}
                  </Badge>
                )}
              </>
            );
            const className = [
              "flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors duration-[var(--transition-fast)]",
              active
                ? "bg-primary/10 text-primary"
                : "text-text-secondary hover:bg-background hover:text-text-primary",
            ].join(" ");

            if (item.soon) {
              return (
                <span key={item.id} className={className} aria-disabled="true">
                  {content}
                </span>
              );
            }
            return (
              <Link key={item.id} href={item.href} className={className}>
                {content}
              </Link>
            );
          })}
        </nav>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
