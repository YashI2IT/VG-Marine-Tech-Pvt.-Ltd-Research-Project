"use client";

import { Sidebar, userNavGroups, adminNavGroups, userTopItem, adminTopItem } from "@/components/layout/Sidebar";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

const SIDEBAR_STORAGE_KEY = "eculytics_sidebar_collapsed";

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { email: string; role: string; name?: string };
}) {
  const pathname = usePathname();
  const isAdmin = user.role === "admin";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Restore saved sidebar preference from localStorage after hydration
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (saved !== null) {
        setIsCollapsed(saved === "true");
      }
    } catch {
      // LocalStorage access may fail in private mode
    }
  }, []);

  // Save sidebar preference on toggle
  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // LocalStorage access may fail in private mode
      }
      return next;
    });
  }, []);

  // Global keyboard shortcut: Ctrl+B or Cmd+B to toggle sidebar collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleCollapse();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleCollapse]);

  // Determine active section name for header
  const top = isAdmin ? adminTopItem : userTopItem;
  const groups = isAdmin ? adminNavGroups : userNavGroups;
  const allLinks = [top, ...groups.flatMap((g) => g.items)];
  const active = allLinks.find((l) => {
    if (l.exact) return pathname === l.href;
    return pathname === l.href || pathname.startsWith(l.href + "/");
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col">
      {/* Mobile Top Header (< 1024px) */}
      <div className="flex items-center justify-between border-b border-slate-200/80 bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center">
          <div className="flex items-baseline">
            <span className="text-lg font-black tracking-tight text-blue-600">ECU</span>
            <span className="text-lg font-bold tracking-tight text-[#0f2744]">lytics</span>
          </div>
        </div>
        <button
          type="button"
          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-2xs hover:bg-slate-50 transition focus-visible:outline-2 focus-visible:outline-blue-600"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Desktop Sticky Sidebar Docked Flush to Left Edge */}
      <Sidebar
        user={user}
        isCollapsed={mounted ? isCollapsed : false}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Content Container (Offset by sidebar width) */}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col transition-[padding] duration-300 ease-in-out",
          mounted && isCollapsed ? "lg:pl-[68px]" : "lg:pl-[260px]"
        )}
      >
        {/* Sticky Structured Top Header Bar */}
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 sm:px-6 backdrop-blur-md">
          {/* Left: Active Section / Breadcrumb Pill */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-white border border-slate-200/90 shadow-2xs px-4 py-1.5 text-xs font-semibold text-slate-800">
              <span>{active?.name ?? (isAdmin ? "Admin Console" : "Dashboard")}</span>
              {isAdmin && (
                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                  Root
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Main Page Area */}
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-7">{children}</main>
      </div>
    </div>
  );
}
