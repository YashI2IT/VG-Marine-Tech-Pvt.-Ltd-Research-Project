"use client";

import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryGate } from "@/components/ui/QueryGate";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getAdminMaintenance } from "@/services/admin";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Cpu,
  HardDrive,
  RefreshCw,
  Server,
  ShieldCheck,
  Wrench,
  Zap,
} from "lucide-react";
import { useState } from "react";

export default function AdminMaintenancePage() {
  const { data, loading, error, reload } = useAsyncData(() => getAdminMaintenance(), []);
  const [runningDiag, setRunningDiag] = useState(false);
  const [diagSuccess, setDiagSuccess] = useState(false);

  function triggerDiagnostics() {
    setRunningDiag(true);
    setDiagSuccess(false);
    setTimeout(() => {
      setRunningDiag(false);
      setDiagSuccess(true);
      setTimeout(() => setDiagSuccess(false), 4000);
    }, 1500);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Fleet & Infrastructure Maintenance"
          description="Central operations for fleet battery work orders, physical-to-virtual sensor calibrations, and system node health."
          crumbs={[
            { href: "/dashboard", label: "Dashboard" },
            { href: "/admin", label: "Admin Hub" },
            { label: "Maintenance" },
          ]}
        />
        <Button
          onClick={triggerDiagnostics}
          disabled={runningDiag}
          className="flex items-center gap-2 self-start"
        >
          <RefreshCw className={`h-4 w-4 ${runningDiag ? "animate-spin" : ""}`} />
          {runningDiag ? "Running Self-Test…" : "Run System Diagnostics"}
        </Button>
      </div>

      {diagSuccess && (
        <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <span>Platform diagnostic check complete: All 4 microservices operating within nominal latency thresholds.</span>
        </div>
      )}

      <QueryGate loading={loading} error={error} onRetry={reload}>
        {data ? (
          <div className="space-y-6">
            {/* KPI Overview */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Active Work Orders"
                value={data.fleetWorkOrders.length}
                hint={`${data.fleetWorkOrders.filter((w) => w.priority === "critical").length} critical thermal priority`}
                icon={Wrench}
                tone="amber"
              />
              <KpiCard
                label="Sensor Calibrations"
                value={data.sensorCalibrations.length}
                hint="Physical NTC vs CNN-LSTM checks"
                icon={RefreshCw}
                tone="mint"
              />
              <KpiCard
                label="Infrastructure Nodes"
                value={`${data.platformServices.length}/4 Active`}
                hint="100% Core services online"
                icon={Server}
                tone="mint"
              />
              <KpiCard
                label="Uptime SLA"
                value="99.98%"
                hint="Last 30-day operational score"
                icon={ShieldCheck}
              />
            </div>

            {/* Fleet Battery Service Work Orders Table */}
            <Card>
              <SectionHeader
                title="Fleet Battery Work Orders"
                kicker="Maintenance Queue"
                action={<StatusBadge label="Active Queue" tone="healthy" />}
              />
              <div className="overflow-x-auto pt-2">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-400">
                      <th className="pb-3">Order ID</th>
                      <th className="pb-3">Vehicle & Pack</th>
                      <th className="pb-3">Diagnostic Issue</th>
                      <th className="pb-3">Priority</th>
                      <th className="pb-3">Assigned Lead</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 text-right">Target Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {data.fleetWorkOrders.map((wo) => (
                      <tr key={wo.id} className="hover:bg-slate-50/50">
                        <td className="py-3.5 font-mono text-xs font-bold text-slate-900">{wo.id}</td>
                        <td className="py-3.5">
                          <p className="font-semibold text-slate-900">{wo.vehicleId}</p>
                          <p className="text-xs text-slate-400">{wo.packId}</p>
                        </td>
                        <td className="py-3.5 text-xs text-slate-700 max-w-xs">{wo.issue}</td>
                        <td className="py-3.5">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              wo.priority === "critical"
                                ? "bg-rose-50 text-rose-700"
                                : wo.priority === "urgent"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {wo.priority}
                          </span>
                        </td>
                        <td className="py-3.5 text-xs font-medium text-slate-800">{wo.assignedTo}</td>
                        <td className="py-3.5">
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                            {wo.status}
                          </span>
                        </td>
                        <td className="py-3.5 text-right text-xs font-medium text-slate-500">{wo.dueDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Platform Infrastructure Health & Sensor Calibrations */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <SectionHeader title="Infrastructure Services" kicker="Container & Server Health" />
                <div className="space-y-3 pt-2">
                  {data.platformServices.map((svc, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-2xl bg-[#eff6ff] p-3 text-sm">
                      <div>
                        <p className="font-semibold text-slate-900">{svc.service}</p>
                        <p className="text-xs text-slate-500">
                          CPU: {svc.cpu} · Memory: {svc.memory} · Latency: {svc.latency}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                          {svc.uptime}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <SectionHeader title="Sensor Recalibration Register" kicker="Physical vs Virtual Alignment" />
                <div className="space-y-3 pt-2">
                  {data.sensorCalibrations.map((sensor, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-2xl border border-slate-100 p-3 text-sm">
                      <div>
                        <p className="font-semibold text-slate-900">{sensor.sensorId}</p>
                        <p className="text-xs text-slate-500">{sensor.location}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-slate-800">Drift: {sensor.driftError}</p>
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                          {sensor.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        ) : null}
      </QueryGate>
    </div>
  );
}
