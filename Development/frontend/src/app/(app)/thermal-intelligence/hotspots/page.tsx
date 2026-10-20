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

export default function HotspotsPage() {
  const { data, loading, error, reload } = useAsyncData(() => listHotspots(), []);
  const [selected, setSelected] = useState<Hotspot | null>(null);
  const pack = batteries[0]?.modules[3];
  const current = selected ?? data?.[0];

  return (
    <div>
      <PageHeader
        title="Hotspots"
        description="UI foundation for localized heating evidence. Reconstruction model is not running."
        crumbs={[{ href: "/thermal-intelligence", label: "Thermal intelligence" }, { label: "Hotspots" }]}
      />
      <DemoBanner />
      <QueryGate loading={loading} error={error} onRetry={reload} isEmpty={!loading && !data?.length} empty={<EmptyState title="No thermal anomalies detected" />}>
        {data && current ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Temperature" value={`${formatNumber(current.temperature)}°C`} />
              <KpiCard label="ΔT" value={`${formatNumber(current.deltaT)}°C`} />
              <KpiCard label="Rate of rise" value={`${formatNumber(current.dTdt)}°/min`} />
              <KpiCard label="Persistence" value={`${current.persistenceMin} min`} />
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <SectionHeader title="Future heatmap" />
                {pack ? <Heatmap cells={pack.cells} rows={4} cols={4} selectedId={current.cellId} /> : null}
              </Card>
              <Card>
                <SectionHeader title="Evidence" />
                <p className="text-sm text-slate-600">{current.vehicleId} / {current.batteryId} / {current.moduleId} / {current.cellId}</p>
                <p className="mt-2 text-sm text-slate-500">Detected {formatTime(current.detectedAt)} · confidence {(current.confidence * 100).toFixed(0)}%</p>
                <div className="mt-3"><StatusBadge label={current.severity} tone={current.severity} /></div>
                <TrendChart data={current.trend.map((v, i) => ({ label: `${i}`, value: v }))} />
              </Card>
            </div>
            <Card>
              <DataTable
                rows={data}
                empty="No thermal anomalies detected"
                onRowClick={setSelected}
                columns={[
                  { key: "vehicle", header: "Vehicle", render: (r) => r.vehicleId, sortValue: (r) => r.vehicleId },
                  { key: "cell", header: "Cell", render: (r) => r.cellId },
                  { key: "t", header: "Temp", render: (r) => `${r.temperature}°C`, sortValue: (r) => r.temperature },
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
