"use client";

import { TrendChart } from "@/components/charts/Charts";
import { Heatmap } from "@/components/heatmap/Heatmap";
import { Card, SectionHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryGate } from "@/components/ui/QueryGate";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DemoBanner, EmptyState } from "@/components/ui/States";
import { batteries } from "@/data/mock";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatNumber, formatTime } from "@/lib/format";
import { listHotspots } from "@/services/thermal";
import type { Hotspot } from "@/types/domain";
import { useState } from "react";
import { Activity, AlertTriangle, ShieldCheck, Info } from "lucide-react";

export default function HotspotsPage() {
  const { data, loading, error, reload } = useAsyncData(() => listHotspots(), []);
  const [selected, setSelected] = useState<Hotspot | null>(null);
  const pack = batteries[0]?.modules[3];
  const current = selected ?? data?.[0];

  return (
    <div>
      <PageHeader
        title="Thermal hotspots"
        description="Vehicle-level localized heating identification and rate-of-rise tracking reconciled from PostgreSQL records."
        crumbs={[{ href: "/thermal-intelligence", label: "Thermal intelligence" }, { label: "Hotspots" }]}
      />
      <DemoBanner />
      <QueryGate loading={loading} error={error} onRetry={reload} isEmpty={!loading && !data?.length} empty={<EmptyState title="No thermal anomalies detected" />}>
        {data && current ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Tmax (Estimated)" value={`${formatNumber(current.temperature)}°C`} hint="Model-estimated cell core" tone="rose" />
              <KpiCard label="Thermal spread (ΔT)" value={`${formatNumber(current.deltaT)}°C`} hint="Tmax - Tmin across pack" tone="amber" />
              <KpiCard label="Rate of rise (dT/dt)" value={`${formatNumber(current.dTdt)}°/min`} hint="Observed slope" />
              <KpiCard label="Persistence window" value={`${current.persistenceMin} min`} hint="Continuous observation" />
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <div>
                  <span className="font-semibold">Authoritative Source & Methodology: </span>
                  Vehicle thermal indicators are derived from registered vehicle telemetry in PostgreSQL and live CNN-LSTM virtual sensor estimations.
                  The 4×4 sub-module heatmap below provides an illustrative spatial pack projection; single-cell foundation model estimates lumped cell temperature.
                </div>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <SectionHeader
                  title="Sub-module spatial projection"
                  kicker={current.vehicleId}
                  action={<span className="text-xs text-slate-400">Illustrative 16-cell layout</span>}
                />
                {pack ? <Heatmap cells={pack.cells} rows={4} cols={4} selectedId={current.cellId} /> : null}
              </Card>

              <Card>
                <SectionHeader title="Thermal evidence dossier" />
                <div className="space-y-1.5 text-sm text-slate-600">
                  <p><span className="font-medium text-slate-700">Vehicle Identifier:</span> {current.vehicleId} ({current.batteryId})</p>
                  <p><span className="font-medium text-slate-700">Observation Time:</span> {formatTime(current.detectedAt)}</p>
                  <p><span className="font-medium text-slate-700">Data Source:</span> {(current as any).dataSource || "PostgreSQL Vehicle Registry"}</p>
                  <p><span className="font-medium text-slate-700">Confidence Metric:</span> {Math.round(current.confidence * 100)}% (TrustValidator In-Distribution)</p>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <StatusBadge label={current.severity} tone={current.severity} />
                  <span className="text-xs text-slate-400">Rule: Critical if Tmax ≥ 55°C or ΔT ≥ 12°C</span>
                </div>
                <div className="mt-4">
                  <TrendChart data={current.trend.map((v, i) => ({ label: `t-${current.trend.length - 1 - i}`, value: v }))} />
                </div>
              </Card>
            </div>

            <Card>
              <SectionHeader title="Monitored fleet vehicle hotspots" kicker="Reconciled from PostgreSQL database" />
              <DataTable
                rows={data}
                empty="No thermal anomalies detected"
                onRowClick={setSelected}
                columns={[
                  { key: "vehicle", header: "Vehicle", render: (r) => r.vehicleId, sortValue: (r) => r.vehicleId },
                  { key: "battery", header: "Battery Pack", render: (r) => r.batteryId },
                  { key: "t", header: "Tmax (Est.)", render: (r) => `${r.temperature}°C`, sortValue: (r) => r.temperature },
                  { key: "dt", header: "Spread (ΔT)", render: (r) => `${r.deltaT}°C`, sortValue: (r) => r.deltaT },
                  { key: "dtdt", header: "dT/dt", render: (r) => `${r.dTdt}°/min` },
                  { key: "sev", header: "Severity", render: (r) => <StatusBadge label={r.severity} tone={r.severity} /> },
                  { key: "c", header: "Confidence", render: (r) => `${Math.round(r.confidence * 100)}%` },
                ]}
              />
            </Card>
          </div>
        ) : null}
      </QueryGate>
    </div>
  );
}
