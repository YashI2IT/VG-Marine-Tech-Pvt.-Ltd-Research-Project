"use client";

import { BrandMark } from "@/components/brand/BrandMark";
import { logout } from "@/services/auth";
import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  Battery,
  Car,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Thermometer,
  UserRound,
  Users,
  Wrench,
  X,
  Zap,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const userLinks = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Virtual Sensor", href: "/virtual-sensor", icon: Activity },
  { name: "Fleet", href: "/fleet", icon: Car },
  { name: "Vehicles", href: "/vehicles", icon: Battery },
  { name: "Thermal Intelligence", href: "/thermal-intelligence", icon: Thermometer },
  { name: "Thermal Events", href: "/thermal-events", icon: Zap },
  { name: "Maintenance", href: "/maintenance", icon: Wrench },
  { name: "Sensor Analysis", href: "/sensor-analysis", icon: Activity },
  { name: "Reports", href: "/reports", icon: FileText },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Profile", href: "/profile", icon: UserRound },
];

const adminLinks = [
  { name: "Admin Hub", href: "/admin", icon: ShieldCheck, exact: true },
  { name: "User Traffic", href: "/admin/traffic", icon: BarChart3 },
  { name: "User Pool", href: "/admin/users", icon: Users },
  { name: "Maintenance Ops", href: "/admin/maintenance", icon: Wrench },
  { name: "Billing & Ledger", href: "/admin/billing", icon: CreditCard },
];

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { email: string; role: string; name?: string };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const isAdmin = user.role === "admin";
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  const allLinks = [...adminLinks, ...userLinks];
  const active = allLinks.find((l) => {
    if ("exact" in l && l.exact) return pathname === l.href;
    return pathname === l.href || pathname.startsWith(l.href + "/");
  });

  return (
    <div className="min-h-screen px-3 py-3 md:px-5 md:py-4">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1600px] flex-col gap-4 lg:flex-row">
        {/* Mobile Header */}
        <div className="flex items-center justify-between rounded-full bg-white px-4 py-3 shadow-sm lg:hidden">
          <div className="flex items-center gap-2 font-semibold">
            <BrandMark size={32} />
            ECUlytics
          </div>
          <button type="button" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((v) => !v)}>
            {open ? <X /> : <Menu />}
          </button>
        </div>

        {/* Sidebar */}
        <aside
          className={cn(
            "panel z-20 flex w-full flex-col lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-64 lg:shrink-0",
            open ? "flex" : "hidden lg:flex"
          )}
        >
          {/* Logo */}
          <div className="flex items-center gap-3 border-b border-[#eef3f9] px-5 py-5">
            <BrandMark size={40} />
            <div>
              <p className="font-semibold leading-tight text-slate-900">ECUlytics</p>
              <p className="text-[11px] text-slate-400">
                {isAdminRoute ? "Admin Console" : "TrustSense-BMS"}
              </p>
            </div>
          </div>

          {/* Environment/Tenant Pill */}
          <div className="px-4 py-3">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {isAdminRoute ? "Console Environment" : "Tenant"}
            </p>
            {isAdminRoute ? (
              <div className="mt-1 flex items-center justify-between rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white shadow-sm">
                <span>Admin Operations</span>
                <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
              </div>
            ) : (
              <div className="mt-1 flex items-center justify-between rounded-full bg-[#eff6ff] px-4 py-1.5 text-xs font-medium text-slate-700">
                <span>Global Fleet Ops</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 space-y-4 overflow-auto px-3 pb-4" aria-label="Primary">
            {isAdminRoute ? (
              /* ================= ADMIN DASHBOARD NAVIGATION (ONLY ADMIN LINKS) ================= */
              <div>
                <div className="mb-2 flex items-center justify-between px-3">
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-900">
                    Administration
                  </span>
                  <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[9px] font-semibold uppercase text-white">
                    Root
                  </span>
                </div>
                <div className="space-y-1">
                  {adminLinks.map((link) => {
                    const Icon = link.icon;
                    const isActive = link.exact
                      ? pathname === link.href
                      : pathname === link.href || pathname.startsWith(link.href + "/");
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                          "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition",
                          isActive
                            ? "bg-slate-900 text-white shadow-sm font-semibold"
                            : "text-slate-600 hover:bg-[#eff6ff] hover:text-slate-900"
                        )}
                        onClick={() => setOpen(false)}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                        {link.name}
                      </Link>
                    );
                  })}
                </div>

                {/* Back to User Workspace Quick Switcher */}
                <div className="pt-6 px-1">
                  <Link
                    href="/dashboard"
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-white hover:border-slate-300 hover:text-blue-700 transition shadow-sm"
                    onClick={() => setOpen(false)}
                  >
                    <span className="flex items-center gap-2">
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Fleet Workspace
                    </span>
                    <span className="text-[10px] text-slate-400">Exit Admin</span>
                  </Link>
                </div>
              </div>
            ) : (
              /* ================= USER WORKSPACE NAVIGATION ================= */
              <div>
                {/* Admin Switcher for privileged users */}
                {isAdmin && (
                  <div className="mb-3 px-1">
                    <Link
                      href="/admin"
                      className="flex items-center justify-between rounded-2xl bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-black transition shadow-sm"
                      onClick={() => setOpen(false)}
                    >
                      <span className="flex items-center gap-2">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                        Admin Dashboard
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                    </Link>
                  </div>
                )}

                <div className="mb-1.5 px-3">
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    User Workspace
                  </span>
                </div>
                <div className="space-y-1">
                  {userLinks.map((link) => {
                    const Icon = link.icon;
                    const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                          "flex items-center gap-3 rounded-full px-4 py-2 text-sm font-medium transition",
                          isActive
                            ? "bg-[#2563eb] text-white shadow-sm shadow-blue-200"
                            : "text-slate-500 hover:bg-[#eff6ff] hover:text-slate-800"
                        )}
                        onClick={() => setOpen(false)}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                        {link.name}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </nav>

          {/* User Profile & Sign Out */}
          <div className="border-t border-[#eef3f9] p-4">
            <div className="mb-3 flex items-center gap-3 px-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ecfdf5] text-sm font-bold text-emerald-700">
                {(user.name ? user.name.charAt(0) : user.email.charAt(0)).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{user.name || user.email}</p>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  <p className="text-xs capitalize text-slate-400">{user.role}</p>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-full px-4 py-2 text-sm text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition"
              onClick={async () => {
                await logout();
                router.push("/login");
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="panel flex h-16 items-center justify-between px-5">
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold text-slate-800">{active?.name ?? "ECUlytics"}</p>
              {isAdminRoute && (
                <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                  Admin Panel
                </span>
              )}
            </div>
            <div className="hidden items-center gap-3 sm:flex">
              <div className="rounded-full bg-[#eff6ff] px-3.5 py-1 text-xs font-medium text-blue-700">
                Live Telemetry Ingress: 18.4 MB/s
              </div>
              <div className="rounded-full bg-[#ecfdf5] px-3.5 py-1 text-xs font-medium text-emerald-800">
                System Health: 99.98%
              </div>
            </div>
          </header>
          <main className="min-w-0 flex-1 pb-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
