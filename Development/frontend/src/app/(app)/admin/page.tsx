"use client";

import { Card, SectionHeader } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryGate } from "@/components/ui/QueryGate";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getAdminStats } from "@/services/admin";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Clock,
  CreditCard,
  HardDrive,
  Layers,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import Link from "next/link";

export default function AdminHubPage() {
  const { data, loading, error, reload } = useAsyncData(() => getAdminStats(), []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Control Center"
        description="Master control for platform telemetry traffic, user pool access, fleet maintenance pipelines, and billing transactions."
        crumbs={[{ label: "Admin Console" }, { label: "Admin Hub" }]}
      />

      <QueryGate loading={loading} error={error} onRetry={reload}>
        {data ? (
          <div className="space-y-6">
            {/* 4 Core Pillars KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Link href="/admin/users" className="block transition hover:scale-[1.01]">
                <KpiCard
                  label="User Pool"
                  value={data.userPool.totalUsers}
                  hint={`${data.userPool.activeToday} active today · ${data.userPool.newThisWeek} new this week`}
                  icon={Users}
                  tone="mint"
                />
              </Link>
              <Link href="/admin/traffic" className="block transition hover:scale-[1.01]">
                <KpiCard
                  label="User Traffic Today"
                  value={data.traffic.totalRequestsToday.toLocaleString()}
                  hint={`${data.traffic.virtualSensorRunsToday.toLocaleString()} virtual inferences · ${data.traffic.avgLatencyMs}ms lat`}
                  icon={BarChart3}
                />
              </Link>
              <Link href="/admin/maintenance" className="block transition hover:scale-[1.01]">
                <KpiCard
                  label="Maintenance Work Orders"
                  value={data.maintenance.activeWorkOrders}
                  hint={`${data.maintenance.urgentTickets} urgent · ${data.maintenance.scheduledCalibrations} calibrations`}
                  icon={Wrench}
                  tone="amber"
                />
              </Link>
              <Link href="/admin/billing" className="block transition hover:scale-[1.01]">
                <KpiCard
                  label="Monthly Ledger Revenue"
                  value={`$${data.billing.monthlyRecurringRevenue.toLocaleString()}`}
                  hint={`${data.billing.blockchainTxCount} blockchain txs · ${data.billing.plan}`}
                  icon={CreditCard}
                  tone="mint"
                />
              </Link>
            </div>

            {/* Admin Quick Jump Navigation Cards */}
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <Link href="/admin/traffic" className="panel p-5 transition hover:border-blue-400 group">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-600" />
                </div>
                <h3 className="mt-3 font-semibold text-slate-900">User Traffic</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Telemetry stream volume, API request rates, endpoint breakdown, and user activity spikes.
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-blue-600">
                  <span>View traffic metrics</span>
                </div>
              </Link>

              <Link href="/admin/users" className="panel p-5 transition hover:border-blue-400 group">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                    <Users className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-600" />
                </div>
                <h3 className="mt-3 font-semibold text-slate-900">User Pool</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Manage registered operators, technical analysts, assign roles, and toggle account access.
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-blue-600">
                  <span>Manage accounts</span>
                </div>
              </Link>

              <Link href="/admin/maintenance" className="panel p-5 transition hover:border-blue-400 group">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                    <Wrench className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-600" />
                </div>
                <h3 className="mt-3 font-semibold text-slate-900">Maintenance Ops</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Service tickets, thermal pack inspections, sensor calibrations, and system infrastructure health.
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-blue-600">
                  <span>Open maintenance hub</span>
                </div>
              </Link>

              <Link href="/admin/billing" className="panel p-5 transition hover:border-blue-400 group">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-600" />
                </div>
                <h3 className="mt-3 font-semibold text-slate-900">Billing & Ledger</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Enterprise quotas, monthly invoices, and Hyperledger Fabric blockchain provenance transaction fees.
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-blue-600">
                  <span>Review billing & ledger</span>
                </div>
              </Link>
            </div>

            {/* Split Section: Real-time System Status & Recent Audit Events */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <SectionHeader
                  title="Platform Services Health"
                  kicker="Live Architecture"
                  action={<StatusBadge label="Architecture Operational" tone="healthy" />}
                />
                <div className="space-y-3">
                  {(data.platformServices || [
                    {
                      service: "Express API Gateway",
                      status: "healthy",
                      uptime: "Active",
                      latency: `${data.traffic.avgLatencyMs}ms`,
                      badge: "Operational",
                      subtext: `Port 3001 · Latency: ${data.traffic.avgLatencyMs}ms`,
                    },
                    {
                      service: "CNN-LSTM Virtual Sensor Engine",
                      status: "healthy",
                      uptime: "Active",
                      latency: "11.8ms",
                      badge: "Active",
                      subtext: "PyTorch Inference Worker · Port 8000",
                    },
                    {
                      service: "Hyperledger Fabric Anchor Service",
                      status: "healthy",
                      uptime: "Synced",
                      latency: "8ms",
                      badge: "Synced",
                      subtext: `SHA-256 Merkle Commits: ${data.billing.blockchainTxCount} txs`,
                    },
                    {
                      service: "PostgreSQL 18 Data Tier",
                      status: "healthy",
                      uptime: "Connected",
                      latency: "1.2ms",
                      badge: "Connected",
                      subtext: "Relational ACID Store · Port 5432",
                    },
                  ]).map((svc, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-2xl bg-[#eff6ff] p-3 text-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-blue-600 font-semibold text-xs shadow-sm">
                          {svc.service.includes("API") ? "API" : svc.service.includes("CNN") ? "ML" : svc.service.includes("Postgre") ? "DB" : "TX"}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{svc.service}</p>
                          <p className="text-xs text-slate-500">{svc.subtext || `Latency: ${svc.latency}`}</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                        {svc.badge || svc.uptime}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <SectionHeader title="Recent Admin Operations" kicker="Security & Audit" />
                <div className="space-y-3">
                  {data.recentOperations && data.recentOperations.length > 0 ? (
                    data.recentOperations.map((op) => (
                      <div key={op.id} className="flex items-start gap-3 rounded-2xl border border-slate-100 p-3 text-sm hover:bg-slate-50/50 transition">
                        <div
                          className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                            op.type === "user"
                              ? "bg-blue-100 text-blue-700"
                              : op.type === "wo"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {op.badge}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-800">{op.title}</p>
                          <p className="text-xs text-slate-500">{op.detail}</p>
                        </div>
                        <span className="text-[11px] text-slate-400 shrink-0">{op.timestamp}</span>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                      No administrative operations recorded yet in PostgreSQL.
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        ) : null}
      </QueryGate>
    </div>
  );
}
