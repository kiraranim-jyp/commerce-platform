"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardList,
  Clock,
  HelpCircle,
  Home,
  Image as ImageIcon,
  LogOut,
  Package,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { AppHeader } from "./AppHeader";
import { Footer } from "./Footer";
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
  { id: "today", title: "오늘의 등록", href: "/today", icon: ClipboardList },
  { id: "pipeline", title: "상품등록", href: "/pipeline", icon: Package },
  { id: "recent", title: "최근 작업", href: "/snapshots", icon: Clock },
  { id: "images", title: "이미지", href: "/assets", icon: ImageIcon },
  { id: "settings", title: "설정", href: "/settings", icon: Settings },
  { id: "help", title: "도움말", href: "#", icon: HelpCircle, soon: true },
];

function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
        router.replace("/login");
        router.refresh();
      }}
      className="mt-auto flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium text-white/65 transition-colors duration-[var(--transition-fast)] hover:bg-white/5 hover:text-white"
    >
      <LogOut size={16} className="shrink-0" />
      <span className="flex-1 truncate text-left">로그아웃</span>
    </button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen flex-col">
      <AppHeader />
      <div className="flex min-h-0 flex-1">
        <nav className="flex w-[220px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-brand-navy-800 bg-brand-navy-900 p-3">
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
                ? "bg-brand-green-500/15 text-brand-green-400"
                : "text-white/65 hover:bg-white/5 hover:text-white",
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
          {/* BETA-SECURITY-2 §19 — Seller 로그아웃. 관리자 로그아웃과 별개
              경로(/api/auth/logout)를 쓴다. 서버에서 signOut을 호출해야
              refresh 토큰까지 무효화된다. */}
          <LogoutButton />
        </nav>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
      <Footer />
    </div>
  );
}
