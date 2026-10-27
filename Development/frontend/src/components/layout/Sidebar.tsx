"use client";

import { cn } from "@/lib/utils";
import { logout } from "@/services/auth";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  LayoutDashboard,
  Cpu,
  Truck,
  Car,
  Flame,
  AlertTriangle,
  Wrench,
  Activity,
  FileText,
  Settings,
  User,
  LogOut,
  X,
  ShieldCheck,
  Users,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  badge?: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const userTopItem: NavItem = {
  name: "Dashboard",
  href: "/dashboard",
  icon: LayoutDashboard,
};

export const userNavGroups: NavGroup[] = [
  {
    title: "Operations & Fleet",
    items: [
      { name: "Virtual Sensor", href: "/virtual-sensor", icon: Cpu },
      { name: "Fleet Management", href: "/fleet", icon: Truck },
      { name: "Vehicles", href: "/vehicles", icon: Car },
    ],
  },
  {
    title: "Thermal Intelligence",
    items: [
      { name: "Thermal Analysis", href: "/thermal-intelligence", icon: Flame },
      { name: "Thermal Events", href: "/thermal-events", icon: AlertTriangle },
      { name: "Sensor Analysis", href: "/sensor-analysis", icon: Activity },
      { name: "Maintenance Ops", href: "/maintenance", icon: Wrench },
      { name: "Reports", href: "/reports", icon: FileText },
    ],
  },
  {
    title: "Company & Settings",
    items: [
      { name: "Checkout & Ledger", href: "/checkout", icon: CreditCard },
      { name: "Settings", href: "/settings", icon: Settings },
      { name: "Profile", href: "/profile", icon: User },
    ],
  },
];

export const adminTopItem: NavItem = {
  name: "Admin Hub",
  href: "/admin",
  icon: ShieldCheck,
  exact: true,
};

export const adminNavGroups: NavGroup[] = [
  {
    title: "System Administration",
    items: [
      { name: "User Traffic", href: "/admin/traffic", icon: Activity },
      { name: "User Pool", href: "/admin/users", icon: Users },
    ],
  },
  {
    title: "Operations & Ledger",
    items: [
      { name: "Maintenance Ops", href: "/admin/maintenance", icon: Wrench },
      { name: "Billing & Ledger", href: "/admin/billing", icon: CreditCard },
    ],
  },
];

