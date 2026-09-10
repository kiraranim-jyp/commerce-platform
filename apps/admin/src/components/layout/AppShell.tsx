"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ImpersonationBanner } from "./ImpersonationBanner";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  Clock,
  HelpCircle,
  Home,
  Image as ImageIcon,
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
  /** CS-OBSERVABILITY-1.2 — 관리자 세션에서만 보이는 항목. 메뉴를 감추는 것은
   * UX일 뿐 권한이 아니다 — 실제 차단은 proxy가 계속 한다. */
  adminOnly?: boolean;
};

const NAV_ITEMS: NavigationItem[] = [
  // CS-OBSERVABILITY-1.2(CPO 지시, 2026-09-11) — 이 사이드바는 판매자 화면과
  // 관리자 화면이 함께 쓴다. 그런데 첫 항목이 관리자 대시보드를 가리켜서,
  // 판매자에게도 운영 메뉴가 보이고 있었다(대표님이 실사용에서 발견).
  // 클릭하면 proxy가 /admin/login으로 돌려보내므로 데이터가 새지는 않았지만,
  // 판매자에게 관리자 기능의 존재를 알리고 혼란을 준다.
  { id: "dashboard", title: "운영 Dashboard", href: "/admin/dashboard", icon: Home, adminOnly: true },
  { id: "today", title: "오늘의 등록", href: "/today", icon: ClipboardList },
  { id: "pipeline", title: "상품등록", href: "/pipeline", icon: Package },
  { id: "recent", title: "최근 작업", href: "/snapshots", icon: Clock },
  { id: "images", title: "이미지", href: "/assets", icon: ImageIcon },
  { id: "settings", title: "설정", href: "/settings", icon: Settings },
  { id: "help", title: "도움말", href: "#", icon: HelpCircle, soon: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // null = 아직 모름. 확정 전에는 관리자 메뉴를 보여주지 않는다 — 잠깐 보였다가
  // 사라지는 것도 "관리자 기능이 있다"는 정보를 노출한다.
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // 판정은 서버가 한다. /api/admin/*은 proxy가 관리자 세션 쿠키를 검증하므로,
    // 이 요청이 200으로 돌아왔다는 사실 자체가 관리자라는 뜻이다. 클라이언트가
    // 스스로 관리자라고 주장할 수 없다.
    void fetch("/api/admin/session")
      .then((r) => {
        if (!cancelled) setIsAdmin(r.ok);
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <div className="flex h-screen flex-col">
      {/* BETA-SECURITY-2 FINAL §4 — 전환 중이면 최상단에 항상 보인다. */}
      <ImpersonationBanner />
      <AppHeader />
      <div className="flex min-h-0 flex-1">
        <nav className="flex w-[220px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-brand-navy-800 bg-brand-navy-900 p-3">
          {NAV_ITEMS.filter((item) => item.visible !== false && (!item.adminOnly || isAdmin)).map((item) => {
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
        </nav>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
      <Footer />
    </div>
  );
}
