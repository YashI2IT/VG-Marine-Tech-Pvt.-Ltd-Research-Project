"use client";

import { TrendChart } from "@/components/charts/Charts";
import { Heatmap } from "@/components/heatmap/Heatmap";
import { Card, SectionHeader } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryGate } from "@/components/ui/QueryGate";
import { RecommendationCard, Timeline } from "@/components/ui/Feedback";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DemoBanner, EmptyState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatNumber, formatTime } from "@/lib/format";
import { getBatteryByVehicle } from "@/services/batteries";
import { listEvents } from "@/services/events";
import { getMaintenanceByVehicle } from "@/services/maintenance";
import { listCooling, listForecasts, listHotspots, listSensors } from "@/services/thermal";
import { getVehicle } from "@/services/vehicles";
import { Thermometer } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function VehicleDetailPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const { data, loading, error, reload } = useAsyncData(async () => {
    const [vehicle, battery, events, maint, cool, forecast, hotspot, sensors] = await Promise.all([
      getVehicle(vehicleId),
      getBatteryByVehicle(vehicleId),
      listEvents(),
      getMaintenanceByVehicle(vehicleId),
      listCooling(),
      listForecasts(),
      listHotspots(),
      listSensors(),
    ]);
    return {
      vehicle,
      battery,
      events: events.filter((e) => e.vehicleId === vehicleId),
      maint,
      cooling: cool.find((c) => c.vehicleId === vehicleId),
      forecast: forecast.find((f) => f.vehicleId === vehicleId),
      hotspot: hotspot.find((h) => h.vehicleId === vehicleId),
      sensors: sensors.filter((s) => s.vehicleId === vehicleId),
    };
  }, [vehicleId]);

  const v = data?.vehicle;
  const module = data?.battery?.modules.find((m) => m.cells.some((c) => c.isHotspot)) ?? data?.battery?.modules[0];

  return (
    <div>
      <PageHeader
        title={v ? `${v.id} · ${v.name}` : "Vehicle"}
        description={v ? `${v.location} · last update ${formatTime(v.lastUpdate)}` : "Vehicle thermal detail"}
        crumbs={[
          { href: "/dashboard", label: "Home" },
          { href: "/vehicles", label: "Vehicles" },
          { label: vehicleId },
        ]}
        actions={
          v ? (
            <Link href={`/vehicles/${v.id}/battery`} className="rounded-full bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white">
              Open battery
            </Link>
          ) : null
        }
      />
      <DemoBanner />
      <QueryGate loading={loading} error={error} onRetry={reload} isEmpty={!loading && !v} empty={<EmptyState title="Vehicle not found" />}>
        {v ? (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <StatusBadge label={v.status} tone={v.status} />
              <StatusBadge label={`risk ${v.thermalRisk}`} tone={v.thermalRisk} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <KpiCard label="Tmax" value={`${formatNumber(v.metrics.tmax)}°C`} icon={Thermometer} tone="rose" />
              <KpiCard label="Tmin" value={`${formatNumber(v.metrics.tmin)}°C`} />
              <KpiCard label="Tavg" value={`${formatNumber(v.metrics.tavg)}°C`} tone="mint" />
              <KpiCard label="ΔT" value={`${formatNumber(v.metrics.deltaT)}°C`} tone="amber" />
              <KpiCard label="dT/dt" value={`${formatNumber(v.metrics.dTdt)}°/min`} />
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <SectionHeader title="Module heatmap foundation" />
                {module ? <Heatmap cells={module.cells} rows={module.rows} cols={module.cols} /> : null}
              </Card>
              <Card>
                <SectionHeader title="Temperature trend" />
                <TrendChart data={(data?.hotspot?.trend ?? [v.metrics.tavg]).map((val, i) => ({ label: `${i}`, value: val }))} />
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-[20px] bg-[#eff6ff] p-4">
                    <p className="text-xs text-slate-400">Hotspot</p>
                    <p className="font-semibold">{data?.hotspot?.cellId ?? "None flagged"}</p>
                  </div>
                  <div className="rounded-[20px] bg-[#ecfdf5] p-4">
                    <p className="text-xs text-slate-400">Forecast</p>
                    <p className="font-semibold">{data?.forecast ? `${data.forecast.predictedTemperature}°C / ${data.forecast.horizonMinutes} min` : "No forecast available"}</p>
                  </div>
                </div>
              </Card>
            </div>
            <div className="grid gap-5 lg:grid-cols-3">
              <Card>
                <SectionHeader title="Cooling health" />
                {data?.cooling ? (
                  <>
                    <StatusBadge label={data.cooling.status} tone={data.cooling.status} />
                    <p className="mt-3 text-sm text-slate-500">Inlet {data.cooling.coolantInletC}°C · outlet {data.cooling.coolantOutletC}°C</p>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">No cooling diagnostic for this vehicle.</p>
                )}
              </Card>
              <Card>
                <SectionHeader title="Sensor health" />
                {data?.sensors.length ? data.sensors.map((s) => (
                  <p key={s.id} className="text-sm">{s.id} · residual {s.residual}°C</p>
                )) : <p className="text-sm text-slate-500">No sensor faults detected</p>}
              </Card>
              <Card>
                <SectionHeader title="Thermal exposure" kicker="Not SOH" />
                <p className="text-sm text-slate-500">See aging workspace for cumulative high-temperature hours.</p>
                <Link href="/thermal-intelligence/aging" className="mt-2 inline-block text-sm text-blue-600">Aging view</Link>
              </Card>
            </div>
            {data?.maint[0] ? <RecommendationCard title={data.maint[0].reason} body={data.maint[0].recommendation} /> : null}
            <Card>
              <SectionHeader title="Thermal events" />
              <Timeline
                items={data?.events.map((e) => ({
                  time: formatTime(e.timestamp),
                  title: `${e.type} · ${e.severity}`,
                  body: e.summary,
                })) ?? []}
              />
              {!data?.events.length ? <p className="text-sm text-slate-500">No thermal events for this vehicle.</p> : null}
            </Card>
          </div>
        ) : null}
      </QueryGate>
    </div>
  );
}
