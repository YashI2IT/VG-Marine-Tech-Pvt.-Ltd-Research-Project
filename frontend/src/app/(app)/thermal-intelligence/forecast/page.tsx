"use client";

import { ForecastChart } from "@/components/charts/Charts";
import { Card, SectionHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryGate } from "@/components/ui/QueryGate";
import { DemoBanner, EmptyState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useAsyncData";
import { listForecasts } from "@/services/thermal";

export default function ForecastPage() {
  const { data, loading, error, reload } = useAsyncData(() => listForecasts(), []);
  const current = data?.[0];

  return (
    <div>
      <PageHeader
        title="Temperature forecast"
        description="Placeholder forecasts with uncertainty bands. No forecasting model is deployed."
        crumbs={[{ href: "/thermal-intelligence", label: "Thermal intelligence" }, { label: "Forecast" }]}
      />
      <DemoBanner />
      <QueryGate loading={loading} error={error} onRetry={reload} isEmpty={!loading && !data?.length} empty={<EmptyState title="No forecast available" />}>
        {data && current ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Current" value={`${current.currentTemperature}°C`} />
              <KpiCard label="Predicted" value={`${current.predictedTemperature}°C`} />
              <KpiCard label="Horizon" value={`${current.horizonMinutes} min`} />
              <KpiCard label="Time-to-limit" value={current.timeToLimitMin ? `${current.timeToLimitMin} min` : "—"} />
            </div>
            <Card>
              <SectionHeader title="Trend and uncertainty" />
              <ForecastChart
                data={current.trend.map((v, i) => ({
                  label: `${i}`,
                  value: v,
                  lower: v - 1.2,
                  upper: v + 1.6,
                }))}
              />
              <p className="mt-2 text-xs text-slate-400">Interval {current.confidenceInterval[0]}–{current.confidenceInterval[1]}°C · limit {current.limitC}°C</p>
            </Card>
            <Card>
              <DataTable
                rows={data.map((r) => ({ ...r, id: r.vehicleId }))}
                columns={[
                  { key: "v", header: "Vehicle", render: (r) => r.vehicleId },
                  { key: "c", header: "Current", render: (r) => `${r.currentTemperature}°C` },
                  { key: "p", header: "Predicted", render: (r) => `${r.predictedTemperature}°C` },
                  { key: "h", header: "Horizon", render: (r) => `${r.horizonMinutes} min` },
                  { key: "t", header: "TTL", render: (r) => r.timeToLimitMin ? `${r.timeToLimitMin} min` : "—" },
                ]}
              />
            </Card>
          </div>
        ) : null}
      </QueryGate>
    </div>
  );
}
