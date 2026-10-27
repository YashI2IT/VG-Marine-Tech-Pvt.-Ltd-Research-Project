"use client";

import { Card, SectionHeader } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryGate } from "@/components/ui/QueryGate";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getAdminTraffic } from "@/services/admin";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Clock,
  Cpu,
  Globe,
  HardDrive,
  Radio,
  Server,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const tooltipStyle = {
  borderRadius: "16px",
  border: "1px solid #dbe7f5",
  backgroundColor: "#ffffff",
  boxShadow: "0 10px 30px rgba(15,39,68,0.08)",
  fontSize: "12px",
};

export default function TrafficAnalyticsPage() {
  const { data, loading, error, reload } = useAsyncData(() => getAdminTraffic(), []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Traffic & Telemetry Ingress"
        description="Real-time monitoring of user activity, virtual sensor inference demand, telemetry ingestion throughput, and system latency."
        crumbs={[
          { href: "/admin", label: "Admin Hub" },
          { href: "/admin", label: "Admin Hub" },
          { label: "User Traffic" },
        ]}
      />

      <QueryGate loading={loading} error={error} onRetry={reload}>
        {data ? (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="24h Total Requests"
                value={data.summary.totalRequests24h.toLocaleString()}
                hint={`Peak ${data.summary.peakRps} req/sec`}
                icon={BarChart3}
                tone="mint"
              />
              <KpiCard
                label="Average Latency"
                value={`${data.summary.avgLatencyMs} ms`}
                hint={`p95: ${data.summary.p95LatencyMs} ms · p99: ${data.summary.p99LatencyMs} ms`}
                icon={Clock}
              />
              <KpiCard
                label="Active User Sessions"
                value={data.summary.activeUserSessions}
                hint="Concurrent operator connections"
                icon={Radio}
                tone="mint"
              />
              <KpiCard
                label="Telemetry Volume"
                value={`${data.summary.bandwidthTodayGB} GB`}
                hint="High-frequency CAN/BMS stream"
                icon={HardDrive}
              />
            </div>

            {/* Hourly Traffic Chart */}
            <Card>
              <SectionHeader
                title="24-Hour Telemetry & User Traffic Distribution"
                kicker="Hourly Request Volume"
                action={<StatusBadge label="Live Ingestion Active" tone="healthy" />}
              />
              <div className="h-64 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.hourlyTraffic}>
                    <defs>
                      <linearGradient id="reqGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="sensorGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#eef3f9" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={45} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area
                      type="monotone"
                      dataKey="requests"
                      name="Total Requests"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#reqGrad)"
                    />
                    <Area
                      type="monotone"
                      dataKey="virtualSensorRuns"
                      name="Virtual Sensor Runs"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#sensorGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Endpoint Traffic & Tenant Share Breakdown */}
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <SectionHeader title="Top API Endpoint Loads" kicker="Microservice Breakdown" />
                <div className="overflow-x-auto">
                  {data.endpointBreakdown.length > 0 ? (
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-400">
                          <th className="pb-3">Endpoint Route</th>
                          <th className="pb-3 text-right">24h Invocations</th>
                          <th className="pb-3 text-right">Avg Latency</th>
                          <th className="pb-3 text-right">Error Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-slate-700">
                        {data.endpointBreakdown.map((ep, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-3 font-mono text-xs text-blue-600 font-medium">{ep.endpoint}</td>
                            <td className="py-3 text-right font-semibold">{ep.hits.toLocaleString()}</td>
                            <td className="py-3 text-right">{ep.avgMs} ms</td>
                            <td className="py-3 text-right">
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                {ep.errorRate}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                      No endpoint invocations recorded yet in the active monitoring window.
                    </div>
                  )}
                </div>
              </Card>

              <Card>
                <SectionHeader title="Tenant Traffic Share" kicker="Client Distribution" />
                <div className="space-y-4 pt-2">
                  {data.clientTenants.length > 0 ? (
                    data.clientTenants.map((t, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span className="text-slate-800">{t.tenant}</span>
                          <span className="font-semibold text-slate-900">{t.share}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-blue-600"
                            style={{ width: t.share }}
                          ></div>
                        </div>
                        <p className="text-[11px] text-slate-400">{t.requests.toLocaleString()} total requests</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                      No tenant traffic attributed yet in current window.
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
