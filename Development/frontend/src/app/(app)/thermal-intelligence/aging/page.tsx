"use client";

import { TrendChart } from "@/components/charts/Charts";
import { Card, SectionHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryGate } from "@/components/ui/QueryGate";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DemoBanner, EmptyState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useAsyncData";
import { listAging } from "@/services/thermal";

export default function AgingPage() {
  const { data, loading, error, reload } = useAsyncData(() => listAging(), []);

  return (
    <div>
      <PageHeader
        title="Thermal aging"
        description="Thermal exposure indicator only. This is not a State of Health (SOH) or capacity prediction."
        crumbs={[{ href: "/thermal-intelligence", label: "Thermal intelligence" }, { label: "Aging" }]}
      />
      <DemoBanner />
      <QueryGate loading={loading} error={error} onRetry={reload} isEmpty={!loading && !data?.length} empty={<EmptyState title="No exposure records" />}>
        {data ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <KpiCard label="Highest exposure" value={`${data[0].exposureHours}h`} />
              <KpiCard label="High-temp duration" value={`${data[0].highTempDurationHours}h`} />
              <KpiCard label="Linked events" value={data[0].eventCount} />
            </div>
            <Card className="border-emerald-100 bg-[#ecfdf5]">
              <p className="text-sm text-emerald-900">Thermal exposure ≠ actual SOH. No capacity fade model is running in this UI.</p>
            </Card>
            <Card>
              <SectionHeader title="Exposure trend" />
              <TrendChart data={data[0].trend.map((v, i) => ({ label: `W${i + 1}`, value: v }))} unit="h" />
            </Card>
            <Card>
              <DataTable
                rows={data.map((r) => ({ ...r, id: r.batteryId }))}
                columns={[
                  { key: "b", header: "Battery", render: (r) => r.batteryId },
                  { key: "v", header: "Vehicle", render: (r) => r.vehicleId },
                  { key: "e", header: "Exposure hours", render: (r) => r.exposureHours, sortValue: (r) => r.exposureHours },
                  { key: "h", header: "High-temp hours", render: (r) => r.highTempDurationHours },
                  { key: "ev", header: "Events", render: (r) => r.eventCount },
                  { key: "r", header: "Aging-risk indicator", render: (r) => <StatusBadge label={r.riskIndicator} tone={r.riskIndicator === "high" ? "critical" : r.riskIndicator === "medium" ? "warning" : "info"} /> },
                ]}
              />
            </Card>
          </div>
        ) : null}
      </QueryGate>
    </div>
  );
}