// Helper: Accessible Tooltip for Collapsed Sidebar Items (rendered via React Portal)
function SidebarTooltip({
  children,
  label,
  enabled,
}: {
  children: React.ReactNode;
  label: string;
  enabled: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const show = useCallback(() => {
    if (!enabled || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({
      top: rect.top + rect.height / 2,
      left: rect.right + 10,
    });
    setVisible(true);
  }, [enabled]);

  const hide = useCallback(() => {
    setVisible(false);
  }, []);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <div
      ref={triggerRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      className="relative flex w-full items-center justify-center"
    >
      {children}
      {visible &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[9999] -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white shadow-xl animate-in fade-in zoom-in-95 duration-150"
            style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
          >
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-[4px] border-transparent border-r-slate-900" />
            {label}
          </div>,
          document.body
        )}
    </div>
  );
}

export interface SidebarProps {
  user: { email: string; role: string; name?: string };
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  user,
  isCollapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = user.role === "admin";
  const topItem = isAdmin ? adminTopItem : userTopItem;
  const navGroups = isAdmin ? adminNavGroups : userNavGroups;

  // Handle escape key to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileOpen) {
        onCloseMobile();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen, onCloseMobile]);

  const handleSignOut = async () => {
    await logout();
    router.push("/login");
  };

  const isItemActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  const renderNavContent = (collapsed: boolean, onLinkClick?: () => void) => (
    <div className="flex h-full flex-col justify-between overflow-hidden select-none">
      {/* Top Header & Navigation Section */}
      <div className="flex flex-col min-h-0 flex-1">
        {/* Brand & Toggle Header with smooth morphing */}
        <div
          className={cn(
            "relative flex flex-col justify-center border-b border-slate-100/90 transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] shrink-0",
            collapsed ? "h-24 px-2 py-3" : "h-16 px-4 py-3"
          )}
        >
          <div
            className={cn(
              "flex items-center transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
              collapsed ? "justify-center" : "justify-between"
            )}
          >
            <Link
              href={isAdmin ? "/admin" : "/dashboard"}
              className="flex items-center transition-opacity hover:opacity-90 shrink-0 focus-visible:outline-2 focus-visible:outline-blue-600 rounded-lg py-1"
              onClick={onLinkClick}
              title="ECUlytics"
            >
              <div className="flex items-baseline overflow-hidden whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]">
                <span className={cn("font-black tracking-tight text-blue-600 transition-all duration-300", collapsed ? "text-lg" : "text-xl")}>
                  ECU
                </span>
                <span
                  className={cn(
                    "text-xl font-bold tracking-tight text-[#0f2744] transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] overflow-hidden",
                    collapsed
                      ? "max-w-0 opacity-0 pointer-events-none"
                      : "max-w-[120px] opacity-100"
                  )}
                >
                  lytics
                </span>
              </div>
            </Link>

            {/* Toggle button when expanded */}
            <div
              className={cn(
                "overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
                collapsed ? "max-w-0 opacity-0 pointer-events-none" : "max-w-10 opacity-100"
              )}
            >
              <button
                type="button"
                onClick={onToggleCollapse}
                className="hidden lg:flex items-center justify-center h-8 w-8 rounded-full bg-white border border-slate-200 shadow-2xs text-slate-500 hover:text-[#0f2744] hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
                title="Minimize sidebar (Ctrl+B)"
                aria-label="Minimize sidebar"
              >
                <ChevronLeft className="h-4 w-4 text-slate-600" />
              </button>
            </div>
          </div>

          {/* Toggle button when collapsed (centered smoothly underneath brand mark) */}
          <div
            className={cn(
              "overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] flex items-center justify-center",
              collapsed ? "max-h-8 opacity-100 mt-2" : "max-h-0 opacity-0 pointer-events-none mt-0"
            )}
          >
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden lg:flex items-center justify-center h-7 w-7 rounded-full bg-slate-50 border border-slate-200 shadow-2xs text-slate-600 hover:text-blue-600 hover:bg-white hover:border-blue-300 transition-all duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
              title="Maximize sidebar (Ctrl+B)"
              aria-label="Maximize sidebar"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Navigation Scroll Area */}
        <nav
          className={cn(
            "flex-1 overflow-y-auto no-scrollbar py-2.5 transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
            collapsed ? "px-2 space-y-1" : "px-3 space-y-2 pb-6"
          )}
          aria-label={isAdmin ? "Administration Navigation" : "User Navigation"}
        >
          {/* Standalone Primary Route (e.g. Dashboard / Admin Hub) */}
          <div className="pb-1 w-full">
            {(() => {
              const Icon = topItem.icon;
              const active = isItemActive(topItem);

              return (
                <SidebarTooltip label={topItem.name} enabled={collapsed}>
                  <Link
                    href={topItem.href}
                    onClick={onLinkClick}
                    className={cn(
                      "group relative flex items-center transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] select-none focus-visible:outline-2 focus-visible:outline-blue-600",
                      collapsed
                        ? "h-10 w-10 justify-center rounded-xl mx-auto my-0.5"
                        : "w-full gap-3 rounded-xl px-3 py-2 text-[13.5px] text-left",
                      active
                        ? "bg-white border border-slate-200/80 shadow-[0_2px_8px_rgba(15,39,68,0.06)] font-semibold text-[#0f2744]"
                        : "font-medium text-slate-600 hover:text-[#0f2744] hover:bg-slate-100/70 border border-transparent"
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {/* Active vertical indicator bar on far left */}
                    <span
                      className={cn(
                        "absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full bg-[#0f2744] transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
                        active
                          ? "h-5 w-1 opacity-100"
                          : "h-0 w-0 opacity-0"
                      )}
                    />

                    <Icon
                      className={cn(
                        "shrink-0 transition-all duration-200 ease-out",
                        collapsed ? "h-5 w-5" : "h-[19px] w-[19px]",
                        active
                          ? "text-[#0f2744]"
                          : "text-slate-500 group-hover:text-slate-800 group-hover:scale-105"
                      )}
                      aria-hidden="true"
                    />

                    <span
                      className={cn(
                        "overflow-hidden whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] tracking-tight text-left flex-1",
                        collapsed
                          ? "max-w-0 opacity-0 -translate-x-3 pointer-events-none"
                          : "max-w-[180px] opacity-100 translate-x-0"
                      )}
                    >
                      {topItem.name}
                    </span>
                  </Link>
                </SidebarTooltip>
              );
            })()}
          </div>

          {/* Navigation Groups */}
          {navGroups.map((group, groupIdx) => (
            <div key={group.title || groupIdx} className="space-y-0.5 w-full">
              {/* Group Header */}
              <div className="w-full overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]">
                {/* Expanded Group Header Text & Chevron */}
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
                    collapsed
                      ? "max-h-0 opacity-0 py-0 pointer-events-none"
                      : "max-h-8 opacity-100 px-3 pt-3.5 pb-1"
                  )}
                >
                  <div className="flex items-center justify-between text-[10.5px] font-bold uppercase tracking-wider text-[#1e3a8a] select-none">
                    <span>{group.title}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-[#1e3a8a]/70" />
                  </div>
                </div>

                {/* Sleek divider line when collapsed */}
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
                    collapsed ? "max-h-4 opacity-100 my-2" : "max-h-0 opacity-0 my-0 pointer-events-none"
                  )}
                >
                  <div className="mx-auto w-6 border-t border-slate-200/80" />
                </div>
              </div>

              {/* Group Items */}
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item);

                return (
                  <SidebarTooltip key={item.href} label={item.name} enabled={collapsed}>
                    <Link
                      href={item.href}
                      onClick={onLinkClick}
                      className={cn(
                        "group relative flex items-center transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] select-none focus-visible:outline-2 focus-visible:outline-blue-600",
                        collapsed
                          ? "h-10 w-10 justify-center rounded-xl mx-auto my-0.5"
                          : "w-full gap-3 rounded-xl px-3 py-1.5 text-[13.5px] text-left",
                        active
                          ? "bg-white border border-slate-200/80 shadow-[0_2px_8px_rgba(15,39,68,0.06)] font-semibold text-[#0f2744]"
                          : "font-medium text-slate-600 hover:text-[#0f2744] hover:bg-slate-100/70 border border-transparent"
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      {/* Active vertical indicator bar */}
                      <span
                        className={cn(
                          "absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full bg-[#0f2744] transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
                          active
                            ? "h-5 w-1 opacity-100"
                            : "h-0 w-0 opacity-0"
                        )}
                      />

                      <Icon
                        className={cn(
                          "shrink-0 transition-all duration-200 ease-out",
                          collapsed ? "h-5 w-5" : "h-[18px] w-[18px]",
                          active
                            ? "text-[#0f2744]"
                            : "text-slate-500 group-hover:text-slate-800 group-hover:scale-105"
                        )}
                        aria-hidden="true"
                      />

                      <span
                        className={cn(
                          "overflow-hidden whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] tracking-tight text-left flex-1",
                          collapsed
                            ? "max-w-0 opacity-0 -translate-x-3 pointer-events-none"
                            : "max-w-[180px] opacity-100 translate-x-0"
                        )}
                      >
                        {item.name}
                      </span>
                    </Link>
                  </SidebarTooltip>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* User Profile & Sign Out Footer */}
      <div
        className={cn(
          "shrink-0 border-t border-slate-100/90 bg-white transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
          collapsed ? "p-2" : "p-2.5"
        )}
      >
        <div
          className={cn(
            "relative flex items-center transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
            collapsed
              ? "flex-col gap-1.5 p-1 bg-transparent border-transparent"
              : "justify-between p-2 rounded-xl bg-slate-50/90 border border-slate-100/90"
          )}
        >
          {/* Profile link */}
          <SidebarTooltip
            label={`${user.name || user.email} (${user.role})`}
            enabled={collapsed}
          >
            <Link
              href="/profile"
              onClick={onLinkClick}
              className={cn(
                "group flex items-center min-w-0 transition-all duration-300 rounded-lg hover:opacity-90",
                collapsed ? "justify-center p-0.5 hover:bg-slate-100" : "gap-2.5 flex-1"
              )}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0f2744] text-xs font-bold text-white shadow-2xs group-hover:scale-105 transition-transform duration-200">
                {(user.name ? user.name.charAt(0) : user.email.charAt(0)).toUpperCase()}
              </div>

              <div
                className={cn(
                  "overflow-hidden whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] min-w-0 flex-1 text-left",
                  collapsed
                    ? "max-w-0 opacity-0 -translate-x-3 pointer-events-none"
                    : "max-w-[140px] opacity-100 translate-x-0"
                )}
              >
                <p className="truncate text-xs font-semibold text-slate-800 leading-tight">
                  {user.name || user.email}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  <p className="text-[10px] font-medium text-slate-500 capitalize truncate leading-none">
                    {user.role} · Active
                  </p>
                </div>
              </div>
            </Link>
          </SidebarTooltip>

          {/* Sign Out Button */}
          <SidebarTooltip label="Sign out" enabled={collapsed}>
            <button
              type="button"
              onClick={handleSignOut}
              title="Sign out"
              aria-label="Sign out"
              className={cn(
                "flex items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all duration-200 shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-rose-500",
                collapsed ? "h-8 w-8 hover:bg-rose-50 hover:text-rose-600" : "p-1.5"
              )}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </SidebarTooltip>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar Docked Flush Left */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden lg:flex flex-col bg-white border-r border-slate-200/80 transition-[width] duration-300 ease-[cubic-bezier(0.2,0,0,1)] shadow-[1px_0_10px_rgba(0,0,0,0.02)]",
          isCollapsed ? "w-[68px]" : "w-[260px]"
        )}
      >
        {renderNavContent(isCollapsed)}
      </aside>

      {/* Mobile Slide-Out Drawer Overlay Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs transition-opacity lg:hidden animate-in fade-in duration-200"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Mobile Slide-Out Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile Navigation"
      >
        {/* Mobile Drawer Close Control */}
        <button
          type="button"
          onClick={onCloseMobile}
          className="absolute right-3.5 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          aria-label="Close navigation drawer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* In Mobile Drawer, always render in full expanded mode */}
        {renderNavContent(false, onCloseMobile)}
      </div>
    </>
  );
}
