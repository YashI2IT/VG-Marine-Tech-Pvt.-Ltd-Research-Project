"use client";

import { DistributionChart, TrendChart } from "@/components/charts/Charts";
import { Heatmap } from "@/components/heatmap/Heatmap";
import { Card, SectionHeader } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryGate } from "@/components/ui/QueryGate";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AlertCard, RecommendationCard } from "@/components/ui/Feedback";
import { DemoBanner } from "@/components/ui/States";
import { batteries } from "@/data/mock";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatNumber } from "@/lib/format";
import { getDashboardSummary } from "@/services/dashboard";
import {
  Activity,
  AlertTriangle,
  Fan,
  Gauge,
  MapPin,
  Thermometer,
  Wrench,
} from "lucide-react";
import Link from "next/link";

const dock = [
  { href: "/thermal-intelligence/hotspots", label: "Hotspots" },
  { href: "/thermal-intelligence/cooling", label: "Cooling" },
  { href: "/thermal-intelligence/sensors", label: "Sensors" },
  { href: "/thermal-intelligence/forecast", label: "Forecast" },
  { href: "/thermal-intelligence/aging", label: "Aging" },
  { href: "/maintenance", label: "Maintain" },
];

export default function DashboardPage() {
  const { data, loading, error, reload } = useAsyncData(() => getDashboardSummary(), []);
  const pack = batteries[0]?.modules[3];

  return (
    <div>
      <PageHeader
        title="Thermal overview"
        description="Executive summary of fleet thermal health, priority risk, and recommended next actions."
        crumbs={[{ href: "/dashboard", label: "Home" }, { label: "Dashboard" }]}
      />
      <DemoBanner />
      <QueryGate loading={loading} error={error} onRetry={reload}>
        {data ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Fleet thermal health" value={`${data.fleet.healthy}/${data.fleet.totalVehicles}`} hint="Healthy / total" icon={Activity} tone="mint" />
              <KpiCard label="Vehicles at risk" value={data.fleet.thermalRiskCount} hint={`${data.fleet.critical} critical`} icon={AlertTriangle} tone="rose" />
              <KpiCard label="Active anomalies" value={data.fleet.anomalyCount} icon={Thermometer} />
              <KpiCard label="Urgent maintenance" value={data.maintenance.filter((m) => m.priority === "urgent").length} icon={Wrench} tone="amber" />
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
              <Card className="flex flex-col">
                <SectionHeader title="Pack thermal map" kicker={data.hotspot.vehicleId} action={<StatusBadge label={data.hotspot.severity} tone={data.hotspot.severity} />} />
                <div className="rounded-[28px] bg-[#eff6ff] p-4">
                  {pack ? <Heatmap cells={pack.cells} rows={pack.rows} cols={pack.cols} /> : null}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xl font-semibold">{formatNumber(data.hotspot.tmax)}°</p>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Tmax</p>
                  </div>
                  <div>
                    <p className="text-xl font-semibold">{formatNumber(data.hotspot.deltaT)}°</p>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">ΔT</p>
                  </div>
                  <div>
                    <p className="text-xl font-semibold">{Math.round(data.hotspot.confidence * 100)}%</p>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Confidence</p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {dock.map((item, i) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`rounded-full px-3 py-2 text-xs font-semibold ${i === 0 ? "bg-[#2563eb] text-white" : "bg-[#eff6ff] text-slate-600 hover:bg-[#ecfdf5]"}`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </Card>

              <div className="grid gap-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <Card>
                    <SectionHeader title="Cooling health" action={<Link className="text-sm text-blue-600" href="/thermal-intelligence/cooling">Open</Link>} />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-3xl font-semibold">{Math.round(data.cooling.effectiveness * 100)}%</p>
                        <p className="text-xs text-slate-400">Effectiveness (demo)</p>
                      </div>
                      <StatusBadge label={data.cooling.status} tone={data.cooling.status} />
                    </div>
                    <p className="mt-4 text-sm text-slate-500">Expected {data.cooling.expectedResponse} vs observed {data.cooling.observedResponse} °C/min</p>
                  </Card>
                  <Card>
                    <SectionHeader title="Sensor health" action={<Link className="text-sm text-blue-600" href="/thermal-intelligence/sensors">Open</Link>} />
                    <p className="text-3xl font-semibold">{data.sensors.faulty} faulty</p>
                    <p className="text-sm text-slate-500">{data.sensors.healthy} sensors healthy on demo fleet sample</p>
                  </Card>
                </div>
                <Card>
                  <SectionHeader title="Vehicles at thermal risk" action={<Link className="text-sm text-blue-600" href="/fleet">Fleet</Link>} />
                  <div className="space-y-3">
                    {data.vehiclesAtRisk.map((v) => (
                      <Link key={v.id} href={`/vehicles/${v.id}`} className="flex items-center justify-between rounded-full bg-[#eff6ff] px-4 py-3">
                        <span className="flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-blue-500" />{v.id}</span>
                        <span className="text-sm text-slate-500">Tmax {formatNumber(v.metrics.tmax)}°C</span>
                        <StatusBadge label={v.thermalRisk} tone={v.thermalRisk} />
                      </Link>
                    ))}
                  </div>
                </Card>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              <Card>
                <SectionHeader title="Thermal aging" kicker="Exposure, not SOH" action={<Link className="text-sm text-blue-600" href="/thermal-intelligence/aging">Open</Link>} />
                <p className="text-3xl font-semibold">{data.aging.highExposureCount}</p>
                <p className="text-sm text-slate-500">Batteries with elevated thermal exposure hours</p>
                <DistributionChart data={data.aging.top.map((a) => ({ label: a.batteryId, value: a.exposureHours }))} />
              </Card>
              <Card>
                <SectionHeader title="Temperature forecast" action={<Link className="text-sm text-blue-600" href="/thermal-intelligence/forecast">Open</Link>} />
                <p className="text-3xl font-semibold">{formatNumber(data.forecast.predictedTemperature)}°C</p>
                <p className="text-sm text-slate-500">{data.forecast.horizonMinutes} min horizon · TTL {data.forecast.timeToLimitMin ?? "—"} min</p>
                <TrendChart data={data.forecast.trend.map((v, i) => ({ label: `${i}`, value: v }))} />
              </Card>
              <Card>
                <SectionHeader title="Sensor reduction" action={<Link className="text-sm text-blue-600" href="/sensor-analysis/placement">Open</Link>} />
                <p className="text-3xl font-semibold">{data.sensorReduction.reductionPct}%</p>
                <p className="text-sm text-slate-500">
                  {data.sensorReduction.currentSensors} → {data.sensorReduction.proposedSensors} sensors · RMSE {data.sensorReduction.reconstructionRmseC}°C (demo study)
                </p>
                <div className="mt-4 rounded-full bg-[#ecfdf5] px-4 py-3 text-sm text-emerald-800">Coverage {Math.round(data.sensorReduction.hotspotCoverage * 100)}%</div>
              </Card>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-3">
                <SectionHeader title="Active thermal anomalies" />
                {data.anomalies.map((a) => (
                  <AlertCard
                    key={a.id}
                    title={`${a.vehicleId} · ${a.cellId}`}
                    body={`${a.type} at ${formatNumber(a.temperature)}°C · confidence ${(a.confidence * 100).toFixed(0)}%`}
                    severity={a.severity}
                  />
                ))}
              </div>
              <div className="space-y-3">
                <SectionHeader title="Maintenance priorities" action={<Link className="text-sm text-blue-600" href="/maintenance">All</Link>} />
                {data.maintenance.map((m) => (
                  <RecommendationCard key={m.id} title={`${m.vehicleId} · ${m.priority}`} body={m.recommendation} />
                ))}
                <Card>
                  <SectionHeader title="Recent thermal events" action={<Link className="text-sm text-blue-600" href="/thermal-events">All</Link>} />
                  <ul className="space-y-2 text-sm">
                    {data.recentEvents.map((e) => (
                      <li key={e.id}>
                        <Link href={`/thermal-events/${e.id}`} className="flex items-center justify-between rounded-full px-2 py-2 hover:bg-[#eff6ff]">
                          <span>{e.vehicleId} · {e.type}</span>
                          <StatusBadge label={e.severity} tone={e.severity} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            </div>
            <p className="flex items-center gap-2 text-xs text-slate-400"><Fan className="h-3.5 w-3.5" /><Gauge className="h-3.5 w-3.5" /> Advisory platform only. No BMS control commands are issued from this UI.</p>
          </div>
        ) : null}
      </QueryGate>
    </div>
  );
}
