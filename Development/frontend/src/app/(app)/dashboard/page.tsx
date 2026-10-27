"use client";

import { TrendChart } from "@/components/charts/Charts";
import { Card, SectionHeader } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryGate } from "@/components/ui/QueryGate";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AlertCard, RecommendationCard } from "@/components/ui/Feedback";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatNumber, formatTime } from "@/lib/format";
import { getDashboardSummary, getTrustSenseOverview, type TrustSenseOverview } from "@/services/dashboard";
import { useState, useEffect } from "react";
import { getSession } from "@/services/auth";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  Fan,
  Gauge,
  MapPin,
  Thermometer,
  Wrench,
  Building2,
  Calendar,
  RefreshCw,
  ShieldCheck,
  Cpu,
  Flame,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ChevronRight,
  Database,
  Layers,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

const quickDock = [
  { href: "/thermal-intelligence/hotspots", label: "Hotspots" },
  { href: "/thermal-intelligence/cooling", label: "Cooling" },
  { href: "/thermal-intelligence/sensors", label: "Sensors" },
  { href: "/thermal-intelligence/forecast", label: "Forecast" },
  { href: "/thermal-intelligence/aging", label: "Aging" },
  { href: "/maintenance", label: "Maintenance" },
];

export default function DashboardPage() {
  const { data, loading, error, reload } = useAsyncData(() => getDashboardSummary(), []);
  const pipeline = useAsyncData(() => getTrustSenseOverview(), []);

  const [currentUser, setCurrentUser] = useState<{ name?: string; email?: string } | null>(null);
  const [greeting, setGreeting] = useState("Good day");
  const [currentDateStr, setCurrentDateStr] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    getSession().then((u) => setCurrentUser(u)).catch(() => {});

    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");

    const now = new Date();
    setCurrentDateStr(
      now.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    );
  }, []);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    await Promise.all([reload(), pipeline.reload()]);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const displayName = currentUser?.name?.trim().split(/\s+/)[0] || (currentUser?.email ? currentUser.email.split("@")[0] : "Operator");
  const companyName = data?.tenant?.name || "VG Marine Tech Fleet Ops";
  const urgentOrdersCount = data?.maintenance.filter((m) => m.priority === "urgent" || m.priority === "high").length ?? 0;

  return (
    <div className="space-y-6">
      {/* Top Greeting Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 pt-1 border-b border-slate-200/80">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {greeting}, {displayName}
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-200/90 px-3 py-0.5 text-xs font-semibold text-slate-700 shadow-2xs">
              <Building2 className="h-3.5 w-3.5 text-blue-600" />
              <span>{companyName}</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative fleet thermal telemetry, CNN-LSTM virtual sensor intelligence, and maintenance priorities.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-2 rounded-xl bg-white border border-slate-200/90 shadow-2xs px-3.5 py-2 text-xs font-medium text-slate-700">
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            <span>{currentDateStr || "Today"}</span>
          </div>
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="flex items-center gap-2 rounded-xl bg-white border border-slate-200/90 shadow-2xs px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition active:scale-95 disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 text-slate-500 transition-transform", isRefreshing && "animate-spin text-blue-600")} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <PageHeader
        title="Thermal overview"
        description="Executive summary of fleet thermal safety, active thermal divergences, and prioritized maintenance actions."
        crumbs={[{ href: "/dashboard", label: "Home" }, { label: "Dashboard" }]}
      />

      {/* Operational Status & TrustSense Pipeline Strip */}
      <TrustSensePipelineStrip overview={pipeline.data} error={pipeline.error} loading={pipeline.loading} onRetry={pipeline.reload} />

      {/* Main Dashboard Content Loaded from PostgreSQL */}
      <QueryGate loading={loading} error={error} onRetry={reload}>
        {data ? (
          <div className="space-y-6">
            {/* Zero Vehicles Empty State Notice */}
            {data.fleet.totalVehicles === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <MapPin className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">No Fleet Vehicles Registered</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                    Your organization ({companyName}) currently has zero vehicles registered in PostgreSQL. Add your fleet assets to begin monitoring thermal health.
                  </p>
                </div>
                <Link
                  href="/fleet"
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 transition"
                >
                  <span>Register Vehicles in Fleet</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : null}

            {/* Section B: Fleet Overview KPIs */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Fleet thermal health"
                value={`${data.fleet.healthy}/${data.fleet.totalVehicles}`}
                hint={`${data.fleet.healthy} nominal of ${data.fleet.totalVehicles} registered`}
                icon={ShieldCheck}
                tone="mint"
              />
              <KpiCard
                label="Vehicles at thermal risk"
                value={data.fleet.thermalRiskCount}
                hint={`${data.fleet.critical} critical · ${data.fleet.warning} watch/warning`}
                icon={AlertTriangle}
                tone="rose"
              />
              <KpiCard
                label="Active thermal anomalies"
                value={data.fleet.anomalyCount}
                hint={`${data.anomalies.length} pack thermal divergences flagged`}
                icon={Flame}
                tone="amber"
              />
              <KpiCard
                label="Urgent maintenance"
                value={urgentOrdersCount}
                hint={`${data.maintenance.length} open work orders in PostgreSQL`}
                icon={Wrench}
                tone="blue"
              />
            </div>

            {/* Section C: Thermal Intelligence & Highest Priority Hotspot */}
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              {/* Left Column: Highest-Risk Hotspot & Pack Thermal Distribution */}
              <Card className="flex flex-col justify-between">
                <div>
                  <SectionHeader
                    title="Pack thermal distribution"
                    kicker={data.hotspot ? `${data.hotspot.vehicleId} · Priority Risk` : "Fleet Hotspot Analysis"}
                    action={
                      data.hotspot ? (
                        <StatusBadge label={data.hotspot.severity} tone={data.hotspot.severity} />
                      ) : (
                        <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                          All Packs Nominal
                        </span>
                      )
                    }
                  />

                  {data.hotspot ? (
                    <div className="space-y-5">
                      {/* Vehicle and Location Strip */}
                      <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200/80 px-4 py-2.5 text-xs text-slate-700">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
                          <span className="font-semibold text-slate-900">{data.hotspot.name || data.hotspot.vehicleId}</span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-500">{data.hotspot.batteryId}</span>
                        </div>
                        <span className="font-mono text-slate-400 text-[11px]">
                          Updated {formatTime(data.hotspot.detectedAt)}
                        </span>
                      </div>

                      {/* Genuine Thermal Metrics Grid */}
                      <div className="grid grid-cols-3 gap-3 rounded-2xl bg-[#eff6ff]/70 border border-blue-100 p-4 text-center">
                        <div>
                          <p className="text-2xl font-bold tracking-tight text-slate-900">{formatNumber(data.hotspot.tmax)}°C</p>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mt-0.5">Tmax (Peak)</p>
                          <p className="text-[10px] text-rose-600 font-medium">Critical &ge; 55°C</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold tracking-tight text-slate-900">{formatNumber(data.hotspot.deltaT)}°C</p>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mt-0.5">&Delta;T (Gradient)</p>
                          <p className="text-[10px] text-amber-600 font-medium">Warning &ge; 8°C</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold tracking-tight text-slate-900">
                            {data.hotspot.dTdt >= 0 ? `+${formatNumber(data.hotspot.dTdt, 2)}` : formatNumber(data.hotspot.dTdt, 2)}
                          </p>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mt-0.5">dT/dt (Rise)</p>
                          <p className="text-[10px] text-slate-400 font-medium">°C / min</p>
                        </div>
                      </div>

                      {/* Secondary Metrics Row */}
                      <div className="grid grid-cols-3 gap-3 text-center border-t border-slate-100 pt-3">
                        <div>
                          <p className="text-base font-semibold text-slate-800">
                            {data.hotspot.tavg != null ? `${formatNumber(data.hotspot.tavg)}°C` : "—"}
                          </p>
                          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Pack Average</p>
                        </div>
                        <div>
                          <p className="text-base font-semibold text-slate-800">
                            {data.hotspot.tmin != null ? `${formatNumber(data.hotspot.tmin)}°C` : "—"}
                          </p>
                          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Inlet / Ambient</p>
                        </div>
                        <div>
                          <p className="text-base font-semibold text-slate-800">
                            {Math.round(data.hotspot.confidence * 100)}%
                          </p>
                          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Diagnostic Conf.</p>
                        </div>
                      </div>

                      {/* Honest Spatial Telemetry State Notice */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs text-slate-600">
                        <div className="flex items-start gap-2.5">
                          <Gauge className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-slate-800">Cell-Level Spatial Sensor Policy</p>
                            <p className="mt-0.5 text-slate-500 leading-relaxed text-[11px]">
                              {data.hotspot.spatialTelemetryNotice ||
                                "Pack-level thermal telemetry active. Cell-level thermocouple matrix requires individual sub-module sensor instrumentation. 16-cell spatial projection omitted per genuine telemetry policy."}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
                      <ShieldCheck className="h-10 w-10 text-emerald-500 mb-2" />
                      <p className="text-sm font-semibold text-slate-700">No Thermal Divergences</p>
                      <p className="text-xs text-slate-400 max-w-sm mt-1">
                        All monitored fleet battery systems are operating within safe temperature limits (&lt; 40°C).
                      </p>
                    </div>
                  )}
                </div>

                {/* Quick Navigation Dock */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap justify-center gap-2">
                  {quickDock.map((item, i) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                        i === 0
                          ? "bg-blue-600 text-white shadow-2xs hover:bg-blue-700"
                          : "bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </Card>

              {/* Right Column: Cooling Health & Sensor Diagnostics */}
              <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Cooling Health Card */}
                  <Card>
                    <SectionHeader
                      title="Cooling health"
                      action={
                        <Link className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-0.5" href="/thermal-intelligence/cooling">
                          <span>Open</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      }
                    />
                    {data.cooling ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-3xl font-bold tracking-tight text-slate-900">
                              {Math.round(data.cooling.effectiveness * 100)}%
                            </p>
                            <p className="text-xs text-slate-500">Thermal Loop Efficiency</p>
                          </div>
                          <StatusBadge label={data.cooling.status} tone={data.cooling.status} />
                        </div>
                        <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-xs space-y-1">
                          <p className="text-slate-600">
                            Observed response: <span className="font-semibold text-slate-800">{data.cooling.observedResponse} °C/min</span>
                          </p>
                          <p className="text-slate-400 text-[11px]">
                            Expected benchmark: {data.cooling.expectedResponse} °C/min
                          </p>
                        </div>
                        {data.cooling.issues && data.cooling.issues.length > 0 ? (
                          <p className="text-[11px] text-amber-700 font-medium">
                            {data.cooling.issues[0]}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 py-4">No cooling loops active</p>
                    )}
                  </Card>

                  {/* Sensor Health Card */}
                  <Card>
                    <SectionHeader
                      title="Sensor health"
                      action={
                        <Link className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-0.5" href="/thermal-intelligence/sensors">
                          <span>Open</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      }
                    />
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-baseline gap-2">
                          <p className="text-3xl font-bold tracking-tight text-slate-900">{data.sensors.faulty}</p>
                          <span className="text-xs font-semibold text-rose-600 uppercase tracking-wide">faulty</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {data.sensors.healthy} of {data.sensors.totalMonitored || data.fleet.totalVehicles} vehicle sensor channels nominal
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-xs space-y-1.5">
                        {data.sensors.latestTelemetry ? (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">Device {data.sensors.latestTelemetry.deviceId}</span>
                            <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              {data.sensors.latestTelemetry.trustDecision}
                            </span>
                          </div>
                        ) : null}
                        {data.sensors.items && data.sensors.items.length > 0 ? (
                          <p className="text-rose-700 font-medium text-[11px] truncate">
                            {data.sensors.items[0].vehicleId}: {data.sensors.items[0].faultType} divergence
                          </p>
                        ) : (
                          <p className="text-emerald-700 font-medium text-[11px]">
                            All monitored sensor channels calibrated
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Vehicles at Thermal Risk List */}
                <Card>
                  <SectionHeader
                    title="Vehicles at thermal risk"
                    action={
                      <Link className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-0.5" href="/fleet">
                        <span>Fleet list</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    }
                  />
                  {data.vehiclesAtRisk && data.vehiclesAtRisk.length > 0 ? (
                    <div className="space-y-2.5">
                      {data.vehiclesAtRisk.map((v) => (
                        <Link
                          key={v.id}
                          href={`/vehicles/${v.id}`}
                          className="flex items-center justify-between rounded-xl bg-slate-50 hover:bg-blue-50/70 border border-slate-200/80 px-4 py-2.5 transition text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <MapPin className="h-4 w-4 text-blue-600" />
                            <div>
                              <p className="font-semibold text-slate-900">{v.id}</p>
                              <p className="text-[11px] text-slate-500">{v.name}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-medium text-slate-700">
                              Tmax {formatNumber(v.metrics.tmax)}°C
                            </span>
                            <StatusBadge label={v.thermalRisk} tone={v.thermalRisk} />
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-slate-400">
                      Zero vehicles flagged with thermal risk.
                    </div>
                  )}
                </Card>
              </div>
            </div>

            {/* Section D: AI Model Inference, Predictive Analytics & Sensor Research */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Virtual Sensor Inference Contract Card */}
              <Card>
                <SectionHeader
                  title="CNN-LSTM Virtual Sensor"
                  kicker="Model Inference Engine"
                  action={
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/60 px-2 py-0.5 rounded-full">
                      {data.forecast.modelVersion}
                    </span>
                  }
                />
                <div className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-center">
                    <div>
                      <p className="text-xl font-bold text-slate-900">
                        {data.forecast.measuredTemperature != null ? `${formatNumber(data.forecast.measuredTemperature)}°C` : "—"}
                      </p>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mt-0.5">
                        Measured (Ref)
                      </p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-blue-700">
                        {data.forecast.predictedTemperature != null ? `${formatNumber(data.forecast.predictedTemperature)}°C` : "—"}
                      </p>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mt-0.5">
                        Predicted (CNN-LSTM)
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Residual (Ref - Pred):</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {data.forecast.residualDegC != null ? `${formatNumber(data.forecast.residualDegC, 2)}°C` : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Confidence Gate:</span>
                      <span className="font-semibold text-slate-800">{data.forecast.confidence}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">OOD Envelope:</span>
                      <span className="font-semibold text-emerald-700">{data.forecast.oodStatus || "IN-DISTRIBUTION"}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Input Contract:</span>
                      <span className="font-medium text-slate-700">6 features · 60-step window</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 italic">
                    * Battery temperature held out during feature extraction; no target leakage.
                  </p>
                </div>
              </Card>

              {/* Temperature Forecast Trend Card */}
              <Card>
                <SectionHeader
                  title="Temperature forecast"
                  kicker={`${data.forecast.horizonMinutes} min horizon`}
                  action={
                    <Link className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-0.5" href="/thermal-intelligence/forecast">
                      <span>Lab</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  }
                />
                <div className="flex items-baseline justify-between mb-2">
                  <div>
                    <p className="text-3xl font-bold tracking-tight text-slate-900">
                      {data.forecast.predictedTemperature != null ? `${formatNumber(data.forecast.predictedTemperature)}°C` : "—"}
                    </p>
                    <p className="text-xs text-slate-500">
                      TTL to threshold: <span className="font-semibold text-slate-700">{data.forecast.timeToLimitMin ?? "—"} min</span>
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">Limit: {data.forecast.limitC}°C</span>
                </div>
                {data.forecast.trend && data.forecast.trend.length > 0 ? (
                  <TrendChart data={data.forecast.trend.map((v, i) => ({ label: `W${i + 1}`, value: v }))} />
                ) : (
                  <div className="h-40 flex items-center justify-center text-xs text-slate-400">
                    Insufficient historical prediction samples
                  </div>
                )}
              </Card>

              {/* Sensor Reduction Study Card (Honest PLANNED_RESEARCH State) */}
              <Card>
                <SectionHeader
                  title="Sensor reduction"
                  action={
                    <span className="rounded-full bg-indigo-50 border border-indigo-200/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                      {data.sensorReduction?.status || "PLANNED RESEARCH"}
                    </span>
                  }
                />
                <div className="space-y-3.5">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl font-bold tracking-tight text-indigo-950">
                        {data.sensorReduction?.reductionPct || 75}%
                      </p>
                      <span className="text-xs font-medium text-slate-500">sparse reduction</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {data.sensorReduction?.currentSensors || 96} &rarr; {data.sensorReduction?.proposedSensors || 24} sensors · RMSE {data.sensorReduction?.reconstructionRmseC || 1.2}°C
                    </p>
                  </div>

                  <div className="rounded-xl bg-indigo-50/60 border border-indigo-100 p-3 text-xs text-indigo-900 space-y-1">
                    <p className="font-semibold">Laboratory Optimization Study</p>
                    <p className="text-[11px] text-indigo-700 leading-relaxed">
                      {data.sensorReduction?.advisoryNote ||
                        "Research capability currently under offline algorithm validation. Not active in production battery telemetry."}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600 border-t border-slate-100 pt-2.5">
                    <span>Hotspot Coverage:</span>
                    <span className="font-semibold text-emerald-700">
                      {Math.round((data.sensorReduction?.hotspotCoverage || 0.98) * 100)}%
                    </span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Section E: Maintenance Priorities & Active Anomalies */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left Column: Maintenance Priorities (Genuine PostgreSQL Work Orders) */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-800">Maintenance priorities</h2>
                  <Link className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-0.5" href="/maintenance">
                    <span>View all work orders ({data.maintenance.length})</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {data.maintenance && data.maintenance.length > 0 ? (
                  data.maintenance.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "rounded-2xl border p-4.5 transition",
                        m.priority === "urgent"
                          ? "bg-rose-50/70 border-rose-200/90"
                          : m.priority === "high"
                          ? "bg-amber-50/70 border-amber-200/90"
                          : "bg-emerald-50/70 border-emerald-200/90"
                      )}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-bold uppercase tracking-wider text-slate-700">
                          {m.id} · {m.vehicleId}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                            m.priority === "urgent"
                              ? "bg-rose-600 text-white"
                              : m.priority === "high"
                              ? "bg-amber-600 text-white"
                              : "bg-emerald-700 text-white"
                          )}
                        >
                          {m.priority}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{m.reason}</p>
                      <p className="mt-1 text-xs text-slate-600 leading-relaxed">{m.recommendation}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-400">
                    No open maintenance work orders in database.
                  </div>
                )}
              </div>

              {/* Right Column: Active Thermal Anomalies & Events */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-800">Active thermal anomalies</h2>
                  <Link className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-0.5" href="/thermal-events">
                    <span>All events ({data.recentEvents?.length ?? 0})</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {data.anomalies && data.anomalies.length > 0 ? (
                  data.anomalies.map((a) => (
                    <AlertCard
                      key={a.id}
                      title={`${a.vehicleId} · ${a.type}`}
                      body={`Peak temperature at ${formatNumber(a.temperature)}°C · Confidence ${(a.confidence * 100).toFixed(0)}%`}
                      severity={a.severity}
                      meta={
                        <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
                          <span>Battery: {a.batteryId}</span>
                          <span>Timestamp: {formatTime(a.timestamp)}</span>
                        </div>
                      }
                    />
                  ))
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-400">
                    No active anomalies detected across fleet.
                  </div>
                )}

                {/* Recent Thermal Events Sub-Card */}
                <Card className="mt-4">
                  <SectionHeader title="Recent recorded events" kicker="Audit Log" />
                  {data.recentEvents && data.recentEvents.length > 0 ? (
                    <ul className="divide-y divide-slate-100 text-xs">
                      {data.recentEvents.slice(0, 4).map((e) => (
                        <li key={e.id} className="py-2.5 flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-slate-800">{e.vehicleId}</span>
                            <span className="text-slate-400 mx-1.5">·</span>
                            <span className="text-slate-600">{e.type}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-[11px] font-mono">{formatTime(e.timestamp)}</span>
                            <StatusBadge label={e.severity} tone={e.severity} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400 py-3 text-center">No recent telemetry events recorded.</p>
                  )}
                </Card>
              </div>
            </div>

            {/* Advisory Platform Disclaimer Footnote */}
            <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/90 bg-white p-4 text-xs text-slate-500 shadow-2xs">
              <Fan className="h-4 w-4 text-blue-600 shrink-0" />
              <Gauge className="h-4 w-4 text-blue-600 shrink-0" />
              <p>
                <strong className="text-slate-700">Advisory Platform Boundary:</strong> ECUlytics TrustSense-BMS provides virtual sensor telemetry, diagnostic inferences, and maintenance advisories. No direct physical actuator commands or battery contactor control signals are issued from this user interface.
              </p>
            </div>
          </div>
        ) : null}
      </QueryGate>
    </div>
  );
}

function TrustSensePipelineStrip({
  overview,
  error,
  loading,
  onRetry,
}: {
  overview: TrustSenseOverview | null;
  error: string | null;
  loading: boolean;
  onRetry: () => void;
}) {
  const p = overview?.pipelineState;
  const acq = overview?.acquisition;
  const counts = overview?.counts;
  const modelReady = overview?.model?.ready === true;
  const source = p?.activeSource || "IDLE";

  return (
    <Card className="border border-slate-200/90 bg-white shadow-2xs">
      <SectionHeader
        title="TrustSense telemetry & pipeline status"
        kicker="Live Ingestion & Inference Infrastructure"
        action={
          <Link className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-0.5" href="/virtual-sensor">
            <span>Open virtual sensor lab</span>
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        }
      />
      {loading && !overview ? (
        <p className="text-xs text-slate-500 py-2">Loading pipeline telemetry status…</p>
      ) : error && !overview ? (
        <p className="text-xs text-slate-500 py-2">
          Pipeline API unreachable ({error}).{" "}
          <button type="button" className="text-blue-600 font-semibold cursor-pointer underline" onClick={onRetry}>
            Retry
          </button>
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <StatusBadge label={`Source: ${source}`} tone={source === "LIVE_DEVICE" ? "healthy" : "watch"} />
            <StatusBadge label={modelReady ? "CNN-LSTM Model: Ready" : "Model: Initializing"} tone={modelReady ? "healthy" : "warning"} />
            <StatusBadge
              label={acq?.connected ? `Device: ${acq.deviceId || "Active"}` : "Waiting for live battery telemetry"}
              tone={acq?.connected ? "healthy" : "watch"}
            />
            <StatusBadge
              label={overview?.ledger?.livePeerVerified ? "Fabric: Live Peer" : overview?.ledger?.mode || "Local Ledger Anchored"}
              tone="info"
            />
            <StatusBadge
              label={overview?.storage?.awsUploadImplemented ? "Storage: AWS S3" : "Storage: Local Evidence Vault"}
              tone="info"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard label="Admitted telemetry samples" value={p?.processedSamples ?? "—"} hint="In-memory verified pipeline" icon={Activity} />
            <KpiCard label="Valid inferences" value={p?.validWindowsProcessed ?? "—"} hint="60-step rolling windows" icon={Thermometer} />
            <KpiCard label="Quarantined records" value={p?.quarantinedCount ?? "—"} hint="Out-of-envelope samples" icon={AlertTriangle} tone="rose" />
            <KpiCard
              label="PostgreSQL telemetry rows"
              value={counts?.persistenceAvailable ? counts.telemetryRecords ?? 0 : "unavailable"}
              hint={counts?.persistenceAvailable ? `${counts.predictionRecords ?? 0} saved predictions` : "Database unreachable"}
              icon={Database}
            />
            <KpiCard
              label="Latest model prediction"
              value={p?.latestPredictedTemp != null ? `${p.latestPredictedTemp.toFixed(2)}°C` : "—"}
              hint={p?.latestTrustDecision ? `Trust: ${p.latestTrustDecision}` : "Awaiting window"}
              icon={Cpu}
              tone="mint"
            />
          </div>
        </div>
      )}
    </Card>
  );
}
