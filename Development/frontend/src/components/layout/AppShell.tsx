"use client";

import { BrandMark } from "@/components/brand/BrandMark";
import { cn } from "@/lib/utils";
import { logout } from "@/services/auth";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
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
  Menu,
  X,
  ShieldCheck,
  Users,
  CreditCard,
} from "lucide-react";

const userLinks = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Virtual Sensor", href: "/virtual-sensor", icon: Cpu },
  { name: "Fleet", href: "/fleet", icon: Truck },
  { name: "Vehicles", href: "/vehicles", icon: Car },
  { name: "Thermal Intelligence", href: "/thermal-intelligence", icon: Flame },
  { name: "Thermal Events", href: "/thermal-events", icon: AlertTriangle },
  { name: "Maintenance", href: "/maintenance", icon: Wrench },
  { name: "Sensor Analysis", href: "/sensor-analysis", icon: Activity },
  { name: "Reports", href: "/reports", icon: FileText },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Profile", href: "/profile", icon: User },
];

const adminLinks = [
  { name: "Admin Hub", href: "/admin", icon: ShieldCheck, exact: true },
  { name: "User Traffic", href: "/admin/traffic", icon: Activity },
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
  const links = isAdmin ? adminLinks : userLinks;

  const active = links.find((l) => {
    if ("exact" in l && l.exact) return pathname === l.href;
    return pathname === l.href || pathname.startsWith(l.href + "/");
  });

  return (
    <div className="min-h-screen px-3 py-3 md:px-5 md:py-4">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1600px] flex-col gap-4 lg:flex-row">
        {/* Mobile Header Bar */}
        <div className="flex items-center justify-between panel px-4 py-3 lg:hidden">
          <div className="flex items-center gap-3">
            <BrandMark size={32} />
            <div>
              <p className="text-sm font-bold text-slate-900 leading-tight">ECUlytics</p>
              <p className="text-[10px] text-slate-400">
                {isAdmin ? "Admin Console" : "TrustSense-BMS"}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 transition"
            onClick={() => setOpen(!open)}
            aria-label="Toggle navigation menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Sidebar Navigation */}
        <aside
          className={cn(
            "panel flex w-full flex-col lg:w-64 shrink-0 transition-all duration-200",
            open ? "block" : "hidden lg:flex"
          )}
        >
          {/* Brand Header */}
          <div className="flex items-center gap-3 border-b border-[#eef3f9] px-5 py-5">
            <BrandMark size={40} />
            <div>
              <p className="font-semibold leading-tight text-slate-900">ECUlytics</p>
              <p className="text-[11px] text-slate-400">
                {isAdmin ? "Admin Console" : "TrustSense-BMS"}
              </p>
            </div>
          </div>

          {/* Environment/Tenant Pill */}
          <div className="px-4 py-3">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {isAdmin ? "Console Environment" : "Tenant"}
            </p>
            {isAdmin ? (
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

          {/* Navigation Links - STRICT RBAC */}
          <nav className="flex-1 space-y-4 overflow-auto px-3 pb-4" aria-label="Primary">
            {isAdmin ? (
              /* ================= ADMIN ONLY NAVIGATION (ADMIN WILL ONLY SEE THE ADMIN PART) ================= */
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
              </div>
            ) : (
              /* ================= USER WORKSPACE NAVIGATION (NEW CREATED USER SEES HIS PART) ================= */
              <div>
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
                  <p className="text-xs capitalize text-slate-400">
                    {user.role === "admin" ? "Platform Administrator" : user.role === "user" ? "Fleet Operator" : user.role}
                  </p>
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
              <p className="text-sm font-semibold text-slate-800">{active?.name ?? (isAdmin ? "Admin Console" : "ECUlytics")}</p>
              {isAdmin && (
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
